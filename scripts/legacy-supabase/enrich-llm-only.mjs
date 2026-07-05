#!/usr/bin/env node

/**
 * LLM-Only Church Enrichment
 *
 * Generates summary, SEO description, languages, and theological orientation
 * from existing churches.json data — no crawling, no external APIs.
 * Saves results to church_enrichments in Supabase.
 *
 * Usage:
 *   node scripts/enrich-llm-only.mjs [options]
 *
 * Options:
 *   --limit=<n>       Max churches to process (default: all eligible)
 *   --dry-run         Show what would be enriched without doing it
 *   --force           Re-enrich even if already complete in Supabase
 *   --slug=<slug>     Enrich a single church
 *   --concurrency=<n> Parallel LLM calls (default: 5)
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency, sleep } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

loadLocalEnv(ROOT_DIR);

const MODEL = "claude-sonnet-4-20250514";
const BATCH_DELAY_MS = 300; // ms between batches to avoid rate limits

// ─── Args ───

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) {
        args[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        args[arg.slice(2)] = true;
      }
    }
  }
  return args;
}

// ─── LLM prompt ───

function buildPrompt(church) {
  const parts = [
    `Name: ${church.name}`,
    church.location ? `Location: ${church.location}` : null,
    church.country ? `Country: ${church.country}` : null,
    church.denomination ? `Denomination: ${church.denomination}` : null,
    church.musicStyle?.length ? `Music styles: ${church.musicStyle.join(", ")}` : null,
    church.notableArtists?.length ? `Notable artists: ${church.notableArtists.join(", ")}` : null,
    church.description?.length > 20 ? `Existing description: ${church.description}` : null,
    church.founded ? `Founded: ${church.founded}` : null,
    church.website ? `Website: ${church.website}` : null,
    church.spotifyUrl ? `Has Spotify presence` : null,
    church.youtubeChannelId ? `Has YouTube channel` : null,
  ].filter(Boolean);

  return `You are writing content for a church profile page on GospelChannel, a worship music discovery platform.

Given this church data:
${parts.join("\n")}

Generate a JSON object with these fields:

1. "summary": 2-3 sentences for someone considering visiting or exploring this church's worship. Warm but factual. Mention what makes them distinctive — worship style, denomination, location, community. Do NOT use generic filler like "welcoming community" or "vibrant worship" unless you have evidence. If you lack info, keep it short and factual rather than generic.

2. "seo_description": Exactly 150-160 characters. Include the church name, location/country, and one key feature. Optimized for Google search.

3. "theological_orientation": ONE of: "charismatic", "reformed", "evangelical", "pentecostal", "lutheran", "catholic", "orthodox", "anglican", "baptist", "methodist", "non-denominational", "progressive". Infer from denomination if possible. Can combine two: "charismatic evangelical". Use null if truly unknown.

4. "languages": Array of languages likely used. Infer from country and location. A Swedish church uses ["Swedish"], a Brazilian church uses ["Portuguese"]. If multinational (like Hillsong), include ["English"]. Never empty — always infer at least one.

5. "denomination_network": Parent denomination, network, or movement if inferable from the name or denomination field. Examples: "Assemblies of God", "Church of Sweden", "Hillsong Network". null if unknown.

Respond with ONLY valid JSON. No markdown fences, no explanation.`;
}

// ─── LLM call ───

async function generateEnrichment(anthropic, church, retries = 2) {
  const prompt = buildPrompt(church);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const text = (response.content[0]?.text || "{}")
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();

      const parsed = JSON.parse(text);

      // Validate minimum quality
      if (!parsed.summary || parsed.summary.length < 30) {
        throw new Error("Summary too short");
      }

      return {
        summary: parsed.summary,
        seo_description: parsed.seo_description || null,
        theological_orientation: parsed.theological_orientation || null,
        languages: Array.isArray(parsed.languages) ? parsed.languages : null,
        denomination_network: parsed.denomination_network || null,
      };
    } catch (err) {
      if (attempt < retries) {
        console.log(`  [retry] ${church.slug}: ${err.message}`);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      console.error(`  [fail] ${church.slug}: ${err.message}`);
      return null;
    }
  }
}

// ─── Main ───

async function main() {
  const args = parseArgs();
  const limit = args.limit ? parseInt(args.limit, 10) : Infinity;
  const dryRun = Boolean(args["dry-run"]);
  const force = Boolean(args.force);
  const slugFilter = args.slug || null;
  const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : 5;

  // Validate env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
    process.exit(1);
  }
  if (!anthropicKey) {
    console.error("Missing ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Load churches
  const churchesPath = join(ROOT_DIR, "src/data/churches.json");
  const allChurches = JSON.parse(readFileSync(churchesPath, "utf8"));
  console.log(`Loaded ${allChurches.length} churches from churches.json`);

  // Load existing enrichments
  const existingSlugs = new Set();
  if (!force) {
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from("church_enrichments")
        .select("church_slug")
        .eq("enrichment_status", "complete")
        .not("summary", "is", null)
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (row.church_slug) existingSlugs.add(row.church_slug);
      }
      if (data.length < pageSize) break;
      from += pageSize;
    }
    console.log(`Found ${existingSlugs.size} already-enriched churches in Supabase`);
  }

  // Filter eligible churches
  const eligible = allChurches.filter((c) => {
    if (slugFilter && c.slug !== slugFilter) return false;
    if (!force && existingSlugs.has(c.slug)) return false;

    // Must have location — otherwise LLM has nothing useful to say
    if (!c.location && !c.country) return false;

    // Must have at least some context beyond just name+country
    const hasContext =
      c.denomination ||
      c.musicStyle?.length > 0 ||
      (c.description?.length ?? 0) > 20 ||
      c.notableArtists?.length > 0 ||
      c.youtubeChannelId ||
      c.spotifyUrl;

    return hasContext;
  });

  const toProcess = eligible.slice(0, limit);
  console.log(`Eligible: ${eligible.length}, processing: ${toProcess.length}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would enrich:");
    for (const c of toProcess.slice(0, 20)) {
      const ctx = [c.denomination, c.musicStyle?.[0], c.description?.slice(0, 40)].filter(Boolean).join(" | ");
      console.log(`  ${c.slug} — ${c.name} (${c.country}) [${ctx}]`);
    }
    if (toProcess.length > 20) console.log(`  ... and ${toProcess.length - 20} more`);
    console.log(`\nEstimated cost: ~$${(toProcess.length * 0.015).toFixed(2)} (Sonnet)`);
    return;
  }

  // Process with concurrency
  let success = 0;
  let failed = 0;
  let skipped = 0;

  const results = await mapWithConcurrency(toProcess, concurrency, async (church, i) => {
    if (i > 0 && i % concurrency === 0) {
      await sleep(BATCH_DELAY_MS);
    }

    const data = await generateEnrichment(anthropic, church);
    if (!data) {
      failed++;
      return null;
    }

    // Upsert to Supabase
    const row = {
      church_slug: church.slug,
      summary: data.summary,
      seo_description: data.seo_description,
      theological_orientation: data.theological_orientation,
      languages: data.languages,
      denomination_network: data.denomination_network,
      enrichment_status: "complete",
      confidence: 0.7, // moderate confidence — Sonnet-inferred, not crawled
      schema_version: 1,
      last_enriched_at: new Date().toISOString(),
      sources: JSON.stringify({ method: "llm-only", model: MODEL, date: new Date().toISOString() }),
    };

    const { error } = await supabase
      .from("church_enrichments")
      .upsert(row, { onConflict: "church_slug" });

    if (error) {
      console.error(`  [db] ${church.slug}: ${error.message}`);
      failed++;
      return null;
    }

    success++;
    if (success % 50 === 0) {
      console.log(`Progress: ${success} enriched, ${failed} failed (${i + 1}/${toProcess.length})`);
    }

    return data;
  });

  console.log(`\nDone!`);
  console.log(`  Enriched: ${success}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Total:    ${toProcess.length}`);
  console.log(`\nEstimated cost: ~$${(success * 0.015).toFixed(2)} (Sonnet)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
