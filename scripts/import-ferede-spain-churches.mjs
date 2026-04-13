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
import {
  addHostLocationEntry,
  buildHostLocationIndex,
  findHostLocationDuplicate,
} from "./lib/directory-dedupe.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const API_BASE = "https://ferede.es/directorio/wp-json/wp/v2/directorio";
const CATEGORY_CHURCHES = 4;
const DIRECTORY_REASON = `directory-import: FEREDE Spain | ${API_BASE}?categoria=${CATEGORY_CHURCHES}`;
const UPSERT_BATCH_SIZE = 100;
const PAGE_SIZE = 100;

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

async function fetchPage(page, perPage = PAGE_SIZE) {
  const url = `${API_BASE}?per_page=${perPage}&page=${page}&categoria=${CATEGORY_CHURCHES}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
  });
  if (res.status === 400 || res.status === 404) return { items: [], totalPages: null };
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
  const items = await res.json();
  const totalPages = Number(res.headers.get("x-wp-totalpages")) || null;
  return { items, totalPages };
}

async function fetchAllChurches(limit = 0) {
  const all = [];
  let totalPages = null;
  for (let page = 1; ; page += 1) {
    const { items, totalPages: tp } = await fetchPage(page);
    if (items.length === 0) break;
    totalPages = tp || totalPages;
    all.push(...items);
    if (limit > 0 && all.length >= limit) break;
    if (totalPages && page >= totalPages) break;
    if (page >= 60) break; // safety cap
  }
  return limit > 0 ? all.slice(0, limit) : all;
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function capitalize(s = "") {
  if (!s) return "";
  return String(s).replace(/\b([a-záéíóúñà-ÿ])/gi, (_, c, i) => (i === 0 ? c.toUpperCase() : c.toLowerCase()))
    .replace(/\s([a-záéíóúñà-ÿ])/gi, (_, c) => " " + c.toUpperCase());
}

function mapDenomination(afinidad = "") {
  const key = String(afinidad || "").toLowerCase().replace(/_\d+$/, "").trim();
  const map = {
    bautistas: "Baptist",
    bautista: "Baptist",
    pentecostales: "Pentecostal",
    pentecostal: "Pentecostal",
    evangelicos: "Evangelical",
    evangelicas: "Evangelical",
    adventistas: "Adventist",
    metodistas: "Methodist",
    presbiterianas: "Presbyterian",
    presbiterianos: "Presbyterian",
    anglicana: "Anglican",
    anglicanas: "Anglican",
    reformada: "Reformed",
    reformadas: "Reformed",
    carismaticas: "Charismatic",
    carismaticos: "Charismatic",
    nazarenos: "Nazarene",
  };
  return map[key] || "Evangelical";
}

function buildConfidence(entry, website, email) {
  let score = 0.5;
  if (website) score += 0.1;
  if (email) score += 0.05;
  if (entry.acf?.telefono) score += 0.03;
  if (entry.acf?.direccion_postal) score += 0.03;
  return Number(Math.max(0.35, Math.min(0.8, score)).toFixed(2));
}

function createUniqueSlug(name, city, fereSlug, usedSlugs) {
  const attempts = [
    fereSlug ? `ferede-${fereSlug}` : "",
    slugifyName(name),
    slugifyName(`${name} ${city}`),
    slugifyName(`${name} spain`),
  ].filter(Boolean);
  for (const a of attempts) {
    if (!usedSlugs.has(a)) {
      usedSlugs.add(a);
      return a;
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
  await sql.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
     ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updates.join(", ")}`,
    values,
  );
}

async function loadAllChurchRows(sql) {
  return sql`SELECT slug, name, country, location, website, status, reason, youtube_channel_id FROM churches`;
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

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  console.log(`Fetching FEREDE directorio category ${CATEGORY_CHURCHES}...`);
  const fetched = await fetchAllChurches(options.limit);
  console.log(`Fetched ${fetched.length} entries.`);

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const item of fetched) {
    const title = item.title?.rendered || "";
    const name = normalizeWhitespace(decodeHtml(title));
    if (!name) continue;
    const acf = item.acf || {};
    const website = ""; // FEREDE doesn't expose website
    const email = normalizeWhitespace(acf.email || "");
    const phone = normalizeWhitespace(acf.telefono || "");
    const street = normalizeWhitespace(acf.direccion_postal || "");
    const city = normalizeWhitespace(acf.poblacion || "");
    const cp = normalizeWhitespace(acf.codigo_postal || "");
    const province = capitalize(normalizeWhitespace(acf.provincia || ""));
    const address = [street, [cp, city].filter(Boolean).join(" "), province].filter(Boolean).join(", ");
    const denomination = mapDenomination(acf.afinidad_denominacional || "");

    const confidence = buildConfidence(item, website, email);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: "Spain",
        location: city,
      }) ||
      findChurchDuplicate(index, {
        name,
        country: "Spain",
        location: city || "",
        website: website || "",
      });

    const slug = duplicate?.slug || createUniqueSlug(name, city, item.slug, usedSlugs);
    touched.add(slug);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(address ? { street_address: address } : {}),
      ...(email ? { contact_email: email } : {}),
      ...(phone ? { phone } : {}),
      denomination_network: "FEREDE",
      confidence,
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
      description: "",
      country: "Spain",
      location: city || null,
      denomination,
      founded: null,
      website: null,
      email: email || null,
      language: "es",
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
      reason: `${DIRECTORY_REASON} | n_registro=${acf.n_registro || acf.id || item.id}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name, country: "Spain", location: city || null, website: null });
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}, touched=${touched.size}`);
  console.log(JSON.stringify(
    inserts.slice(0, 5).map((r) => ({ slug: r.slug, name: r.name, location: r.location, denomination: r.denomination, email: r.email, confidence: r.confidence })),
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
