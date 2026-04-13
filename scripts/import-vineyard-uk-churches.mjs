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

const LIST_URL = "https://www.vineyardchurches.org.uk/churches/";
const DETAIL_BASE = "https://www.vineyardchurches.org.uk/churches/";
const DIRECTORY_REASON = `directory-import: Vineyard UK | ${LIST_URL}`;
const UPSERT_BATCH_SIZE = 100;
const DETAIL_CONCURRENCY = 8;

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
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseMarkers(html) {
  // <span class="marker" data-type="..." data-lat="..." data-lng="..." data-name="..." data-area="..." data-link="...">
  const re = /<span[^>]*class="marker"[^>]*data-type="([^"]*)"[^>]*data-lat="([^"]*)"[^>]*data-lng="([^"]*)"[^>]*data-name="([^"]*)"[^>]*data-area="([^"]*)"[^>]*data-link="([^"]*)"[^>]*>/g;
  const markers = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    markers.push({
      type: m[1],
      lat: Number(m[2]),
      lng: Number(m[3]),
      name: decodeHtml(m[4]),
      area: m[5],
      link: m[6],
    });
  }
  return markers;
}

// Cloudflare email obfuscation: hex-encoded XOR with first byte as key.
function decodeCloudflareEmail(hexStr) {
  if (!hexStr) return "";
  try {
    const key = parseInt(hexStr.slice(0, 2), 16);
    let result = "";
    for (let i = 2; i < hexStr.length; i += 2) {
      result += String.fromCharCode(parseInt(hexStr.slice(i, i + 2), 16) ^ key);
    }
    return result;
  } catch {
    return "";
  }
}

function stripTags(html = "") {
  return normalizeWhitespace(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "));
}

function parseDetailPage(html, marker) {
  // Slice between <div id="church_container_content"> and its closing wrapper
  const containerStart = html.indexOf('id="church_container_content"');
  const slice = containerStart > 0 ? html.slice(containerStart, containerStart + 8000) : html;

  // Name
  const nameMatch = slice.match(/<h4[^>]*>\s*([^<]+?)\s*<\/h4>/);
  const name = nameMatch ? decodeHtml(nameMatch[1]).trim() : marker.name;

  // Website (first <a href="https://..."> in church_header that is NOT the wp site)
  const websiteMatch = slice.match(
    /<div class="church_header">[\s\S]*?<a href="(https?:\/\/[^"]+)"/,
  );
  let website = websiteMatch ? websiteMatch[1] : "";
  if (/vineyardchurches\.org\.uk/.test(website)) website = "";

  // Sunday Services
  const servicesMatch = slice.match(
    /<h6>Sunday Services:<\/h6>\s*<p>([\s\S]*?)<\/p>/,
  );
  const servicesRaw = servicesMatch ? stripTags(servicesMatch[1]) : "";

  // Phone + email line: <p>t: PHONE<br />e: <a href="...email-protection#HEX">
  const phoneMatch = slice.match(/<p>\s*t:\s*([^<]+?)\s*(?:<br|<\/p)/);
  const phone = phoneMatch ? normalizeWhitespace(phoneMatch[1]) : "";

  const emailMatch = slice.match(/email-protection#([a-fA-F0-9]+)/);
  const email = emailMatch ? decodeCloudflareEmail(emailMatch[1]) : "";

  // About
  const aboutMatch = slice.match(/<h6>About:<\/h6>\s*<p>([\s\S]*?)<\/p>/);
  const about = aboutMatch ? stripTags(aboutMatch[1]) : "";

  // Pastors
  const pastorsMatch = slice.match(/<h6>Pastors:<\/h6>\s*<p>([\s\S]*?)<\/p>/);
  const pastors = pastorsMatch ? stripTags(pastorsMatch[1]) : "";

  // Address: usually the second <br/> line in the Sunday Services block (e.g. "Linchmere Road, Haslemere, GU27 3QW")
  const addressMatch = servicesMatch
    ? servicesMatch[1].match(/<br\s*\/?>([\s\S]*?)<\/p>/)
    : null;
  const address = addressMatch ? stripTags(addressMatch[1]) : "";

  // City: parse last comma-separated chunk before UK postcode pattern
  let city = "";
  if (address) {
    // UK postcodes look like "GU27 3QW", "SW1A 1AA", "M1 1AE"
    const cityMatch = address.match(/,\s*([A-Za-zÀ-ÿ\s'-]+?)(?:,)?\s*[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d/);
    if (cityMatch) city = cityMatch[1].trim();
  }
  // Fall back to area slug (proper-cased) — these are wide regions ("south-central")
  // so only use as last resort.
  if (!city && marker.area) {
    city = marker.area
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return {
    name,
    website,
    serviceTimes: servicesRaw,
    address,
    city,
    phone,
    email,
    about,
    pastors,
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

function buildConfidence(detail, website, email) {
  let score = 0.7;
  if (website) score += 0.1;
  if (email) score += 0.05;
  if (detail.phone) score += 0.03;
  if (detail.about) score += 0.02;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, area, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName(`${name} ${area}`),
    slugifyName(`${name} vineyard uk`),
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

  console.log(`Fetching Vineyard UK directory...`);
  const indexHtml = await fetchText(LIST_URL);
  const allMarkers = parseMarkers(indexHtml);
  // Drop markers whose data-link is a full URL (broken church plants)
  const markers = allMarkers.filter((m) => !/^https?:\/\//.test(m.link) && m.link);
  console.log(`Parsed ${allMarkers.length} markers, ${markers.length} valid (filtered ${allMarkers.length - markers.length} broken plants).`);

  const limited = options.limit > 0 ? markers.slice(0, options.limit) : markers;

  console.log(`Fetching ${limited.length} detail pages (concurrency ${DETAIL_CONCURRENCY})...`);
  const details = await mapWithConcurrency(limited, DETAIL_CONCURRENCY, async (marker) => {
    try {
      const html = await fetchText(`${DETAIL_BASE}${marker.link}`, 15000);
      return { marker, detail: parseDetailPage(html, marker) };
    } catch {
      return { marker, detail: null };
    }
  });
  const parsed = details.filter((r) => r.ok && r.value).map((r) => r.value);
  console.log(`Parsed ${parsed.length} detail pages successfully.`);

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;
  // Dedup within feed: same name + lat/lng → same church (Cardiff Central + Cardiff Penarth example)
  const seenLocations = new Map();

  for (const { marker, detail } of parsed) {
    const name = detail?.name || marker.name;
    if (!name) continue;
    const website = cleanWebsite(detail?.website);
    const city = detail?.city || marker.area || "";
    const email = detail?.email || "";
    const phone = detail?.phone || "";
    const lat = Number.isFinite(marker.lat) ? marker.lat : null;
    const lng = Number.isFinite(marker.lng) ? marker.lng : null;

    // Within-feed dedup by lat/lng (3 decimals)
    const locKey = lat && lng ? `${lat.toFixed(3)},${lng.toFixed(3)}` : "";
    if (locKey && seenLocations.has(locKey)) {
      // Same physical location already processed in this feed
      continue;
    }
    if (locKey) seenLocations.set(locKey, name);

    const confidence = buildConfidence(detail || {}, website, email);

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

    const slug = duplicate?.slug || createUniqueSlug(name, marker.area, usedSlugs);
    touched.add(slug);

    // Service times can have multi-line content. Store as one-item array.
    const serviceTimesArr = detail?.serviceTimes
      ? [{ label: detail.serviceTimes, source: "vineyardchurches.org.uk" }]
      : null;

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(detail?.address ? { street_address: detail.address } : {}),
      ...(email ? { contact_email: email } : {}),
      ...(phone ? { phone } : {}),
      ...(serviceTimesArr ? { service_times: serviceTimesArr } : {}),
      ...(detail?.about ? { summary: detail.about.slice(0, 500) } : {}),
      ...(detail?.pastors ? { pastor_name: detail.pastors } : {}),
      ...(Number.isFinite(lat) ? { latitude: lat } : {}),
      ...(Number.isFinite(lng) ? { longitude: lng } : {}),
      denomination_network: "Vineyard Churches UK & Ireland",
      confidence,
      sources: { vineyard_uk: { area: marker.area, link: marker.link, scraped_at: new Date().toISOString() } },
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
      description: detail?.about?.slice(0, 500) || "",
      country: "United Kingdom",
      location: city || null,
      denomination: "Vineyard",
      founded: null,
      website: website || null,
      email: email || null,
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
      reason: `${DIRECTORY_REASON} | ${marker.link}`,
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
    inserts.slice(0, 5).map((r) => ({
      slug: r.slug,
      name: r.name,
      location: r.location,
      website: r.website,
      email: r.email,
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
