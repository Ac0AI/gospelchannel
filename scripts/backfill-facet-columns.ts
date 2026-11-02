#!/usr/bin/env tsx

/**
 * Materialises churches.city_slug, directory_score, directory_ready, and the
 * global directory_rank so facet/browse pages filter+sort in the DB instead
 * of pulling the full ~56 MB index into the Cloudflare Worker (which OOM'd
 * the isolate → 503s).
 *
 * Zero-drift by construction: ranks/derives the EXACT array the runtime old
 * path used — `_getChurchIndexData()` (same enrichment-meta canonical/max
 * dedup, same mappers). directory_rank = position in that array sorted by
 * compareDirectoryEntries (the SAME comparator filterChurchDirectory's
 * no-query branch uses). So `ORDER BY directory_rank` reproduces the old
 * in-memory facet order byte-for-byte. directory_rank is a global snapshot
 * rank for browse parity, NOT a live-computed truth — reconcile after
 * imports/bulk-approve + nightly.
 *
 * Usage:
 *   npx tsx scripts/backfill-facet-columns.ts --dry-run
 *   npx tsx scripts/backfill-facet-columns.ts
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { getSql } from "../src/db";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { _getChurchIndexData } from "../src/lib/church";
import { computeCitySlug, computeDirectoryScore } from "../src/lib/facet-scoring";
import { compareDirectoryEntries } from "../src/lib/church-directory";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));
const sql = getSql();
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 500;

async function main() {
  console.log(`backfill-facet-columns  ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);

  // The exact records the old facet path consumed via getChurchIndexData().
  const all = await _getChurchIndexData({ strict: true });
  console.log(`  loaded ${all.length} index records`);

  // Global rank: sort a copy with the exact browse comparator.
  const ranked = [...all].sort(compareDirectoryEntries);
  const rankBySlug = new Map<string, number>();
  ranked.forEach((e, i) => rankBySlug.set(e.slug, i));

  const updates = all.map((e) => ({
    slug: e.slug,
    city_slug: computeCitySlug(e.location),
    directory_score: computeDirectoryScore(e),
    directory_ready: e.displayReady !== false,
    directory_rank: rankBySlug.get(e.slug) ?? null,
  }));

  const withCity = updates.filter((u) => u.city_slug).length;
  const avg = updates.reduce((s, u) => s + u.directory_score, 0) / (updates.length || 1);

  if (!DRY_RUN) {
    const runId = randomUUID();
    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH);
      await sql.query(
        `UPDATE churches AS c
           SET city_slug = d.city_slug,
               directory_score = d.directory_score,
               directory_ready = d.directory_ready,
               directory_rank = d.directory_rank,
               directory_reconcile_id = $2
         FROM (SELECT json_extract(value, '$.slug') AS slug, json_extract(value, '$.city_slug') AS city_slug,
               json_extract(value, '$.directory_score') AS directory_score, json_extract(value, '$.directory_ready') AS directory_ready,
               json_extract(value, '$.directory_rank') AS directory_rank FROM json_each($1)) AS d
         WHERE c.slug = d.slug`,
        [JSON.stringify(slice), runId],
      );
      process.stdout.write(`\r  written ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
    }

    const cleared = await sql.query(
      `UPDATE churches
          SET city_slug = NULL,
              directory_score = NULL,
              directory_ready = FALSE,
              directory_rank = NULL
        WHERE status = 'approved'
          AND coalesce(directory_reconcile_id, '') <> $1
          AND (
            city_slug IS NOT NULL
            OR directory_score IS NOT NULL
            OR directory_ready IS NOT FALSE
            OR directory_rank IS NOT NULL
          )
        RETURNING slug`,
      [runId],
    );
    if (cleared.length > 0) {
      console.log(`\n  cleared ${cleared.length} approved rows outside the canonical index`);
    }
  }

  console.log(
    `\n\nDone. records=${all.length}  with_city_slug=${withCity}` +
      `  avg_directory_score=${avg.toFixed(1)}  ranked=${ranked.length}` +
      `${DRY_RUN ? "  (DRY-RUN: no rows written)" : ""}`,
  );
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
