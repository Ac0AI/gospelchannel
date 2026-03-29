#!/usr/bin/env node

/**
 * LEGACY: approval now publishes through the unified `churches` table.
 * Use `npm run churches:reconcile` to sync the generated snapshot instead.
 *
 * Merge approved church candidates into churches.json
 *
 * - Reads all candidates with status "approved" from Supabase
 * - Converts them to ChurchConfig entries
 * - Merges into churches.json (skipping duplicates by slug)
 * - Updates candidate status to "merged" in Supabase
 *
 * Usage:
 *   source .env.local && node scripts/merge-approved-candidates.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

console.error("Legacy workflow disabled. Use `npm run churches:reconcile` instead.");
process.exit(1);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const supabase = createClient(url, key);

// Load existing churches
const churchesPath = new URL("../src/data/churches.json", import.meta.url);
const existingChurches = JSON.parse(readFileSync(churchesPath, "utf8"));
const existingSlugs = new Set(existingChurches.map((c) => c.slug));
const existingNames = new Set(existingChurches.map((c) => c.name.toLowerCase()));

console.log(`📚 ${existingChurches.length} existing churches in churches.json`);

// Fetch approved candidates
const { data: candidates, error } = await supabase
  .from("church_candidates")
  .select("*")
  .eq("status", "approved")
  .order("confidence", { ascending: false });

if (error) {
  console.error("Failed to fetch candidates:", error.message);
  process.exit(1);
}

console.log(`✅ ${candidates.length} approved candidates found\n`);

if (candidates.length === 0) {
  console.log("Nothing to merge.");
  process.exit(0);
}

// Slugify helper
function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/&[^;]+;/g, "") // remove HTML entities
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric to dash
    .replace(/^-+|-+$/g, "") // trim dashes
    .slice(0, 80);
}

// Clean up HTML entities in names
function cleanName(name) {
  return name
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&middot;/g, "\u00B7")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x[0-9a-fA-F]+;/g, (m) => String.fromCharCode(parseInt(m.slice(3, -1), 16)))
    .replace(/&raquo;/g, "\u00BB")
    .replace(/&laquo;/g, "\u00AB")
    .replace(/&eacute;/g, "\u00E9")
    .replace(/&[a-z]+;/gi, "") // remove remaining HTML entities
    .replace(/\s+/g, " ")
    .trim()
    // Clean up scraping artifacts in names
    .replace(/^[-–—·»«:|\s]+/, "") // leading punctuation
    .replace(/[-–—·»«:|\s]+$/, "") // trailing punctuation
    .replace(/\s*[·»«|]\s*/g, " – ") // mid-name separators
    .replace(/Home\s*[»›>]\s*/gi, "") // "Home »" breadcrumb prefix
    .replace(/\s*[【\[].*?[】\]]\s*/g, "") // bracketed junk like 【2022】
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Generate a simple description
function makeDescription(name, country) {
  const parts = [
    `Discover worship music and playlists from ${name}.`,
    country ? ` Based in ${country}.` : "",
    " Listen to their curated worship playlists on GospelChannel.",
  ];
  return parts.join("").trim();
}

// Convert candidates to ChurchConfig entries
const newChurches = [];
const mergedIds = [];
const skippedNames = [];
const usedSlugs = new Set(existingSlugs);

for (const c of candidates) {
  const name = cleanName(c.name);
  let slug = slugify(name);

  // Skip if name already exists
  if (existingNames.has(name.toLowerCase())) {
    skippedNames.push(name);
    mergedIds.push({ id: c.id, slug });
    continue;
  }

  // Ensure unique slug
  if (usedSlugs.has(slug)) {
    let i = 2;
    while (usedSlugs.has(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }
  usedSlugs.add(slug);

  const country = c.country || "";
  const playlistIds = c.spotify_playlist_ids || [];
  const spotifyUrl = playlistIds.length > 0
    ? `https://open.spotify.com/playlist/${playlistIds[0]}`
    : "";

  const church = {
    slug,
    name,
    description: makeDescription(name, country),
    spotifyPlaylistIds: playlistIds,
    logo: "/churches/_placeholder.svg",
    website: c.website || "",
    spotifyUrl,
    country,
    sourceKind: "discovered",
  };

  newChurches.push(church);
  mergedIds.push({ id: c.id, slug });
}

console.log(`🆕 ${newChurches.length} new churches to add`);
console.log(`⏭️  ${skippedNames.length} skipped (already exist)`);

if (newChurches.length === 0) {
  console.log("\nNo new churches to merge.");
  process.exit(0);
}

// Preview
console.log("\nSample new entries:");
for (const c of newChurches.slice(0, 10)) {
  console.log(`  ${c.slug} — ${c.name} (${c.country || "unknown country"})`);
}
if (newChurches.length > 10) {
  console.log(`  ... and ${newChurches.length - 10} more`);
}

if (dryRun) {
  console.log("\nDry run — no changes made.");
  process.exit(0);
}

// Merge into churches.json
const merged = [...existingChurches, ...newChurches];
writeFileSync(churchesPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
console.log(`\n💾 Wrote ${merged.length} churches to churches.json`);

// Update candidate status to "merged" in Supabase
console.log(`\n📊 Updating ${mergedIds.length} candidates to "merged" status...`);

const BATCH_SIZE = 50;
let updated = 0;

for (let i = 0; i < mergedIds.length; i += BATCH_SIZE) {
  const batch = mergedIds.slice(i, i + BATCH_SIZE);
  const ids = batch.map((b) => b.id);

  const { error: updateError } = await supabase
    .from("church_candidates")
    .update({ status: "merged" })
    .in("id", ids);

  if (updateError) {
    console.error(`  Batch ${i / BATCH_SIZE + 1} failed:`, updateError.message);
  } else {
    updated += batch.length;
  }
}

// Update merged_slug for each candidate
for (const { id, slug } of mergedIds) {
  await supabase
    .from("church_candidates")
    .update({ merged_slug: slug })
    .eq("id", id);
}

console.log(`✅ Updated ${updated} candidates to "merged"`);
console.log(`\n🎉 Done! ${merged.length} total churches in churches.json`);
