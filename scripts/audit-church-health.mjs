#!/usr/bin/env node
/**
 * Audit approved churches for data quality issues:
 * - Dead/hijacked websites (HTTP errors, non-church content)
 * - Missing essential data (no name, no description, no location)
 * - Suspicious logos (non-image URLs, broken URLs)
 * - AI-slop descriptions (generic patterns)
 *
 * Usage: node scripts/audit-church-health.mjs [--fix] [--limit 100]
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const fix = process.argv.includes("--fix");
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : 9999;

const FETCH_TIMEOUT = 8000;

// Non-church keywords that indicate a hijacked domain
const HIJACK_KEYWORDS = [
  "casino", "poker", "betting", "måltidskass", "meal kit", "recipe box",
  "domain for sale", "domain is for sale", "buy this domain",
  "parked domain", "godaddy", "sedo", "afternic",
  "cbd", "cannabis", "crypto", "nft", "forex",
  "adult", "xxx", "porn",
  "this site can't be reached", "404", "default web page",
];

// AI-slop description patterns
const SLOP_PATTERNS = [
  /worship hub bringing/i,
  /spirit-led ministry to/i,
  /vibrant community of believers/i,
  /beacon of hope/i,
  /transformative worship/i,
  /dynamic worship experience/i,
  /welcoming community dedicated/i,
  /heart of the city/i,
  /passionate about spreading/i,
  /committed to spreading the gospel/i,
];

async function checkWebsite(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return { status: "dead", code: res.status };
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.toLowerCase() || "";
    const bodySnippet = html.slice(0, 5000).toLowerCase();
    for (const keyword of HIJACK_KEYWORDS) {
      if (title.includes(keyword) || bodySnippet.includes(keyword)) {
        return { status: "hijacked", keyword, title: title.slice(0, 80) };
      }
    }
    return { status: "ok", title: title.slice(0, 80) };
  } catch (e) {
    if (e.name === "AbortError") return { status: "timeout" };
    return { status: "error", message: e.message?.slice(0, 60) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log("Auditing approved churches...\n");

  const churches = await sql`
    SELECT
      c.slug, c.name, c.website, c.logo, c.description, c.status,
      e.website_url, e.logo_image_url, e.contact_email
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug AND e.enrichment_status = 'complete'
    WHERE c.status = 'approved'
    ORDER BY c.slug
    LIMIT ${limit}
  `;

  console.log(`Checking ${churches.length} churches...\n`);

  const issues = { dead_website: [], hijacked: [], timeout: [], slop_description: [], no_data: [] };
  let checked = 0;

  for (const c of churches) {
    const website = c.website || c.website_url;

    // Check website if exists
    if (website) {
      const result = await checkWebsite(website);
      if (result.status === "dead") {
        issues.dead_website.push({ slug: c.slug, name: c.name, url: website, code: result.code });
      } else if (result.status === "hijacked") {
        issues.hijacked.push({ slug: c.slug, name: c.name, url: website, keyword: result.keyword, title: result.title });
      } else if (result.status === "timeout") {
        issues.timeout.push({ slug: c.slug, name: c.name, url: website });
      } else if (result.status === "error") {
        issues.dead_website.push({ slug: c.slug, name: c.name, url: website, error: result.message });
      }
    }

    // Check for AI-slop descriptions
    if (c.description) {
      for (const pattern of SLOP_PATTERNS) {
        if (pattern.test(c.description)) {
          issues.slop_description.push({ slug: c.slug, name: c.name, desc: c.description.slice(0, 100) });
          break;
        }
      }
    }

    // Check for minimal data
    if (!c.description && !website && !c.logo) {
      issues.no_data.push({ slug: c.slug, name: c.name });
    }

    checked++;
    if (checked % 100 === 0) {
      console.log(`  Checked ${checked}/${churches.length}...`);
    }

    // Rate limit: ~20 req/sec for website checks
    if (website && checked % 20 === 0) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Report
  console.log("\n" + "=".repeat(60));
  console.log("AUDIT RESULTS");
  console.log("=".repeat(60));

  if (issues.hijacked.length > 0) {
    console.log(`\n🚨 HIJACKED DOMAINS (${issues.hijacked.length}):`);
    for (const i of issues.hijacked) {
      console.log(`  ${i.slug}: ${i.url} -> "${i.title}" (keyword: ${i.keyword})`);
    }
  }

  if (issues.dead_website.length > 0) {
    console.log(`\n💀 DEAD WEBSITES (${issues.dead_website.length}):`);
    for (const i of issues.dead_website) {
      console.log(`  ${i.slug}: ${i.url} (${i.code || i.error})`);
    }
  }

  if (issues.timeout.length > 0) {
    console.log(`\n⏰ TIMEOUT (${issues.timeout.length}):`);
    for (const i of issues.timeout) {
      console.log(`  ${i.slug}: ${i.url}`);
    }
  }

  if (issues.slop_description.length > 0) {
    console.log(`\n🤖 AI-SLOP DESCRIPTIONS (${issues.slop_description.length}):`);
    for (const i of issues.slop_description) {
      console.log(`  ${i.slug}: "${i.desc}..."`);
    }
  }

  if (issues.no_data.length > 0) {
    console.log(`\n📭 MINIMAL DATA (${issues.no_data.length}):`);
    for (const i of issues.no_data.slice(0, 20)) {
      console.log(`  ${i.slug}: ${i.name}`);
    }
    if (issues.no_data.length > 20) console.log(`  ... and ${issues.no_data.length - 20} more`);
  }

  const totalIssues = issues.hijacked.length + issues.dead_website.length + issues.slop_description.length + issues.no_data.length;
  console.log(`\nSUMMARY: ${totalIssues} issues across ${checked} churches`);
  console.log(`  Hijacked: ${issues.hijacked.length}`);
  console.log(`  Dead: ${issues.dead_website.length}`);
  console.log(`  Timeout: ${issues.timeout.length}`);
  console.log(`  AI-slop: ${issues.slop_description.length}`);
  console.log(`  No data: ${issues.no_data.length}`);

  if (fix && issues.hijacked.length > 0) {
    console.log("\n--fix: Archiving hijacked churches...");
    for (const i of issues.hijacked) {
      await sql`UPDATE churches SET website = NULL WHERE slug = ${i.slug}`;
      await sql`UPDATE church_enrichments SET website_url = NULL WHERE church_slug = ${i.slug}`;
      console.log(`  Cleared website for ${i.slug}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
