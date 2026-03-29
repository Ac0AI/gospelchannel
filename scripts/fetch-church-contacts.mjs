#!/usr/bin/env node

/**
 * Fetch contact emails from church websites.
 * Run: node scripts/fetch-church-contacts.mjs
 *
 * Checks homepage + /contact page for mailto: links and common email patterns.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = resolve(__dirname, "../src/data/churches.json");

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Emails to ignore (tracking pixels, generic services, etc.)
const IGNORE_PATTERNS = [
  /noreply/i, /no-reply/i, /donotreply/i,
  /sentry\.io/i, /wixpress/i, /cloudflare/i, /google/i,
  /facebook/i, /twitter/i, /example\.com/i,
  /webpack/i, /localhost/i, /schema\.org/i,
  /protection/i, /email-protection/i,
  /@sentry/i, /@test/i, /@email/i,
  /\.(png|jpg|svg|gif|css|js)$/i,
];

function isValidEmail(email) {
  if (email.length > 60) return false;
  if (IGNORE_PATTERNS.some((p) => p.test(email))) return false;
  // Must have reasonable TLD
  const tld = email.split(".").pop();
  if (!tld || tld.length < 2 || tld.length > 6) return false;
  return true;
}

function scoreEmail(email, churchDomain) {
  let score = 0;
  const lower = email.toLowerCase();
  // Prefer emails on the church's own domain
  if (churchDomain && lower.includes(churchDomain)) score += 10;
  // Prefer contact/info/hello addresses
  if (/^(contact|info|hello|worship|music|booking|press|media)@/.test(lower)) score += 5;
  // Gmail/outlook are ok but less authoritative
  if (/@gmail|@outlook|@yahoo|@hotmail/i.test(lower)) score -= 2;
  return score;
}

async function fetchPage(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannel/1.0)" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const text = await res.text();
    return text;
  } catch {
    return "";
  }
}

function extractEmails(html) {
  // Decode mailto: links and find email patterns
  const decoded = html
    .replace(/&#64;/g, "@")
    .replace(/\[at\]/gi, "@")
    .replace(/%40/g, "@");
  const matches = decoded.match(EMAIL_REGEX) || [];
  return [...new Set(matches)].filter(isValidEmail);
}

function getDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname;
  } catch {
    return "";
  }
}

async function findContactEmail(website) {
  const domain = getDomain(website);
  const baseUrl = website.replace(/\/$/, "");

  // Try homepage first
  let html = await fetchPage(baseUrl);
  let emails = extractEmails(html);

  // Try common contact pages if homepage didn't yield results
  if (emails.length === 0) {
    for (const path of ["/contact", "/contact-us", "/about", "/connect"]) {
      html = await fetchPage(`${baseUrl}${path}`);
      emails = extractEmails(html);
      if (emails.length > 0) break;
    }
  }

  if (emails.length === 0) return null;

  // Score and pick best
  emails.sort((a, b) => scoreEmail(b, domain) - scoreEmail(a, domain));
  return emails[0];
}

async function main() {
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));
  let found = 0;
  let skipped = 0;

  for (let i = 0; i < churches.length; i++) {
    const church = churches[i];

    if (church.email) {
      console.log(`[${i + 1}/${churches.length}] ${church.name} — already has email: ${church.email}`);
      skipped++;
      continue;
    }

    if (!church.website) {
      console.log(`[${i + 1}/${churches.length}] ${church.name} — no website, skipping`);
      continue;
    }

    console.log(`[${i + 1}/${churches.length}] ${church.name} — checking ${church.website}`);
    const email = await findContactEmail(church.website);

    if (email) {
      church.email = email;
      found++;
      console.log(`  → Found: ${email}`);
    } else {
      console.log(`  → No email found`);
    }

    // Small delay
    await new Promise((r) => setTimeout(r, 300));
  }

  writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
  console.log(`\nDone! Found emails: ${found}, Skipped: ${skipped}, Total: ${churches.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
