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
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

loadLocalEnv(ROOT_DIR);

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
}

const sql = neon(DATABASE_URL);

async function fetchEnrichmentMap() {
  const map = new Map();
  const rows = await sql`
    select
      e.church_slug,
      e.contact_email,
      e.instagram_url,
      e.facebook_url,
      e.youtube_url,
      e.cover_image_url,
      e.logo_image_url
    from church_enrichments e
    join churches c on c.slug = e.church_slug
    where c.status = 'approved'
  `;

  for (const row of rows) {
    map.set(row.church_slug, row);
  }

  return map;
}

const allData = await sql`
  select *
  from churches
  where status = 'approved'
  order by name
`;

// Map to ChurchConfig shape (camelCase)
const existingSnapshot = JSON.parse(readFileSync(join(ROOT_DIR, "src/data/churches.json"), "utf8"));
const legacySnapshotBySlug = new Map(existingSnapshot.map((church) => [church.slug, church]));
const enrichmentMap = await fetchEnrichmentMap();
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
  logo: row.logo || enrichmentMap.get(row.slug)?.logo_image_url || "",
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
await writeFile(outPath, `${JSON.stringify(churches, null, 2)}\n`);
console.log(`Generated churches.json with ${churches.length} approved churches`);
