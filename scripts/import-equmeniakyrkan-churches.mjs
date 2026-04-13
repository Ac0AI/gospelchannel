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

const BASE = "https://equmeniakyrkan.se";
const LIST_BASE = `${BASE}/congregation_organization/equmeniakyrkan`;
const DIRECTORY_REASON = `directory-import: Equmeniakyrkan | ${BASE}/forsamlingar/`;
const MAX_PAGES = 60;
const UPSERT_BATCH_SIZE = 100;
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

async function fetchText(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function collectAllSlugUrls() {
  const urls = new Set();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = page === 1 ? `${LIST_BASE}/` : `${LIST_BASE}/page/${page}/`;
    const html = await fetchText(url);
    if (!html) break;
    const matches = [...html.matchAll(/href="(https:\/\/equmeniakyrkan\.se\/forsamlingar\/[a-z0-9][^"]*?\/)"/g)];
    const pageUrls = [...new Set(matches.map((m) => m[1]).filter((u) => !u.includes("/page/")))];
    if (pageUrls.length === 0) break;
    for (const u of pageUrls) urls.add(u);
  }
  return [...urls];
}

function parseDetailHtml(html, url) {
  const titleMatch = html.match(/<h1 class="single-congregation-title">\s*([^<]+?)\s*<\/h1>/);
  const name = titleMatch ? normalizeWhitespace(decodeHtml(titleMatch[1])) : "";
  if (!name) return null;

  const region = html.match(/<a href="https:\/\/equmeniakyrkan\.se\/congregation_region\/[^"]*"[^>]*rel="tag"[^>]*>\s*([^<]+?)\s*<\/a>/)?.[1] || "";
  const email = html.match(/<dl class="grid-item email[^"]*">[\s\S]*?href="mailto:([^"]+)"/)?.[1] || "";
  const phone = html.match(/<dl class="grid-item phone[^"]*">[\s\S]*?href="tel:[^"]*"[\s\S]*?>\s*([^<]+?)\s*</)?.[1]?.trim() || "";
  const website = html.match(/<dl class="grid-item website[^"]*">[\s\S]*?href="(https?:\/\/[^"]+)"/)?.[1] || "";

  const postalDtMatch = html.match(/<dl class="grid-item postal-address[^"]*">[\s\S]*?<dd>([\s\S]*?)<\/dd>/);
  const postalRaw = postalDtMatch ? postalDtMatch[1] : "";
  const postalParts = postalRaw
    .replace(/<[^>]+>/g, "|")
    .split("|")
    .map((s) => normalizeWhitespace(s))
    .filter(Boolean);
  const street = postalParts[0] || "";
  const postalLine = postalParts[1] || "";
  const postalMatch = postalLine.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
  const postalCode = postalMatch ? postalMatch[1].replace(/\s/g, "") : "";
  let cityRaw = postalMatch ? postalMatch[2] : "";
  // Fallback: parse visiting-address "Street, City"
  if (!cityRaw) {
    const visitMatch = html.match(/<dl class="grid-item visiting-address[^"]*">[\s\S]*?<dd>([^<]+)<\/dd>/);
    if (visitMatch) {
      const parts = normalizeWhitespace(visitMatch[1]).split(",").map((s) => s.trim());
      if (parts.length >= 2) cityRaw = parts[parts.length - 1];
    }
  }
  if (cityRaw && cityRaw === cityRaw.toUpperCase()) {
    cityRaw = cityRaw.toLowerCase().replace(/(?:^|\s)([a-zà-ÿ])/g, (_, c) => " " + c.toUpperCase()).trim();
  }
  // Reject if city still looks like a street (contains digits)
  if (/\d/.test(cityRaw)) cityRaw = "";
  const city = cityRaw;

  const latMatch = html.match(/data-lat="([^"]+)"/);
  const lngMatch = html.match(/data-lng="([^"]+)"/);
  const latitude = latMatch ? Number(latMatch[1]) : null;
  const longitude = lngMatch ? Number(lngMatch[1]) : null;

  const address = [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return { name, region, email, phone, website, address, city, latitude, longitude, url };
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
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName(`${name} ${city}`),
    slugifyName(`${name} equmenia`),
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

  console.log("Collecting Equmeniakyrkan slugs from paginated taxonomy list...");
  const urls = await collectAllSlugUrls();
  console.log(`Collected ${urls.length} detail URLs.`);

  const limited = options.limit > 0 ? urls.slice(0, options.limit) : urls;

  console.log(`Fetching ${limited.length} detail pages (concurrency ${DETAIL_CONCURRENCY})...`);
  const detailResults = await mapWithConcurrency(limited, DETAIL_CONCURRENCY, async (url) => {
    try {
      const html = await fetchText(url, 15000);
      if (!html) return null;
      return parseDetailHtml(html, url);
    } catch {
      return null;
    }
  });
  const parsed = detailResults.filter((r) => r.ok && r.value).map((r) => r.value);
  console.log(`Parsed ${parsed.length} detail pages.`);

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const entry of parsed) {
    const website = cleanWebsite(entry.website);
    const confidence = buildConfidence(entry, website, entry.email);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: "Sweden",
        location: entry.city,
      }) ||
      findChurchDuplicate(index, {
        name: entry.name,
        country: "Sweden",
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
      ...(Number.isFinite(entry.latitude) ? { latitude: entry.latitude } : {}),
      ...(Number.isFinite(entry.longitude) ? { longitude: entry.longitude } : {}),
      denomination_network: "Equmeniakyrkan",
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
      name: entry.name,
      description: "",
      country: "Sweden",
      location: entry.city || null,
      denomination: "Free Church",
      founded: null,
      website: website || null,
      email: entry.email || null,
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
    addChurchToIndex(index, { slug, name: entry.name, country: "Sweden", location: entry.city || null, website: website || null });
    addHostLocationEntry(hostIndex, { website, slug, location: entry.city, country: "Sweden" });
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
