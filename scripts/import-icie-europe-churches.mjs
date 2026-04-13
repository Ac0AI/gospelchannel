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

const INDEX_URL = "https://www.internationalchurches.eu/list/";
const CATEGORY_BASE = "https://www.internationalchurches.eu/list/wpbdp_category/";
const DIRECTORY_REASON = `directory-import: International Churches in Europe | ${INDEX_URL}`;
const UPSERT_BATCH_SIZE = 100;
const COUNTRY_CONCURRENCY = 4;

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

async function fetchText(url, timeoutMs = 20000) {
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

function parseCountryIndex(html) {
  // Find all category links
  const slugs = new Set();
  const re = /href="https:\/\/www\.internationalchurches\.eu\/list\/wpbdp_category\/([^"\/]+)\//g;
  let m;
  while ((m = re.exec(html)) !== null) slugs.add(m[1]);
  return [...slugs];
}

// Country slug → canonical English name (for our DB)
function countryNameFromSlug(slug) {
  const overrides = {
    "uk": "United Kingdom",
    "great-britain": "United Kingdom",
    "russian-federation": "Russia",
    "czech-republic": "Czech Republic",
    "north-macedonia": "Macedonia",
  };
  if (overrides[slug]) return overrides[slug];
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function stripTags(html = "") {
  return normalizeWhitespace(
    String(html)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function parseListings(html, country) {
  // Each listing is wrapped in <div id="wpbdp-listing-XXX" class="..."> ... </div>
  // Use a forgiving split on listing IDs.
  const blocks = [];
  const ids = [...html.matchAll(/<div id="wpbdp-listing-(\d+)"[^>]*>/g)];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i][1];
    const start = ids[i].index;
    const end = i + 1 < ids.length ? ids[i + 1].index : html.length;
    const block = html.substring(start, end);
    blocks.push({ id, html: block });
  }

  return blocks.map(({ id, html: blockHtml }) => {
    // Title
    const nameMatch = blockHtml.match(/<div class="listing-title">[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    const name = nameMatch ? decodeHtml(nameMatch[1]).trim() : "";

    // Detail page link
    const linkMatch = blockHtml.match(/href="(https:\/\/www\.internationalchurches\.eu\/list\/\d+\/[^"]+\/)"/);
    const detailUrl = linkMatch ? linkMatch[1] : "";

    // Thumbnail
    const thumbMatch = blockHtml.match(/<div class="listing-thumbnail">[\s\S]*?<img[^>]*src="([^"]+)"/);
    const thumbnail = thumbMatch ? thumbMatch[1] : "";

    // Address
    const addrMatch = blockHtml.match(/<div class="address-info[^"]*"[\s\S]*?<div>([^<]+)<\/div>/);
    const address = addrMatch ? stripTags(addrMatch[1]) : "";

    // Generic field extractor: <div class="wpbdp-field-display wpbdp-field-{name} ..."> ... <div class="value">VALUE</div></div>
    function field(fieldName) {
      const re = new RegExp(
        `<div class="wpbdp-field-display[^"]*wpbdp-field-${fieldName}\\b[^"]*"[\\s\\S]*?<div class="value">([\\s\\S]*?)<\\/div><\\/div>`,
        "i",
      );
      const m = blockHtml.match(re);
      return m ? m[1] : "";
    }

    const description = stripTags(field("description"));
    const sundayMeeting = stripTags(field("sunday_meeting_time"));
    const phone = stripTags(field("phone_number"));

    // Website
    const websiteMatch = field("website_address");
    const website = websiteMatch ? stripTags(websiteMatch).match(/(https?:\/\/[^\s"<]+)/)?.[1] || "" : "";

    // Online stream
    const onlineMatch = field("online_church_service");
    const onlineUrl = onlineMatch ? stripTags(onlineMatch).match(/(https?:\/\/[^\s"<]+)/)?.[1] || "" : "";

    // Facebook
    const facebookMatch = field("facebook_page");
    const facebook = facebookMatch ? stripTags(facebookMatch).match(/(https?:\/\/[^\s"<]+)/)?.[1] || "" : "";

    // Twitter / Instagram (single field)
    const twitterMatch = field("twitter__instagram");
    const twitter = twitterMatch ? stripTags(twitterMatch).match(/(https?:\/\/[^\s"<]+)/)?.[1] || "" : "";

    return {
      id,
      country,
      name,
      detailUrl,
      thumbnail,
      address,
      description,
      sundayMeeting,
      phone,
      website,
      onlineUrl,
      facebook,
      twitter,
    };
  });
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function normalizeSocial(url, host) {
  if (!url) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (!u.hostname.toLowerCase().includes(host)) return "";
    return u.toString();
  } catch {
    return "";
  }
}

function extractCity(address) {
  if (!address) return "";
  // Address is free-text. Try to find a postal code + city pattern.
  // German: "12345 Berlin" / French: "75001 Paris" / UK: "M1 1AE Manchester"
  const postcodeCity = address.match(/\b\d{4,5}\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]+)/);
  if (postcodeCity) return postcodeCity[1].trim().replace(/[,;].*$/, "").trim();
  // Last comma-separated chunk
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || "";
}

function buildConfidence(entry, website, hasCoords) {
  let score = 0.65;
  if (website) score += 0.12;
  if (entry.address) score += 0.05;
  if (entry.phone) score += 0.05;
  if (entry.description) score += 0.03;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, country, usedSlugs) {
  const attempts = [
    slugifyName(`icie ${name}`),
    slugifyName(`${name} ${country}`),
    slugifyName(`${name} international`),
  ].filter(Boolean);
  for (const a of attempts) {
    if (!usedSlugs.has(a)) {
      usedSlugs.add(a);
      return a;
    }
  }
  let suffix = 2;
  const base = slugifyName(`icie ${name}`);
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

  console.log(`Step 1: fetching country index from ${INDEX_URL}...`);
  const indexHtml = await fetchText(INDEX_URL);
  const countrySlugs = parseCountryIndex(indexHtml);
  console.log(`  found ${countrySlugs.length} country categories`);

  console.log(`Step 2: fetching ${countrySlugs.length} country pages (concurrency ${COUNTRY_CONCURRENCY})...`);
  const countryResults = await mapWithConcurrency(countrySlugs, COUNTRY_CONCURRENCY, async (slug) => {
    try {
      const html = await fetchText(`${CATEGORY_BASE}${slug}/`, 15000);
      const country = countryNameFromSlug(slug);
      const listings = parseListings(html, country);
      return { slug, country, listings };
    } catch (error) {
      console.log(`  error on ${slug}: ${error.message}`);
      return { slug, country: countryNameFromSlug(slug), listings: [] };
    }
  });

  const allListings = [];
  for (const r of countryResults) {
    if (r.ok && r.value) allListings.push(...r.value.listings);
  }
  console.log(`  parsed ${allListings.length} total listings across ${countrySlugs.length} countries`);

  const limited = options.limit > 0 ? allListings.slice(0, options.limit) : allListings;

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const entry of limited) {
    if (!entry.name) continue;
    const website = cleanWebsite(entry.website);
    const city = extractCity(entry.address);
    const facebook = normalizeSocial(entry.facebook, "facebook.com");
    const twitter = normalizeSocial(entry.twitter, "twitter.com") || normalizeSocial(entry.twitter, "x.com");
    const instagram = normalizeSocial(entry.twitter, "instagram.com");

    const confidence = buildConfidence(entry, website, false);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: entry.country,
        location: city,
      }) ||
      findChurchDuplicate(index, {
        name: entry.name,
        country: entry.country,
        location: city || "",
        website: website || "",
      });

    const slug = duplicate?.slug || createUniqueSlug(entry.name, entry.country, usedSlugs);
    touched.add(slug);

    const serviceTimes = entry.sundayMeeting
      ? [{ label: `Sunday: ${entry.sundayMeeting}`, source: "internationalchurches.eu" }]
      : null;

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(entry.address ? { street_address: entry.address } : {}),
      ...(entry.phone ? { phone: entry.phone } : {}),
      ...(facebook ? { facebook_url: facebook } : {}),
      ...(instagram ? { instagram_url: instagram } : {}),
      ...(entry.onlineUrl ? { livestream_url: entry.onlineUrl } : {}),
      ...(serviceTimes ? { service_times: serviceTimes } : {}),
      ...(entry.description ? { summary: entry.description.slice(0, 500) } : {}),
      ...(entry.thumbnail ? { cover_image_url: entry.thumbnail } : {}),
      denomination_network: "International Churches in Europe",
      confidence,
      sources: { icie: { id: entry.id, country: entry.country, detail_url: entry.detailUrl, scraped_at: new Date().toISOString() } },
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
      description: entry.description?.slice(0, 500) || "",
      country: entry.country,
      location: city || null,
      denomination: "International Evangelical",
      founded: null,
      website: website || null,
      email: null,
      language: "en",
      logo: null,
      header_image: entry.thumbnail || null,
      header_image_attribution: entry.thumbnail ? "internationalchurches.eu" : null,
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
      reason: `${DIRECTORY_REASON} | id=${entry.id}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name: entry.name, country: entry.country, location: city || null, website: website || null });
    addHostLocationEntry(hostIndex, { website, slug, location: city, country: entry.country });
  }

  console.log(`\nPrepared: inserts=${inserts.length}, deduped=${deduped}, touched=${touched.size}`);
  console.log(JSON.stringify(
    inserts.slice(0, 5).map((r) => ({
      slug: r.slug,
      name: r.name,
      country: r.country,
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
