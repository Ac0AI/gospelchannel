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

const ENDPOINT = "https://www.assembleedidio.org/wp-admin/admin-ajax.php";
const DIRECTORY_REASON = `directory-import: ADI Italy | https://www.assembleedidio.org/dove-siamo/`;
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

async function fetchAdiAssemblies() {
  // One POST, big radius, returns the entire national list.
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
      Referer: "https://www.assembleedidio.org/dove-siamo/",
    },
    body: "action=get_chiese&lat=42.5&lng=12.5&radius=2000",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

// Italian service-time strings look like:
//   "Mar. ore 20.30 - Giov. ore 20.30 - Dom. ore 10.15"
// Split on dash and tag each entry.
function parseServiceTimes(descrizione) {
  if (!descrizione) return null;
  const parts = String(descrizione)
    .split(/\s+-\s+/)
    .map((s) => normalizeWhitespace(s))
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.map((label) => ({ label, source: "assembleedidio.org" }));
}

function buildAddress(entry) {
  const street = normalizeWhitespace(entry.indirizzo || "");
  const city = normalizeWhitespace(entry.citta || "");
  const province = normalizeWhitespace(entry.provincia || "");
  const region = normalizeWhitespace(entry.regione || "");
  const cityProvince = [city, province ? `(${province})` : ""].filter(Boolean).join(" ");
  return [street, cityProvince, region].filter(Boolean).join(", ");
}

function buildConfidence(entry, website) {
  let score = 0.7;
  if (website) score += 0.1;
  if (entry.lat && entry.lng) score += 0.05;
  if (entry.descrizione) score += 0.03;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(`ADI ${name}`),
    slugifyName(`ADI ${name} ${city}`),
    slugifyName(`Assemblea di Dio ${name}`),
  ].filter(Boolean);
  for (const a of attempts) {
    if (!usedSlugs.has(a)) {
      usedSlugs.add(a);
      return a;
    }
  }
  let suffix = 2;
  const base = slugifyName(`ADI ${name}`);
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

// Existing Italian churches whose names include "ADI" but use generic
// formatting ("Chiesa Cristiana Evangelica ADI", "Chiesa Evangelica ADI
// Vomero"). The token-set dedupe in church-intake-utils misses these
// because after stopword stripping there's only one shared token. Build
// a side index keyed on normalized district + city.
function normalizeDistrictKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function loadExistingAdiByDistrict(sql) {
  const rows = await sql`
    SELECT slug, name, location FROM churches
    WHERE country = 'Italy' AND name ILIKE '%adi%'
  `;
  const byKey = new Map();
  for (const row of rows) {
    // Pull every word from name + location, drop stopwords, key on each token.
    const stop = new Set([
      "chiesa", "cristiana", "evangelica", "evangelico", "adi",
      "assemblea", "assemblee", "di", "dio", "il", "la", "le", "del", "della",
    ]);
    const words = normalizeDistrictKey(`${row.name} ${row.location || ""}`)
      .split(" ")
      .filter((w) => w && !stop.has(w));
    for (const w of words) {
      if (w.length < 4) continue;
      if (!byKey.has(w)) byKey.set(w, []);
      byKey.get(w).push(row);
    }
  }
  return byKey;
}

function findAdiDuplicate(adiIndex, baseName, city) {
  const stop = new Set([
    "napoli", "milano", "roma", "torino", "firenze", "venezia", "bologna",
    "napoli", "via", "viale", "piazza",
  ]);
  // Pull distinguishing tokens from the new entry's name + city.
  const tokens = normalizeDistrictKey(`${baseName} ${city}`)
    .split(" ")
    .filter((w) => w && w.length >= 4 && !stop.has(w));
  // Score candidates: a candidate that contains MULTIPLE distinguishing
  // tokens is much more likely a real duplicate.
  const candidates = new Map();
  for (const token of tokens) {
    const matches = adiIndex.get(token) || [];
    for (const m of matches) {
      candidates.set(m.slug, (candidates.get(m.slug) || 0) + 1);
    }
  }
  let best = null;
  let bestScore = 0;
  for (const [slug, score] of candidates) {
    if (score > bestScore) { bestScore = score; best = slug; }
  }
  if (best && bestScore >= 1) return { slug: best };
  return null;
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

  console.log(`Fetching ADI Italy assemblies...`);
  const raw = await fetchAdiAssemblies();
  console.log(`Got ${raw.length} ADI assemblies.`);

  // Pre-archive: any existing generic Italy ADI entry whose name lacks a
  // distinguishing district token. These are superseded by the feed's
  // specific entries (e.g. "Napoli (Vomero)" replaces "Chiesa Evangelica
  // ADI" without district). The feed-sourced entries are canonical.
  if (!options.preview) {
    const generics = await sql`
      SELECT slug, name, location FROM churches
      WHERE country = 'Italy'
        AND status = 'approved'
        AND name ILIKE '%adi%'
        AND name NOT ILIKE '%(%'
        AND name NOT ILIKE '%vomero%'
    `;
    if (generics.length > 0) {
      console.log(`Archiving ${generics.length} generic Italy-ADI entries (superseded by feed):`);
      for (const g of generics) {
        console.log(`  - ${g.slug} | ${g.name} | ${g.location}`);
        await sql`UPDATE churches SET status = 'archived', updated_at = NOW(), reason = COALESCE(reason, '') || ' | superseded by ADI directory import' WHERE slug = ${g.slug}`;
      }
    }
  }

  const entries = options.limit > 0 ? raw.slice(0, options.limit) : raw;

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const adiIndex = await loadExistingAdiByDistrict(sql);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);
  console.log(`Existing ADI district keys loaded: ${adiIndex.size}`);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const entry of entries) {
    const baseName = normalizeWhitespace(decodeHtml(entry.nome || ""));
    if (!baseName) continue;
    const displayName = `Assemblea di Dio ${baseName}`;
    const website = cleanWebsite(entry.sito);
    const city = normalizeWhitespace(entry.citta || baseName);
    const address = buildAddress(entry);
    const latitude = entry.lat ? Number(entry.lat) : null;
    const longitude = entry.lng ? Number(entry.lng) : null;
    const serviceTimes = parseServiceTimes(entry.descrizione);
    const province = normalizeWhitespace(entry.provincia || "");
    const region = normalizeWhitespace(entry.regione || "");
    const confidence = buildConfidence(entry, website);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: "Italy",
        location: city,
      }) ||
      findChurchDuplicate(index, {
        name: displayName,
        country: "Italy",
        location: city || "",
        website: website || "",
      }) ||
      findAdiDuplicate(adiIndex, baseName, city);

    const slug = duplicate?.slug || createUniqueSlug(baseName, city, usedSlugs);
    touched.add(slug);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(address ? { street_address: address } : {}),
      ...(serviceTimes ? { service_times: serviceTimes } : {}),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {}),
      denomination_network: "Assemblee di Dio in Italia",
      confidence,
      sources: { adi_italy: { id: entry.id, region, province, scraped_at: new Date().toISOString() } },
      last_enriched_at: new Date().toISOString(),
    });

    if (duplicate) {
      deduped += 1;
      continue;
    }

    const now = new Date().toISOString();
    inserts.push({
      slug,
      name: displayName,
      description: "",
      country: "Italy",
      location: city || null,
      denomination: "Pentecostal",
      founded: null,
      website: website || null,
      email: null,
      language: "it",
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
      aliases: baseName !== displayName ? [baseName] : null,
      source_kind: "discovered",
      status: options.approve ? "approved" : "pending",
      confidence,
      reason: `${DIRECTORY_REASON} | id=${entry.id}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name: displayName, country: "Italy", location: city || null, website: website || null });
    addHostLocationEntry(hostIndex, { website, slug, location: city, country: "Italy" });
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}, touched=${touched.size}`);
  console.log(JSON.stringify(
    inserts.slice(0, 5).map((r) => ({
      slug: r.slug,
      name: r.name,
      location: r.location,
      website: r.website,
      confidence: r.confidence,
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
