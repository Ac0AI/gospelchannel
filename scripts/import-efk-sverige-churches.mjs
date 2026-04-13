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
import { mapWithConcurrency } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const LIST_URL = "https://efk.se/forsamlingar-i-sverige/forsamlingar-i-efk.html";
const DIRECTORY_REASON = `directory-import: EFK Sverige | ${LIST_URL}`;
const UPSERT_BATCH_SIZE = 100;
const MAX_PAGES = 30;
const DETAIL_CONCURRENCY = 6;

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

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function collectAllSlugs() {
  const slugs = new Set();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${LIST_URL}?lp-page=${page}`;
    const html = await fetchText(url);
    const matches = [...html.matchAll(/href="(\/forsamlingar-i-sverige\/forsamlingar-i-efk\/forsamlingar\/[^"]+\.html)"/g)];
    if (matches.length === 0) break;
    for (const m of matches) slugs.add(m[1]);
  }
  return [...slugs];
}

function parseDetail(html) {
  const match = html.match(/<pre[^>]*>\s*(\{[\s\S]*?\})\s*<\/pre>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function pickEmail(data) {
  const emails = Array.isArray(data.emails) ? data.emails : [];
  const work = emails.find((e) => e && e.type === "email_work");
  if (work?.address) return String(work.address).trim();
  const any = emails.find((e) => e && e.address);
  return any ? String(any.address).trim() : normalizeWhitespace(data.epost || "");
}

function pickPhone(data) {
  const phones = Array.isArray(data.phones) ? data.phones : [];
  const work = phones.find((p) => p && p.type === "phone_work");
  if (work?.phoneNumber) return String(work.phoneNumber).trim();
  const any = phones.find((p) => p && p.phoneNumber);
  return any ? String(any.phoneNumber).trim() : normalizeWhitespace(data.telefon || "");
}

function pickAddress(data) {
  const addresses = Array.isArray(data.addresses) ? data.addresses : [];
  const visit = addresses.find((a) => a && a.type === "address_visit");
  const chosen = visit || addresses.find((a) => a && a.addressMain) || null;
  if (chosen) {
    const parts = [chosen.addressMain, [chosen.postalCode, chosen.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    return parts;
  }
  const fallback = [data.postadr1, data.postadr2, data.postadr3].filter(Boolean).join(", ");
  return normalizeWhitespace(fallback);
}

function pickCity(data) {
  const coords = data._coordinates || data.coordinates;
  if (coords?.city) return String(coords.city).trim();
  const addresses = Array.isArray(data.addresses) ? data.addresses : [];
  const first = addresses.find((a) => a && a.city);
  if (first?.city) return String(first.city).trim();
  return normalizeWhitespace(data.ort || "");
}

function buildConfidence(data, website, email) {
  let score = 0.65;
  if (website) score += 0.12;
  if (email) score += 0.05;
  const coords = data._coordinates || data.coordinates;
  if (coords?.latitude && coords?.longitude) score += 0.05;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName(`${name} ${city}`),
    slugifyName(`${name} efk`),
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

  console.log("Collecting EFK church slugs from paginated list...");
  const paths = await collectAllSlugs();
  console.log(`Collected ${paths.length} detail paths.`);

  const limited = options.limit > 0 ? paths.slice(0, options.limit) : paths;

  console.log(`Fetching ${limited.length} detail pages (concurrency ${DETAIL_CONCURRENCY})...`);
  const detailResults = await mapWithConcurrency(limited, DETAIL_CONCURRENCY, async (path) => {
    try {
      const html = await fetchText(`https://efk.se${path}`, 15000);
      const data = parseDetail(html);
      return data ? { path, data } : null;
    } catch {
      return null;
    }
  });
  const parsed = detailResults.filter((r) => r.ok && r.value).map((r) => r.value);
  console.log(`Parsed ${parsed.length} detail JSON blobs.`);

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const { data } of parsed) {
    const name = normalizeWhitespace(decodeHtml(data.name || data.namn || ""));
    if (!name) continue;
    const website = cleanWebsite(data.website || data.webb);
    const email = pickEmail(data);
    const phone = pickPhone(data);
    const address = pickAddress(data);
    const city = pickCity(data);
    const coords = data._coordinates || data.coordinates;
    const latitude = coords?.latitude ? Number(coords.latitude) : (data.latitude ? Number(data.latitude) : null);
    const longitude = coords?.longitude ? Number(coords.longitude) : (data.longitude ? Number(data.longitude) : null);

    const confidence = buildConfidence(data, website, email);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: "Sweden",
        location: city,
      }) ||
      findChurchDuplicate(index, {
        name,
        country: "Sweden",
        location: city || "",
        website: website || "",
      });

    const slug = duplicate?.slug || createUniqueSlug(name, city, usedSlugs);
    touched.add(slug);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(address ? { street_address: address } : {}),
      ...(email ? { contact_email: email } : {}),
      ...(phone ? { phone } : {}),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {}),
      denomination_network: "Evangeliska Frikyrkan",
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
      country: "Sweden",
      location: city || null,
      denomination: "Evangelical Free",
      founded: null,
      website: website || null,
      email: email || null,
      language: "sv",
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
    });
    addChurchToIndex(index, { slug, name, country: "Sweden", location: city || null, website: website || null });
    addHostLocationEntry(hostIndex, { website, slug, location: city, country: "Sweden" });
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}, touched=${touched.size}`);
  console.log(JSON.stringify(
    inserts.slice(0, 5).map((r) => ({ slug: r.slug, name: r.name, location: r.location, website: r.website, confidence: r.confidence })),
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
