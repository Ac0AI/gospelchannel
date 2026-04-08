#!/usr/bin/env node

/**
 * Backfill emails for churches by crawling contact pages.
 * Usage:
 *   node scripts/backfill-emails.mjs [--dry-run]
 *   node scripts/backfill-emails.mjs --status=approved --countries="United Kingdom,Germany,Sweden"
 *   node scripts/backfill-emails.mjs --status=approved --limit=50
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
const sql = neon(DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");

const FETCH_TIMEOUT = 10_000;
const CONCURRENCY = 5;
const CONTACT_PATHS = [
  "", "/contact", "/contact-us", "/about", "/about-us",
  "/connect", "/visit", "/new-here", "/kontakt", "/om",
  "/get-in-touch", "/info", "/impressum",
];

// Emails to ignore (generic, hosting, spam, placeholder patterns)
const IGNORED_EMAIL_PATTERNS = [
  /noreply/i, /no-reply/i, /support@wix/i, /support@squarespace/i,
  /support@churchwebworks/i, /admin@wordpress/i, /example\.com/i,
  /test@/i, /webmaster@/i, /postmaster@/i, /user@domain/i,
  /info@mysite/i, /email@example/i, /your-email@/i, /name@domain/i,
  /^example@/i, /@mysite\./i, /@example\./i, /yourname@/i, /firstname.*lastname@/i,
  /@domain\.com/i, /@yourdomain/i, /@yourchurch/i, /placeholder/i,
];

function extractEmails(html) {
  // Match emails in href="mailto:..." and plain text
  const mailtoPattern = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  const plainPattern = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;

  const found = new Set();
  for (const m of html.matchAll(mailtoPattern)) found.add(m[1].toLowerCase());
  for (const m of html.matchAll(plainPattern)) found.add(m[0].toLowerCase());

  // Filter out junk
  return [...found].filter(email =>
    !IGNORED_EMAIL_PATTERNS.some(p => p.test(email)) &&
    !email.endsWith(".png") && !email.endsWith(".jpg") &&
    !email.includes("sentry") && !email.includes("cloudflare")
  );
}

function pickBestEmail(emails, churchName) {
  if (emails.length === 0) return null;
  if (emails.length === 1) return emails[0];

  // Prefer info@, contact@, office@, hello@, church-specific
  const priorities = ["info@", "contact@", "office@", "hello@", "admin@", "pastor@", "mail@"];
  for (const prefix of priorities) {
    const match = emails.find(e => e.startsWith(prefix));
    if (match) return match;
  }

  // Return first non-personal email
  return emails[0];
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
        Accept: "text/html",
      },
      redirect: "follow",
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

  const allEmails = new Set();
  let baseUrl;
  try {
    baseUrl = new URL(church.website).origin;
  } catch {
    return null;
  }

  // Try contact pages in parallel (2 at a time)
  for (let i = 0; i < CONTACT_PATHS.length; i += 2) {
    const batch = CONTACT_PATHS.slice(i, i + 2);
    const pages = await Promise.all(
      batch.map(path => fetchPage(`${baseUrl}${path}`))
    );
    for (const html of pages) {
      if (html) {
        for (const email of extractEmails(html)) allEmails.add(email);
      }
    }
    // Stop early if we found emails
    if (allEmails.size > 0 && i >= 2) break;
  }

  return pickBestEmail([...allEmails], church.name);
}

function parseFlag(name, fallback = null) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

async function main() {
  const STATUS_LIST = (parseFlag("status", "pending") || "pending").split(",").map(s => s.trim()).filter(Boolean);
  const COUNTRIES_RAW = parseFlag("countries");
  const COUNTRIES = COUNTRIES_RAW ? COUNTRIES_RAW.split(",").map(c => c.trim()).filter(Boolean) : null;
  const LIMIT = parseInt(parseFlag("limit", "0"), 10) || 0;

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Status filter: ${STATUS_LIST.join(", ")}`);
  console.log(`Country filter: ${COUNTRIES ? COUNTRIES.join(", ") : "all"}`);
  console.log(`Limit: ${LIMIT || "none"}\n`);

  let query = `
    SELECT slug, name, website, email, country
    FROM churches
    WHERE status = ANY($1::text[])
      AND (email IS NULL OR email = '')
      AND website IS NOT NULL AND website != ''
  `;
  const params = [STATUS_LIST];

  if (COUNTRIES) {
    query += ` AND country = ANY($${params.length + 1}::text[])`;
    params.push(COUNTRIES);
  }

  query += ` ORDER BY country, name`;

  if (LIMIT > 0) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(LIMIT);
  }

  const churches = await sql.query(query, params);

  console.log(`Found ${churches.length} churches without email matching filters\n`);

  let found = 0;
  let missed = 0;

  for (let i = 0; i < churches.length; i += CONCURRENCY) {
    const batch = churches.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (church) => {
        const email = await findEmailForChurch(church);
        if (email) {
          console.log(`✅ ${church.slug}: ${email}`);
          if (!DRY_RUN) {
            await sql.query(`UPDATE churches SET email = $1 WHERE slug = $2`, [email, church.slug]);
          }
          found++;
        } else {
          console.log(`⏭ ${church.slug}: no email found`);
          missed++;
        }
        return { slug: church.slug, email };
      })
    );
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Found: ${found}`);
  console.log(`Missed: ${missed}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
