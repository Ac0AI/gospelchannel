#!/usr/bin/env node

// Import Assembleia de Deus congregations from Brazilian state-convention
// directories. AD has no single national list — each convention (IEADPE,
// IEADERN, ...) publishes its own. Pass --convention=<key> to pick a source
// (see scripts/lib/ad-brazil-sources.mjs). Built on the FEREDE Spain template:
// name + city, no website / lat-lng (geocoded later). Idempotent (upsert on
// slug). Always dry-run with --preview first; nothing is written to the live
// DB until a sample has been reviewed.

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
  buildHostLocationIndex,
  findHostLocationDuplicate,
} from "./lib/directory-dedupe.mjs";
import { SOURCES } from "./lib/ad-brazil-sources.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const UPSERT_BATCH_SIZE = 100;

// Non-Christian / off-brand name guard (per brand-positioning). AD is
// unambiguously Pentecostal so hits should be zero, but the guard stays on so
// a stray POI can never slip in through a future source.
const BRAND_DENY = /gurdwara|mosque|masjid|synagogue|sikh|buddhis|hindu|mandir|scientolog|umbanda|candombl[eé]|espirita|kardec/i;

function parseArgs(argv) {
  const options = { convention: "", preview: false, limit: 0, approve: false };
  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg === "--approve") options.approve = true;
    else if (arg.startsWith("--convention=")) options.convention = arg.split("=")[1].trim();
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
  }
  return options;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildConfidence({ street, phone }) {
  let score = 0.45;
  if (street) score += 0.05;
  if (phone) score += 0.03;
  return Number(Math.max(0.35, Math.min(0.7, score)).toFixed(2));
}

function createUniqueSlug(name, city, keyedSeed, usedSlugs) {
  const attempts = [
    keyedSeed ? slugifyName(keyedSeed) : "",
    slugifyName(`${name} ${city}`),
    slugifyName(name),
    slugifyName(`${name} brazil`),
  ].filter(Boolean);
  for (const a of attempts) {
    if (!usedSlugs.has(a)) {
      usedSlugs.add(a);
      return a;
    }
  }
  let suffix = 2;
  const base = slugifyName(`${name} ${city}`) || slugifyName(name);
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

async function loadAllChurchRows(sql) {
  return sql`SELECT slug, name, country, location, website FROM churches`;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  const source = SOURCES[options.convention];
  if (!source) {
    throw new Error(
      `Unknown --convention=${options.convention || "(none)"}. Known: ${Object.keys(SOURCES).join(", ")}`,
    );
  }
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  console.log(`Fetching ${source.network} (${source.baseUrl})...`);
  const raw = await source.fetchAll(options.limit);
  let records = source.parseCongregations(raw);
  console.log(`Parsed ${records.length} congregations.`);

  // Brand guard.
  const before = records.length;
  const dropped = records.filter((r) => BRAND_DENY.test(r.name));
  records = records.filter((r) => !BRAND_DENY.test(r.name));
  if (dropped.length) {
    console.log(`Brand guard dropped ${before - records.length}: ${dropped.map((d) => d.name).join("; ")}`);
  }
  if (options.limit > 0) records = records.slice(0, options.limit);

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const c of records) {
    const name = c.name;
    if (!name) continue;
    const city = c.city || "";
    const state = c.state || source.state || "";
    const street = c.street || "";
    const bairro = c.bairro || "";
    const phone = c.phone || "";
    const address = [street, bairro, [city, state].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
    const confidence = buildConfidence({ street, phone });

    const duplicate =
      findHostLocationDuplicate(hostIndex, { website: "", country: "Brazil", location: city }) ||
      findChurchDuplicate(index, { name, country: "Brazil", location: city, website: "" });

    const seed = `${source.key} ${c.sector || ""} ${name} ${city}`.trim();
    const slug = duplicate?.slug || createUniqueSlug(name, city, seed, usedSlugs);
    touched.add(slug);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(address ? { street_address: address } : {}),
      ...(phone ? { phone } : {}),
      denomination_network: source.network,
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
      country: "Brazil",
      location: city || null,
      denomination: "Pentecostal",
      founded: null,
      website: null,
      email: null,
      language: "pt",
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
      reason: `directory-import: AD Brazil ${source.key} | ${source.baseUrl}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name, country: "Brazil", location: city || null, website: null });
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}, touched=${touched.size}`);
  console.log(JSON.stringify(
    inserts.slice(0, 20).map((r) => ({ slug: r.slug, name: r.name, location: r.location, denomination: r.denomination })),
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
