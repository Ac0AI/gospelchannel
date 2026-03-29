#!/usr/bin/env node

/**
 * Fixes Spotify playlist IDs for all churches by searching the Spotify API.
 * Uses the Spotify Search API to find relevant worship playlists.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = join(__dirname, "..", "src", "data", "churches.json");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Get Spotify access token (client credentials flow)
async function getSpotifyToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

// Search Spotify for playlists
async function searchPlaylists(token, query, limit = 10) {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`  ⚠ Spotify search failed (${res.status})`);
    return [];
  }
  const data = await res.json();
  return data.playlists?.items || [];
}

// Check if a playlist ID is valid
async function checkPlaylist(token, id) {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${id}?fields=id,name,tracks.total`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

// Score a playlist for relevance to a church
function scorePlaylist(playlist, churchName) {
  if (!playlist || !playlist.name) return 0;
  const name = playlist.name.toLowerCase();
  const church = churchName.toLowerCase();

  let score = 0;

  // Strong match: playlist name contains church name
  if (name.includes(church)) score += 50;
  // Partial match on key words
  const churchWords = church.split(/[\s/&]+/).filter(w => w.length > 2);
  for (const word of churchWords) {
    if (name.includes(word)) score += 10;
  }

  // Boost "This Is" playlists (Spotify editorial)
  if (name.startsWith("this is")) score += 20;

  // Boost worship-related keywords
  const worshipWords = ["worship", "praise", "gospel", "hymn", "church"];
  for (const w of worshipWords) {
    if (name.includes(w)) score += 5;
  }

  // Boost by follower count (popularity)
  if (playlist.tracks?.total > 20) score += 5;

  // Penalty for clearly wrong content
  const badWords = ["reggaeton", "hip hop", "rap", "trap", "r&b", "pop hits", "party", "club"];
  for (const w of badWords) {
    if (name.includes(w)) score -= 100;
  }

  return score;
}

async function main() {
  const token = await getSpotifyToken();
  console.log("Got Spotify token.\n");

  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));
  let fixed = 0;

  for (const church of churches) {
    const name = church.name;

    // First check if existing playlist IDs are valid
    let existingValid = false;
    if (church.spotifyPlaylistIds?.length > 0) {
      existingValid = await checkPlaylist(token, church.spotifyPlaylistIds[0]);
      if (existingValid) {
        // Playlist exists — but might be wrong content. Search anyway for better ones.
      }
    }

    // Search for playlists
    const searchTerms = [
      `${name} worship`,
      `This Is ${name}`,
      name,
    ];

    const allPlaylists = [];
    for (const term of searchTerms) {
      const results = await searchPlaylists(token, term, 5);
      allPlaylists.push(...results);
    }

    // Deduplicate
    const seen = new Set();
    const unique = allPlaylists.filter((p) => {
      if (!p || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    // Score and sort
    const scored = unique
      .map((p) => ({ ...p, score: scorePlaylist(p, name) }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const best = scored[0];

      const oldId = church.spotifyPlaylistIds?.[0] || "(none)";
      const changed = oldId !== best.id;

      church.spotifyPlaylistIds = [best.id];
      church.spotifyUrl = `https://open.spotify.com/playlist/${best.id}`;

      if (changed) {
        fixed++;
        console.log(`✓ ${name}: "${best.name}" (score: ${best.score}) [UPDATED]`);
      } else {
        console.log(`  ${name}: "${best.name}" (score: ${best.score}) [unchanged]`);
      }

      // Add runner-ups to additionalPlaylists if they're good
      const extras = scored.slice(1, 4).filter((p) => p.score >= 15).map((p) => p.id);
      if (extras.length > 0) {
        const existing = new Set(church.additionalPlaylists || []);
        extras.forEach((id) => existing.add(id));
        church.additionalPlaylists = [...existing];
      }
    } else {
      console.log(`⚠ ${name}: no good playlists found`);
    }

    await sleep(200); // Rate limit
  }

  writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
  console.log(`\nDone. Fixed ${fixed} playlists. Total: ${churches.length} churches.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
