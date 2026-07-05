#!/usr/bin/env node

/**
 * Import all churches into unified Supabase `churches` table.
 * Bootstrap/backfill only.
 * Sources: generated churches.json snapshot + all candidates (approved/merged/pending/rejected).
 * The public source of truth remains the Supabase `churches` table.
 *
 * Usage:
 *   node scripts/import-churches-to-supabase.mjs [--dry-run]
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

/**
 * Decode HTML entities and clean up raw names before slugifying.
 */
function cleanName(name) {
  let clean = name;
  // Decode numeric HTML entities
  clean = clean.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  clean = clean.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
  // Decode named HTML entities
  clean = clean
    .replace(/&amp;/gi, "&")
    .replace(/&ndash;/gi, "\u2013")
    .replace(/&mdash;/gi, "\u2014")
    .replace(/&middot;/gi, "\u00B7")
    .replace(/&raquo;/gi, "\u00BB")
    .replace(/&laquo;/gi, "\u00AB")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&eacute;/gi, "\u00E9")
    .replace(/&aacute;/gi, "\u00E1")
    .replace(/&iacute;/gi, "\u00ED")
    .replace(/&oacute;/gi, "\u00F3")
    .replace(/&uacute;/gi, "\u00FA")
    .replace(/&ntilde;/gi, "\u00F1")
    .replace(/&auml;/gi, "\u00E4")
    .replace(/&ouml;/gi, "\u00F6")
    .replace(/&uuml;/gi, "\u00FC")
    .replace(/&aring;/gi, "\u00E5")
    .replace(/&egrave;/gi, "\u00E8")
    .replace(/&agrave;/gi, "\u00E0")
    .replace(/&[a-z]+;/gi, " "); // strip any remaining unknown entities
  // Normalize curly/smart quotes and apostrophes
  clean = clean.replace(/[\u2018\u2019\u02BC\u0027\u2032]/g, "'");
  return clean.trim();
}

function slugify(name, country) {
  let slug = cleanName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // strip ALL Unicode diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // If slug is too short or generic, append country
  if (slug.length < 3 && country) {
    slug += "-" + country.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  return slug;
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  const dryRun = process.argv.includes("--dry-run");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Import the generated snapshot
  const churchesPath = join(ROOT_DIR, "src/data/churches.json");
  const churches = JSON.parse(readFileSync(churchesPath, "utf8"));

  console.log(`Importing ${churches.length} churches from the generated snapshot...`);

  const slugSet = new Set();
  const rows = [];

  for (const c of churches) {
    slugSet.add(c.slug);
    rows.push({
      slug: c.slug,
      name: c.name,
      description: c.description || "",
      country: c.country || "",
      location: c.location || null,
      denomination: c.denomination || null,
      founded: c.founded || null,
      website: c.website || null,
      email: c.email || null,
      language: c.language || null,
      logo: c.logo || null,
      header_image: c.headerImage || null,
      header_image_attribution: c.headerImageAttribution || null,
      spotify_url: c.spotifyUrl || null,
      spotify_playlist_ids: c.spotifyPlaylistIds || [],
      additional_playlists: c.additionalPlaylists || [],
      spotify_playlists: c.spotifyPlaylists || null,
      music_style: c.musicStyle || null,
      notable_artists: c.notableArtists || null,
      youtube_channel_id: c.youtubeChannelId || null,
      spotify_artist_ids: c.spotifyArtistIds || null,
      youtube_videos: c.youtubeVideos || null,
      aliases: c.aliases || null,
      source_kind: c.sourceKind || "manual",
      status: "approved",
      last_researched: c.lastResearched || null,
      verified_at: c.verifiedAt || null,
    });
  }

  // 2. Import all candidates (approved/merged → approved, pending → pending, rejected → rejected)
  console.log("Loading all candidates...");
  const { data: candidates } = await supabase
    .from("church_candidates")
    .select("id, name, country, website, location, confidence, reason, source, discovered_at, spotify_owner_id, contact_email, spotify_playlist_ids, status");

  // Load enrichment data for candidates
  const candidateIds = (candidates || []).map((c) => c.id);

  // Fetch enrichments in batches (Supabase IN filter has limits)
  let allEnrichments = [];
  for (let i = 0; i < candidateIds.length; i += 200) {
    const batch = candidateIds.slice(i, i + 200);
    const { data: enrichments } = await supabase
      .from("church_enrichments")
      .select(
        "candidate_id, official_church_name, seo_description, summary, denomination_network, website_url, contact_email, cover_image_url, logo_image_url, languages"
      )
      .in("candidate_id", batch);
    if (enrichments) allEnrichments.push(...enrichments);
  }

  const enrichMap = new Map(
    allEnrichments.map((e) => [e.candidate_id, e])
  );

  let candidateCount = 0;
  let skipped = 0;
  const slugCounts = new Map(); // for collision handling

  for (const c of candidates || []) {
    const enrichment = enrichMap.get(c.id);
    const name = enrichment?.official_church_name || c.name;
    let slug = slugify(name, c.country);

    // Skip if slug matches a snapshot entry (already imported)
    if (slugSet.has(slug)) {
      skipped++;
      // Still link candidate_id for enrichment backfill
      const existingRow = rows.find((row) => row.slug === slug && !row.candidate_id);
      if (existingRow) {
        existingRow.candidate_id = c.id;
      }
      continue;
    }

    // Handle slug collisions between candidates
    const count = slugCounts.get(slug) || 0;
    if (count > 0 || slugSet.has(slug)) {
      const suffix = c.country
        ? c.country.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : String(count + 1);
      slug = `${slug}-${suffix}`;
    }
    slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);

    if (slugSet.has(slug)) {
      slug = `${slug}-${c.id.slice(0, 8)}`;
    }

    slugSet.add(slug);

    // Map candidate status: merged → approved
    const churchStatus = (c.status === "merged" || c.status === "approved") ? "approved" : c.status;

    const lang = enrichment?.languages;
    rows.push({
      slug,
      name,
      description: enrichment?.summary || enrichment?.seo_description || "",
      country: c.country || "",
      location: c.location || null,
      denomination: enrichment?.denomination_network || null,
      founded: null,
      website: enrichment?.website_url || c.website || null,
      email: enrichment?.contact_email || c.contact_email || null,
      language: Array.isArray(lang) ? lang[0] : lang || null,
      logo: enrichment?.logo_image_url || null,
      header_image: enrichment?.cover_image_url || null,
      header_image_attribution: null,
      spotify_url: null,
      spotify_playlist_ids: c.spotify_playlist_ids || [],
      additional_playlists: [],
      spotify_playlists: null,
      music_style: null,
      notable_artists: null,
      youtube_channel_id: null,
      spotify_artist_ids: null,
      youtube_videos: null,
      aliases: null,
      source_kind: "discovered",
      status: churchStatus,
      candidate_id: c.id,
      confidence: c.confidence || 0,
      reason: c.reason || null,
      discovery_source: c.source || null,
      discovered_at: c.discovered_at || null,
      spotify_owner_id: c.spotify_owner_id || null,
      last_researched: null,
      verified_at: null,
    });
    candidateCount++;
  }

  console.log(
    `Total: ${rows.length} (${churches.length} snapshot + ${candidateCount} candidates, ${skipped} skipped as duplicates)`
  );

  if (dryRun) {
    console.log("\n--- DRY RUN ---");
    console.log("Sample candidate slugs:");
    rows
      .filter((r) => r.source_kind === "discovered")
      .slice(0, 10)
      .forEach((r) => console.log(`  ${r.slug} | ${r.name} | ${r.country}`));
    return;
  }

  // Upsert in batches of 50
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("churches")
      .upsert(batch, { onConflict: "slug" });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Errors: ${errors}`);

  // Also update church_enrichments to link via slug for candidates
  console.log("\nUpdating enrichment slug links...");
  let enrichLinked = 0;
  for (const row of rows) {
    if (!row.candidate_id) continue;
    const { error } = await supabase
      .from("church_enrichments")
      .update({ church_slug: row.slug })
      .eq("candidate_id", row.candidate_id);
    if (!error) enrichLinked++;
  }
  console.log(`Linked ${enrichLinked} enrichment rows to new slugs.`);

  // 4. Migrate playlist reviews from church_candidate_playlist_reviews to church_playlist_reviews
  console.log("\nMigrating playlist reviews...");
  const { data: oldReviews } = await supabase
    .from("church_candidate_playlist_reviews")
    .select("candidate_id, playlist_id, status");

  // Build candidate_id → slug mapping from what we just imported
  const candidateToSlug = new Map();
  for (const row of rows) {
    if (row.candidate_id) candidateToSlug.set(row.candidate_id, row.slug);
  }

  let reviewsMigrated = 0;
  const reviewRows = [];
  for (const review of oldReviews || []) {
    const slug = candidateToSlug.get(review.candidate_id);
    if (!slug) continue;
    reviewRows.push({
      church_slug: slug,
      playlist_id: review.playlist_id,
      status: review.status,
    });
  }

  if (reviewRows.length > 0) {
    for (let i = 0; i < reviewRows.length; i += BATCH_SIZE) {
      const batch = reviewRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("church_playlist_reviews")
        .upsert(batch, { onConflict: "church_slug,playlist_id" });
      if (error) console.error("Playlist review batch error:", error.message);
      else reviewsMigrated += batch.length;
    }
  }
  console.log(`Migrated ${reviewsMigrated} playlist reviews.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
