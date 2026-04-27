#!/usr/bin/env node
/**
 * Two-phase email backfill that minimizes Neon compute time.
 *
 * Phase 1 (crawl): one short Neon read to load targets, disconnect, then
 * crawl every church website over plain HTTP, appending {slug, email|null}
 * to a local JSONL file. Zero Neon writes during this phase, which is
 * the long one (hours).
 *
 * Phase 2 (apply): re-open Neon for a single batched UPDATE that writes
 * all found emails in one connection burst (seconds).
 *
 * Designed to be safe to resume: if interrupted, re-run skips slugs that
 * already appear in the JSONL file.
 *
 * Usage:
 *   node scripts/offline-email-crawl.mjs --output=/tmp/emails.jsonl
 *   node scripts/offline-email-crawl.mjs --output=/tmp/emails.jsonl --limit=200 --dry-run
 *   node scripts/offline-email-crawl.mjs --apply-only --output=/tmp/emails.jsonl
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

const CONTACT_PATHS = [
  "", "/contact", "/contact-us", "/about", "/about-us",
  "/connect", "/visit", "/new-here", "/kontakt", "/om",
  "/get-in-touch", "/info", "/impressum",
];

const IGNORED_EMAIL_PATTERNS = [
  /noreply/i, /no-reply/i, /support@wix/i, /support@squarespace/i,
  /support@churchwebworks/i, /admin@wordpress/i, /example\.com/i,
  /test@/i, /webmaster@/i, /postmaster@/i, /user@domain/i,
  /info@mysite/i, /email@example/i, /your-email@/i, /name@domain/i,
  /^example@/i, /@mysite\./i, /@example\./i, /yourname@/i, /firstname.*lastname@/i,
  /@domain\.com/i, /@yourdomain/i, /@yourchurch/i, /placeholder/i,
];

const PRIORITY_PREFIXES = ["info@", "contact@", "office@", "hello@", "admin@", "pastor@", "mail@"];

function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

function extractEmails(html) {
  const mailto = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  const plain = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const found = new Set();
  for (const m of html.matchAll(mailto)) found.add(m[1].toLowerCase());
  for (const m of html.matchAll(plain)) found.add(m[0].toLowerCase());
  return [...found].filter((email) =>
    !IGNORED_EMAIL_PATTERNS.some((p) => p.test(email)) &&
    !email.endsWith(".png") && !email.endsWith(".jpg") &&
    !email.includes("sentry") && !email.includes("cloudflare")
  );
}

function pickBestEmail(emails) {
  if (emails.length === 0) return null;
  if (emails.length === 1) return emails[0];
  for (const p of PRIORITY_PREFIXES) {
    const m = emails.find((e) => e.startsWith(p));
    if (m) return m;
  }
  return emails[0];
}

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
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function findEmailForChurch(church) {
  if (!church.website) return null;
  let baseUrl;
  try { baseUrl = new URL(church.website.startsWith("http") ? church.website : `https://${church.website}`).origin; }
  catch { return null; }

  const allEmails = new Set();
  for (let i = 0; i < CONTACT_PATHS.length; i += 2) {
    const batch = CONTACT_PATHS.slice(i, i + 2);
    const pages = await Promise.all(batch.map((p) => fetchPage(`${baseUrl}${p}`)));
    for (const html of pages) {
      if (html) for (const email of extractEmails(html)) allEmails.add(email);
    }
    if (allEmails.size > 0 && i >= 2) break;
  }
  return pickBestEmail([...allEmails]);
}

/* ── Phase 1 ── */

async function fetchTargets(sql, limit) {
  const rows = await sql`
    SELECT slug, name, website, country
    FROM churches
    WHERE status = 'approved'
      AND (email IS NULL OR email = '')
      AND website IS NOT NULL AND website <> ''
    ORDER BY country, name
    ${limit > 0 ? sql`LIMIT ${limit}` : sql``}
  `;
  return rows;
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
  let found = 0;
  const startedAt = Date.now();

  let cursor = 0;
  await Promise.all(Array(CONCURRENCY).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= remaining.length) return;
      const church = remaining[i];
      const email = await findEmailForChurch(church).catch(() => null);
      appendFileSync(outputFile, JSON.stringify({ slug: church.slug, email, ts: Date.now() }) + "\n");
      processed += 1;
      if (email) found += 1;
      if (processed % 200 === 0) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = processed / elapsed;
        const eta = Math.round((remaining.length - processed) / rate / 60);
        console.log(`  ${processed}/${remaining.length} | found=${found} (${(100*found/processed).toFixed(1)}%) | ${rate.toFixed(1)}/sec | ETA ${eta}min`);
      }
    }
  }));

  console.log(`Phase 1 done. Processed ${processed}, found ${found} (${(100*found/processed).toFixed(1)}%) in ${((Date.now()-startedAt)/60000).toFixed(1)} min.`);
}

/* ── Phase 2 ── */

async function applyPhase(sql, outputFile, dryRun) {
  if (!existsSync(outputFile)) {
    console.error(`No file at ${outputFile}, nothing to apply.`);
    return;
  }
  const lines = readFileSync(outputFile, "utf8").split("\n").filter(Boolean);
  const matches = [];
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      if (r.email) matches.push({ slug: r.slug, email: r.email });
    } catch {}
  }
  console.log(`\nPhase 2 (apply): ${matches.length} matches to write to Neon`);
  if (dryRun) { console.log("DRY RUN — not writing."); return; }
  if (matches.length === 0) return;

  // Single Neon session, batched UNNEST UPDATE
  const BATCH = 500;
  let written = 0;
  const startedAt = Date.now();
  for (let i = 0; i < matches.length; i += BATCH) {
    const slice = matches.slice(i, i + BATCH);
    const slugs = slice.map((m) => m.slug);
    const emails = slice.map((m) => m.email);
    await sql`
      UPDATE churches
      SET email = data.email, updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(${slugs}::text[], ${emails}::text[]) AS t(slug, email)
      ) AS data
      WHERE churches.slug = data.slug AND (churches.email IS NULL OR churches.email = '')
    `;
    written += slice.length;
    process.stdout.write(`\r  ${written}/${matches.length}`);
  }
  console.log(`\nPhase 2 done in ${((Date.now()-startedAt)/1000).toFixed(1)}s.`);
}

/* ── Main ── */

async function main() {
  const outputFile = parseFlag("output", "/tmp/email-crawl.jsonl");
  const limit = parseInt(parseFlag("limit", "0"), 10) || 0;
  const dryRun = process.argv.includes("--dry-run");
  const applyOnly = process.argv.includes("--apply-only");

  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  if (!applyOnly) {
    const targets = await fetchTargets(sql, limit);
    console.log(`Fetched ${targets.length} targets from Neon (one query, then disconnect for crawl phase)`);
    const alreadyProcessed = readProcessedSlugs(outputFile);
    await crawlPhase(targets, outputFile, alreadyProcessed);
  }

  await applyPhase(sql, outputFile, dryRun);
}

main().catch((e) => { console.error(e); process.exit(1); });
