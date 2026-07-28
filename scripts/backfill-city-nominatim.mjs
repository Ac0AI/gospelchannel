#!/usr/bin/env node

// Backfill the city (churches.location) for churches that have coordinates but
// no city — mostly OSM imports lacking addr:city. Reverse-geocodes each via
// Nominatim (coords -> city). Respects the 1 req/sec policy. Idempotent.
//
// Usage:
//   node scripts/backfill-city-nominatim.mjs --dry-run --limit=10
//   node scripts/backfill-city-nominatim.mjs --country=Mexico
//   node scripts/backfill-city-nominatim.mjs            # all LATAM+ missing-city w/ coords

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const REVERSE = "https://nominatim.openstreetmap.org/reverse";
const UA = "GospelChannelBot/1.0 (https://gospelchannel.com; hello@gospelchannel.com)";
const THROTTLE_MS = 1100;

function parseArgs(argv) {
  const o = { dryRun: false, limit: 0, country: "" };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
    else if (a.startsWith("--country=")) o.country = a.split("=")[1].trim();
  }
  return o;
}

async function loadTargets(sql, { limit, country }) {
  const params = [];
  let where =
    "c.status='approved' AND (c.location IS NULL OR c.location='') " +
    "AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL";
  if (country) { params.push(country); where += ` AND c.country = $${params.length}`; }
  let q =
    "SELECT c.slug, e.latitude AS lat, e.longitude AS lon " +
    "FROM churches c JOIN church_enrichments e ON e.church_slug = c.slug " +
    `WHERE ${where} ORDER BY c.slug`;
  if (limit > 0) { params.push(limit); q += ` LIMIT $${params.length}`; }
  return sql.query(q, params);
}

async function reverseCity(lat, lon) {
  const url = new URL(REVERSE);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 15000);
  try {
    const res = await fetch(url, { signal: c.signal, headers: { "User-Agent": UA, "Accept-Language": "es,pt,en" } });
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.city_district || a.county || "";
    return city ? String(city).trim() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const o = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) throw new Error("Missing DATABASE_URL");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const targets = await loadTargets(sql, o);
  console.log(`Targets (coords, no city): ${targets.length}`);
  if (!targets.length) return;
  console.log(`Serial reverse-geocode @ ${THROTTLE_MS}ms — ETA ~${Math.round((targets.length * THROTTLE_MS) / 60000)} min`);

  const summary = { total: targets.length, filled: 0, noMatch: 0, errors: 0 };
  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i];
    try {
      const city = await reverseCity(t.lat, t.lon);
      if (city) {
        if (!o.dryRun) {
          await sql`UPDATE churches SET location = ${city}, updated_at = NOW()
                    WHERE slug = ${t.slug} AND (location IS NULL OR location = '')`;
        }
        summary.filled += 1;
        if (summary.filled <= 5 || summary.filled % 200 === 0) console.log(`  ${summary.filled}/${targets.length}: ${t.slug} → ${city}`);
      } else summary.noMatch += 1;
    } catch (e) { summary.errors += 1; if (summary.errors < 5) console.log(`  err ${t.slug}: ${e.message}`); }
    if (i + 1 < targets.length) await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }
  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));
  if (o.dryRun) console.log("DRY RUN — no writes.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
