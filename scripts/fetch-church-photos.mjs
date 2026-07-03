#!/usr/bin/env node

/**
 * Fetch gallery photos for churches from Google Places and mirror them to R2.
 *
 * Uses compass/crawler-google-places with `placeIds` (exact targeting, no
 * name-matching) and `maxImages`. The lighter extractor actor used by
 * enrich-google-places-by-slug.mjs does NOT support image scraping — that's
 * why every stored raw imageUrls array is empty.
 *
 * Pipeline per church:
 *   place_id (column, or query_place_id extracted from google_maps_url)
 *   -> Apify crawler-google-places (maxImages)
 *   -> download each photo, sharp -> webp (max 1600px, q76, min 480x240)
 *   -> wrangler r2 object put church-assets/photos/<slug>/<n>.webp
 *   -> church_enrichments.photo_urls (R2 URLs) + merge raw imageUrls into
 *      raw_google_places + archive raw items to data/places-raw/ (gitignored)
 *
 * Usage:
 *   node scripts/fetch-church-photos.mjs --slugs=malaga-christian-church --dry-run
 *   node scripts/fetch-church-photos.mjs --limit=20
 *   node scripts/fetch-church-photos.mjs --limit=500 --max-images=8
 *
 * Flags:
 *   --slugs=a,b,c    Explicit slugs (must have a Google place identity)
 *   --limit=N        Max churches per run (default 20)
 *   --max-images=N   Photos per church (default 8)
 *   --dry-run        Select + Apify plan only, no downloads/uploads/DB writes
 *
 * Selection (without --slugs): approved, indexable-shaped (worship playlist OR
 * on-brand denomination with display_score >= 65), has a place identity, and
 * photo_urls not yet populated. Ordered by Google reviews count so the most
 * visited churches get galleries first.
 *
 * NOTE: the wrangler subprocess must NOT see CLOUDFLARE_API_TOKEN from
 * .env.local — that token is WAF-scoped (no R2). Wrangler's own OAuth login
 * (the same auth `pnpm run deploy` uses) handles R2 puts.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendFileSync, mkdirSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const APIFY_ACTOR = "compass~crawler-google-places";
const APIFY_MEMORY_MB = 4096;
const MEDIA_BASE_URL = "https://media.gospelchannel.com";
const R2_BUCKET = "church-assets";
const RAW_ARCHIVE_DIR = join(ROOT_DIR, "data", "places-raw");

const MIN_WIDTH = 480;
const MIN_HEIGHT = 240;
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 76;

// Keep in sync with OFF_BRAND_DENOMINATIONS + INDEXABLE_ONBRAND_SCORE_MIN in
// src/lib/content-quality.ts (script can't import TS).
const SCORE_MIN = 65;
const OFF_BRAND = [
  "Catholic", "Roman Catholic",
  "Methodist", "United Methodist", "Free Methodist",
  "AME", "CME", "African Methodist Episcopal", "Christian Methodist Episcopal",
  "Presbyterian", "Lutheran", "Episcopal", "Anglican",
  "Orthodox", "Greek Orthodox", "Russian Orthodox", "Eastern Orthodox",
  "Coptic Orthodox", "Antiochian Orthodox",
  "Seventh-day Adventist", "Seventh-Day Adventist", "Adventist", "Advent Christian",
  "Christian Science", "Jehovah's Witnesses",
  "Mormon", "Latter-Day Saints", "Latter-day Saints", "LDS",
  "Buddhist", "Muslim", "Jewish", "Hindu",
  "Unitarian", "Unitarian Universalist", "Quaker",
  "United Church of Christ", "Church of Christ", "Christadelphian",
];

function parseArgs(argv) {
  const o = { slugs: [], limit: 20, maxImages: 8, dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a.startsWith("--slugs=")) o.slugs = a.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--limit=")) o.limit = Math.max(1, Number(a.split("=")[1]) || 20);
    else if (a.startsWith("--max-images=")) o.maxImages = Math.max(1, Math.min(20, Number(a.split("=")[1]) || 8));
  }
  return o;
}

// wrangler must use its OAuth login; the .env.local Cloudflare token is
// WAF-scoped and would break `r2 object put` if it leaked into the subprocess.
function wranglerEnv() {
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  return env;
}

async function uploadToR2(key, buffer) {
  const tmp = join(tmpdir(), `photo-${randomUUID()}`);
  await writeFile(tmp, buffer);
  try {
    await new Promise((ok, fail) => {
      const child = spawn("npx", [
        "wrangler", "r2", "object", "put",
        `${R2_BUCKET}/${key}`, "--remote", "--file", tmp,
        "--content-type", "image/webp",
      ], { cwd: ROOT_DIR, stdio: ["ignore", "pipe", "pipe"], env: wranglerEnv() });
      let stderr = "";
      child.stderr.on("data", (c) => { stderr += c; });
      child.on("error", fail);
      child.on("close", (code) => (code === 0 ? ok() : fail(new Error(stderr.slice(0, 300) || `exit ${code}`))));
    });
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function downloadAndOptimize(sourceUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(sourceUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height || meta.width < MIN_WIDTH || meta.height < MIN_HEIGHT) {
      throw new Error(`too_small_${meta.width}x${meta.height}`);
    }
    return sharp(input)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } finally {
    clearTimeout(timer);
  }
}

async function startApifyRun(placeIds, maxImages, token) {
  const body = {
    placeIds,
    maxImages,
    maxReviews: 0,
    scrapeReviewsPersonalData: false,
    scrapeImageAuthors: false,
    language: "en",
  };
  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${token}&memory=${APIFY_MEMORY_MB}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`Apify start failed: ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  return { runId: data.id, datasetId: data.defaultDatasetId };
}

async function pollApifyRun(runId, token, maxWaitMs, expectedItems) {
  const STABLE_SECS = 90;
  const start = Date.now();
  let lastCount = 0;
  let lastChange = Date.now();
  let datasetId = null;
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 8000));
    const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    const { data } = await poll.json();
    datasetId = datasetId || data.defaultDatasetId;
    if (data.status === "SUCCEEDED") return;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) throw new Error(`Apify run ${runId} ${data.status}`);
    if (datasetId) {
      try {
        const head = await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}?token=${token}`)).json();
        const count = head?.data?.itemCount ?? 0;
        if (count !== lastCount) { lastCount = count; lastChange = Date.now(); }
        const stable = Date.now() - lastChange > STABLE_SECS * 1000;
        if ((expectedItems && count >= expectedItems) || (count > 0 && stable)) {
          await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`, { method: "POST" });
          return;
        }
      } catch { /* non-fatal */ }
    }
  }
  throw new Error(`Apify run ${runId} timed out client-side`);
}

async function fetchDataset(datasetId, token) {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?format=json&token=${token}&limit=10000`);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const o = parseArgs(process.argv.slice(2));
  const token = process.env.APIFY_TOKEN;
  const dbUrl = process.env.DATABASE_URL;
  if (!token) throw new Error("APIFY_TOKEN missing");
  if (!dbUrl) throw new Error("DATABASE_URL missing");
  const sql = neon(dbUrl);

  const placeIdExpr = `COALESCE(NULLIF(e.google_place_id, ''), substring(e.google_maps_url from 'query_place_id=([^&]+)'))`;
  const rows = o.slugs.length > 0
    ? await sql.query(`
        SELECT c.slug, ${placeIdExpr} AS place_id
        FROM churches c JOIN church_enrichments e ON e.church_slug = c.slug
        WHERE c.slug = ANY($1::text[])`, [o.slugs])
    : await sql.query(`
        SELECT c.slug, ${placeIdExpr} AS place_id
        FROM churches c JOIN church_enrichments e ON e.church_slug = c.slug
        WHERE c.status = 'approved'
          AND e.photo_urls IS NULL
          AND ${placeIdExpr} IS NOT NULL
          AND (
            array_length(c.spotify_playlist_ids, 1) > 0
            OR array_length(c.additional_playlists, 1) > 0
            OR (
              c.denomination IS NOT NULL AND length(c.denomination) > 0
              AND NOT (c.denomination = ANY($1::text[]))
              AND c.display_score IS NOT NULL AND c.display_score >= $2
            )
          )
        ORDER BY e.google_reviews_count DESC NULLS LAST, c.display_score DESC NULLS LAST
        LIMIT $3`, [OFF_BRAND, SCORE_MIN, o.limit]);

  const targets = rows.filter((r) => r.place_id);
  const skipped = rows.length - targets.length;
  console.log(`Targets: ${targets.length} churches${skipped ? ` (${skipped} skipped, no place id)` : ""}`);
  if (targets.length === 0) return;
  const estCost = targets.length * (0.004 + 0.002 + o.maxImages * 0.0005);
  console.log(`maxImages=${o.maxImages}, estimated Apify cost ~$${estCost.toFixed(2)}`);
  if (o.dryRun) {
    for (const t of targets.slice(0, 10)) console.log(`  ${t.slug} -> ${t.place_id}`);
    console.log("(dry-run, stopping before Apify)");
    return;
  }

  // Several slugs can share one place id (campus duplicates) — update them all.
  const slugsByPlaceId = new Map();
  for (const t of targets) {
    if (!slugsByPlaceId.has(t.place_id)) slugsByPlaceId.set(t.place_id, []);
    slugsByPlaceId.get(t.place_id).push(t.slug);
  }
  const uniquePlaceIds = [...slugsByPlaceId.keys()];
  console.log(`Starting Apify ${APIFY_ACTOR} for ${uniquePlaceIds.length} place ids...`);
  const { runId, datasetId } = await startApifyRun(uniquePlaceIds, o.maxImages, token);
  console.log(`Run ${runId}, dataset ${datasetId}`);
  await pollApifyRun(runId, token, 45 * 60 * 1000, uniquePlaceIds.length);
  const items = await fetchDataset(datasetId, token);
  console.log(`Dataset items: ${items.length}`);

  mkdirSync(RAW_ARCHIVE_DIR, { recursive: true });
  const archivePath = join(RAW_ARCHIVE_DIR, `photos-run-${new Date().toISOString().slice(0, 10)}.jsonl`);

  let updated = 0;
  let photosUploaded = 0;
  const failures = [];
  for (const item of items) {
    const slugs = slugsByPlaceId.get(item.placeId) ?? [];
    appendFileSync(archivePath, JSON.stringify({ slug: slugs[0] ?? null, ...item }) + "\n");
    if (slugs.length === 0) { failures.push(`unmatched placeId ${item.placeId}`); continue; }
    const sourceUrls = [...new Set((item.imageUrls || []).filter((u) => /^https:\/\//.test(u)))].slice(0, o.maxImages);
    if (sourceUrls.length === 0) { failures.push(`${slugs[0]}: no imageUrls`); continue; }

    // Mirror once under the first slug; duplicate slugs share the same R2 URLs.
    const primarySlug = slugs[0];
    const r2Urls = [];
    for (let i = 0; i < sourceUrls.length; i++) {
      try {
        const webp = await downloadAndOptimize(sourceUrls[i]);
        const key = `photos/${primarySlug}/${i}.webp`;
        await uploadToR2(key, webp);
        r2Urls.push(`${MEDIA_BASE_URL}/${key}`);
      } catch (err) {
        failures.push(`${primarySlug}[${i}]: ${err.message.slice(0, 80)}`);
      }
    }
    if (r2Urls.length === 0) continue;

    for (const slug of slugs) {
      await sql.query(`
        UPDATE church_enrichments
        SET photo_urls = $1::jsonb,
            raw_google_places = COALESCE(raw_google_places, '{}'::jsonb)
              || jsonb_build_object('imageUrls', $2::jsonb, 'imagesCount', COALESCE((raw_google_places->>'imagesCount')::int, $3::int)),
            updated_at = now()
        WHERE church_slug = $4`,
        [JSON.stringify(r2Urls), JSON.stringify(sourceUrls), item.imagesCount ?? sourceUrls.length, slug]);
      updated += 1;
    }
    photosUploaded += r2Urls.length;
    console.log(`  ${slugs.join(" + ")}: ${r2Urls.length} photos`);
  }

  console.log(`\nDone. ${updated} churches updated, ${photosUploaded} photos mirrored to R2.`);
  console.log(`Raw archive: ${archivePath}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    failures.slice(0, 15).forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
