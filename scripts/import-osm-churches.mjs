#!/usr/bin/env node

// Import evangelical churches from OpenStreetMap via Overpass — one generalizable
// method for every LATAM country. Free, no credits, and every element carries
// coordinates (no separate geocoding needed). Positive-evidence-only classifier:
// keep a church only when its denomination tag OR name is clearly evangelical,
// and never when it's Catholic/Orthodox/JW/Mormon.
//
// Usage:
//   node scripts/import-osm-churches.mjs --country=GT --preview
//   node scripts/import-osm-churches.mjs --country=MX --approve

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  addChurchToIndex, createChurchIndex, findChurchDuplicate, normalizeWhitespace, slugifyName,
} from "./lib/church-intake-utils.mjs";
import { buildHostLocationIndex, findHostLocationDuplicate } from "./lib/directory-dedupe.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const UA = { "User-Agent": "GospelChannelBot/1.0 (https://gospelchannel.com; hello@gospelchannel.com)" };
const OVERPASS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"];
const UPSERT_BATCH_SIZE = 100;

const COUNTRIES = {
  MX: { name: "Mexico", lang: "es" }, GT: { name: "Guatemala", lang: "es" },
  HN: { name: "Honduras", lang: "es" }, SV: { name: "El Salvador", lang: "es" },
  NI: { name: "Nicaragua", lang: "es" }, CR: { name: "Costa Rica", lang: "es" },
  PA: { name: "Panama", lang: "es" }, CO: { name: "Colombia", lang: "es" },
  VE: { name: "Venezuela", lang: "es" }, EC: { name: "Ecuador", lang: "es" },
  PE: { name: "Peru", lang: "es" }, BO: { name: "Bolivia", lang: "es" },
  PY: { name: "Paraguay", lang: "es" }, UY: { name: "Uruguay", lang: "es" },
  CL: { name: "Chile", lang: "es" }, AR: { name: "Argentina", lang: "es" },
  DO: { name: "Dominican Republic", lang: "es" }, CU: { name: "Cuba", lang: "es" },
  PR: { name: "Puerto Rico", lang: "es" }, BR: { name: "Brazil", lang: "pt" },
};

const EVANG_DENOM = new Set([
  "evangelical", "protestant", "pentecostal", "baptist", "methodist", "adventist",
  "seventh_day_adventist", "nazarene", "presbyterian", "lutheran", "reformed",
  "congregational", "mennonite", "anabaptist", "charismatic", "assemblies_of_god",
  "foursquare", "free_evangelical", "new_apostolic", "vineyard", "brethren", "quaker",
]);
const OFF_DENOM = new Set([
  "catholic", "roman_catholic", "orthodox", "greek_orthodox", "russian_orthodox",
  "eastern_orthodox", "coptic_orthodox", "mormon", "latter_day_saints", "jehovahs_witness",
  "old_catholic",
]);
const EVANG_NAME = /evang[eé]lic|pentecost|bautist|batist|asamblea de dios|assembl[eé]ia de deus|cuadrangular|quadrangular|nazareno|misi[oó]n|iglesia de dios|igreja de deus|centro cristiano|comunidad cristiana|comunidade crist|minist[eé]rio|ministerio|casa de dios|casa de oraci[oó]n|templo evang|adventist|metodist|presbiterian|luteran|congregacion|deus [ée] amor|reino de deus|cristo vive|maranata|el shaddai/i;
const CATH_NAME = /cat[oó]lic|parroqui|par[óo]qui|arquidi|di[óo]cesis|catedral|bas[íi]lica|santu[áa]ri|santuario|capilla|ermita|nuestra se[ñn]ora|virgen del|\bvirgen\b|\bsan \b|\bsanta \b|\bsanto \b|s[ãa]o |ortodox|orthodox|sal[óo]n del reino|testigos de jehov|testemunhas de jeov|m[oó]rmon|santos de los [úu]ltimos|kingdom hall|esp[íi]rita|espiritism/i;

function denomOf(d, n) {
  if (EVANG_DENOM.has(d)) {
    const map = { evangelical: "Evangelical", protestant: "Evangelical", pentecostal: "Pentecostal", baptist: "Baptist", methodist: "Methodist", adventist: "Adventist", seventh_day_adventist: "Adventist", nazarene: "Nazarene", presbyterian: "Presbyterian", lutheran: "Lutheran", reformed: "Reformed", congregational: "Congregational", charismatic: "Charismatic", assemblies_of_god: "Pentecostal", foursquare: "Pentecostal", vineyard: "Vineyard" };
    return map[d] || "Evangelical";
  }
  const s = n.toLowerCase();
  if (/asamblea de dios|assembl[eé]ia|pentecost|cuadrangular|quadrangular|deus [ée] amor/.test(s)) return "Pentecostal";
  if (/bautist|batist/.test(s)) return "Baptist";
  if (/adventist/.test(s)) return "Adventist";
  if (/metodist/.test(s)) return "Methodist";
  if (/presbiterian/.test(s)) return "Presbyterian";
  if (/luteran/.test(s)) return "Lutheran";
  if (/nazareno/.test(s)) return "Nazarene";
  return "Evangelical";
}

// HARD off-brand: these ALWAYS exclude, even if OSM carries a wrong evangelical
// denomination tag (JW halls / Mormon temples are routinely mistagged baptist,
// adventist, etc. in OSM). Name evidence beats the denom tag here.
const HARD_OFF = /testigos de jehov|testemunhas de jeov|sal[óo]n del reino|salon del reino|kingdom hall|santos de los [úu]ltimos|santos dos [úu]ltimos|iglesia mormona|igreja m[óo]rmon|\bmezquita|\bmasjid|\bsinagoga|synagogue|gurdwara|ortodox|orthodox|nuestra se[ñn]ora|arquidi|di[óo]cesis|catedral metropolitana|parroquia (san|santa|santo|nuestra|sagrad|cristo rey|inmaculad|del carmen|divino|de la merced)|capilla nuestra|sagrado coraz|movimientos de retiros/i;

function classify(tags) {
  const d = (tags.denomination || "").toLowerCase();
  const n = normalizeWhitespace(tags.name || "");
  if (!n || n.length < 3) return null;
  if (HARD_OFF.test(n)) return null;               // always wins over the denom tag
  if (OFF_DENOM.has(d)) return null;
  if (CATH_NAME.test(n) && !EVANG_DENOM.has(d)) return null;
  if (EVANG_DENOM.has(d) || EVANG_NAME.test(n)) return { name: n, denomination: denomOf(d, n) };
  return null; // ambiguous → skip (brand-safe)
}

function parseArgs(argv) {
  const o = { country: "", preview: false, approve: false, limit: 0 };
  for (const a of argv) {
    if (a === "--preview") o.preview = true;
    else if (a === "--approve") o.approve = true;
    else if (a.startsWith("--country=")) o.country = a.split("=")[1].trim().toUpperCase();
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
  }
  return o;
}

function chunk(items, size) { const o = []; for (let i = 0; i < items.length; i += size) o.push(items.slice(i, i + size)); return o; }

async function overpass(iso) {
  const q = `[out:json][timeout:300];area["ISO3166-1"="${iso}"][admin_level=2]->.a;nwr["amenity"="place_of_worship"]["religion"="christian"](area.a);out center tags;`;
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: q }) });
      if (!res.ok) { lastErr = `HTTP ${res.status} from ${url}`; continue; }
      const j = await res.json();
      return j.elements || [];
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(`Overpass failed: ${lastErr}`);
}

function cleanWebsite(raw) {
  if (!raw) return null;
  try { const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (/facebook|instagram|youtube|wa\.me|twitter|t\.me/.test(u.hostname)) return null;
    return `${u.origin}/`; } catch { return null; }
}

function prepareChurchValue(c, v) { if (v === undefined) return undefined; if (["spotify_playlists", "youtube_videos"].includes(c) && v !== null) return JSON.stringify(v); return v; }
function prepareEnrichmentValue(c, v) { if (v === undefined) return undefined; if (["service_times", "sources", "raw_google_places", "raw_crawled_pages"].includes(c) && v !== null) return JSON.stringify(v); return v; }
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

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [slugifyName(`${name} ${city}`), slugifyName(name), slugifyName(`${name} ${city} osm`)].filter(Boolean);
  for (const a of attempts) if (!usedSlugs.has(a)) { usedSlugs.add(a); return a; }
  let n = 2; const base = slugifyName(`${name} ${city}`) || slugifyName(name) || "iglesia";
  while (usedSlugs.has(`${base}-${n}`)) n += 1;
  const s = `${base}-${n}`; usedSlugs.add(s); return s;
}

function addr(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  return [street, tags["addr:city"], tags["addr:postcode"]].filter(Boolean).join(", ");
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const o = parseArgs(process.argv.slice(2));
  const country = COUNTRIES[o.country];
  if (!country) throw new Error(`Unknown --country=${o.country}. Known: ${Object.keys(COUNTRIES).join(", ")}`);
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) throw new Error("Missing DATABASE_URL");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  console.log(`Overpass: christian place_of_worship in ${o.country} (${country.name})...`);
  const elements = await overpass(o.country);
  console.log(`Raw christian POW: ${elements.length}`);

  const kept = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const c = classify(tags);
    if (!c) continue;
    const lat = el.lat ?? el.center?.lat ?? null;
    const lon = el.lon ?? el.center?.lon ?? null;
    kept.push({
      name: c.name, denomination: c.denomination,
      city: normalizeWhitespace(tags["addr:city"] || ""),
      lat, lon, address: addr(tags),
      website: cleanWebsite(tags.website || tags["contact:website"]),
      phone: normalizeWhitespace(tags.phone || tags["contact:phone"] || ""),
    });
  }
  console.log(`Evangelical (on-brand): ${kept.length}`);
  let rows = o.limit > 0 ? kept.slice(0, o.limit) : kept;

  const existing = await sql`SELECT slug, name, country, location, website FROM churches WHERE country = ${country.name}`;
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set((await sql`SELECT slug FROM churches`).map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [], seeds = [];
  let deduped = 0;
  for (const r of rows) {
    const website = r.website;
    const dup =
      findHostLocationDuplicate(hostIndex, { website: website || "", country: country.name, location: r.city }) ||
      findChurchDuplicate(index, { name: r.name, country: country.name, location: r.city, website: website || "" });
    const slug = dup?.slug || createUniqueSlug(r.name, r.city || o.country, usedSlugs);
    seeds.push({
      church_slug: slug,
      ...(r.address ? { street_address: r.address } : {}),
      ...(r.phone ? { phone: r.phone } : {}),
      ...(r.lat != null ? { latitude: r.lat } : {}),
      ...(r.lon != null ? { longitude: r.lon } : {}),
      denomination_network: "OpenStreetMap", confidence: 0.5, last_enriched_at: new Date().toISOString(),
    });
    if (dup) { deduped += 1; continue; }
    const now = new Date().toISOString();
    inserts.push({
      slug, name: r.name, description: "", country: country.name, location: r.city || null,
      denomination: r.denomination, founded: null, website: website || null, email: null, language: country.lang,
      logo: null, header_image: null, header_image_attribution: null, spotify_url: null,
      spotify_playlist_ids: [], additional_playlists: [], spotify_playlists: null, music_style: null,
      notable_artists: null, youtube_channel_id: null, spotify_artist_ids: null, youtube_videos: null,
      aliases: null, source_kind: "discovered", status: o.approve ? "approved" : "pending", confidence: 0.5,
      reason: `osm-import: ${country.name}`, discovery_source: "directory-import", discovered_at: now,
      candidate_id: null, spotify_owner_id: null, last_researched: null, verified_at: null,
    });
    // Deliberately NOT re-indexing new rows: OSM churches often share a generic
    // name ("Iglesia Evangélica") with no city but have distinct coordinates, so
    // they must not dedup against each other — only against pre-existing DB rows.
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}`);
  console.log(JSON.stringify(inserts.slice(0, 12).map((x) => ({ name: x.name, loc: x.location, denom: x.denomination, geo: seeds.find((s) => s.church_slug === x.slug)?.latitude != null ? "y" : "" })), null, 2));

  if (o.preview) { console.log("Preview mode: nothing written."); return; }
  for (const b of chunk(inserts, UPSERT_BATCH_SIZE)) for (const row of b) await upsertRow(sql, "churches", "slug", row, prepareChurchValue);
  for (const b of chunk(seeds, UPSERT_BATCH_SIZE)) for (const row of b) await upsertRow(sql, "church_enrichments", "church_slug", row, prepareEnrichmentValue);
  console.log(`Imported ${inserts.length} churches, seeded ${seeds.length} enrichment rows (${o.country}).`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
