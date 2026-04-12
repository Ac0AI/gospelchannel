#!/usr/bin/env node
/**
 * Batch-enrich approved churches with good_fit_tags using Claude Haiku.
 * Uses existing enrichment data (description, denomination, ministries, languages)
 * to infer which audience groups the church is a good fit for.
 *
 * Taxonomy (controlled set):
 *   Families, Young adults, Students, Seniors, International,
 *   Seekers, Contemporary worship, Traditional worship, Small church, Multilingual
 *
 * Usage:
 *   node scripts/enrich-good-fit-tags.mjs [--dry-run] [--limit 50]
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const VALID_TAGS = [
  "Families",
  "Young adults",
  "Students",
  "Seniors",
  "International",
  "Seekers",
  "Contemporary worship",
  "Traditional worship",
  "Small church",
  "Multilingual",
];

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : 200;

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

async function callHaiku(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 256,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function main() {
  // Get churches with enrichment data but no good_fit_tags
  const rows = await sql`
    SELECT
      c.slug,
      c.name,
      c.description,
      c.denomination,
      e.denomination_network,
      e.languages,
      e.children_ministry,
      e.youth_ministry,
      e.ministries,
      e.church_size,
      e.theological_orientation,
      e.seo_description,
      e.what_to_expect
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug AND e.enrichment_status = 'complete'
    WHERE c.status = 'approved'
      AND (e.good_fit_tags IS NULL OR e.good_fit_tags = '{}')
      AND e.id IS NOT NULL
    ORDER BY c.slug
    LIMIT ${limit}
  `;

  console.log(`Found ${rows.length} churches to enrich (limit: ${limit})`);
  if (rows.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  const systemPrompt = `You are a church directory analyst for GospelChannel.com.
Based on church data, select which audience groups the church is a good fit for.

VALID TAGS (pick 2-5 that genuinely apply, never guess):
${VALID_TAGS.join(", ")}

Rules:
- "Families" if children/youth ministry exists
- "Young adults" or "Students" if youth ministry, university area, or contemporary style
- "Seniors" only if explicitly mentioned or traditional denomination
- "International" if multiple languages or international in name/description
- "Seekers" if welcoming language, Alpha course, or "come as you are" tone
- "Contemporary worship" if charismatic, Hillsong-style, modern music
- "Traditional worship" if liturgical, hymns, Church of Sweden, Catholic
- "Small church" if church_size is "small"
- "Multilingual" if 2+ languages

Respond ONLY with a JSON array of strings. No explanation. Example: ["Families", "Contemporary worship", "Seekers"]`;

  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const context = [
      `Church: ${r.name}`,
      r.description ? `Description: ${r.description.slice(0, 200)}` : null,
      r.seo_description ? `About: ${r.seo_description.slice(0, 200)}` : null,
      r.denomination || r.denomination_network
        ? `Denomination: ${r.denomination || r.denomination_network}`
        : null,
      r.theological_orientation
        ? `Tradition: ${r.theological_orientation}`
        : null,
      r.languages?.length
        ? `Languages: ${r.languages.join(", ")}`
        : null,
      r.children_ministry ? "Has children's ministry" : null,
      r.youth_ministry ? "Has youth ministry" : null,
      r.ministries?.length
        ? `Ministries: ${r.ministries.join(", ")}`
        : null,
      r.church_size ? `Size: ${r.church_size}` : null,
      r.what_to_expect ? `First visit: ${r.what_to_expect.slice(0, 150)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await callHaiku(systemPrompt, context);
      let tags;
      try {
        // Strip markdown fences if present
        const cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        tags = JSON.parse(cleaned);
      } catch {
        console.error(`  ${r.slug}: invalid JSON response: ${response.slice(0, 100)}`);
        errors++;
        continue;
      }

      if (!Array.isArray(tags)) {
        console.error(`  ${r.slug}: response is not an array`);
        errors++;
        continue;
      }

      // Filter to valid tags only
      const validTags = tags.filter((t) => VALID_TAGS.includes(t));
      if (validTags.length === 0) {
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  ${r.slug}: ${validTags.join(", ")}`);
      } else {
        await sql`
          UPDATE church_enrichments
          SET good_fit_tags = ${validTags}
          WHERE church_slug = ${r.slug} AND enrichment_status = 'complete'
        `;
      }
      enriched++;
    } catch (e) {
      console.error(`  ${r.slug}: ${e.message}`);
      errors++;
    }

    if ((i + 1) % 25 === 0 || i + 1 === rows.length) {
      console.log(
        `Progress: ${i + 1}/${rows.length} (${enriched} enriched, ${skipped} skipped, ${errors} errors)`
      );
    }

    // Rate limiting: ~15 req/min for Haiku is safe
    if ((i + 1) % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(
    `\nDone! ${enriched} enriched, ${skipped} skipped (no valid tags), ${errors} errors.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
