#!/usr/bin/env node

/**
 * Fetch the 15 latest videos for each church with a resolved
 * youtube_channel_id, using YouTube's public RSS feed (no API quota).
 *
 *   https://www.youtube.com/feeds/videos.xml?channel_id=UCxxx
 *
 * Returns 15 latest uploads as Atom feed with entry elements containing
 * video id, title, published date, and thumbnail. No API key required.
 *
 * Writes to churches.youtube_videos (jsonb) in same shape as
 * fetch-youtube-videos-by-slug.mjs:
 *   [{ videoId, title, channelTitle, thumbnailUrl, publishedAt }]
 *
 * Usage:
 *   node scripts/fetch-youtube-videos-via-rss.mjs --limit=100 --dry-run
 *   node scripts/fetch-youtube-videos-via-rss.mjs
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
const sql = neon(DATABASE_URL);

const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";
const DEFAULT_CONCURRENCY = 10;
const FETCH_TIMEOUT = 8000;
const MAX_VIDEOS = 12;

function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = parseInt(parseFlag("limit", "0"), 10) || 0;
const CONCURRENCY = parseInt(parseFlag("concurrency", String(DEFAULT_CONCURRENCY)), 10) || DEFAULT_CONCURRENCY;
const FORCE = process.argv.includes("--force");

async function fetchRss(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/atom+xml,text/xml,*/*" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseAtomFeed(xml) {
  if (!xml) return [];
  const videos = [];
  const channelTitle = (xml.match(/<author>\s*<name>([^<]+)<\/name>/)?.[1] || "").trim();

  // Each <entry> contains one video
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const entry = m[1];
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!videoId || !title) continue;
    videos.push({
      videoId,
      title: title.trim(),
      channelTitle,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      publishedAt,
    });
    if (videos.length >= MAX_VIDEOS) break;
  }
  return videos;
}

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
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}  Concurrency: ${CONCURRENCY}  Limit: ${LIMIT || "none"}`);

  let query = `
    SELECT slug, name, youtube_channel_id
    FROM churches
    WHERE status = 'approved'
      AND youtube_channel_id IS NOT NULL AND youtube_channel_id != ''
  `;
  if (!FORCE) query += ` AND (youtube_videos IS NULL OR jsonb_array_length(youtube_videos) = 0)`;
  query += ` ORDER BY slug`;
  if (LIMIT > 0) query += ` LIMIT ${LIMIT}`;

  const churches = await sql.query(query);
  console.log(`Targets: ${churches.length}\n`);
  if (churches.length === 0) return;

  const startedAt = Date.now();
  let done = 0;
  const stats = { ok: 0, empty: 0, fetchFail: 0, videosTotal: 0 };

  await mapWithConcurrency(churches, CONCURRENCY, async (church) => {
    done += 1;
    try {
      const xml = await fetchRss(church.youtube_channel_id);
      if (!xml) { stats.fetchFail += 1; return; }
      const videos = parseAtomFeed(xml);
      if (videos.length === 0) { stats.empty += 1; return; }
      stats.ok += 1;
      stats.videosTotal += videos.length;

      if (DRY_RUN) {
        if (done < 5) console.log(`  ${church.slug}: ${videos.length} videos, first = "${videos[0].title.slice(0, 60)}"`);
        return;
      }

      await sqlWithRetry(() => sql.query(
        `UPDATE churches SET youtube_videos = $1::jsonb, updated_at = NOW() WHERE slug = $2`,
        [JSON.stringify(videos), church.slug],
      ));
    } finally {
      if (done % 500 === 0 || done === churches.length) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = done / Math.max(1, elapsed);
        const eta = Math.round((churches.length - done) / Math.max(0.01, rate));
        console.log(`  ${done}/${churches.length} · ${rate.toFixed(1)}/s · ok=${stats.ok} empty=${stats.empty} fail=${stats.fetchFail} · ~${Math.round(eta/60)}min`);
      }
    }
  });

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\n━━━ Summary ━━━`);
  console.log(`Processed:      ${churches.length} in ${Math.round(elapsed/60)}m ${elapsed%60}s`);
  console.log(`OK:             ${stats.ok}`);
  console.log(`Empty feed:     ${stats.empty}`);
  console.log(`Fetch failed:   ${stats.fetchFail}`);
  console.log(`Total videos:   ${stats.videosTotal}`);
}

main().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
