// Backfill publishedAt for videos in churches.json using YouTube Data API
// Usage: node scripts/backfill-video-dates.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = readFileSync(join(root, ".env.local"), "utf8");
const getEnv = (k) => envFile.split("\n").find((l) => l.startsWith(k + "="))?.slice(k.length + 1);

const API_KEY = getEnv("YOUTUBE_API_KEY");
if (!API_KEY) {
  console.error("Missing YOUTUBE_API_KEY in .env.local");
  process.exit(1);
}

const CHURCHES_PATH = join(root, "src/data/churches.json");
const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf8"));

// Collect all video IDs missing publishedAt
const missing = [];
for (const church of churches) {
  for (const video of church.youtubeVideos ?? []) {
    if (!video.publishedAt) {
      missing.push(video.videoId);
    }
  }
}

console.log(`${missing.length} videos missing publishedAt`);
if (missing.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// Fetch in batches of 50
const dateMap = new Map();
const batches = [];
for (let i = 0; i < missing.length; i += 50) {
  batches.push(missing.slice(i, i + 50));
}

console.log(`Fetching ${batches.length} batches from YouTube Data API...\n`);

for (let i = 0; i < batches.length; i++) {
  const ids = batches[i].join(",");
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}&key=${API_KEY}&fields=items(id,snippet/publishedAt)`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`Batch ${i + 1} failed: ${res.status} ${await res.text()}`);
    break;
  }

  const data = await res.json();
  for (const item of data.items ?? []) {
    dateMap.set(item.id, item.snippet.publishedAt);
  }

  process.stdout.write(`  Batch ${i + 1}/${batches.length} — ${dateMap.size} dates fetched\n`);
  await new Promise((r) => setTimeout(r, 100));
}

// Apply to churches.json
let filled = 0;
for (const church of churches) {
  for (const video of church.youtubeVideos ?? []) {
    if (!video.publishedAt && dateMap.has(video.videoId)) {
      video.publishedAt = dateMap.get(video.videoId);
      filled++;
    }
  }
}

writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
console.log(`\nDone: ${filled} videos updated, ${missing.length - filled} still missing (deleted/private videos).`);
