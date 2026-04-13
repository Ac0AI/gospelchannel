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

const DIRECTORY_URL = "https://www.feg.ch/besuchen/feg-standorte";
const DIRECTORY_REASON = `directory-import: FeG Schweiz | ${DIRECTORY_URL}`;
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

function decodeEmbeddedJsString(s) {
  return s
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;uuml;/g, "ü").replace(/&amp;auml;/g, "ä").replace(/&amp;ouml;/g, "ö")
    .replace(/&amp;Uuml;/g, "Ü").replace(/&amp;Auml;/g, "Ä").replace(/&amp;Ouml;/g, "Ö")
    .replace(/&uuml;/g, "ü").replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö")
    .replace(/&Uuml;/g, "Ü").replace(/&Auml;/g, "Ä").replace(/&Ouml;/g, "Ö")
    .replace(/&szlig;/g, "ß")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(html = "") {
  return normalizeWhitespace(html.replace(/<[^>]+>/g, " "));
}

function parseEntry(rawContent, lng, lat) {
  const content = decodeHtmlEntities(decodeEmbeddedJsString(rawContent));
  const nameMatch = content.match(/<b>([^<]+)<\/b>/);
  const name = nameMatch ? decodeHtml(nameMatch[1]).trim() : "";
  if (!name) return null;

  const firstParaMatch = content.match(/<p>[\s\S]*?<\/p>/);
  const firstPara = firstParaMatch ? firstParaMatch[0] : "";
  const addressLines = firstPara
    .replace(/<b>[^<]*<\/b>\s*<br\s*\/?>/i, "")
    .replace(/<\/?p>/g, "")
    .split(/<br\s*\/?>/i)
    .map((line) => stripTags(line))
    .filter(Boolean);

  let street = "";
  let postalCity = "";
  if (addressLines.length === 1) {
    postalCity = addressLines[0];
  } else if (addressLines.length >= 2) {
    street = addressLines[0];
    postalCity = addressLines[addressLines.length - 1];
  }
  const postalMatch = postalCity.match(/^(\d{4})\s+(.+)$/);
  const postalCode = postalMatch ? postalMatch[1] : "";
  const city = postalMatch ? postalMatch[2].trim() : postalCity;

  const websiteMatch = content.match(/href="(https?:\/\/[^"]+)"/);
  const website = websiteMatch ? websiteMatch[1] : "";

  const emailMatch = content.match(/mailto:([^"]+)/);
  const email = emailMatch ? emailMatch[1].trim() : "";

  const lastPara = [...content.matchAll(/<p>([\s\S]*?)<\/p>/g)].pop();
  const tail = lastPara ? stripTags(lastPara[1]) : "";
  const phoneMatch = tail.match(/(\+?\d[\d\s\-/()]{6,}\d)/);
  const phone = phoneMatch ? phoneMatch[1].trim() : "";

  const serviceTimeMatch = tail.match(/(Sonntag[^<]+)$/i) || tail.match(/(So\.\s+\d[^<]+)/i);
  const serviceTime = serviceTimeMatch ? serviceTimeMatch[1].trim() : "";

  return {
    name,
    street,
    postalCode,
    city,
    website,
    email,
    phone,
    serviceTime,
    address: [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    latitude: Number(lat),
    longitude: Number(lng),
  };
}

function extractStandorte(html) {
  const boxRe = /LpcOpenLayersInfoBox\(\{content:"((?:\\.|[^"\\])*)"/g;
  const coordRe = /fromLonLat\(\[([^\]]+)\]\)/g;
  const boxes = [...html.matchAll(boxRe)];
  const coords = [...html.matchAll(coordRe)];
  if (boxes.length !== coords.length) {
    console.warn(`Warning: ${boxes.length} popups but ${coords.length} coords`);
  }
  const n = Math.min(boxes.length, coords.length);
  const entries = [];
  for (let i = 0; i < n; i++) {
    const [lng, lat] = coords[i][1].split(",").map((s) => s.trim());
    const entry = parseEntry(boxes[i][1], lng, lat);
    if (entry) entries.push(entry);
  }
  return entries;
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
  let score = 0.6;
  if (website) score += 0.12;
  if (email) score += 0.08;
  if (entry.phone) score += 0.05;
  if (entry.latitude && entry.longitude) score += 0.05;
  if (entry.serviceTime) score += 0.03;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(`FeG ${name}`),
    slugifyName(`FeG ${name} ${city}`),
    slugifyName(`FeG Schweiz ${name}`),
  ].filter(Boolean);
  for (const a of attempts) {
    if (!usedSlugs.has(a)) {
      usedSlugs.add(a);
      return a;
    }
  }
  let suffix = 2;
  const base = slugifyName(`FeG ${name}`);
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

  console.log(`Fetching FEG Schweiz directory from ${DIRECTORY_URL}...`);
  const html = await fetchHtml(DIRECTORY_URL);
  const rawEntries = extractStandorte(html);
  console.log(`Parsed ${rawEntries.length} standorte.`);

  const entries = options.limit > 0 ? rawEntries.slice(0, options.limit) : rawEntries;

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const entry of entries) {
    const displayName = `FeG ${entry.name}`;
    const website = cleanWebsite(entry.website);
    const confidence = buildConfidence(entry, website, entry.email);

    const duplicate = findChurchDuplicate(index, {
      name: displayName,
      country: "Switzerland",
      location: entry.city || "",
      website: website || "",
    });

    const slug = duplicate?.slug || createUniqueSlug(entry.name, entry.city, usedSlugs);
    touched.add(slug);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(entry.address ? { street_address: entry.address } : {}),
      ...(entry.email ? { contact_email: entry.email } : {}),
      ...(entry.phone ? { phone: entry.phone } : {}),
      ...(entry.serviceTime ? { service_times: [{ label: entry.serviceTime, source: "feg.ch" }] } : {}),
      ...(Number.isFinite(entry.latitude) ? { latitude: entry.latitude } : {}),
      ...(Number.isFinite(entry.longitude) ? { longitude: entry.longitude } : {}),
      denomination_network: "Bund Freier Evangelischer Gemeinden Schweiz",
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
      name: displayName,
      description: "",
      country: "Switzerland",
      location: entry.city || null,
      denomination: "Freie Evangelische Gemeinde",
      founded: null,
      website: website || null,
      email: entry.email || null,
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
      reason: DIRECTORY_REASON,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name: displayName, country: "Switzerland", location: entry.city || null, website: website || null });
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
