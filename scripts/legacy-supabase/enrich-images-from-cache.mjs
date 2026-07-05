#!/usr/bin/env node

/**
 * Extract images from cached website data (no API calls).
 *
 * Scans raw_crawled_pages and raw_website_markdown for hero images
 * to use as cover_image_url. Prioritizes large, prominent images.
 *
 * Usage:
 *   node scripts/enrich-images-from-cache.mjs [options]
 *
 * Options:
 *   --dry-run    Show what would be updated
 *   --limit=<n>  Max churches to process
 *   --force      Overwrite existing images
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

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

/**
 * Extract the best cover image from markdown content.
 * Prioritizes: og:image > large hero images > first content image.
 * Filters out icons, logos, tracking pixels, and tiny images.
 */
function findBestCoverImage(pages, homepageMarkdown) {
  const allText =
    (homepageMarkdown || "") +
    "\n" +
    (pages || []).map((p) => p.markdown || "").join("\n");

  // 1. Try og:image / twitter:image from metadata
  const metaRe =
    /(?:og:image|twitter:image)[^>]*content=["'](https?:\/\/[^"']+)/gi;
  const metaImgs = [...allText.matchAll(metaRe)].map((m) => m[1]);
  const goodMeta = metaImgs.filter(isGoodImage);
  if (goodMeta.length > 0) return goodMeta[0];

  // 2. Find markdown images
  const imgRe =
    /!\[[^\]]*\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|webp)[^)]*)\)/gi;
  const imgs = [...allText.matchAll(imgRe)].map((m) => m[1]);

  // Prioritize images that look like hero/banner images
  const heroKeywords =
    /hero|banner|header|cover|featured|slider|worship|church|community|welcome|main/i;
  const heroImgs = imgs.filter(
    (url) => isGoodImage(url) && heroKeywords.test(url)
  );
  if (heroImgs.length > 0) return heroImgs[0];

  // 3. Prioritize larger images (wp-content uploads, CDN URLs)
  const cdnImgs = imgs.filter(
    (url) =>
      isGoodImage(url) &&
      (url.includes("wp-content/uploads") ||
        url.includes("cdn") ||
        url.includes("s3.") ||
        url.includes("cloudinary") ||
        url.includes("imgix") ||
        url.includes("assets/images"))
  );
  if (cdnImgs.length > 0) return cdnImgs[0];

  // 4. Fallback: first good image
  const goodImgs = imgs.filter(isGoodImage);
  return goodImgs.length > 0 ? goodImgs[0] : null;
}

/**
 * Extract logo image — look for images with logo-related keywords.
 */
function findLogoImage(pages, homepageMarkdown) {
  const allText =
    (homepageMarkdown || "") +
    "\n" +
    (pages || []).map((p) => p.markdown || "").join("\n");

  const imgRe =
    /!\[[^\]]*\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|webp|svg)[^)]*)\)/gi;
  const imgs = [...allText.matchAll(imgRe)].map((m) => m[1]);

  const logoKeywords = /logo|brand|emblem|crest|seal/i;
  const logoImgs = imgs.filter(
    (url) => logoKeywords.test(url) && !isTinyOrJunk(url)
  );

  return logoImgs.length > 0 ? logoImgs[0] : null;
}

function isGoodImage(url) {
  if (!url) return false;
  const lower = url.toLowerCase();

  // Reject junk
  if (isTinyOrJunk(lower)) return false;

  // Reject logo/icon (we handle those separately)
  if (/logo|brand|emblem/i.test(lower)) return false;

  return true;
}

function isTinyOrJunk(url) {
  const lower = typeof url === "string" ? url.toLowerCase() : url;
  return (
    lower.includes("favicon") ||
    lower.includes("icon") ||
    lower.includes("pixel") ||
    lower.includes("tracking") ||
    lower.includes("badge") ||
    lower.includes("1x1") ||
    lower.includes("emoji") ||
    lower.includes("avatar") ||
    lower.includes("spacer") ||
    lower.includes("spinner") ||
    lower.includes("loading") ||
    lower.includes("placeholder") ||
    lower.includes("data:image") ||
    lower.includes(".gif") ||
    lower.includes("gravatar") ||
    lower.includes("shadow") ||
    lower.includes("gradient") ||
    lower.includes("overlay") ||
    lower.includes("blank") ||
    lower.includes("default") ||
    lower.includes("/skins/")
  );
}

async function main() {
  loadLocalEnv(ROOT_DIR);

  const args = parseArgs();
  const limit = args.limit ? parseInt(args.limit, 10) : Infinity;
  const dryRun = !!args["dry-run"];
  const force = !!args.force;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log("Loading churches needing images...");

  // Load churches missing images that have cached crawl data
  let query = supabase
    .from("church_enrichments")
    .select(
      "id, church_slug, candidate_id, raw_crawled_pages, raw_website_markdown, cover_image_url, logo_image_url"
    );

  if (!force) {
    query = query.or("cover_image_url.is.null,logo_image_url.is.null");
  }

  const { data: churches, error } = await query.not(
    "raw_crawled_pages",
    "is",
    null
  );

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  let toProcess = churches.slice(0, limit);
  console.log(`Found ${toProcess.length} churches with cached page data\n`);

  let coverFound = 0;
  let logoFound = 0;
  let updated = 0;

  for (const church of toProcess) {
    const label = church.church_slug || church.candidate_id;
    const updates = {};

    if (!church.cover_image_url || force) {
      const cover = findBestCoverImage(
        church.raw_crawled_pages,
        church.raw_website_markdown
      );
      if (cover) {
        updates.cover_image_url = cover;
        coverFound++;
      }
    }

    if (!church.logo_image_url || force) {
      const logo = findLogoImage(
        church.raw_crawled_pages,
        church.raw_website_markdown
      );
      if (logo) {
        updates.logo_image_url = logo;
        logoFound++;
      }
    }

    if (Object.keys(updates).length === 0) continue;

    if (dryRun) {
      console.log(`  ${label}:`);
      if (updates.cover_image_url)
        console.log(`    cover: ${updates.cover_image_url.slice(0, 80)}`);
      if (updates.logo_image_url)
        console.log(`    logo:  ${updates.logo_image_url.slice(0, 80)}`);
      continue;
    }

    updates.updated_at = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("church_enrichments")
      .update(updates)
      .eq("id", church.id);

    if (updateError) {
      console.error(`  [error] ${label}: ${updateError.message}`);
      continue;
    }

    const parts = [];
    if (updates.cover_image_url) parts.push("cover");
    if (updates.logo_image_url) parts.push("logo");
    console.log(`  [ok] ${label}: +${parts.join(", ")}`);
    updated++;
  }

  console.log("\n=== IMAGE EXTRACTION COMPLETE ===");
  console.log(`  Processed: ${toProcess.length}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Covers:    ${coverFound}`);
  console.log(`  Logos:     ${logoFound}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
