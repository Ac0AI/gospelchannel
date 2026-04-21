#!/usr/bin/env node

// Phase-1 enrichment for psalmlog-imported churches.
// Fetches the psalmlog detail page for each row, parses its Place JSON-LD,
// and updates church_enrichments with website_url, lat/lng, and phone
// (overrides listing-phone with the cleaner one from Place schema when present).

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { isOfficialWebsiteUrl, toSiteRoot } from "./lib/church-intake-utils.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const BASE = "https://psalmlog.com";
const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";
// Lower default concurrency to avoid contending with prod DB reads. Can be
// raised via --concurrency=N when running at off-peak hours.
const DEFAULT_CONCURRENCY = 3;

// Psalmlog's JSON-LD falls back to the denomination's parent org site or a
// third-party directory when a specific congregation has no site of its own.
// These hosts are never a real per-congregation website for us; treat as null.
const GENERIC_HOST_BLOCKLIST = new Set([
  "umc.org",
  "ag.org",
  "adventist.org",
  "nazarene.org",
  "lds.org",
  "jw.org",
  "watchtower.org",
  "upci.org",
  "disciples.org",
  "abc-usa.org",
  "church-of-christ.org",
  "churches-of-christ.net",
  "inallthingspray.org",
  "manta.com",
  "yellowpages.com",
  "mapquest.com",
  "facebook.com",
  "yelp.com",
]);

function parseArgs(argv) {
  const options = { state: "texas", limit: 0, dryRun: false, onlyMissing: true, concurrency: DEFAULT_CONCURRENCY };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--all") options.onlyMissing = false;
    else if (arg.startsWith("--state=")) options.state = arg.split("=")[1];
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || DEFAULT_CONCURRENCY);
  }
  return options;
}

async function fetchText(url, timeoutMs = 15000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html" },
      });
      if (!res.ok) {
        if (res.status === 404) return "";
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  return "";
}

// Slugify a city name into psalmlog's URL form (e.g. "San Antonio" → "san-antonio").
function citySlug(city) {
  return String(city || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Pull all <script type="application/ld+json"> blocks, parse each, and return
// the first Place entry we find (the detail page has the church as a Place).
function extractPlaceFromJsonLd(html) {
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const candidates = Array.isArray(data) ? data : [data];
      for (const c of candidates) {
        if (!c || typeof c !== "object") continue;
        const type = c["@type"];
        if (type === "Place" || type === "Church" || type === "ReligiousOrganization") {
          return c;
        }
      }
    } catch {
      // Skip malformed blocks
    }
  }
  return null;
}

function cleanWebsite(raw) {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;
  let host = "";
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_")) u.searchParams.delete(key);
    }
    url = u.toString().replace(/\?$/, "");
    host = u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (GENERIC_HOST_BLOCKLIST.has(host)) return null;
  if (!isOfficialWebsiteUrl(url)) return null;
  return toSiteRoot(url);
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const stateSlug = options.state;
  const reasonPrefix = `directory-import: Psalmlog | ${options.state.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;

  console.log(`Loading psalmlog ${stateSlug} churches needing enrichment…`);
  // Join: church row (for location) + enrichment sources (for psalmlog slug)
  const rows = options.onlyMissing
    ? await sql`
        SELECT c.slug, c.location, ce.sources, ce.website_url, ce.latitude
        FROM churches c
        JOIN church_enrichments ce ON ce.church_slug = c.slug
        WHERE c.reason LIKE ${`${reasonPrefix}%`}
          AND ce.sources -> 'psalmlog' ->> 'slug' IS NOT NULL
          AND (ce.website_url IS NULL OR ce.latitude IS NULL)
      `
    : await sql`
        SELECT c.slug, c.location, ce.sources, ce.website_url, ce.latitude
        FROM churches c
        JOIN church_enrichments ce ON ce.church_slug = c.slug
        WHERE c.reason LIKE ${`${reasonPrefix}%`}
          AND ce.sources -> 'psalmlog' ->> 'slug' IS NOT NULL
      `;
  console.log(`Candidates: ${rows.length}${options.onlyMissing ? " (missing website or lat/lng)" : " (all)"}`);

  const targets = options.limit > 0 ? rows.slice(0, options.limit) : rows;
  console.log(`Processing ${targets.length} detail pages (concurrency ${options.concurrency}).`);

  let hitWebsite = 0;
  let hitCoords = 0;
  let fail = 0;
  const updates = [];

  await mapWithConcurrency(targets, options.concurrency, async (row) => {
    const psalmlogSlug = row.sources?.psalmlog?.slug;
    if (!psalmlogSlug) return;
    const city = citySlug(row.location);
    if (!city) return;
    const url = `${BASE}/churches/${stateSlug}/${city}/${psalmlogSlug}`;
    let html = "";
    try {
      html = await fetchText(url);
    } catch {
      fail += 1;
      return;
    }
    if (!html) {
      fail += 1;
      return;
    }
    const place = extractPlaceFromJsonLd(html);
    if (!place) return;

    const website = cleanWebsite(place.url);
    const lat = typeof place.geo?.latitude === "number" ? place.geo.latitude : null;
    const lng = typeof place.geo?.longitude === "number" ? place.geo.longitude : null;
    const phone = typeof place.telephone === "string" ? place.telephone.trim() : null;

    if (website) hitWebsite += 1;
    if (lat && lng) hitCoords += 1;

    const patch = {};
    if (website) patch.website_url = website;
    if (lat && Number.isFinite(lat)) patch.latitude = lat;
    if (lng && Number.isFinite(lng)) patch.longitude = lng;
    if (phone) patch.phone = phone;

    if (Object.keys(patch).length > 0) {
      updates.push({ slug: row.slug, patch });
    }
  });

  console.log(
    `Results: websites=${hitWebsite}, coords=${hitCoords}, fetchFails=${fail}, updatesQueued=${updates.length}`,
  );

  if (options.dryRun) {
    console.log("Dry run: sample of 5 updates:");
    console.log(JSON.stringify(updates.slice(0, 5), null, 2));
    return;
  }

  // Apply updates. Per-row UPDATE with retries.
  const CHURCH_BATCH = 50;
  let done = 0;
  for (let i = 0; i < updates.length; i += CHURCH_BATCH) {
    const batch = updates.slice(i, i + CHURCH_BATCH);
    await Promise.all(batch.map(async ({ slug, patch }) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const keys = Object.keys(patch);
          const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
          await sql.query(
            `UPDATE church_enrichments
               SET ${setClauses}, last_enriched_at = NOW(), updated_at = NOW()
             WHERE church_slug = $1`,
            [slug, ...keys.map((k) => patch[k])],
          );
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/fetch failed|ECONN|ETIMEDOUT|timeout|network|socket hang up/i.test(msg) || attempt === 3) {
            throw err;
          }
          await sleep(500 * (attempt + 1));
        }
      }
    }));
    done += batch.length;
    if (done % 500 === 0 || done === updates.length) {
      console.log(`  Updated ${done}/${updates.length}`);
    }
  }
  console.log(`Enriched ${updates.length} churches for ${stateSlug}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
