#!/usr/bin/env node
/**
 * Import Pingst Sweden church directory data.
 *
 * Source: https://www.pingst.se/wp-json/wpgmza/v1/markers (WP Google Maps
 * plugin endpoint, public, ~1.4MB JSON, 2617 markers).
 *
 * Per marker: title (church name), address, lat/lng, link (website),
 * description (often contains email + phone). Description format like:
 *   "pingst.fransta@gmail.com <br> "
 *   "kontakt@sionforsamlingen.se <br> 031-968200"
 *
 * Matches each marker to existing churches by:
 * 1. Exact title match against churches.name
 * 2. Slug derived from title
 *
 * Writes to church_enrichments (street_address, lat, lng, website,
 * contact_email, phone) and updates churches.email/phone/website if missing.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const ENDPOINT = "https://www.pingst.se/wp-json/wpgmza/v1/markers";
const DRY = process.argv.includes("--dry-run");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDescription(html) {
  const text = String(html || "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  // Swedish phone formats: 08-123456, 031-968200, 0701234567, +46 8 123456
  const phoneMatch = text.match(/(?:\+46\s*\d|\b0\d{1,3})[\s\-]?\d{2,4}[\s\-]?\d{2,5}\b/);
  return {
    email: emailMatch ? emailMatch[0].toLowerCase() : null,
    phone: phoneMatch ? phoneMatch[0].trim() : null,
  };
}

async function main() {
  console.log(`Fetching ${ENDPOINT}...`);
  const res = await fetch(ENDPOINT, { headers: { "User-Agent": "Mozilla/5.0" } });
  const markers = await res.json();
  console.log(`Got ${markers.length} markers from Pingst SE`);

  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  // Load all Swedish church names + slugs from DB
  const dbRows = await sql`SELECT slug, name FROM churches WHERE country='Sweden' AND status='approved'`;
  const byName = new Map();
  const bySlug = new Map();
  for (const r of dbRows) {
    byName.set(r.name.toLowerCase(), r);
    bySlug.set(r.slug, r);
  }
  console.log(`DB has ${dbRows.length} Swedish churches`);

  let matched = 0;
  let unmatched = 0;
  const matches = [];
  const unmatchedNames = [];

  for (const m of markers) {
    if (!m.title) continue;
    const titleLower = m.title.toLowerCase().trim();
    const slug = slugify(m.title);

    let dbHit = byName.get(titleLower);
    if (!dbHit) dbHit = bySlug.get(slug);
    if (!dbHit) {
      // Try without "Pingstförsamlingen " prefix
      const alt = titleLower.replace(/^pingstförsamlingen\s+/, "").replace(/^pingstkyrkan\s+/, "");
      dbHit = byName.get(alt) || bySlug.get(slugify(alt));
    }

    if (dbHit) {
      matches.push({ marker: m, slug: dbHit.slug });
      matched += 1;
    } else {
      unmatchedNames.push(m.title);
      unmatched += 1;
    }
  }

  console.log(`Matched: ${matched}, unmatched: ${unmatched}`);
  if (unmatchedNames.length > 0 && unmatchedNames.length <= 30) {
    console.log("First unmatched:", unmatchedNames.slice(0, 10));
  }

  if (DRY) {
    console.log("\nSample 3 matches:");
    for (const m of matches.slice(0, 3)) {
      const parsed = parseDescription(m.marker.description);
      console.log(`  slug: ${m.slug}`);
      console.log(`    title:   ${m.marker.title}`);
      console.log(`    address: ${m.marker.address}`);
      console.log(`    coords:  ${m.marker.lat}, ${m.marker.lng}`);
      console.log(`    website: ${m.marker.link}`);
      console.log(`    email:   ${parsed.email}`);
      console.log(`    phone:   ${parsed.phone}`);
    }
    console.log("\nDRY RUN — no DB writes.");
    return;
  }

  console.log(`\nWriting ${matches.length} records...`);
  let written = 0;
  let websitesAdded = 0;
  let emailsAdded = 0;
  let phonesAdded = 0;

  for (const { marker: m, slug } of matches) {
    const parsed = parseDescription(m.description);
    const lat = m.lat ? parseFloat(m.lat) : null;
    const lng = m.lng ? parseFloat(m.lng) : null;
    const website = m.link && m.link.trim() && m.link.startsWith("http") ? m.link.trim() : null;
    const sourcesJson = JSON.stringify({
      pingst_se: { id: m.id, fetched_at: new Date().toISOString() },
    });

    try {
      await sql`
        INSERT INTO church_enrichments (
          church_slug, street_address, latitude, longitude,
          website_url, contact_email, phone, sources, schema_version, enrichment_status,
          last_enriched_at, created_at, updated_at
        ) VALUES (
          ${slug}, ${m.address || null}, ${lat}, ${lng},
          ${website}, ${parsed.email}, ${parsed.phone},
          ${sourcesJson}::jsonb, 1, 'partial', NOW(), NOW(), NOW()
        )
        ON CONFLICT (church_slug) DO UPDATE SET
          street_address = COALESCE(church_enrichments.street_address, EXCLUDED.street_address),
          latitude = COALESCE(church_enrichments.latitude, EXCLUDED.latitude),
          longitude = COALESCE(church_enrichments.longitude, EXCLUDED.longitude),
          website_url = COALESCE(church_enrichments.website_url, EXCLUDED.website_url),
          contact_email = COALESCE(church_enrichments.contact_email, EXCLUDED.contact_email),
          phone = COALESCE(church_enrichments.phone, EXCLUDED.phone),
          sources = COALESCE(church_enrichments.sources, '{}'::jsonb) || EXCLUDED.sources,
          last_enriched_at = NOW(),
          updated_at = NOW()
      `;

      // Push to churches table where missing
      if (website || parsed.email || parsed.phone) {
        const result = await sql`
          UPDATE churches SET
            website = COALESCE(NULLIF(website, ''), ${website}),
            email = COALESCE(NULLIF(email, ''), ${parsed.email}),
            phone = COALESCE(NULLIF(phone, ''), ${parsed.phone}),
            updated_at = NOW()
          WHERE slug = ${slug}
          RETURNING (website IS NOT NULL) AS w, (email IS NOT NULL) AS e, (phone IS NOT NULL) AS p
        `;
        if (website) websitesAdded += 1;
        if (parsed.email) emailsAdded += 1;
        if (parsed.phone) phonesAdded += 1;
      }
      written += 1;
      if (written % 100 === 0) process.stdout.write(`\r  ${written}/${matches.length}`);
    } catch (e) {
      console.error("\nFailed for", slug, e.message?.slice(0, 100));
    }
  }
  console.log(`\nDone. Wrote ${written} enrichment records.`);
  console.log(`  Websites added (where missing): ${websitesAdded}`);
  console.log(`  Emails added: ${emailsAdded}`);
  console.log(`  Phones added: ${phonesAdded}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
