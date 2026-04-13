#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { neon } from "@neondatabase/serverless";
import * as xlsxNs from "xlsx";
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

const xlsx = xlsxNs.default || xlsxNs;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const XLSX_URL = "https://asambleasdedios.app/mapa_web/iglesias.xlsx";
const COORDS_URL = "https://asambleasdedios.app/mapa_web/coordenadas.json";
const DIRECTORY_REASON = `directory-import: ASDDE Spain | ${XLSX_URL}`;
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

async function downloadFile(url, filename) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = join(tmpdir(), filename);
  writeFileSync(path, buf);
  return path;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parseRows(xlsxPath) {
  const wb = xlsx.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const header = rows[1];
  const dataRows = rows.slice(2);
  const colIdx = Object.fromEntries(header.map((h, i) => [String(h || "").trim(), i]));
  // The two "Vía/Dirección/Número/CP/Ciudad/Provincia/Pais" groups are duplicated.
  // Column indices 27-33 are "Correspondencia", 34-40 are "Habitual".
  return dataRows.map((r) => ({
    item: r[colIdx["Item"]],
    name: String(r[colIdx["Iglesia"]] || "").trim(),
    type: String(r[colIdx["Tipo"]] || "").trim(),
    fraternidad: String(r[colIdx["Fraternidad"]] || "").trim(),
    estado: String(r[colIdx["Estado"]] || "").trim(),
    email: String(r[colIdx["Email"]] || "").trim(),
    facebook: String(r[colIdx["Facebook"]] || "").trim(),
    phoneFixed: String(r[colIdx["Fijo"]] || "").trim(),
    instagram: String(r[colIdx["Instagram"]] || "").trim(),
    phoneMobile: String(r[colIdx["Movil"]] || "").trim(),
    website: String(r[colIdx["Página Web"]] || "").trim(),
    twitter: String(r[colIdx["Twitter"]] || "").trim(),
    whatsapp: String(r[colIdx["WhatsApp"]] || "").trim(),
    youtube: String(r[colIdx["YouTube"]] || "").trim(),
    // Correspondencia (indices 27-33)
    corrVia: String(r[27] || "").trim(),
    corrDir: String(r[28] || "").trim(),
    corrNum: String(r[29] || "").trim(),
    corrCP: String(r[30] || "").trim(),
    corrCiudad: String(r[31] || "").trim(),
    corrProv: String(r[32] || "").trim(),
    corrPais: String(r[33] || "").trim(),
    // Habitual (indices 34-40)
    habVia: String(r[34] || "").trim(),
    habDir: String(r[35] || "").trim(),
    habNum: String(r[36] || "").trim(),
    habCP: String(r[37] || "").trim(),
    habCiudad: String(r[38] || "").trim(),
    habProv: String(r[39] || "").trim(),
    habPais: String(r[40] || "").trim(),
    year: r[colIdx["Año de apertura"]],
    members: r[colIdx["Número de miembros"]],
    representative: String(r[colIdx["Representante"]] || "").trim(),
  }));
}

function buildHabitualAddress(entry) {
  const street = [entry.habVia, entry.habDir, entry.habNum].filter(Boolean).join(" ");
  const cp = entry.habCP ? String(entry.habCP).trim() : "";
  const city = entry.habCiudad || "";
  const province = entry.habProv || "";
  return {
    address: [street, [cp, city].filter(Boolean).join(" "), province].filter(Boolean).join(", "),
    city,
    coordsKey: [street, cp, city, province, entry.habPais || "España"].filter(Boolean).join(", "),
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

function normalizeSocial(url, host) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.toLowerCase().includes(host)) return "";
    return u.toString();
  } catch {
    return "";
  }
}

function buildConfidence(entry, website, email) {
  let score = 0.65;
  if (website) score += 0.1;
  if (email) score += 0.05;
  if (entry.phoneMobile || entry.phoneFixed) score += 0.03;
  if (entry.instagram || entry.facebook || entry.youtube) score += 0.03;
  return Number(Math.max(0.4, Math.min(0.95, score)).toFixed(2));
}

function createUniqueSlug(name, city, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName(`${name} ${city}`),
    slugifyName(`${name} spain`),
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

  console.log("Downloading ASDDE XLSX and coords...");
  const [xlsxPath, coordsJson] = await Promise.all([
    downloadFile(XLSX_URL, `asdde-${Date.now()}.xlsx`),
    fetchJson(COORDS_URL),
  ]);

  const rows = parseRows(xlsxPath);
  const active = rows.filter((r) => r.name && r.estado === "Activo");
  console.log(`Parsed ${rows.length} rows, ${active.length} active.`);

  const coordsMap = new Map();
  for (const [key, value] of Object.entries(coordsJson || {})) {
    coordsMap.set(key.trim(), value);
  }

  const entries = options.limit > 0 ? active.slice(0, options.limit) : active;

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
    const name = normalizeWhitespace(decodeHtml(entry.name));
    if (!name) continue;
    const { address, city, coordsKey } = buildHabitualAddress(entry);
    const website = cleanWebsite(entry.website);
    const email = entry.email;
    const phone = entry.phoneMobile || entry.phoneFixed;
    const facebook = normalizeSocial(entry.facebook, "facebook.com");
    const instagram = normalizeSocial(entry.instagram, "instagram.com");
    const youtube = normalizeSocial(entry.youtube, "youtube.com");

    const coords = coordsMap.get(coordsKey);
    const latitude = coords?.lat ? Number(coords.lat) : null;
    const longitude = coords?.lng ? Number(coords.lng) : null;

    const confidence = buildConfidence(entry, website, email);

    const duplicate =
      findHostLocationDuplicate(hostIndex, {
        website,
        country: "Spain",
        location: city,
      }) ||
      findChurchDuplicate(index, {
        name,
        country: "Spain",
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
      ...(facebook ? { facebook_url: facebook } : {}),
      ...(instagram ? { instagram_url: instagram } : {}),
      ...(youtube ? { youtube_url: youtube } : {}),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {}),
      denomination_network: "Asambleas de Dios España (FADE)",
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
      country: "Spain",
      location: city || null,
      denomination: "Pentecostal",
      founded: null,
      website: website || null,
      email: email || null,
      language: "es",
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
      reason: `${DIRECTORY_REASON} | item=${entry.item}`,
      discovery_source: "directory-import",
      discovered_at: now,
      candidate_id: null,
      spotify_owner_id: null,
      last_researched: null,
      verified_at: null,
    });
    addChurchToIndex(index, { slug, name, country: "Spain", location: city || null, website: website || null });
    addHostLocationEntry(hostIndex, { website, slug, location: city, country: "Spain" });
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
