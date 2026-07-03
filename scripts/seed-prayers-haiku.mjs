#!/usr/bin/env node

/**
 * Seed prayer-wall prayers for churches that have none, generated with
 * Claude Haiku. Follows the conventions of scripts/seed-outreach-prayers.mjs
 * (short first-name prayers, mixed local language + English, prayed_count
 * 0-8, moderated=true, created_at backdated up to 60 days).
 *
 * Selection: approved, indexable-shaped churches (worship playlist OR
 * on-brand denomination with display_score >= 65) with ZERO existing
 * prayers, ordered by Google reviews then display score — so the most
 * visited pages get living prayer walls first.
 *
 * Usage:
 *   node scripts/seed-prayers-haiku.mjs --dry-run            # show plan + one sample batch
 *   node scripts/seed-prayers-haiku.mjs --total=800
 *
 * Flags:
 *   --total=N     Total prayers to insert (default 800)
 *   --dry-run     Generate ONE sample batch, print it, write nothing
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const HAIKU_MODEL = "claude-haiku-4-5-20251001"; // same pin as src/lib/auto-enrich.ts
const CHURCHES_PER_CALL = 10;

// Keep in sync with OFF_BRAND_DENOMINATIONS + INDEXABLE_ONBRAND_SCORE_MIN in
// src/lib/content-quality.ts (script can't import TS).
const SCORE_MIN = 65;
const OFF_BRAND = [
  "Catholic", "Roman Catholic",
  "Methodist", "United Methodist", "Free Methodist",
  "AME", "CME", "African Methodist Episcopal", "Christian Methodist Episcopal",
  "Presbyterian", "Lutheran", "Episcopal", "Anglican",
  "Orthodox", "Greek Orthodox", "Russian Orthodox", "Eastern Orthodox",
  "Coptic Orthodox", "Antiochian Orthodox",
  "Seventh-day Adventist", "Seventh-Day Adventist", "Adventist", "Advent Christian",
  "Christian Science", "Jehovah's Witnesses",
  "Mormon", "Latter-Day Saints", "Latter-day Saints", "LDS",
  "Buddhist", "Muslim", "Jewish", "Hindu",
  "Unitarian", "Unitarian Universalist", "Quaker",
  "United Church of Christ", "Church of Christ", "Christadelphian",
];

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    churches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slug: { type: "string" },
          prayers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "First name only, plausible for the church's country" },
                content: { type: "string", description: "The prayer text, 1-2 sentences" },
              },
              required: ["name", "content"],
              additionalProperties: false,
            },
          },
        },
        required: ["slug", "prayers"],
        additionalProperties: false,
      },
    },
  },
  required: ["churches"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You write short prayers for the public prayer wall of GospelChannel, a church directory. Each prayer appears on one church's page, written as if by an ordinary visitor or member.

Style rules:
- 1-2 sentences, 8-30 words. Plain, heartfelt, specific. No poetry, no King James English.
- Vary the voice across a church's prayers: a member thankful for the church, someone praying for the city or its people, a newcomer looking for a church home, a personal need (health, family, faith of a child, work), a prayer for the pastors/leaders, revival for the region.
- Address God naturally (Lord, Jesus, Father, God) and vary the openings. Never start every prayer the same way.
- Language: write MOST prayers in the main language of the church's country (Spanish for Spain/Mexico/etc., German for Germany, French for France, Swedish for Sweden, Portuguese for Brazil/Portugal, Dutch for the Netherlands...), and 1 per church in English. For English-speaking countries write all in English.
- Names: first names only, plausible for the country. Vary gender and generation.
- You may mention the church by name or its city naturally, but NEVER invent facts (no pastor names, events, programs, or history).
- No emdashes. No hashtags. No exclamation-mark pileups.`;

function parseArgs(argv) {
  const o = { total: 800, dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") o.dryRun = true;
    else if (a.startsWith("--total=")) o.total = Math.max(1, Number(a.split("=")[1]) || 800);
  }
  return o;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const o = parseArgs(process.argv.slice(2));
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
  const sql = neon(process.env.DATABASE_URL);
  const anthropic = new Anthropic();

  // 4-5 prayers per church -> churches needed for the total
  const churchCount = Math.ceil(o.total / 4.5);
  const rows = await sql.query(`
    SELECT c.slug, c.name, c.location, c.country, c.denomination
    FROM churches c
    WHERE c.status = 'approved'
      AND NOT EXISTS (SELECT 1 FROM prayers p WHERE p.church_slug = c.slug)
      -- Non-Christian places of worship that slip past the denomination
      -- denylist (e.g. imported POI data). Note: 'temple' alone is NOT safe
      -- to exclude — plenty of Pentecostal churches are named Temple.
      AND c.name !~* '\\m(gurdwara|mosque|masjid|synagogue|sikh|buddhist|hindu)\\M'
      AND (
        array_length(c.spotify_playlist_ids, 1) > 0
        OR array_length(c.additional_playlists, 1) > 0
        OR (
          c.denomination IS NOT NULL AND length(c.denomination) > 0
          AND NOT (c.denomination = ANY($1::text[]))
          AND c.display_score IS NOT NULL AND c.display_score >= $2
        )
      )
    ORDER BY (SELECT e.google_reviews_count FROM church_enrichments e WHERE e.church_slug = c.slug) DESC NULLS LAST,
             c.display_score DESC NULLS LAST
    LIMIT $3`, [OFF_BRAND, SCORE_MIN, churchCount]);

  console.log(`Churches selected: ${rows.length} (target ${o.total} prayers, 4-5 each)`);
  if (rows.length === 0) return;

  let inserted = 0;
  const failures = [];
  for (let i = 0; i < rows.length && inserted < o.total; i += CHURCHES_PER_CALL) {
    const batch = rows.slice(i, i + CHURCHES_PER_CALL);
    const churchList = batch.map((c, idx) => {
      const per = (i + idx) % 2 === 0 ? 5 : 4;
      return `- slug: ${c.slug} | name: ${c.name} | city: ${c.location || "unknown"} | country: ${c.country || "unknown"} | denomination: ${c.denomination || "unknown"} | prayers: ${per}`;
    }).join("\n");

    let parsed;
    try {
      const response = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        messages: [{
          role: "user",
          content: `Write prayers for these churches (the "prayers" field says how many each church gets):\n\n${churchList}`,
        }],
      });
      const text = response.content.find((b) => b.type === "text")?.text ?? "";
      parsed = JSON.parse(text);
    } catch (err) {
      failures.push(`batch ${i / CHURCHES_PER_CALL}: ${err.message?.slice(0, 120)}`);
      continue;
    }

    if (o.dryRun) {
      console.log(JSON.stringify(parsed, null, 2));
      console.log("(dry-run: one sample batch shown, nothing written)");
      return;
    }

    const bySlug = new Map(batch.map((c) => [c.slug, c]));
    for (const church of parsed.churches ?? []) {
      if (!bySlug.has(church.slug)) { failures.push(`unknown slug ${church.slug}`); continue; }
      for (const p of church.prayers ?? []) {
        if (inserted >= o.total) break;
        const name = String(p.name || "").trim().slice(0, 40);
        const content = String(p.content || "").trim();
        if (!name || content.length < 10 || content.length > 300) continue;
        await sql`
          INSERT INTO prayers (id, church_slug, content, original_content, author_name, prayed_count, moderated, created_at)
          VALUES (${randomUUID()}, ${church.slug}, ${content}, ${content}, ${name}, ${Math.floor(Math.random() * 8)}, true, NOW() - (random() * interval '60 days'))
        `;
        inserted += 1;
      }
    }
    console.log(`  batch ${Math.floor(i / CHURCHES_PER_CALL) + 1}/${Math.ceil(rows.length / CHURCHES_PER_CALL)}: total inserted ${inserted}`);
  }

  console.log(`\nDone. Inserted ${inserted} prayers.`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    failures.slice(0, 10).forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
