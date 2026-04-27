#!/usr/bin/env node
/**
 * YouTube channel extraction from church websites.
 *
 * For each target church:
 *   1. Fetch the homepage HTML.
 *   2. Find all YouTube URL candidates (channel/@handle/c/user/embed).
 *   3. Score and pick the best (prefer /channel > /@ > /c > /user).
 *   4. If candidate is not /channel/UC..., resolve to canonical channel ID
 *      by fetching the YouTube page and parsing meta/canonical/inline JSON.
 *   5. Write `youtube_channel_id` (canonical UC...) and stamp
 *      `youtube_searched_at`.
 *
 * Marks `youtube_searched_at` on every processed slug — match or no-match,
 * reachable or not — so subsequent runs skip it. Configurable recheck via
 * `--recheck-after=N` days (default 60 — websites change slowly).
 *
 * Why this exists: a recon of 80 random church sites showed YouTube hit
 * rate of ~32% on reachable sites vs ~4% for Spotify. YouTube is where
 * worship recordings actually live.
 *
 * Usage:
 *   node scripts/extract-youtube-from-website.mjs --dry-run --limit=20
 *   node scripts/extract-youtube-from-website.mjs --daily --daily-limit=500
 *   node scripts/extract-youtube-from-website.mjs --slugs=foo,bar
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const DEFAULTS = {
  concurrency: 8,
  throttleMs: 100,
  fetchTimeoutMs: 8000,
  dailyLimit: 500,
  recheckAfterDays: 60,
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function parseArgs(argv) {
  const options = {
    slugs: [],
    limit: 0,
    concurrency: DEFAULTS.concurrency,
    throttleMs: DEFAULTS.throttleMs,
    daily: false,
    dailyLimit: DEFAULTS.dailyLimit,
    recheckAfterDays: DEFAULTS.recheckAfterDays,
    dryRun: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--daily") options.daily = true;
    else if (arg.startsWith("--slugs=")) options.slugs = arg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--daily-limit=")) options.dailyLimit = Math.max(1, Number(arg.split("=")[1]) || DEFAULTS.dailyLimit);
    else if (arg.startsWith("--throttle=")) options.throttleMs = Math.max(0, Number(arg.split("=")[1]) || DEFAULTS.throttleMs);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || DEFAULTS.concurrency);
    else if (arg.startsWith("--recheck-after=")) options.recheckAfterDays = Math.max(1, Number(arg.split("=")[1]) || DEFAULTS.recheckAfterDays);
  }
  return options;
}

/* ── HTTP ── */

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextCapped(url, timeoutMs, capBytes = 600_000) {
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  const text = await res.text();
  return { ok: true, html: text.slice(0, capBytes), finalUrl: res.url };
}

/* ── YouTube URL extraction & ranking ── */

const URL_RE = /https?:\/\/(?:www\.|m\.)?youtube\.com\/(channel\/UC[A-Za-z0-9_-]{20,30}|@[A-Za-z0-9._-]{1,80}|c\/[A-Za-z0-9._-]{1,80}|user\/[A-Za-z0-9._-]{1,80})/g;

// Score: higher = preferred. Filters out video pages and unwanted forms.
function rankCandidate(path) {
  if (path.startsWith("channel/UC")) return 4;
  if (path.startsWith("@")) return 3;
  if (path.startsWith("c/")) return 2;
  if (path.startsWith("user/")) return 1;
  return 0;
}

function extractYouTubeCandidates(html) {
  const seen = new Set();
  const out = [];
  for (const match of html.matchAll(URL_RE)) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ path, rank: rankCandidate(path) });
  }
  out.sort((a, b) => b.rank - a.rank);
  return out;
}

/* ── Canonical channel ID resolution ── */

const CHANNEL_ID_RE = /UC[A-Za-z0-9_-]{20,30}/;

function extractChannelIdFromYouTubeHtml(html) {
  // Prefer canonical link / itemprop, fall back to inline JSON.
  let m = html.match(/<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,30})"/);
  if (m) return m[1];
  m = html.match(/<meta[^>]+itemprop="channelId"[^>]+content="(UC[A-Za-z0-9_-]{20,30})"/);
  if (m) return m[1];
  m = html.match(/"channelId":"(UC[A-Za-z0-9_-]{20,30})"/);
  if (m) return m[1];
  m = html.match(/"externalChannelId":"(UC[A-Za-z0-9_-]{20,30})"/);
  if (m) return m[1];
  return null;
}

async function resolveCanonicalChannelId(path, timeoutMs) {
  if (path.startsWith("channel/")) {
    const m = path.match(CHANNEL_ID_RE);
    return m ? m[0] : null;
  }
  // Need to fetch the YouTube page to get the canonical channel ID.
  const url = `https://www.youtube.com/${path}`;
  const result = await fetchTextCapped(url, timeoutMs, 800_000);
  if (!result.ok) return null;
  return extractChannelIdFromYouTubeHtml(result.html);
}

/* ── DB ── */

async function loadTargets(sql, options) {
  if (options.slugs.length > 0) {
    return sql`
      SELECT slug, name, country, website, youtube_channel_id, youtube_searched_at
      FROM churches
      WHERE slug = ANY(${options.slugs}::text[])
        AND status = 'approved'
    `;
  }
  if (options.daily) {
    const recheckInterval = `${options.recheckAfterDays} days`;
    return sql`
      SELECT slug, name, country, website, youtube_channel_id, youtube_searched_at
      FROM churches
      WHERE status = 'approved'
        AND website IS NOT NULL
        AND youtube_channel_id IS NULL
        AND (youtube_searched_at IS NULL
             OR youtube_searched_at < NOW() - ${recheckInterval}::interval)
      ORDER BY youtube_searched_at NULLS FIRST, slug
      LIMIT ${options.dailyLimit}
    `;
  }
  return sql`
    SELECT slug, name, country, website, youtube_channel_id, youtube_searched_at
    FROM churches
    WHERE status = 'approved'
      AND website IS NOT NULL
      AND youtube_channel_id IS NULL
      AND youtube_searched_at IS NULL
    ORDER BY RANDOM()
    LIMIT ${options.limit > 0 ? options.limit : 100}
  `;
}

async function markSearched(sql, slug) {
  await sql`UPDATE churches SET youtube_searched_at = NOW(), updated_at = NOW() WHERE slug = ${slug}`;
}

async function writeMatch(sql, slug, channelId) {
  await sql`UPDATE churches SET youtube_channel_id = ${channelId}, youtube_searched_at = NOW(), updated_at = NOW() WHERE slug = ${slug}`;
}

/* ── Worker ── */

async function mapWithConcurrency(items, limit, worker) {
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { await worker(items[i], i); } catch {}
    }
  });
  await Promise.all(runners);
}

/* ── Main ── */

function normalizeWebsiteUrl(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const targets = await loadTargets(sql, options);
  console.log(`Targets: ${targets.length} churches`);
  if (targets.length === 0) return;

  const summary = {
    processed: 0,
    unreachable: 0,
    noCandidates: 0,
    matched: 0,
    resolveFailed: 0,
    written: 0,
    errors: 0,
  };
  const matches = [];

  await mapWithConcurrency(targets, options.concurrency, async (church, index) => {
    summary.processed += 1;
    if (options.throttleMs > 0 && index > 0) {
      await new Promise((r) => setTimeout(r, options.throttleMs));
    }

    const url = normalizeWebsiteUrl(church.website);
    if (!url) {
      summary.unreachable += 1;
      if (!options.dryRun) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }

    let result;
    try {
      result = await fetchTextCapped(url, DEFAULTS.fetchTimeoutMs);
    } catch {
      summary.unreachable += 1;
      if (!options.dryRun) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }
    if (!result.ok) {
      summary.unreachable += 1;
      if (!options.dryRun) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }

    const candidates = extractYouTubeCandidates(result.html);
    if (candidates.length === 0) {
      summary.noCandidates += 1;
      if (!options.dryRun) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }

    let channelId = null;
    let resolvedFrom = null;
    for (const cand of candidates.slice(0, 3)) {
      try {
        const id = await resolveCanonicalChannelId(cand.path, DEFAULTS.fetchTimeoutMs);
        if (id) { channelId = id; resolvedFrom = cand.path; break; }
      } catch {}
    }

    if (!channelId) {
      summary.resolveFailed += 1;
      matches.push({ slug: church.slug, name: church.name, country: church.country, candidate: candidates[0]?.path, channelId: null });
      if (!options.dryRun) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }

    summary.matched += 1;
    matches.push({ slug: church.slug, name: church.name, country: church.country, candidate: resolvedFrom, channelId });

    if (!options.dryRun) {
      try {
        await writeMatch(sql, church.slug, channelId);
        summary.written += 1;
      } catch {
        summary.errors += 1;
      }
    }
  });

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));

  const matched = matches.filter((m) => m.channelId);
  const failed = matches.filter((m) => !m.channelId);

  console.log(`\nMatched (${matched.length}):`);
  for (const m of matched.slice(0, 25)) {
    console.log(`  [${m.country}] ${m.name}`);
    console.log(`        ${m.candidate} → UC: ${m.channelId}`);
  }
  if (matched.length > 25) console.log(`  ...and ${matched.length - 25} more`);

  if (failed.length > 0) {
    console.log(`\nResolve failed (${failed.length}) — found candidate but couldn't get canonical UC ID:`);
    for (const m of failed.slice(0, 10)) {
      console.log(`  [${m.country}] ${m.name}  candidate: ${m.candidate}`);
    }
    if (failed.length > 10) console.log(`  ...and ${failed.length - 10} more`);
  }

  if (options.dryRun) console.log("\nDRY RUN — no DB writes performed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
