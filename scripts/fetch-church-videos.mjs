#!/usr/bin/env node

/**
 * Batch-fetch YouTube videos for each church and save to churches.json.
 * Run: source .env.local && node scripts/fetch-church-videos.mjs
 *
 * Quota: ~85 searches × 100 units = 8,500 units (within 10,000/day limit).
 * Each church gets 1 search → up to 12 video results saved.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = resolve(__dirname, "../src/data/churches.json");
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error("Missing YOUTUBE_API_KEY. Run: source .env.local && node scripts/fetch-church-videos.mjs");
  process.exit(1);
}

async function searchYouTube(query, maxResults = 12) {
  const params = new URLSearchParams({
    key: API_KEY,
    part: "snippet",
    type: "video",
    maxResults: String(maxResults),
    videoCategoryId: "10", // Music
    videoEmbeddable: "true",
    q: query,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      console.error("YouTube API quota exceeded or forbidden:", body);
      process.exit(1);
    }
    console.warn(`  Search failed (${res.status}): ${body}`);
    return [];
  }

  const data = await res.json();
  return (data.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl:
      item.snippet.thumbnails?.high?.url ??
      item.snippet.thumbnails?.medium?.url ??
      `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
  }));
}

async function main() {
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < churches.length; i++) {
    const church = churches[i];

    // Skip if already has videos
    if (church.youtubeVideos?.length > 0) {
      console.log(`[${i + 1}/${churches.length}] ${church.name} — already has ${church.youtubeVideos.length} videos, skipping`);
      skipped++;
      continue;
    }

    const query = `${church.name} worship official`;
    console.log(`[${i + 1}/${churches.length}] ${church.name} — searching: "${query}"`);

    const videos = await searchYouTube(query);

    if (videos.length > 0) {
      church.youtubeVideos = videos;
      updated++;
      console.log(`  → Found ${videos.length} videos`);
    } else {
      console.log(`  → No results`);
    }

    // Small delay to be nice to the API
    await new Promise((r) => setTimeout(r, 200));
  }

  writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Total: ${churches.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
