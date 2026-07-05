#!/usr/bin/env node

/**
 * Facebook Enrichment Pass
 *
 * Scrapes Facebook pages for churches that have a facebook_url
 * but are missing contact info (email, phone, address, service times).
 *
 * Usage:
 *   node scripts/enrich-facebook.mjs [options]
 *
 * Options:
 *   --limit=<n>       Max churches to process (default: all)
 *   --dry-run         Show what would be scraped without doing it
 *   --force           Scrape even if data already exists
 *   --slug=<slug>     Process a single church by slug
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { fetchFacebookPage } from "./lib/enrichment/facebook-scraper.mjs";
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
  const slugFilter = args.slug || null;

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

  // Load churches with facebook_url that have data gaps
  console.log("Loading churches with Facebook URLs...");

  let query = supabase
    .from("church_enrichments")
    .select(
      "id, church_slug, candidate_id, facebook_url, street_address, phone, contact_email, service_times, denomination_network, instagram_url, website_url, church_size, summary, confidence"
    )
    .not("facebook_url", "is", null);

  if (slugFilter) {
    query = query.eq("church_slug", slugFilter);
  }

  const { data: churches, error } = await query;
  if (error) {
    console.error("Error loading churches:", error.message);
    process.exit(1);
  }

  // Filter to those with gaps (unless --force)
  let toProcess = churches.filter((c) => {
    if (force) return true;
    const hasGaps =
      !c.street_address ||
      !c.phone ||
      !c.contact_email ||
      !c.service_times ||
      c.service_times.length === 0 ||
      !c.denomination_network ||
      !c.instagram_url ||
      !c.website_url ||
      !c.church_size;
    return hasGaps;
  });

  if (toProcess.length > limit) {
    toProcess = toProcess.slice(0, limit);
  }

  console.log(
    `Found ${churches.length} churches with Facebook URLs, ${toProcess.length} have data gaps`
  );

  if (dryRun) {
    console.log("\n--- DRY RUN ---");
    for (const c of toProcess) {
      const gaps = [];
      if (!c.street_address) gaps.push("address");
      if (!c.phone) gaps.push("phone");
      if (!c.contact_email) gaps.push("email");
      if (!c.service_times || c.service_times.length === 0)
        gaps.push("service_times");
      if (!c.denomination_network) gaps.push("denomination");
      console.log(
        `  ${c.church_slug || c.candidate_id} | ${c.facebook_url} | gaps: ${gaps.join(", ")}`
      );
    }
    console.log(`\nTotal: ${toProcess.length} would be scraped.`);
    return;
  }

  if (toProcess.length === 0) {
    console.log("Nothing to process. Use --force to re-scrape all.");
    return;
  }

  // Process with concurrency 2 (Facebook scraping is slower)
  const CONCURRENCY = 2;
  console.log(
    `\nStarting Facebook enrichment (concurrency: ${CONCURRENCY})...\n`
  );

  let succeeded = 0;
  let failed = 0;
  let improved = 0;

  const results = await mapWithConcurrency(
    toProcess,
    CONCURRENCY,
    async (church) => {
      const label = church.church_slug || church.candidate_id;

      try {
        const { data: fbData } = await fetchFacebookPage(
          church.facebook_url,
          process.env.APIFY_TOKEN
        );

        if (!fbData) {
          failed++;
          return { ok: false, label };
        }

        // Merge: only fill gaps, don't overwrite existing data
        const updates = {};
        let fieldsImproved = 0;

        if (!church.street_address && fbData.address) {
          updates.street_address = fbData.address;
          fieldsImproved++;
        }
        if (!church.phone && fbData.phone) {
          updates.phone = fbData.phone;
          fieldsImproved++;
        }
        if (!church.contact_email && fbData.email) {
          updates.contact_email = fbData.email;
          fieldsImproved++;
        }
        if (
          (!church.service_times || church.service_times.length === 0) &&
          fbData.businessHours
        ) {
          updates.service_times = fbData.businessHours;
          fieldsImproved++;
        }
        if (!church.instagram_url && fbData.instagramUrl) {
          updates.instagram_url = fbData.instagramUrl;
          fieldsImproved++;
        }
        if (!church.website_url && fbData.website) {
          updates.website_url = fbData.website;
          fieldsImproved++;
        }

        // Extract denomination from Facebook categories
        // e.g. ["Church", "Catholic Church"] -> "Catholic"
        if (!church.denomination_network && fbData.categories?.length > 0) {
          const denom = extractDenomination(fbData.categories);
          if (denom) {
            updates.denomination_network = denom;
            fieldsImproved++;
          }
        }

        // Use followers/likes as church size indicator
        if (!church.church_size && (fbData.followers || fbData.likes)) {
          const count = fbData.followers || fbData.likes;
          updates.church_size = estimateChurchSize(count);
          fieldsImproved++;
        }

        if (fieldsImproved > 0) {
          // Bump confidence slightly for Facebook data
          const newConfidence = Math.min(
            (church.confidence || 0) + fieldsImproved * 0.03,
            1
          );
          updates.confidence = newConfidence;
          updates.updated_at = new Date().toISOString();

          const { error: updateError } = await supabase
            .from("church_enrichments")
            .update(updates)
            .eq("id", church.id);

          if (updateError) {
            console.error(
              `  [save] Error for ${label}: ${updateError.message}`
            );
            failed++;
            return { ok: false, label };
          }

          console.log(
            `  [merged] ${label}: +${fieldsImproved} fields (${Object.keys(updates).filter((k) => k !== "confidence" && k !== "updated_at").join(", ")})`
          );
          improved++;
        } else {
          console.log(`  [skip] ${label}: Facebook had no new data`);
        }

        succeeded++;
        await sleep(1500); // Be nice to Facebook/Apify
        return { ok: true, label, fieldsImproved };
      } catch (err) {
        console.error(`  [error] ${label}: ${err.message}`);
        failed++;
        return { ok: false, label };
      }
    }
  );

  console.log("\n=== FACEBOOK ENRICHMENT COMPLETE ===");
  console.log(`  Processed: ${results.length}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Improved:  ${improved}`);
  console.log(`  Failed:    ${failed}`);
}

/**
 * Extract denomination from Facebook page categories.
 * e.g. ["Page", "Catholic Church"] -> "Catholic"
 * e.g. ["Religious Organization", "Pentecostal Church"] -> "Pentecostal"
 */
function extractDenomination(categories) {
  const denomPatterns = [
    { pattern: /catholic/i, name: "Catholic" },
    { pattern: /pentecostal/i, name: "Pentecostal" },
    { pattern: /baptist/i, name: "Baptist" },
    { pattern: /lutheran/i, name: "Lutheran" },
    { pattern: /methodist/i, name: "Methodist" },
    { pattern: /presbyterian/i, name: "Presbyterian" },
    { pattern: /anglican/i, name: "Anglican" },
    { pattern: /orthodox/i, name: "Orthodox" },
    { pattern: /evangelical/i, name: "Evangelical" },
    { pattern: /charismatic/i, name: "Charismatic" },
    { pattern: /assemblies.*god/i, name: "Assemblies of God" },
    { pattern: /seventh.*day/i, name: "Seventh-day Adventist" },
    { pattern: /nondenominational/i, name: "Non-denominational" },
    { pattern: /reformed/i, name: "Reformed" },
  ];

  for (const cat of categories) {
    for (const { pattern, name } of denomPatterns) {
      if (pattern.test(cat)) return name;
    }
  }
  return null;
}

/**
 * Estimate church size from Facebook followers/likes.
 * This is a rough proxy — online following ≠ congregation size,
 * but gives a ballpark for relative sizing.
 */
function estimateChurchSize(followers) {
  if (followers > 50000) return "mega";
  if (followers > 10000) return "large";
  if (followers > 2000) return "medium";
  if (followers > 500) return "small";
  return "small";
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
