#!/usr/bin/env node
/**
 * Import Pinsebevegelsen (Norway) church directory.
 *
 * Source: https://pinsebevegelsen.no/menighet/kirker/{region} →
 * /menighet/kirke/people_organization/{id} per church.
 *
 * Extracts name, address, phone, email (if present), website per church
 * detail page. Writes to church_enrichments and updates churches.email/
 * phone/website where missing.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const REGIONS = [
  "agder", "innlandet", "moreogromsdal", "nord", "oslo",
  "ostfoldogfollo", "rogaland", "telemark", "trondelag",
  "vestfoldogbuskerud", "vestland",
];

const BASE = "https://pinsebevegelsen.no";
const FETCH_TIMEOUT = 8_000;
const CONCURRENCY = 8;
const DRY = process.argv.includes("--dry-run");
const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function getChurchList(region) {
  const html = await fetchHtml(`${BASE}/menighet/kirker/${region}`);
  if (!html) return [];
  const re = /<a href="\/menighet\/kirke\/people_organization\/(\d+)">([^<]+)<\/a>[\s\S]{0,200}?(?:<div class="organization-info">([^<]+)<\/div>)?/g;
  const out = [];
  for (const m of html.matchAll(re)) {
    out.push({ id: m[1], name: m[2].trim(), info: (m[3] || "").trim(), region });
  }
  // Dedupe by id (the regex may match the same record with and without info)
  const seen = new Map();
  for (const c of out) {
    if (!seen.has(c.id) || (c.info && !seen.get(c.id).info)) seen.set(c.id, c);
  }
  return [...seen.values()];
}

function extractDetail(html, urlBase) {
  // Address — find the contact-value div with address-part spans
  const addrMatch = html.match(/<td[^>]*class="contact-value">([\s\S]*?)<\/td>/);
  let address = null;
  if (addrMatch) {
    const parts = [...addrMatch[1].matchAll(/<span>([^<]*)<\/span>/g)]
      .map(m => m[1].trim()).filter(Boolean).filter(p => p.toLowerCase() !== "norge");
    if (parts.length > 0) address = parts.join(", ");
  }
  // Email
  const emails = [...html.matchAll(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)]
    .map(m => m[0].toLowerCase())
    .filter(e => !e.includes("pinsebevegelsen.no"))
    .filter(e => !e.endsWith(".png") && !e.endsWith(".jpg"));
  const email = emails[0] || null;
  // Phone — only accept tel: links (most reliable, avoids asset IDs)
  const phones = [...html.matchAll(/href="tel:([+\d][\d\s\-().]{6,})"/g)]
    .map(m => {
      const digits = m[1].replace(/[\s\-().]/g, "");
      return digits;
    })
    .filter(p => p.length >= 8 && p.length <= 14);
  const phone = phones[0] || null;
  // Website — first non-pinsebevegelsen, non-social external link
  const websites = [...html.matchAll(/href="(https?:\/\/(?!www\.pinsebevegelsen\.no|pinsebevegelsen\.no|d1nizz91i54auc|www\.facebook|facebook|www\.instagram|instagram|www\.youtube|youtube|maps\.google)[^"]+)"/g)]
    .map(m => m[1])
    .filter(u => !u.includes("/static/") && !u.includes(".css") && !u.includes(".js"));
  const website = websites[0] || null;

  return { address, email, phone, website };
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  console.log(`Crawling ${REGIONS.length} regions...`);
  const allChurches = [];
  for (const region of REGIONS) {
    const list = await getChurchList(region);
    console.log(`  ${region}: ${list.length} churches`);
    allChurches.push(...list);
  }
  console.log(`Total: ${allChurches.length} church entries`);

  // Fetch detail pages in parallel
  console.log("Fetching detail pages...");
  let cursor = 0;
  let done = 0;
  const results = [];
  await Promise.all(Array(CONCURRENCY).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= allChurches.length) return;
      const ch = allChurches[i];
      const html = await fetchHtml(`${BASE}/menighet/kirke/people_organization/${ch.id}`);
      if (html) {
        const detail = extractDetail(html, BASE);
        results.push({ ...ch, ...detail });
      } else {
        results.push({ ...ch, address: null, email: null, phone: null, website: null });
      }
      done++;
      if (done % 50 === 0) process.stdout.write(`\r  ${done}/${allChurches.length}`);
    }
  }));
  console.log(`\nFetched ${results.length} detail pages`);

  // Match against DB
  const dbRows = await sql`SELECT slug, name FROM churches WHERE country='Norway' AND status='approved'`;
  const byName = new Map();
  const bySlug = new Map();
  for (const r of dbRows) {
    byName.set(r.name.toLowerCase().trim(), r);
    bySlug.set(r.slug, r);
  }
  console.log(`DB has ${dbRows.length} Norwegian churches`);

  let matched = 0;
  const matches = [];
  const unmatched = [];
  for (const r of results) {
    let dbHit = byName.get(r.name.toLowerCase().trim());
    if (!dbHit) dbHit = bySlug.get(slugify(r.name));
    if (!dbHit && r.info) dbHit = byName.get(r.info.toLowerCase().trim());
    if (!dbHit && r.info) dbHit = bySlug.get(slugify(r.info));
    if (dbHit) {
      matched++;
      matches.push({ ...r, slug: dbHit.slug });
    } else {
      unmatched.push(r.name);
    }
  }
  console.log(`Matched: ${matched}, unmatched: ${unmatched.length}`);
  if (unmatched.length > 0) console.log("First unmatched:", unmatched.slice(0, 8));

  // Track unmatched results for potential new-record import
  const unmatchedResults = results.filter(r => {
    const titleLower = r.name.toLowerCase().trim();
    if (byName.get(titleLower)) return false;
    if (bySlug.get(slugify(r.name))) return false;
    if (r.info && byName.get(r.info.toLowerCase().trim())) return false;
    if (r.info && bySlug.get(slugify(r.info))) return false;
    return true;
  });

  if (DRY) {
    console.log("\nSample 3:");
    for (const m of matches.slice(0, 3)) {
      console.log(`  slug: ${m.slug} | name: ${m.name}`);
      console.log(`    addr: ${m.address}`);
      console.log(`    email: ${m.email} | phone: ${m.phone} | site: ${m.website}`);
    }
    return;
  }

  // Apply
  let written = 0, websitesAdded = 0, emailsAdded = 0, phonesAdded = 0;
  for (const m of matches) {
    const sourcesJson = JSON.stringify({
      pinsebevegelsen_no: { id: m.id, region: m.region, fetched_at: new Date().toISOString() },
    });
    try {
      await sql`
        INSERT INTO church_enrichments (
          church_slug, street_address, website_url, contact_email, phone,
          sources, schema_version, enrichment_status, last_enriched_at, created_at, updated_at
        ) VALUES (
          ${m.slug}, ${m.address}, ${m.website}, ${m.email}, ${m.phone},
          ${sourcesJson}::jsonb, 1, 'partial', NOW(), NOW(), NOW()
        )
        ON CONFLICT (church_slug) DO UPDATE SET
          street_address = COALESCE(church_enrichments.street_address, EXCLUDED.street_address),
          website_url = COALESCE(church_enrichments.website_url, EXCLUDED.website_url),
          contact_email = COALESCE(church_enrichments.contact_email, EXCLUDED.contact_email),
          phone = COALESCE(church_enrichments.phone, EXCLUDED.phone),
          sources = COALESCE(church_enrichments.sources, '{}'::jsonb) || EXCLUDED.sources,
          last_enriched_at = NOW(),
          updated_at = NOW()
      `;
      if (m.website || m.email || m.phone) {
        await sql`
          UPDATE churches SET
            website = COALESCE(NULLIF(website, ''), ${m.website}),
            email = COALESCE(NULLIF(email, ''), ${m.email}),
            phone = COALESCE(NULLIF(phone, ''), ${m.phone}),
            updated_at = NOW()
          WHERE slug = ${m.slug}
        `;
        if (m.website) websitesAdded++;
        if (m.email) emailsAdded++;
        if (m.phone) phonesAdded++;
      }
      written++;
    } catch (e) {
      console.error("\nFailed for", m.slug, e.message?.slice(0, 80));
    }
  }
  console.log(`\nDone. Wrote ${written}. +${websitesAdded} sites, +${emailsAdded} emails, +${phonesAdded} phones.`);

  // Optional: import unmatched as new churches
  if (process.argv.includes("--import-missing")) {
    console.log(`\nImporting ${unmatchedResults.length} new Norwegian churches...`);
    let imported = 0, skipped = 0;
    for (const r of unmatchedResults) {
      const baseSlug = slugify(r.name);
      if (!baseSlug) { skipped++; continue; }
      // Check for slug collision (rare but safe)
      const existing = await sql`SELECT slug FROM churches WHERE slug = ${baseSlug}`;
      if (existing.length > 0) { skipped++; continue; }
      // Extract city from address (last word usually) for location
      let location = null;
      if (r.address) {
        const parts = r.address.split(",").map(s => s.trim());
        // Norwegian address pattern: "Streetname N, NNNN City"
        const last = parts[parts.length - 1];
        const cityMatch = last && last.match(/\d{4}\s+(.+)/);
        location = cityMatch ? cityMatch[1].trim() : (parts[parts.length - 1] || null);
      }
      try {
        await sql`
          INSERT INTO churches (
            slug, name, country, location, website, email, phone,
            status, source_kind, reason, discovery_source,
            created_at, updated_at
          ) VALUES (
            ${baseSlug}, ${r.name}, 'Norway', ${location}, ${r.website}, ${r.email}, ${r.phone},
            'approved', 'discovered', 'directory-import:pinsebevegelsen', 'pinsebevegelsen.no',
            NOW(), NOW()
          )
        `;
        // Also write enrichment record
        const sourcesJson = JSON.stringify({ pinsebevegelsen_no: { id: r.id, region: r.region, fetched_at: new Date().toISOString() } });
        await sql`
          INSERT INTO church_enrichments (
            church_slug, street_address, website_url, contact_email, phone,
            sources, schema_version, enrichment_status, last_enriched_at, created_at, updated_at
          ) VALUES (
            ${baseSlug}, ${r.address}, ${r.website}, ${r.email}, ${r.phone},
            ${sourcesJson}::jsonb, 1, 'partial', NOW(), NOW(), NOW()
          ) ON CONFLICT (church_slug) DO NOTHING
        `;
        imported++;
        if (imported % 50 === 0) process.stdout.write(`\r  imported ${imported}`);
      } catch (e) {
        skipped++;
        console.error("\nSkipped", baseSlug, e.message?.slice(0, 80));
      }
    }
    console.log(`\nNew churches imported: ${imported}, skipped: ${skipped}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
