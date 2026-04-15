#!/usr/bin/env node

/**
 * LLM audit of recently imported churches.
 *
 * For each church imported via bulk directory imports, ask Haiku whether
 * the entry is actually a real local church congregation, or something else
 * (choir, band, festival, department page, denomination HQ, umbrella org).
 *
 * Read-only: writes findings to /tmp/llm-audit-results.json. Review before
 * deleting anything.
 *
 * Usage:
 *   node scripts/llm-audit-imports.mjs                    # full audit
 *   node scripts/llm-audit-imports.mjs --limit 50         # sample
 *   node scripts/llm-audit-imports.mjs --source fr-       # only fr-* slugs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const LIMIT_ARG = process.argv.indexOf("--limit");
const LIMIT = LIMIT_ARG > -1 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : null;
const SOURCE_ARG = process.argv.indexOf("--source");
const SOURCE_PREFIX = SOURCE_ARG > -1 ? process.argv[SOURCE_ARG + 1] : null;

const SYSTEM = `You are an auditor for a directory of local Christian church congregations.

Your job: given a database entry, decide if it's a REAL LOCAL CHURCH CONGREGATION that people can visit for Sunday worship, or NOT.

NOT a church (flag = true):
- Choir, band, worship collective, music group, record label, artist
- Music festival, conference, retreat center
- Denomination HQ, umbrella organization, mission agency, bible society
- Theological seminary, Bible college
- Department page (e.g. "Worship and Music" ministry page from a cathedral)
- Generic "church info" pages with no actual congregation
- Duplicate listing that's clearly already covered by a parent entry

IS a church (flag = false):
- Any local congregation meeting regularly, regardless of size or denomination
- Ethnic or language-specific congregations (Chinese church in Berlin, etc.)
- Legitimate multi-site campuses
- Small house churches or rural congregations

Respond with strict JSON only:
{"flag": true|false, "category": "choir|band|label|festival|hq|seminary|department|duplicate|church|unknown", "confidence": 0.0-1.0, "reason": "short sentence"}`;

async function callHaiku(user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function parseJsonLoose(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function main() {
  console.log("\nLLM audit of recently imported churches\n");

  // Recent imports: bulk import happened 2026-04-12/13. Pull everything
  // created in the last 30 days to be safe.
  let rows;
  if (SOURCE_PREFIX) {
    rows = await sql`
      SELECT slug, name, country, location, website, description, denomination, discovery_source
      FROM churches
      WHERE slug LIKE ${SOURCE_PREFIX + "%"}
      ORDER BY created_at DESC
    `;
  } else {
    rows = await sql`
      SELECT slug, name, country, location, website, description, denomination, discovery_source
      FROM churches
      WHERE created_at > now() - interval '30 days'
      ORDER BY created_at DESC
    `;
  }
  if (LIMIT) rows = rows.slice(0, LIMIT);

  console.log(`  auditing ${rows.length} churches...`);

  const flagged = [];
  const results = [];
  let done = 0;

  const CONCURRENCY = 8;
  const queue = [...rows];

  async function worker() {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row) break;
      const payload = [
        `Name: ${row.name}`,
        `Country: ${row.country || "—"}`,
        `Location: ${row.location || "—"}`,
        `Denomination: ${row.denomination || "—"}`,
        `Website: ${row.website || "—"}`,
        `Description: ${row.description || "—"}`,
      ].join("\n");

      try {
        const text = await callHaiku(payload);
        const parsed = parseJsonLoose(text);
        if (!parsed) {
          results.push({ slug: row.slug, name: row.name, error: "parse", raw: text.slice(0, 200) });
        } else {
          results.push({ slug: row.slug, name: row.name, ...parsed });
          if (parsed.flag === true) {
            flagged.push({ slug: row.slug, name: row.name, country: row.country, ...parsed });
          }
        }
      } catch (err) {
        results.push({ slug: row.slug, name: row.name, error: String(err).slice(0, 200) });
      }
      done++;
      if (done % 25 === 0) {
        console.log(`    ${done}/${rows.length} audited, ${flagged.length} flagged so far`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Group by category
  const byCategory = {};
  for (const f of flagged) {
    byCategory[f.category] = byCategory[f.category] || [];
    byCategory[f.category].push(f);
  }

  console.log(`\n── Summary ──`);
  console.log(`  total audited: ${results.length}`);
  console.log(`  flagged: ${flagged.length}`);
  for (const [cat, items] of Object.entries(byCategory)) {
    console.log(`    ${cat}: ${items.length}`);
  }

  const outPath = "/tmp/llm-audit-results.json";
  writeFileSync(
    outPath,
    JSON.stringify({ total: results.length, flagged, results }, null, 2),
  );
  console.log(`\n  full results → ${outPath}`);

  // Show top 30 high-confidence flags
  const highConf = flagged
    .filter((f) => typeof f.confidence === "number" && f.confidence >= 0.8)
    .sort((a, b) => b.confidence - a.confidence);
  console.log(`\n── High-confidence flags (top 30 of ${highConf.length}) ──`);
  for (const f of highConf.slice(0, 30)) {
    console.log(`  [${f.category} ${f.confidence.toFixed(2)}] ${f.name} (${f.country})`);
    console.log(`    slug: ${f.slug}`);
    console.log(`    ${f.reason}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
