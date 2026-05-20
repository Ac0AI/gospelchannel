#!/usr/bin/env tsx

/**
 * Nightly hygiene job: mirror foreign image URLs (Google Maps Place Photos,
 * Apify Street View thumbnails, site-builder CDNs that may rotate) to our
 * own R2 bucket so the stored DB URL becomes permanent.
 *
 * Catches the long-term drift the prune script (backfill-prune-dead-images)
 * only triages after the fact. Run this alongside the prune script and the
 * sweep reconcile; new enrichments are protected within ~24h.
 *
 * Pairs with src/lib/r2-mirror.ts (the single mirror helper); future
 * enrichment-time mirroring calls the same function.
 *
 * Scope (first pass — bounded by deploy-1 caution):
 *   Only mirrors hosts known to rotate aggressively. The two dominant
 *   problem hosts from the survey:
 *     - lh3.googleusercontent.com (Google Maps Place Photos)
 *     - streetviewpixels-pa.googleapis.com (Street View thumbnails)
 *   Other broken-image hosts are long-tail (single-digit broken per host)
 *   and lower-priority. Expand the FILTER_HOSTS list if more drift shows
 *   up in subsequent Ahrefs runs.
 *
 * Cost: wrangler spawn per upload (~1s); concurrency=6 → ~6 uploads/sec.
 * 5,000 URLs ≈ 14 minutes. Cap with --limit=N for smoke testing.
 *
 * Usage:
 *   npx tsx scripts/backfill-mirror-foreign-images.ts --dry-run --limit=20
 *   npx tsx scripts/backfill-mirror-foreign-images.ts --limit=500
 *   npx tsx scripts/backfill-mirror-foreign-images.ts
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mirrorImageToR2, isAlreadyMirrored } from "../src/lib/r2-mirror";
import { INDEXABLE_DISPLAY_SCORE_MIN } from "../src/lib/content-quality";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
const sql = neon(DATABASE_URL);

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number.parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? "0",
  10,
);
const CONCURRENCY = 6;

// Host LIKE patterns for the SQL filter. Keep this list small and concrete —
// every host added here means more bytes uploaded to R2 nightly. Start with
// the two dominant problem hosts; expand only if subsequent Ahrefs runs flag
// new drift sources.
const FILTER_HOSTS = ["lh3.googleusercontent.com", "streetviewpixels-pa.googleapis.com"];

type Field = "header_image" | "logo" | "cover_image_url" | "logo_image_url";
const FIELDS_ON_CHURCHES: Field[] = ["header_image", "logo"];
const FIELDS_ON_ENRICHMENTS: Field[] = ["cover_image_url", "logo_image_url"];

type Row = {
  slug: string;
  header_image: string | null;
  logo: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
};

type Job = { slug: string; field: Field; sourceUrl: string };

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function isFilteredHost(url: string | null): boolean {
  if (!url || !url.startsWith("http")) return false;
  if (isAlreadyMirrored(url)) return false;
  try {
    const host = new URL(url).host.toLowerCase();
    return FILTER_HOSTS.includes(host);
  } catch {
    return false;
  }
}

async function main() {
  console.log(`mirror-foreign-images  ${DRY_RUN ? "DRY-RUN" : "WRITE"}  hosts=${FILTER_HOSTS.join(",")}${LIMIT ? `  limit=${LIMIT}` : ""}`);

  // Find indexable churches with at least one image URL on a filtered host.
  // Cost-safe: status + display_score + LIKE filters; slim columns; no joins
  // beyond the existing church_enrichments LEFT JOIN.
  const hostLike = FILTER_HOSTS.map((h) => `%${h}%`);
  const baseQuery = `
    SELECT c.slug, c.header_image, c.logo,
           ce.cover_image_url, ce.logo_image_url
      FROM churches c
      LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
     WHERE c.status='approved'
       AND (c.display_score IS NULL OR c.display_score >= $1)
       AND (
         c.header_image LIKE ANY($2::text[]) OR c.logo LIKE ANY($2::text[])
         OR ce.cover_image_url LIKE ANY($2::text[]) OR ce.logo_image_url LIKE ANY($2::text[])
       )`;
  const rows = (LIMIT
    ? ((await sql.query(`${baseQuery} LIMIT $3`, [INDEXABLE_DISPLAY_SCORE_MIN, hostLike, LIMIT])) as Row[])
    : ((await sql.query(baseQuery, [INDEXABLE_DISPLAY_SCORE_MIN, hostLike])) as Row[]));
  console.log(`  loaded ${rows.length} churches with foreign image URLs`);

  // Build (slug,field,url) job list; dedupe identical URLs across rows.
  const jobs: Job[] = [];
  const uniqueUrls = new Set<string>();
  for (const r of rows) {
    if (isFilteredHost(r.header_image)) {
      jobs.push({ slug: r.slug, field: "header_image", sourceUrl: r.header_image! });
      uniqueUrls.add(r.header_image!);
    }
    if (isFilteredHost(r.logo)) {
      jobs.push({ slug: r.slug, field: "logo", sourceUrl: r.logo! });
      uniqueUrls.add(r.logo!);
    }
    if (isFilteredHost(r.cover_image_url)) {
      jobs.push({ slug: r.slug, field: "cover_image_url", sourceUrl: r.cover_image_url! });
      uniqueUrls.add(r.cover_image_url!);
    }
    if (isFilteredHost(r.logo_image_url)) {
      jobs.push({ slug: r.slug, field: "logo_image_url", sourceUrl: r.logo_image_url! });
      uniqueUrls.add(r.logo_image_url!);
    }
  }
  console.log(`  ${jobs.length} (slug,field) updates across ${uniqueUrls.size} unique source URLs`);

  if (DRY_RUN) {
    // Show host distribution + a few sample URLs and stop.
    const byHost = new Map<string, number>();
    for (const url of uniqueUrls) {
      const host = (() => {
        try {
          return new URL(url).host;
        } catch {
          return "?";
        }
      })();
      byHost.set(host, (byHost.get(host) ?? 0) + 1);
    }
    console.log("\n  unique URLs by host:");
    for (const [h, n] of [...byHost.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${h.padEnd(45)}  ${n}`);
    }
    console.log("\nDRY-RUN: no uploads, no DB writes.");
    return;
  }

  // Upload pass: mirror each unique URL once, cache the result. Then apply
  // the per-(slug,field) DB updates.
  console.log("\nMirroring to R2 (concurrency=" + CONCURRENCY + ")...");
  const uniqueList = [...uniqueUrls];
  const urlToR2 = new Map<string, string | null>();
  let done = 0;
  let mirrored = 0;
  let failed = 0;
  await pool(uniqueList, CONCURRENCY, async (sourceUrl) => {
    const r2Url = await mirrorImageToR2(sourceUrl).catch(() => null);
    urlToR2.set(sourceUrl, r2Url);
    done++;
    if (r2Url) mirrored++;
    else failed++;
    if (done % 25 === 0 || done === uniqueList.length) {
      process.stdout.write(`\r  uploaded ${done}/${uniqueList.length}  (mirrored=${mirrored} failed=${failed})`);
    }
  });
  console.log("");

  // Apply DB updates per field. Skip jobs whose mirror failed (URL stays as
  // is — next nightly run retries; the prune job nulls it if it's truly
  // dead).
  for (const field of [...FIELDS_ON_CHURCHES, ...FIELDS_ON_ENRICHMENTS] as Field[]) {
    const updates = jobs
      .filter((j) => j.field === field)
      .map((j) => ({ slug: j.slug, oldUrl: j.sourceUrl, newUrl: urlToR2.get(j.sourceUrl) }))
      .filter((u): u is { slug: string; oldUrl: string; newUrl: string } => Boolean(u.newUrl));
    if (updates.length === 0) continue;
    const table = FIELDS_ON_CHURCHES.includes(field) ? "churches" : "church_enrichments";
    const slugCol = table === "churches" ? "slug" : "church_slug";
    // Per-row UPDATE — different newUrl per slug, so a single batch UPDATE
    // would need CASE or jsonb_to_recordset. Use jsonb_to_recordset for
    // efficiency (single query covers many rows).
    const CHUNK = 1000;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const slice = updates.slice(i, i + CHUNK);
      await sql.query(
        `UPDATE "${table}" AS t
            SET "${field}" = d.new_url
           FROM jsonb_to_recordset($1::jsonb) AS d(slug text, new_url text)
          WHERE t."${slugCol}" = d.slug
            AND t."${field}" IS NOT NULL`,
        [JSON.stringify(slice.map((u) => ({ slug: u.slug, new_url: u.newUrl })))],
      );
    }
    console.log(`  ${field}: rewrote ${updates.length} ${table} rows`);
  }

  console.log(`\nDone. mirrored=${mirrored}  failed=${failed}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
