#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  addChurchToIndex,
  createChurchIndex,
  findChurchDuplicate,
  isOfficialWebsiteUrl,
  normalizeWhitespace,
  slugifyName,
  toSiteRoot,
} from "./lib/church-intake-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 100;
const EUROPE_COUNTRIES = new Set([
  "Albania",
  "Andorra",
  "Armenia",
  "Austria",
  "Azerbaijan",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Macedonia",
  "Malta",
  "Moldova",
  "Monaco",
  "Netherlands",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Switzerland",
  "Turkey",
  "Ukraine",
  "United Kingdom",
]);

function parseArgs(argv) {
  const options = {
    preview: false,
    limit: 0,
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg.startsWith("--limit=")) {
      options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    }
  }

  return options;
}

function chunk(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function makeDescription(name, country, summary, seoDescription) {
  if (normalizeWhitespace(summary)) return normalizeWhitespace(summary);
  if (normalizeWhitespace(seoDescription)) return normalizeWhitespace(seoDescription);
  return `Discover worship music and playlists from ${name}.${country ? ` Based in ${country}.` : ""}`.trim();
}

function createUniqueSlug(name, location, country, usedSlugs) {
  const attempts = [
    slugifyName(name),
    slugifyName([name, location].filter(Boolean).join(" ")),
    slugifyName([name, country].filter(Boolean).join(" ")),
    slugifyName([name, location, country].filter(Boolean).join(" ")),
  ].filter(Boolean);

  for (const attempt of attempts) {
    if (!usedSlugs.has(attempt)) {
      usedSlugs.add(attempt);
      return attempt;
    }
  }

  const base = slugifyName(name);
  let suffix = 2;
  while (usedSlugs.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  const slug = `${base}-${suffix}`;
  usedSlugs.add(slug);
  return slug;
}

async function loadAllChurchRows(supabase) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,name,country,location,website,status")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load existing churches: ${error.message}`);
    }

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function loadLegacyCandidates(supabase) {
  const { data, error } = await supabase
    .from("church_candidates")
    .select("id,name,country,location,website,status,confidence,reason,source,discovered_at,contact_email,spotify_owner_id,spotify_playlist_ids")
    .in("status", ["merged", "approved"]);

  if (error) {
    throw new Error(`Failed to load legacy candidates: ${error.message}`);
  }

  return data || [];
}

async function loadCandidateEnrichments(supabase, candidateIds) {
  const rows = [];

  for (const batch of chunk(candidateIds, 200)) {
    const { data, error } = await supabase
      .from("church_enrichments")
      .select("candidate_id,official_church_name,summary,seo_description,denomination_network,website_url,contact_email,cover_image_url,logo_image_url,languages,facebook_url,youtube_url,instagram_url")
      .in("candidate_id", batch);

    if (error) {
      throw new Error(`Failed to load candidate enrichments: ${error.message}`);
    }

    rows.push(...(data || []));
  }

  return new Map(rows.map((row) => [row.candidate_id, row]));
}

async function upsertChurches(supabase, rows) {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("churches")
      .upsert(batch, { onConflict: "slug" });

    if (error) {
      throw new Error(`Failed to import churches: ${error.message}`);
    }
  }
}

async function linkEnrichments(supabase, rows) {
  for (const row of rows) {
    const { error } = await supabase
      .from("church_enrichments")
      .update({ church_slug: row.slug })
      .eq("candidate_id", row.candidate_id);

    if (error) {
      throw new Error(`Failed to link enrichment for ${row.slug}: ${error.message}`);
    }
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const existingChurches = await loadAllChurchRows(supabase);
  const churchIndex = createChurchIndex();
  const usedSlugs = new Set(existingChurches.map((row) => row.slug).filter(Boolean));

  for (const church of existingChurches) {
    addChurchToIndex(churchIndex, church);
  }

  const candidates = await loadLegacyCandidates(supabase);
  const enrichments = await loadCandidateEnrichments(supabase, candidates.map((row) => row.id));

  const prepared = [];
  const stats = {
    skippedNonEurope: 0,
    skippedMissingWebsite: 0,
    skippedDuplicate: 0,
    importedApproved: 0,
  };
  const byCountry = {};

  for (const candidate of candidates) {
    if (!EUROPE_COUNTRIES.has(candidate.country)) {
      stats.skippedNonEurope += 1;
      continue;
    }

    const enrichment = enrichments.get(candidate.id);
    const name = normalizeWhitespace(enrichment?.official_church_name || candidate.name);
    const website = enrichment?.website_url || candidate.website || null;
    const location = normalizeWhitespace(candidate.location || "");

    if (!name || !isOfficialWebsiteUrl(website)) {
      stats.skippedMissingWebsite += 1;
      continue;
    }

    const duplicate = findChurchDuplicate(churchIndex, {
      name,
      country: candidate.country,
      location,
      website,
    });

    if (duplicate) {
      stats.skippedDuplicate += 1;
      continue;
    }

    const slug = createUniqueSlug(name, location, candidate.country, usedSlugs);
    const language = Array.isArray(enrichment?.languages) ? enrichment.languages[0] : enrichment?.languages || null;
    const row = {
      slug,
      name,
      description: makeDescription(name, candidate.country, enrichment?.summary, enrichment?.seo_description),
      country: candidate.country || "",
      location: location || null,
      denomination: enrichment?.denomination_network || null,
      founded: null,
      website: website ? toSiteRoot(website) : null,
      email: enrichment?.contact_email || candidate.contact_email || null,
      language: language || null,
      logo: enrichment?.logo_image_url || null,
      header_image: enrichment?.cover_image_url || null,
      header_image_attribution: null,
      spotify_url: null,
      spotify_playlist_ids: candidate.spotify_playlist_ids || [],
      additional_playlists: [],
      spotify_playlists: null,
      music_style: null,
      notable_artists: null,
      youtube_channel_id: null,
      spotify_artist_ids: null,
      youtube_videos: null,
      aliases: null,
      source_kind: "discovered",
      status: "approved",
      candidate_id: candidate.id,
      confidence: candidate.confidence || 0,
      reason: candidate.reason || null,
      discovery_source: candidate.source || null,
      discovered_at: candidate.discovered_at || null,
      spotify_owner_id: candidate.spotify_owner_id || null,
      last_researched: null,
      verified_at: null,
    };

    prepared.push(row);
    addChurchToIndex(churchIndex, row);
    stats.importedApproved += 1;
    byCountry[row.country] = (byCountry[row.country] || 0) + 1;

    if (options.limit > 0 && prepared.length >= options.limit) {
      break;
    }
  }

  const sortedCountries = Object.entries(byCountry).sort((left, right) => right[1] - left[1]);

  console.log(`Prepared ${prepared.length} legacy Europe churches for import.`);
  console.log(JSON.stringify({
    importedApproved: stats.importedApproved,
    skippedNonEurope: stats.skippedNonEurope,
    skippedMissingWebsite: stats.skippedMissingWebsite,
    skippedDuplicate: stats.skippedDuplicate,
    topCountries: sortedCountries.slice(0, 20),
  }, null, 2));

  if (prepared.length > 0) {
    console.log("Sample:");
    for (const row of prepared.slice(0, 12)) {
      console.log(`  ${row.slug} | ${row.name} | ${row.country} | ${row.website}`);
    }
  }

  if (options.preview) {
    return;
  }

  await upsertChurches(supabase, prepared);
  await linkEnrichments(supabase, prepared);

  console.log(`Imported ${prepared.length} approved churches and linked their enrichments.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
