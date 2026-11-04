#!/usr/bin/env tsx

/**
 * Builds the precomputed facet links (drizzle-d1/0005_facet_links.sql) and the
 * site stats (app_kv 'site_stats', shown on every page) that
 * the country, style and denomination pages, the hub pages and the sitemap
 * read instead of aggregating over every church per request. Same SQL as the
 * pages used (fetchFacetRelatedLinks), so the numbers are identical.
 * Runs nightly in .github/workflows/reconcile-directory.yml, after the facet
 * columns it reads (city_slug, directory_rank, directory_ready) are
 * reconciled.
 *
 * Usage:
 *   npx tsx scripts/build-facet-links.ts --dry-run
 *   npx tsx scripts/build-facet-links.ts
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { computeFacetLinkRows } from "../src/lib/facet-links-build";
import { writeFacetLinkGeneration } from "../src/lib/facet-links";
import { writePrecomputedChurchStats } from "../src/lib/content";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const started = Date.now();
  console.log(`build-facet-links  ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);
  const { rows, sources } = await computeFacetLinkRows({ pauseMs: 3000 });
  const all = rows.filter((row) => row.sourceKind === "all");
  console.log(
    `  ${sources} sources, ${rows.length} rows (whole directory: ${all.filter((r) => r.targetKind === "city").length} cities, ` +
      `${all.filter((r) => r.targetKind === "country").length} countries) in ${Math.round((Date.now() - started) / 1000)} s`,
  );
  if (DRY_RUN) return;
  const generation = new Date().toISOString();
  await writeFacetLinkGeneration(generation, rows);
  console.log(`  wrote generation ${generation}`);
  const stats = await writePrecomputedChurchStats();
  console.log(`  wrote site stats: ${stats.churchCount} churches in ${stats.countryCount} countries`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
