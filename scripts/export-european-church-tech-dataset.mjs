#!/usr/bin/env node
/**
 * Export the European Church Tech 2026 open dataset.
 *
 * Generates three CSV files + one JSON snapshot under data-release/data/.
 * Strict privacy filter: NO email addresses, NO pastor names, NO contact
 * details, NO claim tokens, NO raw_website_markdown. Only church-level
 * observable signals.
 *
 * Usage:
 *   node scripts/export-european-church-tech-dataset.mjs
 *
 * Required env: DATABASE_URL
 */
import { neon } from "@neondatabase/serverless";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadLocalEnv(ROOT);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
const sql = neon(DATABASE_URL);

const OUT_DIR = join(ROOT, "data-release", "data");
mkdirSync(OUT_DIR, { recursive: true });

const COUNTRIES = [
  "United Kingdom",
  "Germany",
  "France",
  "Spain",
  "Sweden",
  "Italy",
  "Switzerland",
  "Norway",
  "Netherlands",
  "Denmark",
  "Finland",
  "Belgium",
  "Austria",
  "Ireland",
  "Poland",
  "Czech Republic",
  "Hungary",
  "Greece",
  "Portugal",
];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const body = rows
    .map((row) => columns.map((c) => csvEscape(row[c])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

async function exportCountryAggregates() {
  console.log("→ Exporting country_aggregates.csv");

  const rows = await sql.query(
    `
    SELECT
      c.country AS country,
      COUNT(*)::int AS total_churches,
      COUNT(*) FILTER (WHERE c.website IS NOT NULL OR e.website_url IS NOT NULL)::int AS with_website,
      COUNT(t.primary_platform)::int AS with_cms_detected,
      COUNT(*) FILTER (WHERE c.facebook_url IS NOT NULL OR e.facebook_url IS NOT NULL)::int AS with_facebook,
      COUNT(*) FILTER (WHERE c.youtube_channel_id IS NOT NULL OR e.youtube_url IS NOT NULL)::int AS with_youtube,
      COUNT(*) FILTER (WHERE e.livestream_url IS NOT NULL)::int AS with_livestream
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug
    LEFT JOIN church_website_tech t ON t.church_slug = c.slug
    WHERE c.status = 'approved'
      AND c.country = ANY($1)
    GROUP BY c.country
    ORDER BY total_churches DESC
    `,
    [COUNTRIES],
  );

  const enriched = rows.map((r) => ({
    ...r,
    pct_website: r.total_churches > 0 ? Math.round((r.with_website / r.total_churches) * 1000) / 10 : 0,
    pct_cms_detected: r.total_churches > 0 ? Math.round((r.with_cms_detected / r.total_churches) * 1000) / 10 : 0,
    pct_facebook: r.total_churches > 0 ? Math.round((r.with_facebook / r.total_churches) * 1000) / 10 : 0,
    pct_youtube: r.total_churches > 0 ? Math.round((r.with_youtube / r.total_churches) * 1000) / 10 : 0,
    pct_livestream: r.total_churches > 0 ? Math.round((r.with_livestream / r.total_churches) * 1000) / 10 : 0,
  }));

  const csv = toCsv(enriched, [
    "country",
    "total_churches",
    "with_website",
    "pct_website",
    "with_cms_detected",
    "pct_cms_detected",
    "with_facebook",
    "pct_facebook",
    "with_youtube",
    "pct_youtube",
    "with_livestream",
    "pct_livestream",
  ]);
  writeFileSync(join(OUT_DIR, "country_aggregates.csv"), csv);
  console.log(`  wrote ${rows.length} rows`);
  return enriched;
}

async function exportPlatforms() {
  console.log("→ Exporting platforms.csv");

  const rows = await sql.query(
    `
    SELECT
      c.country AS country,
      t.primary_platform AS platform,
      COUNT(*)::int AS count
    FROM churches c
    JOIN church_website_tech t ON t.church_slug = c.slug
    WHERE c.status = 'approved'
      AND c.country = ANY($1)
      AND t.primary_platform IS NOT NULL
      AND t.primary_platform <> ''
    GROUP BY c.country, t.primary_platform
    ORDER BY c.country, count DESC
    `,
    [COUNTRIES],
  );

  const csv = toCsv(rows, ["country", "platform", "count"]);
  writeFileSync(join(OUT_DIR, "platforms.csv"), csv);
  console.log(`  wrote ${rows.length} rows`);
  return rows;
}

// Note: we deliberately do NOT export a per-church table.
// Per-church platform detection is the operational asset built by the
// enrichment pipeline — releasing it openly would let third parties
// reverse-engineer or replace the underlying work without doing the
// pipeline. The dataset stops at country and platform-by-country
// aggregates.

async function exportSnapshot(countryAggregates, platforms) {
  console.log("→ Exporting snapshot.json");

  const snapshot = {
    generatedAt: new Date().toISOString(),
    version: "2026-04-29",
    methodology:
      "Observed signals from public church URLs and pages. No surveys. " +
      "Coverage = number of churches with detected signal / total mapped churches.",
    license: "CC-BY-4.0",
    source: "https://gospelchannel.com/european-church-tech-2026",
    repository: "https://github.com/gospelchannel/european-church-tech-2026",
    countries: countryAggregates,
    platformsByCountry: platforms,
  };

  writeFileSync(
    join(OUT_DIR, "snapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );
  console.log("  wrote snapshot.json");
}

async function main() {
  const startTime = Date.now();
  const countryAggregates = await exportCountryAggregates();
  const platforms = await exportPlatforms();
  await exportSnapshot(countryAggregates, platforms);
  console.log(`\n✓ Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`  Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
