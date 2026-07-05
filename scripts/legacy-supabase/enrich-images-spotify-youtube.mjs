#!/usr/bin/env node

/**
 * Fetch cover images from Spotify playlist covers and YouTube search thumbnails.
 *
 * For churches that still lack a cover_image_url after website/Facebook extraction:
 * 1. If the church has Spotify playlists → fetch playlist cover art via Spotify API
 * 2. Otherwise → search YouTube for "{church name} worship" and use the top result thumbnail
 *
 * Usage:
 *   node scripts/enrich-images-spotify-youtube.mjs [options]
 *
 * Options:
 *   --dry-run     Show what would be updated
 *   --limit=<n>   Max churches to process
 *   --force       Overwrite existing images
 *   --spotify     Only run Spotify cover fetching
 *   --youtube     Only run YouTube thumbnail fetching
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) {
        args[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        args[arg.slice(2)] = true;
      }
    }
  }
  return args;
}

// ── Spotify API ──

let spotifyToken = null;

async function getSpotifyToken() {
  if (spotifyToken) return spotifyToken;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    console.error("Spotify auth failed:", res.status);
    return null;
  }

  const data = await res.json();
  spotifyToken = data.access_token;
  return spotifyToken;
}

async function getPlaylistCover(playlistId) {
  const token = await getSpotifyToken();
  if (!token) return null;

  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/images`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const images = await res.json();
  // Return the largest image
  return images?.[0]?.url ?? null;
}

// ── YouTube Data API ──

async function searchYouTubeThumbnail(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey) {
    // Use official API if key available
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "1",
      key: apiKey,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (res.ok) {
      const data = await res.json();
      const item = data.items?.[0];
      if (item) {
        const videoId = item.id?.videoId;
        // Use high-quality thumbnail
        return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
      }
    }
  }

  // Fallback: scrape YouTube search (no API key needed)
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannel/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Extract first video ID from search results
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match) {
      return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
    }
  } catch {
    // Silently fail
  }

  return null;
}

// ── Main ──

async function main() {
  loadLocalEnv(ROOT_DIR);

  const args = parseArgs();
  const limit = args.limit ? parseInt(args.limit, 10) : Infinity;
  const dryRun = !!args["dry-run"];
  const force = !!args.force;
  const onlySpotify = !!args.spotify;
  const onlyYoutube = !!args.youtube;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Load churches.json for playlist IDs and names
  const churchesJson = JSON.parse(
    readFileSync(join(ROOT_DIR, "src/data/churches.json"), "utf8")
  );
  const churchBySlug = new Map(churchesJson.map((c) => [c.slug, c]));

  // Load enrichments missing cover images
  let query = supabase
    .from("church_enrichments")
    .select("id, church_slug, cover_image_url")
    .eq("enrichment_status", "complete");

  if (!force) {
    query = query.is("cover_image_url", null);
  }

  const { data: enrichments, error } = await query;
  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  // Also find churches in JSON that have no enrichment at all
  const enrichedSlugs = new Set((enrichments ?? []).map((e) => e.church_slug));
  const unenrichedChurches = churchesJson.filter((c) => {
    if (enrichedSlugs.has(c.slug)) return false;
    const hasThumb = c.headerImage || (c.youtubeVideos?.[0]?.thumbnailUrl);
    return !hasThumb || force;
  });

  console.log(`Enrichments without cover: ${enrichments?.length ?? 0}`);
  console.log(`Unenriched churches without thumbnail: ${unenrichedChurches.length}`);

  // Build work list
  const work = [];

  // Churches with enrichments but no cover
  for (const e of enrichments ?? []) {
    const church = churchBySlug.get(e.church_slug);
    if (!church) continue;
    work.push({
      slug: e.church_slug,
      name: church.name,
      enrichmentId: e.id,
      playlists: [...(church.spotifyPlaylistIds ?? []), ...(church.additionalPlaylists ?? [])],
    });
  }

  // Unenriched churches — we'll update churches.json directly for these
  for (const c of unenrichedChurches) {
    if (enrichedSlugs.has(c.slug)) continue;
    work.push({
      slug: c.slug,
      name: c.name,
      enrichmentId: null,
      playlists: [...(c.spotifyPlaylistIds ?? []), ...(c.additionalPlaylists ?? [])],
    });
  }

  const toProcess = work.slice(0, limit);
  console.log(`\nProcessing ${toProcess.length} churches...\n`);

  let spotifyCovers = 0;
  let youtubeThumbs = 0;
  let updated = 0;
  let jsonUpdates = 0;

  for (const item of toProcess) {
    let coverUrl = null;

    // 1. Try Spotify playlist cover
    if (!onlyYoutube && item.playlists.length > 0) {
      for (const pid of item.playlists) {
        coverUrl = await getPlaylistCover(pid);
        if (coverUrl) {
          spotifyCovers++;
          break;
        }
      }
    }

    // 2. Fallback to YouTube search
    if (!coverUrl && !onlySpotify) {
      coverUrl = await searchYouTubeThumbnail(`${item.name} worship`);
      if (coverUrl) youtubeThumbs++;
    }

    if (!coverUrl) {
      console.log(`  [skip] ${item.slug}: no image found`);
      continue;
    }

    if (dryRun) {
      const src = spotifyCovers > updated + jsonUpdates ? "spotify" : "youtube";
      console.log(`  [dry] ${item.slug}: ${src} → ${coverUrl.slice(0, 80)}`);
      continue;
    }

    // Update Supabase if enrichment exists
    if (item.enrichmentId) {
      const { error: updateError } = await supabase
        .from("church_enrichments")
        .update({
          cover_image_url: coverUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.enrichmentId);

      if (updateError) {
        console.error(`  [error] ${item.slug}: ${updateError.message}`);
        continue;
      }
      updated++;
    } else {
      // Update churches.json headerImage for unenriched churches
      const church = churchBySlug.get(item.slug);
      if (church) {
        church.headerImage = coverUrl;
        jsonUpdates++;
      }
    }

    const src = coverUrl.includes("spotify") || coverUrl.includes("scdn") ? "spotify" : "youtube";
    console.log(`  [ok] ${item.slug}: ${src}`);

    // Rate limit: small delay between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  // Write updated churches.json if there were JSON updates
  if (jsonUpdates > 0 && !dryRun) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      join(ROOT_DIR, "src/data/churches.json"),
      JSON.stringify(churchesJson, null, 2) + "\n"
    );
    console.log(`\nUpdated churches.json with ${jsonUpdates} new headerImage entries`);
  }

  console.log("\n=== IMAGE ENRICHMENT COMPLETE ===");
  console.log(`  Processed:      ${toProcess.length}`);
  console.log(`  Spotify covers: ${spotifyCovers}`);
  console.log(`  YouTube thumbs: ${youtubeThumbs}`);
  console.log(`  Supabase:       ${updated}`);
  console.log(`  churches.json:  ${jsonUpdates}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
