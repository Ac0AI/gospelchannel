#!/usr/bin/env node

/**
 * Fill missing lat/lng on churches using OpenStreetMap Nominatim.
 *
 * Nominatim is free but has a strict 1-req/sec policy and requires a
 * contact in the User-Agent header. We stay well inside that — the
 * request rate is ~1/sec serial.
 *
 * Usage:
 *   node scripts/enrich-geocode-nominatim.mjs --dry-run --limit=10
 *   node scripts/enrich-geocode-nominatim.mjs --limit=500
 *   node scripts/enrich-geocode-nominatim.mjs             # all with address but no coords
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "GospelChannelBot/1.0 (https://gospelchannel.com; hello@gospelchannel.com)";
const DEFAULT_LIMIT = 0;
const THROTTLE_MS = 1100; // 1 req/sec + safety

function parseArgs(argv) {
  const o = { dryRun: false, limit: DEFAULT_LIMIT };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
  }
  return o;
}

async function loadTargets(sql, limit) {
  // Churches with an address but no coordinates
  if (limit > 0) {
    return sql`
      SELECT c.slug, c.name, c.country, c.location, e.street_address
      FROM churches c
      JOIN church_enrichments e ON e.church_slug = c.slug
      WHERE c.status = 'approved'
        AND (e.latitude IS NULL OR e.longitude IS NULL)
        AND e.street_address IS NOT NULL AND e.street_address != ''
      ORDER BY c.slug
      LIMIT ${limit}
    `;
  }
  return sql`
    SELECT c.slug, c.name, c.country, c.location, e.street_address
    FROM churches c
    JOIN church_enrichments e ON e.church_slug = c.slug
    WHERE c.status = 'approved'
      AND (e.latitude IS NULL OR e.longitude IS NULL)
      AND e.street_address IS NOT NULL AND e.street_address != ''
    ORDER BY c.slug
  `;
}

async function geocode(target) {
  const query = target.street_address.includes(target.country || "")
    ? target.street_address
    : `${target.street_address}, ${target.country || ""}`;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    const r = results[0];
    return { lat: Number(r.lat), lng: Number(r.lon) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  console.log("Loading targets with address but no coords...");
  const targets = await loadTargets(sql, options.limit);
  console.log(`Targets: ${targets.length}`);
  if (targets.length === 0) return;

  const eta = Math.round((targets.length * THROTTLE_MS) / 60000);
  console.log(`Serial fetch with ${THROTTLE_MS}ms throttle — ETA ~${eta} minutes`);

  const summary = { total: targets.length, geocoded: 0, noMatch: 0, errors: 0 };

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    try {
      const coords = await geocode(target);
      if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
        if (!options.dryRun) {
          await sql`
            UPDATE church_enrichments
            SET latitude = ${coords.lat}, longitude = ${coords.lng}, updated_at = NOW()
            WHERE church_slug = ${target.slug}
              AND (latitude IS NULL OR longitude IS NULL)
          `;
        }
        summary.geocoded += 1;
        if (summary.geocoded <= 5 || summary.geocoded % 100 === 0) {
          console.log(
            `  ${summary.geocoded}/${targets.length}: ${target.slug} → ${coords.lat}, ${coords.lng}`,
          );
        }
      } else {
        summary.noMatch += 1;
      }
    } catch (error) {
      summary.errors += 1;
      if (summary.errors < 5) console.log(`  error on ${target.slug}: ${error.message}`);
    }
    // Throttle — Nominatim policy is strict
    if (i + 1 < targets.length) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }
  }

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));
  if (options.dryRun) console.log("DRY RUN — no DB writes.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
