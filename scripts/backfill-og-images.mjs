#!/usr/bin/env node

/**
 * Scrape hero image and logo from each church's website via Open Graph +
 * icon metadata. Writes `churches.header_image` (from og:image /
 * twitter:image) and `churches.logo` (from apple-touch-icon / icon link),
 * but only when the respective column is currently empty.
 *
 * Raw fetch only (no Firecrawl needed — we just need the <head>), so this is
 * free and fast.
 *
 * Usage:
 *   node scripts/backfill-og-images.mjs --countries="United States" --status=approved
 *   node scripts/backfill-og-images.mjs --limit=100 --dry-run
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
const sql = neon(DATABASE_URL);

const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";
const DEFAULT_CONCURRENCY = 15;
const FETCH_TIMEOUT = 8000;
const HEAD_BYTES = 200_000; // only read first 200 KB; <head> typically fits

function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

const DRY_RUN = process.argv.includes("--dry-run");
const STATUS_LIST = (parseFlag("status", "approved") || "approved").split(",").map((s) => s.trim()).filter(Boolean);
const COUNTRIES_RAW = parseFlag("countries");
const COUNTRIES = COUNTRIES_RAW ? COUNTRIES_RAW.split(",").map((c) => c.trim()).filter(Boolean) : null;
const LIMIT = parseInt(parseFlag("limit", "0"), 10) || 0;
const CONCURRENCY = parseInt(parseFlag("concurrency", String(DEFAULT_CONCURRENCY)), 10) || DEFAULT_CONCURRENCY;

// ─── Fetching ────────────────────────────────────────────────────────────────
async function fetchHead(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("xml")) return null;
    // Read only the first HEAD_BYTES to avoid loading the whole page
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (buf.length < HEAD_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Early-exit once </head> has been seen — OG tags always live there
      if (buf.includes("</head>")) break;
    }
    try { await reader.cancel(); } catch { /* no-op */ }
    return { html: buf, finalUrl: res.url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Extract ─────────────────────────────────────────────────────────────────
// Return the content attribute of the first matching meta tag.
function metaContent(html, pattern) {
  const m = html.match(pattern);
  return m ? m[1] : null;
}

// Extract all <link rel="..."> href+sizes, sorted by size desc.
function extractIcons(html) {
  const icons = [];
  const re = /<link\b[^>]*\brel\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const rel = m[1].toLowerCase();
    if (!/icon|apple-touch-icon|shortcut/.test(rel)) continue;
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const sizesMatch = tag.match(/\bsizes\s*=\s*["'](\d+)x\d+["']/i);
    icons.push({
      rel,
      href: hrefMatch[1],
      size: sizesMatch ? Number(sizesMatch[1]) : 0,
      isApple: rel.includes("apple-touch-icon"),
    });
  }
  // Prefer apple-touch-icon (usually 180x180, church-branded), then largest size
  icons.sort((a, b) => {
    if (a.isApple && !b.isApple) return -1;
    if (!a.isApple && b.isApple) return 1;
    return b.size - a.size;
  });
  return icons;
}

function absolutize(url, base) {
  if (!url) return null;
  try { return new URL(url, base).toString(); }
  catch { return null; }
}

function extractFromHtml(html, baseUrl) {
  // og:image — the visual hero. Accept property="og:image" or property="og:image:secure_url" etc.
  const ogImage = metaContent(html, /<meta[^>]+property\s*=\s*["']og:image(?::secure_url)?["'][^>]+content\s*=\s*["']([^"']+)["']/i)
    || metaContent(html, /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image(?::secure_url)?["']/i)
    || metaContent(html, /<meta[^>]+name\s*=\s*["']twitter:image(?::src)?["'][^>]+content\s*=\s*["']([^"']+)["']/i)
    || metaContent(html, /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']twitter:image(?::src)?["']/i);

  const icons = extractIcons(html);
  const logo = icons[0]?.href || null;

  return {
    header_image: absolutize(ogImage, baseUrl),
    logo: absolutize(logo, baseUrl),
  };
}

function isAcceptableImageUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    // Reject tiny trackers / placeholder 1x1 / data URIs
    if (u.pathname === "/" || u.pathname === "") return false;
    if (/\.(svg|ico)(\?|$)/i.test(u.pathname)) {
      // Allow SVG for logo only (caller decides)
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function sqlWithRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await fn(); }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/fetch failed|ECONN|ETIMEDOUT|timeout|network|socket hang up/i.test(msg) || attempt === 3) throw err;
      lastErr = err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Status: ${STATUS_LIST.join(",")}  Countries: ${COUNTRIES?.join(",") || "all"}  Limit: ${LIMIT || "none"}  Concurrency: ${CONCURRENCY}\n`);

  let query = `
    SELECT slug, name, country, website
    FROM churches
    WHERE status = ANY($1::text[])
      AND website IS NOT NULL AND website != ''
      AND (header_image IS NULL OR logo IS NULL)
  `;
  const params = [STATUS_LIST];
  if (COUNTRIES) { query += ` AND country = ANY($${params.length + 1}::text[])`; params.push(COUNTRIES); }
  query += ` ORDER BY country, name`;
  if (LIMIT > 0) { query += ` LIMIT $${params.length + 1}`; params.push(LIMIT); }

  const churches = await sql.query(query, params);
  console.log(`Targets: ${churches.length}\n`);
  if (churches.length === 0) return;

  const startedAt = Date.now();
  let done = 0;
  const stats = { ok: 0, fetchFail: 0, noImages: 0, headerWritten: 0, logoWritten: 0 };

  await mapWithConcurrency(churches, CONCURRENCY, async (church) => {
    done += 1;
    try {
      const fetched = await fetchHead(church.website);
      if (!fetched || !fetched.html) {
        stats.fetchFail += 1;
        return;
      }
      const { header_image, logo } = extractFromHtml(fetched.html, fetched.finalUrl || church.website);
      const goodHero = isAcceptableImageUrl(header_image) ? header_image : null;
      const goodLogo = isAcceptableImageUrl(logo) ? logo : null;
      if (!goodHero && !goodLogo) {
        stats.noImages += 1;
        return;
      }
      stats.ok += 1;
      if (goodHero) stats.headerWritten += 1;
      if (goodLogo) stats.logoWritten += 1;

      if (DRY_RUN) {
        if (done < 10) {
          console.log(`  ${church.slug}`);
          if (goodHero) console.log(`    hero: ${goodHero.slice(0, 120)}`);
          if (goodLogo) console.log(`    logo: ${goodLogo.slice(0, 120)}`);
        }
        return;
      }

      // Only fill columns that are currently empty (COALESCE-style write)
      await sqlWithRetry(() => sql.query(
        `UPDATE churches
         SET header_image = COALESCE(header_image, $1),
             logo = COALESCE(logo, $2),
             updated_at = NOW()
         WHERE slug = $3`,
        [goodHero, goodLogo, church.slug],
      ));
    } finally {
      if (done % 500 === 0 || done === churches.length) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = done / Math.max(1, elapsed);
        const eta = Math.round((churches.length - done) / Math.max(0.01, rate));
        console.log(`  ${done}/${churches.length} (${Math.round(100 * done / churches.length)}%) · ${rate.toFixed(1)}/s · ~${Math.round(eta/60)}min · hero=${stats.headerWritten} logo=${stats.logoWritten} noImg=${stats.noImages} fetchFail=${stats.fetchFail}`);
      }
    }
  });

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n━━━ Summary ━━━`);
  console.log(`Processed:       ${churches.length} in ${Math.round(elapsed/60)}m ${elapsed%60}s`);
  console.log(`Had image(s):    ${stats.ok}`);
  console.log(`Hero written:    ${stats.headerWritten}`);
  console.log(`Logo written:    ${stats.logoWritten}`);
  console.log(`No images found: ${stats.noImages}`);
  console.log(`Fetch failed:    ${stats.fetchFail}`);
}

main().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
