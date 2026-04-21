#!/usr/bin/env node

/**
 * Classify why a church website failed the enrichment fetch, so we can tell
 * "this church is probably closed" from "Firecrawl had a bad day".
 *
 * Reads slugs from a failed-slugs.txt file (format: `slug\treason\n`), looks
 * up each website in the DB, and probes it with:
 *   - DNS lookup (fast: ~10ms when it works, immediate when domain is dead)
 *   - HTTPS HEAD request with 8s timeout
 *   - Retry once on timeout via GET
 *
 * Writes a classified TSV + summary counts. With --apply, sets website=NULL
 * on churches whose domain is dead (no DNS resolution).
 *
 * Usage:
 *   node scripts/probe-dead-sites.mjs --input=/tmp/batch-us-1/failed-slugs.txt
 *   node scripts/probe-dead-sites.mjs --input=... --limit=500       # test
 *   node scripts/probe-dead-sites.mjs --input=... --apply            # write NULL
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { URL } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
const sql = neon(DATABASE_URL);

const UA = "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)";
const CONCURRENCY = 20;
const HEAD_TIMEOUT = 8000;
const GET_TIMEOUT = 10000;

function parseFlag(name, fallback = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : fallback;
}

const INPUT_PATH = parseFlag("input");
const LIMIT = parseInt(parseFlag("limit", "0"), 10) || 0;
const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

if (!INPUT_PATH) {
  console.error("Usage: node scripts/probe-dead-sites.mjs --input=<path> [--limit=N] [--apply]");
  process.exit(1);
}

// ─── Probing ─────────────────────────────────────────────────────────────────
async function probeDns(hostname) {
  try {
    await lookup(hostname);
    return { ok: true };
  } catch (err) {
    return { ok: false, code: err.code || "DNS_ERROR" };
  }
}

async function probeHttp(url, method = "HEAD", timeoutMs = HEAD_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    return { ok: true, status: res.status, finalUrl: res.url };
  } catch (err) {
    if (err.name === "AbortError") return { ok: false, error: "timeout" };
    return { ok: false, error: err.code || err.message || "error" };
  } finally {
    clearTimeout(timer);
  }
}

// Classify one URL. Returns { category, status, detail }
async function classify(url) {
  let parsed;
  try { parsed = new URL(url); }
  catch { return { category: "bad-url", detail: "unparseable" }; }

  // 1. DNS check
  const dns = await probeDns(parsed.hostname);
  if (!dns.ok) {
    // "Most frequent when domain expired / never registered"
    return { category: "dns-fail", detail: dns.code };
  }

  // 2. HEAD request
  let http = await probeHttp(url, "HEAD", HEAD_TIMEOUT);
  // Some servers reject HEAD; retry once as GET
  if (!http.ok || (http.status && [405, 501].includes(http.status))) {
    http = await probeHttp(url, "GET", GET_TIMEOUT);
  }
  if (!http.ok) {
    if (http.error === "timeout") return { category: "timeout", detail: null };
    if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET/i.test(http.error || "")) {
      return { category: "connect-fail", detail: http.error };
    }
    return { category: "network-error", detail: http.error };
  }
  if (http.status >= 500) return { category: "http-5xx", status: http.status };
  if (http.status >= 400) return { category: "http-4xx", status: http.status };
  return { category: "ok", status: http.status, finalUrl: http.finalUrl };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const raw = await readFile(INPUT_PATH, "utf8");
  const slugs = raw.split("\n")
    .map((l) => l.trim().split("\t")[0])
    .filter(Boolean);
  const uniq = [...new Set(slugs)];
  const targets = LIMIT > 0 ? uniq.slice(0, LIMIT) : uniq;

  console.log(`Input: ${INPUT_PATH}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY (sets website=NULL on dns-fail)"}`);
  console.log(`Slugs to probe: ${targets.length}`);
  console.log(`Concurrency: ${CONCURRENCY}\n`);

  // Load websites from DB
  const rows = await sql.query(
    `SELECT slug, website FROM churches WHERE slug = ANY($1::text[]) AND website IS NOT NULL AND website != ''`,
    [targets],
  );
  const bySlug = new Map(rows.map((r) => [r.slug, r.website]));
  console.log(`Churches with website in DB: ${bySlug.size} / ${targets.length}\n`);

  const results = [];
  const counts = {};
  let done = 0;
  const startedAt = Date.now();

  await mapWithConcurrency([...bySlug.entries()], CONCURRENCY, async ([slug, website]) => {
    const classification = await classify(website);
    results.push({ slug, website, ...classification });
    counts[classification.category] = (counts[classification.category] || 0) + 1;
    done += 1;
    if (done % 200 === 0 || done === bySlug.size) {
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = done / Math.max(1, elapsed);
      console.log(`  ${done}/${bySlug.size}  ${rate.toFixed(1)}/s  ` +
        Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" "));
    }
  });

  // Write TSV
  const outPath = INPUT_PATH.replace(/\.(txt|tsv)?$/, "") + "-classified.tsv";
  const lines = ["slug\tcategory\tstatus_or_detail\twebsite\tfinal_url"];
  for (const r of results) {
    lines.push([
      r.slug,
      r.category,
      r.status || r.detail || "",
      r.website,
      r.finalUrl || "",
    ].join("\t"));
  }
  await writeFile(outPath, lines.join("\n") + "\n");
  console.log(`\nWrote ${results.length} rows to ${outPath}`);

  console.log(`\n━━━ Category breakdown ━━━`);
  for (const [cat, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(16)} ${n.toString().padStart(5)}  (${Math.round(100 * n / results.length)}%)`);
  }

  // Apply mode: null-out websites for dns-fail (most confident "dead" signal)
  if (APPLY) {
    const dead = results.filter((r) => r.category === "dns-fail").map((r) => r.slug);
    if (dead.length === 0) {
      console.log("\nNo dns-fail rows to update.");
      return;
    }
    console.log(`\nApplying: setting website=NULL on ${dead.length} churches with dns-fail…`);
    // Batch update
    await sql.query(
      `UPDATE churches SET website = NULL, updated_at = NOW() WHERE slug = ANY($1::text[])`,
      [dead],
    );
    console.log("Done.");
  } else {
    console.log(`\n(Dry run — no DB writes. Add --apply to set website=NULL on dns-fail.)`);
  }
}

main().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
