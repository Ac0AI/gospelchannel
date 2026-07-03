#!/usr/bin/env node

/**
 * Backfill structured church data from the Google Places raw archives that
 * fetch-church-photos.mjs already wrote (data/places-raw/*.jsonl). NO re-crawl —
 * we already paid Apify for this payload; the photo pipeline only kept the images.
 *
 * Per church (keyed by the archived `slug`):
 *   - phone         → church_enrichments.phone         (only if currently empty)
 *   - website       → church_enrichments.website_url   (only if currently empty)
 *   - totalScore    → church_enrichments.google_rating (always refreshed)
 *   - reviewsCount  → church_enrichments.google_reviews_count (always refreshed)
 *   - openingHours  → merged into raw_google_places.openingHours (nothing lost)
 *   - service_times → ONLY when the church has none yet AND Google shows Sunday
 *                     as the sole open day (high-confidence real service time —
 *                     the Sunday window start). Multi-day hours are office hours,
 *                     NOT services, so they are never written as service_times.
 *
 * Skips place_id mismatches (off-brand categories) — a restaurant's phone/rating
 * is not the church's. Idempotent: re-run any time (e.g. after more photo chunks
 * append to the archives) — it only fills empty contact fields and refreshes the
 * Google aggregates.
 *
 * Usage:
 *   node scripts/backfill-places-data.mjs --dry-run
 *   node scripts/backfill-places-data.mjs
 *   node scripts/backfill-places-data.mjs --limit=500
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { offBrandCategory } from "./lib/place-categories.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const ARCHIVE_DIR = join(ROOT_DIR, "data", "places-raw");

// "11 AM to 12:30 PM" | "9:30 AM" | "10 AM to 1 PM" → 24h "HH:MM" of the START.
function to24h(hoursStr) {
  const first = String(hoursStr).split(/\s+to\s+/i)[0].trim();
  const m = first.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] || "00";
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
}

// Derive a service time ONLY for the safe case: Sunday is the single open day.
function sundayOnlyService(openingHours) {
  const open = (openingHours || []).filter((h) => h.hours && !/closed/i.test(h.hours));
  if (open.length !== 1 || !/sunday/i.test(open[0].day)) return null;
  const t = to24h(open[0].hours);
  return t ? [{ day: "Sunday", time: t, label: "Sunday Service" }] : null;
}

function parseArgs(argv) {
  const o = { dryRun: false, limit: Infinity };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a.startsWith("--limit=")) o.limit = Math.max(1, Number(a.split("=")[1]) || Infinity);
  }
  return o;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const o = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL missing");
  const sql = neon(dbUrl);

  // Collect the most complete archived item per slug (later runs win).
  const bySlug = new Map();
  let offBrandSkipped = 0;
  for (const file of readdirSync(ARCHIVE_DIR).filter((f) => f.endsWith(".jsonl"))) {
    for (const line of readFileSync(join(ARCHIVE_DIR, file), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let item;
      try { item = JSON.parse(line); } catch { continue; }
      if (!item.slug) continue;
      if (offBrandCategory(item)) { offBrandSkipped++; continue; }
      bySlug.set(item.slug, item);
    }
  }
  console.log(`Archived churches: ${bySlug.size} unique slugs (${offBrandSkipped} off-brand lines skipped)`);

  const slugs = [...bySlug.keys()].slice(0, o.limit);
  let phoneFilled = 0, webFilled = 0, ratingSet = 0, svcDerived = 0, ohStored = 0, missing = 0;

  const POOL = 8;
  let cursor = 0;
  const worker = async () => {
    while (cursor < slugs.length) {
      const slug = slugs[cursor++];
      const item = bySlug.get(slug);
      const phone = item.phone || null;
      const website = item.website || null;
      const rating = item.totalScore ?? null;
      const reviews = item.reviewsCount ?? null;
      const openingHours = Array.isArray(item.openingHours) && item.openingHours.length ? item.openingHours : null;
      const svc = sundayOnlyService(item.openingHours);

      // Read current state first so the counters reflect ACTUAL changes.
      const cur = await sql.query(
        `SELECT phone, website_url, service_times FROM church_enrichments WHERE church_slug=$1`, [slug]);
      if (cur.length === 0) { missing++; continue; }
      const c = cur[0];
      const willFillPhone = phone && (!c.phone || c.phone === "");
      const willFillWeb = website && (!c.website_url || c.website_url === "");
      const emptySvc = c.service_times == null || JSON.stringify(c.service_times) === "[]";
      const willDeriveSvc = svc && emptySvc;

      if (willFillPhone) phoneFilled++;
      if (willFillWeb) webFilled++;
      if (rating != null) ratingSet++;
      if (openingHours) ohStored++;
      if (willDeriveSvc) svcDerived++;

      if (o.dryRun) continue;

      await sql.query(
        `UPDATE church_enrichments e SET
           phone = CASE WHEN (e.phone IS NULL OR e.phone='') THEN $2 ELSE e.phone END,
           website_url = CASE WHEN (e.website_url IS NULL OR e.website_url='') THEN $3 ELSE e.website_url END,
           google_rating = COALESCE($4, e.google_rating),
           google_reviews_count = COALESCE($5, e.google_reviews_count),
           raw_google_places = CASE WHEN $6::jsonb IS NOT NULL
             THEN COALESCE(e.raw_google_places,'{}'::jsonb) || jsonb_build_object('openingHours', $6::jsonb)
             ELSE e.raw_google_places END,
           service_times = CASE
             WHEN $7::jsonb IS NOT NULL
              AND (e.service_times IS NULL OR e.service_times='[]'::jsonb OR jsonb_typeof(e.service_times)='null')
             THEN $7::jsonb ELSE e.service_times END,
           updated_at = now()
         WHERE e.church_slug = $1`,
        [slug, phone, website, rating, reviews,
         openingHours ? JSON.stringify(openingHours) : null,
         svc ? JSON.stringify(svc) : null]);
    }
  };
  await Promise.all(Array.from({ length: POOL }, worker));

  const tag = o.dryRun ? "(dry-run) WOULD change" : "Updated";
  console.log(`\n${tag}:`);
  console.log(`  phone filled (was empty):    ${phoneFilled}`);
  console.log(`  website filled (was empty):  ${webFilled}`);
  console.log(`  rating/reviews refreshed:    ${ratingSet}`);
  console.log(`  raw openingHours stored:     ${ohStored}`);
  console.log(`  Sunday-only service derived: ${svcDerived}`);
  if (missing) console.log(`  slugs not in DB (skipped):   ${missing}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
