#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const DIRECTORY_PAGE = "https://www.fieide.org/directorio-iglesias-fieide-2025/";
const DIRECTORY_REASON = `directory-import: FIEIDE Spain | ${DIRECTORY_PAGE}`;
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

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function downloadPdf(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = join(tmpdir(), `fieide-${Date.now()}.pdf`);
  writeFileSync(path, buf);
  return path;
}

function pdfToText(pdfPath) {
  const txtPath = pdfPath.replace(/\.pdf$/, ".txt");
  execFileSync("pdftotext", ["-layout", pdfPath, txtPath], { stdio: "ignore" });
  return readFileSync(txtPath, "utf8");
}

function parseChurchBlocks(text) {
  const lines = text.split("\n").map((l) => l.replace(/\s+$/, ""));

  // Extract TOC city headings (format: "City Name .... 5")
  const tocCities = [];
  let tocEnd = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(.+?)\s*\.{3,}\s*\d+$/);
    if (m) {
      tocCities.push(m[1].trim());
      tocEnd = i + 1;
    } else if (tocCities.length > 0 && lines[i].trim() === "") {
      // tolerate blank lines
    } else if (tocCities.length > 10 && !/\.{3,}/.test(lines[i])) {
      break;
    }
  }

  if (tocCities.length === 0) return [];

  // In body, find each city heading as a line exactly matching a TOC entry
  const body = lines.slice(tocEnd);
  const anchors = [];
  for (let i = 0; i < body.length; i += 1) {
    const line = body[i].trim();
    if (!line) continue;
    if (tocCities.includes(line)) {
      // Check it's a heading (next non-blank line looks like a church name)
      let next = "";
      for (let j = i + 1; j < Math.min(i + 5, body.length); j += 1) {
        if (body[j].trim()) { next = body[j].trim(); break; }
      }
      if (next && next.length > 5 && !/^\d/.test(next)) {
        anchors.push(i);
      }
    }
  }

  const blocks = [];
  for (let k = 0; k < anchors.length; k += 1) {
    const start = anchors[k];
    const end = k + 1 < anchors.length ? anchors[k + 1] : body.length;
    const slice = body.slice(start, end);
    const inner = slice.map((l) => l.trim()).filter(Boolean);
    if (inner.length >= 3) blocks.push(inner);
  }
  return blocks;
}

function parseBlock(lines) {
  const [cityHeading, name, ...rest] = lines;
  if (!cityHeading || !name) return null;
  // Skip blocks that look like TOC fragments or section headings
  if (/^\d+$/.test(name)) return null;
  if (name.length > 200) return null;

  let street = "";
  let postalCode = "";
  let province = "";
  let email = "";
  let website = "";
  let serviceTime = "";
  let phone = "";
  const streetLines = [];

  for (const line of rest) {
    const postalMatch = line.match(/^(\d{5})\s+(.+)$/);
    const emailMatch = line.match(/([\w.+-]+@[\w-]+\.[\w.-]+)/);
    const websiteMatch = line.match(/((?:https?:\/\/|www\.)[^\s]+)/i);
    const serviceMatch = line.match(/^Culto\s+dominical\s*[:\-]?\s*(.+)$/i);
    const phoneMatch = line.match(/^(?:Tel\.?|Tf\.?|Teléfono)[\s\.:]*([+\d\s\-/()]{7,})$/i);

    if (postalMatch && !postalCode) {
      postalCode = postalMatch[1];
      // City after postal is usually identical to heading; don't overwrite
    } else if (serviceMatch) {
      serviceTime = serviceMatch[1].trim();
    } else if (emailMatch) {
      email = emailMatch[1];
    } else if (websiteMatch && !email) {
      website = websiteMatch[1];
    } else if (/^(https?:\/\/|www\.)/i.test(line) && !website) {
      website = line;
    } else if (phoneMatch) {
      phone = phoneMatch[1].trim();
    } else if (!postalCode && line.length < 80) {
      streetLines.push(line);
    } else if (postalCode && !province && line.length < 60 && !/culto|@|http/i.test(line)) {
      province = line;
    }
  }

  street = streetLines.join(", ");
  const city = cityHeading.split(/\s*[–-]\s*/)[0].trim();
  const address = [street, [postalCode, city].filter(Boolean).join(" "), province].filter(Boolean).join(", ");

  return {
    cityHeading: cityHeading.trim(),
    city,
    name: name.trim(),
    street,
    postalCode,
    province: province.trim(),
    address,
    email,
    website,
    phone,
    serviceTime,
  };
}

function cleanWebsite(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim().replace(/[.,;]$/, "");
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!isOfficialWebsiteUrl(withProtocol)) return "";
  return toSiteRoot(withProtocol);
}

function buildConfidence(entry, website, email) {
  let score = 0.55;
  if (website) score += 0.12;
  if (email) score += 0.05;
  if (entry.street) score += 0.03;
  if (entry.serviceTime) score += 0.03;
  return Number(Math.max(0.4, Math.min(0.85, score)).toFixed(2));
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

  console.log("Locating FIEIDE PDF...");
  const pageHtml = await fetchText(DIRECTORY_PAGE);
  const pdfUrlMatch = pageHtml.match(/href="([^"]*Iglesias[^"]*\.pdf)"/);
  if (!pdfUrlMatch) throw new Error("Could not locate Iglesias*.pdf on FIEIDE page");
  const pdfUrl = pdfUrlMatch[1];
  console.log(`Downloading ${pdfUrl}...`);
  const pdfPath = await downloadPdf(pdfUrl);
  const text = pdfToText(pdfPath);

  const blocks = parseChurchBlocks(text);
  console.log(`Found ${blocks.length} raw blocks.`);
  const parsed = blocks.map(parseBlock).filter((e) => e && e.name && e.name.length > 2);
  console.log(`Parsed ${parsed.length} valid church entries.`);

  const entries = options.limit > 0 ? parsed.slice(0, options.limit) : parsed;

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
    const website = cleanWebsite(entry.website);
    const email = entry.email || "";
    const city = entry.city;

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
      ...(entry.address ? { street_address: entry.address } : {}),
      ...(email ? { contact_email: email } : {}),
      ...(entry.phone ? { phone: entry.phone } : {}),
      ...(entry.serviceTime ? { service_times: [{ label: `Culto dominical ${entry.serviceTime}`, source: "fieide.org" }] } : {}),
      denomination_network: "FIEIDE",
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
      denomination: "Independent Evangelical",
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
      reason: DIRECTORY_REASON,
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
    inserts.slice(0, 8).map((r) => ({ slug: r.slug, name: r.name, location: r.location, website: r.website, email: r.email, confidence: r.confidence })),
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
