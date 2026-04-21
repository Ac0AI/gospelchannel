#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  addChurchToIndex,
  createChurchIndex,
  findChurchDuplicate,
  slugifyName,
} from "./lib/church-intake-utils.mjs";
import {
  addHostLocationEntry,
  buildHostLocationIndex,
  findHostLocationDuplicate,
} from "./lib/directory-dedupe.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const BASE = "https://psalmlog.com";
const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";
const DIRECTORY_REASON_BASE = "directory-import: Psalmlog";
const CITY_PAGE_CONCURRENCY = 6;
const UPSERT_BATCH_SIZE = 100;

// Psalmlog's upstream (churchesusa.com) mis-lists residential/auxiliary buildings
// as independent church entries. These are always a separate row next to the real
// church with a nearby address — they inflate the catalog without adding value.
const NON_CHURCH_NAME_PATTERNS = [
  /\bparsonage\b/i,
  /\brectory\b/i,
  /\bmanse\b/i,
  /\bannex\b/i,
  /\bcemetery\b/i,
  /\bgraveyard\b/i,
  /\bthrift\b/i, // thrift shops tied to churches
  /\bbookstore\b/i,
  /\bdaycare\b/i,
  /\bday care\b/i,
  /\bpreschool\b/i,
  /\bkindergarten\b/i,
  /\bchristian school\b/i,
  /\bchristian academy\b/i,
  /\bconference (center|centre)\b/i,
  /\bretreat center\b/i,
];

function isLikelyNotAChurch(name) {
  if (!name) return true;
  return NON_CHURCH_NAME_PATTERNS.some((re) => re.test(name));
}

function parseArgs(argv) {
  const options = {
    state: "texas",
    preview: false,
    approve: false,
    cities: 0, // 0 = all
    limitPerCity: 0, // 0 = all pages
    skipCities: 0,
  };
  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg === "--approve") options.approve = true;
    else if (arg.startsWith("--state=")) options.state = arg.split("=")[1];
    else if (arg.startsWith("--cities=")) options.cities = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--skip-cities=")) options.skipCities = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--limit-per-city=")) options.limitPerCity = Math.max(0, Number(arg.split("=")[1]) || 0);
  }
  return options;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchText(url, timeoutMs = 20000, retries = 2) {
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

// Extract React-flight-embedded church objects from a listing page.
// Pattern: \"church\":{ ... }  (escaped JSON inside a JS string literal)
// Each listing page carries ~20 churches.
function extractChurchesFromListing(html) {
  const out = [];
  const needle = '\\"church\\":{';
  let searchFrom = 0;
  while (true) {
    const idx = html.indexOf(needle, searchFrom);
    if (idx < 0) break;
    const braceStart = idx + needle.length - 1;
    // Brace-match over escaped JSON; treat \" as a single literal and skip
    let depth = 0;
    let i = braceStart;
    let inString = false;
    while (i < html.length) {
      const ch = html[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') {
        // Unescaped quote - unlikely in flight data, but toggle to be safe
        inString = !inString;
        i += 1;
        continue;
      }
      if (!inString) {
        if (ch === "{") depth += 1;
        else if (ch === "}") {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      }
      i += 1;
    }
    const rawEscaped = html.slice(braceStart, i);
    searchFrom = i;
    try {
      // The blob is a JSON-string-escaped object. Wrap in quotes and JSON.parse
      // to unescape, then parse again to get the object.
      const unescaped = JSON.parse(`"${rawEscaped}"`);
      const obj = JSON.parse(unescaped);
      if (obj && typeof obj === "object" && obj.slug && obj.name) out.push(obj);
    } catch {
      // Skip malformed blocks silently
    }
  }
  return out;
}

async function collectCitySlugs(stateSlug) {
  const seen = new Set();
  const cityRe = new RegExp(`/churches/${stateSlug}/([a-z0-9-]+)(?=["'?/\\s])`, "g");
  for (let page = 1; page <= 60; page++) {
    const url = page === 1
      ? `${BASE}/churches/${stateSlug}`
      : `${BASE}/churches/${stateSlug}?page=${page}`;
    const html = await fetchText(url);
    if (!html) break;
    const before = seen.size;
    let m;
    while ((m = cityRe.exec(html)) !== null) {
      const slug = m[1];
      // Skip non-city slugs (state-level nav)
      if (slug === "denominations" || slug === "worship" || slug === "programs" || slug === "saved" || slug === "quiz") continue;
      seen.add(slug);
    }
    cityRe.lastIndex = 0;
    const added = seen.size - before;
    if (added === 0 && page > 1) break; // no new cities on this page → done
  }
  return [...seen].sort();
}

function parseNumberOfItems(html) {
  const m = html.match(/"numberOfItems":(\d+)/);
  return m ? Number(m[1]) : null;
}

async function fetchCityChurches(stateSlug, citySlug, { limitPages = 0, skipIfCoveredCount = 0, coverageThreshold = 0.95 } = {}) {
  const churches = [];
  const seenSourceIds = new Set();
  const cap = limitPages > 0 ? limitPages : 200;
  let claimedTotal = null;
  for (let page = 1; page <= cap; page++) {
    const url = page === 1
      ? `${BASE}/churches/${stateSlug}/${citySlug}`
      : `${BASE}/churches/${stateSlug}/${citySlug}?page=${page}`;
    const html = await fetchText(url);
    if (!html) break;
    if (page === 1) {
      claimedTotal = parseNumberOfItems(html);
      // If DB already has near-full coverage for this city, skip further pages.
      // We still return page-1 churches so upsert refreshes enrichment; it'll
      // dedup to near-zero new inserts.
      if (
        claimedTotal
        && skipIfCoveredCount > 0
        && skipIfCoveredCount >= Math.floor(claimedTotal * coverageThreshold)
      ) {
        const pageChurches = extractChurchesFromListing(html);
        for (const c of pageChurches) {
          const key = c.source_id || c.id || c.slug;
          if (seenSourceIds.has(key)) continue;
          seenSourceIds.add(key);
          churches.push(c);
        }
        return { churches, claimedTotal, skipped: true };
      }
    }
    const pageChurches = extractChurchesFromListing(html);
    if (pageChurches.length === 0) break;
    let newOnPage = 0;
    for (const c of pageChurches) {
      const key = c.source_id || c.id || c.slug;
      if (seenSourceIds.has(key)) continue;
      seenSourceIds.add(key);
      churches.push(c);
      newOnPage += 1;
    }
    // Only break when no new source_ids appear. Psalmlog sometimes returns 19
    // instead of 20 on a mid-list page (upstream dedup), so `length < 20` is
    // NOT a reliable end-of-list signal. Beyond the last real page, psalmlog
    // repeats earlier entries — within-city seenSourceIds catches that.
    if (newOnPage === 0) break;
  }
  return { churches, claimedTotal, skipped: false };
}

function usStateSlugToName(stateSlug) {
  const map = {
    alabama: "Alabama", alaska: "Alaska", arizona: "Arizona", arkansas: "Arkansas",
    california: "California", colorado: "Colorado", connecticut: "Connecticut",
    delaware: "Delaware", florida: "Florida", georgia: "Georgia", hawaii: "Hawaii",
    idaho: "Idaho", illinois: "Illinois", indiana: "Indiana", iowa: "Iowa",
    kansas: "Kansas", kentucky: "Kentucky", louisiana: "Louisiana", maine: "Maine",
    maryland: "Maryland", massachusetts: "Massachusetts", michigan: "Michigan",
    minnesota: "Minnesota", mississippi: "Mississippi", missouri: "Missouri",
    montana: "Montana", nebraska: "Nebraska", nevada: "Nevada",
    "new-hampshire": "New Hampshire", "new-jersey": "New Jersey",
    "new-mexico": "New Mexico", "new-york": "New York",
    "north-carolina": "North Carolina", "north-dakota": "North Dakota",
    ohio: "Ohio", oklahoma: "Oklahoma", oregon: "Oregon",
    pennsylvania: "Pennsylvania", "rhode-island": "Rhode Island",
    "south-carolina": "South Carolina", "south-dakota": "South Dakota",
    tennessee: "Tennessee", texas: "Texas", utah: "Utah", vermont: "Vermont",
    virginia: "Virginia", washington: "Washington",
    "west-virginia": "West Virginia", wisconsin: "Wisconsin", wyoming: "Wyoming",
    "district-of-columbia": "District of Columbia",
  };
  return map[stateSlug] || stateSlug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function cityNameFromSlug(citySlug) {
  return citySlug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// Names like "First Baptist Church" repeat across thousands of US cities, so the
// bare name slug is almost always a bad anchor. Always include city (+ state on
// collision) to keep slugs stable and meaningful.
function createUniqueSlug(name, city, stateAbbr, usedSlugs) {
  const attempts = [
    slugifyName(`${name} ${city}`),
    slugifyName(`${name} ${city} ${stateAbbr}`),
  ].filter(Boolean);
  for (const a of attempts) {
    if (!usedSlugs.has(a)) {
      usedSlugs.add(a);
      return a;
    }
  }
  let suffix = 2;
  const base = slugifyName(`${name} ${city} ${stateAbbr}`);
  while (usedSlugs.has(`${base}-${suffix}`)) suffix += 1;
  const slug = `${base}-${suffix}`;
  usedSlugs.add(slug);
  return slug;
}

function prepareChurchValue(column, value) {
  if (value === undefined) return undefined;
  if (["spotify_playlists", "youtube_videos"].includes(column) && value !== null) return JSON.stringify(value);
  return value;
}

function prepareEnrichmentValue(column, value) {
  if (value === undefined) return undefined;
  if (["service_times", "sources", "raw_google_places", "raw_crawled_pages"].includes(column) && value !== null) {
    return JSON.stringify(value);
  }
  return value;
}

async function upsertRow(sql, table, conflictColumn, row, prepareValue) {
  const entries = Object.entries(row).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const columns = entries.map(([c]) => c);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const values = entries.map(([c, v]) => prepareValue(c, v));
  const updates = columns.filter((c) => c !== conflictColumn).map((c) => `${c} = EXCLUDED.${c}`);
  if (!columns.includes("updated_at")) updates.push("updated_at = NOW()");
  const query = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
     ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updates.join(", ")}`;

  // Neon serverless occasionally drops connections under sustained load.
  // Retry transient fetch/network errors; let schema errors surface immediately.
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await sql.query(query, values);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /fetch failed|ECONN|ETIMEDOUT|timeout|network|socket hang up/i.test(msg);
      if (!transient) throw err;
      lastErr = err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function loadAllChurchRows(sql) {
  return sql`SELECT slug, name, country, location, website, status, reason FROM churches`;
}

async function upsertChurches(sql, rows) {
  let fallbackLogged = false;
  for (const originalBatch of chunk(rows, UPSERT_BATCH_SIZE)) {
    let batch = originalBatch;
    while (true) {
      try {
        for (const row of batch) await upsertRow(sql, "churches", "slug", row, prepareChurchValue);
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("chk_churches_discovery_source")
          && batch.some((row) => row.discovery_source === "directory-import")
        ) {
          if (!fallbackLogged) {
            console.log("Falling back to discovery_source=google-search.");
            fallbackLogged = true;
          }
          batch = batch.map((row) => ({
            ...row,
            discovery_source: "google-search",
            reason: String(row.reason || "").replace(/^directory-import:/, "directory-import-fallback:"),
          }));
          continue;
        }
        throw new Error(`Failed to upsert churches: ${message}`);
      }
    }
  }
}

async function upsertEnrichmentSeeds(sql, rows) {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    for (const row of batch) {
      await upsertRow(sql, "church_enrichments", "church_slug", row, prepareEnrichmentValue);
    }
  }
}

function buildMinistriesArray(c) {
  const arr = [];
  if (c.has_kids_ministry) arr.push("Kids Ministry");
  if (c.has_youth_group) arr.push("Youth Group");
  if (c.has_small_groups) arr.push("Small Groups");
  return arr.length ? arr : null;
}

function confidenceFor(c) {
  let score = 0.6;
  if (c.address) score += 0.05;
  if (c.phone) score += 0.03;
  if (c.denomination) score += 0.03;
  if (c.ai_description && c.ai_description.length > 50) score += 0.02;
  return Number(Math.max(0.4, Math.min(0.85, score)).toFixed(2));
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const stateSlug = options.state;
  const stateName = usStateSlugToName(stateSlug);
  const directoryReason = `${DIRECTORY_REASON_BASE} | ${stateName}`;

  console.log(`Collecting cities for ${stateName}…`);
  const allCitySlugs = await collectCitySlugs(stateSlug);
  console.log(`Found ${allCitySlugs.length} cities in ${stateName}.`);

  const citySlugs = options.cities > 0
    ? allCitySlugs.slice(options.skipCities, options.skipCities + options.cities)
    : allCitySlugs.slice(options.skipCities);
  console.log(`Scraping ${citySlugs.length} cities (skipping ${options.skipCities}, per-city page limit ${options.limitPerCity || "∞"}).`);

  // Pre-load DB counts per city (for psalmlog rows only) so we can short-circuit
  // already-fully-scraped cities on the first page fetch.
  const dbCityCountMap = new Map();
  {
    const rows = await sql`
      SELECT location, COUNT(*)::int AS n
      FROM churches
      WHERE reason LIKE ${`${DIRECTORY_REASON_BASE}%`}
        AND location IS NOT NULL
      GROUP BY location
    `;
    for (const r of rows) dbCityCountMap.set(String(r.location).toLowerCase(), r.n);
  }

  const cityResults = await mapWithConcurrency(citySlugs, CITY_PAGE_CONCURRENCY, async (citySlug) => {
    const cityName = cityNameFromSlug(citySlug);
    const skipIfCoveredCount = dbCityCountMap.get(cityName.toLowerCase()) || 0;
    const result = await fetchCityChurches(stateSlug, citySlug, {
      limitPages: options.limitPerCity,
      skipIfCoveredCount,
      coverageThreshold: 0.95,
    });
    return { citySlug, ...result };
  });

  let skippedCities = 0;
  const allChurches = [];
  for (const r of cityResults) {
    if (!r.ok || !r.value) {
      console.log(`  [warn] city scrape failed: ${r.error?.message || "unknown"}`);
      continue;
    }
    if (r.value.skipped) skippedCities += 1;
    allChurches.push(...r.value.churches.map((c) => ({ ...c, _citySlug: r.value.citySlug })));
  }
  console.log(`Scraped ${allChurches.length} raw churches across ${cityResults.length} cities (skipped ${skippedCities} cities with near-full DB coverage).`);

  // Load DB state
  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  const seenSourceIds = new Set();
  const seenNameAddr = new Set();
  let deduped = 0;
  let withinFeedDedup = 0;

  let skippedNonChurch = 0;
  for (const c of allChurches) {
    const name = (c.name || "").trim();
    if (!name) continue;
    if (isLikelyNotAChurch(name)) {
      skippedNonChurch += 1;
      continue;
    }
    const city = (c.city || cityNameFromSlug(c._citySlug)).trim();
    const stateAbbr = c.state_abbr || c.stateAbbr || "";
    const address = (c.address || "").trim();

    // Within-feed dedup: psalmlog has listing duplicates with different suffixed slugs.
    const sourceKey = c.source_id || c.id;
    if (sourceKey && seenSourceIds.has(sourceKey)) {
      withinFeedDedup += 1;
      continue;
    }
    if (sourceKey) seenSourceIds.add(sourceKey);
    const nameAddrKey = `${name.toLowerCase()}|${address.toLowerCase()}|${city.toLowerCase()}`;
    if (seenNameAddr.has(nameAddrKey)) {
      withinFeedDedup += 1;
      continue;
    }
    seenNameAddr.add(nameAddrKey);

    const denomination = c.denomination || null;
    const confidence = confidenceFor(c);

    // Dedup against DB: listings have no website, so only name+location match is useful here.
    const duplicate = findChurchDuplicate(index, {
      name,
      country: "United States",
      location: city || "",
      website: "",
    });

    const slug = duplicate?.slug || createUniqueSlug(name, city, stateAbbr, usedSlugs);
    touched.add(slug);

    const ministries = buildMinistriesArray(c);
    const summary = c.ai_description ? String(c.ai_description).slice(0, 500) : null;
    const seoDescription = c.ai_description ? String(c.ai_description).slice(0, 300) : null;

    enrichmentSeeds.push({
      church_slug: slug,
      ...(address ? { street_address: address } : {}),
      ...(c.phone ? { phone: c.phone } : {}),
      ...(denomination ? { denomination_network: denomination } : {}),
      ...(ministries ? { ministries } : {}),
      ...(typeof c.has_kids_ministry === "boolean" ? { children_ministry: c.has_kids_ministry } : {}),
      ...(typeof c.has_youth_group === "boolean" ? { youth_ministry: c.has_youth_group } : {}),
      ...(summary ? { summary } : {}),
      ...(seoDescription ? { seo_description: seoDescription } : {}),
      ...(Number.isFinite(c.lat) ? { latitude: c.lat } : {}),
      ...(Number.isFinite(c.lng) ? { longitude: c.lng } : {}),
      confidence,
      sources: {
        psalmlog: {
          slug: c.slug,
          source: c.source || null,
          source_id: c.source_id || null,
          ai_what_to_expect: c.ai_what_to_expect || null,
          worship_style: c.worship_style || null,
          scraped_at: new Date().toISOString(),
        },
      },
      last_enriched_at: new Date().toISOString(),
    });

    if (duplicate) {
      deduped += 1;
      continue;
    }

    const now = new Date().toISOString();
    inserts.push({
      slug,
      name,
      description: summary || "",
      country: "United States",
      location: city || null,
      denomination: denomination || null,
      founded: null,
      website: null,
      email: null,
      language: "en",
      logo: null,
      header_image: null,
      header_image_attribution: null,
      spotify_url: null,
      spotify_playlist_ids: [],
      additional_playlists: [],
      spotify_playlists: null,
      music_style: null,
      notable_artists: null,
      youtube_channel_id: null,
      spotify_artist_ids: null,
      youtube_videos: null,
      aliases: null,
      source_kind: "discovered",
      status: options.approve ? "approved" : "pending",
      confidence,
      reason: `${directoryReason} | ${c._citySlug}/${c.slug}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, {
      slug,
      name,
      country: "United States",
      location: city || null,
      website: null,
    });
    // No website from listings, so no host-index update until detail pass.
  }

  console.log(
    `Prepared: inserts=${inserts.length}, dedup(DB)=${deduped}, dedup(feed)=${withinFeedDedup}, non-church-filtered=${skippedNonChurch}, touched=${touched.size}`,
  );
  console.log("Sample (first 5):");
  console.log(JSON.stringify(
    inserts.slice(0, 5).map((r) => ({
      slug: r.slug,
      name: r.name,
      location: r.location,
      denomination: r.denomination,
      confidence: r.confidence,
    })),
    null,
    2,
  ));

  if (options.preview) {
    console.log("\nPreview mode: nothing written to DB.");
    return;
  }

  if (inserts.length > 0) await upsertChurches(sql, inserts);
  await upsertEnrichmentSeeds(sql, enrichmentSeeds);
  console.log(`Imported ${inserts.length} churches and seeded ${enrichmentSeeds.length} enrichment rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
