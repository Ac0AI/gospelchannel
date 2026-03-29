#!/usr/bin/env node

/**
 * Batch-fetch YouTube videos for each church using yt-dlp (no API quota needed).
 * Run: node scripts/fetch-church-videos-ytdlp.mjs
 *
 * Requires: yt-dlp installed (brew install yt-dlp)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = resolve(__dirname, "../src/data/churches.json");

function searchYouTube(query, maxResults = 10) {
  try {
    const output = execSync(
      `yt-dlp --flat-playlist --print "%(id)s|%(title)s|%(channel)s" "ytsearch${maxResults}:${query}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 30000 }
    );
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [videoId, title, channelTitle] = line.split("|");
        if (!videoId || videoId === "NA") return null;
        return {
          videoId,
          title: title || "Untitled",
          channelTitle: channelTitle || "YouTube",
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function filterOfficialVideos(videos, churchName) {
  // Prefer videos from the actual church channel or official-sounding titles
  const nameWords = churchName.toLowerCase().split(/\s+/);
  const scored = videos.map((v) => {
    let score = 0;
    const titleLower = v.title.toLowerCase();
    const channelLower = v.channelTitle.toLowerCase();

    // Channel matches church name
    if (nameWords.some((w) => channelLower.includes(w))) score += 3;
    // Title includes church name
    if (nameWords.some((w) => titleLower.includes(w))) score += 1;
    // Avoid compilations/playlists
    if (titleLower.includes("playlist") || titleLower.includes("collection") || titleLower.includes("nonstop") || titleLower.includes("best of")) score -= 2;
    // Prefer official/live
    if (titleLower.includes("official") || titleLower.includes("live")) score += 1;

    return { ...v, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => {
      const video = { ...item };
      delete video.score;
      return video;
    });
}

async function main() {
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < churches.length; i++) {
    const church = churches[i];

    // Skip if already has videos
    if (church.youtubeVideos?.length >= 6) {
      console.log(`[${i + 1}/${churches.length}] ${church.name} — already has ${church.youtubeVideos.length} videos, skipping`);
      skipped++;
      continue;
    }

    const query = `${church.name} worship official`;
    console.log(`[${i + 1}/${churches.length}] ${church.name} — searching: "${query}"`);

    const videos = searchYouTube(query, 12);
    const filtered = filterOfficialVideos(videos, church.name);

    if (filtered.length > 0) {
      church.youtubeVideos = filtered.slice(0, 10);
      updated++;
      console.log(`  → Found ${filtered.length} videos, keeping ${church.youtubeVideos.length}`);
    } else {
      console.log(`  → No results`);
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Total: ${churches.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
