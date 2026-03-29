#!/usr/bin/env node

/**
 * Google Places Church Discovery Script
 *
 * Searches Google Places (via Apify) for churches in cities worldwide,
 * uses Claude Haiku to screen for worship-music relevance, and saves
 * candidates to Supabase.
 *
 * Usage:
 *   source .env.local && node scripts/discover-google-churches.mjs [options]
 *
 * Options:
 *   --region=europe|all      Which countries (default: all)
 *   --max-cities=200         Max cities to search
 *   --resume                 Continue from checkpoint
 *   --dry-run                Show plan without executing
 *   --concurrency=1          Parallel Apify calls (default: 1)
 *
 * Required env vars:
 *   APIFY_TOKEN, ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { ApifyClient } from "apify-client";
import Anthropic from "@anthropic-ai/sdk";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

/* ── CLI Args ── */

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    region: "all",
    maxCities: 200,
    resume: false,
    dryRun: false,
    concurrency: 1,
  };

  for (const arg of args) {
    if (arg.startsWith("--region=")) opts.region = arg.split("=")[1];
    else if (arg.startsWith("--max-cities=")) opts.maxCities = parseInt(arg.split("=")[1], 10);
    else if (arg === "--resume") opts.resume = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--concurrency=")) opts.concurrency = parseInt(arg.split("=")[1], 10);
    else console.warn(`Unknown arg: ${arg}`);
  }

  return opts;
}

/* ── Name Utilities (from discover-spotify-churches.mjs) ── */

function sanitizeChurchName(name) {
  let clean = name;
  clean = clean
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&middot;/g, "\u00B7")
    .replace(/&raquo;/g, "\u00BB")
    .replace(/&laquo;/g, "\u00AB")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&[a-z]+;/gi, (entity) => {
      const map = { "&eacute;": "\u00E9", "&aacute;": "\u00E1", "&iacute;": "\u00ED",
        "&oacute;": "\u00F3", "&uacute;": "\u00FA", "&ntilde;": "\u00F1",
        "&auml;": "\u00E4", "&ouml;": "\u00F6", "&uuml;": "\u00FC",
        "&aring;": "\u00E5", "&egrave;": "\u00E8", "&agrave;": "\u00E0" };
      return map[entity.toLowerCase()] || entity;
    });
  clean = clean.replace(/^Home\s*[\u00BB\u203A\u2013\u2014>|:»›–-]\s*/i, "");
  clean = clean.replace(/^[-|]\s+/, "");
  if (/\s[·\u00B7|]\s/.test(clean)) {
    const parts = clean.split(/\s[·\u00B7|]\s/);
    if (parts.length === 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
      clean = parts[0].trim();
    }
  }
  return clean.trim();
}

function slugify(name) {
  return sanitizeChurchName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(the|church|of|in|de|la|el|les|des|und|och|i)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHost(url) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* ── Language & Search Templates ── */

const COUNTRY_LANGUAGE = {
  "Sweden": "sv", "Germany": "de", "France": "fr", "Spain": "es",
  "Brazil": "pt", "Denmark": "da", "Norway": "no", "Finland": "fi",
  "Portugal": "pt", "Netherlands": "nl", "Italy": "it", "Austria": "de",
  "Switzerland": "de", "Belgium": "fr", "Argentina": "es", "Colombia": "es",
  "Mexico": "es", "Guatemala": "es", "Honduras": "es", "Czech Republic": "cs",
  "Hungary": "hu", "Poland": "pl", "Romania": "ro", "Greece": "el",
  "Japan": "ja", "South Korea": "ko", "Indonesia": "id", "Thailand": "th",
  "Philippines": "tl", "Malaysia": "ms",
};

const SEARCH_TEMPLATES = {
  default: ["worship church {city}", "gospel church {city}"],
  sv: ["pingstförsamling {city}", "frikyrka {city}"],
  de: ["freikirche {city}", "lobpreis gemeinde {city}"],
  fr: ["église évangélique {city}", "église louange {city}"],
  es: ["iglesia evangélica {city}", "iglesia adoración {city}"],
  pt: ["igreja evangélica {city}", "igreja louvor {city}"],
  da: ["frikirke {city}", "pinsemenighed {city}"],
  no: ["frikirke {city}", "pinsemenighet {city}"],
  fi: ["vapaaseurakunta {city}", "helluntaiseurakunta {city}"],
  nl: ["vrije gemeente {city}", "aanbidding kerk {city}"],
  it: ["chiesa evangelica {city}", "chiesa adorazione {city}"],
  ko: ["교회 {city}", "찬양 교회 {city}"],
  id: ["gereja {city}", "gereja pujian {city}"],
};

const EUROPEAN_COUNTRIES = new Set([
  "United Kingdom", "Germany", "Spain", "Switzerland", "Sweden", "France",
  "Denmark", "Norway", "Finland", "Netherlands", "Italy", "Portugal",
  "Austria", "Belgium", "Hungary", "Romania", "Czech Republic", "Poland",
  "Greece", "Ireland",
]);

/* ── City Expansion Map ── */

const CITY_EXPANSION = {
  "United Kingdom": ["Leeds", "Sheffield", "Edinburgh", "Glasgow", "Liverpool", "Cardiff", "Nottingham", "Newcastle"],
  "Germany": ["Frankfurt", "Cologne", "Stuttgart", "Düsseldorf", "Leipzig", "Dresden", "Hannover"],
  "Spain": ["Seville", "Bilbao", "Murcia", "Palma", "Zaragoza"],
  "Switzerland": ["Bern", "Lucerne", "Winterthur", "St. Gallen"],
  "Sweden": ["Linköping", "Örebro", "Västerås", "Jönköping", "Umeå"],
  "France": ["Toulouse", "Nice", "Nantes", "Strasbourg", "Bordeaux"],
  "Denmark": ["Aalborg", "Esbjerg", "Randers", "Kolding"],
  "Norway": ["Drammen", "Kristiansand", "Tromsø", "Fredrikstad"],
  "Finland": ["Turku", "Oulu", "Jyväskylä", "Lahti"],
  "Brazil": ["Brasília", "Salvador", "Fortaleza", "Recife", "Porto Alegre"],
  "Australia": ["Perth", "Adelaide", "Canberra", "Hobart"],
  "USA": ["Houston", "Atlanta", "Nashville", "Dallas", "Chicago", "Phoenix", "Denver"],
  "United States": ["Houston", "Atlanta", "Nashville", "Dallas", "Chicago"],
  "Nigeria": ["Abuja", "Port Harcourt", "Ibadan", "Kano"],
  "South Africa": ["Pretoria", "Durban", "Bloemfontein"],
  "Philippines": ["Quezon City", "Makati", "Iloilo", "Zamboanga"],
  "South Korea": ["Busan", "Daegu", "Incheon", "Daejeon"],
  "Indonesia": ["Surabaya", "Bandung", "Medan", "Semarang"],
  "Netherlands": ["Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
  "India": ["Mumbai", "Bangalore", "Chennai", "Hyderabad", "Delhi"],
  "Mexico": ["Mexico City", "Guadalajara", "Monterrey"],
  "Colombia": ["Medellín", "Cali", "Barranquilla"],
  "Kenya": ["Mombasa", "Kisumu", "Nakuru"],
  "Canada": ["Vancouver", "Montreal", "Calgary", "Ottawa"],
  "Singapore": ["Singapore"],
  "New Zealand": ["Auckland", "Wellington", "Christchurch"],
  "Ghana": ["Kumasi", "Takoradi", "Tamale"],
};

// Capital/major cities for countries with 1-3 churches
const NEW_COUNTRY_CAPITALS = {
  "Jamaica": ["Kingston", "Montego Bay"],
  "Italy": ["Rome", "Milan", "Naples"],
  "Portugal": ["Lisbon", "Porto"],
  "UAE": ["Dubai", "Abu Dhabi"],
  "Austria": ["Vienna", "Graz"],
  "Malaysia": ["Kuala Lumpur", "Penang"],
  "Tanzania": ["Dar es Salaam", "Dodoma"],
  "Belgium": ["Brussels", "Antwerp"],
  "Japan": ["Tokyo", "Osaka"],
  "Thailand": ["Bangkok", "Chiang Mai"],
  "Greece": ["Athens", "Thessaloniki"],
  "Israel": ["Tel Aviv", "Jerusalem"],
  "Guatemala": ["Guatemala City"],
  "Czech Republic": ["Prague", "Brno"],
  "Honduras": ["Tegucigalpa", "San Pedro Sula"],
  "Ireland": ["Dublin", "Cork"],
  "Hong Kong": ["Hong Kong"],
  "Poland": ["Warsaw", "Krakow", "Wroclaw"],
  "Uganda": ["Kampala", "Entebbe"],
  "Romania": ["Bucharest", "Cluj-Napoca"],
  "Hungary": ["Budapest", "Debrecen"],
  "Argentina": ["Buenos Aires", "Córdoba", "Rosario"],
};

/* ── Build City List ── */

function buildCityList(churches, options) {
  const byCountry = {};
  const byCityCountry = {};

  for (const c of churches) {
    const country = c.country || "";
    if (!country) continue;
    byCountry[country] = (byCountry[country] || 0) + 1;
    if (c.location) {
      const city = c.location.split(",")[0].trim();
      const key = `${city}|||${country}`;
      byCityCountry[key] = (byCityCountry[key] || 0) + 1;
    }
  }

  // Existing cities (for dedup)
  const existingCities = new Set();
  for (const c of churches) {
    if (c.location && c.country) {
      const city = c.location.split(",")[0].trim().toLowerCase();
      existingCities.add(`${city}|||${c.country.toLowerCase()}`);
    }
  }

  const cities = [];

  // Tier 1: Expansion - for countries with 5+ churches, add missing large cities
  for (const [country, expansionCities] of Object.entries(CITY_EXPANSION)) {
    if ((byCountry[country] || 0) < 5) continue;
    if (options.region === "europe" && !EUROPEAN_COUNTRIES.has(country)) continue;

    for (const city of expansionCities) {
      const key = `${city.toLowerCase()}|||${country.toLowerCase()}`;
      if (!existingCities.has(key)) {
        cities.push({
          city,
          country,
          language: COUNTRY_LANGUAGE[country] || "en",
          tier: "expansion",
        });
      }
    }
  }

  // Tier 2: Deepening - cities with 3+ existing churches
  for (const [key, count] of Object.entries(byCityCountry)) {
    if (count < 3) continue;
    const [city, country] = key.split("|||");
    if (options.region === "europe" && !EUROPEAN_COUNTRIES.has(country)) continue;
    // Skip entries where "city" is actually the country name
    if (city.toLowerCase() === country.toLowerCase()) continue;

    // Already in expansion list?
    if (cities.some((c) => c.city.toLowerCase() === city.toLowerCase() && c.country === country)) continue;

    cities.push({
      city,
      country,
      language: COUNTRY_LANGUAGE[country] || "en",
      tier: "deepening",
    });
  }

  // Tier 3: New countries - countries with 1-3 churches
  for (const [country, capitalCities] of Object.entries(NEW_COUNTRY_CAPITALS)) {
    if ((byCountry[country] || 0) > 3) continue;
    if (options.region === "europe" && !EUROPEAN_COUNTRIES.has(country)) continue;

    for (const city of capitalCities) {
      // Skip if already added from deepening tier
      if (cities.some((c) => c.city.toLowerCase() === city.toLowerCase() && c.country === country)) continue;
      cities.push({
        city,
        country,
        language: COUNTRY_LANGUAGE[country] || "en",
        tier: "new-country",
      });
    }
  }

  // Sort deterministically for checkpoint stability
  cities.sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city));

  return cities.slice(0, options.maxCities);
}

/* ── Google Places Search ── */

async function searchChurchesInCity(apify, city, country, language) {
  const lang = language || "en";
  const templates = SEARCH_TEMPLATES[lang] || SEARCH_TEMPLATES.default;
  const defaultTemplates = SEARCH_TEMPLATES.default;

  // Use local + English queries
  const queries = [
    ...templates.map((t) => t.replace("{city}", city)),
  ];
  // Add English queries if local language isn't English
  if (lang !== "en") {
    for (const t of defaultTemplates) {
      const q = t.replace("{city}", city);
      if (!queries.includes(q)) queries.push(q);
    }
  }
  // Limit to 2 queries
  const searchQueries = queries.slice(0, 2);

  const allResults = [];
  const seenPlaceIds = new Set();

  for (const query of searchQueries) {
    try {
      const run = await apify.actor("compass/crawler-google-places").call({
        searchStringsArray: [query],
        maxCrawledPlacesPerSearch: 10,
        language: lang === "en" ? "en" : lang,
        scrapeReviewerName: false,
        scrapeReviewId: false,
        scrapeReviewUrl: false,
        scrapeResponseFromOwner: false,
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();
      const queryLabel = `"${query}"`;

      if (!items || items.length === 0) {
        console.log(`  google: ${queryLabel} -> 0 results`);
        continue;
      }

      console.log(`  google: ${queryLabel} -> ${items.length} results`);

      for (const item of items) {
        const placeId = item.placeId || item.cid || item.url;
        if (!placeId || seenPlaceIds.has(placeId)) continue;
        seenPlaceIds.add(placeId);
        allResults.push(item);
      }
    } catch (err) {
      console.error(`  google error for "${query}": ${err.message}`);
    }

    await sleep(5000);
  }

  return allResults;
}

/* ── Dedup ── */

function buildDedupSets(churches, enrichments) {
  const hostnames = new Set();
  const normalizedNames = new Map(); // normalized name -> Set of countries
  const googleUrls = new Set();

  for (const c of churches) {
    if (c.website) {
      const host = normalizeHost(c.website);
      if (host) hostnames.add(host);
    }
    const norm = normalizeName(c.name || "");
    if (norm) {
      const country = (c.country || "").toLowerCase();
      if (!normalizedNames.has(norm)) normalizedNames.set(norm, new Set());
      normalizedNames.get(norm).add(country);
    }
  }

  for (const e of enrichments) {
    if (e.google_maps_url) googleUrls.add(e.google_maps_url);
    if (e.website) {
      const host = normalizeHost(e.website);
      if (host) hostnames.add(host);
    }
  }

  return { hostnames, normalizedNames, googleUrls };
}

function isDuplicate(item, dedupSets, sessionPlaceIds, country) {
  // Session dedup
  const placeId = item.placeId || item.cid;
  if (placeId && sessionPlaceIds.has(placeId)) return true;

  // Website hostname dedup
  if (item.website) {
    const host = normalizeHost(item.website);
    if (host && dedupSets.hostnames.has(host)) return true;
  }

  // Google Maps URL dedup
  if (item.url && dedupSets.googleUrls.has(item.url)) return true;

  // Name + country dedup
  const name = item.title || item.name || "";
  const norm = normalizeName(name);
  if (norm && dedupSets.normalizedNames.has(norm)) {
    const countries = dedupSets.normalizedNames.get(norm);
    if (countries.has(country.toLowerCase())) return true;
  }

  return false;
}

/* ── AI Screening ── */

async function screenWithHaiku(anthropic, places) {
  if (places.length === 0) return [];

  const placeDescriptions = places.map((p, i) => {
    const cats = (p.categories || p.categoryName || []);
    const catStr = Array.isArray(cats) ? cats.join(", ") : cats;
    return `${i}. "${p.title || p.name}" | Categories: ${catStr || "none"} | Website: ${p.website || "none"} | Rating: ${p.totalScore || "n/a"} (${p.reviewsCount || 0} reviews)`;
  }).join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Du screenar Google Places-resultat för att hitta kyrkor som producerar eller kurerar worship-musik. Vi bygger en katalog av kyrkor med aktiva worship/musik-ministries.

Poängsätt varje kyrka 0-100:
- Namn antyder worship/praise/gospel-fokus: +30
- Kategorier: "church", "place of worship": +20
- Har webbplats: +15
- Karismatisk/pingst/evangelikal tradition: +15
- Känt nätverk (Hillsong, Vineyard, C3, Bethel, Elevation, ICF, Maverick City): +20
- Väldigt generiskt namn / traditionell liturgisk kyrka (katolsk, ortodox): -20

Resultat:
${placeDescriptions}

Returnera ENBART JSON-array, inga andra tecken:
[{"index": 0, "score": 75, "reason": "kort motivering"}, ...]`,
      }],
    });

    const text = response.content[0].text.trim();
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("  ai: Could not parse response");
      return [];
    }
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`  ai error: ${err.message}`);
    return [];
  }
}

/* ── Checkpoint ── */

const CHECKPOINT_PATH = join(__dirname, ".discovery-checkpoint.json");

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveCheckpoint(data) {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 2));
}

/* ── Cost Tracking ── */

function estimateCost(stats) {
  // Apify: ~$0.015 per run
  const apifyCost = stats.apifyRuns * 0.015;
  // Haiku: ~$0.001 per call (very cheap)
  const haikuCost = stats.haikuCalls * 0.001;
  return apifyCost + haikuCost;
}

/* ── Timestamp ── */

function ts() {
  return new Date().toLocaleTimeString("sv-SE", { hour12: false });
}

/* ── Main ── */

async function main() {
  const opts = parseArgs();

  console.log("Google Places Church Discovery");
  console.log(`  region: ${opts.region}`);
  console.log(`  max-cities: ${opts.maxCities}`);
  console.log(`  resume: ${opts.resume}`);
  console.log(`  dry-run: ${opts.dryRun}`);
  console.log(`  concurrency: ${opts.concurrency}`);
  console.log();

  // Validate env
  const requiredEnv = ["APIFY_TOKEN", "ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      console.error(`Missing env var: ${key}`);
      process.exit(1);
    }
  }

  // Load existing churches
  const churchesPath = join(__dirname, "..", "src", "data", "churches.json");
  const churches = JSON.parse(readFileSync(churchesPath, "utf8"));
  console.log(`Loaded ${churches.length} existing churches from churches.json`);

  // Load Supabase data for dedup
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

  const { data: dbChurches } = await supabase
    .from("churches")
    .select("slug, name, country, website");
  const { data: enrichments } = await supabase
    .from("church_enrichments")
    .select("church_slug, google_maps_url, website");

  const allChurches = [...churches];
  // Add DB churches not in JSON
  const jsonSlugs = new Set(churches.map((c) => c.slug));
  for (const dbc of (dbChurches || [])) {
    if (!jsonSlugs.has(dbc.slug)) {
      allChurches.push(dbc);
    }
  }
  console.log(`Total known churches (JSON + DB): ${allChurches.length}`);

  // Build dedup sets
  const dedupSets = buildDedupSets(allChurches, enrichments || []);
  const sessionPlaceIds = new Set();
  console.log(`Dedup: ${dedupSets.hostnames.size} hostnames, ${dedupSets.normalizedNames.size} names, ${dedupSets.googleUrls.size} Google URLs`);

  // Build city list
  const cities = buildCityList(allChurches, opts);
  console.log(`\nCity list: ${cities.length} cities`);

  const tierCounts = {};
  for (const c of cities) tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1;
  for (const [tier, count] of Object.entries(tierCounts)) {
    console.log(`  ${tier}: ${count} cities`);
  }

  if (opts.dryRun) {
    console.log("\n--- Dry Run: City List ---\n");
    for (const c of cities) {
      console.log(`  [${c.tier}] ${c.city}, ${c.country} (${c.language})`);
    }
    console.log(`\nEstimated Apify runs: ${cities.length * 2}`);
    console.log(`Estimated cost: $${(cities.length * 2 * 0.015 + cities.length * 0.001).toFixed(2)}`);
    console.log(`Estimated time: ~${Math.ceil(cities.length * 2 * 25 / 3600)} hours`);
    return;
  }

  // Init clients
  const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const anthropic = new Anthropic();

  // Resume checkpoint
  let startIndex = 0;
  const stats = {
    citiesSearched: 0,
    googleResults: 0,
    afterDedup: 0,
    candidatesSaved: 0,
    apifyRuns: 0,
    haikuCalls: 0,
  };

  if (opts.resume) {
    const checkpoint = loadCheckpoint();
    if (checkpoint) {
      startIndex = checkpoint.completedCityIndex + 1;
      Object.assign(stats, checkpoint.stats);
      console.log(`\nResuming from city ${startIndex} (${stats.citiesSearched} cities already done)`);
    } else {
      console.log("\nNo checkpoint found, starting fresh");
    }
  }

  // Process cities
  const AI_BATCH_SIZE = 8;
  let pendingScreening = [];

  async function flushScreeningBatch() {
    if (pendingScreening.length === 0) return;

    const batch = pendingScreening.splice(0);
    const places = batch.map((b) => b.place);
    const scores = await screenWithHaiku(anthropic, places);
    stats.haikuCalls++;

    let passed = 0;
    const rows = [];

    for (const scored of scores) {
      if (typeof scored.index !== "number" || scored.index >= batch.length) continue;
      const { place, city, country } = batch[scored.index];
      const name = sanitizeChurchName(place.title || place.name || "");
      if (!name) continue;

      const status = scored.score >= 50 ? "pending" : scored.score >= 30 ? "pending" : null;
      if (!status) continue;

      const slug = slugify(name);
      if (!slug) continue;

      // Add to dedup sets to prevent future duplicates
      const norm = normalizeName(name);
      if (norm) {
        if (!dedupSets.normalizedNames.has(norm)) dedupSets.normalizedNames.set(norm, new Set());
        dedupSets.normalizedNames.get(norm).add(country.toLowerCase());
      }
      if (place.website) {
        const host = normalizeHost(place.website);
        if (host) dedupSets.hostnames.add(host);
      }

      rows.push({
        slug,
        name,
        description: "",
        country,
        location: city,
        website: place.website || null,
        header_image: place.imageUrl || null,
        email: place.email || null,
        source_kind: "discovered",
        status: "pending",
        discovery_source: "google-search",
        confidence: scored.score / 100,
        reason: `Google Places discovery in ${city}: ${scored.reason}`,
        discovered_at: new Date().toISOString(),
        place, // keep reference for enrichment
      });
      passed++;
    }

    if (rows.length > 0) {
      // Save churches (without the place reference)
      const churchRows = rows.map(({ place: _, ...rest }) => rest);
      const { error } = await supabase
        .from("churches")
        .upsert(churchRows, { onConflict: "slug", ignoreDuplicates: true });

      if (error) {
        console.error(`  save error: ${error.message}`);
      } else {
        stats.candidatesSaved += churchRows.length;
      }

      // Save enrichments with Google Places data
      const enrichmentRows = rows.map((r) => ({
        church_slug: r.slug,
        street_address: r.place.address || null,
        google_maps_url: r.place.url || null,
        latitude: r.place.location?.lat || null,
        longitude: r.place.location?.lng || null,
        phone: r.place.phone || null,
        website_url: r.place.website || null,
        contact_email: r.place.email || null,
        service_times: r.place.openingHours ? r.place.openingHours : null,
        raw_google_places: {
          placeId: r.place.placeId,
          title: r.place.title,
          categories: r.place.categories,
          categoryName: r.place.categoryName,
          totalScore: r.place.totalScore,
          reviewsCount: r.place.reviewsCount,
          imageUrl: r.place.imageUrl,
          address: r.place.address,
          city: r.place.city,
          postalCode: r.place.postalCode,
          countryCode: r.place.countryCode,
        },
        enrichment_status: "pending",
        confidence: r.confidence,
        sources: { google_places: true, discovery_batch: new Date().toISOString() },
      }));

      const { error: enrichError } = await supabase
        .from("church_enrichments")
        .upsert(enrichmentRows, { onConflict: "church_slug", ignoreDuplicates: true });

      if (enrichError) {
        console.error(`  enrichment save error: ${enrichError.message}`);
      }
    }

    console.log(`  ai: ${places.length} screened -> ${passed} passed (scores: ${scores.filter((s) => s.score >= 30).map((s) => s.score).join(", ") || "none"})`);
  }

  for (let i = startIndex; i < cities.length; i++) {
    const { city, country, language, tier } = cities[i];
    console.log(`\n[${ts()}] [${i + 1}/${cities.length}] ${city}, ${country} (${tier})`);

    // Search Google Places
    const results = await searchChurchesInCity(apify, city, country, language);
    stats.apifyRuns += 2;
    stats.googleResults += results.length;

    // Dedup
    const newResults = [];
    for (const item of results) {
      if (!isDuplicate(item, dedupSets, sessionPlaceIds, country)) {
        newResults.push(item);
        const placeId = item.placeId || item.cid;
        if (placeId) sessionPlaceIds.add(placeId);
      }
    }
    stats.afterDedup += newResults.length;
    console.log(`  dedup: ${results.length} raw -> ${newResults.length} new (${results.length - newResults.length} known)`);

    // Queue for AI screening
    for (const place of newResults) {
      pendingScreening.push({ place, city, country });
    }

    // Flush AI batch when full
    if (pendingScreening.length >= AI_BATCH_SIZE) {
      await flushScreeningBatch();
    }

    stats.citiesSearched++;

    // Save checkpoint
    saveCheckpoint({
      startedAt: stats.startedAt || new Date().toISOString(),
      completedCityIndex: i,
      stats,
    });

    const cost = estimateCost(stats);
    console.log(`  saved: ${stats.candidatesSaved} total candidates`);
    console.log(`  progress: ${stats.citiesSearched} cities done, ~$${cost.toFixed(2)} spent`);
  }

  // Flush remaining
  await flushScreeningBatch();

  // Final report
  const totalCost = estimateCost(stats);
  console.log("\n" + "=".repeat(60));
  console.log("Discovery Complete");
  console.log("=".repeat(60));
  console.log(`  Cities searched:   ${stats.citiesSearched}`);
  console.log(`  Google results:    ${stats.googleResults}`);
  console.log(`  After dedup:       ${stats.afterDedup}`);
  console.log(`  Candidates saved:  ${stats.candidatesSaved}`);
  console.log(`  Apify runs:        ${stats.apifyRuns}`);
  console.log(`  Haiku calls:       ${stats.haikuCalls}`);
  console.log(`  Est. cost:         $${totalCost.toFixed(2)}`);
  console.log("=".repeat(60));
  console.log("\nReview candidates at /admin/candidates");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
