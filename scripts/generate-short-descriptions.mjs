#!/usr/bin/env node

/**
 * Generate short descriptions for churches that lack one.
 * Uses Haiku with just name/location/denomination - no web crawling.
 *
 * Usage:
 *   node scripts/generate-short-descriptions.mjs
 *   node scripts/generate-short-descriptions.mjs --limit=100
 *   node scripts/generate-short-descriptions.mjs --dry-run
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 0);
const BATCH_SIZE = 40;

if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

async function generateDescriptions(churches) {
  const list = churches
    .map((c) => `${c.name} | ${c.location || "?"}, ${c.country} | ${c.denomination || "unknown"}`)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Write a short description (1 sentence, max 120 characters) for each church below.

Rules:
- Be factual and concise. Say what it is and where.
- Don't use filler words like "vibrant", "dynamic", "thriving", "passionate".
- If it belongs to a network (Every Nation, Victory, Hillsong, C3, Vineyard etc), mention that.
- If the name is in another language, write the description in English.
- Don't start every description the same way. Vary the structure.

Return JSON array: [{"slug": "the-slug", "description": "..."}]

Churches:
${churches.map((c) => `${c.slug} | ${c.name} | ${c.location || "?"}, ${c.country} | ${c.denomination || "unknown"}`).join("\n")}

JSON only.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error("  Haiku error:", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  const text = data.content[0].text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    console.error("  Failed to parse Haiku response");
    return [];
  }
}

async function main() {
  let query = sql`
    SELECT slug, name, country, location, denomination
    FROM churches
    WHERE status = 'approved'
    AND (description IS NULL OR description = '')
    ORDER BY name
  `;

  let churches = await query;
  if (LIMIT > 0) churches = churches.slice(0, LIMIT);

  console.log(`\nGenerating descriptions for ${churches.length} churches\n`);
  if (DRY_RUN) { console.log("  (dry run)\n"); return; }

  let updated = 0;
  let batches = 0;

  for (let i = 0; i < churches.length; i += BATCH_SIZE) {
    const batch = churches.slice(i, i + BATCH_SIZE);
    batches++;
    console.log(`Batch ${batches} (${i + 1}-${i + batch.length} of ${churches.length})`);

    const results = await generateDescriptions(batch);

    for (const result of results) {
      if (!result.slug || !result.description) continue;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await sql`
            UPDATE churches SET description = ${result.description}, updated_at = now()
            WHERE slug = ${result.slug} AND (description IS NULL OR description = '')
          `;
          updated++;
          break;
        } catch (err) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            console.error("  DB error for " + result.slug + ": " + err.message);
          }
        }
      }
    }

    console.log(`  ${results.length} descriptions generated, ${updated} total updated`);

    // Brief pause between batches
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nDone! Updated ${updated} churches in ${batches} batches`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
