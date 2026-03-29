#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  addChurchToIndex,
  createChurchIndex,
  findChurchDuplicate,
  isOfficialWebsiteUrl,
  normalizeWhitespace,
  slugifyName,
  toSiteRoot,
} from "./lib/church-intake-utils.mjs";
import {
  getOfficialDirectoryWebsite,
  inferLocationFromAddress,
  parseCountryLinks,
  parseDirectoryListings,
  parseNextCategoryPage,
} from "./lib/international-directory.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DIRECTORY_URL = "https://www.internationalchurches.eu/list/";
const EUROPE_COUNTRIES = new Set([
  "Albania",
  "Andorra",
  "Armenia",
  "Austria",
  "Azerbaijan",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Macedonia",
  "Malta",
  "Moldova",
  "Monaco",
  "Netherlands",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Switzerland",
  "Turkey",
  "Ukraine",
  "United Kingdom",
]);
const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 100;

function parseArgs(argv) {
  const options = {
    countries: [],
    limit: 0,
    preview: false,
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg.startsWith("--countries=")) {
      options.countries = arg
        .split("=")[1]
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    }
  }

  return options;
}

async function fetchHtml(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadAllChurchRows(supabase) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,name,country,location,website,status")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load existing churches: ${error.message}`);
    }

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function buildConfidence(listing) {
  let score = 0.62;
  if (listing.description) score += 0.08;
  if (listing.address) score += 0.08;
  if (listing.phone) score += 0.04;
  if (listing.facebookUrl) score += 0.04;
  if (listing.youtubeUrl) score += 0.03;
  if (listing.sundayMeetingTime) score += 0.03;
  return Number(Math.min(0.92, score).toFixed(2));
}

function buildReason(listing, category) {
  return `directory-import: ${category.name} | ${listing.listingUrl || category.url}`;
}

function createUniqueSlug(name, location, country, usedSlugs) {
  const parts = [name, location, country].filter(Boolean);
  const attempts = [
    slugifyName(name),
    slugifyName([name, location].filter(Boolean).join(" ")),
    slugifyName([name, country].filter(Boolean).join(" ")),
    slugifyName(parts.join(" ")),
  ].filter(Boolean);

  for (const attempt of attempts) {
    if (!usedSlugs.has(attempt)) {
      usedSlugs.add(attempt);
      return attempt;
    }
  }

  let suffix = 2;
  const base = slugifyName(name);
  while (usedSlugs.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  const slug = `${base}-${suffix}`;
  usedSlugs.add(slug);
  return slug;
}

function normalizeCountryFilterValue(value = "") {
  return normalizeWhitespace(value).toLowerCase();
}

function createEnrichmentSeed(slug, listing, website) {
  return {
    church_slug: slug,
    ...(website ? { website_url: website } : {}),
    ...(listing.facebookUrl ? { facebook_url: listing.facebookUrl } : {}),
    ...(listing.youtubeUrl ? { youtube_url: listing.youtubeUrl } : {}),
  };
}

async function upsertChurches(supabase, rows) {
  let fallbackLogged = false;

  for (const originalBatch of chunk(rows, UPSERT_BATCH_SIZE)) {
    let batch = originalBatch;

    while (true) {
      const { error } = await supabase
        .from("churches")
        .upsert(batch, { onConflict: "slug" });

      if (!error) {
        break;
      }

      if (
        error.message.includes("chk_churches_discovery_source") &&
        batch.some((row) => row.discovery_source === "directory-import")
      ) {
        if (!fallbackLogged) {
          console.log("Database does not yet allow discovery_source=directory-import; falling back to google-search for this import.");
          fallbackLogged = true;
        }
        batch = batch.map((row) => ({
          ...row,
          discovery_source: "google-search",
          reason: row.reason.replace(/^directory-import:/, "directory-import-fallback:"),
        }));
        continue;
      }

      throw new Error(`Failed to insert churches: ${error.message}`);
    }
  }
}

async function upsertEnrichmentSeeds(supabase, rows) {
  const mergedBySlug = new Map();
  for (const row of rows) {
    if (!row.church_slug || !(row.website_url || row.facebook_url || row.youtube_url)) continue;
    const existing = mergedBySlug.get(row.church_slug) || { church_slug: row.church_slug };
    mergedBySlug.set(row.church_slug, {
      ...existing,
      ...(row.website_url ? { website_url: row.website_url } : {}),
      ...(row.facebook_url ? { facebook_url: row.facebook_url } : {}),
      ...(row.youtube_url ? { youtube_url: row.youtube_url } : {}),
    });
  }

  const filtered = [...mergedBySlug.values()];
  for (const batch of chunk(filtered, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("church_enrichments")
      .upsert(batch, { onConflict: "church_slug" });
    if (error) {
      throw new Error(`Failed to seed enrichments: ${error.message}`);
    }
  }
}

async function fetchCategoryListings(category) {
  const listings = [];
  let nextUrl = category.url;
  const visited = new Set();

  while (nextUrl && !visited.has(nextUrl)) {
    visited.add(nextUrl);
    const html = await fetchHtml(nextUrl);
    listings.push(...parseDirectoryListings(html));
    nextUrl = parseNextCategoryPage(html);
  }

  return listings;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const directoryHtml = await fetchHtml(DIRECTORY_URL);
  const availableCountries = parseCountryLinks(directoryHtml)
    .filter((country) => EUROPE_COUNTRIES.has(country.name));

  const selectedCountries = availableCountries.filter((country) => {
    if (options.countries.length === 0) return true;
    return options.countries.includes(country.slug) || options.countries.includes(normalizeCountryFilterValue(country.name));
  });

  console.log(`International directory countries selected: ${selectedCountries.length}`);

  const existingRows = await loadAllChurchRows(supabase);
  const existingIndex = createChurchIndex();
  const usedSlugs = new Set(existingRows.map((row) => row.slug));
  for (const row of existingRows) {
    addChurchToIndex(existingIndex, row);
  }

  const inserts = [];
  const enrichmentSeeds = [];
  let deduped = 0;
  let missingWebsite = 0;
  let processed = 0;
  const failedCountries = [];

  for (const category of selectedCountries) {
    let listings = [];
    console.log(`\n${category.name}: fetching listings`);
    try {
      listings = await fetchCategoryListings(category);
      console.log(`  listings found: ${listings.length}`);
    } catch (error) {
      failedCountries.push({
        country: category.name,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`  failed: ${error instanceof Error ? error.message : error}`);
      continue;
    }

    for (const listing of listings) {
      if (options.limit > 0 && processed >= options.limit) break;
      processed += 1;

      const website = getOfficialDirectoryWebsite(listing);
      if (!website || !isOfficialWebsiteUrl(website)) {
        missingWebsite += 1;
        continue;
      }

      const location = inferLocationFromAddress(listing.address, listing.country || category.name);
      const duplicate = findChurchDuplicate(existingIndex, {
        name: listing.name,
        country: listing.country || category.name,
        location,
        website,
      });

      if (duplicate) {
        deduped += 1;
        if (duplicate.slug) {
          enrichmentSeeds.push(createEnrichmentSeed(duplicate.slug, listing, website));
        }
        continue;
      }

      const slug = createUniqueSlug(listing.name, location, category.name, usedSlugs);
      const row = {
        slug,
        name: listing.name,
        description: listing.description || "",
        country: listing.country || category.name,
        location: location || null,
        denomination: null,
        founded: null,
        website: toSiteRoot(website),
        email: null,
        language: null,
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
        status: "pending",
        confidence: buildConfidence(listing),
        reason: buildReason(listing, category),
        discovery_source: "directory-import",
        discovered_at: new Date().toISOString(),
        candidate_id: null,
        spotify_owner_id: null,
        last_researched: null,
        verified_at: null,
      };

      inserts.push(row);
      enrichmentSeeds.push(createEnrichmentSeed(slug, listing, toSiteRoot(website)));
      addChurchToIndex(existingIndex, row);
    }

    if (options.limit > 0 && processed >= options.limit) {
      break;
    }
  }

  console.log(`\nSummary: processed=${processed}, inserts=${inserts.length}, deduped=${deduped}, missingOfficialWebsite=${missingWebsite}`);
  if (failedCountries.length > 0) {
    console.log(`Failed countries: ${failedCountries.length}`);
    console.log(JSON.stringify(failedCountries.slice(0, 10), null, 2));
  }
  console.log(JSON.stringify(inserts.slice(0, 12).map((row) => ({
    slug: row.slug,
    name: row.name,
    country: row.country,
    location: row.location,
    website: row.website,
    confidence: row.confidence,
  })), null, 2));

  const hasEnrichmentSeeds = enrichmentSeeds.some((row) => row.website_url || row.facebook_url || row.youtube_url);

  if (options.preview || (inserts.length === 0 && !hasEnrichmentSeeds)) {
    console.log(options.preview ? "\nPreview mode: nothing written." : "\nNothing to insert.");
    return;
  }

  if (inserts.length > 0) {
    await upsertChurches(supabase, inserts);
  }
  await upsertEnrichmentSeeds(supabase, enrichmentSeeds);
  console.log(`\nInserted ${inserts.length} pending churches and seeded ${enrichmentSeeds.length} enrichment rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
