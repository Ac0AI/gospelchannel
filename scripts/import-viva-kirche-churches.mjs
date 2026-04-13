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

const DIRECTORY_URL = "https://www.vivakirche.ch/kirchen/";
const DIRECTORY_REASON = `directory-import: Viva Kirche Schweiz | ${DIRECTORY_URL}`;
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

function extractKirchenJson(html) {
  const match = html.match(/const\s+kirchen\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error("Could not locate `const kirchen = [...]` on vivakirche.ch/kirchen/");
  return JSON.parse(match[1]);
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function buildEmail(entry) {
  const name = String(entry.MailName || "").trim().toLowerCase();
  const domain = String(entry.MailDomain || "").trim().toLowerCase();
  if (!name || !domain) return "";
  if (!/^[a-z0-9._-]+$/.test(name)) return "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return "";
  return `${name}@${domain}`;
}

function detectLanguage(entry) {
  const canton = String(entry.classes || "").toLowerCase();
  const french = ["ge", "vd", "ne", "ju", "fr"];
  const italian = ["ti"];
  if (french.some((c) => canton.includes(c))) return "fr";
  if (italian.some((c) => canton.includes(c))) return "it";
  return "de";
}

function buildAddress(entry) {
  const parts = [];
  if (entry.Street) parts.push(String(entry.Street).trim());
  const locality = [entry.PLZready, entry.Place].filter(Boolean).join(" ").trim();
  if (locality) parts.push(locality);
  return parts.join(", ");
}

function buildServiceTimes(entry) {
  const raw = normalizeWhitespace(decodeHtml(entry.Service || ""));
  if (!raw) return null;
  return [{ label: raw, source: "vivakirche.ch" }];
}

function buildConfidence(entry, website, email) {
  let score = 0.6;
  if (website) score += 0.12;
  if (email) score += 0.08;
  if (entry.ContactPhone) score += 0.05;
  if (entry.lat && entry.lng) score += 0.05;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName([name, city].filter(Boolean).join(" ")),
    slugifyName([name, "schweiz"].filter(Boolean).join(" ")),
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

  console.log(`Fetching Viva Kirche directory from ${DIRECTORY_URL}...`);
  const html = await fetchHtml(DIRECTORY_URL);
  const rawEntries = extractKirchenJson(html);
  console.log(`Parsed ${rawEntries.length} entries from kirchen JSON.`);

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
    const name = normalizeWhitespace(decodeHtml(entry.Name || ""));
    if (!name) continue;

    const website = cleanWebsite(entry.Website);
    const email = buildEmail(entry);
    const phone = normalizeWhitespace(entry.ContactPhone || "");
    const address = buildAddress(entry);
    const city = normalizeWhitespace(entry.Place || "");
    const latitude = entry.lat ? Number(entry.lat) : null;
    const longitude = entry.lng ? Number(entry.lng) : null;
    const language = detectLanguage(entry);
    const serviceTimes = buildServiceTimes(entry);

    const duplicate = findChurchDuplicate(index, {
      name,
      country: "Switzerland",
      location: city || "",
      website: website || "",
    });

    const slug = duplicate?.slug || createUniqueSlug(name, city, usedSlugs);
    touched.add(slug);

    const confidence = buildConfidence(entry, website, email);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(address ? { street_address: address } : {}),
      ...(email ? { contact_email: email } : {}),
      ...(phone ? { phone } : {}),
      ...(serviceTimes ? { service_times: serviceTimes } : {}),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {}),
      denomination_network: "Viva Kirche Schweiz",
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
      country: "Switzerland",
      location: city || null,
      denomination: "Viva Kirche",
      founded: null,
      website: website || null,
      email: email || null,
      language,
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
      reason: DIRECTORY_REASON,
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
      email: row.email,
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
