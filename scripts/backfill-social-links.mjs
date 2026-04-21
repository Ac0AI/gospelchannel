#!/usr/bin/env node

/**
 * Backfill social media links (Facebook, Instagram, YouTube) for churches by
 * crawling the same contact/about pages the email backfill already walks.
 *
 * Reads from `churches.website`, writes to `church_enrichments.facebook_url`,
 * `instagram_url`, `youtube_url`. Only touches rows where the specific social
 * column is currently NULL.
 *
 * Usage:
 *   node scripts/backfill-social-links.mjs --dry-run
 *   node scripts/backfill-social-links.mjs --status=approved --countries="United States"
 *   node scripts/backfill-social-links.mjs --status=approved --countries="United States" --limit=100
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
const sql = neon(DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");

const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";
const FETCH_TIMEOUT = 10_000;
const CONCURRENCY = 5;
const CONTACT_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us", "/connect", "/visit"];

// Match real per-entity URLs (profile / page / channel), not generic sharing
// widgets (facebook.com/sharer/, youtube.com/embed/, instagram.com/embed/).
const PATTERNS = {
  facebook:
    /https?:\/\/(?:www\.|m\.|web\.|business\.)?facebook\.com\/(?:pages\/[^\/"'\s]+\/\d+|p\/[A-Za-z0-9.\-]+|[A-Za-z0-9.\-]+)(?:\/)?(?=["'\s<>?#]|$)/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?(?=["'\s<>?#]|$)/gi,
  youtube:
    /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/UC[\w-]{22}|c\/[A-Za-z0-9_.\-]+|user\/[A-Za-z0-9_.\-]+|@[A-Za-z0-9_.\-]+)(?=["'\s<>?#/]|$)/gi,
};

// Ignore obvious non-real-church URLs
const BAD_FACEBOOK = [
  /facebook\.com\/sharer/i,
  /facebook\.com\/dialog/i,
  /facebook\.com\/tr/i,
  /facebook\.com\/plugins/i,
  /facebook\.com\/(home|login|signup|help|policies|terms|privacy|legal|careers|about|pages|p\.php|l\.php)\/?$/i,
];
const BAD_INSTAGRAM = [
  /instagram\.com\/(?:p|reel|tv|stories|explore|accounts|about)\b/i,
  /instagram\.com\/embed/i,
];
const BAD_YOUTUBE = [
  /youtube\.com\/(?:watch|embed|results|shorts|feed|playlist)\b/i,
  /youtu\.be\//i,
];

function cleanFacebook(url) {
  try {
    const u = new URL(url);
    if (BAD_FACEBOOK.some((re) => re.test(u.toString()))) return null;
    // Strip query string + trailing slash
    return `https://www.facebook.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function cleanInstagram(url) {
  try {
    const u = new URL(url);
    if (BAD_INSTAGRAM.some((re) => re.test(u.toString()))) return null;
    const handle = u.pathname.replace(/^\/|\/$/g, "").split("/")[0];
    if (!handle || handle.length < 2) return null;
    return `https://www.instagram.com/${handle}`;
  } catch {
    return null;
  }
}

function cleanYoutube(url) {
  try {
    const u = new URL(url);
    if (BAD_YOUTUBE.some((re) => re.test(u.toString()))) return null;
    return `https://www.youtube.com${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function extractSocials(html) {
  const out = { facebook: new Set(), instagram: new Set(), youtube: new Set() };
  for (const m of html.matchAll(PATTERNS.facebook)) {
    const c = cleanFacebook(m[0]);
    if (c) out.facebook.add(c);
  }
  for (const m of html.matchAll(PATTERNS.instagram)) {
    const c = cleanInstagram(m[0]);
    if (c) out.instagram.add(c);
  }
  for (const m of html.matchAll(PATTERNS.youtube)) {
    const c = cleanYoutube(m[0]);
    if (c) out.youtube.add(c);
  }
  return out;
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function findSocialsForChurch(church) {
  let baseUrl;
  try {
    baseUrl = new URL(church.website).origin;
  } catch {
    return null;
  }

  const facebook = new Set();
  const instagram = new Set();
  const youtube = new Set();

  for (let i = 0; i < CONTACT_PATHS.length; i += 2) {
    const batch = CONTACT_PATHS.slice(i, i + 2);
    const pages = await Promise.all(batch.map((p) => fetchPage(`${baseUrl}${p}`)));
    for (const html of pages) {
      if (!html) continue;
      const socials = extractSocials(html);
      for (const u of socials.facebook) facebook.add(u);
      for (const u of socials.instagram) instagram.add(u);
      for (const u of socials.youtube) youtube.add(u);
    }
    // Early stop once we found something on all three AND we've checked the homepage.
    if (i >= 2 && facebook.size && instagram.size && youtube.size) break;
  }

  // Prefer first (most commonly the footer/header profile link).
  return {
    facebook_url: [...facebook][0] || null,
    instagram_url: [...instagram][0] || null,
    youtube_url: [...youtube][0] || null,
  };
}

function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

async function upsertEnrichment(slug, patch) {
  const keys = Object.keys(patch).filter((k) => patch[k] !== null && patch[k] !== undefined);
  if (keys.length === 0) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await sql.query(
        `UPDATE church_enrichments
           SET ${setClauses}, last_enriched_at = NOW(), updated_at = NOW()
         WHERE church_slug = $1`,
        [slug, ...keys.map((k) => patch[k])],
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/fetch failed|ECONN|ETIMEDOUT|timeout|network|socket hang up/i.test(msg) || attempt === 3) {
        throw err;
      }
      await sleep(500 * (attempt + 1));
    }
  }
}

async function main() {
  const STATUS_LIST = (parseFlag("status", "approved") || "approved").split(",").map((s) => s.trim()).filter(Boolean);
  const COUNTRIES_RAW = parseFlag("countries");
  const COUNTRIES = COUNTRIES_RAW ? COUNTRIES_RAW.split(",").map((c) => c.trim()).filter(Boolean) : null;
  const LIMIT = parseInt(parseFlag("limit", "0"), 10) || 0;

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Status filter: ${STATUS_LIST.join(", ")}`);
  console.log(`Country filter: ${COUNTRIES ? COUNTRIES.join(", ") : "all"}`);
  console.log(`Limit: ${LIMIT || "none"}\n`);

  // Skip if ALL three social columns are already populated for this church.
  let query = `
    SELECT c.slug, c.name, c.website, c.country
    FROM churches c
    LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
    WHERE c.status = ANY($1::text[])
      AND c.website IS NOT NULL AND c.website != ''
      AND (ce.facebook_url IS NULL OR ce.instagram_url IS NULL OR ce.youtube_url IS NULL)
  `;
  const params = [STATUS_LIST];
  if (COUNTRIES) {
    query += ` AND c.country = ANY($${params.length + 1}::text[])`;
    params.push(COUNTRIES);
  }
  query += ` ORDER BY c.country, c.name`;
  if (LIMIT > 0) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(LIMIT);
  }

  const churches = await sql.query(query, params);
  console.log(`Found ${churches.length} churches with website needing social links\n`);

  let hits = { facebook: 0, instagram: 0, youtube: 0, any: 0 };
  let missed = 0;
  let done = 0;

  await mapWithConcurrency(churches, CONCURRENCY, async (church) => {
    const result = await findSocialsForChurch(church);
    done += 1;
    if (!result) { missed += 1; return; }
    const { facebook_url, instagram_url, youtube_url } = result;
    if (facebook_url) hits.facebook += 1;
    if (instagram_url) hits.instagram += 1;
    if (youtube_url) hits.youtube += 1;
    if (facebook_url || instagram_url || youtube_url) {
      hits.any += 1;
      const fb = facebook_url ? "f" : "-";
      const ig = instagram_url ? "i" : "-";
      const yt = youtube_url ? "y" : "-";
      console.log(`✅ [${fb}${ig}${yt}] ${church.slug}`);
      if (!DRY_RUN) {
        await upsertEnrichment(church.slug, {
          ...(facebook_url ? { facebook_url } : {}),
          ...(instagram_url ? { instagram_url } : {}),
          ...(youtube_url ? { youtube_url } : {}),
        });
      }
    } else {
      missed += 1;
    }
    if (done % 200 === 0) {
      console.log(`  progress ${done}/${churches.length} | fb=${hits.facebook} ig=${hits.instagram} yt=${hits.youtube}`);
    }
  });

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Churches processed: ${churches.length}`);
  console.log(`Any social found:   ${hits.any}`);
  console.log(`Facebook:           ${hits.facebook}`);
  console.log(`Instagram:          ${hits.instagram}`);
  console.log(`YouTube:            ${hits.youtube}`);
  console.log(`Missed:             ${missed}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
