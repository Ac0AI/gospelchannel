#!/usr/bin/env node

/**
 * Reconcile approved churches between Supabase and the generated JSON snapshot.
 *
 * Modes:
 *   node scripts/reconcile-church-source-of-truth.mjs
 *   node scripts/reconcile-church-source-of-truth.mjs --dry-run
 *   node scripts/reconcile-church-source-of-truth.mjs --check
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import supabaseCompat from "../src/lib/supabase.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const CHURCHES_PATH = join(ROOT_DIR, "src/data/churches.json");
const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 200;

const checkOnly = process.argv.includes("--check");
const dryRun = process.argv.includes("--dry-run");

loadLocalEnv(ROOT_DIR);

const { createAdminClient, hasSupabaseServiceConfig } = supabaseCompat;

if (!hasSupabaseServiceConfig()) {
  console.error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  process.exit(1);
}

const supabase = createAdminClient();

function readSnapshot() {
  return JSON.parse(readFileSync(CHURCHES_PATH, "utf8"));
}

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

async function fetchApprovedChurchRows() {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("*")
      .eq("status", "approved")
      .order("name")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch approved churches: ${error.message}`);
    }

    if (!data) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchEnrichmentMap(slugs) {
  const map = new Map();

  for (const batch of chunk(slugs, 200)) {
    const { data, error } = await supabase
      .from("church_enrichments")
      .select("church_slug,contact_email,instagram_url,facebook_url,youtube_url,cover_image_url")
      .in("church_slug", batch);

    if (error) {
      throw new Error(`Failed to fetch church enrichments: ${error.message}`);
    }

    for (const row of data || []) {
      map.set(row.church_slug, row);
    }
  }

  return map;
}

function toSupabaseChurchRow(church) {
  return {
    slug: church.slug,
    name: church.name,
    description: church.description || "",
    country: church.country || "",
    location: church.location || null,
    denomination: church.denomination || null,
    founded: church.founded || null,
    website: church.website || null,
    email: church.email || null,
    language: church.language || null,
    logo: church.logo || null,
    header_image: church.headerImage || null,
    header_image_attribution: church.headerImageAttribution || null,
    spotify_url: church.spotifyUrl || null,
    spotify_playlist_ids: church.spotifyPlaylistIds || [],
    additional_playlists: church.additionalPlaylists || [],
    spotify_playlists: church.spotifyPlaylists || null,
    music_style: church.musicStyle || null,
    notable_artists: church.notableArtists || null,
    youtube_channel_id: church.youtubeChannelId || null,
    spotify_artist_ids: church.spotifyArtistIds || null,
    youtube_videos: church.youtubeVideos || null,
    aliases: church.aliases || null,
    source_kind: church.sourceKind || "manual",
    status: "approved",
    last_researched: church.lastResearched || null,
    verified_at: church.verifiedAt || null,
  };
}

function toSnapshotChurch(row, legacySnapshotBySlug, enrichmentMap) {
  const legacy = legacySnapshotBySlug.get(row.slug);
  const enrichment = enrichmentMap.get(row.slug);
  return {
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    country: row.country || "",
    ...(row.location && { location: row.location }),
    ...(row.denomination && { denomination: row.denomination }),
    ...(row.founded && { founded: row.founded }),
    website: row.website || "",
    ...((row.email || enrichment?.contact_email) && { email: row.email || enrichment?.contact_email }),
    ...(row.language && { language: row.language }),
    logo: row.logo || "",
    ...((enrichment?.instagram_url || legacy?.instagramUrl) && { instagramUrl: enrichment?.instagram_url || legacy?.instagramUrl }),
    ...((enrichment?.facebook_url || legacy?.facebookUrl) && { facebookUrl: enrichment?.facebook_url || legacy?.facebookUrl }),
    ...((enrichment?.youtube_url || legacy?.youtubeUrl) && { youtubeUrl: enrichment?.youtube_url || legacy?.youtubeUrl }),
    ...((row.header_image || enrichment?.cover_image_url) && { headerImage: row.header_image || enrichment?.cover_image_url }),
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
  };
}

function diffSlugSets(snapshotChurches, dbRows) {
  const snapshotSlugs = new Set(snapshotChurches.map((church) => church.slug));
  const dbSlugs = new Set(dbRows.map((row) => row.slug));

  return {
    snapshotCount: snapshotSlugs.size,
    dbCount: dbSlugs.size,
    snapshotOnly: [...snapshotSlugs].filter((slug) => !dbSlugs.has(slug)).sort(),
    dbOnly: [...dbSlugs].filter((slug) => !snapshotSlugs.has(slug)).sort(),
  };
}

function logDiff(prefix, diff) {
  console.log(`${prefix}: snapshot=${diff.snapshotCount}, db=${diff.dbCount}, snapshotOnly=${diff.snapshotOnly.length}, dbOnly=${diff.dbOnly.length}`);
  if (diff.snapshotOnly.length > 0) {
    console.log(`  snapshotOnly sample: ${diff.snapshotOnly.slice(0, 10).join(", ")}`);
  }
  if (diff.dbOnly.length > 0) {
    console.log(`  dbOnly sample: ${diff.dbOnly.slice(0, 10).join(", ")}`);
  }
}

async function upsertApprovedSnapshotRows(rows) {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("churches")
      .upsert(batch, { onConflict: "slug" });

    if (error) {
      throw new Error(`Failed to upsert approved churches: ${error.message}`);
    }
  }
}

async function main() {
  const snapshotChurches = readSnapshot();
  let approvedRows = await fetchApprovedChurchRows();
  const beforeDiff = diffSlugSets(snapshotChurches, approvedRows);

  logDiff("Before reconcile", beforeDiff);

  if (checkOnly) {
    if (beforeDiff.snapshotOnly.length > 0 || beforeDiff.dbOnly.length > 0) {
      process.exit(1);
    }
    return;
  }

  const snapshotOnlyRows = snapshotChurches
    .filter((church) => beforeDiff.snapshotOnly.includes(church.slug))
    .map(toSupabaseChurchRow);

  if (snapshotOnlyRows.length > 0) {
    console.log(`Upserting ${snapshotOnlyRows.length} snapshot-only approved churches into Supabase...`);
    if (!dryRun) {
      await upsertApprovedSnapshotRows(snapshotOnlyRows);
    }
  }

  approvedRows = await fetchApprovedChurchRows();
  const latestSnapshot = readSnapshot();
  const legacySnapshotBySlug = new Map(latestSnapshot.map((church) => [church.slug, church]));
  const enrichmentMap = await fetchEnrichmentMap(approvedRows.map((row) => row.slug));
  const generatedSnapshot = approvedRows.map((row) => toSnapshotChurch(row, legacySnapshotBySlug, enrichmentMap));

  if (!dryRun) {
    writeFileSync(CHURCHES_PATH, `${JSON.stringify(generatedSnapshot, null, 2)}\n`, "utf8");
    console.log(`Wrote ${generatedSnapshot.length} approved churches to src/data/churches.json`);
  }

  const afterDiff = diffSlugSets(generatedSnapshot, approvedRows);
  logDiff("After reconcile", afterDiff);

  if (afterDiff.snapshotOnly.length > 0 || afterDiff.dbOnly.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
