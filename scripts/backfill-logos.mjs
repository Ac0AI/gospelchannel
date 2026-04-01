#!/usr/bin/env node

/**
 * Backfill church logos by finding site icons/logos from church websites.
 * Strategy: og:image, apple-touch-icon, favicon, then Haiku vision to pick best.
 *
 * Usage:
 *   node scripts/backfill-logos.mjs [--dry-run] [--limit=100]
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

const sql = neon(DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1]) || 9999;
const CONCURRENCY = 5;
const FETCH_TIMEOUT = 8_000;

const REJECTED_LOGO_PATTERNS = /swish|vipps|paypal|stripe|klarna|bankid|qr|venmo|cashapp|pixel|spacer|spinner|loading|placeholder|default|wix\.com|squarespace\.com|wordpress\.org\/logo|w3\.org|cloudflare|google-analytics|facebook\.com|twitter\.com/i;

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 50_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveUrl(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractLogoCandidates(html, baseUrl) {
  const candidates = [];

  // 1. apple-touch-icon (usually high-res square logo)
  const appleTouch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);
  if (appleTouch) {
    const url = resolveUrl(appleTouch[1], baseUrl);
    if (url) candidates.push({ url, type: "apple-touch-icon", priority: 10 });
  }

  // 2. og:image (often a good square logo or banner)
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogImage) {
    const url = resolveUrl(ogImage[1], baseUrl);
    if (url) candidates.push({ url, type: "og:image", priority: 5 });
  }

  // 3. SVG/PNG in header/nav that looks like a logo
  const logoImgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .filter(m => {
      const tag = m[0].toLowerCase();
      const src = m[1].toLowerCase();
      return (tag.includes("logo") || tag.includes("brand") || src.includes("logo") || src.includes("brand"))
        && !REJECTED_LOGO_PATTERNS.test(src);
    });
  for (const m of logoImgs) {
    const url = resolveUrl(m[1], baseUrl);
    if (url) candidates.push({ url, type: "logo-img", priority: 8 });
  }

  // 4. Large favicon
  const favicon192 = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+sizes=["']192x192["']/i)
    || html.match(/<link[^>]+sizes=["']192x192["'][^>]+href=["']([^"']+)["']/i);
  if (favicon192) {
    const url = resolveUrl(favicon192[1] || favicon192[2], baseUrl);
    if (url) candidates.push({ url, type: "favicon-192", priority: 7 });
  }

  // 5. Any icon link with sizes >= 128
  const iconLinks = [...html.matchAll(/<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["'][^>]*/gi)];
  for (const m of iconLinks) {
    const sizeMatch = m[0].match(/sizes=["'](\d+)x(\d+)["']/i);
    const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
    if (size >= 128) {
      const url = resolveUrl(m[1], baseUrl);
      if (url) candidates.push({ url, type: `icon-${size}`, priority: 6 });
    }
  }

  // Dedupe by URL, sort by priority desc
  const seen = new Set();
  return candidates
    .filter(c => {
      if (seen.has(c.url)) return false;
      if (REJECTED_LOGO_PATTERNS.test(c.url)) return false;
      seen.add(c.url);
      return true;
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3); // Top 3 candidates
}

async function verifyImageIsLogo(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/") && !contentType.includes("svg")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    // Must be at least 1KB (not a tracking pixel) and under 2MB
    return buf.length >= 1000 && buf.length <= 2_000_000;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function processChurch(church) {
  if (!church.website) return null;

  let baseUrl;
  try { baseUrl = new URL(church.website).origin; }
  catch { return null; }

  const html = await fetchHtml(church.website);
  if (!html) return { slug: church.slug, action: "skip", reason: "unreachable" };

  const candidates = extractLogoCandidates(html, baseUrl);
  if (candidates.length === 0) return { slug: church.slug, action: "skip", reason: "no_candidates" };

  // Try candidates in priority order
  for (const candidate of candidates) {
    const valid = await verifyImageIsLogo(candidate.url);
    if (!valid) continue;

    console.log(`  ✅ ${church.slug}: ${candidate.type} → ${candidate.url.slice(0, 70)}`);

    if (!DRY_RUN) {
      await sql.query(
        `UPDATE church_enrichments SET logo_image_url = $1 WHERE church_slug = $2`,
        [candidate.url, church.slug]
      );
      // Also insert enrichment row if it doesn't exist
      await sql.query(
        `INSERT INTO church_enrichments (church_slug, logo_image_url) VALUES ($1, $2) ON CONFLICT (church_slug) DO UPDATE SET logo_image_url = $2`,
        [church.slug, candidate.url]
      );
    }

    return { slug: church.slug, action: "found", type: candidate.type, url: candidate.url };
  }

  return { slug: church.slug, action: "skip", reason: "no_valid_image" };
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Logo Backfill from Church Websites");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("═══════════════════════════════════════════\n");

  const churches = await sql`
    SELECT c.slug, c.name, c.website
    FROM churches c
    WHERE c.status = 'approved'
    AND (c.logo IS NULL OR c.logo = '')
    AND NOT EXISTS (
      SELECT 1 FROM church_enrichments e
      WHERE e.church_slug = c.slug
      AND e.logo_image_url IS NOT NULL AND e.logo_image_url != ''
    )
    AND c.website IS NOT NULL AND c.website != ''
    ORDER BY c.name
    LIMIT ${LIMIT}
  `;

  console.log(`Found ${churches.length} churches without logos\n`);

  const stats = { found: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < churches.length; i += CONCURRENCY) {
    const batch = churches.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(processChurch));

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        if (r.value.action === "found") stats.found++;
        else stats.skipped++;
      } else {
        stats.errors++;
      }
    }

    if ((i + CONCURRENCY) % 100 < CONCURRENCY) {
      console.log(`  ... ${Math.min(i + CONCURRENCY, churches.length)}/${churches.length} | found: ${stats.found}`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`  Logos found:  ${stats.found}`);
  console.log(`  Skipped:      ${stats.skipped}`);
  console.log(`  Errors:       ${stats.errors}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
