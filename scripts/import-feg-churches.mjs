#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  addChurchToIndex,
  createChurchIndex,
  decodeHtml,
  findChurchDuplicate,
  isOfficialWebsiteUrl,
  normalizeWhitespace,
  slugifyName,
  toSiteRoot,
} from "./lib/church-intake-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const DIRECTORY_URL = "https://feg.de/gemeinden/";
const DIRECTORY_REASON = `directory-import: FeG Deutschland | ${DIRECTORY_URL}`;
const UPSERT_BATCH_SIZE = 100;

function parseArgs(argv) {
  const options = { preview: false, limit: 0, approve: false };
  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg === "--approve") options.approve = true;
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
  }
  return options;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractLocationsJson(html) {
  const match = html.match(/data-locations="([\s\S]*?)"\s*(?:data-|>)/);
  if (!match) throw new Error("Could not locate data-locations attribute on feg.de/gemeinden/");
  const jsonText = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#039;/g, "'");
  return JSON.parse(jsonText);
}

function parsePostalCityFromAddress(address = "") {
  const match = String(address).match(/(\d{4,5})\s+([^,]+)$/);
  if (!match) return { postalCode: "", city: normalizeWhitespace(address) };
  return { postalCode: match[1].trim(), city: normalizeWhitespace(match[2]) };
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "http://" || trimmed === "https://") return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function cleanName(raw = "") {
  return normalizeWhitespace(decodeHtml(raw));
}

function buildConfidence(entry, website) {
  let score = 0.55;
  if (website) score += 0.15;
  if (entry.location?.lat && entry.location?.lng) score += 0.08;
  if (entry.location?.address?.match(/\d+/)) score += 0.05;
  if (/Gründungsinitiative|Projekt/i.test(entry.name)) score -= 0.1;
  return Number(Math.max(0.35, Math.min(0.9, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName([name, city].filter(Boolean).join(" ")),
    slugifyName([name, "germany"].filter(Boolean).join(" ")),
  ].filter(Boolean);
  for (const attempt of attempts) {
    if (!usedSlugs.has(attempt)) {
      usedSlugs.add(attempt);
      return attempt;
    }
  }
  let suffix = 2;
  const base = slugifyName(name);
  while (usedSlugs.has(`${base}-${suffix}`)) suffix += 1;
  const slug = `${base}-${suffix}`;
  usedSlugs.add(slug);
  return slug;
}

function prepareChurchValue(column, value) {
  if (value === undefined) return undefined;
  if (["spotify_playlists", "youtube_videos"].includes(column) && value !== null) {
    return JSON.stringify(value);
  }
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
  const entries = Object.entries(row).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const columns = entries.map(([column]) => column);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values = entries.map(([column, value]) => prepareValue(column, value));
  const updates = columns
    .filter((column) => column !== conflictColumn)
    .map((column) => `${column} = EXCLUDED.${column}`);
  if (!columns.includes("updated_at")) updates.push("updated_at = NOW()");
  await sql.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
     ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updates.join(", ")}`,
    values,
  );
}

async function loadAllChurchRows(sql) {
  return sql`
    SELECT slug, name, country, location, website, status, reason, youtube_channel_id
    FROM churches
  `;
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
            console.log("Falling back to discovery_source=google-search (DB check constraint).");
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

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  console.log(`Fetching FeG directory from ${DIRECTORY_URL}...`);
  const html = await fetchHtml(DIRECTORY_URL);
  const rawEntries = extractLocationsJson(html);
  console.log(`Parsed ${rawEntries.length} entries from data-locations.`);

  const entries = options.limit > 0 ? rawEntries.slice(0, options.limit) : rawEntries;

  const existingRows = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const usedSlugs = new Set(existingRows.map((row) => row.slug));
  for (const row of existingRows) addChurchToIndex(index, row);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const entry of entries) {
    const name = cleanName(entry.name);
    if (!name) continue;
    const website = cleanWebsite(entry.website);
    const address = normalizeWhitespace(entry.location?.address || "");
    const { city } = parsePostalCityFromAddress(address);
    const latitude = entry.location?.lat ? Number(entry.location.lat) : null;
    const longitude = entry.location?.lng ? Number(entry.location.lng) : null;

    const duplicate = findChurchDuplicate(index, {
      name,
      country: "Germany",
      location: city || "",
      website: website || "",
    });

    const slug = duplicate?.slug || createUniqueSlug(name, city, usedSlugs);
    touched.add(slug);

    const confidence = buildConfidence(entry, website);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(address ? { street_address: address } : {}),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {}),
      denomination_network: "Bund Freier evangelischer Gemeinden",
      confidence,
      last_enriched_at: new Date().toISOString(),
    });

    if (duplicate) {
      deduped += 1;
      continue;
    }

    const now = new Date().toISOString();
    const churchRow = {
      slug,
      name,
      description: "",
      country: "Germany",
      location: city || null,
      denomination: "Freie evangelische Gemeinde",
      founded: null,
      website: website || null,
      email: null,
      language: "de",
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
      reason: `${DIRECTORY_REASON} | ${entry.url || ""}`.trim(),
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    };

    inserts.push(churchRow);
    addChurchToIndex(index, churchRow);
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}, touched=${touched.size}`);
  console.log(JSON.stringify(
    inserts.slice(0, 8).map((row) => ({
      slug: row.slug,
      name: row.name,
      location: row.location,
      website: row.website,
      confidence: row.confidence,
    })),
    null,
    2,
  ));

  if (options.preview) {
    console.log("Preview mode: nothing written.");
    return;
  }

  if (inserts.length > 0) await upsertChurches(sql, inserts);
  await upsertEnrichmentSeeds(sql, enrichmentSeeds);
  console.log(`Imported ${inserts.length} churches and seeded ${enrichmentSeeds.length} enrichment rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
