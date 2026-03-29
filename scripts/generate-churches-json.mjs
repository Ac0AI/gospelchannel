#!/usr/bin/env node

/**
 * Generate churches.json from Supabase churches table.
 * Only includes approved churches.
 *
 * Usage:
 *   node scripts/generate-churches-json.mjs
 */

import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

loadLocalEnv(ROOT_DIR);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fetchEnrichmentMap(slugs) {
  const map = new Map();

  for (let index = 0; index < slugs.length; index += 200) {
    const batch = slugs.slice(index, index + 200);
    const { data, error } = await sb
      .from("church_enrichments")
      .select("church_slug,contact_email,instagram_url,facebook_url,youtube_url,cover_image_url")
      .in("church_slug", batch);

    if (error) {
      console.error("Failed to fetch church enrichments:", error.message);
      process.exit(1);
    }

    for (const row of data || []) {
      map.set(row.church_slug, row);
    }
  }

  return map;
}

// Fetch all approved churches (handle pagination for >1000)
let allData = [];
let from = 0;
const PAGE_SIZE = 1000;

while (true) {
  const { data, error } = await sb
    .from("churches")
    .select("*")
    .eq("status", "approved")
    .order("name")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error("Failed to fetch churches:", error.message);
    process.exit(1);
  }

  allData.push(...data);
  if (data.length < PAGE_SIZE) break;
  from += PAGE_SIZE;
}

// Map to ChurchConfig shape (camelCase)
const existingSnapshot = JSON.parse(readFileSync(join(ROOT_DIR, "src/data/churches.json"), "utf8"));
const legacySnapshotBySlug = new Map(existingSnapshot.map((church) => [church.slug, church]));
const enrichmentMap = await fetchEnrichmentMap(allData.map((row) => row.slug));
const churches = allData.map((row) => ({
  ...(enrichmentMap.get(row.slug)?.instagram_url || legacySnapshotBySlug.get(row.slug)?.instagramUrl
    ? { instagramUrl: enrichmentMap.get(row.slug)?.instagram_url || legacySnapshotBySlug.get(row.slug)?.instagramUrl }
    : {}),
  ...(enrichmentMap.get(row.slug)?.facebook_url || legacySnapshotBySlug.get(row.slug)?.facebookUrl
    ? { facebookUrl: enrichmentMap.get(row.slug)?.facebook_url || legacySnapshotBySlug.get(row.slug)?.facebookUrl }
    : {}),
  ...(enrichmentMap.get(row.slug)?.youtube_url || legacySnapshotBySlug.get(row.slug)?.youtubeUrl
    ? { youtubeUrl: enrichmentMap.get(row.slug)?.youtube_url || legacySnapshotBySlug.get(row.slug)?.youtubeUrl }
    : {}),
  slug: row.slug,
  name: row.name,
  description: row.description || "",
  country: row.country || "",
  ...(row.location && { location: row.location }),
  ...(row.denomination && { denomination: row.denomination }),
  ...(row.founded && { founded: row.founded }),
  website: row.website || "",
  ...((row.email || enrichmentMap.get(row.slug)?.contact_email) && { email: row.email || enrichmentMap.get(row.slug)?.contact_email }),
  ...(row.language && { language: row.language }),
  logo: row.logo || "",
  ...((row.header_image || enrichmentMap.get(row.slug)?.cover_image_url) && { headerImage: row.header_image || enrichmentMap.get(row.slug)?.cover_image_url }),
  ...(row.header_image_attribution && { headerImageAttribution: row.header_image_attribution }),
  spotifyUrl: row.spotify_url || "",
  spotifyPlaylistIds: row.spotify_playlist_ids || [],
  ...(row.additional_playlists?.length && { additionalPlaylists: row.additional_playlists }),
  ...(row.spotify_playlists && { spotifyPlaylists: row.spotify_playlists }),
  ...(row.music_style?.length && { musicStyle: row.music_style }),
  ...(row.notable_artists?.length && { notableArtists: row.notable_artists }),
  ...(row.youtube_channel_id && { youtubeChannelId: row.youtube_channel_id }),
  ...(row.spotify_artist_ids?.length && { spotifyArtistIds: row.spotify_artist_ids }),
  ...(row.youtube_videos && { youtubeVideos: row.youtube_videos }),
  ...(row.aliases?.length && { aliases: row.aliases }),
  ...(row.last_researched && { lastResearched: row.last_researched }),
  ...(row.verified_at && { verifiedAt: row.verified_at }),
  sourceKind: row.source_kind || "manual",
}));

const outPath = join(ROOT_DIR, "src/data/churches.json");
await writeFile(outPath, JSON.stringify(churches, null, 2));
console.log(`Generated churches.json with ${churches.length} approved churches`);
