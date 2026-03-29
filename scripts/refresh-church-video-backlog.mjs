#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const CHURCHES_PATH = path.join(ROOT_DIR, "src", "data", "churches.json");

loadLocalEnv(ROOT_DIR);

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("Missing YOUTUBE_API_KEY");
  process.exit(1);
}

function readChurches() {
  return JSON.parse(fs.readFileSync(CHURCHES_PATH, "utf8"));
}

function writeChurches(churches) {
  fs.writeFileSync(CHURCHES_PATH, `${JSON.stringify(churches, null, 2)}\n`, "utf8");
}

function getDefaultTargets() {
  const report = JSON.parse(
    execFileSync("node", [path.join(ROOT_DIR, "scripts", "validate-content.mjs"), "--json"], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    }),
  );
  return (report.backlog?.videoReviewNeeded ?? []).map((item) => item.slug);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`YouTube request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function fetchChannelVideos(channelId, maxResults = 10) {
  const searchParams = new URLSearchParams({
    key: API_KEY,
    part: "snippet",
    type: "video",
    order: "date",
    channelId,
    maxResults: String(maxResults),
    videoEmbeddable: "true",
  });

  const searchPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
  const items = Array.isArray(searchPayload.items) ? searchPayload.items : [];
  if (items.length === 0) return [];

  const ids = items.map((item) => item.id?.videoId).filter(Boolean).join(",");
  if (!ids) return [];

  const detailParams = new URLSearchParams({
    key: API_KEY,
    part: "snippet,statistics",
    id: ids,
  });

  const detailPayload = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${detailParams.toString()}`);
  const detailsById = new Map((detailPayload.items ?? []).map((item) => [item.id, item]));

  return items.flatMap((item) => {
    const videoId = item.id?.videoId;
    if (!videoId) return [];
    const details = detailsById.get(videoId);
    const snippet = details?.snippet ?? item.snippet ?? {};
    return [{
      videoId,
      title: String(snippet.title ?? "").trim(),
      channelTitle: String(snippet.channelTitle ?? "").trim(),
      channelId: snippet.channelId ?? channelId,
      thumbnailUrl:
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        snippet.thumbnails?.default?.url ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      viewCount: Number(details?.statistics?.viewCount ?? 0),
      publishedAt: snippet.publishedAt,
    }];
  });
}

async function main() {
  const explicitTargets = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const targetSlugs = explicitTargets.length > 0 ? explicitTargets : getDefaultTargets();
  const targetSet = new Set(targetSlugs);
  const churches = readChurches();

  let refreshed = 0;
  let cleared = 0;

  for (const church of churches) {
    if (!targetSet.has(church.slug)) continue;

    if (church.youtubeChannelId) {
      const videos = await fetchChannelVideos(church.youtubeChannelId, 10);
      church.youtubeVideos = videos;
      refreshed += 1;
      console.log(`[video-backlog] refreshed ${church.slug} (${videos.length} videos)`);
    } else if (Array.isArray(church.youtubeVideos) && church.youtubeVideos.length > 0) {
      church.youtubeVideos = [];
      cleared += 1;
      console.log(`[video-backlog] cleared ${church.slug} (no official channel)`);
    }
  }

  writeChurches(churches);
  console.log(`[video-backlog] refreshed: ${refreshed}`);
  console.log(`[video-backlog] cleared: ${cleared}`);
  console.log(`[video-backlog] targets: ${targetSlugs.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
