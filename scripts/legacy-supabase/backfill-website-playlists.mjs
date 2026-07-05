#!/usr/bin/env node

/**
 * Backfill explicit playlist fields from website-discovered Spotify playlist URLs.
 *
 * Source input:
 * - src/data/cache/church-candidate-screening.json
 *
 * Canonical write target:
 * - public.churches
 *
 * This only promotes playlist URLs that were already found on the church's
 * website/social links and can be mapped back to an approved church row.
 *
 * Usage:
 *   node scripts/backfill-website-playlists.mjs --preview
 *   node scripts/backfill-website-playlists.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SCREENING_PATH = join(ROOT_DIR, "src/data/cache/church-candidate-screening.json");
const preview = process.argv.includes("--preview");

loadLocalEnv(ROOT_DIR);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function normalizeHost(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function extractPlaylistIds(urls) {
  const ids = new Set();
  for (const url of Array.isArray(urls) ? urls : []) {
    const match = String(url || "").match(/playlist\/([A-Za-z0-9]+)/);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

function isSearchSpotifyUrl(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    return /(\.|^)spotify\.com$/i.test(parsed.hostname) && parsed.pathname.includes("/search");
  } catch {
    return false;
  }
}

async function fetchApprovedChurches() {
  const rows = [];
  const PAGE_SIZE = 1000;

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,name,website,spotify_url,spotify_playlist_ids,additional_playlists,status")
      .eq("status", "approved")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load churches: ${error.message}`);
    }

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

function resolveMatch(cacheRow, approvedBySlug, approvedByHost) {
  if (cacheRow.slug && approvedBySlug.has(cacheRow.slug)) {
    return approvedBySlug.get(cacheRow.slug);
  }

  const host = normalizeHost(cacheRow.website_final_url || cacheRow.website_input_url);
  if (host && approvedByHost.has(host)) {
    const matches = approvedByHost.get(host);
    if (matches.length === 1) {
      return matches[0];
    }
  }

  return null;
}

async function main() {
  const screeningRows = JSON.parse(readFileSync(SCREENING_PATH, "utf8"));
  const approvedChurches = await fetchApprovedChurches();

  const approvedBySlug = new Map(approvedChurches.map((church) => [church.slug, church]));
  const approvedByHost = new Map();
  for (const church of approvedChurches) {
    const host = normalizeHost(church.website);
    if (!host) continue;
    const matches = approvedByHost.get(host) || [];
    matches.push(church);
    approvedByHost.set(host, matches);
  }

  const updates = [];

  for (const row of screeningRows) {
    const playlistIds = extractPlaylistIds(row.social_spotify_urls);
    if (playlistIds.length === 0) continue;

    const church = resolveMatch(row, approvedBySlug, approvedByHost);
    if (!church) continue;
    if ((church.spotify_playlist_ids || []).length > 0 || (church.additional_playlists || []).length > 0) continue;

    const primaryPlaylistId = playlistIds[0];
    const additionalPlaylists = playlistIds.slice(1);
    const nextSpotifyUrl = church.spotify_url && !isSearchSpotifyUrl(church.spotify_url)
      ? church.spotify_url
      : `https://open.spotify.com/playlist/${primaryPlaylistId}`;

    updates.push({
      slug: church.slug,
      name: church.name,
      primaryPlaylistId,
      additionalPlaylists,
      spotifyUrl: nextSpotifyUrl,
      matchedCacheSlug: row.slug,
      matchedWebsite: row.website_final_url || row.website_input_url || "",
    });
  }

  console.log(`Website playlist backfill candidates: ${updates.length}`);
  if (updates.length > 0) {
    console.log(JSON.stringify(updates, null, 2));
  }

  if (preview || updates.length === 0) {
    return;
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("churches")
      .update({
        spotify_playlist_ids: [update.primaryPlaylistId],
        additional_playlists: update.additionalPlaylists,
        spotify_url: update.spotifyUrl,
      })
      .eq("slug", update.slug)
      .eq("status", "approved");

    if (error) {
      throw new Error(`Failed to update ${update.slug}: ${error.message}`);
    }
  }

  console.log(`Updated ${updates.length} approved churches.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
