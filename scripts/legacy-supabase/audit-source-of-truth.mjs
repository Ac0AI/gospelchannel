#!/usr/bin/env node

/**
 * Audit the catalog source of truth.
 *
 * Validates that:
 * - approved `churches` rows in Supabase match `src/data/churches.json`
 * - playlist fields in the snapshot mirror the database export
 * - campus playlist reach is measured separately, since campuses inherit from parent churches
 *
 * Usage:
 *   node scripts/audit-source-of-truth.mjs
 *   node scripts/audit-source-of-truth.mjs --json
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SNAPSHOT_PATH = join(ROOT_DIR, "src/data/churches.json");
const PAGE_SIZE = 1000;
const jsonMode = process.argv.includes("--json");

loadLocalEnv(ROOT_DIR);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function normalizeUrl(value) {
  return String(value || "").trim();
}

function normalizeIdList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((entry) => String(entry || "").trim()).filter(Boolean))].sort();
}

function normalizePlaylistMeta(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => ({
      id: String(entry?.id || "").trim(),
      title: String(entry?.title || "").trim(),
      subtitle: String(entry?.subtitle || "").trim(),
      description: String(entry?.description || "").trim(),
      primary: Boolean(entry?.primary),
    }))
    .filter((entry) => entry.id)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function fetchAllApprovedChurches() {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,spotify_url,spotify_playlist_ids,additional_playlists,spotify_playlists,status")
      .eq("status", "approved")
      .order("slug")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load approved churches: ${error.message}`);
    }

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllPublishedCampuses() {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("church_campuses")
      .select("slug,network_id,status")
      .eq("status", "published")
      .order("slug")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load campuses: ${error.message}`);
    }

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllNetworks() {
  const { data, error } = await supabase
    .from("church_networks")
    .select("id,parent_church_slug")
    .order("id");

  if (error) {
    throw new Error(`Failed to load networks: ${error.message}`);
  }

  return data || [];
}

function buildAuditResult(snapshotChurches, approvedChurches, campuses, networks) {
  const snapshotBySlug = new Map(snapshotChurches.map((church) => [church.slug, church]));
  const dbBySlug = new Map(approvedChurches.map((church) => [church.slug, church]));

  const snapshotSlugs = new Set(snapshotBySlug.keys());
  const dbSlugs = new Set(dbBySlug.keys());

  const snapshotOnly = [...snapshotSlugs].filter((slug) => !dbSlugs.has(slug)).sort();
  const dbOnly = [...dbSlugs].filter((slug) => !snapshotSlugs.has(slug)).sort();

  const playlistFieldMismatches = [];
  for (const slug of [...dbSlugs].sort()) {
    const dbRow = dbBySlug.get(slug);
    const snapshotRow = snapshotBySlug.get(slug);
    if (!dbRow || !snapshotRow) continue;

    const fields = [];
    if (!sameJson(normalizeIdList(dbRow.spotify_playlist_ids), normalizeIdList(snapshotRow.spotifyPlaylistIds))) {
      fields.push("spotify_playlist_ids");
    }
    if (!sameJson(normalizeIdList(dbRow.additional_playlists), normalizeIdList(snapshotRow.additionalPlaylists))) {
      fields.push("additional_playlists");
    }
    if (!sameJson(normalizePlaylistMeta(dbRow.spotify_playlists), normalizePlaylistMeta(snapshotRow.spotifyPlaylists))) {
      fields.push("spotify_playlists");
    }
    if (normalizeUrl(dbRow.spotify_url) !== normalizeUrl(snapshotRow.spotifyUrl)) {
      fields.push("spotify_url");
    }

    if (fields.length > 0) {
      playlistFieldMismatches.push({ slug, fields });
    }
  }

  const approvedWithExplicitPlaylists = approvedChurches.filter((church) =>
    normalizeIdList(church.spotify_playlist_ids).length > 0 || normalizeIdList(church.additional_playlists).length > 0
  );
  const approvedWithSpotifyPresence = approvedChurches.filter((church) =>
    normalizeIdList(church.spotify_playlist_ids).length > 0
    || normalizeIdList(church.additional_playlists).length > 0
    || normalizeUrl(church.spotify_url)
  );

  const distinctPlaylistIds = new Set();
  for (const church of approvedChurches) {
    for (const id of normalizeIdList(church.spotify_playlist_ids)) distinctPlaylistIds.add(id);
    for (const id of normalizeIdList(church.additional_playlists)) distinctPlaylistIds.add(id);
    for (const playlist of normalizePlaylistMeta(church.spotify_playlists)) distinctPlaylistIds.add(playlist.id);
  }

  const networkById = new Map(networks.map((network) => [network.id, network]));
  const campusesWithInheritedPlaylists = campuses.filter((campus) => {
    const network = networkById.get(campus.network_id);
    const parentChurch = network?.parent_church_slug ? dbBySlug.get(network.parent_church_slug) : null;
    if (!parentChurch) return false;

    return normalizeIdList(parentChurch.spotify_playlist_ids).length > 0
      || normalizeIdList(parentChurch.additional_playlists).length > 0;
  });

  return {
    snapshotChurches: snapshotChurches.length,
    approvedChurches: approvedChurches.length,
    publishedCampuses: campuses.length,
    snapshotOnlyCount: snapshotOnly.length,
    dbOnlyCount: dbOnly.length,
    playlistFieldMismatchCount: playlistFieldMismatches.length,
    approvedChurchesWithExplicitPlaylists: approvedWithExplicitPlaylists.length,
    approvedChurchesWithAnySpotifyPresence: approvedWithSpotifyPresence.length,
    campusesWithInheritedPlaylists: campusesWithInheritedPlaylists.length,
    publicChurchPagesWithPlaylists: approvedWithExplicitPlaylists.length + campusesWithInheritedPlaylists.length,
    distinctPlaylistIdsAcrossApprovedChurches: distinctPlaylistIds.size,
    examples: {
      snapshotOnly: snapshotOnly.slice(0, 10),
      dbOnly: dbOnly.slice(0, 10),
      playlistFieldMismatches: playlistFieldMismatches.slice(0, 10),
    },
  };
}

async function main() {
  const snapshotChurches = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  const [approvedChurches, campuses, networks] = await Promise.all([
    fetchAllApprovedChurches(),
    fetchAllPublishedCampuses(),
    fetchAllNetworks(),
  ]);

  const result = buildAuditResult(snapshotChurches, approvedChurches, campuses, networks);
  const ok = result.snapshotOnlyCount === 0 && result.dbOnlyCount === 0 && result.playlistFieldMismatchCount === 0;

  if (jsonMode) {
    console.log(JSON.stringify({ ok, ...result }, null, 2));
  } else {
    console.log("Catalog source of truth audit");
    console.log(`- approved churches: ${result.approvedChurches}`);
    console.log(`- snapshot churches: ${result.snapshotChurches}`);
    console.log(`- published campuses: ${result.publishedCampuses}`);
    console.log(`- approved churches with explicit playlists: ${result.approvedChurchesWithExplicitPlaylists}`);
    console.log(`- campuses inheriting playlists: ${result.campusesWithInheritedPlaylists}`);
    console.log(`- public church pages with playlists: ${result.publicChurchPagesWithPlaylists}`);
    console.log(`- approved churches with any Spotify presence: ${result.approvedChurchesWithAnySpotifyPresence}`);
    console.log(`- distinct playlist IDs across approved churches: ${result.distinctPlaylistIdsAcrossApprovedChurches}`);
    console.log(`- snapshot-only slugs: ${result.snapshotOnlyCount}`);
    console.log(`- db-only slugs: ${result.dbOnlyCount}`);
    console.log(`- playlist field mismatches: ${result.playlistFieldMismatchCount}`);

    if (result.examples.snapshotOnly.length > 0) {
      console.log(`- snapshot-only examples: ${result.examples.snapshotOnly.join(", ")}`);
    }
    if (result.examples.dbOnly.length > 0) {
      console.log(`- db-only examples: ${result.examples.dbOnly.join(", ")}`);
    }
    if (result.examples.playlistFieldMismatches.length > 0) {
      const formatted = result.examples.playlistFieldMismatches
        .map((entry) => `${entry.slug} [${entry.fields.join(", ")}]`)
        .join(", ");
      console.log(`- playlist mismatch examples: ${formatted}`);
    }
  }

  if (!ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
