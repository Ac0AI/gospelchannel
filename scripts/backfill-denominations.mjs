#!/usr/bin/env node

/**
 * Backfill denomination for churches that have none.
 * Uses Haiku to analyze church websites and classify denomination.
 *
 * Usage:
 *   node scripts/backfill-denominations.mjs [--dry-run] [--limit=100]
 */

import { neon } from "@neondatabase/serverless";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(resolve(__dirname, ".."));

const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

const sql = neon(DATABASE_URL);
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1]) || 9999;
const CONCURRENCY = 5;
const FETCH_TIMEOUT = 8_000;

const CANONICAL = [
  "Pentecostal", "Charismatic", "Evangelical", "Baptist",
  "Non-denominational", "Anglican", "Lutheran", "Catholic",
  "Methodist", "Reformed", "Orthodox",
];

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0; +https://gospelchannel.com)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 30_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function classifyWithHaiku(churchName, country, html) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      messages: [{
        role: "user",
        content: `Church: "${churchName}" in ${country || "unknown"}.

Website HTML (excerpt):
${html.slice(0, 15_000)}

What denomination/tradition is this church? Reply with ONLY one of these exact values:
Pentecostal, Charismatic, Evangelical, Baptist, Non-denominational, Anglican, Lutheran, Catholic, Methodist, Reformed, Orthodox

If you cannot determine, reply: unknown

Reply with ONLY the single word/phrase, nothing else.`,
      }],
    }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 5000));
      return null;
    }
    return null;
  }

  const data = await res.json();
  const answer = (data.content?.[0]?.text || "").trim();

  if (CANONICAL.includes(answer)) return answer;
  // Fuzzy match
  const lower = answer.toLowerCase();
  const match = CANONICAL.find(c => lower.includes(c.toLowerCase()));
  return match || null;
}

async function processChurch(church) {
  if (!church.website) return null;

  const html = await fetchPage(church.website);
  if (!html || html.length < 500) return null;

  const denomination = await classifyWithHaiku(church.name, church.country, html);
  if (!denomination) return null;

  console.log(`  ✅ ${church.slug}: ${denomination}`);

  if (!DRY_RUN) {
    await sql.query(`UPDATE churches SET denomination = $1 WHERE slug = $2`, [denomination, church.slug]);
  }

  return denomination;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Denomination Backfill (Haiku)");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("═══════════════════════════════════════════\n");

  const churches = await sql`
    SELECT slug, name, website, country FROM churches
    WHERE status = 'approved'
    AND (denomination IS NULL OR denomination = '')
    AND website IS NOT NULL AND website != ''
    ORDER BY name
    LIMIT ${LIMIT}
  `;

  console.log(`Found ${churches.length} churches without denomination\n`);

  let filled = 0;
  let missed = 0;
  let errors = 0;

  for (let i = 0; i < churches.length; i += CONCURRENCY) {
    const batch = churches.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(processChurch));

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) filled++;
      else if (r.status === "fulfilled") missed++;
      else errors++;
    }

    if ((i + CONCURRENCY) % 100 < CONCURRENCY) {
      console.log(`  ... ${Math.min(i + CONCURRENCY, churches.length)}/${churches.length} | filled: ${filled}`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`  Filled:  ${filled}`);
  console.log(`  Missed:  ${missed}`);
  console.log(`  Errors:  ${errors}`);

  const remaining = await sql`
    SELECT COUNT(*) as cnt FROM churches
    WHERE status = 'approved' AND (denomination IS NULL OR denomination = '')
  `;
  console.log(`  Still missing: ${remaining[0].cnt}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
