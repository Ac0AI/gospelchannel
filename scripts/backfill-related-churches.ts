#!/usr/bin/env tsx

/**
 * Orphan-pages plan, deploy 1 (2026-05-20). Computes the reciprocal
 * related-church assignment that fills churches.related_church_slugs.
 *
 * Two load-bearing invariants:
 *   (a) every indexable church EMITS K=8 slugs (city → country →
 *       style/denomination fallback ladder; never noindexed candidates)
 *   (b) every indexable church RECEIVES >=1 inlink — the reciprocity /
 *       least-linked pass injects any 0-inlink church into a well-connected
 *       neighbour's list (allowing growth up to K+2 to absorb).
 *
 * Why both: a rank-ordered sibling query alone leaves tail churches in each
 * city with 0 inlinks (they appear in nobody's block). The reciprocity pass
 * is the difference between "fix orphans by construction" and "fix the easy
 * 80%". See [[orphan-pages-are-inventory-not-linking]] and the eng-review
 * design doc.
 *
 * Geo tiebreak: when BOTH source and candidate have coords, country-tier
 * candidates are re-sorted by haversine distance asc → closer worship-relevant
 * siblings preferred. NEVER a filter (lat/long-gating was the original orphan
 * cause). City tier is exhausted first using directory_rank ordering before
 * geo tiebreak applies.
 *
 * Node-only job — never a Worker cron ([[unstable-cache-2mb-oom]]). Same class
 * as backfill-facet-columns.ts: single Neon read of just the indexable set,
 * CPU-only graph assembly, one batched UPDATE pass.
 *
 * Usage:
 *   npx tsx scripts/backfill-related-churches.ts --dry-run
 *   npx tsx scripts/backfill-related-churches.ts
 *   npx tsx scripts/backfill-related-churches.ts --k=10
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
const K = Number.parseInt(process.argv.find((a) => a.startsWith("--k="))?.slice(4) ?? "8", 10);
const K_ABSORB_CAP = K + 2; // reciprocity-pass growth allowance per receiver
const GEO_RERANK_MAX_CANDIDATES = 2000;
const BATCH = 2500;

type Row = {
  slug: string;
  country: string | null;
  city_slug: string | null;
  directory_rank: number | null;
  display_score: number | null;
  music_style: string[] | null;
  denomination: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Entry = Row & {
  // Convenience: pre-resolved primary style (lowercased) and denom slug-ish
  styleKey: string | null;
  denomKey: string | null;
};

const isIndexable = (s: number | null) =>
  s == null || s >= INDEXABLE_DISPLAY_SCORE_MIN;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Same formula getNearbyChurches uses (church.ts:1015-1018), flat-earth ok
  // at city/country scale.
  const dlat = (lat2 - lat1) * 111;
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

// Total-order comparator on entries: directory_rank ASC NULLS LAST, then slug.
// Same final-tiebreak discipline as compareDirectoryEntries
// ([[parity-gate-shared-comparator]]).
function rankCmp(a: Entry, b: Entry): number {
  const ar = a.directory_rank ?? Number.POSITIVE_INFINITY;
  const br = b.directory_rank ?? Number.POSITIVE_INFINITY;
  if (ar !== br) return ar - br;
  return a.slug.localeCompare(b.slug);
}

async function main() {
  console.log(
    `backfill-related-churches  K=${K}  ${DRY_RUN ? "DRY-RUN" : "WRITE"}  threshold=${INDEXABLE_DISPLAY_SCORE_MIN}`,
  );

  // ONE read pass — only the indexable set crosses the wire. Cost-safe:
  // <= ~tens of thousands of rows, lean columns, never raw_* blobs.
  const rows = (await sql.query(
    `SELECT c.slug, c.country, c.city_slug, c.directory_rank, c.display_score,
            c.music_style, c.denomination,
            ce.latitude, ce.longitude
       FROM churches c
       LEFT JOIN church_enrichments ce ON ce.church_slug = c.slug
      WHERE c.status = 'approved'
        AND (c.display_score IS NULL OR c.display_score >= $1)`,
    [INDEXABLE_DISPLAY_SCORE_MIN],
  )) as Row[];

  const entries: Entry[] = rows
    .filter((r) => isIndexable(r.display_score))
    .map((r) => ({
      ...r,
      styleKey: (r.music_style?.[0] ?? "").toLowerCase().trim() || null,
      denomKey: (r.denomination ?? "").toLowerCase().trim() || null,
    }));

  console.log(`  loaded ${entries.length} indexable churches`);

  // Build cluster indexes (slug → entry, plus pre-sorted lists per cluster).
  const bySlug = new Map<string, Entry>();
  const byCity = new Map<string, Entry[]>();
  const byCountry = new Map<string, Entry[]>();
  const byStyle = new Map<string, Entry[]>();
  const byDenom = new Map<string, Entry[]>();

  for (const e of entries) {
    bySlug.set(e.slug, e);
    if (e.city_slug) {
      const arr = byCity.get(e.city_slug) ?? [];
      arr.push(e);
      byCity.set(e.city_slug, arr);
    }
    if (e.country) {
      const arr = byCountry.get(e.country) ?? [];
      arr.push(e);
      byCountry.set(e.country, arr);
    }
    if (e.styleKey) {
      const arr = byStyle.get(e.styleKey) ?? [];
      arr.push(e);
      byStyle.set(e.styleKey, arr);
    }
    if (e.denomKey) {
      const arr = byDenom.get(e.denomKey) ?? [];
      arr.push(e);
      byDenom.set(e.denomKey, arr);
    }
  }

  // Pre-sort each cluster by directory_rank (ASC NULLS LAST), slug tiebreak.
  for (const m of [byCity, byCountry, byStyle, byDenom]) {
    for (const list of m.values()) list.sort(rankCmp);
  }
  // Global tier: every indexable church sorted by directory_rank. Final
  // fallback when a church has zero cluster siblings (e.g. only-indexable
  // church in its country, no shared style/denom). Without this tier, fully
  // metadata-bare or only-in-country churches get empty lists and stay
  // orphans — the very bug we're fixing. This guarantees EMIT-K totality.
  const globalRanked: Entry[] = [...entries].sort(rankCmp);

  // EMIT pass. For each church, walk the fallback ladder and pick K unique
  // candidates (≠ self). City uses pure rank order. Country uses geo-distance
  // when both have coords, else rank order. Style/denom use rank order.
  const emit = new Map<string, string[]>();
  let cityHits = 0;
  let countryHits = 0;
  let styleHits = 0;
  let denomHits = 0;
  let globalHits = 0;

  for (const src of entries) {
    const picked = new Set<string>([src.slug]); // never include self
    const out: string[] = [];

    const tryFill = (
      candidates: Entry[],
      rerankByGeo: boolean,
    ): number => {
      if (out.length >= K) return 0;
      let pool = candidates;
      if (
        rerankByGeo
        && src.latitude != null
        && src.longitude != null
        && candidates.length <= GEO_RERANK_MAX_CANDIDATES
      ) {
        // Stable sort with geo tiebreak: distance asc when candidate has
        // coords, else fall back to rank position. Source must have coords;
        // candidates without coords retain their rank ordering at the tail.
        // Avoid per-source geo sorting for very large countries (for example
        // the US import set). Those clusters are already sorted by
        // directory_rank; per-row full-country distance sorts turn the job
        // into O(n^2 log n) with no meaningful product gain.
        const withCoords: Entry[] = [];
        const withoutCoords: Entry[] = [];
        for (const c of candidates) {
          if (c.latitude != null && c.longitude != null) withCoords.push(c);
          else withoutCoords.push(c);
        }
        withCoords.sort((a, b) => {
          const da = haversineKm(src.latitude!, src.longitude!, a.latitude!, a.longitude!);
          const db = haversineKm(src.latitude!, src.longitude!, b.latitude!, b.longitude!);
          if (da !== db) return da - db;
          return rankCmp(a, b);
        });
        pool = [...withCoords, ...withoutCoords];
      }
      let added = 0;
      for (const c of pool) {
        if (out.length >= K) break;
        if (picked.has(c.slug)) continue;
        picked.add(c.slug);
        out.push(c.slug);
        added += 1;
      }
      return added;
    };

    // City — purely rank order (city is small enough; geo would noise it).
    if (src.city_slug) cityHits += tryFill(byCity.get(src.city_slug) ?? [], false);
    // Country — geo tiebreak when both have coords.
    if (out.length < K && src.country)
      countryHits += tryFill(byCountry.get(src.country) ?? [], true);
    // Shared style — same musical posture, brand-relevant
    // ([[brand-positioning]]).
    if (out.length < K && src.styleKey)
      styleHits += tryFill(byStyle.get(src.styleKey) ?? [], false);
    // Shared denomination.
    if (out.length < K && src.denomKey)
      denomHits += tryFill(byDenom.get(src.denomKey) ?? [], false);
    // Global fallback. Hit only when a church has near-zero cluster siblings
    // (international fellowships in tiny-presence countries with no
    // matching style/denom). Without this, EMIT totality fails for these
    // churches → they stay orphans, which is the bug we're fixing.
    if (out.length < K) globalHits += tryFill(globalRanked, false);

    emit.set(src.slug, out);
  }

  // RECIPROCITY pass. Count inlinks. Any indexable church with 0 inlinks is
  // injected into a well-connected neighbour's list (allowing growth to
  // K_ABSORB_CAP) so the "every indexable church RECEIVES >=1" invariant
  // holds by construction.
  const inlinks = new Map<string, number>();
  for (const [, list] of emit) {
    for (const slug of list) inlinks.set(slug, (inlinks.get(slug) ?? 0) + 1);
  }
  const orphans: string[] = [];
  for (const e of entries) {
    if ((inlinks.get(e.slug) ?? 0) === 0) orphans.push(e.slug);
  }
  console.log(`  emit pass:  orphans (0 inlinks) = ${orphans.length}`);

  let absorbed = 0;
  const absorberCursor = new Map<Entry[], number>();

  const findAbsorber = (lists: Array<Entry[] | undefined>, orphanSlug: string): Entry | undefined => {
    for (const list of lists) {
      if (!list || list.length === 0) continue;

      let cursor = absorberCursor.get(list) ?? 0;
      for (let i = cursor; i < list.length; i += 1) {
        const c = list[i];
        if (c.slug === orphanSlug) continue;

        const candidateList = emit.get(c.slug) ?? [];
        if (candidateList.length >= K_ABSORB_CAP) {
          if (i === cursor) {
            cursor = i + 1;
            absorberCursor.set(list, cursor);
          }
          continue;
        }
        if (candidateList.includes(orphanSlug)) continue;

        absorberCursor.set(list, i);
        return c;
      }

      absorberCursor.set(list, list.length);
    }

    return undefined;
  };

  for (const orphanSlug of orphans) {
    const orphan = bySlug.get(orphanSlug);
    if (!orphan) continue;

    // Find an absorber: highest-ranked sibling in the same cluster ladder
    // whose list is below K_ABSORB_CAP. City > country > style > denom > any.
    // Cursor per cluster list avoids re-scanning already-full high-rank
    // absorbers for tens of thousands of orphans after large imports.
    const absorber = findAbsorber(
      [
        orphan.city_slug ? byCity.get(orphan.city_slug) : undefined,
        orphan.country ? byCountry.get(orphan.country) : undefined,
        orphan.styleKey ? byStyle.get(orphan.styleKey) : undefined,
        orphan.denomKey ? byDenom.get(orphan.denomKey) : undefined,
        // Global tier: required for orphans whose clusters are all singletons.
        // The high-rank churches absorbing here will swallow the orphan even
        // when no cluster match exists. Bounded by K_ABSORB_CAP per absorber.
        globalRanked,
      ],
      orphan.slug,
    );
    if (!absorber) continue; // Fully isolated — extremely rare; logged below.
    const list = emit.get(absorber.slug) ?? [];
    list.push(orphan.slug);
    emit.set(absorber.slug, list);
    inlinks.set(orphan.slug, 1);
    absorbed += 1;
  }

  // Final invariant check.
  let finalOrphans = 0;
  let totalEmitted = 0;
  for (const e of entries) {
    if ((inlinks.get(e.slug) ?? 0) === 0) finalOrphans += 1;
  }
  for (const [, list] of emit) totalEmitted += list.length;

  console.log(
    `\n  emit hits:  city=${cityHits}  country=${countryHits}  style=${styleHits}  denom=${denomHits}  global=${globalHits}`,
  );
  console.log(
    `  reciprocity: orphans-before=${orphans.length}  absorbed=${absorbed}  orphans-after=${finalOrphans}`,
  );
  console.log(
    `  totals:     indexable=${entries.length}  total_emitted_links=${totalEmitted}  avg_K=${(totalEmitted / Math.max(1, entries.length)).toFixed(2)}`,
  );

  if (finalOrphans > 0) {
    console.log(
      `  WARNING: ${finalOrphans} fully-isolated churches remain (no reachable absorber). These will keep zero inlinks.`,
    );
  }

  if (DRY_RUN) {
    console.log("\nDRY-RUN: no rows written.");
    return;
  }

  // Write back as text[] using the same batched jsonb_to_recordset pattern
  // backfill-facet-columns.ts uses. Cast through text[] via Postgres
  // string_to_array of a comma-joined list is brittle (slugs may contain
  // commas in theory) — use array() over a CTE of jsonb_array_elements_text
  // instead, which preserves each slug exactly.
  const updates = [...emit.entries()].map(([slug, related]) => ({ slug, related }));
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    await sql.query(
      `UPDATE churches AS c
          SET related_church_slugs = d.related
         FROM (
           SELECT (elem->>'slug') AS slug,
                  ARRAY(SELECT jsonb_array_elements_text(elem->'related')) AS related
             FROM jsonb_array_elements($1::jsonb) AS elem
         ) AS d
        WHERE c.slug = d.slug`,
      [JSON.stringify(slice)],
    );
    written += slice.length;
    process.stdout.write(`\r  written ${written}/${updates.length}`);
  }

  console.log(`\nDone. ${written} churches written.`);
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
