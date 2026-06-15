#!/usr/bin/env node

/**
 * Worship-style (music_style) classifier.
 *
 * Only ~1% of churches have music_style set, yet worship style is the
 * directory's core discovery axis (the /church/style hubs + filters). This
 * backfills music_style for indexable on-brand churches that are missing it,
 * inferring 1-2 styles from the church's existing description, denomination,
 * and notable artists via Claude Haiku. Output is filtered to the canonical
 * phrases that STYLE_FILTERS (src/lib/church-directory.ts) actually matches.
 *
 * Usage:
 *   node scripts/enrich-music-style.mjs --dry-run --limit=15
 *   node scripts/enrich-music-style.mjs --limit=3000 --concurrency=8
 *
 * Required env: DATABASE_URL, ANTHROPIC_API_KEY
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency } from "./lib/enrichment/rate-limiter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const MODEL = "claude-haiku-4-5-20251001";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
const sql = neon(DATABASE_URL);
const anthropic = new Anthropic();

// Canonical phrases that match STYLE_FILTERS.match in src/lib/church-directory.ts.
// The classifier MUST return values from this set so matchesStyle() works.
const VALID_STYLES = new Set([
  "contemporary worship",
  "gospel",
  "charismatic worship",
  "african worship",
  "latin worship",
  "acoustic worship",
  "kids worship",
  "worship anthems",
]);

const OFF_BRAND = [
  "Catholic", "Roman Catholic", "Methodist", "United Methodist", "Free Methodist",
  "AME", "CME", "African Methodist Episcopal", "Christian Methodist Episcopal",
  "Presbyterian", "Lutheran", "Episcopal", "Anglican", "Orthodox", "Greek Orthodox",
  "Russian Orthodox", "Eastern Orthodox", "Coptic Orthodox", "Antiochian Orthodox",
  "Seventh-day Adventist", "Seventh-Day Adventist", "Adventist", "Advent Christian",
  "Christian Science", "Jehovah's Witnesses", "Mormon", "Latter-Day Saints",
  "Latter-day Saints", "LDS", "Buddhist", "Muslim", "Jewish", "Hindu", "Unitarian",
  "Unitarian Universalist", "Quaker", "United Church of Christ", "Church of Christ",
  "Christadelphian",
];

function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) args[a.slice(2, eq)] = a.slice(eq + 1);
      else args[a.slice(2)] = true;
    }
  }
  return args;
}

function buildPrompt(c) {
  const parts = [
    `Name: ${c.name}`,
    c.denomination ? `Denomination: ${c.denomination}` : null,
    c.location ? `Location: ${c.location}` : null,
    c.notable_artists?.length ? `Notable artists: ${c.notable_artists.join(", ")}` : null,
    c.description ? `Description: ${c.description.slice(0, 600)}` : null,
  ].filter(Boolean).join("\n");

  return `You classify a church's worship-music style for a worship-discovery directory.

Church:
${parts}

Pick the 1-2 best-fitting styles and return their EXACT canonical phrases from this list:
- "contemporary worship" — modern band-led worship / CCM (Hillsong, Bethel, Elevation feel)
- "gospel" — gospel & choir, Black gospel, contemporary gospel
- "charismatic worship" — Spirit-led, spontaneous, prophetic, Pentecostal praise
- "african worship" — African / diaspora gospel
- "latin worship" — Spanish / Latin worship
- "acoustic worship" — acoustic, folk, hymn-led, reflective stillness
- "kids worship" — family / kids focused
- "worship anthems" — high-energy, rock, EDM-driven praise

Guidance: Pentecostal/Charismatic → usually "charismatic worship". Non-denominational/Evangelical → usually "contemporary worship". Baptist → often "gospel" or "contemporary worship". Use location/language for "latin worship" (Spanish-speaking) or "african worship". Most confident style first. If signal is weak, give the single best denomination-based guess.

Respond with ONLY JSON, no markdown: {"styles": ["contemporary worship"]}`;
}

async function classify(c, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 80,
        messages: [{ role: "user", content: buildPrompt(c) }],
      });
      const text = (res.content[0]?.text || "{}")
        .replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
      const parsed = JSON.parse(text);
      const styles = Array.isArray(parsed.styles) ? parsed.styles : [];
      const clean = styles
        .map((s) => String(s).toLowerCase().trim())
        .filter((s) => VALID_STYLES.has(s))
        .slice(0, 2);
      return clean;
    } catch (err) {
      if (attempt < retries) { await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); continue; }
      console.error(`  [fail] ${c.slug}: ${err.message}`);
      return null;
    }
  }
}

async function main() {
  const args = parseArgs();
  const limit = args.limit ? parseInt(args.limit, 10) : 1000000;
  const dryRun = Boolean(args["dry-run"]);
  const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : 6;

  const rows = await sql`
    SELECT slug, name, denomination, location, description, notable_artists
    FROM churches
    WHERE status = 'approved'
      AND (music_style IS NULL OR array_length(music_style, 1) IS NULL)
      AND description IS NOT NULL AND length(description) >= 60
      AND (
        (array_length(spotify_playlist_ids,1) > 0 OR array_length(additional_playlists,1) > 0)
        OR (
          denomination IS NOT NULL AND length(denomination) > 0
          AND NOT (denomination = ANY(${OFF_BRAND}))
          AND display_score IS NOT NULL AND display_score >= 65
        )
      )
    ORDER BY display_score DESC NULLS LAST
    LIMIT ${limit}`;

  console.log(`${dryRun ? "DRY RUN" : "LIVE"} | model ${MODEL} | concurrency ${concurrency}`);
  console.log(`Eligible churches missing music_style: ${rows.length}\n`);

  let tagged = 0, empty = 0, failed = 0;
  await mapWithConcurrency(rows, concurrency, async (c) => {
    const styles = await classify(c);
    if (styles === null) { failed++; return; }
    if (styles.length === 0) { empty++; return; }
    if (dryRun) {
      console.log(`  ${c.slug}  [${c.denomination || "?"}]  → ${styles.join(", ")}`);
    } else {
      await sql`UPDATE churches SET music_style = ${styles}, updated_at = now() WHERE slug = ${c.slug}`;
    }
    tagged++;
    if (tagged % 200 === 0) console.log(`  …${tagged} tagged`);
  });

  console.log(`\nDone. tagged ${tagged} | no-style ${empty} | failed ${failed}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
