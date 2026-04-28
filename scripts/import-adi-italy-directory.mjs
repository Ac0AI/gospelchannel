#!/usr/bin/env node
/**
 * Import ADI Italy church directory data.
 *
 * Source: https://www.assembleedidio.org/dove-siamo/ via the WP plugin's
 * AJAX endpoint (action=get_chiese, large radius). 962 official records
 * with address, lat/lng, region/provincia, service times.
 *
 * Matches each ADI record to an existing church by slug pattern
 * `adi-{slug-of-nome}`, then upserts into `church_enrichments` (street
 * address, coords, service times, region as denomination_network suffix,
 * source attribution).
 *
 * Bypasses the church_website_tech path entirely; this is geo + meeting
 * times data, not platform detection.
 *
 * Usage:
 *   node scripts/import-adi-italy-directory.mjs --dry-run
 *   node scripts/import-adi-italy-directory.mjs
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DRY = process.argv.includes("--dry-run");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[()]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function candidateSlug(nome) {
  return `adi-${slugify(nome)}`;
}

// Convert "Mar. ore 20.30 - Giov. ore 20.30 - Dom. ore 10.15" into structured array
function parseServiceTimes(descrizione) {
  if (!descrizione) return null;
  const text = String(descrizione).trim();
  if (!text) return null;
  // Just store the raw italian text as one entry; UI can render directly.
  return [text];
}

async function main() {
  const churches = JSON.parse(readFileSync("/tmp/adi-italy/all.json", "utf8"));
  console.log(`Loaded ${churches.length} ADI records`);

  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  // Build map of all italian church slugs in DB for fast match
  const dbRows = await sql`SELECT slug FROM churches WHERE country='Italy' AND status='approved'`;
  const dbSlugs = new Set(dbRows.map(r => r.slug));
  console.log(`DB has ${dbSlugs.size} Italian church slugs`);

  // Match
  const matches = [];
  const unmatched = [];
  for (const ch of churches) {
    const slug = candidateSlug(ch.nome);
    if (dbSlugs.has(slug)) {
      matches.push({ slug, adi: ch });
    } else {
      // Try slug variants for parens like "Acconia (Curinga)" → "adi-acconia-curinga"
      // Already handled by slugify replacing parens. Edge cases:
      const variants = [
        slug,
        `adi-${slugify(ch.nome.replace(/\([^)]+\)/g, "").trim())}`,
        `adi-${slugify(ch.nome + " " + (ch.citta || ""))}`,
      ];
      const hit = variants.find(v => dbSlugs.has(v));
      if (hit) matches.push({ slug: hit, adi: ch });
      else unmatched.push(ch.nome);
    }
  }
  console.log(`Matched: ${matches.length}, unmatched: ${unmatched.length}`);
  if (unmatched.length > 0 && unmatched.length <= 30) {
    console.log("First unmatched:", unmatched.slice(0, 15));
  }

  if (DRY) {
    console.log("\nSample 3 matches:");
    for (const m of matches.slice(0, 3)) {
      console.log("  slug:", m.slug);
      console.log("    address:", m.adi.indirizzo);
      console.log("    coords: ", m.adi.lat, m.adi.lng);
      console.log("    region: ", m.adi.regione, m.adi.provincia);
      console.log("    times:  ", parseServiceTimes(m.adi.descrizione));
      console.log("    site:   ", m.adi.sito || "(none)");
    }
    console.log("\nDRY RUN — no DB writes.");
    return;
  }

  console.log(`\nWriting ${matches.length} records to church_enrichments...`);
  let written = 0;
  let websitesWritten = 0;
  for (const { slug, adi } of matches) {
    const lat = adi.lat ? parseFloat(adi.lat) : null;
    const lng = adi.lng ? parseFloat(adi.lng) : null;
    const serviceTimes = parseServiceTimes(adi.descrizione);
    const website = adi.sito && adi.sito.trim() ? adi.sito.trim() : null;
    const sourcesJson = JSON.stringify({
      adi_italy: {
        id: adi.id,
        nome: adi.nome,
        provincia: adi.provincia,
        regione: adi.regione,
        fetched_at: new Date().toISOString(),
      },
    });

    try {
      await sql`
        INSERT INTO church_enrichments (
          church_slug, street_address, latitude, longitude, service_times,
          website_url, sources, schema_version, enrichment_status, last_enriched_at,
          created_at, updated_at
        ) VALUES (
          ${slug}, ${adi.indirizzo || null}, ${lat}, ${lng},
          ${serviceTimes ? JSON.stringify(serviceTimes) : null}::jsonb,
          ${website},
          ${sourcesJson}::jsonb,
          1, 'partial', NOW(), NOW(), NOW()
        )
        ON CONFLICT (church_slug) DO UPDATE SET
          street_address = COALESCE(church_enrichments.street_address, EXCLUDED.street_address),
          latitude = COALESCE(church_enrichments.latitude, EXCLUDED.latitude),
          longitude = COALESCE(church_enrichments.longitude, EXCLUDED.longitude),
          service_times = COALESCE(church_enrichments.service_times, EXCLUDED.service_times),
          website_url = COALESCE(church_enrichments.website_url, EXCLUDED.website_url),
          sources = COALESCE(church_enrichments.sources, '{}'::jsonb) || EXCLUDED.sources,
          last_enriched_at = NOW(),
          updated_at = NOW()
      `;

      // Also push the website to churches.website if missing
      if (website) {
        await sql`
          UPDATE churches SET website = COALESCE(website, ${website}), updated_at = NOW()
          WHERE slug = ${slug} AND (website IS NULL OR website = '')
        `;
        websitesWritten += 1;
      }
      written += 1;
      if (written % 100 === 0) process.stdout.write(`\r  ${written}/${matches.length}`);
    } catch (e) {
      console.error("\nFailed for", slug, e.message?.slice(0, 100));
    }
  }
  console.log(`\nDone. Wrote ${written} enrichment records, ${websitesWritten} new websites.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
