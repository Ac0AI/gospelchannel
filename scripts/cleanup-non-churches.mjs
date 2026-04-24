#!/usr/bin/env node

/**
 * Cleanup: remove non-church entries (artists, brands, labels) from the churches table.
 *
 * Actions:
 *   1. DELETE pure artists/bands/labels
 *   2. MERGE worship teams into their parent church (move Spotify data, then delete)
 *   3. RENAME worship brands to their actual church name (where no parent exists)
 *
 * Usage:
 *   node scripts/cleanup-non-churches.mjs              # run
 *   node scripts/cleanup-non-churches.mjs --dry-run    # preview only
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");

// ── 1. Pure deletes (artists, bands, labels, brands) ─────────────────────────

const DELETE_SLUGS = [
  "rend-collective",           // Irish worship band
  "maverick-city",             // Artist collective
  "influence-music",           // Record label
  "hillsong-worship",          // Artist brand (Hillsong locations exist)
  "hillsong-young-free",       // Artist brand
  "young-free",                // Artist brand (duplicate)
  "vineyard-nordic-worship",   // Brand (Vineyard churches exist separately)
  "new-wine-worship",          // Brand/network
  "bethel-music-kids",         // Artist brand
  "worship-music",             // Unclear entry (Nigeria)
  "oslo-gospel-choir",         // Norwegian touring choir, not a congregation
  "soweto-gospel-choir",       // South African touring choir
  "oslo-church-music-festival",// Music festival, not a church
  "worship-and-music",         // Department page from Birmingham Cathedral
];

// ── 2. Merge worship team → parent church (move Spotify, delete team) ────────

const MERGES = [
  {
    from: "vous-worship",
    to: "vous-church",
    label: "VOUS Worship → Vous Church",
  },
  {
    from: "jpcc-worship",
    to: "jpcc-jakarta-praise-community-church",
    label: "JPCC Worship → JPCC (Jakarta Praise Community Church)",
  },
  {
    from: "mosaic-msc",
    to: "mosaic-church",
    label: "Mosaic MSC → Mosaic Church",
  },
];

// ── 3. Rename brand → actual church name ─────────────────────────────────────

const RENAMES = [
  {
    oldSlug: "bethel-music",
    newSlug: "bethel-church-redding",
    newName: "Bethel Church Redding",
    newDescription: "Charismatic megachurch in Northern California, home of the Bethel Music worship movement. Known for supernatural ministry and a global influence on worship culture.",
    newLocation: "Redding, California",
    newDenomination: "Charismatic",
    newWebsite: "https://www.bethel.com/",
    label: "Bethel Music → Bethel Church Redding",
  },
  {
    oldSlug: "elevation-worship",
    newSlug: "elevation-church",
    newName: "Elevation Church",
    newDescription: "Multi-site megachurch based in Charlotte, North Carolina, led by Steven Furtick. Their worship team Elevation Worship is one of the most-streamed in the world.",
    newLocation: "Charlotte, North Carolina",
    newDenomination: "Non-denominational",
    newWebsite: "https://elevationchurch.org/",
    label: "Elevation Worship → Elevation Church",
  },
  {
    oldSlug: "gateway-worship",
    newSlug: "gateway-church-southlake",
    newName: "Gateway Church",
    newDescription: "One of the largest churches in America, based in the Dallas-Fort Worth area. Founded by Robert Morris, known for a strong worship culture.",
    newLocation: "Southlake, Texas",
    newDenomination: "Non-denominational",
    newWebsite: "https://gatewaypeople.com/",
    label: "Gateway Worship → Gateway Church",
  },
  {
    oldSlug: "red-rocks-worship",
    newSlug: "red-rocks-church",
    newName: "Red Rocks Church",
    newDescription: "Fast-growing multi-site church in Colorado known for creative, high-energy worship and reaching unchurched communities.",
    newLocation: "Littleton, Colorado",
    newDenomination: "Non-denominational",
    newWebsite: "https://redrockschurch.com/",
    label: "Red Rocks Worship → Red Rocks Church",
  },
  {
    oldSlug: "bethany-music",
    newSlug: "bethany-church-baton-rouge",
    newName: "Bethany Church",
    newDescription: "Global charismatic church family headquartered in Baton Rouge, Louisiana. Active missions network and vibrant worship culture.",
    newLocation: "Baton Rouge, Louisiana",
    newDenomination: "Charismatic",
    newWebsite: "https://bethany.com/",
    label: "Bethany Music → Bethany Church",
  },
  {
    oldSlug: "welcome-church-music",
    newSlug: "welcome-church-woking",
    newName: "Welcome Church",
    newDescription: "Non-denominational church in Woking, United Kingdom. An active congregation gathering for Sunday worship, small groups, and community outreach.",
    newLocation: "Woking, United Kingdom",
    newDenomination: "Non-denominational",
    newWebsite: "https://welcomechurch.co.uk/",
    label: "Welcome Church Music → Welcome Church (Woking)",
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nChurch cleanup: remove non-church entries\n`);
  if (DRY_RUN) console.log("  (dry run - no database writes)\n");

  let deleted = 0;
  let merged = 0;
  let renamed = 0;

  // 1. Deletes
  console.log("--- DELETING artists/bands/labels ---");
  for (const slug of DELETE_SLUGS) {
    const [row] = await sql`SELECT slug, name FROM churches WHERE slug = ${slug}`;
    if (!row) {
      console.log(`  skip ${slug} (not found)`);
      continue;
    }
    console.log(`  delete ${row.name} (${slug})`);
    if (!DRY_RUN) {
      await sql`DELETE FROM churches WHERE slug = ${slug}`;
    }
    deleted++;
  }

  // 2. Merges
  console.log("\n--- MERGING worship teams into parent churches ---");
  for (const merge of MERGES) {
    const [from] = await sql`SELECT slug, name, spotify_url, spotify_artist_ids, spotify_playlist_ids, music_style FROM churches WHERE slug = ${merge.from}`;
    const [to] = await sql`SELECT slug, name, spotify_url FROM churches WHERE slug = ${merge.to}`;

    if (!from) {
      console.log(`  skip ${merge.label} (source not found)`);
      continue;
    }
    if (!to) {
      console.log(`  skip ${merge.label} (target not found)`);
      continue;
    }

    console.log(`  merge ${from.name} → ${to.name}`);
    console.log(`    Moving spotify_url: ${from.spotify_url || "none"}`);
    console.log(`    Moving artist_ids: ${JSON.stringify(from.spotify_artist_ids)}`);

    if (!DRY_RUN) {
      // Move Spotify data to parent church
      await sql`
        UPDATE churches SET
          spotify_url = COALESCE(${from.spotify_url}, spotify_url),
          spotify_artist_ids = CASE
            WHEN ${from.spotify_artist_ids}::text[] IS NOT NULL AND array_length(${from.spotify_artist_ids}::text[], 1) > 0
            THEN ${from.spotify_artist_ids}
            ELSE spotify_artist_ids
          END,
          spotify_playlist_ids = CASE
            WHEN ${from.spotify_playlist_ids}::text[] IS NOT NULL AND array_length(${from.spotify_playlist_ids}::text[], 1) > 0
            THEN ${from.spotify_playlist_ids}
            ELSE spotify_playlist_ids
          END,
          music_style = CASE
            WHEN ${from.music_style}::text[] IS NOT NULL AND array_length(${from.music_style}::text[], 1) > 0
            THEN ${from.music_style}
            ELSE music_style
          END,
          updated_at = now()
        WHERE slug = ${merge.to}
      `;
      // Delete the worship team entry
      await sql`DELETE FROM churches WHERE slug = ${merge.from}`;
    }
    merged++;
  }

  // 3. Renames
  console.log("\n--- RENAMING worship brands to actual churches ---");
  for (const r of RENAMES) {
    const [old] = await sql`SELECT slug, name, spotify_url, spotify_artist_ids, spotify_playlist_ids, music_style FROM churches WHERE slug = ${r.oldSlug}`;
    if (!old) {
      console.log(`  skip ${r.label} (not found)`);
      continue;
    }

    // Check new slug doesn't already exist
    const [conflict] = await sql`SELECT slug FROM churches WHERE slug = ${r.newSlug}`;
    if (conflict) {
      console.log(`  skip ${r.label} (target slug ${r.newSlug} already exists)`);
      continue;
    }

    console.log(`  rename ${old.name} → ${r.newName} (${r.oldSlug} → ${r.newSlug})`);

    if (!DRY_RUN) {
      // Insert new church entry with old Spotify data
      await sql`
        INSERT INTO churches (
          slug, name, description, country, location, denomination,
          website, language, music_style,
          spotify_url, spotify_artist_ids, spotify_playlist_ids,
          source_kind, status, confidence, reason,
          discovery_source, discovered_at, created_at, updated_at
        )
        SELECT
          ${r.newSlug},
          ${r.newName},
          ${r.newDescription},
          country,
          ${r.newLocation},
          ${r.newDenomination},
          ${r.newWebsite},
          language,
          music_style,
          spotify_url,
          spotify_artist_ids,
          spotify_playlist_ids,
          source_kind,
          status,
          confidence,
          ${"Renamed from " + r.oldSlug + ": brand → actual church (2026-04-02)"},
          discovery_source,
          discovered_at,
          created_at,
          now()
        FROM churches WHERE slug = ${r.oldSlug}
      `;
      // Delete old entry
      await sql`DELETE FROM churches WHERE slug = ${r.oldSlug}`;
    }
    renamed++;
  }

  console.log(`\nDone! Deleted: ${deleted}, Merged: ${merged}, Renamed: ${renamed}`);
  if (DRY_RUN) console.log("(dry run - no changes made)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
