#!/usr/bin/env node

/**
 * Deduplicate churches in Supabase.
 *
 * 1. Fetches ALL approved churches (handles pagination >1000)
 * 2. Groups by normalized name
 * 3. Keeps the best entry per group, rejects the rest
 * 4. Rejects entries with bad/garbage names (HTML entities, nav prefixes)
 *
 * Usage:
 *   node scripts/dedup-churches.mjs [--dry-run]
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

loadLocalEnv(ROOT_DIR);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const dryRun = process.argv.includes("--dry-run");

/* ── Helpers ── */

/**
 * Normalize a name for dedup comparison:
 * lowercase, strip diacritics, strip all punctuation and spaces.
 */
function normalizeForDedup(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Patterns that indicate a bad/garbage name from web scraping.
 */
const BAD_NAME_PATTERNS = [
  /^home\s*[–\-\u2013\u2014|:>»›]/i,
  /^welcome\s+to\b/i,
  /&raquo;/i,
  /&ndash;/i,
  /&mdash;/i,
  /&middot;/i,
  /&laquo;/i,
  /&#0*39;/,
  /&#\d+;/,
  /&#x[0-9a-f]+;/i,
  /&[a-z]+;/i, // any remaining HTML entity
  /\u00BB/, // » character from bad scraping
];

function isBadName(name) {
  return BAD_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Score how "rich" a church entry is, for picking the best duplicate.
 * Higher = more data = better to keep.
 */
function richnessScore(row) {
  let score = 0;
  if (row.source_kind === "manual") score += 100; // original churches.json entries win
  if (row.website) score += 10;
  if (row.email) score += 5;
  if (row.location) score += 5;
  if (row.denomination) score += 3;
  if (row.description && row.description.length > 20) score += 5;
  if (row.logo) score += 3;
  if (row.header_image) score += 3;
  if (row.spotify_url) score += 5;
  if (row.spotify_playlist_ids?.length > 0) score += 5 + row.spotify_playlist_ids.length;
  if (row.youtube_channel_id) score += 5;
  if (row.language) score += 2;
  if (row.founded) score += 2;
  if (row.notable_artists?.length > 0) score += 3;
  if (row.spotify_artist_ids?.length > 0) score += 3;
  // Enrichment data is linked via candidate_id
  if (row.candidate_id) score += 2;
  return score;
}

/* ── Main ── */

async function main() {
  console.log(dryRun ? "DRY RUN - no changes will be made\n" : "");

  // 1. Fetch ALL churches (handle pagination >1000)
  let allChurches = [];
  let from = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch churches:", error.message);
      process.exit(1);
    }

    allChurches.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`Fetched ${allChurches.length} total churches\n`);

  // Only work with non-rejected churches for dedup
  const active = allChurches.filter((c) => c.status !== "rejected");
  const alreadyRejected = allChurches.length - active.length;
  console.log(`Active (non-rejected): ${active.length}, already rejected: ${alreadyRejected}\n`);

  const toReject = [];

  // 2. Find and flag entries with bad names
  console.log("--- Bad name check ---");
  for (const row of active) {
    if (isBadName(row.name)) {
      toReject.push({ slug: row.slug, reason: `Bad name: "${row.name}"` });
    }
  }
  console.log(`Found ${toReject.length} entries with bad names\n`);

  // 3. Group by normalized name for dedup
  console.log("--- Duplicate check ---");
  const groups = new Map();
  for (const row of active) {
    // Skip already-flagged bad names
    if (toReject.some((r) => r.slug === row.slug)) continue;

    const key = normalizeForDedup(row.name);
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  let dupGroups = 0;
  let dupEntries = 0;

  for (const [key, entries] of groups) {
    if (entries.length <= 1) continue;

    dupGroups++;

    // Sort by richness score descending - best entry first
    entries.sort((a, b) => richnessScore(b) - richnessScore(a));
    const keeper = entries[0];
    const rejects = entries.slice(1);

    console.log(`  KEEP: "${keeper.name}" (slug: ${keeper.slug}, score: ${richnessScore(keeper)})`);
    for (const rej of rejects) {
      console.log(`    REJECT: "${rej.name}" (slug: ${rej.slug}, score: ${richnessScore(rej)})`);
      toReject.push({ slug: rej.slug, reason: `Duplicate of "${keeper.name}" (${keeper.slug})` });
      dupEntries++;
    }
  }

  console.log(`\nFound ${dupGroups} duplicate groups, ${dupEntries} entries to reject`);
  console.log(`Total to reject: ${toReject.length}\n`);

  if (toReject.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  // Log all rejections
  console.log("--- Rejection summary ---");
  for (const { slug, reason } of toReject) {
    console.log(`  ${slug}: ${reason}`);
  }

  if (dryRun) {
    console.log("\nDRY RUN complete. No changes made.");
    return;
  }

  // 4. Apply rejections in batches
  console.log("\nApplying rejections...");
  let rejected = 0;
  let errors = 0;
  const BATCH_SIZE = 50;
  const slugsToReject = toReject.map((r) => r.slug);

  for (let i = 0; i < slugsToReject.length; i += BATCH_SIZE) {
    const batch = slugsToReject.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("churches")
      .update({ status: "rejected" })
      .in("slug", batch);

    if (error) {
      console.error(`Batch error:`, error.message);
      errors++;
    } else {
      rejected += batch.length;
    }
  }

  console.log(`\nDone! Rejected: ${rejected}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
