#!/usr/bin/env node

// Backfill church hero photos from Google — the Apify-equivalent, via Google's
// own APIs. For each church with coords and no hero: try Places (New) gallery
// photo first (real church-facing photo), else Street View Static (location
// photo). Mirror the chosen image to R2 (church-assets) and set header_image.
//
// Usage:
//   node scripts/backfill-photos-google.mjs --limit=50 --dry-run
//   node scripts/backfill-photos-google.mjs --country=Argentina
//   node scripts/backfill-photos-google.mjs --street-only   # skip Places, cheaper

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");
const BUCKET = process.env.R2_BUCKET_NAME || "church-assets";

const LATAM = ["Brazil", "Mexico", "Guatemala", "Colombia", "Argentina", "Peru", "Chile", "Venezuela", "Ecuador", "Honduras", "El Salvador", "Nicaragua", "Bolivia", "Paraguay", "Dominican Republic", "Costa Rica", "Panama", "Uruguay", "Puerto Rico", "Cuba"];

function parseArgs(argv) {
  const o = { limit: 0, country: "", latam: false, dryRun: false, streetOnly: false, concurrency: 4 };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--latam") o.latam = true;
    else if (a === "--street-only") o.streetOnly = true;
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
    else if (a.startsWith("--country=")) o.country = a.split("=")[1].trim();
    else if (a.startsWith("--concurrency=")) o.concurrency = Math.max(1, Math.min(8, Number(a.split("=")[1]) || 4));
  }
  return o;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

async function loadTargets(sql, { limit, country, latam }) {
  const params = [];
  let where =
    "c.status='approved' AND (c.header_image IS NULL OR c.header_image='') " +
    "AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL";
  if (country) { params.push(country); where += ` AND c.country = $${params.length}`; }
  else if (latam) { params.push(LATAM); where += ` AND c.country = ANY($${params.length})`; }
  let q =
    "SELECT c.slug, c.name, c.country, e.latitude AS lat, e.longitude AS lon " +
    "FROM churches c JOIN church_enrichments e ON e.church_slug = c.slug " +
    `WHERE ${where} ORDER BY random()`;
  if (limit > 0) { params.push(limit); q += ` LIMIT $${params.length}`; }
  return sql.query(q, params);
}

// --- Google Places (New): find the place and fetch a gallery photo ---
async function placesPhoto(name, lat, lon, key) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: 400.0 } },
      maxResultCount: 1,
      languageCode: "es",
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  const photo = j.places?.[0]?.photos?.[0];
  if (!photo?.name) return null;
  const media = await fetch(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1000&key=${key}`);
  if (!media.ok) return null;
  const buf = Buffer.from(await media.arrayBuffer());
  if (buf.length < 3000) return null;
  return { buffer: buf, source: "places" };
}

// --- Google Street View Static: metadata gate (free) then image ---
async function streetView(lat, lon, key) {
  const meta = await (await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lon}&key=${key}`)).json();
  if (meta.status !== "OK") return null;
  const img = await fetch(`https://maps.googleapis.com/maps/api/streetview?size=640x420&location=${lat},${lon}&fov=80&key=${key}`);
  if (!img.ok) return null;
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length < 3000) return null;
  return { buffer: buf, source: "streetview" };
}

async function uploadToR2(key, buffer) {
  const tmp = resolve(tmpdir(), `gospel-photo-${randomUUID()}.jpg`);
  await writeFile(tmp, buffer);
  try {
    await new Promise((res, rej) => {
      const child = spawn("npx", ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--remote", "--file", tmp, "--content-type", "image/jpeg"], { cwd: ROOT_DIR, stdio: ["ignore", "pipe", "pipe"], env: process.env });
      let err = "";
      child.stderr.on("data", (d) => { err += d; });
      child.on("close", (code) => (code === 0 ? res() : rej(new Error(err.slice(0, 200)))));
    });
  } finally { await unlink(tmp).catch(() => {}); }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const o = parseArgs(process.argv.slice(2));
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Missing GOOGLE_MAPS_API_KEY");
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) throw new Error("Missing DATABASE_URL");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const targets = await loadTargets(sql, o);
  console.log(`Targets (coords, no hero): ${targets.length}${o.streetOnly ? " [street-only]" : ""}`);
  if (!targets.length) return;

  const summary = { places: 0, streetview: 0, none: 0, errors: 0 };
  await pool(targets, o.concurrency, async (t) => {
    try {
      let pic = null;
      if (!o.streetOnly) pic = await placesPhoto(t.name, t.lat, t.lon, key);
      if (!pic) pic = await streetView(t.lat, t.lon, key);
      if (!pic) { summary.none += 1; return; }
      const objKey = `latam-photos/${t.slug}.jpg`;
      const mediaUrl = `${MEDIA_BASE}/${objKey}`;
      if (!o.dryRun) {
        await uploadToR2(objKey, pic.buffer);
        await sql`UPDATE churches SET header_image = ${mediaUrl}, header_image_attribution = 'Google', updated_at = NOW() WHERE slug = ${t.slug}`;
      }
      summary[pic.source] += 1;
      if (summary.places + summary.streetview <= 8 || (summary.places + summary.streetview) % 100 === 0) {
        console.log(`  [${pic.source}] ${t.slug} (${t.country}) → ${mediaUrl}`);
      }
    } catch (e) { summary.errors += 1; if (summary.errors < 6) console.log(`  err ${t.slug}: ${e.message}`); }
  });

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Hero set: ${summary.places + summary.streetview} (places ${summary.places} + streetview ${summary.streetview}), no imagery ${summary.none}`);
  if (o.dryRun) console.log("DRY RUN — no R2 uploads / DB writes.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
