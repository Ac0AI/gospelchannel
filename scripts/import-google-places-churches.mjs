#!/usr/bin/env node

// Discover + import churches from Google Places (Apify compass/google-maps-extractor).
// Unlike enrich-google-places-by-slug.mjs (which enriches existing churches),
// this DISCOVERS new ones: it searches evangelical/pentecostal terms per metro,
// keeps only on-brand results, and inserts them with the full Places payload
// (name, address, coords, phone, website, opening hours, hero photo).
//
// The search TERM does the brand-filtering at the source ("igreja evangélica"
// returns evangelical churches, not Catholic parishes); OFF_BRAND is a safety net.
//
// Usage:
//   node scripts/import-google-places-churches.mjs --city="São Paulo" --state=SP --preview
//   node scripts/import-google-places-churches.mjs --city="São Paulo" --state=SP --max=120 --approve
//
// Flags: --city (required) --state --country=Brazil --terms="a,b,c" --max=120
//        --preview (no writes) --approve (status=approved) --limit=N (cap inserts)

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  addChurchToIndex,
  createChurchIndex,
  findChurchDuplicate,
  normalizeWhitespace,
  slugifyName,
} from "./lib/church-intake-utils.mjs";
import {
  buildHostLocationIndex,
  findHostLocationDuplicate,
} from "./lib/directory-dedupe.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const APIFY_ACTOR = "compass~google-maps-extractor";
const APIFY_MEMORY_MB = 4096;
const UPSERT_BATCH_SIZE = 100;

const DEFAULT_TERMS = [
  "igreja evangélica",
  "igreja pentecostal",
  "assembleia de deus",
  "igreja batista",
  "igreja evangelho quadrangular",
];

// Must look like an evangelical/free church.
const CHURCHY = /igreja|templo|assembl[eé]ia|congrega|comunidade crist|minist[ée]rio|tabern[aá]cul|church|evang[ée]l|pentecost|batista|quadrangular/i;
// Dropped even if churchy — Catholic / Orthodox / JW / LDS / spiritist / non-Christian.
// NOTE: spiritism is matched via "espírita/espiritismo" (the -a / -ismo forms),
// NEVER bare "espírito" — "Espírito Santo" (Holy Spirit) is a common Pentecostal name.
const OFF_BRAND = /cat[óo]lic|par[óo]qui|arquidioces|\bdiocese\b|catedral|bas[íi]lica|santu[áa]ri|mosteiro|convento|abadia|nossa senhora|\bmatriz\b|ortodox|orthodox|testemunhas de jeov|sal[ãa]o do reino|kingdom hall|santos dos [úu]ltimos dias|m[óo]rmon|esp[íi]rita|espiritism|espiritist|umbanda|candombl|kardec|budis|buddhis|hare krishna|mesquita|mosque|masjid|sinagoga|synagogue|gurdwara|sikh|\bhindu|mandir|scientolog|seicho/i;

function mapDenomination(text = "") {
  const t = text.toLowerCase();
  if (/assembl[eé]ia de deus/.test(t)) return "Pentecostal";
  if (/batista/.test(t)) return "Baptist";
  if (/quadrangular|foursquare/.test(t)) return "Pentecostal";
  if (/universal|reino de deus|deus [ée] amor|renascer|sara nossa terra|bola de neve|lagoinha/.test(t)) return "Pentecostal";
  if (/presbiterian/.test(t)) return "Presbyterian";
  if (/metodist/.test(t)) return "Methodist";
  if (/luteran/.test(t)) return "Lutheran";
  if (/adventist/.test(t)) return "Adventist";
  if (/pentecost/.test(t)) return "Pentecostal";
  return "Evangelical";
}

function parseArgs(argv) {
  const o = { city: "", state: "", country: "Brazil", terms: DEFAULT_TERMS, max: 120, preview: false, approve: false, limit: 0 };
  for (const a of argv) {
    if (a === "--preview") o.preview = true;
    else if (a === "--approve") o.approve = true;
    else if (a.startsWith("--city=")) o.city = a.split("=").slice(1).join("=").trim();
    else if (a.startsWith("--state=")) o.state = a.split("=")[1].trim();
    else if (a.startsWith("--country=")) o.country = a.split("=")[1].trim();
    else if (a.startsWith("--max=")) o.max = Math.max(1, Number(a.split("=")[1]) || 120);
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
    else if (a.startsWith("--terms=")) o.terms = a.split("=").slice(1).join("=").split(",").map((s) => s.trim()).filter(Boolean);
  }
  return o;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---- Apify (compass/google-maps-extractor) ----
const APIFY_LANG = {
  Brazil: "pt-BR", Portugal: "pt-PT", Spain: "es",
  Mexico: "es-419", Colombia: "es-419", Argentina: "es-419", Peru: "es-419",
  Guatemala: "es-419", Chile: "es-419", Ecuador: "es-419", Bolivia: "es-419",
};
async function startApifyRun(searchStrings, locationQuery, language, max, token) {
  const body = {
    searchStringsArray: searchStrings,
    locationQuery,
    maxCrawledPlacesPerSearch: max,
    language,
    skipClosedPlaces: true,
    scrapePlaceDetailPage: true,
  };
  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${token}&memory=${APIFY_MEMORY_MB}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Apify start failed: ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  return { runId: data.id, datasetId: data.defaultDatasetId };
}

async function pollApifyRun(runId, token, maxWaitMs) {
  const STABLE_SECS = 45;
  const start = Date.now();
  let lastCount = 0, lastChange = Date.now(), datasetId = null;
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 6000));
    const poll = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    const { data } = await poll.json();
    datasetId = datasetId || data.defaultDatasetId;
    if (data.status === "SUCCEEDED") return;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) throw new Error(`Apify run ${runId} ${data.status}`);
    if (datasetId) {
      try {
        const head = await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}?token=${token}`)).json();
        const count = head?.data?.itemCount ?? 0;
        if (count !== lastCount) { lastCount = count; lastChange = Date.now(); }
        if (count > 0 && Date.now() - lastChange > STABLE_SECS * 1000) {
          await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${token}`, { method: "POST" });
          return;
        }
      } catch { /* non-fatal */ }
    }
  }
  throw new Error(`Apify run ${runId} timed out client-side`);
}

async function fetchDataset(datasetId, token) {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?format=json&token=${token}&limit=10000`);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status}`);
  return res.json();
}

// ---- Place field helpers (mirrors enrich-google-places-by-slug.mjs) ----
const SOCIAL_BARE_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "instagram.com", "www.instagram.com", "twitter.com", "x.com", "tiktok.com", "www.tiktok.com", "youtube.com", "www.youtube.com"]);
function cleanWebsite(raw) {
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (SOCIAL_BARE_HOSTS.has(url.hostname.toLowerCase())) return "";
    return `${url.origin}/`;
  } catch { return ""; }
}
function pickHeroImage(p) {
  if (Array.isArray(p.imageUrls) && p.imageUrls.length) return p.imageUrls[0];
  return p.imageUrl || p.image || null;
}
function buildStreetAddress(p) {
  if (p.street && (p.postalCode || p.city)) return [p.street, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return p.address || p.street || "";
}
function serviceTimesFromOpeningHours(oh) {
  if (!Array.isArray(oh)) return null;
  const e = oh.filter((h) => h && h.day && h.hours).map((h) => ({ label: `${h.day}: ${h.hours}`, source: "google-places" }));
  return e.length ? e : null;
}

function prepareChurchValue(c, v) {
  if (v === undefined) return undefined;
  if (["spotify_playlists", "youtube_videos"].includes(c) && v !== null) return JSON.stringify(v);
  return v;
}
function prepareEnrichmentValue(c, v) {
  if (v === undefined) return undefined;
  if (["service_times", "sources", "raw_google_places", "raw_crawled_pages"].includes(c) && v !== null) return JSON.stringify(v);
  return v;
}
async function upsertRow(sql, table, conflictColumn, row, prep) {
  const entries = Object.entries(row).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const cols = entries.map(([c]) => c);
  const ph = cols.map((_, i) => `$${i + 1}`);
  const vals = entries.map(([c, v]) => prep(c, v));
  const upd = cols.filter((c) => c !== conflictColumn).map((c) => `${c} = EXCLUDED.${c}`);
  if (!cols.includes("updated_at")) upd.push("updated_at = NOW()");
  await sql.query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${ph.join(", ")}) ON CONFLICT (${conflictColumn}) DO UPDATE SET ${upd.join(", ")}`, vals);
}
async function upsertChurches(sql, rows) {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) for (const row of batch) await upsertRow(sql, "churches", "slug", row, prepareChurchValue);
}
async function upsertEnrichmentSeeds(sql, rows) {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) for (const row of batch) await upsertRow(sql, "church_enrichments", "church_slug", row, prepareEnrichmentValue);
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [slugifyName(`${name} ${city}`), slugifyName(name), slugifyName(`${name} ${city} br`)].filter(Boolean);
  for (const a of attempts) if (!usedSlugs.has(a)) { usedSlugs.add(a); return a; }
  let n = 2;
  const base = slugifyName(`${name} ${city}`) || slugifyName(name) || "igreja";
  while (usedSlugs.has(`${base}-${n}`)) n += 1;
  const s = `${base}-${n}`;
  usedSlugs.add(s);
  return s;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const o = parseArgs(process.argv.slice(2));
  if (!o.city) throw new Error("Missing --city");
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Missing APIFY_TOKEN");
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) throw new Error("Missing DATABASE_URL");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const cityLabel = o.state ? `${o.city}, ${o.state}` : o.city;
  const locationQuery = [o.city, o.state, o.country].filter(Boolean).join(", ");
  const language = APIFY_LANG[o.country] || "en";
  const searchStrings = o.terms;
  console.log(`Apify: [${searchStrings.join(" | ")}] @ ${locationQuery} · max ${o.max}/search · lang ${language}`);

  const { runId, datasetId } = await startApifyRun(searchStrings, locationQuery, language, o.max, token);
  console.log(`Run ${runId} → dataset ${datasetId}. Polling...`);
  await pollApifyRun(runId, token, 20 * 60 * 1000);
  const places = await fetchDataset(datasetId, token);
  console.log(`Fetched ${places.length} raw places.`);

  // De-dup raw places by placeId, apply brand filter.
  const seenPlace = new Set();
  const kept = [];
  const excluded = [];
  for (const p of places) {
    const title = normalizeWhitespace(p.title || "");
    if (!title) continue;
    const pid = p.placeId || p.fid || `${title}|${p.street || ""}`;
    if (seenPlace.has(pid)) continue;
    seenPlace.add(pid);
    const hay = `${title} ${p.categoryName || ""} ${(p.categories || []).join(" ")}`;
    if (OFF_BRAND.test(hay)) { excluded.push({ title, why: "off-brand", cat: p.categoryName }); continue; }
    if (!CHURCHY.test(hay)) { excluded.push({ title, why: "not-churchy", cat: p.categoryName }); continue; }
    kept.push(p);
  }
  console.log(`On-brand kept: ${kept.length} · excluded: ${excluded.length}`);
  if (excluded.length) console.log("Excluded sample:", JSON.stringify(excluded.slice(0, 8), null, 1));

  // Dedup vs existing DB + build rows.
  const existing = await sql`SELECT slug, name, country, location, website FROM churches`;
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  let deduped = 0;
  for (const p of kept) {
    const name = normalizeWhitespace(p.title);
    const city = normalizeWhitespace(p.city || o.city);
    const website = cleanWebsite(p.website);
    const dup =
      findHostLocationDuplicate(hostIndex, { website, country: o.country, location: city }) ||
      findChurchDuplicate(index, { name, country: o.country, location: city, website });
    const slug = dup?.slug || createUniqueSlug(name, city, usedSlugs);

    const lat = p.location?.lat ?? null;
    const lng = p.location?.lng ?? null;
    const address = buildStreetAddress(p);
    const hero = pickHeroImage(p);
    const serviceTimes = serviceTimesFromOpeningHours(p.openingHours);
    const denomination = mapDenomination(`${name} ${p.categoryName || ""}`);

    enrichmentSeeds.push({
      church_slug: slug,
      ...(address ? { street_address: address } : {}),
      ...(p.phone ? { phone: normalizeWhitespace(p.phone) } : {}),
      ...(lat != null ? { latitude: lat } : {}),
      ...(lng != null ? { longitude: lng } : {}),
      ...(serviceTimes ? { service_times: serviceTimes } : {}),
      ...(hero ? { cover_image_url: hero } : {}),
      denomination_network: p.categoryName || null,
      confidence: 0.7,
      last_enriched_at: new Date().toISOString(),
    });

    if (dup) { deduped += 1; continue; }

    const now = new Date().toISOString();
    inserts.push({
      slug, name, description: "", country: o.country, location: city || null,
      denomination, founded: null, website: website || null, email: null, language: "pt",
      logo: null, header_image: hero || null, header_image_attribution: hero ? "Google" : null,
      spotify_url: null, spotify_playlist_ids: [], additional_playlists: [], spotify_playlists: null,
      music_style: null, notable_artists: null, youtube_channel_id: null, spotify_artist_ids: null,
      youtube_videos: null, aliases: null, source_kind: "discovered",
      status: o.approve ? "approved" : "pending", confidence: 0.7,
      reason: `google-places-discovery: ${cityLabel} | ${p.categoryName || "church"}`,
      discovery_source: "google-search", discovered_at: now,
      candidate_id: null, spotify_owner_id: null, last_researched: null, verified_at: null,
    });
    addChurchToIndex(index, { slug, name, country: o.country, location: city || null, website: website || null });
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}`);
  console.log(JSON.stringify(
    inserts.slice(0, 20).map((r) => ({ name: r.name, loc: r.location, denom: r.denomination, site: r.website ? "y" : "", hero: r.header_image ? "y" : "" })),
    null, 2,
  ));

  if (o.limit > 0 && inserts.length > o.limit) inserts.length = o.limit;
  if (o.preview) { console.log("Preview mode: nothing written."); return; }

  if (inserts.length) await upsertChurches(sql, inserts);
  await upsertEnrichmentSeeds(sql, enrichmentSeeds);
  console.log(`Imported ${inserts.length} churches, seeded ${enrichmentSeeds.length} enrichment rows.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
