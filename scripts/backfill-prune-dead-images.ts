#!/usr/bin/env tsx

/**
 * Ahrefs broken-image cleanup (2026-05-20). HEAD-checks every external image
 * URL stored on indexable churches and NULLs the 4xx ones. Pages fall back
 * to their existing no-image rendering — same as a church that never had an
 * image, which renders fine.
 *
 * Why this isn't a "deploy 2 risk": data-only, no code change, no parity
 * surface. Monotonic — a church that had a broken image now has no image
 * (fallback); a church with a working image is untouched. Reversible — the
 * enrichment pipeline re-fetches images on subsequent runs, and we can
 * always re-mirror to R2.
 *
 * Dominant pattern (per the live survey): expired Google Street View
 * thumbnail URLs (streetviewpixels-pa.googleapis.com). Apify enrichment
 * stored short-lived CDN URLs; the panoid endpoint returns 404 after
 * rotation. ~83% of broken images in the sample. Other broken URLs are
 * upstream church websites that removed the image — also safely nulled.
 *
 * Cost-safe: bounded HEAD requests with concurrency=20, 8s per-request
 * timeout, only checks external (http*) URLs, only on indexable approved
 * churches.
 *
 * Usage:
 *   npx tsx scripts/backfill-prune-dead-images.ts --dry-run
 *   npx tsx scripts/backfill-prune-dead-images.ts
 *   npx tsx scripts/backfill-prune-dead-images.ts --limit=1000  (smoke test)
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
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
const CONCURRENCY = 20;
const TIMEOUT_MS = 8000;

type Row = {
  slug: string;
  header_image: string | null;
  logo: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
};

type Field = "header_image" | "logo" | "cover_image_url" | "logo_image_url";
const FIELDS_ON_CHURCHES: Field[] = ["header_image", "logo"];
const FIELDS_ON_ENRICHMENTS: Field[] = ["cover_image_url", "logo_image_url"];
const ALL_FIELDS: Field[] = [...FIELDS_ON_CHURCHES, ...FIELDS_ON_ENRICHMENTS];

type CheckResult = { ok: boolean; status: number; reason?: string };

async function headCheck(url: string): Promise<CheckResult> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true, status: res.status };
    if (res.status >= 400 && res.status < 500) return { ok: false, status: res.status };
    // 5xx → upstream might be transient; keep the URL (do NOT null on flaky errors).
    return { ok: true, status: res.status, reason: "5xx kept" };
  } catch (e: unknown) {
    // Network errors (DNS, TLS, abort) — treat as transient, keep URL.
    // The dominant broken-image pattern is hard 4xx; we don't want to null
    // a URL just because our machine had a hiccup.
    const m = e instanceof Error ? e.message : String(e);
    return { ok: true, status: 0, reason: `network: ${m.slice(0, 50)}` };
  }
}

// Tiny concurrency pool — runs `fn(item)` for each item, at most N in flight.
async function pool<T, R>(
  items: T[],
  n: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  console.log(
    `prune-dead-images  ${DRY_RUN ? "DRY-RUN" : "WRITE"}  threshold=${INDEXABLE_DISPLAY_SCORE_MIN}${LIMIT ? `  limit=${LIMIT}` : ""}`,
  );

  // Load all indexable churches with any non-null external image URL.
  const baseQuery = `
    SELECT c.slug, c.header_image, c.logo,
           ce.cover_image_url, ce.logo_image_url
      FROM churches c
      LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
     WHERE c.status = 'approved'
       AND (c.display_score IS NULL OR c.display_score >= $1)
       AND (
         c.header_image LIKE 'http%' OR c.logo LIKE 'http%'
         OR ce.cover_image_url LIKE 'http%' OR ce.logo_image_url LIKE 'http%'
       )`;
  const rows = (LIMIT
    ? ((await sql.query(`${baseQuery} LIMIT $2`, [INDEXABLE_DISPLAY_SCORE_MIN, LIMIT])) as Row[])
    : ((await sql.query(baseQuery, [INDEXABLE_DISPLAY_SCORE_MIN])) as Row[]));
  console.log(`  loaded ${rows.length} indexable churches with external image URLs`);

  // Build the per-(slug,field,url) work list. Dedupe identical URLs across
  // rows so we don't HEAD the same URL many times — cheap pre-pass.
  type Job = { slug: string; field: Field; url: string };
  const jobs: Job[] = [];
  const urlToCheck = new Set<string>();
  for (const r of rows) {
    for (const f of ALL_FIELDS) {
      const v = (r as unknown as Record<Field, string | null>)[f];
      if (v && v.startsWith("http")) {
        jobs.push({ slug: r.slug, field: f, url: v });
        urlToCheck.add(v);
      }
    }
  }
  console.log(`  ${jobs.length} (slug,field) checks across ${urlToCheck.size} unique URLs`);

  // HEAD-check the unique URLs only (saves time when many churches share the
  // same placeholder URL — common with Apify Street View fallbacks).
  const uniqueUrls = [...urlToCheck];
  let done = 0;
  const results = new Map<string, CheckResult>();
  await pool(uniqueUrls, CONCURRENCY, async (url) => {
    const r = await headCheck(url);
    results.set(url, r);
    done += 1;
    if (done % 200 === 0 || done === uniqueUrls.length) {
      process.stdout.write(`\r  HEAD checked ${done}/${uniqueUrls.length}`);
    }
  });
  console.log("");

  // Now apply per-(slug,field) NULL updates. Group by host pattern for
  // reporting — Street View vs other.
  const byHost = new Map<string, { ok: number; broken: number; transient: number }>();
  const toNull: Job[] = [];
  for (const job of jobs) {
    const res = results.get(job.url)!;
    let host = "other";
    try {
      host = new URL(job.url).host;
    } catch {
      /* ignore parse errors */
    }
    const bucket = byHost.get(host) ?? { ok: 0, broken: 0, transient: 0 };
    if (res.ok && res.status >= 200 && res.status < 400) bucket.ok += 1;
    else if (!res.ok && res.status >= 400 && res.status < 500) {
      bucket.broken += 1;
      toNull.push(job);
    } else bucket.transient += 1;
    byHost.set(host, bucket);
  }

  // Print the host breakdown (sorted by broken count desc).
  const hostRows = [...byHost.entries()].sort((a, b) => b[1].broken - a[1].broken);
  console.log("\nResults by host:");
  console.log(`  ${"host".padEnd(45)}  ok       broken   transient`);
  for (const [host, b] of hostRows.slice(0, 25)) {
    console.log(
      `  ${host.padEnd(45)}  ${String(b.ok).padStart(6)}  ${String(b.broken).padStart(6)}  ${String(b.transient).padStart(6)}`,
    );
  }
  const totalOk = hostRows.reduce((s, [, b]) => s + b.ok, 0);
  const totalBroken = hostRows.reduce((s, [, b]) => s + b.broken, 0);
  const totalTransient = hostRows.reduce((s, [, b]) => s + b.transient, 0);
  console.log(
    `  ${"TOTAL".padEnd(45)}  ${String(totalOk).padStart(6)}  ${String(totalBroken).padStart(6)}  ${String(totalTransient).padStart(6)}`,
  );

  console.log(`\nWill NULL ${toNull.length} (slug,field) pairs across ${new Set(toNull.map((j) => j.slug)).size} churches.`);

  if (DRY_RUN) {
    console.log("\nDRY-RUN: no rows written.");
    return;
  }

  // Apply per-field updates. Group by table to minimize round-trips.
  // We update one field at a time (cleaner SQL than CASE), batched by slug.
  for (const field of ALL_FIELDS) {
    const slugs = toNull.filter((j) => j.field === field).map((j) => j.slug);
    if (slugs.length === 0) continue;
    const table = FIELDS_ON_CHURCHES.includes(field) ? "churches" : "church_enrichments";
    const slugCol = table === "churches" ? "slug" : "church_slug";
    // CHUNK the slug list — Neon serverless caps query payload sizes.
    const CHUNK = 2000;
    for (let i = 0; i < slugs.length; i += CHUNK) {
      const chunk = slugs.slice(i, i + CHUNK);
      await sql.query(
        `UPDATE "${table}" SET "${field}" = NULL WHERE "${slugCol}" = ANY($1::text[])`,
        [chunk],
      );
    }
    console.log(`  nullified ${field} on ${slugs.length} ${table} rows`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
