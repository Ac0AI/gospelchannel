#!/usr/bin/env node

/**
 * Read-only health gate for the live church directory and offline fallback.
 *
 * Neon is the canonical source. src/data/churches.json is intentionally a
 * smaller offline/build fallback, so exact slug parity is no longer a valid
 * invariant after the global directory imports.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SNAPSHOT_PATH = join(ROOT_DIR, "src/data/churches.json");
const INDEXABLE_DISPLAY_SCORE_MIN = 45;
const fixFallback = process.argv.includes("--fix-fallback");

loadLocalEnv(ROOT_DIR);

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  process.exit(1);
}

const sql = neon(databaseUrl);

function percentage(part, total) {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "0.0%";
}

function printCoverage(label, value, total) {
  console.log(`  ${label.padEnd(24)} ${String(value).padStart(7)}  ${percentage(value, total)}`);
}

async function main() {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  if (!Array.isArray(snapshot)) {
    throw new Error("src/data/churches.json must contain an array");
  }

  const snapshotSlugs = snapshot.map((church) => String(church?.slug || "").trim());
  const duplicateSnapshotSlugs = snapshotSlugs.filter((slug, index) => slug && snapshotSlugs.indexOf(slug) !== index);
  const invalidSnapshotRows = snapshot.filter((church) => (
    !String(church?.slug || "").trim()
    || !String(church?.name || "").trim()
    || !String(church?.country || "").trim()
  ));

  const [summaryRows, approvedSlugRows] = await Promise.all([
    sql`
      SELECT
        count(*) FILTER (WHERE status = 'approved')::int AS approved,
        count(*) FILTER (WHERE status = 'archived')::int AS archived,
        count(*) FILTER (WHERE status NOT IN ('approved', 'archived') OR status IS NULL)::int AS invalid_status,
        count(*) FILTER (
          WHERE status = 'approved'
            AND (slug IS NULL OR btrim(slug) = '' OR name IS NULL OR btrim(name) = '' OR country IS NULL OR btrim(country) = '')
        )::int AS missing_required,
        count(*) FILTER (WHERE status = 'approved' AND directory_ready IS NULL)::int AS missing_directory_ready,
        count(*) FILTER (WHERE status = 'approved' AND directory_ready IS TRUE AND directory_rank IS NULL)::int AS ready_missing_rank,
        count(*) FILTER (WHERE status = 'approved' AND directory_ready IS TRUE AND directory_score IS NULL)::int AS ready_missing_score,
        count(*) FILTER (
          WHERE status = 'approved'
            AND (display_score IS NULL OR display_score >= ${INDEXABLE_DISPLAY_SCORE_MIN})
        )::int AS indexable,
        count(*) FILTER (
          WHERE status = 'approved'
            AND (display_score IS NULL OR display_score >= ${INDEXABLE_DISPLAY_SCORE_MIN})
            AND coalesce(cardinality(related_church_slugs), 0) = 0
        )::int AS indexable_missing_related,
        count(*) FILTER (
          WHERE status = 'approved'
            AND (
              (churches.service_times IS NOT NULL AND churches.service_times <> '[]'::jsonb AND churches.service_times <> '{}'::jsonb)
              OR EXISTS (
                SELECT 1
                FROM church_enrichments ce
                WHERE ce.church_slug = churches.slug
                  AND ce.service_times IS NOT NULL
                  AND ce.service_times <> '[]'::jsonb
                  AND ce.service_times <> '{}'::jsonb
              )
            )
        )::int AS with_service_times,
        count(*) FILTER (WHERE status = 'approved' AND coalesce(cardinality(music_style), 0) > 0)::int AS with_music_style,
        count(*) FILTER (
          WHERE status = 'approved'
            AND (coalesce(cardinality(spotify_playlist_ids), 0) > 0 OR coalesce(spotify_url, '') <> '')
        )::int AS with_spotify,
        count(*) FILTER (
          WHERE status = 'approved'
            AND (
              coalesce(header_image, '') <> ''
              OR EXISTS (
                SELECT 1
                FROM church_enrichments ce
                WHERE ce.church_slug = churches.slug
                  AND (
                    coalesce(ce.cover_image_url, '') <> ''
                    OR (ce.photo_urls IS NOT NULL AND ce.photo_urls <> '[]'::jsonb AND ce.photo_urls <> '{}'::jsonb)
                  )
              )
            )
        )::int AS with_header_image,
        count(*) FILTER (WHERE status = 'approved' AND verified_at IS NOT NULL)::int AS verified
      FROM churches
    `,
    sql`SELECT slug FROM churches WHERE status = 'approved'`,
  ]);

  const summary = summaryRows[0];
  const approvedSlugs = new Set(approvedSlugRows.map((row) => row.slug));
  const snapshotOnly = snapshotSlugs.filter((slug) => slug && !approvedSlugs.has(slug));
  let fallbackCount = snapshot.length;

  if (fixFallback && snapshotOnly.length > 0) {
    const staleSlugs = new Set(snapshotOnly);
    const prunedSnapshot = snapshot.filter((church) => !staleSlugs.has(String(church?.slug || "").trim()));
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(prunedSnapshot, null, 2)}\n`, "utf8");
    fallbackCount = prunedSnapshot.length;
    console.log(`Pruned ${snapshotOnly.length} non-approved rows from the offline fallback.`);
  }

  const failures = [];

  if (duplicateSnapshotSlugs.length > 0) failures.push(`${duplicateSnapshotSlugs.length} duplicate fallback slugs`);
  if (invalidSnapshotRows.length > 0) failures.push(`${invalidSnapshotRows.length} fallback rows missing slug, name, or country`);
  if (snapshotOnly.length > 0 && !fixFallback) failures.push(`${snapshotOnly.length} fallback slugs are not approved in Neon`);
  if (summary.invalid_status > 0) failures.push(`${summary.invalid_status} rows have an invalid status`);
  if (summary.missing_required > 0) failures.push(`${summary.missing_required} approved rows are missing slug, name, or country`);
  if (summary.missing_directory_ready > 0) failures.push(`${summary.missing_directory_ready} approved rows lack directory_ready`);
  if (summary.ready_missing_rank > 0) failures.push(`${summary.ready_missing_rank} directory-ready rows lack directory_rank`);
  if (summary.ready_missing_score > 0) failures.push(`${summary.ready_missing_score} directory-ready rows lack directory_score`);
  if (summary.indexable_missing_related > 0) failures.push(`${summary.indexable_missing_related} indexable rows have no related churches`);

  console.log("Church data health");
  console.log(`  Neon approved            ${summary.approved}`);
  console.log(`  Neon archived            ${summary.archived}`);
  console.log(`  Indexable                ${summary.indexable}`);
  console.log(`  Offline fallback         ${fallbackCount}`);
  console.log(`  Canonical-only slugs      ${Math.max(0, approvedSlugs.size - fallbackCount)}`);
  console.log("\nCoverage among approved churches");
  printCoverage("Service times", summary.with_service_times, summary.approved);
  printCoverage("Music style", summary.with_music_style, summary.approved);
  printCoverage("Spotify", summary.with_spotify, summary.approved);
  printCoverage("Header image", summary.with_header_image, summary.approved);
  printCoverage("Verified", summary.verified, summary.approved);

  if (failures.length > 0) {
    console.error("\nFAILED");
    for (const failure of failures) console.error(`  - ${failure}`);
    if (snapshotOnly.length > 0) console.error(`  - fallback-only sample: ${snapshotOnly.slice(0, 10).join(", ")}`);
    process.exit(1);
  }

  console.log("\nPASS: canonical directory invariants and fallback references are healthy.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
