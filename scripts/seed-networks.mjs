#!/usr/bin/env node

/**
 * Seed church_networks and church_campuses from existing enrichment data.
 *
 * Usage:
 *   source .env.local && node scripts/seed-networks.mjs
 *   source .env.local && node scripts/seed-networks.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const dryRun = process.argv.includes("--dry-run");

// Known networks with their worship artist slug in churches.json
const KNOWN_NETWORKS = [
  {
    slug: "hillsong",
    name: "Hillsong Church",
    parentChurchSlug: "hillsong-worship",
    website: "https://hillsong.com",
    headquartersCountry: "Australia",
    founded: 1983,
    patterns: ["hillsong"],
  },
  {
    slug: "bethel",
    name: "Bethel Church",
    parentChurchSlug: "bethel-music",
    website: "https://bethel.com",
    headquartersCountry: "United States",
    founded: 1954,
    patterns: ["bethel"],
  },
  {
    slug: "vineyard",
    name: "Vineyard Churches",
    parentChurchSlug: "vineyard-worship",
    website: "https://vineyardusa.org",
    headquartersCountry: "United States",
    founded: 1982,
    patterns: ["vineyard"],
  },
  {
    slug: "c3",
    name: "C3 Church Global",
    parentChurchSlug: "c3-music",
    website: "https://c3churchglobal.com",
    headquartersCountry: "Australia",
    founded: 1980,
    patterns: ["c3 church", "c3church", "christian city church"],
  },
  {
    slug: "icf",
    name: "ICF Church",
    parentChurchSlug: "icf-worship",
    website: "https://icf.church",
    headquartersCountry: "Switzerland",
    founded: 1996,
    patterns: ["icf"],
  },
  {
    slug: "elevation",
    name: "Elevation Church",
    parentChurchSlug: "elevation-worship",
    website: "https://elevationchurch.org",
    headquartersCountry: "United States",
    founded: 2006,
    patterns: ["elevation church"],
  },
  {
    slug: "planetshakers",
    name: "Planetshakers Church",
    parentChurchSlug: "planetshakers",
    website: "https://planetshakers.com",
    headquartersCountry: "Australia",
    founded: 1997,
    patterns: ["planetshakers"],
  },
];

// Load churches.json to validate parent church slugs
const churchesPath = join(__dirname, "..", "src", "data", "churches.json");
const churches = JSON.parse(readFileSync(churchesPath, "utf-8"));
const churchSlugs = new Set(churches.map((c) => c.slug));

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== SEEDING NETWORKS ===");

  // 1. Fetch all enrichments with denomination_network
  const { data: enrichments, error } = await sb
    .from("church_enrichments")
    .select("id, church_slug, candidate_id, denomination_network, official_church_name, street_address, latitude, longitude")
    .not("denomination_network", "is", null)
    .eq("enrichment_status", "complete");

  if (error) {
    console.error("Error fetching enrichments:", error.message);
    process.exit(1);
  }

  console.log(`Found ${enrichments.length} enrichments with denomination_network`);

  // 2. Match enrichments to known networks
  const networkMatches = new Map(); // networkSlug -> enrichment[]

  for (const enrichment of enrichments) {
    const dn = (enrichment.denomination_network || "").toLowerCase();

    for (const network of KNOWN_NETWORKS) {
      const matched = network.patterns.some((p) => dn.includes(p));
      if (matched) {
        if (!networkMatches.has(network.slug)) {
          networkMatches.set(network.slug, []);
        }
        networkMatches.get(network.slug).push(enrichment);
        break;
      }
    }
  }

  console.log(`\nMatched networks:`);
  for (const [slug, matches] of networkMatches) {
    console.log(`  ${slug}: ${matches.length} enrichments`);
  }

  if (dryRun) {
    for (const [slug, matches] of networkMatches) {
      console.log(`\n--- ${slug} ---`);
      for (const m of matches) {
        console.log(`  ${m.official_church_name || m.church_slug || m.candidate_id}`);
      }
    }
    return;
  }

  // 3. Create networks
  for (const network of KNOWN_NETWORKS) {
    const matches = networkMatches.get(network.slug);
    if (!matches || matches.length === 0) continue;

    // Validate parent church slug exists
    const parentSlug = churchSlugs.has(network.parentChurchSlug)
      ? network.parentChurchSlug
      : null;

    if (!parentSlug) {
      console.log(`  Note: ${network.slug} parent church slug "${network.parentChurchSlug}" not found in churches.json`);
    }

    // Upsert network
    const { data: networkRow, error: netErr } = await sb
      .from("church_networks")
      .upsert(
        {
          slug: network.slug,
          name: network.name,
          website: network.website,
          parent_church_slug: parentSlug,
          headquarters_country: network.headquartersCountry,
          founded: network.founded,
        },
        { onConflict: "slug" }
      )
      .select()
      .single();

    if (netErr) {
      console.error(`Error upserting network ${network.slug}:`, netErr.message);
      continue;
    }

    console.log(`\nCreated/updated network: ${network.name} (${networkRow.id})`);

    // 4. Create campuses from enrichments
    for (const enrichment of matches) {
      // Skip if this enrichment is directly linked to a worship artist
      if (enrichment.church_slug && churchSlugs.has(enrichment.church_slug)) {
        console.log(`  Skipping ${enrichment.church_slug} (is worship artist)`);
        continue;
      }

      const campusName = enrichment.official_church_name || `${network.name} Campus`;
      const campusSlug = enrichment.church_slug || slugify(campusName);

      const { data: campusRow, error: campErr } = await sb
        .from("church_campuses")
        .upsert(
          {
            slug: campusSlug,
            network_id: networkRow.id,
            name: campusName,
            city: null, // Will be enriched later from address parsing
            country: null,
            status: "published",
            discovered_by: "seed-script",
          },
          { onConflict: "slug" }
        )
        .select()
        .single();

      if (campErr) {
        console.error(`  Error creating campus ${campusSlug}:`, campErr.message);
        continue;
      }

      // 5. Link enrichment to campus
      const { error: linkErr } = await sb
        .from("church_enrichments")
        .update({ campus_id: campusRow.id })
        .eq("id", enrichment.id);

      if (linkErr) {
        console.error(`  Error linking enrichment to campus ${campusSlug}:`, linkErr.message);
      } else {
        console.log(`  Campus: ${campusName} → ${campusSlug}`);
      }
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
