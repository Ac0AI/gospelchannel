#!/usr/bin/env node

/**
 * Research Agent — Discovers and enriches churches.json via Tavily + Claude API.
 *
 * Usage:
 *   pnpm research                              # Enrich existing churches
 *   pnpm research -- --discover                # Find ~40 new churches + enrich all
 *   pnpm research -- --slug elevation-worship   # Single church
 *   pnpm research -- --dry-run                  # Preview without writing
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHURCHES_PATH = join(__dirname, "..", "src", "data", "churches.json");

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const TAVILY_KEY = process.env.TAVILY_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!TAVILY_KEY || !ANTHROPIC_KEY) {
  console.error(
    "Missing env vars. Make sure TAVILY_API_KEY and ANTHROPIC_API_KEY are set.\n" +
      "Hint: source .env.local before running, or export them in your shell."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DISCOVER = args.includes("--discover");
const slugFlag = args.find((_, i, a) => a[i - 1] === "--slug");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function tavilySearch(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TAVILY_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: 5,
      include_answer: "basic",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function tavilyExtract(urls) {
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TAVILY_KEY}`,
    },
    body: JSON.stringify({ urls, format: "markdown" }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`  ⚠ Tavily extract failed (${res.status}): ${text}`);
    return null;
  }
  return res.json();
}

async function askClaude(prompt, maxTokens = 1024) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

function parseJSON(raw) {
  const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

// Valid fields for enrichment (keeps output clean)
const VALID_ENRICH_FIELDS = new Set([
  "denomination", "founded", "location", "musicStyle", "notableArtists",
  "youtubeChannelId", "spotifyArtistIds", "additionalPlaylists",
]);

// ---------------------------------------------------------------------------
// Discover new churches
// ---------------------------------------------------------------------------

async function discoverChurches(existingSlugs) {
  console.log("\n🌍 Discovering new worship churches & ministries…\n");

  const searchQueries = [
    "top worship music churches ministries worldwide list",
    "best contemporary worship bands church music groups",
    "gospel worship artists churches Africa Asia Latin America",
    "popular worship movements churches Europe Scandinavia UK",
    "independent worship collectives artists Spotify",
    "Korean worship music churches popular",
    "Latin American worship music churches hillsong spanish",
    "African gospel worship ministries Nigeria Ghana South Africa",
    "worship music movements 2024 2025 new churches",
  ];

  // Run all searches
  const allResults = [];
  for (const query of searchQueries) {
    console.log(`  → Searching: ${query.slice(0, 60)}…`);
    try {
      const result = await tavilySearch(query);
      allResults.push(result);
    } catch (err) {
      console.warn(`  ⚠ Search failed: ${err.message}`);
    }
    await sleep(500);
  }

  // Compile all search data for Claude
  const searchData = allResults
    .map((r) => {
      const answer = r.answer || "";
      const sources = (r.results || [])
        .map((s) => `- ${s.title}: ${s.content?.slice(0, 400)}`)
        .join("\n");
      return `${answer}\n${sources}`;
    })
    .join("\n\n---\n\n");

  const existingNames = existingSlugs.join(", ");

  console.log("\n  → Asking Claude to compile church list…");
  const raw = await askClaude(
    `You are building a catalog of worship music churches and ministries for a music discovery app.

EXISTING churches already in our database (DO NOT include these): ${existingNames}

Based on this research about worship churches worldwide:

${searchData}

Generate a JSON array of ~45 NEW worship churches/ministries/worship bands to add. Include a diverse global mix:
- Major well-known worship movements (Hillsong Young & Free, Jesus Culture, etc.)
- Gospel/worship artists who lead church worship (Kirk Franklin, Todd Dulaney, etc.)
- International: Korean, Latin American, African, European, Scandinavian worship
- Newer/indie worship movements and collectives
- Both mega-church worship teams and independent worship artists/bands

For each, return CONCISE data:
{
  "name": "Name",
  "website": "https://...",
  "country": "Country",
  "description": "One short sentence about their worship style.",
  "spotifySearchHint": "search term for Spotify"
}

Keep descriptions SHORT (max 20 words each) to fit in the response.
Return ONLY a valid JSON array. No markdown fences or explanation.`,
    8192
  );

  let discovered;
  try {
    discovered = parseJSON(raw);
  } catch (e) {
    console.error("  ✗ Failed to parse discovery response:", e.message);
    console.error("  Raw:", raw.slice(0, 300));
    return [];
  }

  // Filter out duplicates
  const newChurches = discovered.filter((d) => {
    const slug = slugify(d.name);
    return !existingSlugs.includes(slug);
  });

  console.log(`  ✓ Discovered ${newChurches.length} new churches`);

  // Convert to ChurchConfig format
  return newChurches.map((d) => ({
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
}

// ---------------------------------------------------------------------------
// Research one church
// ---------------------------------------------------------------------------

async function researchChurch(church) {
  console.log(`\n🔍 Researching: ${church.name}`);

  // 1. Tavily Search — general info
  console.log("  → Search: general info…");
  const searchGeneral = await tavilySearch(
    `"${church.name}" church denomination founded location history worship`
  );

  // 2. Tavily Search — music profile + Spotify
  console.log("  → Search: music & Spotify…");
  const searchMusic = await tavilySearch(
    `"${church.name}" worship artists spotify playlist youtube channel`
  );

  // 3. Tavily Extract — church website (skip if no website)
  let websiteContent = null;
  if (church.website) {
    console.log(`  → Extract: ${church.website}…`);
    const aboutUrls = [
      `${church.website}/about`,
      `${church.website}/om`,
      church.website,
    ];
    websiteContent = await tavilyExtract(aboutUrls);
  }

  // 4. Build Claude prompt
  const snippets = [
    `## General search\n${searchGeneral.answer || ""}\n${(searchGeneral.results || []).map((r) => `- ${r.title}: ${r.content?.slice(0, 300)}`).join("\n")}`,
    `## Music search\n${searchMusic.answer || ""}\n${(searchMusic.results || []).map((r) => `- ${r.title}: ${r.content?.slice(0, 300)}`).join("\n")}`,
  ];

  if (websiteContent?.results?.length) {
    const extracted = websiteContent.results
      .map((r) => r.raw_content?.slice(0, 1500) || "")
      .join("\n---\n");
    snippets.push(`## Website content\n${extracted}`);
  }

  const claudePrompt = `You are a research assistant enriching data about a worship music church/ministry.

Current data:
- Name: ${church.name}
- Country: ${church.country}
- Website: ${church.website}

Research:
${snippets.join("\n\n")}

Return a JSON object with ONLY these fields. Omit any field you're not confident about.
Every value must match the exact format shown:

{
  "denomination": "string — e.g. Pentecostal, Non-denominational, Baptist",
  "founded": 1983,
  "location": "City, State/Region, Country",
  "musicStyle": ["contemporary worship", "gospel"],
  "notableArtists": ["Artist Name", "Artist Name"],
  "youtubeChannelId": "UCxxxxxxxxx",
  "spotifyArtistIds": ["spotify artist ID strings only, e.g. 1Cs0zKBU1kZO45TcY"],
  "additionalPlaylists": ["spotify playlist ID strings only, e.g. 37i9dQZF1DWY7IeIP1cdjF"]
}

STRICT RULES:
- "founded" must be a number, not a string.
- "youtubeChannelId" must start with "UC" and be the real channel ID, not a username or handle.
- "spotifyArtistIds" and "additionalPlaylists" must contain Spotify IDs only (alphanumeric strings ~22 chars). Do NOT put playlist/artist names here. If you only know names but not IDs, omit the field.
- Include both official and popular fan-curated/editorial playlists — fan playlists are great.
- Do NOT add fields not listed above.
- Return ONLY valid JSON, no explanation or markdown.`;

  console.log("  → Claude structuring data…");
  const raw = await askClaude(claudePrompt);

  let enriched;
  try {
    enriched = parseJSON(raw);
  } catch (e) {
    console.warn(`  ⚠ Failed to parse Claude response: ${e.message}`);
    console.warn(`  Raw: ${raw.slice(0, 200)}`);
    return null;
  }

  // Strip invalid fields and empty values
  const cleaned = {};
  for (const [key, val] of Object.entries(enriched)) {
    if (!VALID_ENRICH_FIELDS.has(key)) continue;
    if (val === null || val === undefined || val === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;
    cleaned[key] = val;
  }

  // Validate specific fields
  if (cleaned.youtubeChannelId && !cleaned.youtubeChannelId.startsWith("UC")) {
    delete cleaned.youtubeChannelId;
  }
  if (cleaned.founded && typeof cleaned.founded !== "number") {
    delete cleaned.founded;
  }
  // Filter out non-ID strings from playlist/artist arrays
  const isSpotifyId = (s) => typeof s === "string" && /^[a-zA-Z0-9]{15,}$/.test(s);
  if (cleaned.additionalPlaylists) {
    cleaned.additionalPlaylists = cleaned.additionalPlaylists.filter(isSpotifyId);
    if (cleaned.additionalPlaylists.length === 0) delete cleaned.additionalPlaylists;
  }
  if (cleaned.spotifyArtistIds) {
    cleaned.spotifyArtistIds = cleaned.spotifyArtistIds.filter(isSpotifyId);
    if (cleaned.spotifyArtistIds.length === 0) delete cleaned.spotifyArtistIds;
  }

  cleaned.lastResearched = new Date().toISOString().split("T")[0];

  console.log("  ✓ Fields:", Object.keys(cleaned).join(", "));
  return cleaned;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const raw = await readFile(CHURCHES_PATH, "utf-8");
  let churches = JSON.parse(raw);
  const existingSlugs = churches.map((c) => c.slug);

  // Discover new churches if --discover flag
  if (DISCOVER) {
    const newChurches = await discoverChurches(existingSlugs);
    if (newChurches.length > 0) {
      churches = [...churches, ...newChurches];
      console.log(`\n📋 Total churches: ${churches.length}`);
    }
  }

  // Select targets
  const targets = slugFlag
    ? churches.filter((c) => c.slug === slugFlag)
    : churches;

  if (targets.length === 0) {
    console.error(`No church found with slug: ${slugFlag}`);
    process.exit(1);
  }

  // Skip already-researched churches (unless --slug targets one specifically)
  const toResearch = slugFlag
    ? targets
    : targets.filter((c) => !c.lastResearched);

  console.log(
    `\nResearch agent — ${toResearch.length} to research, ${targets.length - toResearch.length} already done${DRY_RUN ? " (DRY RUN)" : ""}`
  );

  const results = new Map();

  for (let i = 0; i < toResearch.length; i++) {
    const church = toResearch[i];
    try {
      const enriched = await researchChurch(church);
      if (enriched) {
        results.set(church.slug, enriched);
      }
    } catch (err) {
      console.error(`  ✗ Error researching ${church.name}:`, err.message);
    }

    // Rate-limit
    if (i < toResearch.length - 1) {
      await sleep(1000);
    }
  }

  // Merge results
  const updated = churches.map((church) => {
    const enriched = results.get(church.slug);
    if (!enriched) return church;
    // Remove internal hints
    const base = { ...church };
    delete base._spotifySearchHint;
    return { ...base, ...enriched };
  });

  if (DRY_RUN) {
    console.log("\n--- DRY RUN OUTPUT ---");
    console.log(JSON.stringify(updated, null, 2));
  } else {
    await writeFile(CHURCHES_PATH, JSON.stringify(updated, null, 2) + "\n");
    console.log(`\n✓ Written ${updated.length} churches to ${CHURCHES_PATH}`);
  }

  console.log(`Done. Researched ${results.size}/${toResearch.length} churches.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
