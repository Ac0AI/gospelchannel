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

const GEMEINDEN_PAGE = "https://www.bfp.de/de/gemeinden-des-bfp";
const AJAX_BASE = "https://www.bfp.de/system/modules/anyStores/ajax/ajax.php";
const DIRECTORY_REASON = `directory-import: BFP | ${GEMEINDEN_PAGE}`;
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

async function fetchBfpStores() {
  // 1) Load landing page to obtain session + loadMap token
  const landingRes = await fetch(GEMEINDEN_PAGE, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
  });
  if (!landingRes.ok) throw new Error(`BFP landing HTTP ${landingRes.status}`);
  const landingHtml = await landingRes.text();
  const tokenMatch = landingHtml.match(/loadMap\((\d+),\s*'([a-f0-9]+)'\)/);
  if (!tokenMatch) throw new Error("Could not find loadMap() on BFP landing page");
  const moduleId = tokenMatch[1];
  const token = tokenMatch[2];
  // Capture cookies from landing response
  const setCookie = landingRes.headers.get("set-cookie") || "";
  const cookies = setCookie
    .split(/,(?=\s*[A-Za-z_-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  // 2) Fetch stores JSON with cookies + referer
  const url = `${AJAX_BASE}?module=${moduleId}&token=${token}`;
  const ajaxRes = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)",
      Referer: GEMEINDEN_PAGE,
      ...(cookies ? { Cookie: cookies } : {}),
      Accept: "application/json",
    },
  });
  if (!ajaxRes.ok) throw new Error(`BFP AJAX HTTP ${ajaxRes.status}`);
  const payload = await ajaxRes.json();
  if (!payload || !Array.isArray(payload.stores)) {
    throw new Error("Unexpected BFP AJAX payload");
  }
  return payload.stores;
}

function decodeObfuscatedEmail(raw) {
  if (!raw) return "";
  const decoded = String(raw).replace(/&#x([0-9a-fA-F]+);|&#(\d+);/g, (_, hex, dec) => {
    const code = hex ? parseInt(hex, 16) : Number(dec);
    return String.fromCharCode(code);
  });
  return decoded.trim();
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function buildConfidence(entry, website, email) {
  let score = 0.65;
  if (website) score += 0.12;
  if (email) score += 0.05;
  if (entry.phone) score += 0.03;
  if (entry.latitude && entry.longitude) score += 0.05;
  if (entry.freeField5) score += 0.02;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName(`${name} ${city}`),
    slugifyName(`${name} bfp`),
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

  console.log("Fetching BFP gemeinden via Contao AnyStores AJAX...");
  const stores = await fetchBfpStores();
  console.log(`Got ${stores.length} BFP stores.`);

  const entries = options.limit > 0 ? stores.slice(0, options.limit) : stores;

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const store of entries) {
    if (store.published && store.published !== "1" && store.published !== 1) continue;
    const name = normalizeWhitespace(decodeHtml(store.name || ""));
    if (!name) continue;

    const website = cleanWebsite(store.url);
    const email = decodeObfuscatedEmail(store.email);
    const phone = normalizeWhitespace(store.phone || "");
    const street = normalizeWhitespace(store.street || "");
    const city = normalizeWhitespace(store.city || "");
    const postal = normalizeWhitespace(store.postal || "");
    const address = [street, [postal, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const latitude = store.latitude != null ? Number(store.latitude) : null;
    const longitude = store.longitude != null ? Number(store.longitude) : null;
    const serviceTimeRaw = normalizeWhitespace(decodeHtml(store.freeField5 || ""));
    const pastor = normalizeWhitespace(decodeHtml(store.freeField6 || "")).replace(/\s*\(.*?\)$/, "");

    const entry = { phone, latitude, longitude, freeField5: serviceTimeRaw };
    const confidence = buildConfidence(entry, website, email);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: "Germany",
        location: city,
      }) ||
      findChurchDuplicate(index, {
        name,
        country: "Germany",
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
      ...(serviceTimeRaw ? { service_times: [{ label: serviceTimeRaw, source: "bfp.de" }] } : {}),
      ...(pastor ? { pastor_name: pastor } : {}),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {}),
      denomination_network: "Bund Freikirchlicher Pfingstgemeinden",
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
      country: "Germany",
      location: city || null,
      denomination: "Pentecostal",
      founded: null,
      website: website || null,
      email: email || null,
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
      reason: `${DIRECTORY_REASON} | id=${store.id}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name, country: "Germany", location: city || null, website: website || null });
    addHostLocationEntry(hostIndex, { website, slug, location: city, country: "Germany" });
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}, touched=${touched.size}`);
  console.log(JSON.stringify(
    inserts.slice(0, 5).map((r) => ({ slug: r.slug, name: r.name, location: r.location, website: r.website, email: r.email, confidence: r.confidence })),
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
