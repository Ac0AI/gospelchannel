#!/usr/bin/env node

/**
 * Prayer wall cleanup:
 *   1. Delete 3 prayers that air internal church concerns publicly
 *      (pastoral vacancy, leadership conflict)
 *   2. Dedupe prayers with identical content across churches — keep oldest,
 *      delete the rest
 *
 * Usage:
 *   node scripts/cleanup-prayers.mjs              # run
 *   node scripts/cleanup-prayers.mjs --dry-run    # preview
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");

const BAD_PRAYER_IDS = [
  "93e38f02", // ev-freik-gemeinde-gerolstein: "we need a new pastor"
  "2ba8a3a6", // fr-eglise-evangelique-57: "hiring our next pastor"
  "7bf6d8f1", // ev-freik-gemeinde-bitterfeld: "leadership decisions this month"
];

async function main() {
  console.log("\nPrayer cleanup\n");
  if (DRY_RUN) console.log("  (dry run)\n");

  // 1. Delete flagged prayers
  console.log("── Deleting flagged prayers ──");
  let flaggedDeleted = 0;
  for (const prefix of BAD_PRAYER_IDS) {
    const rows = await sql`SELECT id, church_slug, content FROM prayers WHERE id::text LIKE ${prefix + "%"}`;
    if (rows.length === 0) {
      console.log(`  skip ${prefix} (not found)`);
      continue;
    }
    for (const row of rows) {
      console.log(`  delete [${prefix}] ${row.church_slug}`);
      console.log(`         "${row.content.slice(0, 100)}"`);
      if (!DRY_RUN) {
        await sql`DELETE FROM prayers WHERE id = ${row.id}`;
      }
      flaggedDeleted++;
    }
  }

  // 2. Dedupe identical content: keep oldest, delete rest
  console.log("\n── Deduping identical content ──");
  const dupes = await sql`
    SELECT content, COUNT(*) AS cnt, MIN(created_at) AS first_seen
    FROM prayers
    GROUP BY content
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;
  console.log(`  found ${dupes.length} duplicate content groups`);

  let dupesDeleted = 0;
  for (const group of dupes) {
    // Keep the oldest row for this content, delete the others
    const rows = await sql`
      SELECT id, church_slug, created_at
      FROM prayers
      WHERE content = ${group.content}
      ORDER BY created_at ASC
    `;
    const [keep, ...rest] = rows;
    console.log(`  "${group.content.slice(0, 70).replace(/\s+/g, " ")}..." (${rows.length} copies)`);
    console.log(`    keep ${keep.church_slug}`);
    for (const row of rest) {
      console.log(`    drop ${row.church_slug}`);
      if (!DRY_RUN) {
        await sql`DELETE FROM prayers WHERE id = ${row.id}`;
      }
      dupesDeleted++;
    }
  }

  console.log(`\nDone. Flagged: ${flaggedDeleted}, Dupes removed: ${dupesDeleted}`);
  if (DRY_RUN) console.log("(dry run - no changes made)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
