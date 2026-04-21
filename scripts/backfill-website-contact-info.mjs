#!/usr/bin/env node

/**
 * Single-pass backfill of email + social links from each church's website.
 * Replaces the older `backfill-emails.mjs` batch-serial design with streamed
 * `mapWithConcurrency`, so one slow site never blocks a whole batch. Also
 * tightens fetch timeout and short-circuits once all four fields are filled.
 *
 * Reads `churches.website`. Writes:
 *   churches.email
 *   church_enrichments.facebook_url / instagram_url / youtube_url
 *
 * Usage:
 *   node scripts/backfill-website-contact-info.mjs --status=approved --countries="United States"
 *   node scripts/backfill-website-contact-info.mjs --limit=100 --dry-run
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
const FETCH_TIMEOUT = 7_000;
const CONCURRENCY = 20;
const CONTACT_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us", "/connect", "/visit"];

// ─── Email extraction (mirrors backfill-emails.mjs) ──────────────────────────
const IGNORED_EMAIL_PATTERNS = [
  /noreply/i, /no-reply/i, /donotreply/i, /support@wix/i, /support@squarespace/i,
  /support@churchwebworks/i, /admin@wordpress/i, /example\.com/i, /test@/i,
  /webmaster@/i, /postmaster@/i, /user@domain/i, /info@mysite/i, /email@example/i,
  /your-email@/i, /name@domain/i, /^example@/i, /@mysite\./i, /@example\./i,
  /yourname@/i, /firstname.*lastname@/i, /@domain\.com/i, /@yourdomain/i,
  /@yourchurch/i, /placeholder/i, /sentry\.io$/i, /@sentry-next/i, /@wixpress\.com$/i,
];

function extractEmails(html) {
  const mailto = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  const plain = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const out = new Set();
  for (const m of html.matchAll(mailto)) out.add(m[1].toLowerCase());
  for (const m of html.matchAll(plain)) out.add(m[0].toLowerCase());
  return [...out].filter((e) => !IGNORED_EMAIL_PATTERNS.some((re) => re.test(e)));
}

function pickBestEmail(emails, churchName) {
  if (!emails.length) return null;
  const preferred = ["info", "office", "contact", "hello", "pastor", "church", "ministry", "admin"];
  const scored = emails.map((email) => {
    const local = email.split("@")[0];
    let score = 0;
    for (const p of preferred) if (local.includes(p)) score += 10;
    const nameTokens = String(churchName || "").toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    for (const t of nameTokens) if (email.includes(t)) score += 5;
    return { email, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].email;
}

// ─── Social extraction (mirrors backfill-social-links.mjs) ───────────────────
const SOCIAL_PATTERNS = {
  facebook:
    /https?:\/\/(?:www\.|m\.|web\.|business\.)?facebook\.com\/(?:pages\/[^\/"'\s]+\/\d+|p\/[A-Za-z0-9.\-]+|[A-Za-z0-9.\-]+)(?:\/)?(?=["'\s<>?#]|$)/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?(?=["'\s<>?#]|$)/gi,
  youtube:
    /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/UC[\w-]{22}|c\/[A-Za-z0-9_.\-]+|user\/[A-Za-z0-9_.\-]+|@[A-Za-z0-9_.\-]+)(?=["'\s<>?#/]|$)/gi,
};
const BAD_FB = [
  /facebook\.com\/sharer/i, /facebook\.com\/dialog/i, /facebook\.com\/tr/i,
  /facebook\.com\/plugins/i,
  /facebook\.com\/(home|login|signup|help|policies|terms|privacy|legal|careers|about|pages|p\.php|l\.php)\/?$/i,
];
const BAD_IG = [/instagram\.com\/(?:p|reel|tv|stories|explore|accounts|about)\b/i, /instagram\.com\/embed/i];
const BAD_YT = [/youtube\.com\/(?:watch|embed|results|shorts|feed|playlist)\b/i, /youtu\.be\//i];

function cleanFacebook(url) {
  try {
    const u = new URL(url);
    if (BAD_FB.some((re) => re.test(u.toString()))) return null;
    return `https://www.facebook.com${u.pathname.replace(/\/$/, "")}`;
  } catch { return null; }
}
function cleanInstagram(url) {
  try {
    const u = new URL(url);
    if (BAD_IG.some((re) => re.test(u.toString()))) return null;
    const handle = u.pathname.replace(/^\/|\/$/g, "").split("/")[0];
    if (!handle || handle.length < 2) return null;
    return `https://www.instagram.com/${handle}`;
  } catch { return null; }
}
function cleanYoutube(url) {
  try {
    const u = new URL(url);
    if (BAD_YT.some((re) => re.test(u.toString()))) return null;
    return `https://www.youtube.com${u.pathname.replace(/\/$/, "")}`;
  } catch { return null; }
}

function extractSocials(html) {
  const fb = new Set(), ig = new Set(), yt = new Set();
  for (const m of html.matchAll(SOCIAL_PATTERNS.facebook)) {
    const c = cleanFacebook(m[0]); if (c) fb.add(c);
  }
  for (const m of html.matchAll(SOCIAL_PATTERNS.instagram)) {
    const c = cleanInstagram(m[0]); if (c) ig.add(c);
  }
  for (const m of html.matchAll(SOCIAL_PATTERNS.youtube)) {
    const c = cleanYoutube(m[0]); if (c) yt.add(c);
  }
  return { fb, ig, yt };
}

// ─── Fetching ────────────────────────────────────────────────────────────────
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
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("xml") && !ct.includes("text")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function collectFromSite(church) {
  let base;
  try { base = new URL(church.website).origin; } catch { return null; }

  const emails = new Set();
  const fb = new Set(), ig = new Set(), yt = new Set();

  for (let i = 0; i < CONTACT_PATHS.length; i += 3) {
    const batch = CONTACT_PATHS.slice(i, i + 3);
    const pages = await Promise.all(batch.map((p) => fetchPage(`${base}${p}`)));
    for (const html of pages) {
      if (!html) continue;
      for (const e of extractEmails(html)) emails.add(e);
      const s = extractSocials(html);
      for (const u of s.fb) fb.add(u);
      for (const u of s.ig) ig.add(u);
      for (const u of s.yt) yt.add(u);
    }
    // Short-circuit once we have email + at least one social per platform.
    if (i >= 3 && emails.size > 0 && fb.size > 0 && ig.size > 0 && yt.size > 0) break;
  }

  return {
    email: pickBestEmail([...emails], church.name),
    facebook_url: [...fb][0] || null,
    instagram_url: [...ig][0] || null,
    youtube_url: [...yt][0] || null,
  };
}

// ─── DB writes ───────────────────────────────────────────────────────────────
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

async function saveEmail(slug, email) {
  await sqlWithRetry(() =>
    sql.query(`UPDATE churches SET email = $1, updated_at = NOW() WHERE slug = $2 AND (email IS NULL OR email = '')`, [email, slug]),
  );
}

async function saveSocials(slug, patch) {
  const keys = Object.keys(patch).filter((k) => patch[k]);
  if (!keys.length) return;
  const setClauses = keys.map((k, i) => `${k} = COALESCE(${k}, $${i + 2})`).join(", ");
  await sqlWithRetry(() =>
    sql.query(
      `UPDATE church_enrichments SET ${setClauses}, last_enriched_at = NOW(), updated_at = NOW() WHERE church_slug = $1`,
      [slug, ...keys.map((k) => patch[k])],
    ),
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

async function main() {
  const STATUS_LIST = (parseFlag("status", "approved") || "approved").split(",").map((s) => s.trim()).filter(Boolean);
  const COUNTRIES_RAW = parseFlag("countries");
  const COUNTRIES = COUNTRIES_RAW ? COUNTRIES_RAW.split(",").map((c) => c.trim()).filter(Boolean) : null;
  const LIMIT = parseInt(parseFlag("limit", "0"), 10) || 0;

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Status: ${STATUS_LIST.join(", ")}  Countries: ${COUNTRIES?.join(", ") || "all"}  Limit: ${LIMIT || "none"}`);
  console.log(`Concurrency: ${CONCURRENCY}  Fetch timeout: ${FETCH_TIMEOUT}ms\n`);

  // Pick churches missing ANY of the four fields (email + 3 socials).
  let query = `
    SELECT c.slug, c.name, c.website, c.country,
           c.email AS current_email,
           ce.facebook_url, ce.instagram_url, ce.youtube_url
    FROM churches c
    LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
    WHERE c.status = ANY($1::text[])
      AND c.website IS NOT NULL AND c.website != ''
      AND (
        (c.email IS NULL OR c.email = '')
        OR ce.facebook_url IS NULL
        OR ce.instagram_url IS NULL
        OR ce.youtube_url IS NULL
      )
  `;
  const params = [STATUS_LIST];
  if (COUNTRIES) { query += ` AND c.country = ANY($${params.length + 1}::text[])`; params.push(COUNTRIES); }
  query += ` ORDER BY c.country, c.name`;
  if (LIMIT > 0) { query += ` LIMIT $${params.length + 1}`; params.push(LIMIT); }

  const churches = await sql.query(query, params);
  console.log(`Target set: ${churches.length} churches\n`);

  let done = 0;
  const hits = { email: 0, fb: 0, ig: 0, yt: 0, any: 0 };
  const startedAt = Date.now();

  await mapWithConcurrency(churches, CONCURRENCY, async (church) => {
    const result = await collectFromSite(church);
    done += 1;
    if (!result) return;
    const { email, facebook_url, instagram_url, youtube_url } = result;
    const newEmail = email && !church.current_email ? email : null;
    const newFb = facebook_url && !church.facebook_url ? facebook_url : null;
    const newIg = instagram_url && !church.instagram_url ? instagram_url : null;
    const newYt = youtube_url && !church.youtube_url ? youtube_url : null;

    if (newEmail) hits.email += 1;
    if (newFb) hits.fb += 1;
    if (newIg) hits.ig += 1;
    if (newYt) hits.yt += 1;
    if (newEmail || newFb || newIg || newYt) hits.any += 1;

    if (!DRY_RUN) {
      if (newEmail) await saveEmail(church.slug, newEmail);
      if (newFb || newIg || newYt) {
        await saveSocials(church.slug, {
          ...(newFb ? { facebook_url: newFb } : {}),
          ...(newIg ? { instagram_url: newIg } : {}),
          ...(newYt ? { youtube_url: newYt } : {}),
        });
      }
    }

    if (done % 100 === 0 || done === churches.length) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const rate = (done / Math.max(1, elapsed)).toFixed(2);
      const remaining = Math.round((churches.length - done) / Math.max(0.01, Number(rate)));
      console.log(
        `  ${done}/${churches.length} (${Math.round(100 * done / churches.length)}%) · ${rate}/s · ~${Math.round(remaining / 60)}min left · email=${hits.email} fb=${hits.fb} ig=${hits.ig} yt=${hits.yt}`,
      );
    }
  });

  const total = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n━━━ Summary ━━━`);
  console.log(`Processed:  ${churches.length} in ${Math.round(total / 60)}m ${total % 60}s`);
  console.log(`Email:      ${hits.email}`);
  console.log(`Facebook:   ${hits.fb}`);
  console.log(`Instagram:  ${hits.ig}`);
  console.log(`YouTube:    ${hits.yt}`);
  console.log(`Any hit:    ${hits.any}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
