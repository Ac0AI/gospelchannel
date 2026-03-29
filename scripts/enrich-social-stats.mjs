#!/usr/bin/env node

/**
 * Social Media Stats Enrichment
 *
 * Fetches follower/subscriber counts for churches with social media URLs.
 * - Facebook: Apify facebook-pages-scraper (batched)
 * - Instagram: Apify instagram-profile-scraper (batched)
 * - YouTube: Apify youtube-channel-scraper (batched)
 *
 * Usage:
 *   node scripts/enrich-social-stats.mjs [options]
 *
 * Options:
 *   --platform=facebook|instagram|youtube|all  (default: all)
 *   --limit=<n>        Max churches per platform
 *   --dry-run          Show what would be fetched
 *   --force            Re-fetch even if already have stats
 *
 * Required env vars:
 *   APIFY_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { ApifyClient } from "apify-client";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) args[arg.slice(2, eq)] = arg.slice(eq + 1);
      else args[arg.slice(2)] = true;
    }
  }
  return args;
}

/* ── Facebook ── */

async function fetchFacebookStats(apify, supabase, churches, dryRun) {
  console.log(`\n=== Facebook (${churches.length} pages) ===`);
  if (dryRun) {
    for (const c of churches.slice(0, 10)) console.log(`  ${c.church_slug}: ${c.facebook_url}`);
    if (churches.length > 10) console.log(`  ... and ${churches.length - 10} more`);
    return { fetched: 0, updated: 0 };
  }

  const BATCH_SIZE = 25;
  let updated = 0;

  for (let i = 0; i < churches.length; i += BATCH_SIZE) {
    const batch = churches.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(churches.length / BATCH_SIZE);
    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} pages)...`);

    try {
      const run = await apify.actor("apify/facebook-pages-scraper").call({
        startUrls: batch.map((c) => ({ url: c.facebook_url })),
        maxPagesPerQuery: batch.length,
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();

      for (const church of batch) {
        const normUrl = normalizeFbUrl(church.facebook_url);
        const match = items.find(
          (item) => normalizeFbUrl(item.facebookUrl || item.pageUrl || "") === normUrl
        );

        if (!match) continue;

        const followers = match.likes || match.followers || match.followersCount || null;
        if (followers) {
          const { error } = await supabase
            .from("church_enrichments")
            .update({
              facebook_followers: followers,
              social_stats_fetched_at: new Date().toISOString(),
            })
            .eq("id", church.id);

          if (!error) {
            updated++;
            console.log(`    ${church.church_slug}: ${followers.toLocaleString()} followers`);
          }
        }
      }

      await sleep(3000);
    } catch (err) {
      console.error(`  Batch error: ${err.message}`);
    }
  }

  return { fetched: churches.length, updated };
}

/* ── Instagram ── */

async function fetchInstagramStats(apify, supabase, churches, dryRun) {
  console.log(`\n=== Instagram (${churches.length} profiles) ===`);
  if (dryRun) {
    for (const c of churches.slice(0, 10)) console.log(`  ${c.church_slug}: ${c.instagram_url}`);
    if (churches.length > 10) console.log(`  ... and ${churches.length - 10} more`);
    return { fetched: 0, updated: 0 };
  }

  const BATCH_SIZE = 25;
  let updated = 0;

  for (let i = 0; i < churches.length; i += BATCH_SIZE) {
    const batch = churches.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(churches.length / BATCH_SIZE);
    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} profiles)...`);

    try {
      const usernames = batch.map((c) => extractIgUsername(c.instagram_url)).filter(Boolean);

      const run = await apify.actor("apify/instagram-profile-scraper").call({
        usernames,
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();

      for (const church of batch) {
        const username = extractIgUsername(church.instagram_url);
        if (!username) continue;

        const match = items.find(
          (item) => (item.username || "").toLowerCase() === username.toLowerCase()
        );

        if (!match) continue;

        const followers = match.followersCount || match.followedByCount || null;
        if (followers) {
          const { error } = await supabase
            .from("church_enrichments")
            .update({
              instagram_followers: followers,
              social_stats_fetched_at: new Date().toISOString(),
            })
            .eq("id", church.id);

          if (!error) {
            updated++;
            console.log(`    ${church.church_slug}: ${followers.toLocaleString()} followers`);
          }
        }
      }

      await sleep(3000);
    } catch (err) {
      console.error(`  Batch error: ${err.message}`);
    }
  }

  return { fetched: churches.length, updated };
}

/* ── YouTube ── */

async function fetchYoutubeStats(apify, supabase, churches, dryRun) {
  console.log(`\n=== YouTube (${churches.length} channels) ===`);
  if (dryRun) {
    for (const c of churches.slice(0, 10)) console.log(`  ${c.church_slug}: ${c.youtube_url}`);
    if (churches.length > 10) console.log(`  ... and ${churches.length - 10} more`);
    return { fetched: 0, updated: 0 };
  }

  const BATCH_SIZE = 25;
  let updated = 0;

  for (let i = 0; i < churches.length; i += BATCH_SIZE) {
    const batch = churches.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(churches.length / BATCH_SIZE);
    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} channels)...`);

    try {
      const run = await apify.actor("streamers/youtube-channel-scraper").call({
        startUrls: batch.map((c) => ({ url: c.youtube_url })),
        maxResults: batch.length,
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();

      for (const church of batch) {
        // Match by URL similarity
        const churchHost = normalizeYtUrl(church.youtube_url);
        const match = items.find((item) => {
          const itemUrl = normalizeYtUrl(item.channelUrl || item.url || "");
          return itemUrl && churchHost && itemUrl === churchHost;
        }) || items.find((item) => {
          // Fallback: match by channel name containing church name
          const channelName = (item.channelName || item.title || "").toLowerCase();
          const slug = (church.church_slug || "").replace(/-/g, " ");
          return slug && channelName.includes(slug.slice(0, 10));
        });

        if (!match) continue;

        const subscribers = match.subscriberCount || match.numberOfSubscribers || null;
        if (subscribers) {
          const { error } = await supabase
            .from("church_enrichments")
            .update({
              youtube_subscribers: subscribers,
              social_stats_fetched_at: new Date().toISOString(),
            })
            .eq("id", church.id);

          if (!error) {
            updated++;
            console.log(`    ${church.church_slug}: ${subscribers.toLocaleString()} subscribers`);
          }
        }
      }

      await sleep(3000);
    } catch (err) {
      console.error(`  Batch error: ${err.message}`);
    }
  }

  return { fetched: churches.length, updated };
}

/* ── Helpers ── */

function normalizeFbUrl(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

function extractIgUsername(url) {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] || "";
  } catch {
    return url.replace(/^@/, "").split("/").filter(Boolean)[0] || "";
  }
}

function normalizeYtUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return "";
  }
}

/* ── Main ── */

async function main() {
  const args = parseArgs();
  const platform = args.platform || "all";
  const limit = args.limit ? parseInt(args.limit, 10) : Infinity;
  const dryRun = !!args["dry-run"];
  const force = !!args.force;

  console.log("Social Media Stats Enrichment");
  console.log(`  platform: ${platform}`);
  console.log(`  limit: ${limit === Infinity ? "all" : limit}`);
  console.log(`  dry-run: ${dryRun}`);
  console.log(`  force: ${force}`);

  for (const key of ["APIFY_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
    if (!process.env[key]) {
      console.error(`Missing env var: ${key}`);
      process.exit(1);
    }
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
  const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });

  const results = {};

  // Facebook
  if (platform === "all" || platform === "facebook") {
    let query = supabase
      .from("church_enrichments")
      .select("id, church_slug, facebook_url, facebook_followers")
      .eq("enrichment_status", "complete")
      .not("facebook_url", "is", null);

    if (!force) query = query.is("facebook_followers", null);

    const { data } = await query.limit(limit);
    results.facebook = await fetchFacebookStats(apify, supabase, data || [], dryRun);
  }

  // Instagram
  if (platform === "all" || platform === "instagram") {
    let query = supabase
      .from("church_enrichments")
      .select("id, church_slug, instagram_url, instagram_followers")
      .eq("enrichment_status", "complete")
      .not("instagram_url", "is", null);

    if (!force) query = query.is("instagram_followers", null);

    const { data } = await query.limit(limit);
    results.instagram = await fetchInstagramStats(apify, supabase, data || [], dryRun);
  }

  // YouTube
  if (platform === "all" || platform === "youtube") {
    let query = supabase
      .from("church_enrichments")
      .select("id, church_slug, youtube_url, youtube_subscribers")
      .eq("enrichment_status", "complete")
      .not("youtube_url", "is", null);

    if (!force) query = query.is("youtube_subscribers", null);

    const { data } = await query.limit(limit);
    results.youtube = await fetchYoutubeStats(apify, supabase, data || [], dryRun);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Social Stats Complete");
  console.log("=".repeat(50));
  for (const [p, r] of Object.entries(results)) {
    console.log(`  ${p}: ${r.updated} updated / ${r.fetched} fetched`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
