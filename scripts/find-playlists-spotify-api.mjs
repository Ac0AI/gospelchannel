#!/usr/bin/env node

/**
 * Find Spotify playlists for churches using Spotify Search API directly.
 * No Apify needed. Uses Claude Haiku to validate matches.
 *
 * Usage: source .env.local && node scripts/find-playlists-spotify-api.mjs [--limit 200] [--offset 0]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = join(__dirname, "..", "src", "data", "churches.json");

const SPOTIFY_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!SPOTIFY_ID || !SPOTIFY_SECRET) { console.error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET"); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getArg(name, defaultVal) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : defaultVal;
}

const LIMIT = getArg("--limit", 200);
const OFFSET = getArg("--offset", 0);

// --- Spotify Auth ---
let spotifyToken = null;
let tokenExpires = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpires) return spotifyToken;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(SPOTIFY_ID + ":" + SPOTIFY_SECRET).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Spotify auth failed: " + JSON.stringify(data));
  spotifyToken = data.access_token;
  tokenExpires = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

// --- Spotify Search ---
async function searchSpotify(query, type = "playlist", limit = 10) {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`;

  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
    console.log(`  Rate limited, waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return searchSpotify(query, type, limit);
  }

  if (!res.ok) {
    console.error(`  Spotify error: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items = data.playlists?.items || data.artists?.items || [];
  return items.filter(Boolean);
}

// --- Claude Haiku validation ---
async function validateWithHaiku(churchName, churchCountry, results) {
  if (results.length === 0) return null;

  const list = results
    .slice(0, 8)
    .map((r, i) => {
      const owner = r.owner?.display_name || r.name || "";
      const tracks = r.tracks?.total || 0;
      const url = r.external_urls?.spotify || "";
      return `${i + 1}. "${r.name}" by ${owner} (${tracks} tracks) — ${url}`;
    })
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You match Spotify playlists to churches. Given a church name and country, pick the playlist most likely to be the church's own worship playlist. Prefer: 1) playlists owned by the church itself, 2) playlists clearly named after the church's worship/praise. Reject generic worship compilations, playlists by unrelated users, or results about different churches. Only pick if confident. Respond JSON only: {"pick": 1} or {"pick": null}.`,
      messages: [
        {
          role: "user",
          content: `Church: "${churchName}" (${churchCountry})\n\nSpotify playlists:\n${list}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try {
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) return null;
    const result = JSON.parse(jsonMatch[0]);
    if (result.pick >= 1 && result.pick <= results.length) {
      return results[result.pick - 1];
    }
  } catch { /* ignore */ }
  return null;
}

// --- Main ---
async function main() {
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));
  const missing = churches.filter((c) => !c.spotifyPlaylistIds || c.spotifyPlaylistIds.length === 0);

  const toProcess = missing.slice(OFFSET, OFFSET + LIMIT);
  console.log(`${missing.length} churches without playlists. Processing ${toProcess.length} (offset ${OFFSET})...\n`);

  let found = 0;
  let notFound = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const church = toProcess[i];
    const progress = `[${i + 1}/${toProcess.length}]`;

    // Search for playlists
    const queries = [
      `${church.name} worship`,
      `${church.name} church`,
    ];

    let allResults = [];
    for (const q of queries) {
      const results = await searchSpotify(q, "playlist", 5);
      allResults.push(...results);
      await sleep(100); // Rate limit buffer
    }

    // Deduplicate by ID
    const seen = new Set();
    allResults = allResults.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    if (allResults.length === 0) {
      notFound++;
      console.log(`${progress} - ${church.name}: no results`);
      continue;
    }

    const best = await validateWithHaiku(church.name, church.country || "", allResults);
    await sleep(100);

    if (best) {
      const playlistId = best.id;
      church.spotifyPlaylistIds = [playlistId];
      church.spotifyUrl = best.external_urls?.spotify || `https://open.spotify.com/playlist/${playlistId}`;
      found++;
      console.log(`${progress} ✓ ${church.name}: "${best.name}" by ${best.owner?.display_name} (${best.tracks?.total} tracks)`);

      // Save every 10 finds
      if (found % 10 === 0) {
        writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
        console.log(`  — saved progress (${found} found so far)\n`);
      }
    } else {
      notFound++;
      console.log(`${progress} - ${church.name}: Haiku rejected (${allResults.length} candidates)`);
    }
  }

  // Final save
  writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
  console.log(`\nDone! ${found} found, ${notFound} not found.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
