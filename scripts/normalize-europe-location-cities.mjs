#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const ROOT_DIR = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const PAGE_SIZE = 500;
const WRITE_BATCH_SIZE = 25;

const EUROPE_COUNTRIES = new Set([
  "United Kingdom",
  "Ireland",
  "Sweden",
  "Norway",
  "Denmark",
  "Germany",
  "Netherlands",
  "Switzerland",
  "Spain",
  "Portugal",
  "France",
  "Italy",
  "Belgium",
  "Austria",
  "Czech Republic",
  "Poland",
  "Finland",
  "Hungary",
  "Romania",
  "Slovakia",
]);

const COUNTRY_ALIASES = {
  "United Kingdom": ["uk", "great britain", "britain"],
  "Czech Republic": ["czechia"],
};

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildCountryAliases(country) {
  return new Set([normalizeToken(country), ...(COUNTRY_ALIASES[country] || []).map(normalizeToken)]);
}

function getNormalizedCity(location, country) {
  if (!location || !country) return null;
  if (!EUROPE_COUNTRIES.has(country)) return null;
  if (!location.includes(",")) return null;

  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const countryAliases = buildCountryAliases(country);
  const lastPart = normalizeToken(parts.at(-1));

  if (!countryAliases.has(lastPart)) return null;

  const city = parts[0];
  if (!city || city === location) return null;

  return city;
}

async function loadChurchesNeedingReview(supabase) {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,name,status,location,country")
      .in("status", ["approved", "pending"])
      .not("location", "is", null)
      .order("slug")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load churches: ${error.message}`);
    }

    rows.push(...(data || []));

    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function updateBatch(supabase, rows) {
  await Promise.all(
    rows.map(async ({ slug, location }) => {
      const { error } = await supabase.from("churches").update({ location }).eq("slug", slug);
      if (error) {
        throw new Error(`Failed to update ${slug}: ${error.message}`);
      }
    }),
  );
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const churches = await loadChurchesNeedingReview(supabase);
  const patches = churches
    .map((row) => {
      const nextLocation = getNormalizedCity(row.location, row.country);
      if (!nextLocation) return null;
      return {
        slug: row.slug,
        name: row.name,
        status: row.status,
        country: row.country,
        from: row.location,
        to: nextLocation,
        location: nextLocation,
      };
    })
    .filter(Boolean);

  const summary = {
    dryRun,
    reviewed: churches.length,
    patch_count: patches.length,
    approved_updates: patches.filter((row) => row.status === "approved").length,
    pending_updates: patches.filter((row) => row.status === "pending").length,
    sample: patches.slice(0, 120).map(({ slug, status, country, from, to }) => ({ slug, status, country, from, to })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }

  for (let index = 0; index < patches.length; index += WRITE_BATCH_SIZE) {
    const batch = patches.slice(index, index + WRITE_BATCH_SIZE);
    await updateBatch(supabase, batch);
  }

  console.log(`\nNormalized ${patches.length} church location values.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
