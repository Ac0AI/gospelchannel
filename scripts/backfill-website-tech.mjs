#!/usr/bin/env node
/**
 * Targeted backfill: churches that have a crawled website but no
 * church_website_tech entry. Re-fetches the homepage only, runs platform
 * detection, writes to church_website_tech.
 *
 * Why this exists: the rich extractor was started before platform detection
 * was wired in, so the first ~3500 churches (alphabetically early countries
 * like France, Germany A-D) got their email/phone/social fields but no
 * platform data. This script plugs that gap without re-doing the full
 * crawl.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { detectTechnologies, pickPrimaryPlatform, getSalesAngle } from "./lib/website-platform.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const FETCH_TIMEOUT = 6_000;
const CONCURRENCY = 16;
const HTML_CAP_BYTES = 600_000;

const FALLBACK_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us", "/kontakt", "/info", "/impressum"];
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchOne(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    return { ok: true, html: text.length > HTML_CAP_BYTES ? text.slice(0, HTML_CAP_BYTES) : text, finalUrl: res.url, status: 200 };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

// Try homepage, then 4 common fallback paths. Return first success.
async function fetchAnyPath(baseUrl) {
  for (const path of FALLBACK_PATHS) {
    const r = await fetchOne(`${baseUrl}${path}`);
    if (r.ok) return r;
  }
  return { ok: false };
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const onlyRetry = process.argv.includes("--retry-unreachable");
  const targets = onlyRetry
    ? await sql`
        SELECT c.slug, c.website
        FROM churches c
        JOIN church_website_tech t ON t.church_slug = c.slug
        WHERE c.status = 'approved'
          AND c.website IS NOT NULL
          AND t.primary_platform = 'Unknown'
          AND (t.http_status = 0 OR t.http_status >= 400)
        ORDER BY c.country, c.name
      `
    : await sql`
        SELECT c.slug, c.website
        FROM churches c
        LEFT JOIN church_website_tech t ON t.church_slug = c.slug
        WHERE c.status = 'approved'
          AND c.website IS NOT NULL
          AND c.website_extracted_at IS NOT NULL
          AND t.church_slug IS NULL
        ORDER BY c.country, c.name
      `;
  console.log(`Targets: ${targets.length} churches (mode: ${onlyRetry ? 'retry-unreachable' : 'fill-missing'})`);
  if (targets.length === 0) return;

  let processed = 0;
  let detected = 0;
  let unreachable = 0;
  const startedAt = Date.now();

  let cursor = 0;
  await Promise.all(Array(CONCURRENCY).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= targets.length) return;
      const church = targets[i];
      let baseUrl;
      try { baseUrl = new URL(church.website.startsWith("http") ? church.website : `https://${church.website}`).origin; }
      catch { processed++; unreachable++; continue; }

      const r = await fetchAnyPath(baseUrl);
      processed += 1;

      if (!r.ok || !r.html) {
        unreachable += 1;
        // Still write a record with primary_platform=Unknown so we don't
        // re-process this every time. Fail-safe insert.
        try {
          await sql`
            INSERT INTO church_website_tech (
              church_slug, website_url, final_url, http_status, primary_platform,
              technologies, sales_angle, detection_version, last_checked_at, created_at, updated_at
            ) VALUES (
              ${church.slug}, ${baseUrl}, ${baseUrl}, ${r.status || 0}, 'Unknown',
              '[]'::jsonb, 'Audit and modernization angle.', 1, NOW(), NOW(), NOW()
            )
            ON CONFLICT (church_slug) DO NOTHING
          `;
        } catch {}
      } else {
        const technologies = detectTechnologies({ website: church.website, finalUrl: r.finalUrl, html: r.html });
        const primary = pickPrimaryPlatform(technologies);
        const salesAngle = getSalesAngle(primary);
        try {
          await sql`
            INSERT INTO church_website_tech (
              church_slug, website_url, final_url, http_status, primary_platform,
              technologies, sales_angle, detection_version, last_checked_at, created_at, updated_at
            ) VALUES (
              ${church.slug}, ${church.website}, ${r.finalUrl || baseUrl}, 200, ${primary || 'Unknown'},
              ${technologies && technologies.length > 0 ? JSON.stringify(technologies) : '[]'}::jsonb,
              ${salesAngle || null}, 1, NOW(), NOW(), NOW()
            )
            ON CONFLICT (church_slug) DO UPDATE SET
              primary_platform = EXCLUDED.primary_platform,
              technologies = EXCLUDED.technologies,
              sales_angle = EXCLUDED.sales_angle,
              final_url = EXCLUDED.final_url,
              last_checked_at = NOW(),
              updated_at = NOW()
          `;
          if (primary && primary !== "Unknown") detected += 1;
        } catch (e) {
          // ignore individual failures
        }
      }

      if (processed % 200 === 0) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = processed / elapsed;
        const eta = Math.round((targets.length - processed) / rate / 60);
        console.log(`  ${processed}/${targets.length} | detected=${detected} | unreachable=${unreachable} | ${rate.toFixed(1)}/sec | ETA ${eta}min`);
      }
    }
  }));

  console.log(`\nDone. Processed=${processed}, detected=${detected}, unreachable=${unreachable} in ${((Date.now()-startedAt)/60000).toFixed(1)} min.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
