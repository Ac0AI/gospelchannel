#!/usr/bin/env node

/**
 * Discover local/regional popular worship churches — Europe focus.
 * Adds them to churches.json, then run `pnpm research` to enrich.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = join(__dirname, "..", "src", "data", "churches.json");

const TAVILY_KEY = process.env.TAVILY_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tavilySearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_KEY}` },
    body: JSON.stringify({ query, search_depth: "advanced", max_results: 5, include_answer: "basic" }),
  });
  return res.json();
}

async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content[0].text;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const queries = [
  "MFL kyrka Sverige worship musik",
  "Malaga Christian Center worship music Spain",
  "populära evangeliska kyrkor Sverige worship musik Livets Ord Pingst",
  "popular evangelical charismatic churches worship Sweden Norway Denmark Finland",
  "popular evangelical churches worship music Spain Portugal Italy France",
  "popular charismatic churches worship Germany Netherlands Switzerland Austria",
  "popular evangelical churches worship UK England Scotland Wales",
  "popular worship churches Poland Romania Hungary Czech Republic Europe",
  "popular worship churches Brazil Colombia Mexico Latin America evangelical",
  "popular megachurches worship Philippines Indonesia South Korea Asia",
  "popular worship churches Canada Australia New Zealand",
  "Hillsong church locations Europe worship local churches",
  "ICF church movement Europe worship music Zurich",
  "C3 church movement global worship music",
  "popular charismatic churches worship music Eastern Europe",
];

async function main() {
  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf-8"));
  const existingSlugs = churches.map((c) => c.slug);

  console.log(`Starting with ${churches.length} existing churches.\n`);

  const allResults = [];
  for (const q of queries) {
    console.log(`  Searching: ${q.slice(0, 55)}…`);
    try {
      allResults.push(await tavilySearch(q));
    } catch (e) {
      console.warn(`  ⚠ ${e.message}`);
    }
    await sleep(500);
  }

  const searchData = allResults
    .map((r) => {
      const answer = r.answer || "";
      const sources = (r.results || [])
        .map((s) => `- ${s.title}: ${(s.content || "").slice(0, 400)}`)
        .join("\n");
      return `${answer}\n${sources}`;
    })
    .join("\n---\n");

  console.log("\nAsking Claude to compile local church list…");

  const raw = await askClaude(`You are building a catalog of worship music churches for a music discovery app. We already have major global names. Now we need LOCAL and REGIONAL popular evangelical/charismatic churches with active worship music.

EXISTING churches (DO NOT include): ${existingSlugs.join(", ")}

Research:
${searchData}

MUST INCLUDE these specific churches:
- MFL (Mosaik Frikyrkoförsamling/Movement) - Swedish church
- Malaga Christian Center - Spain

Generate a JSON array of ~30 NEW churches. Focus on:

EUROPE (priority):
- Sweden: Livets Ord, Pingströrelsen churches, Hillsong Stockholm, MFL, Word of Life, etc.
- Norway/Denmark/Finland: popular worship churches
- Spain/Portugal: evangelical worship communities
- Germany/Switzerland: ICF movement, Hillsong Germany, FCF churches
- UK/Ireland: HTB, Soul Survivor movement, Elim churches
- Netherlands/Belgium: popular worship churches
- Eastern Europe: popular evangelical churches
- France/Italy: growing worship movements

ALSO:
- Latin America: major worship churches (Brazil, Colombia, Mexico)
- Asia: Philippines, Indonesia, South Korea
- Canada/Australia/NZ

For each:
{"name":"Name","website":"https://...","country":"Country","description":"One passionate sentence about their worship.","spotifySearchHint":"search term for Spotify"}

Keep descriptions SHORT (max 20 words). Return ONLY valid JSON array, no markdown.`);

  let discovered;
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    discovered = JSON.parse(cleaned);
  } catch (e) {
    console.error("Parse error:", e.message);
    console.log("Raw:", raw.slice(0, 500));
    process.exit(1);
  }

  // Filter duplicates
  const newOnes = discovered.filter((d) => {
    const slug = slugify(d.name);
    return !existingSlugs.includes(slug);
  });

  const toAdd = newOnes.map((d) => ({
    slug: slugify(d.name),
    name: d.name,
    description: d.description || "",
    spotifyPlaylistIds: [],
    logo: `/churches/${slugify(d.name)}.svg`,
    website: d.website || "",
    spotifyUrl: "",
    country: d.country || "",
    _spotifySearchHint: d.spotifySearchHint || d.name,
  }));

  const updated = [...churches, ...toAdd];
  writeFileSync(CHURCHES_PATH, JSON.stringify(updated, null, 2) + "\n");

  console.log(`\nAdded ${toAdd.length} new churches. Total: ${updated.length}`);
  toAdd.forEach((c) => console.log(`  + ${c.name} (${c.country})`));
  console.log("\nRun 'pnpm research' to enrich the new churches with full data.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
