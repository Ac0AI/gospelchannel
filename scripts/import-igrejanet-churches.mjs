#!/usr/bin/env node

// Import Brazilian evangelical churches from igrejanet.com.br — a national
// directory of ~3,627 evangelical churches, server-rendered (plain HTTP, no
// Apify/Firecrawl needed). All URLs come from the sitemap; each detail page
// gives name + street address + bairro + city/state + CEP + website.
//
// Usage:
//   node scripts/import-igrejanet-churches.mjs --limit=30 --preview
//   node scripts/import-igrejanet-churches.mjs --approve --concurrency=10

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  addChurchToIndex, createChurchIndex, findChurchDuplicate,
  normalizeWhitespace, decodeHtml, slugifyName,
} from "./lib/church-intake-utils.mjs";
import { buildHostLocationIndex, findHostLocationDuplicate } from "./lib/directory-dedupe.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SITEMAP = "https://igrejanet.com.br/sitemap.php";
const UA = { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" };
const UPSERT_BATCH_SIZE = 100;

// igrejanet is already a curated evangelical directory, so we DON'T apply a
// "must look churchy" filter (would drop legit "Missão ..." names). We only
// drop the rare non-Christian / Catholic straggler.
const OFF_BRAND = /cat[óo]lic|par[óo]qui|arquidioces|\bdiocese\b|catedral|bas[íi]lica|mosteiro|convento|nossa senhora|ortodox|testemunhas de jeov|sal[ãa]o do reino|kingdom hall|m[óo]rmon|esp[íi]rita|espiritism|umbanda|candombl|kardec|budis|buddhis|mesquita|sinagoga|gurdwara|scientolog/i;

function mapDenomination(t = "") {
  const s = t.toLowerCase();
  if (/assembl[eé]ia de deus|\bad\b|iadb|igader/.test(s)) return "Pentecostal";
  if (/batista/.test(s)) return "Baptist";
  if (/quadrangular|foursquare|\bieq\b/.test(s)) return "Pentecostal";
  if (/universal|reino de deus|deus [ée] amor|renascer|sara nossa terra|bola de neve|lagoinha|videira|graça de deus|o brasil para cristo|pentecost/.test(s)) return "Pentecostal";
  if (/presbiterian/.test(s)) return "Presbyterian";
  if (/metodist/.test(s)) return "Methodist";
  if (/luteran/.test(s)) return "Lutheran";
  if (/adventist/.test(s)) return "Adventist";
  if (/nazareno/.test(s)) return "Nazarene";
  if (/congregacional/.test(s)) return "Congregational";
  return "Evangelical";
}

function parseArgs(argv) {
  const o = { limit: 0, preview: false, approve: false, concurrency: 8 };
  for (const a of argv) {
    if (a === "--preview") o.preview = true;
    else if (a === "--approve") o.approve = true;
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
    else if (a.startsWith("--concurrency=")) o.concurrency = Math.max(1, Math.min(16, Number(a.split("=")[1]) || 8));
  }
  return o;
}

function chunk(items, size) { const o = []; for (let i = 0; i < items.length; i += size) o.push(items.slice(i, i + size)); return o; }

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

async function fetchText(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    const res = await fetch(url, { headers: UA, signal: c.signal, redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; } finally { clearTimeout(t); }
}

const val = (s) => { const v = normalizeWhitespace(decodeHtml(s || "")).trim(); return v === "-" ? "" : v; };

function parseDetail(html) {
  const pick = (label) => {
    const m = html.match(new RegExp(`<strong>${label}:</strong>\\s*([^<]+)`));
    return m ? val(m[1]) : "";
  };
  const nameM = html.match(/data-nome="([^"]+)"/) || html.match(/<h1[^>]*>([^<]{2,120})<\/h1>/);
  const name = nameM ? val(nameM[1]) : "";
  const cidadeRaw = pick("Cidade"); // "São Paulo / SP"
  let city = cidadeRaw, state = "";
  const cm = cidadeRaw.match(/^(.+?)\s*\/\s*([A-Za-zÀ-ÿ]{2,})$/);
  if (cm) { city = val(cm[1]); state = cm[2].length === 2 ? cm[2].toUpperCase() : cm[2]; }
  const siteM = html.match(/href="([^"]+)"[^>]*>\s*Acessar site/);
  // Service times: <ul class="ig-prog"><li>Domingo | 10:00 - Culto</li>...</ul>
  const progM = html.match(/<ul[^>]*class="ig-prog"[^>]*>([\s\S]*?)<\/ul>/);
  const services = progM
    ? [...progM[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => val(m[1])).filter(Boolean)
    : [];
  return { name, endereco: pick("Endereço"), bairro: pick("Bairro"), city, state, cep: pick("CEP"), site: siteM ? siteM[1].trim() : "", services };
}

function cleanWebsite(raw) {
  if (!raw) return null;
  try { const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (/facebook|instagram|youtube|wa\.me|api=1|maps/.test(u.hostname + u.pathname)) return null;
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
  const attempts = [slugifyName(`${name} ${city}`), slugifyName(name), slugifyName(`${name} ${city} br`)].filter(Boolean);
  for (const a of attempts) if (!usedSlugs.has(a)) { usedSlugs.add(a); return a; }
  let n = 2; const base = slugifyName(`${name} ${city}`) || slugifyName(name) || "igreja";
  while (usedSlugs.has(`${base}-${n}`)) n += 1;
  const s = `${base}-${n}`; usedSlugs.add(s); return s;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const o = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) throw new Error("Missing DATABASE_URL");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  console.log("Fetching sitemap...");
  const sm = await fetchText(SITEMAP);
  if (!sm) throw new Error("sitemap fetch failed");
  let urls = [...new Set((sm.match(/https:\/\/igrejanet\.com\.br\/igreja\/[a-z0-9-]+/g) || []))];
  console.log(`Church URLs in sitemap: ${urls.length}`);
  if (o.limit > 0) urls = urls.slice(0, o.limit);

  console.log(`Scraping ${urls.length} detail pages (concurrency ${o.concurrency})...`);
  let done = 0;
  const parsed = (await pool(urls, o.concurrency, async (url) => {
    const html = await fetchText(url);
    done += 1;
    if (done % 250 === 0) console.log(`  ...${done}/${urls.length}`);
    if (!html) return null;
    const d = parseDetail(html);
    return d.name ? d : null;
  })).filter(Boolean);
  console.log(`Parsed ${parsed.length} churches.`);

  const dropped = parsed.filter((d) => OFF_BRAND.test(`${d.name} ${d.bairro}`));
  const clean = parsed.filter((d) => !OFF_BRAND.test(`${d.name} ${d.bairro}`));
  if (dropped.length) console.log(`Brand guard dropped ${dropped.length}: ${dropped.slice(0, 10).map((d) => d.name).join("; ")}`);

  const existing = await sql`SELECT slug, name, country, location, website FROM churches`;
  const index = createChurchIndex();
  const hostIndex = buildHostLocationIndex(existing);
  const usedSlugs = new Set(existing.map((r) => r.slug));
  for (const r of existing) addChurchToIndex(index, r);

  const inserts = [];
  const enrichmentSeeds = [];
  let deduped = 0;
  for (const d of clean) {
    const name = d.name;
    const city = d.city || "";
    const website = cleanWebsite(d.site);
    const dup =
      findHostLocationDuplicate(hostIndex, { website: website || "", country: "Brazil", location: city }) ||
      findChurchDuplicate(index, { name, country: "Brazil", location: city, website: website || "" });
    const slug = dup?.slug || createUniqueSlug(name, city, usedSlugs);
    const address = [d.endereco, d.bairro, [city, d.state].filter(Boolean).join(" - "), d.cep].filter(Boolean).join(", ");

    enrichmentSeeds.push({
      church_slug: slug,
      ...(address ? { street_address: address } : {}),
      ...(d.services && d.services.length ? { service_times: d.services.map((s) => ({ label: s, source: "igrejanet" })) } : {}),
      denomination_network: "IgrejaNet",
      confidence: 0.55,
      last_enriched_at: new Date().toISOString(),
    });
    if (dup) { deduped += 1; continue; }

    const now = new Date().toISOString();
    inserts.push({
      slug, name, description: "", country: "Brazil", location: city || null,
      denomination: mapDenomination(name), founded: null, website: website || null, email: null, language: "pt",
      logo: null, header_image: null, header_image_attribution: null, spotify_url: null,
      spotify_playlist_ids: [], additional_playlists: [], spotify_playlists: null, music_style: null,
      notable_artists: null, youtube_channel_id: null, spotify_artist_ids: null, youtube_videos: null,
      aliases: null, source_kind: "discovered", status: o.approve ? "approved" : "pending", confidence: 0.55,
      reason: `directory-import: IgrejaNet Brazil | ${d.state || ""}`.trim(),
      discovery_source: "directory-import", discovered_at: now,
      candidate_id: null, spotify_owner_id: null, last_researched: null, verified_at: null,
    });
    addChurchToIndex(index, { slug, name, country: "Brazil", location: city || null, website: website || null });
  }

  console.log(`Prepared: inserts=${inserts.length}, deduped=${deduped}`);
  console.log(JSON.stringify(inserts.slice(0, 20).map((r) => ({ name: r.name, loc: r.location, denom: r.denomination, site: r.website ? "y" : "" })), null, 2));

  if (o.preview) { console.log("Preview mode: nothing written."); return; }
  for (const b of chunk(inserts, UPSERT_BATCH_SIZE)) for (const row of b) await upsertRow(sql, "churches", "slug", row, prepareChurchValue);
  for (const b of chunk(enrichmentSeeds, UPSERT_BATCH_SIZE)) for (const row of b) await upsertRow(sql, "church_enrichments", "church_slug", row, prepareEnrichmentValue);
  console.log(`Imported ${inserts.length} churches, seeded ${enrichmentSeeds.length} enrichment rows.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
