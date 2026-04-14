#!/usr/bin/env node

/**
 * Generate short welcome descriptions for churches that have no summary yet,
 * using only the metadata we already have (name, city, country, denomination,
 * address). No website crawl — just Claude Haiku rewriting structured data
 * into 2-3 friendly sentences.
 *
 * Runs Haiku in parallel batches; writes to church_enrichments.summary and
 * optionally churches.description when empty.
 *
 * Usage:
 *   node scripts/enrich-summary-from-metadata.mjs --dry-run --limit=20
 *   node scripts/enrich-summary-from-metadata.mjs --limit=500
 *   node scripts/enrich-summary-from-metadata.mjs               # all pending
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_LIMIT = 0; // 0 = all

function parseArgs(argv) {
  const o = { dryRun: false, limit: DEFAULT_LIMIT, concurrency: DEFAULT_CONCURRENCY };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a.startsWith("--limit=")) o.limit = Math.max(0, Number(a.split("=")[1]) || 0);
    else if (a.startsWith("--concurrency=")) o.concurrency = Math.max(1, Number(a.split("=")[1]) || DEFAULT_CONCURRENCY);
  }
  return o;
}

async function loadTargets(sql, limit) {
  if (limit > 0) {
    return sql`
      SELECT c.slug, c.name, c.country, c.location, c.denomination, c.language,
             e.street_address, e.denomination_network, e.latitude, e.longitude
      FROM churches c
      LEFT JOIN church_enrichments e ON e.church_slug = c.slug
      WHERE c.status = 'approved'
        AND (e.summary IS NULL OR e.summary = '')
        AND c.name IS NOT NULL AND c.name != ''
      ORDER BY c.slug
      LIMIT ${limit}
    `;
  }
  return sql`
    SELECT c.slug, c.name, c.country, c.location, c.denomination, c.language,
           e.street_address, e.denomination_network, e.latitude, e.longitude
    FROM churches c
    LEFT JOIN church_enrichments e ON e.church_slug = c.slug
    WHERE c.status = 'approved'
      AND (e.summary IS NULL OR e.summary = '')
      AND c.name IS NOT NULL AND c.name != ''
    ORDER BY c.slug
  `;
}

function buildSystemPrompt() {
  return `You write short, welcoming church descriptions for a church directory called GospelChannel.

Rules:
- 2 to 3 complete sentences, max 240 characters total.
- Plain text, no markdown, no quotes, no emoji.
- Factual and friendly — describe who the church is based only on the metadata you're given.
- Use the church's own language when natural: English for English/international churches, otherwise match the church's country language (German, French, Italian, Spanish, Swedish). Default to English if unsure.
- Never invent services, pastors, events, or history that aren't in the metadata.
- Don't start with "Welcome to" or "Located in". Start with the church name or a noun phrase.
- Don't end with a call to action.
- If the denomination network matches the denomination, mention only one to avoid repetition.`;
}

function buildUserPrompt(target) {
  const parts = [
    `Name: ${target.name}`,
    target.location ? `City: ${target.location}` : null,
    target.country ? `Country: ${target.country}` : null,
    target.denomination ? `Denomination: ${target.denomination}` : null,
    target.denomination_network && target.denomination_network !== target.denomination
      ? `Network: ${target.denomination_network}`
      : null,
    target.street_address ? `Address: ${target.street_address}` : null,
    target.language ? `Language: ${target.language}` : null,
  ].filter(Boolean);
  return `Write a short description for this church using only this metadata:\n\n${parts.join("\n")}`;
}

async function callHaiku(target, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 200,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(target) }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content?.[0]?.text || "").trim();
  return text;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL");
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  console.log("Loading targets without summary...");
  const targets = await loadTargets(sql, options.limit);
  console.log(`Targets: ${targets.length}`);
  if (targets.length === 0) return;

  console.log(`Running Haiku with concurrency ${options.concurrency}...`);
  const summary = { total: targets.length, written: 0, errors: 0, skipped: 0 };
  let processed = 0;

  await mapWithConcurrency(targets, options.concurrency, async (target) => {
    try {
      const text = await callHaiku(target, apiKey);
      if (!text || text.length < 20) {
        summary.skipped += 1;
        return;
      }
      processed += 1;
      if (processed % 50 === 0) {
        console.log(`  ${processed}/${targets.length} (written: ${summary.written})`);
      }
      if (options.dryRun) {
        if (summary.written < 5) console.log(`  ${target.slug}: ${text}`);
        summary.written += 1;
        return;
      }
      // Upsert into church_enrichments.summary (only when currently empty)
      const existing = await sql`SELECT id FROM church_enrichments WHERE church_slug = ${target.slug}`;
      if (existing.length > 0) {
        await sql`
          UPDATE church_enrichments
          SET summary = ${text}, updated_at = NOW()
          WHERE church_slug = ${target.slug}
            AND (summary IS NULL OR summary = '')
        `;
      } else {
        await sql`
          INSERT INTO church_enrichments (church_slug, summary, created_at, updated_at)
          VALUES (${target.slug}, ${text}, NOW(), NOW())
        `;
      }
      // Also fill churches.description when empty — the public page uses this
      await sql`
        UPDATE churches
        SET description = ${text}, updated_at = NOW()
        WHERE slug = ${target.slug}
          AND (description IS NULL OR description = '')
      `;
      summary.written += 1;
    } catch (error) {
      summary.errors += 1;
      if (summary.errors < 5) console.log(`  error on ${target.slug}: ${error.message}`);
    }
  });

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));
  if (options.dryRun) console.log("DRY RUN — no DB writes.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
