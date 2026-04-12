#!/usr/bin/env node
/**
 * Backfill claim_preview_token for all approved churches that don't have one.
 * Generates a unique 22-char base64url token per church.
 *
 * Usage: node scripts/backfill-preview-tokens.mjs [--dry-run]
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

loadEnvConfig(process.cwd());

const dryRun = process.argv.includes("--dry-run");
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);

function generateToken() {
  return randomBytes(16).toString("base64url"); // 22 chars
}

async function main() {
  const rows = await sql`
    SELECT slug FROM churches
    WHERE status = 'approved' AND claim_preview_token IS NULL
    ORDER BY slug
  `;

  console.log(`Found ${rows.length} churches without preview tokens`);
  if (dryRun) {
    console.log("DRY RUN - would generate tokens for:");
    rows.slice(0, 5).forEach((r) => console.log(`  ${r.slug} -> ${generateToken()}`));
    if (rows.length > 5) console.log(`  ... and ${rows.length - 5} more`);
    return;
  }

  let updated = 0;
  let errors = 0;

  // Batch in groups of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const promises = batch.map(async (row) => {
      const token = generateToken();
      try {
        await sql`
          UPDATE churches SET claim_preview_token = ${token}
          WHERE slug = ${row.slug} AND claim_preview_token IS NULL
        `;
        updated++;
      } catch (e) {
        // Unique constraint violation - regenerate
        const retryToken = generateToken();
        try {
          await sql`
            UPDATE churches SET claim_preview_token = ${retryToken}
            WHERE slug = ${row.slug} AND claim_preview_token IS NULL
          `;
          updated++;
        } catch (e2) {
          console.error(`Failed for ${row.slug}:`, e2.message);
          errors++;
        }
      }
    });
    await Promise.all(promises);
    if ((i + 50) % 500 === 0 || i + 50 >= rows.length) {
      console.log(`Progress: ${Math.min(i + 50, rows.length)}/${rows.length} (${updated} updated, ${errors} errors)`);
    }
  }

  console.log(`\nDone! ${updated} tokens generated, ${errors} errors.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
