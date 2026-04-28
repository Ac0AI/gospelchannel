#!/usr/bin/env node
/**
 * Two-phase rich extraction from church websites.
 *
 * Phase 1 (crawl): one short Neon read to load targets, then crawl every
 * church website over plain HTTP, extracting email + phone + social URLs +
 * podcast + donate + service times. Appends results to a JSONL file. Zero
 * Neon writes during this phase.
 *
 * Phase 2 (apply): re-open Neon for a single batched UPSERT-style UPDATE
 * that writes all extracted fields in one connection burst.
 *
 * Why this exists: we already pay the HTTP cost when crawling for emails.
 * Each homepage contains ~5x more useful structured data (phone, social,
 * service times) that we were throwing away. This script extracts every
 * field we know how to find, all in one pass.
 *
 * Resumable via JSONL output file: re-run skips slugs that already appear.
 *
 * Usage:
 *   node scripts/extract-church-data-from-website.mjs --output=/tmp/scrape.jsonl
 *   node scripts/extract-church-data-from-website.mjs --output=/tmp/scrape.jsonl --limit=50 --dry-run
 *   node scripts/extract-church-data-from-website.mjs --apply-only --output=/tmp/scrape.jsonl
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const FETCH_TIMEOUT = 10_000;
const CONCURRENCY = 8;
const HTML_CAP_BYTES = 600_000;

const CONTACT_PATHS = [
  "", "/contact", "/contact-us", "/about", "/about-us",
  "/connect", "/visit", "/new-here", "/kontakt", "/om",
  "/get-in-touch", "/info", "/impressum", "/services", "/sundays",
];

const IGNORED_EMAIL_PATTERNS = [
  /noreply/i, /no-reply/i, /support@wix/i, /support@squarespace/i,
  /support@churchwebworks/i, /admin@wordpress/i, /example\.com/i,
  /test@/i, /webmaster@/i, /postmaster@/i, /user@domain/i,
  /info@mysite/i, /email@example/i, /your-email@/i, /name@domain/i,
  /^example@/i, /@mysite\./i, /@example\./i, /yourname@/i, /firstname.*lastname@/i,
  /@domain\.com/i, /@yourdomain/i, /@yourchurch/i, /placeholder/i,
];

const PRIORITY_EMAIL_PREFIXES = ["info@", "contact@", "office@", "hello@", "admin@", "pastor@", "mail@"];

function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

/* ── Email ── */

function extractEmails(html) {
  const mailto = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  const plain = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const found = new Set();
  for (const m of html.matchAll(mailto)) found.add(m[1].toLowerCase());
  for (const m of html.matchAll(plain)) found.add(m[0].toLowerCase());
  return [...found].filter((e) =>
    !IGNORED_EMAIL_PATTERNS.some((p) => p.test(e)) &&
    !e.endsWith(".png") && !e.endsWith(".jpg") &&
    !e.includes("sentry") && !e.includes("cloudflare") &&
    !e.includes("@sentry.io") && !e.includes("@2x.png")
  );
}

function pickBestEmail(emails) {
  if (emails.length === 0) return null;
  if (emails.length === 1) return emails[0];
  for (const p of PRIORITY_EMAIL_PREFIXES) {
    const m = emails.find((e) => e.startsWith(p));
    if (m) return m;
  }
  return emails[0];
}

/* ── Phone ── */

function extractPhone(html) {
  // tel: links are most reliable
  const telLink = /tel:([+\d][\d\s().\-]{6,})/gi;
  for (const m of html.matchAll(telLink)) {
    const cleaned = m[1].replace(/[\s().\-]/g, "");
    if (cleaned.length >= 7 && cleaned.length <= 18) return cleaned;
  }
  // International format with +
  const intl = /(\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{0,4})/g;
  for (const m of html.matchAll(intl)) {
    const cleaned = m[1].replace(/[\s().\-]/g, "");
    if (cleaned.length >= 8 && cleaned.length <= 16) return cleaned;
  }
  // US-style (xxx) xxx-xxxx
  const us = /\(?\b\d{3}\)?[\s\-.]\d{3}[\s\-.]\d{4}\b/g;
  for (const m of html.matchAll(us)) {
    return m[0];
  }
  return null;
}

/* ── Social URLs ── */

function extractFirstUrl(html, hostPattern) {
  const re = new RegExp(`https?://(?:www\\.)?${hostPattern}/[^\\s"'<>]+`, "gi");
  const matches = html.match(re);
  if (!matches || matches.length === 0) return null;
  // Filter out share/intent URLs and trailing junk
  for (const url of matches) {
    if (url.includes("/sharer") || url.includes("/share?") || url.includes("intent/")) continue;
    if (url.includes("plugins.facebook.com") || url.includes("facebook.com/tr")) continue;
    // Strip trailing punctuation/quotes/closing tags
    return url.replace(/[<>"',.;)]+$/, "").split('"')[0].split("'")[0].split("?")[0];
  }
  return null;
}

function extractFacebook(html) {
  return extractFirstUrl(html, "facebook\\.com");
}
function extractInstagram(html) {
  return extractFirstUrl(html, "instagram\\.com");
}
function extractTiktok(html) {
  return extractFirstUrl(html, "tiktok\\.com");
}
function extractApplePodcast(html) {
  const re = /https?:\/\/podcasts\.apple\.com\/[a-z]{2}\/podcast\/[^\s"'<>]+/gi;
  const m = html.match(re);
  return m ? m[0].replace(/[<>"',.;)]+$/, "").split('"')[0].split("'")[0] : null;
}

/* ── Donate ── */

const DONATE_PATTERNS = [
  /https?:\/\/(?:www\.)?givelify\.com\/[^\s"'<>]+/gi,
  /https?:\/\/(?:www\.)?tithe\.ly\/[^\s"'<>]+/gi,
  /https?:\/\/[a-z0-9-]+\.tithe\.ly\/[^\s"'<>]*/gi,
  /https?:\/\/(?:www\.)?pushpay\.com\/[^\s"'<>]+/gi,
  /https?:\/\/(?:www\.)?planningcenter\.com\/giving\/[^\s"'<>]+/gi,
  /https?:\/\/(?:www\.)?easytithe\.com\/[^\s"'<>]+/gi,
  /https?:\/\/(?:www\.)?subsplash\.com\/[^\s"'<>]+\/give/gi,
  /https?:\/\/(?:www\.)?secure\.qgiv\.com\/[^\s"'<>]+/gi,
];

function extractDonate(html) {
  for (const re of DONATE_PATTERNS) {
    const m = html.match(re);
    if (m) return m[0].replace(/[<>"',.;)]+$/, "").split('"')[0].split("'")[0];
  }
  return null;
}

/* ── Service times (heuristic) ── */

function extractServiceTimes(html) {
  // Strip HTML tags to plain text for more reliable matching
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const dayWords = "(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sundays|söndag|sön|sun)";
  // Looser pattern: day word within 0-30 chars of a time
  const re = new RegExp(`\\b${dayWords}[s]?\\b[^.!?]{0,60}?\\b(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.))`, "gi");

  const times = new Set();
  for (const m of text.matchAll(re)) {
    const matchText = m[0].slice(0, 80).replace(/\s+/g, " ").trim();
    times.add(matchText);
    if (times.size >= 5) break;
  }
  return times.size > 0 ? [...times] : null;
}

/* ── Fetch ── */

async function fetchPage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > HTML_CAP_BYTES ? text.slice(0, HTML_CAP_BYTES) : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeChurch(church) {
  if (!church.website) return null;
  let baseUrl;
  try {
    baseUrl = new URL(church.website.startsWith("http") ? church.website : `https://${church.website}`).origin;
  } catch {
    return null;
  }

  const allHtml = [];
  for (let i = 0; i < CONTACT_PATHS.length; i += 2) {
    const batch = CONTACT_PATHS.slice(i, i + 2);
    const pages = await Promise.all(batch.map((p) => fetchPage(`${baseUrl}${p}`)));
    for (const html of pages) {
      if (html) allHtml.push(html);
    }
    // Stop once we have 3+ pages: enough to find the data we need
    if (allHtml.length >= 3) break;
  }

  if (allHtml.length === 0) return null;
  const combined = allHtml.join("\n");

  // Email
  const emails = extractEmails(combined);
  const email = pickBestEmail(emails);

  return {
    email,
    phone: extractPhone(combined),
    facebook_url: extractFacebook(combined),
    instagram_url: extractInstagram(combined),
    tiktok_url: extractTiktok(combined),
    apple_podcast_url: extractApplePodcast(combined),
    donate_url: extractDonate(combined),
    service_times: extractServiceTimes(combined),
  };
}

/* ── Phase 1: crawl ── */

async function fetchTargets(sql, limit) {
  return await sql`
    SELECT slug, name, website, country
    FROM churches
    WHERE status = 'approved'
      AND website IS NOT NULL AND website <> ''
      AND website_extracted_at IS NULL
    ORDER BY country, name
    ${limit > 0 ? sql`LIMIT ${limit}` : sql``}
  `;
}

function readProcessedSlugs(outputFile) {
  if (!existsSync(outputFile)) return new Set();
  const lines = readFileSync(outputFile, "utf8").split("\n").filter(Boolean);
  const slugs = new Set();
  for (const line of lines) {
    try { slugs.add(JSON.parse(line).slug); } catch {}
  }
  return slugs;
}

async function crawlPhase(targets, outputFile, alreadyProcessed) {
  const remaining = targets.filter((t) => !alreadyProcessed.has(t.slug));
  console.log(`Phase 1 (crawl): ${remaining.length} to crawl (${alreadyProcessed.size} already in ${outputFile})`);
  if (remaining.length === 0) return;

  let processed = 0;
  let withAnyData = 0;
  const startedAt = Date.now();

  let cursor = 0;
  await Promise.all(Array(CONCURRENCY).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= remaining.length) return;
      const church = remaining[i];
      const data = await scrapeChurch(church).catch(() => null);
      const record = { slug: church.slug, ...(data || {}), ts: Date.now() };
      appendFileSync(outputFile, JSON.stringify(record) + "\n");
      processed += 1;
      if (data && Object.values(data).some((v) => v)) withAnyData += 1;
      if (processed % 200 === 0) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = processed / elapsed;
        const eta = Math.round((remaining.length - processed) / rate / 60);
        console.log(`  ${processed}/${remaining.length} | with data=${withAnyData} (${(100*withAnyData/processed).toFixed(0)}%) | ${rate.toFixed(1)}/sec | ETA ${eta}min`);
      }
    }
  }));

  console.log(`Phase 1 done. ${processed} processed, ${withAnyData} had at least one field (${(100*withAnyData/processed).toFixed(1)}%) in ${((Date.now()-startedAt)/60000).toFixed(1)} min.`);
}

/* ── Phase 2: apply ── */

async function applyPhase(sql, outputFile, dryRun) {
  if (!existsSync(outputFile)) {
    console.error(`No file at ${outputFile}, nothing to apply.`);
    return;
  }
  const lines = readFileSync(outputFile, "utf8").split("\n").filter(Boolean);
  const records = [];
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      records.push(r);
    } catch {}
  }

  // Stats per field
  const stats = { email: 0, phone: 0, facebook_url: 0, instagram_url: 0, tiktok_url: 0, apple_podcast_url: 0, donate_url: 0, service_times: 0 };
  for (const r of records) {
    for (const k of Object.keys(stats)) if (r[k]) stats[k] += 1;
  }
  console.log(`\nPhase 2 (apply): ${records.length} records to write to Neon`);
  console.log("Field hit counts:", stats);

  if (dryRun) { console.log("DRY RUN — not writing."); return; }
  if (records.length === 0) return;

  const BATCH = 300;
  let written = 0;
  const startedAt = Date.now();

  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH);
    const slugs = slice.map((r) => r.slug);
    const emails = slice.map((r) => r.email || null);
    const phones = slice.map((r) => r.phone || null);
    const fbs = slice.map((r) => r.facebook_url || null);
    const igs = slice.map((r) => r.instagram_url || null);
    const tts = slice.map((r) => r.tiktok_url || null);
    const aps = slice.map((r) => r.apple_podcast_url || null);
    const dns = slice.map((r) => r.donate_url || null);
    const sts = slice.map((r) => (r.service_times ? JSON.stringify(r.service_times) : null));

    await sql`
      UPDATE churches
      SET
        email = COALESCE(NULLIF(churches.email, ''), data.email_v),
        phone = COALESCE(churches.phone, data.phone_v),
        facebook_url = COALESCE(churches.facebook_url, data.fb_v),
        instagram_url = COALESCE(churches.instagram_url, data.ig_v),
        tiktok_url = COALESCE(churches.tiktok_url, data.tt_v),
        apple_podcast_url = COALESCE(churches.apple_podcast_url, data.ap_v),
        donate_url = COALESCE(churches.donate_url, data.dn_v),
        service_times = COALESCE(churches.service_times, data.st_v::jsonb),
        website_extracted_at = NOW(),
        updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(
          ${slugs}::text[],
          ${emails}::text[],
          ${phones}::text[],
          ${fbs}::text[],
          ${igs}::text[],
          ${tts}::text[],
          ${aps}::text[],
          ${dns}::text[],
          ${sts}::text[]
        ) AS t(slug, email_v, phone_v, fb_v, ig_v, tt_v, ap_v, dn_v, st_v)
      ) AS data
      WHERE churches.slug = data.slug
    `;
    written += slice.length;
    process.stdout.write(`\r  ${written}/${records.length}`);
  }
  console.log(`\nPhase 2 done in ${((Date.now()-startedAt)/1000).toFixed(1)}s.`);
}

/* ── Main ── */

async function main() {
  const outputFile = parseFlag("output", "/tmp/website-scrape.jsonl");
  const limit = parseInt(parseFlag("limit", "0"), 10) || 0;
  const dryRun = process.argv.includes("--dry-run");
  const applyOnly = process.argv.includes("--apply-only");

  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  if (!applyOnly) {
    const targets = await fetchTargets(sql, limit);
    console.log(`Fetched ${targets.length} targets from Neon`);
    const alreadyProcessed = readProcessedSlugs(outputFile);
    await crawlPhase(targets, outputFile, alreadyProcessed);
  }

  await applyPhase(sql, outputFile, dryRun);
}

main().catch((e) => { console.error(e); process.exit(1); });
