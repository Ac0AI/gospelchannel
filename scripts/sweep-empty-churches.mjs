#!/usr/bin/env node

/**
 * Resumable two-step sweep over the search-index noindex set
 * (churches.display_score < 45). Per batch:
 *   1. Apify Google Places enrich  (enrich-google-places-by-slug.mjs)
 *   2. Firecrawl-crawl the churches that just gained a website
 *      (enrich-by-slugs.mjs)
 *   3. Re-score the batch            (backfill-display-score.ts --slugs)
 *
 * Pilot-validated net yield ≈ 24% empty → genuinely indexable. Funded by
 * existing Apify + Firecrawl credits. Resumable: a processed-slug file means
 * a restart skips already-attempted churches; churches that cross the
 * threshold drop out of the target query naturally.
 *
 * Usage: node scripts/sweep-empty-churches.mjs [--batch=600] [--max-batches=N]
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
loadLocalEnv(ROOT);

const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
const BATCH = Number(process.argv.find((a) => a.startsWith("--batch="))?.slice(8)) || 600;
const MAX_BATCHES = Number(process.argv.find((a) => a.startsWith("--max-batches="))?.slice(14)) || Infinity;
const PROCESSED_FILE = "/tmp/sweep-processed.txt";

const processed = new Set(
  existsSync(PROCESSED_FILE)
    ? readFileSync(PROCESSED_FILE, "utf8").split("\n").filter(Boolean)
    : [],
);
function markProcessed(slugs) {
  for (const s of slugs) processed.add(s);
  appendFileSync(PROCESSED_FILE, slugs.map((s) => `${s}\n`).join(""));
}

function run(cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return true;
  } catch (e) {
    console.log(`  ! sub-step failed (continuing): ${String(e.message).slice(0, 200)}`);
    return false;
  }
}

async function nextBatch() {
  const rows = await sql`
    SELECT c.slug FROM churches c
    WHERE c.status = 'approved' AND (c.display_score IS NULL OR c.display_score < 45)
    ORDER BY c.slug`;
  return rows.map((r) => r.slug).filter((s) => !processed.has(s)).slice(0, BATCH);
}

async function main() {
  const total = (await sql`SELECT count(*) n FROM churches WHERE status='approved' AND (display_score IS NULL OR display_score < 45)`)[0].n;
  console.log(`Sweep start. noindex target=${total} batch=${BATCH} alreadyProcessed=${processed.size}`);
  let batchNo = 0;
  let cumIndexable = 0;

  for (;;) {
    if (batchNo >= MAX_BATCHES) { console.log("max-batches reached, stopping"); break; }
    const slugs = await nextBatch();
    if (slugs.length === 0) { console.log("\nNo more unprocessed churches. Done."); break; }
    batchNo += 1;
    const list = slugs.join(",");
    console.log(`\n=== Batch ${batchNo} (${slugs.length} churches) ${new Date().toISOString()} ===`);

    console.log("  [1/3] Apify Google Places ...");
    run(`node scripts/enrich-google-places-by-slug.mjs --slugs=${list} --limit=${slugs.length}`);

    const websited = (await sql`
      SELECT c.slug FROM churches c
      LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
      WHERE c.slug = ANY(${slugs}::text[])
        AND ((c.website IS NOT NULL AND c.website <> '') OR (ce.website_url IS NOT NULL AND ce.website_url <> ''))
    `).map((r) => r.slug);
    console.log(`  [2/3] Firecrawl on ${websited.length} newly-websited ...`);
    if (websited.length > 0) {
      run(`node scripts/enrich-by-slugs.mjs --slugs=${websited.join(",")}`);
    }

    console.log("  [3/3] Re-score batch ...");
    run(`npx tsx scripts/backfill-display-score.ts --slugs=${list}`);

    markProcessed(slugs);
    const nowIdx = (await sql`SELECT count(*) n FROM churches WHERE slug = ANY(${slugs}::text[]) AND display_score >= 45`)[0].n;
    cumIndexable += Number(nowIdx);
    console.log(`  Batch ${batchNo} done. crossed→indexable this batch: ${nowIdx}  cumulative: ${cumIndexable}`);
  }

  // Post-import facet reconcile: this sweep bulk-mutates churches, so the
  // materialized facet snapshot (city_slug/directory_score/directory_ready/
  // directory_rank) is stale. directory_rank is GLOBAL, so reconcile once
  // over the whole set after the sweep (not per-batch). Runs as a Node job
  // (NOT in the Worker — the global rank pass pulls the full index, which is
  // exactly the OOM we removed from the Worker).
  console.log("\nReconciling facet columns (global snapshot) ...");
  run("npx tsx scripts/backfill-facet-columns.ts");

  const finalIdx = (await sql`SELECT count(*) n FROM churches WHERE status='approved' AND display_score >= 45`)[0].n;
  console.log(`\nSWEEP COMPLETE. Total approved indexable now: ${finalIdx}`);
}

main().catch((e) => { console.error("SWEEP FATAL:", e); process.exit(1); });
