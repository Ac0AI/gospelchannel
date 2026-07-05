#!/usr/bin/env node

/**
 * Find Spotify playlists for churches that currently have none.
 * Uses Google Search (via Apify) to find Spotify links + Claude Haiku to validate.
 * Batches Google searches for efficiency, saves progress regularly.
 *
 * Usage: source .env.local && node scripts/find-missing-playlists.mjs [--limit 200] [--batch 10]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = join(__dirname, "..", "src", "data", "churches.json");

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!APIFY_TOKEN) { console.error("Missing APIFY_TOKEN"); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }

const sb = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getArg(name, defaultVal) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : defaultVal;
}

const LIMIT = getArg("--limit", 200);
const BATCH_SIZE = getArg("--batch", 10);

/**
 * Batch Google search via Apify. Sends multiple queries in one call.
 * Returns map of query → Spotify URLs found.
 */
async function googleSearchBatch(queries) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: queries.join("\n"),
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
        mobileResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
        maxConcurrency: 5,
      }),
    }
  );

  if (!res.ok) {
    console.error(`  Apify error: ${res.status}`);
    return new Map();
  }

  const data = await res.json();
  const resultMap = new Map();

  for (const item of data) {
    const query = item.searchQuery?.term || "";
    const spotifyLinks = [];

    for (const r of item.organicResults || []) {
      const url = r.url || "";
      if (!url.includes("open.spotify.com/")) continue;
      // Skip episodes and podcasts
      if (url.includes("/episode/") || url.includes("/show/")) continue;
      const type = url.includes("/playlist/") ? "playlist"
        : url.includes("/artist/") ? "artist"
        : url.includes("/album/") ? "album"
        : url.includes("/user/") ? "user"
        : "other";
      spotifyLinks.push({ url, title: r.title || "", description: r.description || "", type });
    }

    resultMap.set(query, spotifyLinks);
  }

  return resultMap;
}

/**
 * Extract Spotify playlist ID from URL.
 */
function extractPlaylistId(url) {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Use Claude Haiku to pick the best Spotify link for a church.
 */
async function validateWithHaiku(churchName, churchCountry, spotifyLinks) {
  if (spotifyLinks.length === 0) return null;

  const list = spotifyLinks
    .slice(0, 8)
    .map((s, i) => `${i + 1}. [${s.type}] "${s.title}" — ${s.url}`)
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
      system: `You match Spotify search results to churches. Given a church name, pick the result most likely to belong to that specific church. Prefer: 1) the church's own artist profile, 2) a playlist owned by the church, 3) a worship playlist clearly named after the church. Reject generic compilations or results about other churches. Only pick if confident. Respond JSON only: {"pick": 1} or {"pick": null}.`,
      messages: [
        {
          role: "user",
          content: `Church: "${churchName}" (${churchCountry})\n\nSpotify results:\n${list}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try {
    // Extract first JSON object from response (Haiku may add explanation after)
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) return null;
    const result = JSON.parse(jsonMatch[0]);
    if (result.pick >= 1 && result.pick <= spotifyLinks.length) {
      return spotifyLinks[result.pick - 1];
    }
  } catch { /* ignore */ }
  return null;
}

function saveProgress(churches) {
  writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
}

async function main() {
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));
  const churchByName = new Map();
  const missing = [];

  for (const c of churches) {
    if (!c.spotifyPlaylistIds || c.spotifyPlaylistIds.length === 0) {
      missing.push(c);
      churchByName.set(`${c.name} spotify playlist`, c);
    }
  }

  const toProcess = missing.slice(0, LIMIT);
  console.log(`${missing.length} churches without playlists. Processing ${toProcess.length} in batches of ${BATCH_SIZE}...\n`);

  let found = 0;
  let notFound = 0;
  const supabaseUpdates = [];

  for (let b = 0; b < toProcess.length; b += BATCH_SIZE) {
    const batch = toProcess.slice(b, b + BATCH_SIZE);
    const queries = batch.map((c) => `${c.name} spotify playlist`);

    console.log(`Batch ${Math.floor(b / BATCH_SIZE) + 1}: searching ${batch.length} churches...`);

    const resultMap = await googleSearchBatch(queries);

    for (const church of batch) {
      const query = `${church.name} spotify playlist`;
      const links = resultMap.get(query) || [];
      const progress = `[${b + batch.indexOf(church) + 1}/${toProcess.length}]`;

      if (links.length === 0) {
        notFound++;
        console.log(`${progress} - ${church.name}: no Spotify results`);
        continue;
      }

      const best = await validateWithHaiku(church.name, church.country || "", links);
      await sleep(50);

      if (best) {
        const playlistId = extractPlaylistId(best.url);
        if (playlistId) {
          // It's a playlist
          church.spotifyPlaylistIds = [playlistId];
          church.spotifyUrl = `https://open.spotify.com/playlist/${playlistId}`;
        } else {
          // Artist, user, or album link
          church.spotifyUrl = best.url;
        }
        found++;
        console.log(`${progress} ✓ ${church.name}: [${best.type}] "${best.title}"`);
        supabaseUpdates.push({
          slug: church.slug,
          spotify_playlist_ids: church.spotifyPlaylistIds || [],
          spotify_url: church.spotifyUrl,
        });
        continue;
      }

      notFound++;
      console.log(`${progress} - ${church.name}: Haiku rejected (${links.length} candidates)`);
    }

    // Save after each batch
    saveProgress(churches);
    console.log(`  — saved (${found} found, ${notFound} not found)\n`);
  }

  console.log(`\nTotal: ${found} found, ${notFound} not found`);

  // Sync to Supabase
  if (sb && supabaseUpdates.length > 0) {
    console.log(`Syncing ${supabaseUpdates.length} to Supabase...`);
    let synced = 0;
    for (const u of supabaseUpdates) {
      const { error } = await sb
        .from("churches")
        .update({ spotify_playlist_ids: u.spotify_playlist_ids, spotify_url: u.spotify_url })
        .eq("slug", u.slug);
      if (!error) synced++;
    }
    console.log(`Synced ${synced}/${supabaseUpdates.length}.`);
  }

  console.log("Done!");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
