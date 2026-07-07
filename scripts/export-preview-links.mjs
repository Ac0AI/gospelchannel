#!/usr/bin/env node
/**
 * Export preview-page links for approved churches with a contactable email.
 *
 * Every approved church has a token-gated personal preview page
 * (/preview/[slug]?token=...) showing "your page today vs. filled in" with a
 * completeness score. This script turns those URLs into lemlist merge fields
 * (previewUrl, profileUrl) for cold outreach CSVs.
 *
 * Usage:
 *   node scripts/export-preview-links.mjs [--dry-run] [--country "United States"] [--out tmp/preview-links.csv]
 *
 * Flags:
 *   --dry-run           Print row count + 3 sample rows, write nothing.
 *   --country <name>    Filter to churches.country exact match.
 *   --out <path>        Output CSV path (default: tmp/preview-links.csv).
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import { neon } from "@neondatabase/serverless";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const countryIdx = args.indexOf("--country");
const country = countryIdx !== -1 ? args[countryIdx + 1] : null;
const outIdx = args.indexOf("--out");
const outPath = outIdx !== -1 ? args[outIdx + 1] : "tmp/preview-links.csv";

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);

const BASE_URL = "https://gospelchannel.com";

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function cityFromLocation(location) {
  if (!location) return "";
  const idx = location.indexOf(",");
  return idx === -1 ? location.trim() : location.slice(0, idx).trim();
}

async function main() {
  const rows = country
    ? await sql`
        SELECT c.slug, c.name, c.location, c.country, c.email, c.claim_preview_token
        FROM churches c
        WHERE c.status = 'approved'
          AND c.claim_preview_token IS NOT NULL
          AND c.email IS NOT NULL AND c.email <> ''
          AND c.country = ${country}
        ORDER BY c.country, c.slug
      `
    : await sql`
        SELECT c.slug, c.name, c.location, c.country, c.email, c.claim_preview_token
        FROM churches c
        WHERE c.status = 'approved'
          AND c.claim_preview_token IS NOT NULL
          AND c.email IS NOT NULL AND c.email <> ''
        ORDER BY c.country, c.slug
      `;

  console.log(
    `Found ${rows.length} approved churches with email + preview token${country ? ` in ${country}` : ""}.`,
  );

  const records = rows.map((r) => ({
    email: r.email,
    churchName: r.name,
    city: cityFromLocation(r.location),
    country: r.country,
    slug: r.slug,
    previewUrl: `${BASE_URL}/preview/${r.slug}?token=${r.claim_preview_token}`,
    profileUrl: `${BASE_URL}/church/${r.slug}`,
  }));

  const columns = ["email", "churchName", "city", "country", "slug", "previewUrl", "profileUrl"];

  if (dryRun) {
    console.log("DRY RUN - sample rows (nothing written):");
    records.slice(0, 3).forEach((r) => {
      console.log(`  ${columns.map((c) => `${c}=${r[c]}`).join(" | ")}`);
    });
    return;
  }

  const header = columns.join(",");
  const body = records.map((r) => columns.map((c) => csvEscape(r[c])).join(",")).join("\n");
  const csv = `${header}\n${body}\n`;

  const resolvedOut = resolve(process.cwd(), outPath);
  mkdirSync(dirname(resolvedOut), { recursive: true });
  writeFileSync(resolvedOut, csv, "utf8");

  console.log(`Wrote ${records.length} rows to ${resolvedOut}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
