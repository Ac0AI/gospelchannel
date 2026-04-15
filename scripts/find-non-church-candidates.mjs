#!/usr/bin/env node

/**
 * Search churches table for entries that are likely NOT churches:
 * choirs, bands, worship collectives, labels, artists, ensembles.
 *
 * Read-only — prints candidates to stdout.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const NAME_PATTERNS = [
  "choir",
  "singers",
  "ensemble",
  "collective",
  "band",
  "worship team",
  "music group",
  "record label",
  "records",
  "music",
  "voices",
  "a cappella",
  "acapella",
  "quartet",
  "trio",
  "duo",
  " co\\.",
  "entertainment",
];

async function main() {
  console.log("\nSearching for non-church candidates...\n");

  for (const pattern of NAME_PATTERNS) {
    const rows = await sql`
      SELECT slug, name, country, status, website, description
      FROM churches
      WHERE name ~* ${"\\y" + pattern + "\\y"}
      ORDER BY name
    `;
    if (rows.length === 0) continue;
    console.log(`\n── pattern: "${pattern}" (${rows.length}) ──`);
    for (const row of rows) {
      console.log(`  [${row.status}] ${row.name}`);
      console.log(`    slug: ${row.slug}   country: ${row.country}`);
      if (row.website) console.log(`    ${row.website}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
