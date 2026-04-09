#!/usr/bin/env node

/**
 * Monthly GSC report for gospelchannel.com
 *
 * Pulls totals, country breakdown, top queries, top pages, and sitemap
 * status from Google Search Console — and compares to the previous
 * period so you can see trajectory at a glance.
 *
 * Usage:
 *   node scripts/gsc-report.mjs                  # default 28-day report
 *   node scripts/gsc-report.mjs --days=7         # last 7 days vs previous 7
 *   node scripts/gsc-report.mjs --days=90        # last 90 days vs previous 90
 *   node scripts/gsc-report.mjs --json           # machine-readable JSON output
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Load .env.local if it exists — skipped in CI where env vars come from secrets.
try {
  const envFile = fs.readFileSync(path.join(root, ".env.local"), "utf8");
  for (const m of envFile.matchAll(/^([A-Z_]+)=(".*?"|.*?)$/gms)) {
    const [, k, v] = m;
    if (!process.env[k]) process.env[k] = v.startsWith('"') ? v.slice(1, -1) : v;
  }
} catch {
  // No .env.local — expect env vars from the environment directly.
}

export const SITE = "sc-domain:gospelchannel.com";
const SITE_ENC = encodeURIComponent(SITE);
const API = "https://searchconsole.googleapis.com/webmasters/v3";

// Only run CLI main when invoked as a script (not when imported).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
const args = process.argv.slice(2);
const DAYS = parseInt(args.find(a => a.startsWith("--days="))?.split("=")[1] || "28", 10);
const JSON_OUTPUT = args.includes("--json");

export function fmtDate(d) {
  return d.toISOString().split("T")[0];
}

export function getRanges(days) {
  // GSC has a ~3 day delay, but we keep it simple and end at today.
  const currentEnd = new Date();
  const currentStart = new Date();
  currentStart.setDate(currentEnd.getDate() - days);

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - days);

  return {
    current: { start: fmtDate(currentStart), end: fmtDate(currentEnd) },
    previous: { start: fmtDate(previousStart), end: fmtDate(previousEnd) },
  };
}

export function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local");
  }
  return new GoogleAuth({
    credentials: { client_email: email, private_key: key.replace(/\\n/g, "\n") },
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

export async function query(client, body) {
  const res = await client.request({
    url: `${API}/sites/${SITE_ENC}/searchAnalytics/query`,
    method: "POST",
    data: body,
  });
  return res.data.rows || [];
}

export async function getTotals(client, range) {
  const rows = await query(client, {
    startDate: range.start,
    endDate: range.end,
    dimensions: [],
    rowLimit: 1,
  });
  return rows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

export async function getTop(client, range, dimension, limit = 10) {
  return query(client, {
    startDate: range.start,
    endDate: range.end,
    dimensions: [dimension],
    rowLimit: limit,
  });
}

export async function getSitemap(client) {
  try {
    const res = await client.request({
      url: `${API}/sites/${SITE_ENC}/sitemaps`,
    });
    return (res.data.sitemap || [])[0] || null;
  } catch {
    return null;
  }
}

export function delta(now, before) {
  if (!before || before < 5) {
    // Tiny or zero baseline → percentage is misleading. Show absolute change instead.
    if (now === before) return "no change";
    return now > before ? `+${now - before} (new)` : `−${before - now}`;
  }
  const pct = ((now - before) / before) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function renderText(report) {
  const { range, totals, prevTotals, topCountries, topQueries, topPages, sitemap } = report;
  const lines = [];
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`  GSC report: gospelchannel.com`);
  lines.push(`  Period:     ${range.current.start} → ${range.current.end}`);
  lines.push(`  Compared:   ${range.previous.start} → ${range.previous.end}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Totals with deltas
  lines.push("AGGREGATE TOTALS");
  lines.push("");
  lines.push(`  Clicks:      ${totals.clicks.toLocaleString()}  (${delta(totals.clicks, prevTotals.clicks)} vs prev)`);
  lines.push(`  Impressions: ${totals.impressions.toLocaleString()}  (${delta(totals.impressions, prevTotals.impressions)} vs prev)`);
  lines.push(`  CTR:         ${(totals.ctr * 100).toFixed(2)}%  (prev ${(prevTotals.ctr * 100).toFixed(2)}%)`);
  lines.push(`  Avg pos:     ${totals.position.toFixed(1)}  (prev ${prevTotals.position.toFixed(1)})`);
  lines.push("");

  // Sitemap
  if (sitemap) {
    lines.push("SITEMAP");
    lines.push("");
    lines.push(`  Path:        ${sitemap.path}`);
    lines.push(`  Submitted:   ${sitemap.lastSubmitted}`);
    lines.push(`  Downloaded:  ${sitemap.lastDownloaded}`);
    lines.push(`  Errors:      ${sitemap.errors} | Warnings: ${sitemap.warnings}`);
    if (sitemap.contents) {
      for (const c of sitemap.contents) {
        lines.push(`  ${c.type}: submitted=${c.submitted}, indexed=${c.indexed}`);
      }
    }
    lines.push("");
  }

  // Top countries — sort by impressions descending so the meaningful ones come first
  if (topCountries.length > 0) {
    const sorted = [...topCountries].sort((a, b) => b.impressions - a.impressions);
    lines.push(`TOP ${sorted.length} COUNTRIES (by impressions)`);
    lines.push("");
    lines.push("  Country   Clicks  Impressions      CTR  Avg pos");
    lines.push("  -------   ------  -----------  -------  -------");
    for (const r of sorted) {
      const country = r.keys[0].toUpperCase().padEnd(9);
      const clicks = String(r.clicks).padStart(6);
      const imps = String(r.impressions).padStart(13);
      const ctr = `${(r.ctr * 100).toFixed(2)}%`.padStart(8);
      const pos = r.position.toFixed(1).padStart(8);
      lines.push(`  ${country} ${clicks} ${imps} ${ctr} ${pos}`);
    }
    lines.push("");
  }

  // Top queries
  if (topQueries.length > 0) {
    lines.push(`TOP ${topQueries.length} QUERIES (by impressions)`);
    lines.push("");
    for (const r of topQueries) {
      const q = r.keys[0].slice(0, 50);
      lines.push(`  ${r.impressions.toString().padStart(4)} imp · ${r.clicks.toString().padStart(2)} clk · pos ${r.position.toFixed(0).padStart(3)} · ${q}`);
    }
    lines.push("");
  }

  // Top pages
  if (topPages.length > 0) {
    lines.push(`TOP ${topPages.length} PAGES (by impressions)`);
    lines.push("");
    for (const r of topPages) {
      const url = r.keys[0].replace("https://gospelchannel.com", "") || "/";
      const u = url.length > 60 ? url.slice(0, 57) + "..." : url;
      lines.push(`  ${r.impressions.toString().padStart(4)} imp · ${r.clicks.toString().padStart(2)} clk · pos ${r.position.toFixed(0).padStart(3)} · ${u}`);
    }
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  return lines.join("\n");
}

export async function generateReport(days = 28) {
  const range = getRanges(days);
  const auth = getAuth();
  const client = await auth.getClient();

  const [totals, prevTotals, topCountries, topQueries, topPages, sitemap] = await Promise.all([
    getTotals(client, range.current),
    getTotals(client, range.previous),
    getTop(client, range.current, "country", 10),
    getTop(client, range.current, "query", 15),
    getTop(client, range.current, "page", 15),
    getSitemap(client),
  ]);

  return { range, totals, prevTotals, topCountries, topQueries, topPages, sitemap };
}

async function main() {
  const report = await generateReport(DAYS);
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderText(report));
  }
}

if (isMain) {
  main().catch(err => {
    console.error("Error:", err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
    process.exit(1);
  });
}

export { renderText };
