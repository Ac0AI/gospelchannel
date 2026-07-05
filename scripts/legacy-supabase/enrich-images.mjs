#!/usr/bin/env node

/**
 * Image Enrichment Pass
 *
 * Fetches cover images and logos for churches from Facebook pages.
 * Uses the already-known facebook_url from church_enrichments.
 *
 * Usage:
 *   node scripts/enrich-images.mjs [options]
 *
 * Options:
 *   --limit=<n>       Max churches to process (default: all)
 *   --dry-run         Show what would be fetched
 *   --force           Re-fetch even if images already exist
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { ApifyClient } from "apify-client";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";

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
  const limit = args.limit ? parseInt(args.limit, 10) : Infinity;
  const dryRun = !!args["dry-run"];
  const force = !!args.force;

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "APIFY_TOKEN",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });

  // Load churches with facebook_url that need images
  console.log("Loading churches with Facebook URLs...");

  let query = supabase
    .from("church_enrichments")
    .select("id, church_slug, candidate_id, facebook_url, cover_image_url, logo_image_url")
    .not("facebook_url", "is", null);

  const { data: churches, error } = await query;
  if (error) {
    console.error("Error loading churches:", error.message);
    process.exit(1);
  }

  let toProcess = churches.filter((c) => {
    if (force) return true;
    return !c.cover_image_url || !c.logo_image_url;
  });

  if (toProcess.length > limit) {
    toProcess = toProcess.slice(0, limit);
  }

  console.log(
    `Found ${churches.length} churches with Facebook URLs, ${toProcess.length} need images`
  );

  if (dryRun) {
    console.log("\n--- DRY RUN ---");
    for (const c of toProcess) {
      const needs = [];
      if (!c.cover_image_url) needs.push("cover");
      if (!c.logo_image_url) needs.push("logo");
      console.log(`  ${c.church_slug || c.candidate_id} | needs: ${needs.join(", ")}`);
    }
    console.log(`\nTotal: ${toProcess.length} would be processed.`);
    return;
  }

  if (toProcess.length === 0) {
    console.log("All churches already have images. Use --force to re-fetch.");
    return;
  }

  // Batch Facebook URLs to reduce Apify runs
  // The Facebook Pages Scraper can handle multiple URLs in one run
  const BATCH_SIZE = 20;
  let succeeded = 0;
  let improved = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

    console.log(`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} churches) ---`);

    try {
      const startUrls = batch.map((c) => ({ url: c.facebook_url }));

      const run = await apify.actor("apify/facebook-pages-scraper").call({
        startUrls,
        maxPagesPerQuery: batch.length,
      });

      const { items } = await apify
        .dataset(run.defaultDatasetId)
        .listItems();

      // Match results back to churches by Facebook URL
      for (const church of batch) {
        const normalizedChurchUrl = normalizeFbUrl(church.facebook_url);
        const match = items.find(
          (item) => normalizeFbUrl(item.facebookUrl || item.pageUrl || "") === normalizedChurchUrl
        );

        if (!match) {
          console.log(`  [miss] ${church.church_slug || church.candidate_id}: no match in results`);
          failed++;
          continue;
        }

        const updates = {};
        let fieldsAdded = 0;

        if (match.coverPhotoUrl && (!church.cover_image_url || force)) {
          updates.cover_image_url = match.coverPhotoUrl;
          fieldsAdded++;
        }

        if (match.profilePictureUrl && (!church.logo_image_url || force)) {
          updates.logo_image_url = match.profilePictureUrl;
          fieldsAdded++;
        }

        if (fieldsAdded > 0) {
          updates.updated_at = new Date().toISOString();

          const { error: updateError } = await supabase
            .from("church_enrichments")
            .update(updates)
            .eq("id", church.id);

          if (updateError) {
            console.error(`  [error] ${church.church_slug || church.candidate_id}: ${updateError.message}`);
            failed++;
            continue;
          }

          const label = church.church_slug || church.candidate_id;
          console.log(
            `  [ok] ${label}: +${fieldsAdded} image(s) (${Object.keys(updates).filter((k) => k !== "updated_at").join(", ")})`
          );
          improved++;
        } else {
          console.log(`  [skip] ${church.church_slug || church.candidate_id}: no images on Facebook page`);
        }

        succeeded++;
      }

      await sleep(2000); // Pause between batches
    } catch (err) {
      console.error(`  [batch error] ${err.message}`);
      failed += batch.length;
    }
  }

  console.log("\n=== IMAGE ENRICHMENT COMPLETE ===");
  console.log(`  Processed: ${succeeded + failed}`);
  console.log(`  Got images: ${improved}`);
  console.log(`  Failed:     ${failed}`);
}

function normalizeFbUrl(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
