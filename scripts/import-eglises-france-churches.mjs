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

const BULK_URL = "https://www.eglises.org/?s=&eglise_filter=true";
const REST_BASE = "https://www.eglises.org/wp-json/wp/v2/eglise";
const DETAIL_BASE = "https://www.eglises.org/eglise/";
const DIRECTORY_REASON = `directory-import: CNEF eglises.org | ${BULK_URL}`;
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

async function fetchJson(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Step 1: parse the bulk page for `eglises.push({...})` blocks.
// Each block has: id, title, latlng, statut, implantation.
function parseBulkPushBlocks(html) {
  const re = /eglises\.push\((\{[\s\S]*?\})\);/g;
  const entries = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      entries.push({
        id: data.id,
        title: data.title || "",
        lat: data.latlng?.[0] ?? null,
        lng: data.latlng?.[1] ?? null,
        statut: data.statut || "",
        implantation: data.implantation || "",
      });
    } catch {
      // skip bad blocks
    }
  }
  return entries;
}

// Step 2: walk WP REST to build a complete id → slug + title map.
async function fetchAllSlugs() {
  const map = new Map();
  for (let page = 1; page <= 60; page += 1) {
    const url = `${REST_BASE}?per_page=100&page=${page}&_fields=id,slug,link,title,union,groupement`;
    let items;
    try {
      items = await fetchJson(url);
    } catch (error) {
      // 400 typically means we're past the last page
      break;
    }
    if (!Array.isArray(items) || items.length === 0) break;
    for (const item of items) {
      if (item.id && item.slug) {
        map.set(item.id, {
          slug: item.slug,
          link: item.link,
          title: item.title?.rendered || "",
          union: item.union || [],
          groupement: item.groupement || [],
        });
      }
    }
    if (items.length < 100) break;
  }
  return map;
}

// Step 3: scrape one detail page for address, phone, website, email, union name.
function parseDetailPage(html) {
  // Address: "<p class="Eglise-address">25 rue Michelet | 69140 Rillieux-la-Pape</p>"
  const addrMatch = html.match(/<p class="Eglise-address">([^<]+)<\/p>/);
  let street = "";
  let postalCode = "";
  let city = "";
  if (addrMatch) {
    const raw = decodeHtml(addrMatch[1]).trim();
    const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      street = parts[0];
      const postCity = parts[1];
      const pcMatch = postCity.match(/^(\d{5})\s+(.+)$/);
      if (pcMatch) {
        postalCode = pcMatch[1];
        city = pcMatch[2];
      } else {
        city = postCity;
      }
    } else if (parts.length === 1) {
      const pcMatch = parts[0].match(/^(\d{5})\s+(.+)$/);
      if (pcMatch) {
        postalCode = pcMatch[1];
        city = pcMatch[2];
      } else {
        street = parts[0];
      }
    }
  }
  const address = [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  // Phone: <a href="tel:+33...">
  const phoneMatch = html.match(/href="tel:(\+?\d[\d\s().-]{6,})"/);
  const phone = phoneMatch ? phoneMatch[1].trim() : "";

  // Website: <a href="..." class="button button--orange ..." target="_blank">Site web</a>
  const websiteMatch = html.match(/<a href="(https?:\/\/[^"]+)"[^>]*class="button button--orange[^"]*"[^>]*target="_blank"/);
  const website = websiteMatch ? websiteMatch[1] : "";

  // Union (denomination): first <a class="Eglise-union" ... <span>UNION NAME</span>
  const unionMatch = html.match(/<a class="Eglise-union"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/);
  const union = unionMatch ? decodeHtml(unionMatch[1]).trim() : "";

  // Statut badge text (affilié/non-membre)
  const statutMatch = html.match(/<div class="Eglise-statut">[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
  const statutText = statutMatch ? decodeHtml(statutMatch[1]).trim() : "";

  return { street, postalCode, city, address, phone, website, union, statutText };
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function buildConfidence(detail, website) {
  let score = 0.65;
  if (website) score += 0.12;
  if (detail.phone) score += 0.05;
  if (detail.address) score += 0.05;
  if (detail.union) score += 0.03;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

// French church names are mostly UPPERCASE. Title-case for display while
// keeping common French articles lowercase. Unicode-aware so accented
// characters don't get mid-word capitalisation.
const LOWER_WORDS = new Set([
  "de", "du", "des", "la", "le", "les", "et", "d", "l", "à", "au", "aux", "en", "sur",
]);
function titleCase(s = "") {
  if (!s) return "";
  return s
    .split(/(\s+|[-/])/u)
    .map((token, i) => {
      if (!token || /^\s+$/.test(token) || /^[-/]$/.test(token)) return token;
      const lower = token.toLocaleLowerCase("fr-FR");
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return token.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
    })
    .join("");
}

function createUniqueSlug(slug, name, city, usedSlugs) {
  const attempts = [
    slug,
    slugifyName(name),
    slugifyName(`${name} ${city}`),
    slugifyName(`${name} france`),
  ].filter(Boolean);
  for (const a of attempts) {
    if (!usedSlugs.has(a)) {
      usedSlugs.add(a);
      return a;
    }
  }
  let suffix = 2;
  const base = slug || slugifyName(name);
  while (usedSlugs.has(`${base}-${suffix}`)) suffix += 1;
  const out = `${base}-${suffix}`;
  usedSlugs.add(out);
  return out;
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

  console.log(`Step 1: fetching bulk index from eglises.org...`);
  const bulkHtml = await fetchText(BULK_URL, 60000);
  const pushEntries = parseBulkPushBlocks(bulkHtml);
  console.log(`  parsed ${pushEntries.length} push() entries (id, title, latlng, statut, implantation)`);

  console.log(`Step 2: walking WP REST for full id→slug mapping...`);
  const slugMap = await fetchAllSlugs();
  console.log(`  collected ${slugMap.size} slugs`);

  // Merge: for each pushEntry, attach the slug from the map. Drop entries with no slug.
  const merged = pushEntries
    .map((e) => {
      const restEntry = slugMap.get(e.id);
      if (!restEntry) return null;
      return {
        ...e,
        slug: restEntry.slug,
        link: restEntry.link,
        union: restEntry.union,
      };
    })
    .filter(Boolean);
  console.log(`  merged: ${merged.length} entries with both bulk metadata and slug`);

  // Drop entries with 0,0 latlng (probably stub records)
  const withCoords = merged.filter((e) => e.lat && e.lng && (e.lat !== 0 || e.lng !== 0));
  console.log(`  with valid coordinates: ${withCoords.length}`);

  const limited = options.limit > 0 ? withCoords.slice(0, options.limit) : withCoords;

  console.log(`Step 3: fetching ${limited.length} detail pages (concurrency ${DETAIL_CONCURRENCY})...`);
  let detailDone = 0;
  const detailResults = await mapWithConcurrency(limited, DETAIL_CONCURRENCY, async (entry) => {
    try {
      const html = await fetchText(`${DETAIL_BASE}${entry.slug}/`, 15000);
      const detail = parseDetailPage(html);
      detailDone += 1;
      if (detailDone % 100 === 0) console.log(`  detail progress: ${detailDone}/${limited.length}`);
      return { entry, detail };
    } catch {
      detailDone += 1;
      return { entry, detail: null };
    }
  });
  const parsed = detailResults.filter((r) => r.ok && r.value).map((r) => r.value);
  console.log(`  parsed ${parsed.length} detail pages`);

  const existing = await loadAllChurchRows(sql);
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  const touched = new Set();
  let deduped = 0;

  for (const { entry, detail } of parsed) {
    const rawTitle = decodeHtml(entry.title || "");
    const displayName = titleCase(rawTitle);
    if (!displayName) continue;
    const website = cleanWebsite(detail?.website);
    const city = detail?.city || "";
    const phone = detail?.phone || "";
    const address = detail?.address || "";
    const union = detail?.union || "";
    const lat = entry.lat;
    const lng = entry.lng;
    const isPlant = entry.implantation === "implantation" || entry.implantation === "projet";

    const confidence = buildConfidence(detail || {}, website);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: "France",
        location: city,
      }) ||
      findChurchDuplicate(index, {
        name: displayName,
        country: "France",
        location: city || "",
        website: website || "",
      });

    const slug = duplicate?.slug || createUniqueSlug(`fr-${entry.slug}`, displayName, city, usedSlugs);
    touched.add(slug);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(website ? { website_url: website } : {}),
      ...(address ? { street_address: address } : {}),
      ...(phone ? { phone } : {}),
      ...(Number.isFinite(lat) ? { latitude: lat } : {}),
      ...(Number.isFinite(lng) ? { longitude: lng } : {}),
      ...(union ? { denomination_network: union } : { denomination_network: "CNEF (Conseil national des évangéliques de France)" }),
      confidence,
      sources: { cnef_eglises: { id: entry.id, slug: entry.slug, statut: entry.statut, implantation: entry.implantation, scraped_at: new Date().toISOString() } },
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
      country: "France",
      location: city || null,
      denomination: union || "Evangelical",
      founded: null,
      website: website || null,
      email: null,
      language: "fr",
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
      aliases: rawTitle !== displayName ? [rawTitle] : null,
      source_kind: "discovered",
      status: options.approve ? "approved" : "pending",
      confidence,
      reason: `${DIRECTORY_REASON} | id=${entry.id} | ${entry.implantation}${isPlant ? " | church-plant" : ""}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name: displayName, country: "France", location: city || null, website: website || null });
    addHostLocationEntry(hostIndex, { website, slug, location: city, country: "France" });
  }

  console.log(`\nPrepared: inserts=${inserts.length}, deduped=${deduped}, touched=${touched.size}`);
  console.log(JSON.stringify(
    inserts.slice(0, 5).map((r) => ({
      slug: r.slug,
      name: r.name,
      location: r.location,
      website: r.website,
      denomination: r.denomination,
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
