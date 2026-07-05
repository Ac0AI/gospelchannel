#!/usr/bin/env node

/**
 * Rewrite generated approved church descriptions in the Supabase source of truth.
 *
 * Default mode is preview only:
 *   node scripts/rewrite-generated-church-descriptions.mjs
 *   node scripts/rewrite-generated-church-descriptions.mjs --dry-run
 *
 * Persist and regenerate the local snapshot:
 *   node scripts/rewrite-generated-church-descriptions.mjs --write
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const PAGE_SIZE = 1000;
const UPDATE_BATCH_SIZE = 200;

const shouldWrite = process.argv.includes("--write");

loadLocalEnv(ROOT_DIR);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function isGeneratedDescription(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return /^discover worship music and playlists from .+/i.test(normalized)
    || /^listen to (?:worship )?music and playlists from .+/i.test(normalized)
    || normalized.includes("Listen to their curated worship playlists on GospelChannel.");
}

function lowerCaseLeadingCharacter(value) {
  if (!value) return value;
  if (value === value.toUpperCase()) return value;
  return value[0].toLowerCase() + value.slice(1);
}

function withIndefiniteArticle(value) {
  if (!value) return "a church";
  return `${/^[aeiou]/i.test(value) ? "an" : "a"} ${value}`;
}

function buildChurchTypeLabel(denomination) {
  const normalized = normalizeText(denomination);
  if (!normalized) return "church";
  const label = lowerCaseLeadingCharacter(normalized);
  if (/\b(church|cathedral|parish|congregation|fellowship|ministry|chapel|assembly)\b/i.test(label)) {
    return label;
  }
  return `${label} church`;
}

function getCompactLocation(location, country) {
  const normalizedLocation = normalizeText(location);
  if (!normalizedLocation) return normalizeText(country) || "";

  const normalizedCountry = normalizeText(country).toLowerCase();
  const parts = normalizedLocation
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);

  if (parts.length === 0) return normalizeText(country) || "";

  const filtered = normalizedCountry
    ? parts.filter((part) => part.toLowerCase() !== normalizedCountry)
    : parts;
  const candidates = filtered.length > 0 ? filtered : parts;
  const first = candidates[0] || "";

  if (!/\d/.test(first)) return first;
  return candidates.find((part) => !/\d/.test(part)) || first;
}

function buildDescription(row, enrichment) {
  const summary = normalizeText(enrichment?.summary);
  if (summary) return summary;

  const seoDescription = normalizeText(enrichment?.seo_description);
  if (seoDescription) return seoDescription;

  const location = getCompactLocation(enrichment?.street_address || row.location, row.country) || normalizeText(row.country);
  const languages = Array.isArray(enrichment?.languages)
    ? enrichment.languages.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  const typeLabel = buildChurchTypeLabel(row.denomination);
  const playlistCount = new Set([
    ...(row.spotify_playlist_ids || []),
    ...(row.additional_playlists || []),
  ]).size;
  const musicStyle = Array.isArray(row.music_style)
    ? row.music_style.map((value) => normalizeText(value)).find(Boolean)
    : "";

  let firstSentence = `${row.name} is ${withIndefiniteArticle(typeLabel)}`;
  if (location) firstSentence += ` in ${location}`;
  if (languages.length === 1) firstSentence += ` with services in ${languages[0]}`;
  if (languages.length > 1) firstSentence += ` with services in ${languages.slice(0, 2).join(" and ")}`;
  firstSentence += ".";

  if (musicStyle) {
    return `${firstSentence} The music leans ${musicStyle}.`;
  }

  if (playlistCount > 0) {
    return `${firstSentence} You can preview ${playlistCount === 1 ? "their worship playlist" : "their worship playlists"} before your first visit.`;
  }

  return `${firstSentence} Explore their worship and community details before your first visit.`;
}

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

async function fetchApprovedChurches() {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,name,description,country,location,denomination,spotify_playlist_ids,additional_playlists,music_style")
      .eq("status", "approved")
      .order("name")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch approved churches: ${error.message}`);
    if (!data) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchEnrichmentMap(slugs) {
  const map = new Map();

  for (const batch of chunk(slugs, 200)) {
    const { data, error } = await supabase
      .from("church_enrichments")
      .select("church_slug,summary,seo_description,street_address,languages")
      .in("church_slug", batch)
      .eq("enrichment_status", "complete");

    if (error) throw new Error(`Failed to fetch church enrichments: ${error.message}`);

    for (const row of data || []) {
      map.set(row.church_slug, row);
    }
  }

  return map;
}

async function applyUpdates(rows) {
  for (const batch of chunk(rows, UPDATE_BATCH_SIZE)) {
    for (const row of batch) {
      const { error } = await supabase
        .from("churches")
        .update({ description: row.description })
        .eq("slug", row.slug)
        .eq("status", "approved");

      if (error) {
        throw new Error(`Failed to update description for ${row.slug}: ${error.message}`);
      }
    }
  }
}

function regenerateSnapshot() {
  const result = spawnSync("node", ["scripts/reconcile-church-source-of-truth.mjs"], {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Failed to regenerate snapshot from Supabase source of truth");
  }
}

async function main() {
  const churches = await fetchApprovedChurches();
  const enrichments = await fetchEnrichmentMap(churches.map((church) => church.slug));

  const updates = churches.flatMap((church) => {
    if (!isGeneratedDescription(church.description)) return [];
    const nextDescription = buildDescription(church, enrichments.get(church.slug));
    if (!nextDescription || nextDescription === church.description) return [];
    return [{
      slug: church.slug,
      description: nextDescription,
    }];
  });

  console.log(`Generated description replacements: ${updates.length}`);
  updates.slice(0, 15).forEach((row) => {
    console.log(`- ${row.slug}: ${row.description}`);
  });

  if (!shouldWrite) {
    console.log("Preview only. Re-run with --write to persist changes to Supabase and regenerate src/data/churches.json.");
    return;
  }

  await applyUpdates(updates);
  console.log(`Updated ${updates.length} approved church descriptions in Supabase.`);
  regenerateSnapshot();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
