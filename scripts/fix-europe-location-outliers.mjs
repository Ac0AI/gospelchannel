#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const ROOT_DIR = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const repairedAt = new Date().toISOString();

const CHURCH_PATCHES = {
  "lanner-methodist-church": {
    location: "Lanner",
  },
  "mfl-movement": {
    name: "mosaik.church",
    description:
      "Charismatic evangelical church in Detmold, Germany with Sunday worship, livestream, children's ministry, and regular community brunches.",
    country: "Germany",
    location: "Detmold",
    denomination: "Evangelical",
    language: "German",
    logo: null,
    spotify_url: null,
    music_style: null,
    youtube_channel_id: null,
    youtube_videos: null,
    aliases: ["FeG Detmold"],
  },
  "rend-collective": {
    description:
      "Folk worship collective from Bangor, Northern Ireland with an organic, joyful and celebratory sound.",
    country: "United Kingdom",
    location: "Bangor",
  },
};

const ENRICHMENT_NOTES = {
  "mfl-movement":
    "Removed mismatched Google Places data from Lafayette, California and normalized the church to Detmold, Germany.",
  "rend-collective":
    "Removed mismatched Google Places data from Bangor, Maine and normalized the entity to Bangor, Northern Ireland, United Kingdom.",
};

function appendManualRepairSource(existingSources, note) {
  const sources = Array.isArray(existingSources) ? existingSources.filter(Boolean) : [];
  const filtered = sources.filter((source) => !(source?.type === "manual_repair" && source?.note === note));
  return [
    ...filtered,
    {
      type: "manual_repair",
      fetchedAt: repairedAt,
      note,
    },
  ];
}

function buildEnrichmentPatch(row) {
  if (row.church_slug === "mfl-movement") {
    return {
      street_address: "Niemeierstr. 9, 32758 Detmold, Germany",
      google_maps_url: null,
      latitude: null,
      longitude: null,
      phone: null,
      church_size: null,
      seo_description:
        "mosaik.church in Detmold, Germany is a charismatic evangelical church with Sunday worship, livestream, children's ministry, and community life.",
      summary:
        "mosaik.church is a charismatic evangelical church in Detmold that meets Sundays at 11:00 in person and by livestream, offers children's ministry, and hosts a monthly community brunch.",
      raw_google_places: null,
      sources: appendManualRepairSource(row.sources, ENRICHMENT_NOTES[row.church_slug]),
      last_enriched_at: repairedAt,
      official_church_name: "mosaik.church",
    };
  }

  if (row.church_slug === "rend-collective") {
    return {
      street_address: null,
      google_maps_url: null,
      latitude: null,
      longitude: null,
      raw_google_places: null,
      sources: appendManualRepairSource(row.sources, ENRICHMENT_NOTES[row.church_slug]),
      last_enriched_at: repairedAt,
    };
  }

  return null;
}

function pickDiff(before, patch) {
  const diff = {};

  for (const [key, value] of Object.entries(patch)) {
    const previous = before?.[key];
    if (JSON.stringify(previous) === JSON.stringify(value)) continue;
    diff[key] = { before: previous ?? null, after: value ?? null };
  }

  return diff;
}

async function updateChurches(supabase, rows) {
  for (const row of rows) {
    const patch = {
      ...CHURCH_PATCHES[row.slug],
      last_researched: repairedAt,
      verified_at: repairedAt,
    };
    const { error } = await supabase.from("churches").update(patch).eq("slug", row.slug);
    if (error) {
      throw new Error(`Failed to update church ${row.slug}: ${error.message}`);
    }
  }
}

async function updateEnrichments(supabase, rows) {
  for (const row of rows) {
    const patch = buildEnrichmentPatch(row);
    if (!patch) continue;

    const { error } = await supabase.from("church_enrichments").update(patch).eq("church_slug", row.church_slug);
    if (error) {
      throw new Error(`Failed to update enrichment ${row.church_slug}: ${error.message}`);
    }
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const slugs = Object.keys(CHURCH_PATCHES);
  const [{ data: churches, error: churchError }, { data: enrichments, error: enrichmentError }] = await Promise.all([
    supabase.from("churches").select("*").in("slug", slugs).order("slug"),
    supabase.from("church_enrichments").select("*").in("church_slug", slugs).order("church_slug"),
  ]);

  if (churchError) {
    throw new Error(`Failed to load churches: ${churchError.message}`);
  }

  if (enrichmentError) {
    throw new Error(`Failed to load enrichments: ${enrichmentError.message}`);
  }

  const summary = {
    dryRun,
    repairedAt,
    churchUpdates: (churches || []).map((row) => {
      const patch = {
        ...CHURCH_PATCHES[row.slug],
        last_researched: repairedAt,
        verified_at: repairedAt,
      };
      return {
        slug: row.slug,
        diff: pickDiff(row, patch),
      };
    }),
    enrichmentUpdates: (enrichments || [])
      .map((row) => {
        const patch = buildEnrichmentPatch(row);
        if (!patch) return null;
        return {
          slug: row.church_slug,
          diff: pickDiff(row, patch),
        };
      })
      .filter(Boolean),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }

  await updateChurches(supabase, churches || []);
  await updateEnrichments(supabase, enrichments || []);

  console.log(`\nRepaired ${churches?.length || 0} church rows and ${summary.enrichmentUpdates.length} enrichment rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
