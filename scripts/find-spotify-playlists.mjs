#!/usr/bin/env node

/**
 * Find Spotify links on church websites for churches that don't have one yet.
 *
 * - Reads from local churches.json (no DB reads)
 * - Fetches each church's website HTML
 * - Extracts open.spotify.com links
 * - Writes matches to tmp/spotify-from-websites.json
 * - No database writes — review first, then apply separately
 *
 * Usage:
 *   node scripts/find-spotify-playlists.mjs                    # all without playlist
 *   node scripts/find-spotify-playlists.mjs --limit=100        # first 100
 *   node scripts/find-spotify-playlists.mjs --country=Sweden   # filter by country
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const CHURCHES_PATH = join(ROOT_DIR, "src/data/churches.json");
const OUTPUT_PATH = join(ROOT_DIR, "tmp/spotify-from-websites.json");
const CHECKPOINT_PATH = join(ROOT_DIR, "tmp/spotify-crawl-checkpoint.json");

// Parse args
const args = process.argv.slice(2);
let limit = 0;
let countryFilter = "";
const resume = args.includes("--resume");
for (const arg of args) {
  if (arg.startsWith("--limit=")) limit = Number(arg.split("=")[1]) || 0;
  if (arg.startsWith("--country=")) countryFilter = arg.split("=")[1].toLowerCase();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const SPOTIFY_RE = /https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:artist|playlist|album|track)\/[A-Za-z0-9]+/g;

async function fetchSpotifyLinks(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return [];

    const html = await res.text();
    const matches = [...new Set(html.match(SPOTIFY_RE) || [])];
    return matches;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function categorizeUrl(url) {
  if (url.includes("/playlist/")) return "playlist";
  if (url.includes("/artist/")) return "artist";
  if (url.includes("/album/")) return "album";
  if (url.includes("/track/")) return "track";
  return "other";
}

async function main() {
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf8"));

  let targets = churches.filter((c) => !c.spotifyUrl && c.website);

  if (countryFilter) {
    targets = targets.filter((c) => c.country?.toLowerCase() === countryFilter);
  }

  if (limit > 0) {
    targets = targets.slice(0, limit);
  }

  // Resume support
  let matches = [];
  let checkedSlugs = new Set();
  if (resume && existsSync(CHECKPOINT_PATH)) {
    const checkpoint = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
    matches = checkpoint.matches || [];
    checkedSlugs = new Set(checkpoint.checkedSlugs || []);
    console.log(`Resuming from checkpoint: ${checkedSlugs.size} already checked, ${matches.length} matches\n`);
  }

  const remaining = targets.filter((c) => !checkedSlugs.has(c.slug));
  console.log(`Crawling ${remaining.length} church websites for Spotify links...\n`);

  let crawled = 0;
  let found = matches.length;

  for (const church of remaining) {
    crawled++;
    checkedSlugs.add(church.slug);

    if (crawled % 25 === 0) {
      console.log(`Progress: ${crawled}/${remaining.length} crawled, ${found} with Spotify links`);
      // Save checkpoint
      mkdirSync(join(ROOT_DIR, "tmp"), { recursive: true });
      writeFileSync(CHECKPOINT_PATH, JSON.stringify({ matches, checkedSlugs: [...checkedSlugs] }));
    }

    try {
      const links = await fetchSpotifyLinks(church.website);

      if (links.length > 0) {
        // Prefer playlist > artist > album > track
        const sorted = links.sort((a, b) => {
          const order = { playlist: 0, artist: 1, album: 2, track: 3, other: 4 };
          return (order[categorizeUrl(a)] ?? 4) - (order[categorizeUrl(b)] ?? 4);
        });

        const best = sorted[0];
        found++;
        matches.push({
          slug: church.slug,
          name: church.name,
          country: church.country,
          website: church.website,
          spotifyUrl: best,
          spotifyType: categorizeUrl(best),
          allLinks: sorted,
        });
        console.log(`  [FOUND] ${church.name} -> ${categorizeUrl(best)}: ${best}`);
      }
    } catch (err) {
      // silently skip
    }

    await sleep(200);
  }

  // Write final results
  mkdirSync(join(ROOT_DIR, "tmp"), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(matches, null, 2));

  // Clean checkpoint
  if (existsSync(CHECKPOINT_PATH)) {
    writeFileSync(CHECKPOINT_PATH, JSON.stringify({ matches, checkedSlugs: [...checkedSlugs] }));
  }

  const byType = {};
  matches.forEach((m) => { byType[m.spotifyType] = (byType[m.spotifyType] || 0) + 1; });

  console.log(`\nDone! ${crawled + (targets.length - remaining.length)} crawled, ${found} with Spotify links.`);
  console.log("By type:", byType);
  console.log(`Results saved to: tmp/spotify-from-websites.json`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
