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

const DIRECTORY_URL = "https://fiec.org.uk/churches";
const DIRECTORY_REASON = `directory-import: FIEC UK | ${DIRECTORY_URL}`;
const UPSERT_BATCH_SIZE = 100;
const DEFAULT_DETAIL_CONCURRENCY = 8;

function parseArgs(argv) {
  const options = {
    preview: false,
    limit: 0,
    approve: false,
    concurrency: DEFAULT_DETAIL_CONCURRENCY,
    skipDetail: false,
  };
  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg === "--approve") options.approve = true;
    else if (arg === "--skip-detail") options.skipDetail = true;
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || DEFAULT_DETAIL_CONCURRENCY);
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
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseDirectoryHtml(html) {
  const match = html.match(/window\.churchAddresses\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error("Could not locate window.churchAddresses on fiec.org.uk/churches");
  return JSON.parse(match[1]);
}

function parseAddress(raw = "") {
  const parts = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { street: "", city: "", postcode: "" };
  const last = parts[parts.length - 1];
  const postcodeMatch = last.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i);
  let postcode = "";
  let city = "";
  if (postcodeMatch) {
    postcode = postcodeMatch[1];
    city = last.replace(postcode, "").trim().replace(/,$/, "").trim();
    if (!city && parts.length >= 2) city = parts[parts.length - 2];
  } else {
    city = last;
  }
  const street = parts.slice(0, Math.max(0, parts.length - 1)).join(", ");
  return { street, city: city || last, postcode };
}

function extractWebsiteFromDetail(html) {
  const m = html.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*btn--lblue[^"]*"[^>]*target="_blank"/);
  if (m) return m[1];
  const alt = html.match(/target="_blank"[^>]*class="[^"]*btn--lblue[^"]*"[^>]*href="(https?:\/\/[^"]+)"/);
  if (alt) return alt[1];
  return "";
}

function extractSocialsFromDetail(html) {
  const pick = (re) => {
    const m = html.match(re);
    return m ? m[1] : "";
  };
  return {
    facebook: pick(/href="(https?:\/\/(?:www\.)?facebook\.com\/[^"]+)"/),
    instagram: pick(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/),
    youtube: pick(/href="(https?:\/\/(?:www\.)?youtube\.com\/[^"]+)"/),
    twitter: pick(/href="(https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"]+)"/),
  };
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function buildConfidence(entry, website) {
  let score = 0.65;
  if (website) score += 0.15;
  if (entry.latitude && entry.longitude) score += 0.05;
  if (entry.address) score += 0.05;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName(`${name} ${city}`),
    slugifyName(`${name} uk`),
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

  console.log(`Fetching FIEC directory from ${DIRECTORY_URL}...`);
  const indexHtml = await fetchText(DIRECTORY_URL);
  const rawEntries = parseDirectoryHtml(indexHtml);
  console.log(`Parsed ${rawEntries.length} churches from window.churchAddresses.`);

  const entries = options.limit > 0 ? rawEntries.slice(0, options.limit) : rawEntries;

  // Fetch detail pages for website + socials
  let detailMap = new Map();
  if (!options.skipDetail) {
    console.log(`Fetching ${entries.length} detail pages (concurrency ${options.concurrency})...`);
    const results = await mapWithConcurrency(entries, options.concurrency, async (entry) => {
      try {
        const html = await fetchText(entry.profileUrl, 12000);
        return {
          profileUrl: entry.profileUrl,
          website: extractWebsiteFromDetail(html),
          socials: extractSocialsFromDetail(html),
        };
      } catch {
        return { profileUrl: entry.profileUrl, website: "", socials: {} };
      }
    });
    for (const r of results) {
      if (r.ok && r.value) detailMap.set(r.value.profileUrl, r.value);
    }
    const withWebsite = [...detailMap.values()].filter((v) => v.website).length;
    console.log(`Detail fetch: ${detailMap.size} pages, ${withWebsite} with website.`);
  }

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const entry of entries) {
    const name = normalizeWhitespace(decodeHtml(entry.title || ""));
    if (!name) continue;
    const detail = detailMap.get(entry.profileUrl) || {};
    const website = cleanWebsite(detail.website || "");
    const { street, city, postcode } = parseAddress(entry.address);
    const address = [street, [postcode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const latitude = entry.latitude ? Number(entry.latitude) : null;
    const longitude = entry.longitude ? Number(entry.longitude) : null;

    const confidence = buildConfidence(entry, website);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: "United Kingdom",
        location: city,
      }) ||
      findChurchDuplicate(index, {
        name,
        country: "United Kingdom",
        location: city || "",
        website: website || "",
      });

    const slug = duplicate?.slug || createUniqueSlug(name, city, usedSlugs);
    touched.add(slug);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(address ? { street_address: address } : {}),
      ...(detail.socials?.facebook ? { facebook_url: detail.socials.facebook } : {}),
      ...(detail.socials?.instagram ? { instagram_url: detail.socials.instagram } : {}),
      ...(detail.socials?.youtube ? { youtube_url: detail.socials.youtube } : {}),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {}),
      denomination_network: "Fellowship of Independent Evangelical Churches",
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
      country: "United Kingdom",
      location: city || null,
      denomination: "Independent Evangelical",
      founded: null,
      website: website || null,
      email: null,
      language: "en",
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
      reason: `${DIRECTORY_REASON} | ${entry.profileUrl || ""}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name, country: "United Kingdom", location: city || null, website: website || null });
    addHostLocationEntry(hostIndex, { website, slug, location: city, country: "United Kingdom" });
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
