#!/usr/bin/env node
/**
 * persist-church-images.mjs
 *
 * Downloads external church images (hero, logo) and uploads them to
 * Supabase Storage so they never expire.
 *
 * Usage:
 *   node scripts/persist-church-images.mjs                    # all churches
 *   node scripts/persist-church-images.mjs --dry-run           # preview only
 *   node scripts/persist-church-images.mjs --only-missing      # skip already-persisted
 *   node scripts/persist-church-images.mjs --slug hillsong-church-stockholm
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";

/* ── Load .env.local (handles multiline values) ─────────── */

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envContent = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !m[2].includes("-----BEGIN")) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* env already set externally */ }

/* ── Config ─────────────────────────────────────────────── */

const CHURCHES_PATH = join(__dirname, "..", "src", "data", "churches.json");
const BUCKET = "church-assets";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCY = 5;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── CLI flags ──────────────────────────────────────────── */

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_MISSING = args.includes("--only-missing");
const slugIdx = args.indexOf("--slug");
const ONLY_SLUG = slugIdx !== -1 ? args[slugIdx + 1] : null;

/* ── Helpers ────────────────────────────────────────────── */

const SUPABASE_HOST = new URL(SUPABASE_URL).host;

function isAlreadyPersisted(url) {
  if (!url) return true;
  return url.includes(SUPABASE_HOST) || url.startsWith("/");
}

function shouldSkip(url) {
  if (!url) return true;
  if (isAlreadyPersisted(url)) return true;
  // YouTube thumbnails are stable
  if (url.includes("i.ytimg.com")) return true;
  // Google Street View is stable
  if (url.includes("streetviewpixels")) return true;
  return false;
}

function extFromContentType(ct) {
  if (!ct) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

async function downloadImage(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GospelChannel-ImagePersist/1.0" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return { error: `Not an image: ${ct}` };
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) return { error: `Too small: ${buffer.length}b` };
    return { buffer, ext: extFromContentType(ct), contentType: ct };
  } catch (e) {
    return { error: e.message };
  }
}

async function uploadToStorage(path, buffer, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/* ── Main ───────────────────────────────────────────────── */

async function main() {
  console.log(`\n📸 Church Image Persistence${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // Load churches
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf8"));
  const filtered = ONLY_SLUG ? churches.filter((c) => c.slug === ONLY_SLUG) : churches;
  console.log(`Churches: ${filtered.length}${ONLY_SLUG ? ` (filtered: ${ONLY_SLUG})` : ""}`);

  // Load enrichments from Supabase
  const { data: enrichments } = await supabase
    .from("church_enrichments")
    .select("slug, cover_image_url, logo_image_url");
  const enrichmentMap = new Map((enrichments || []).map((e) => [e.slug, e]));

  // Build work items
  const work = [];
  for (const church of filtered) {
    const enrichment = enrichmentMap.get(church.slug);

    // Hero image from churches.json
    if (church.headerImage && !shouldSkip(church.headerImage)) {
      if (!(ONLY_MISSING && isAlreadyPersisted(church.headerImage))) {
        work.push({
          slug: church.slug,
          field: "headerImage",
          source: "churches.json",
          url: church.headerImage,
          storagePath: `heroes/${church.slug}`,
        });
      }
    }

    // Cover image from enrichment
    if (enrichment?.cover_image_url && !shouldSkip(enrichment.cover_image_url)) {
      if (!(ONLY_MISSING && isAlreadyPersisted(enrichment.cover_image_url))) {
        work.push({
          slug: church.slug,
          field: "cover_image_url",
          source: "enrichment",
          url: enrichment.cover_image_url,
          storagePath: `covers/${church.slug}`,
        });
      }
    }

    // Logo from enrichment
    if (enrichment?.logo_image_url && !shouldSkip(enrichment.logo_image_url)) {
      if (!(ONLY_MISSING && isAlreadyPersisted(enrichment.logo_image_url))) {
        work.push({
          slug: church.slug,
          field: "logo_image_url",
          source: "enrichment",
          url: enrichment.logo_image_url,
          storagePath: `logos/${church.slug}`,
        });
      }
    }
  }

  console.log(`Images to process: ${work.length}\n`);

  if (work.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (DRY_RUN) {
    for (const item of work) {
      console.log(`  [DRY] ${item.slug} → ${item.field} (${item.source})`);
      console.log(`         ${item.url.slice(0, 80)}...`);
    }
    console.log(`\nWould process ${work.length} images. Run without --dry-run to execute.`);
    return;
  }

  // Process in batches
  let saved = 0;
  let failed = 0;
  const churchUpdates = new Map(); // slug → { headerImage: newUrl }
  const enrichmentUpdates = []; // { slug, field, url }

  for (let i = 0; i < work.length; i += CONCURRENCY) {
    const batch = work.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const dl = await downloadImage(item.url);
        if (dl.error) {
          console.log(`  ✗ ${item.slug}/${item.field}: ${dl.error}`);
          return { item, error: dl.error };
        }

        const path = `${item.storagePath}.${dl.ext}`;
        const up = await uploadToStorage(path, dl.buffer, dl.contentType);
        if (up.error) {
          console.log(`  ✗ ${item.slug}/${item.field}: upload failed: ${up.error}`);
          return { item, error: up.error };
        }

        console.log(`  ✓ ${item.slug}/${item.field} → ${(dl.buffer.length / 1024).toFixed(0)}KB`);
        return { item, newUrl: up.url };
      }),
    );

    for (const result of results) {
      if (result.status === "rejected" || result.value.error) {
        failed++;
        continue;
      }
      saved++;
      const { item, newUrl } = result.value;

      if (item.source === "churches.json") {
        if (!churchUpdates.has(item.slug)) churchUpdates.set(item.slug, {});
        churchUpdates.get(item.slug)[item.field] = newUrl;
      } else {
        enrichmentUpdates.push({ slug: item.slug, field: item.field, url: newUrl });
      }
    }
  }

  // Write updated churches.json
  if (churchUpdates.size > 0) {
    for (const church of churches) {
      const updates = churchUpdates.get(church.slug);
      if (updates) Object.assign(church, updates);
    }
    writeFileSync(CHURCHES_PATH, JSON.stringify(churches, null, 2) + "\n");
    console.log(`\nUpdated churches.json (${churchUpdates.size} entries)`);
  }

  // Update enrichments in Supabase
  for (const upd of enrichmentUpdates) {
    const { error } = await supabase
      .from("church_enrichments")
      .update({ [upd.field]: upd.url })
      .eq("slug", upd.slug);
    if (error) console.log(`  ✗ enrichment update ${upd.slug}/${upd.field}: ${error.message}`);
  }
  if (enrichmentUpdates.length > 0) {
    console.log(`Updated ${enrichmentUpdates.length} enrichment rows`);
  }

  console.log(`\nDone: ${saved} saved, ${failed} failed, ${work.length - saved - failed} skipped`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
