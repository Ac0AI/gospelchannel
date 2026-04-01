#!/usr/bin/env node

/**
 * Quality-check pending churches using Claude Haiku.
 * For each pending church without a hero image:
 * 1. Fetch the church website
 * 2. Use Haiku to extract: hero image, location, description, quality assessment
 * 3. Download + optimize hero images → upload to R2
 * 4. Update the database
 *
 * Usage:
 *   node scripts/quality-check-pending.mjs
 *   node scripts/quality-check-pending.mjs --dry-run        # Preview without DB changes
 *   node scripts/quality-check-pending.mjs --slug=some-slug  # Process single church
 *   node scripts/quality-check-pending.mjs --limit=10        # Process first N
 */

import { neon } from "@neondatabase/serverless";
import sharp from "sharp";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { findLikelyHeroImage } from "./lib/church-quality.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

loadLocalEnv(ROOT_DIR);

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");

if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

const sql = neon(DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");
const SINGLE_SLUG = process.argv.find(a => a.startsWith("--slug="))?.split("=")[1];
const LIMIT = Number(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1]) || 9999;
const STATUS_FILTER = process.argv.find(a => a.startsWith("--status="))?.split("=")[1] || "pending";
const HERO_ONLY = process.argv.includes("--hero-only");

// Websites that are generic directories, not the church's own site
const GENERIC_WEBSITE_HOSTS = [
  "achurchnearyou.com",
  "sites.google.com",
  "google.com",
  "facebook.com",
  "hmdb.org",
  "visitredruth.co.uk",
  "dorsethistoricchurchestrust.co.uk",
  "portsmouthdiocese.org.uk",
  "shipstondeanery.co.uk",
];

const BLOCKED_IMAGE_HOSTS = [
  "instagram.com", "cdninstagram.com", "fbcdn.net", "facebook.com",
  "youtube.com", "ytimg.com", "linkedin.com", "licdn.com",
  "paypal.com", "archive.org", "wikipedia.org", "wikimedia.org",
];

const FETCH_TIMEOUT = 12_000;
const CONCURRENCY = HERO_ONLY ? 8 : 3; // Higher concurrency when skipping Haiku

// ─── Helpers ───

function normalizeHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function isGenericWebsite(url) {
  const host = normalizeHost(url);
  return GENERIC_WEBSITE_HOSTS.some(g => host === g || host.endsWith("." + g));
}

function isBlockedImageHost(url) {
  const host = normalizeHost(url);
  return BLOCKED_IMAGE_HOSTS.some(b => host.includes(b));
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 50_000); // Cap to keep Haiku context small
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callHaiku(systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function analyzeChurchWebsite(church, html) {
  const systemPrompt = `You are a data quality analyst for GospelChannel.com, a church directory website.
Analyze the provided church website HTML and extract structured data.
Respond ONLY with valid JSON, no markdown fences.`;

  const userPrompt = `Church: ${church.name}
Country: ${church.country}
Current location: ${church.location || "unknown"}
Current description: ${church.description || "none"}
Website URL: ${church.website}

HTML content from their website:
${html.slice(0, 30_000)}

Extract this JSON:
{
  "city": "The city/town where this church is located (from the website content, not the URL). Use null if not determinable.",
  "description": "A 1-2 sentence description of this church based on what their website says. Focus on: denomination/tradition, what makes them unique, community they serve. Write naturally, no hashtags, no marketing speak. Max 200 chars.",
  "hero_image_url": "The best candidate for a hero/banner image from the HTML. Look for: og:image meta tag, large hero/banner images, header background images. Return the full URL. Use null if none found.",
  "contact_email": "Any contact email found on the site. Use null if none.",
  "service_times": "Brief service time info if found, e.g. 'Sundays 10:30am'. Use null if not found.",
  "quality": "good | mediocre | reject",
  "quality_reason": "Brief reason for quality rating. 'reject' = site is unrelated to this church, church appears closed, or site is broken. 'mediocre' = site works but limited info. 'good' = proper church website with useful content.",
  "name_fix": "If the church name has HTML entities or formatting issues, provide the corrected name. Otherwise null."
}`;

  const raw = await callHaiku(systemPrompt, userPrompt);
  try {
    // Strip markdown fences if Haiku adds them
    const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    console.error(`  ⚠ Failed to parse Haiku response for ${church.slug}:`, raw.slice(0, 200));
    return null;
  }
}

async function processHeroImage(imageUrl, slug) {
  if (!imageUrl || isBlockedImageHost(imageUrl)) return null;

  const buf = await fetchImage(imageUrl);
  if (!buf || buf.length < 5000) return null; // Too small, likely icon

  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return null;
    if (meta.width < 400 || meta.height < 200) return null; // Too small for hero

    const optimized = await sharp(buf)
      .resize(1920, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();

    return { buffer: optimized, width: Math.min(meta.width, 1920), height: meta.height };
  } catch {
    return null;
  }
}

async function uploadToR2(slug, buffer) {
  const key = `heroes/${slug}.jpg`;
  const { execSync } = await import("node:child_process");
  const tmpPath = `/tmp/hero-${slug}.jpg`;
  const { writeFile } = await import("node:fs/promises");
  await writeFile(tmpPath, buffer);

  try {
    execSync(
      `npx wrangler r2 object put church-assets/${key} --file="${tmpPath}" --content-type=image/jpeg --remote`,
      { cwd: ROOT_DIR, stdio: "pipe", timeout: 30_000 }
    );
    return `${MEDIA_BASE_URL}/${key}`;
  } catch (err) {
    console.error(`  ⚠ R2 upload failed for ${slug}:`, err.message?.slice(0, 100));
    return null;
  }
}

// ─── Main ───

async function processChurch(church) {
  const label = `${church.name} (${church.slug})`;
  console.log(`\n━━━ Processing: ${label}`);

  // Check if website is generic/useless
  if (!church.website || isGenericWebsite(church.website)) {
    console.log(`  ⏭ Generic/missing website: ${church.website || "none"}`);
    return { slug: church.slug, action: "skip", reason: "generic_website" };
  }

  // Fetch website
  const html = await fetchPage(church.website);
  if (!html) {
    console.log(`  ⏭ Website unreachable: ${church.website}`);
    return { slug: church.slug, action: "skip", reason: "unreachable" };
  }

  // In hero-only mode, extract og:image directly without Haiku
  let analysis;
  if (HERO_ONLY) {
    const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
    const heroUrl = ogMatch?.[1] || null;
    if (!heroUrl) {
      // Try finding large images in the HTML
      const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
      const heroCandidate = imgMatches
        .map(m => m[1])
        .find(src => /hero|banner|header|cover|slide|background/i.test(src) && !/logo|icon|avatar|favicon/i.test(src));
      if (!heroCandidate) {
        return { slug: church.slug, action: "skip", reason: "no_hero_found" };
      }
      analysis = { hero_image_url: heroCandidate.startsWith("http") ? heroCandidate : new URL(heroCandidate, church.website).toString(), quality: "good" };
    } else {
      analysis = { hero_image_url: heroUrl.startsWith("http") ? heroUrl : new URL(heroUrl, church.website).toString(), quality: "good" };
    }
    console.log(`  Hero candidate: ${analysis.hero_image_url?.slice(0, 80)}`);
  } else {
    // Analyze with Haiku
    analysis = await analyzeChurchWebsite(church, html);
    if (!analysis) {
      return { slug: church.slug, action: "skip", reason: "haiku_parse_error" };
    }

    console.log(`  Quality: ${analysis.quality} (${analysis.quality_reason})`);
    if (analysis.city) console.log(`  City: ${analysis.city}`);
    if (analysis.description) console.log(`  Description: ${analysis.description?.slice(0, 80)}...`);
    if (analysis.hero_image_url) console.log(`  Hero candidate: ${analysis.hero_image_url?.slice(0, 80)}`);
    if (analysis.name_fix) console.log(`  Name fix: ${analysis.name_fix}`);
    if (analysis.contact_email) console.log(`  Email found: ${analysis.contact_email}`);

    // Skip rejected churches
    if (analysis.quality === "reject") {
      console.log(`  ❌ Rejected: ${analysis.quality_reason}`);
      return { slug: church.slug, action: "reject", reason: analysis.quality_reason, analysis };
    }
  }

  // Process hero image
  let heroUrl = null;
  if (analysis.hero_image_url) {
    console.log(`  📸 Downloading hero image...`);
    const img = await processHeroImage(analysis.hero_image_url, church.slug);
    if (img) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would upload hero ${img.width}x${img.height}`);
        heroUrl = "[dry-run]";
      } else {
        heroUrl = await uploadToR2(church.slug, img.buffer);
        if (heroUrl) console.log(`  ✅ Hero uploaded: ${heroUrl}`);
      }
    } else {
      console.log(`  ⚠ Hero image too small or failed to download`);
    }
  }

  // Build DB updates
  const updates = {};
  const isPlaceholder = church.description?.startsWith("Discover worship music and playlists from");

  if (analysis.description && (isPlaceholder || !church.description)) {
    updates.description = analysis.description;
  }
  if (analysis.city && !church.location) {
    updates.location = analysis.city;
  }
  // Fix bad location values that are clearly not cities
  if (church.location && /once or twice|move around|they move/i.test(church.location)) {
    updates.location = analysis.city || null;
  }
  if (analysis.contact_email && !church.email) {
    updates.email = analysis.contact_email;
  }
  if (heroUrl && heroUrl !== "[dry-run]") {
    updates.header_image = heroUrl;
  }
  if (analysis.name_fix) {
    updates.name = analysis.name_fix;
  }

  if (Object.keys(updates).length === 0) {
    console.log(`  ℹ No updates needed`);
    return { slug: church.slug, action: "none", analysis };
  }

  console.log(`  📝 Updates:`, Object.keys(updates).join(", "));

  if (!DRY_RUN) {
    // Build dynamic UPDATE query
    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    values.push(church.slug);
    await sql.query(`UPDATE churches SET ${setClauses.join(", ")} WHERE slug = $${i}`, values);
    console.log(`  ✅ Database updated`);
  } else {
    console.log(`  [DRY RUN] Would update:`, JSON.stringify(updates, null, 2));
  }

  return { slug: church.slug, action: "updated", updates: Object.keys(updates), analysis };
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(`  Quality Check: ${STATUS_FILTER} churches${HERO_ONLY ? " (hero only)" : ""}`);
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("═══════════════════════════════════════════\n");

  let query;
  if (SINGLE_SLUG) {
    query = sql`SELECT slug, name, location, country, email, website, description, header_image, spotify_url FROM churches WHERE slug = ${SINGLE_SLUG}`;
  } else {
    query = sql`SELECT slug, name, location, country, email, website, description, header_image, spotify_url FROM churches WHERE status = ${STATUS_FILTER} AND (header_image IS NULL OR header_image = '') ORDER BY name`;
  }

  const churches = await query;
  const toProcess = churches.slice(0, LIMIT);
  console.log(`Found ${churches.length} churches, processing ${toProcess.length}\n`);

  const results = { updated: 0, skipped: 0, rejected: 0, errors: 0 };
  const details = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(church => processChurch(church))
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) {
        const res = r.value;
        details.push(res);
        if (res.action === "updated") results.updated++;
        else if (res.action === "skip" || res.action === "none") results.skipped++;
        else if (res.action === "reject") results.rejected++;
      } else {
        results.errors++;
        if (r.reason) console.error("  ⚠ Error:", r.reason?.message || r.reason);
      }
    }
  }

  // Summary
  console.log("\n\n═══════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`  Updated:  ${results.updated}`);
  console.log(`  Skipped:  ${results.skipped}`);
  console.log(`  Rejected: ${results.rejected}`);
  console.log(`  Errors:   ${results.errors}`);

  // List rejected for review
  const rejected = details.filter(d => d.action === "reject");
  if (rejected.length > 0) {
    console.log("\n  Rejected churches (consider removing):");
    for (const r of rejected) {
      console.log(`    - ${r.slug}: ${r.reason}`);
    }
  }

  // List churches with generic websites that were skipped
  const genericSkips = details.filter(d => d.reason === "generic_website");
  if (genericSkips.length > 0) {
    console.log("\n  Skipped (generic website - need manual review):");
    for (const r of genericSkips) {
      console.log(`    - ${r.slug}`);
    }
  }

  const unreachable = details.filter(d => d.reason === "unreachable");
  if (unreachable.length > 0) {
    console.log("\n  Unreachable websites:");
    for (const r of unreachable) {
      console.log(`    - ${r.slug}`);
    }
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
