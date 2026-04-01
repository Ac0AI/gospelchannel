#!/usr/bin/env node

/**
 * Sanity-check church profile logos with Haiku vision.
 * Flags logos that are payment icons, QR codes, generic stock photos,
 * or anything that isn't a church logo/emblem.
 *
 * Usage:
 *   node scripts/sanity-check-logos.mjs
 *   node scripts/sanity-check-logos.mjs --dry-run
 *   node scripts/sanity-check-logos.mjs --fix   # Auto-clear bad logos
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

const sql = neon(DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");
const AUTO_FIX = process.argv.includes("--fix");
const CONCURRENCY = 5;
const FETCH_TIMEOUT = 8_000;

async function fetchImageAsBase64(url) {
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
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return null; // Too tiny
    if (buf.length > 5_000_000) return null; // Too large
    const mediaType = contentType.split(";")[0].trim();
    return { base64: buf.toString("base64"), mediaType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function checkLogoWithHaiku(imageBase64, mediaType, churchName) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: `This image is used as the profile logo for a church called "${churchName}" on a church directory website.

Classify this image as ONE of:
- "church_logo" — a real church logo, emblem, crest, or wordmark
- "church_photo" — a photo of the church building, congregation, or worship (acceptable as profile)
- "bad" — NOT a church logo. Examples: payment icons (Swish, PayPal, Venmo), QR codes, generic stock photos, social media icons, website builder logos, person headshots, unrelated graphics, broken/placeholder images

Respond with ONLY valid JSON: {"verdict": "church_logo"|"church_photo"|"bad", "reason": "brief explanation"}`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text || "";
  try {
    const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { verdict: "unknown", reason: "Failed to parse: " + raw.slice(0, 100) };
  }
}

async function processLogo(row) {
  const url = row.logo_image_url;
  if (!url) return null;

  // Quick URL-based rejection
  const lower = url.toLowerCase();
  if (/swish|vipps|paypal|stripe|klarna|bankid|qr|venmo|cashapp/.test(lower)) {
    return { slug: row.church_slug, url, verdict: "bad", reason: "Payment-related URL pattern" };
  }

  const img = await fetchImageAsBase64(url);
  if (!img) {
    return { slug: row.church_slug, url, verdict: "unreachable", reason: "Could not fetch image" };
  }

  const result = await checkLogoWithHaiku(img.base64, img.mediaType, row.church_name || row.church_slug);
  return { slug: row.church_slug, url, ...result };
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Logo Sanity Check with Haiku Vision");
  console.log(`  Mode: ${AUTO_FIX ? "AUTO-FIX" : DRY_RUN ? "DRY RUN" : "REPORT ONLY"}`);
  console.log("═══════════════════════════════════════════\n");

  const rows = await sql`
    SELECT e.church_slug, e.logo_image_url, c.name as church_name
    FROM church_enrichments e
    JOIN churches c ON c.slug = e.church_slug
    WHERE e.logo_image_url IS NOT NULL AND e.logo_image_url != ''
    AND c.status = 'approved'
    ORDER BY c.name
  `;

  console.log(`Found ${rows.length} logos to check\n`);

  const stats = { good: 0, bad: 0, unreachable: 0, errors: 0 };
  const badLogos = [];

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(processLogo));

    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) {
        stats.errors++;
        continue;
      }
      const result = r.value;
      if (result.verdict === "bad") {
        stats.bad++;
        badLogos.push(result);
        console.log(`  ❌ ${result.slug}: ${result.reason} (${result.url.slice(0, 60)})`);
      } else if (result.verdict === "unreachable") {
        stats.unreachable++;
      } else {
        stats.good++;
      }
    }

    // Progress every 50
    if ((i + CONCURRENCY) % 50 < CONCURRENCY) {
      console.log(`  ... ${Math.min(i + CONCURRENCY, rows.length)}/${rows.length} checked`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`  Good logos:    ${stats.good}`);
  console.log(`  Bad logos:     ${stats.bad}`);
  console.log(`  Unreachable:   ${stats.unreachable}`);
  console.log(`  Errors:        ${stats.errors}`);

  if (badLogos.length > 0) {
    console.log("\n  Bad logos found:");
    for (const b of badLogos) {
      console.log(`    - ${b.slug}: ${b.reason}`);
    }

    if (AUTO_FIX && !DRY_RUN) {
      console.log("\n  Clearing bad logos...");
      for (const b of badLogos) {
        await sql.query(`UPDATE church_enrichments SET logo_image_url = NULL WHERE church_slug = $1`, [b.slug]);
      }
      console.log(`  Cleared ${badLogos.length} bad logos from enrichments`);
    }
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
