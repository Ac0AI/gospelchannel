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
  normalizeHost,
  normalizeWhitespace,
  slugifyName,
  toSiteRoot,
} from "./lib/church-intake-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 100;
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const BLOCKED_WEBSITE_HOSTS = [
  "catholicdirectory.org",
  "historicengland.org.uk",
  "nationaltrust.org.uk",
  "britishlistedbuildings.co.uk",
  "geograph.org.uk",
  "visitchurches.org.uk",
  "wikipedia.org",
  "tripadvisor.com",
  "tripadvisor.co.uk",
];
const COUNTRY_BY_ISO = new Map([
  ["AT", { name: "Austria", bbox: [46.35, 9.4, 49.1, 17.25], rows: 2, cols: 2 }],
  ["BE", { name: "Belgium", bbox: [49.45, 2.5, 51.6, 6.5], rows: 2, cols: 2 }],
  ["CH", { name: "Switzerland", bbox: [45.75, 5.8, 47.95, 10.7], rows: 2, cols: 2 }],
  ["CZ", { name: "Czech Republic", bbox: [48.5, 12.0, 51.1, 18.9], rows: 2, cols: 2 }],
  ["DE", { name: "Germany", bbox: [47.2, 5.6, 55.1, 15.1], rows: 3, cols: 3 }],
  ["DK", { name: "Denmark", bbox: [54.4, 7.8, 57.9, 15.5], rows: 2, cols: 2 }],
  ["ES", { name: "Spain", bbox: [35.7, -9.5, 43.9, 4.6], rows: 3, cols: 3 }],
  ["FI", { name: "Finland", bbox: [59.4, 19.0, 70.2, 31.7], rows: 3, cols: 2 }],
  ["FR", { name: "France", bbox: [41.2, -5.5, 51.3, 9.8], rows: 3, cols: 3 }],
  ["GB", { name: "United Kingdom", bbox: [49.8, -8.7, 59.1, 2.2], rows: 3, cols: 3 }],
  ["IE", { name: "Ireland", bbox: [51.2, -10.9, 55.6, -5.2], rows: 2, cols: 2 }],
  ["IT", { name: "Italy", bbox: [36.4, 6.6, 47.2, 18.6], rows: 3, cols: 3 }],
  ["NL", { name: "Netherlands", bbox: [50.7, 3.1, 53.7, 7.3], rows: 2, cols: 2 }],
  ["NO", { name: "Norway", bbox: [57.8, 4.0, 71.5, 31.5], rows: 3, cols: 2 }],
  ["PL", { name: "Poland", bbox: [49.0, 14.1, 54.9, 24.3], rows: 3, cols: 2 }],
  ["PT", { name: "Portugal", bbox: [36.8, -9.6, 42.3, -6.0], rows: 2, cols: 2 }],
  ["SE", { name: "Sweden", bbox: [55.0, 10.8, 69.3, 24.3], rows: 3, cols: 2 }],
]);

function parseArgs(argv) {
  const options = {
    preview: false,
    limit: 500,
    countries: ["GB"],
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg.startsWith("--limit=")) {
      options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    } else if (arg.startsWith("--countries=")) {
      options.countries = arg
        .split("=")[1]
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => COUNTRY_BY_ISO.has(value));
    }
  }

  return options;
}

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function buildOverpassQuery(isoCode, bbox) {
  const [south, west, north, east] = bbox;
  return `[out:json][timeout:90];
area["ISO3166-1"="${isoCode}"][admin_level=2]->.country;
(
  nwr(area.country)(${south},${west},${north},${east})["amenity"="place_of_worship"]["religion"="christian"]["website"];
  nwr(area.country)(${south},${west},${north},${east})["amenity"="place_of_worship"]["religion"="christian"]["contact:website"];
);
out center tags;`;
}

async function fetchOverpassJson(query, attempts = 4) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
          },
          body: new URLSearchParams({ data: query }),
        });

        if (!response.ok) {
          throw new Error(`${endpoint} HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    if (attempt >= attempts) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
  }

  throw new Error(`Overpass request failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
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

function createUniqueSlug(name, location, country, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName([name, location].filter(Boolean).join(" ")),
    slugifyName([name, country].filter(Boolean).join(" ")),
    slugifyName([name, location, country].filter(Boolean).join(" ")),
  ].filter(Boolean);

  for (const attempt of attempts) {
    if (!usedSlugs.has(attempt)) {
      usedSlugs.add(attempt);
      return attempt;
    }
  }

  const base = slugifyName(name);
  let suffix = 2;
  while (usedSlugs.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  const slug = `${base}-${suffix}`;
  usedSlugs.add(slug);
  return slug;
}

function normalizeUrl(value = "") {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function normalizeImageUrl(value = "") {
  const url = normalizeUrl(value);
  return /^https?:\/\//i.test(url) ? url : "";
}

function isBlockedOsmWebsite(url = "") {
  const host = normalizeHost(url);
  if (!host) return false;
  return BLOCKED_WEBSITE_HOSTS.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
}

function buildLocation(tags) {
  return normalizeWhitespace(
    tags["addr:city"] ||
      tags["addr:town"] ||
      tags["addr:village"] ||
      tags["addr:suburb"] ||
      tags["addr:place"] ||
      tags["is_in:city"] ||
      ""
  );
}

function buildStreetAddress(tags) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:postcode"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
  ].filter(Boolean);

  return normalizeWhitespace(parts.join(" "));
}

function buildConfidence(tags) {
  let score = 0.66;
  if (tags.email || tags["contact:email"]) score += 0.08;
  if (tags.facebook || tags["contact:facebook"]) score += 0.05;
  if (tags.image) score += 0.05;
  if (buildLocation(tags)) score += 0.06;
  if (tags.denomination) score += 0.03;
  return Number(Math.min(0.9, score).toFixed(2));
}

function buildChurchUrl(element) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

function buildTiles(countryConfig) {
  const [south, west, north, east] = countryConfig.bbox;
  const latStep = (north - south) / countryConfig.rows;
  const lonStep = (east - west) / countryConfig.cols;
  const tiles = [];

  for (let row = 0; row < countryConfig.rows; row += 1) {
    for (let col = 0; col < countryConfig.cols; col += 1) {
      const tileSouth = south + row * latStep;
      const tileNorth = row === countryConfig.rows - 1 ? north : south + (row + 1) * latStep;
      const tileWest = west + col * lonStep;
      const tileEast = col === countryConfig.cols - 1 ? east : west + (col + 1) * lonStep;
      tiles.push([
        Number(tileSouth.toFixed(4)),
        Number(tileWest.toFixed(4)),
        Number(tileNorth.toFixed(4)),
        Number(tileEast.toFixed(4)),
      ]);
    }
  }

  return tiles;
}

function createEnrichmentSeed(slug, tags, website) {
  const seed = {
    church_slug: slug,
    ...(website ? { website_url: website } : {}),
  };

  const email = normalizeWhitespace(tags.email || tags["contact:email"] || "");
  const facebookUrl = normalizeUrl(tags.facebook || tags["contact:facebook"] || tags["contact:social:facebook"] || "");
  const instagramUrl = normalizeUrl(tags.instagram || tags["contact:instagram"] || tags["contact:social:instagram"] || "");
  const youtubeUrl = normalizeUrl(tags.youtube || tags["contact:youtube"] || tags["contact:social:youtube"] || "");
  const imageUrl = normalizeImageUrl(tags.image || "");
  const streetAddress = buildStreetAddress(tags);

  if (email) seed.contact_email = email;
  if (facebookUrl) seed.facebook_url = facebookUrl;
  if (instagramUrl) seed.instagram_url = instagramUrl;
  if (youtubeUrl) seed.youtube_url = youtubeUrl;
  if (imageUrl) seed.cover_image_url = imageUrl;
  if (streetAddress) seed.street_address = streetAddress;

  return seed;
}

async function upsertChurches(supabase, rows) {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("churches")
      .upsert(batch, { onConflict: "slug" });

    if (error) {
      throw new Error(`Failed to import churches: ${error.message}`);
    }
  }
}

async function upsertEnrichmentSeeds(supabase, rows) {
  const filtered = rows.filter((row) => row.website_url || row.contact_email || row.facebook_url || row.instagram_url || row.youtube_url || row.cover_image_url || row.street_address);

  for (const batch of chunk(filtered, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("church_enrichments")
      .upsert(batch, { onConflict: "church_slug" });

    if (error) {
      throw new Error(`Failed to seed enrichments: ${error.message}`);
    }
  }
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

  const existingChurches = await loadAllChurchRows(supabase);
  const churchIndex = createChurchIndex();
  const usedSlugs = new Set(existingChurches.map((row) => row.slug).filter(Boolean));

  for (const church of existingChurches) {
    addChurchToIndex(churchIndex, church);
  }

  const prepared = [];
  const enrichmentSeeds = [];
  const stats = {
    fetched: 0,
    skippedMissingName: 0,
    skippedMissingWebsite: 0,
    skippedDuplicate: 0,
    prepared: 0,
  };
  const byCountry = {};

  for (const isoCode of options.countries) {
    if (options.limit > 0 && prepared.length >= options.limit) break;

    const countryConfig = COUNTRY_BY_ISO.get(isoCode);
    if (!countryConfig) continue;

    console.log(`Fetching OSM churches for ${countryConfig.name} (${isoCode})...`);

    for (const tile of buildTiles(countryConfig)) {
      if (options.limit > 0 && prepared.length >= options.limit) break;

      const payload = await fetchOverpassJson(buildOverpassQuery(isoCode, tile));
      const elements = Array.isArray(payload.elements) ? payload.elements : [];
      stats.fetched += elements.length;

      for (const element of elements) {
        if (options.limit > 0 && prepared.length >= options.limit) break;

        const tags = element.tags || {};
        const name = normalizeWhitespace(tags.name || "");
        const website = normalizeUrl(tags.website || tags["contact:website"] || "");
        const location = buildLocation(tags);

        if (!name) {
          stats.skippedMissingName += 1;
          continue;
        }

        if (!isOfficialWebsiteUrl(website) || isBlockedOsmWebsite(website)) {
          stats.skippedMissingWebsite += 1;
          continue;
        }

        const duplicate = findChurchDuplicate(churchIndex, {
          name,
          country: countryConfig.name,
          location,
          website,
        });

        if (duplicate) {
          stats.skippedDuplicate += 1;
          continue;
        }

        const slug = createUniqueSlug(name, location, countryConfig.name, usedSlugs);
        const reason = `osm-import: ${countryConfig.name} | ${buildChurchUrl(element)}`;
        const row = {
          slug,
          name,
          description: `Discover worship music and playlists from ${name}. Based in ${countryConfig.name}.`,
          country: countryConfig.name,
          location: location || null,
          denomination: normalizeWhitespace(tags.denomination || "") || null,
          founded: null,
          website: toSiteRoot(website),
          email: normalizeWhitespace(tags.email || tags["contact:email"] || "") || null,
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
          candidate_id: null,
          confidence: buildConfidence(tags),
          reason,
          discovery_source: "google-search",
          discovered_at: new Date().toISOString(),
          spotify_owner_id: null,
          last_researched: null,
          verified_at: null,
        };

        prepared.push(row);
        enrichmentSeeds.push(createEnrichmentSeed(slug, tags, toSiteRoot(website)));
        addChurchToIndex(churchIndex, row);
        stats.prepared += 1;
        byCountry[countryConfig.name] = (byCountry[countryConfig.name] || 0) + 1;
      }
    }
  }

  const sortedCountries = Object.entries(byCountry).sort((left, right) => right[1] - left[1]);
  console.log(JSON.stringify({
    fetched: stats.fetched,
    prepared: stats.prepared,
    skippedMissingName: stats.skippedMissingName,
    skippedMissingWebsite: stats.skippedMissingWebsite,
    skippedDuplicate: stats.skippedDuplicate,
    topCountries: sortedCountries,
  }, null, 2));

  if (prepared.length > 0) {
    console.log("Sample:");
    for (const row of prepared.slice(0, 12)) {
      console.log(`  ${row.slug} | ${row.name} | ${row.country} | ${row.location || "-"} | ${row.website}`);
    }
  }

  if (options.preview) {
    return;
  }

  await upsertChurches(supabase, prepared);
  await upsertEnrichmentSeeds(supabase, enrichmentSeeds);
  console.log(`Imported ${prepared.length} OSM churches and seeded ${enrichmentSeeds.length} enrichments.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
