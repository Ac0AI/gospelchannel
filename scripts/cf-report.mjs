#!/usr/bin/env node

/**
 * Cloudflare weekly report for gospelchannel.com.
 *
 * Pulls request totals, blocked requests, top blocked rules, cache stats,
 * and top countries from Cloudflare's GraphQL Analytics API. Compared
 * against the previous period so trajectory shows.
 *
 * Usage:
 *   node scripts/cf-report.mjs                  # default 7-day report
 *   node scripts/cf-report.mjs --days=28        # last 28 days vs previous 28
 *   node scripts/cf-report.mjs --json           # machine-readable JSON
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN  with Zone:Analytics:Read scope on the zone
 *   CLOUDFLARE_ZONE_ID    e.g. fdbbb865c3c520e9a914a015a20345c7
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE = process.env.CLOUDFLARE_ZONE_ID;
const GQL = "https://api.cloudflare.com/client/v4/graphql";

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const args = process.argv.slice(2);
const DAYS = parseInt(args.find(a => a.startsWith("--days="))?.split("=")[1] || "7", 10);
const JSON_OUTPUT = args.includes("--json");

function fmtDate(d) {
  return d.toISOString().split("T")[0];
}

export function getRanges(days) {
  const now = new Date();
  const currentEnd = new Date(now);
  const currentStart = new Date(now);
  currentStart.setDate(currentEnd.getDate() - days);
  const previousEnd = new Date(currentStart);
  previousEnd.setSeconds(previousEnd.getSeconds() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - days);
  return {
    current: { start: currentStart.toISOString(), end: currentEnd.toISOString(), startDate: fmtDate(currentStart), endDate: fmtDate(currentEnd) },
    previous: { start: previousStart.toISOString(), end: previousEnd.toISOString(), startDate: fmtDate(previousStart), endDate: fmtDate(previousEnd) },
  };
}

async function gql(query, variables) {
  if (!TOKEN) throw new Error("Missing CLOUDFLARE_API_TOKEN");
  if (!ZONE) throw new Error("Missing CLOUDFLARE_ZONE_ID");
  const res = await fetch(GQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(`Cloudflare GraphQL: ${data.errors.map(e => e.message).join("; ")}`);
  return data.data;
}

async function getTotals(range) {
  // httpRequests1hGroups is capped at 3 days; httpRequests1dGroups has no limit
  // but only daily granularity, so we aggregate the day-rows manually.
  const data = await gql(
    `query($zone: String!, $start: Date!, $end: Date!) {
      viewer { zones(filter: {zoneTag: $zone}) {
        httpRequests1dGroups(filter: {date_geq: $start, date_lt: $end}, limit: 100) {
          sum { requests cachedRequests bytes pageViews threats }
          uniq { uniques }
        }
      } }
    }`,
    { zone: ZONE, start: range.startDate, end: range.endDate },
  );
  const days = data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
  return days.reduce((acc, d) => ({
    visits: acc.visits + (d.uniq?.uniques || 0),
    requests: acc.requests + (d.sum?.requests || 0),
    cachedRequests: acc.cachedRequests + (d.sum?.cachedRequests || 0),
    pageViews: acc.pageViews + (d.sum?.pageViews || 0),
    threats: acc.threats + (d.sum?.threats || 0),
  }), { visits: 0, requests: 0, cachedRequests: 0, pageViews: 0, threats: 0 });
}

async function getBlockedTotals(range) {
  const data = await gql(
    `query($zone: String!, $start: Time!, $end: Time!) {
      viewer { zones(filter: {zoneTag: $zone}) {
        firewallEventsAdaptiveGroups(filter: {datetime_geq: $start, datetime_lt: $end, action: "block"}, limit: 1) {
          count
        }
      } }
    }`,
    { zone: ZONE, start: range.start, end: range.end },
  );
  return data?.viewer?.zones?.[0]?.firewallEventsAdaptiveGroups?.[0]?.count || 0;
}

async function getTopBlockedSources(range, limit = 8) {
  const data = await gql(
    `query($zone: String!, $start: Time!, $end: Time!, $limit: Int!) {
      viewer { zones(filter: {zoneTag: $zone}) {
        firewallEventsAdaptiveGroups(filter: {datetime_geq: $start, datetime_lt: $end, action: "block"}, limit: $limit, orderBy: [count_DESC]) {
          count
          dimensions { source ruleId userAgent }
        }
      } }
    }`,
    { zone: ZONE, start: range.start, end: range.end, limit },
  );
  return data?.viewer?.zones?.[0]?.firewallEventsAdaptiveGroups || [];
}

async function getTopCountries(range, limit = 8) {
  const data = await gql(
    `query($zone: String!, $start: Date!, $end: Date!) {
      viewer { zones(filter: {zoneTag: $zone}) {
        httpRequests1dGroups(filter: {date_geq: $start, date_lt: $end}, limit: 100) {
          sum { countryMap { clientCountryName requests bytes } }
        }
      } }
    }`,
    { zone: ZONE, start: range.startDate, end: range.endDate },
  );
  const days = data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
  const merged = new Map();
  for (const day of days) {
    for (const c of day.sum?.countryMap ?? []) {
      const key = c.clientCountryName || "—";
      const existing = merged.get(key) || { requests: 0, bytes: 0 };
      merged.set(key, {
        requests: existing.requests + (c.requests || 0),
        bytes: existing.bytes + (c.bytes || 0),
      });
    }
  }
  return Array.from(merged.entries())
    .sort((a, b) => b[1].requests - a[1].requests)
    .slice(0, limit)
    .map(([name, agg]) => ({
      dimensions: { clientCountryName: name },
      sum: { visits: agg.requests, requests: agg.requests },
    }));
}

export function delta(now, before) {
  if (!before || before < 5) {
    if (now === before) return "no change";
    return now > before ? `+${(now - before).toLocaleString()} (new)` : `−${(before - now).toLocaleString()}`;
  }
  const pct = ((now - before) / before) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

export async function generateReport(days = 7) {
  const range = getRanges(days);
  const [totals, prevTotals, blocked, prevBlocked, topBlockedSources, topCountries] = await Promise.all([
    getTotals(range.current),
    getTotals(range.previous),
    getBlockedTotals(range.current),
    getBlockedTotals(range.previous),
    getTopBlockedSources(range.current),
    getTopCountries(range.current),
  ]);
  const cacheHitRate = totals.requests > 0 ? totals.cachedRequests / totals.requests : 0;
  return { range, totals, prevTotals, blocked, prevBlocked, topBlockedSources, topCountries, cacheHitRate };
}

function renderText(report) {
  const { range, totals, prevTotals, blocked, prevBlocked, topBlockedSources, topCountries, cacheHitRate } = report;
  const lines = [];
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`  Cloudflare report: gospelchannel.com`);
  lines.push(`  Period:     ${range.current.startDate} → ${range.current.endDate}`);
  lines.push(`  Compared:   ${range.previous.startDate} → ${range.previous.endDate}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push("TRAFFIC TOTALS");
  lines.push("");
  lines.push(`  Visits:        ${totals.visits.toLocaleString()}  (${delta(totals.visits, prevTotals.visits)} vs prev)`);
  lines.push(`  Requests:      ${totals.requests.toLocaleString()}  (${delta(totals.requests, prevTotals.requests)} vs prev)`);
  lines.push(`  Cache hit:     ${(cacheHitRate * 100).toFixed(1)}%`);
  lines.push("");
  lines.push("WAF / BOT BLOCKING");
  lines.push("");
  lines.push(`  Blocked:       ${blocked.toLocaleString()}  (${delta(blocked, prevBlocked)} vs prev)`);
  if (topBlockedSources.length > 0) {
    lines.push("");
    lines.push("  Top reasons:");
    for (const r of topBlockedSources.slice(0, 6)) {
      const src = (r.dimensions?.source || "—").padEnd(15);
      const ua = (r.dimensions?.userAgent || "").slice(0, 40);
      lines.push(`    ${r.count.toString().padStart(6)} · ${src} · ${ua}`);
    }
  }
  lines.push("");
  if (topCountries.length > 0) {
    lines.push("TOP COUNTRIES (by visits)");
    lines.push("");
    for (const r of topCountries.slice(0, 8)) {
      const country = (r.dimensions?.clientCountryName || "—").padEnd(4);
      const visits = String(r.sum.visits).padStart(8);
      lines.push(`  ${country}  ${visits} visits`);
    }
    lines.push("");
  }
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
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
    process.exit(1);
  });
}

export { renderText };
