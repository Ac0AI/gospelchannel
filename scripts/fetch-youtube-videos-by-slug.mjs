#!/usr/bin/env node

/**
 * Fetch the latest videos for every church that has a resolved
 * youtube_channel_id but no cached videos, using the cheapest possible
 * YouTube API path:
 *
 *   UC... (channel ID) → UU... (uploads playlist ID)
 *   playlistItems.list(part=snippet, playlistId=UU..., maxResults=12) = 1 unit
 *
 * 1 unit per church × 3000+ targets = fits easily inside the 10 000/day
 * default quota in one run. No search.list (which costs 100 units/call).
 *
 * Writes to churches.youtube_videos (jsonb) using the existing shape:
 *   [{ videoId, title, channelTitle, thumbnailUrl }]
 *
 * Usage:
 *   node scripts/fetch-youtube-videos-by-slug.mjs --dry-run --limit=10
 *   node scripts/fetch-youtube-videos-by-slug.mjs --limit=3000
 *   node scripts/fetch-youtube-videos-by-slug.mjs                 # all
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const DEFAULT_MAX_VIDEOS = 12;
const THROTTLE_MS = 80;

function parseArgs(argv) {
  const o = { dryRun: false, limit: 0, maxVideos: DEFAULT_MAX_VIDEOS };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
    else if (a.startsWith("--max-videos=")) o.maxVideos = Math.max(1, Number(a.split("=")[1]) || DEFAULT_MAX_VIDEOS);
  }
  return o;
}

// UC... channel ID → UU... uploads playlist ID (official YouTube convention)
function channelIdToUploadsPlaylist(channelId) {
  if (!channelId || !channelId.startsWith("UC")) return null;
  return `UU${channelId.slice(2)}`;
}

async function fetchUploadPlaylistItems(uploadsPlaylistId, maxResults, apiKey) {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("playlistId", uploadsPlaylistId);
  url.searchParams.set("maxResults", String(Math.min(maxResults, 50)));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (res.status === 403) {
    const body = await res.text();
    if (/quota/i.test(body)) throw new Error("QUOTA_EXCEEDED");
    return [];
  }
  if (res.status === 404) return []; // playlist not found
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item) => {
    const snip = item.snippet || {};
    const videoId = snip.resourceId?.videoId || "";
    if (!videoId) return null;
    return {
      videoId,
      title: snip.title || "",
      channelTitle: snip.channelTitle || "",
      publishedAt: snip.publishedAt || "",
      thumbnailUrl:
        snip.thumbnails?.high?.url ||
        snip.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }).filter(Boolean);
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) throw new Error("Missing DATABASE_URL");
  if (!process.env.YOUTUBE_API_KEY) throw new Error("Missing YOUTUBE_API_KEY");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
  const apiKey = process.env.YOUTUBE_API_KEY;

  console.log("Loading churches with youtube_channel_id but no cached videos...");
  const targets = options.limit > 0
    ? await sql`
        SELECT slug, name, youtube_channel_id FROM churches
        WHERE status = 'approved'
          AND youtube_channel_id IS NOT NULL
          AND (youtube_videos IS NULL OR youtube_videos::text = '[]')
        ORDER BY slug
        LIMIT ${options.limit}
      `
    : await sql`
        SELECT slug, name, youtube_channel_id FROM churches
        WHERE status = 'approved'
          AND youtube_channel_id IS NOT NULL
          AND (youtube_videos IS NULL OR youtube_videos::text = '[]')
        ORDER BY slug
      `;
  console.log(`Targets: ${targets.length}`);
  if (targets.length === 0) return;

  const summary = { total: targets.length, fetched: 0, empty: 0, errors: 0, quotaHit: false };

  for (let i = 0; i < targets.length; i += 1) {
    if (summary.quotaHit) break;
    const t = targets[i];
    const playlistId = channelIdToUploadsPlaylist(t.youtube_channel_id);
    if (!playlistId) {
      summary.errors += 1;
      continue;
    }
    try {
      const videos = await fetchUploadPlaylistItems(playlistId, options.maxVideos, apiKey);
      if (videos.length === 0) {
        summary.empty += 1;
      } else {
        if (!options.dryRun) {
          await sql`
            UPDATE churches
            SET youtube_videos = ${JSON.stringify(videos)}::jsonb, updated_at = NOW()
            WHERE slug = ${t.slug}
          `;
        }
        summary.fetched += 1;
        if (summary.fetched <= 5 || summary.fetched % 200 === 0) {
          console.log(`  ${summary.fetched}/${targets.length}: ${t.slug} → ${videos.length} videos`);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
        summary.quotaHit = true;
        console.log("\n  ⚠ YouTube quota exceeded — stopping");
        break;
      }
      summary.errors += 1;
      if (summary.errors < 5) console.log(`  error on ${t.slug}: ${error.message}`);
    }
    if (i + 1 < targets.length) await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));
  if (options.dryRun) console.log("DRY RUN — no DB writes.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
