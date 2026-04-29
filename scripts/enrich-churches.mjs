#!/usr/bin/env node

/**
 * Church Enrichment Agent
 *
 * Enriches churches with practical data (address, service times, theology, etc.)
 * via Google Places (Apify), Firecrawl, and Claude LLM.
 *
 * Usage:
 *   node scripts/enrich-churches.mjs [options]
 *
 * Options:
 *   --slug=<slug>       Enrich a single church by slug
 *   --status=<status>   Only enrich candidates with this status (default: pending,approved)
 *   --region=<region>   Filter by region: "europe" (default: all)
 *   --force             Re-enrich even if already complete
 *   --dry-run           Show what would be enriched without doing it
 *   --re-extract        Re-run LLM extraction on existing raw data (no re-crawl)
 *   --limit=<n>         Max churches to process (default: all)
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 *
 * Optional env vars:
 *   APIFY_TOKEN, FIRECRAWL_API_KEY, ANTHROPIC_API_KEY
 */

process.on("uncaughtException", (err) => {
  console.error(`  [WARN] Uncaught exception (continuing): ${err.message}`);
});

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  loadChurchesForEnrichment,
  loadExistingEnrichments,
  enrichOneChurch,
} from "./lib/enrichment/pipeline.mjs";
import { mapWithConcurrency } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) {
        args[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        args[arg.slice(2)] = true;
      }
    }
  }
  return args;
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  const args = parseArgs();
  const slug = args.slug || null;
  const status = args.status || null;
  const region = args.region || null;
  const country = args.country || null;
  const force = !!args.force;
  const dryRun = !!args["dry-run"];
  const reExtract = !!args["re-extract"];
  const limit = args.limit ? parseInt(args.limit, 10) : Infinity;

  // Validate required env
  const required = ["DATABASE_URL"];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  // Warn about optional env
  const optional = {
    APIFY_TOKEN: "Google Places",
    FIRECRAWL_API_KEY: "website crawl",
    ANTHROPIC_API_KEY: "LLM extraction",
  };
  const missing = Object.entries(optional).filter(([k]) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(
      "Warning: Missing optional env vars (some pipeline steps will be skipped):"
    );
    for (const [key, purpose] of missing) {
      console.warn(`  ${key} — needed for ${purpose}`);
    }
  }

  const sql = neon(process.env.DATABASE_URL);

  // Load churches
  console.log("Loading churches...");
  const allChurches = await loadChurchesForEnrichment({
    rootDir: ROOT_DIR,
    sql,
    status,
    region,
    slug,
  });
  console.log(
    `Found ${allChurches.length} churches (filter: slug=${slug || "all"}, region=${region || "all"}, status=${status || "pending,approved"})`
  );

  // Filter already-enriched
  const existing = await loadExistingEnrichments(sql);
  let toProcess = allChurches.filter((c) => {
    const key = c.slug || c.candidateId;
    const currentStatus = existing.get(key);

    if (force) return true;
    if (reExtract) return currentStatus === "complete";
    if (!currentStatus) return true;
    if (
      currentStatus === "pending" ||
      currentStatus === "partial" ||
      currentStatus === "failed" ||
      currentStatus === "stale"
    )
      return true;
    return false;
  });

  // Country filter (applied post-load since loadChurchesForEnrichment doesn't
  // expose a country parameter).
  if (country) {
    toProcess = toProcess.filter((c) => c.country === country);
    console.log(`After country=${country} filter: ${toProcess.length} churches`);
  }

  // Apply limit
  if (toProcess.length > limit) {
    toProcess = toProcess.slice(0, limit);
  }

  console.log(
    `Will process: ${toProcess.length} churches (skipped ${allChurches.length - toProcess.length} already enriched)`
  );

  if (dryRun) {
    console.log("\n--- DRY RUN ---");
    for (const c of toProcess) {
      console.log(`  ${c.name} (${c.location || c.country}) [${c.type}]`);
    }
    console.log(`\nTotal: ${toProcess.length} churches would be enriched.`);
    return;
  }

  if (toProcess.length === 0) {
    console.log("Nothing to process. Use --force to re-enrich.");
    return;
  }

  // Process in batches of 3
  const CONCURRENCY = 3;
  console.log(`\nStarting enrichment (concurrency: ${CONCURRENCY})...\n`);

  const results = await mapWithConcurrency(
    toProcess,
    CONCURRENCY,
    (church) =>
      enrichOneChurch(church, {
        sql,
        apifyToken: process.env.APIFY_TOKEN || null,
        firecrawlKey: process.env.FIRECRAWL_API_KEY || null,
        anthropicKey: process.env.ANTHROPIC_API_KEY || null,
        reExtract,
      })
  );

  // Summary
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const avgConfidence =
    results
      .filter((r) => r.ok)
      .reduce((sum, r) => sum + (r.value?.confidence || 0), 0) /
    (succeeded || 1);

  console.log("\n=== ENRICHMENT COMPLETE ===");
  console.log(`  Processed: ${results.length}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Avg confidence: ${avgConfidence.toFixed(2)}`);

  if (failed > 0) {
    console.log("\nFailed churches:");
    results.forEach((r, i) => {
      if (!r.ok) console.log(`  - ${toProcess[i].name}: ${r.error?.message}`);
    });
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
