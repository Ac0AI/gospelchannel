#!/usr/bin/env node

/**
 * Strip non-renderable elements from church_enrichments.service_times so the raw
 * column matches what the site actually shows.
 *
 * Background: an older enrichment pass dumped Google opening hours straight into
 * service_times as `{label:"Monday: Closed", source:"google-places"}` objects —
 * office hours and closed days masquerading as service times (6,423 churches,
 * incl. 4,739 "Monday: Closed"). sanitizeServiceTimes() (src/lib/content-quality.ts)
 * already drops these at render because they lack a `day`+`time`, so they are NOT
 * visible on the site — BUT the `hasServiceTimes` badge and filter
 * (src/lib/church.ts) count the raw jsonb array length, so these churches are
 * false positives: they claim to have service times yet display none.
 *
 * This removes every service_times element that would not survive the render-time
 * sanitizer (keep iff it has a non-empty `day` AND a `time` containing a digit).
 * Set-based, idempotent, safe: it can only remove elements that already do not
 * render, never ones that do.
 *
 * Usage:
 *   node scripts/clean-service-times.mjs --dry-run
 *   node scripts/clean-service-times.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

// A service_times element renders iff it has a non-empty `day` and a `time`
// containing a digit (mirrors normalizeDay + normalizeTime in content-quality.ts).
const KEEP = `(el ? 'day' AND el ? 'time' AND btrim(el->>'day') <> '' AND el->>'time' ~ '[0-9]')`;
const HAS_JUNK = `
  jsonb_typeof(e.service_times) = 'array'
  AND jsonb_array_length(e.service_times) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(e.service_times) el WHERE NOT ${KEEP}
  )`;

async function main() {
  loadLocalEnv(ROOT_DIR);
  const dryRun = process.argv.includes("--dry-run");
  const sql = neon(process.env.DATABASE_URL);

  const before = await sql.query(`SELECT count(*)::int n FROM church_enrichments e WHERE ${HAS_JUNK}`);
  const affected = before[0].n;
  console.log(`Churches with non-renderable service_times elements: ${affected}`);

  // How many end up fully empty (had ONLY junk) vs keep some real times.
  const emptied = await sql.query(`
    SELECT count(*)::int n FROM church_enrichments e
    WHERE ${HAS_JUNK}
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.service_times) el WHERE ${KEEP})`);
  console.log(`  of which become empty (were ALL junk): ${emptied[0].n}`);
  console.log(`  of which keep some real service times: ${affected - emptied[0].n}`);

  const sample = await sql.query(`
    SELECT church_slug, service_times FROM church_enrichments e WHERE ${HAS_JUNK} LIMIT 3`);
  console.log("\nExamples (before):");
  sample.forEach((r) => console.log(`  ${r.church_slug} → ${JSON.stringify(r.service_times).slice(0, 120)}`));

  if (dryRun) {
    console.log("\n(dry-run — re-run without --dry-run to apply)");
    return;
  }

  const res = await sql.query(`
    UPDATE church_enrichments e
    SET service_times = COALESCE(
          (SELECT jsonb_agg(el) FROM jsonb_array_elements(e.service_times) el WHERE ${KEEP}),
          '[]'::jsonb),
        updated_at = now()
    WHERE ${HAS_JUNK}`);
  console.log(`\nCleaned ${res.length ?? affected} churches (rowCount reported by driver may be 0; verifying).`);

  const after = await sql.query(`SELECT count(*)::int n FROM church_enrichments e WHERE ${HAS_JUNK}`);
  console.log(`Remaining with junk after clean: ${after[0].n} (should be 0)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
