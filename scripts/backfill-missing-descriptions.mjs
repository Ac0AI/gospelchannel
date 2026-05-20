#!/usr/bin/env node

/**
 * Backfill empty approved church descriptions without LLM calls.
 *
 * Priority:
 * 1. Existing church_enrichments.summary
 * 2. Existing church_enrichments.seo_description
 * 3. Conservative metadata fallback from name, denomination, location, and
 *    available public fields.
 *
 * Usage:
 *   node scripts/backfill-missing-descriptions.mjs --dry-run
 *   node scripts/backfill-missing-descriptions.mjs
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");

const sql = neon(DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 2000;

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function clipAtSentence(value, maxLength = 500) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;

  const clipped = normalized.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("!"),
    clipped.lastIndexOf("?"),
  );
  if (sentenceEnd >= 120) return clipped.slice(0, sentenceEnd + 1).trim();
  return `${normalized.slice(0, maxLength - 1).trimEnd()}.`;
}

function lowerFirst(value) {
  if (!value) return value;
  if (value === value.toUpperCase()) return value;
  return value[0].toLowerCase() + value.slice(1);
}

function withArticle(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "a church";
  return `${/^[aeiou]/i.test(normalized) ? "an" : "a"} ${normalized}`;
}

function buildChurchType(denomination) {
  const normalized = normalizeText(denomination);
  if (!normalized) return "church";

  const label = lowerFirst(normalized);
  if (/\b(church|cathedral|parish|congregation|fellowship|ministry|chapel|assembly|community)\b/i.test(label)) {
    return label;
  }
  return `${label} church`;
}

function compactLocation(location, country) {
  const normalizedLocation = normalizeText(location);
  const normalizedCountry = normalizeText(country);
  if (!normalizedLocation) return normalizedCountry;
  if (!normalizedCountry) return normalizedLocation;

  const parts = normalizedLocation
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);
  const alreadyHasCountry = parts.some((part) => part.toLowerCase() === normalizedCountry.toLowerCase());
  return alreadyHasCountry ? normalizedLocation : `${normalizedLocation}, ${normalizedCountry}`;
}

function describeAvailableDetails(row) {
  const details = [];
  if (normalizeText(row.website)) details.push("website");
  if (normalizeText(row.email)) details.push("contact");

  const playlistCount = new Set([
    ...(Array.isArray(row.spotify_playlist_ids) ? row.spotify_playlist_ids : []),
    ...(Array.isArray(row.additional_playlists) ? row.additional_playlists : []),
  ]).size;
  if (playlistCount > 0 || normalizeText(row.spotify_url) || normalizeText(row.youtube_channel_id)) {
    details.push("worship");
  }

  if (details.length === 0) return "basic directory";
  if (details.length === 1) return details[0];
  if (details.length === 2) return `${details[0]} and ${details[1]}`;
  return `${details.slice(0, -1).join(", ")}, and ${details[details.length - 1]}`;
}

function buildFallbackDescription(row) {
  const name = normalizeText(row.name);
  const location = compactLocation(row.location, row.country);
  const type = buildChurchType(row.denomination);
  const detailLabel = describeAvailableDetails(row);

  let first = `${name} is ${withArticle(type)}`;
  if (location) first += ` in ${location}`;
  first += ".";

  return `${first} GospelChannel lists this church with ${detailLabel} details for people comparing local congregations before a first visit.`;
}

function buildDescription(row) {
  const summary = normalizeText(row.summary);
  if (summary) return clipAtSentence(summary);

  const seo = normalizeText(row.seo_description);
  if (seo) return clipAtSentence(seo);

  return buildFallbackDescription(row);
}

async function main() {
  console.log(`backfill-missing-descriptions  ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);

  const rows = await sql`
    SELECT c.slug, c.name, c.country, c.location, c.denomination, c.website, c.email,
           c.spotify_url, c.spotify_playlist_ids, c.additional_playlists, c.youtube_channel_id,
           e.summary, e.seo_description
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug
    WHERE c.status = 'approved'
      AND nullif(btrim(c.description), '') IS NULL
    ORDER BY c.directory_rank NULLS LAST, c.slug
  `;

  const updates = rows
    .map((row) => ({
      slug: row.slug,
      description: buildDescription(row),
      source: normalizeText(row.summary)
        ? "summary"
        : normalizeText(row.seo_description)
          ? "seo_description"
          : "metadata",
    }))
    .filter((row) => row.description.length > 0);

  const counts = updates.reduce((acc, row) => {
    acc[row.source] = (acc[row.source] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`  targets=${rows.length}  updates=${updates.length}`);
  console.log(`  sources=${JSON.stringify(counts)}`);
  for (const row of updates.slice(0, 10)) {
    console.log(`  ${row.source.padEnd(15)} ${row.slug}: ${row.description}`);
  }

  if (DRY_RUN) {
    console.log("DRY-RUN: no rows written.");
    return;
  }

  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    await sql.query(
      `UPDATE churches AS c
          SET description = d.description,
              updated_at = NOW()
         FROM jsonb_to_recordset($1::jsonb) AS d(slug text, description text)
        WHERE c.slug = d.slug
          AND c.status = 'approved'
          AND nullif(btrim(c.description), '') IS NULL`,
      [JSON.stringify(slice.map(({ slug, description }) => ({ slug, description })))],
    );
    written += slice.length;
    process.stdout.write(`\r  written ${written}/${updates.length}`);
  }

  console.log(`\nDone. wrote=${written}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
