#!/usr/bin/env node

/**
 * Discover 50 new churches with Spotify playlists and enrich with Claude.
 *
 * Pipeline:
 *   1. Search Spotify for church worship playlists
 *   2. De-duplicate against existing churches in Neon
 *   3. Enrich each candidate with Claude Haiku (website crawl + structuring)
 *   4. Insert as approved churches into the churches table
 *
 * Usage:
 *   node scripts/discover-50-spotify-churches.mjs              # run full pipeline
 *   node scripts/discover-50-spotify-churches.mjs --dry-run    # preview only
 *   node scripts/discover-50-spotify-churches.mjs --limit=20   # fewer churches
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { normalizeName, toSiteRoot } from "./lib/church-intake-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
loadLocalEnv(ROOT_DIR);

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const TARGET = (() => {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  return arg ? Number(arg.split("=")[1]) : 50;
})();

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET");
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Spotify Auth ────────────────────────────────────────────────────────────

async function getSpotifyToken() {
  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  return (await res.json()).access_token;
}

// ─── Spotify Search ──────────────────────────────────────────────────────────

async function searchPlaylists(token, query, offset = 0) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "playlist");
  url.searchParams.set("limit", "50");
  url.searchParams.set("offset", String(offset));

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return (await res.json()).playlists?.items ?? [];
    if (res.status === 429) {
      const wait = Math.min(Number(res.headers.get("retry-after") || 5), 30);
      console.warn(`  Rate limited, waiting ${wait}s...`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    await sleep((attempt + 1) * 3000);
  }
  return [];
}

async function getPlaylistDetails(token, playlistId) {
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description,tracks.total,external_urls,images,owner`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

// ─── Church keyword matching ─────────────────────────────────────────────────

const CHURCH_KEYWORDS = [
  "church", "chapel", "cathedral", "parish", "fellowship", "assembly",
  "ministries", "ministry", "worship", "tabernacle", "sanctuary", "gospel",
  "kyrka", "församling", "pingstkyrkan", "frikyrka",
  "kirche", "gemeinde", "freikirche",
  "église", "eglise",
  "iglesia", "parroquia",
  "igreja",
  "kerk", "gemeente",
  "chiesa",
  "gereja",
  "seurakunta", "kirkko",
  "kirke", "menighet", "frikirke",
  "교회",
  "baptist", "methodist", "lutheran", "pentecostal", "evangelical",
  "apostolic", "presbyterian", "reformed", "charismatic",
  "hillsong", "bethel", "calvary", "grace", "maranatha", "rccg",
  "vineyard", "c3", "elevation", "planetshakers",
];

function looksLikeChurch(name) {
  const lower = name.toLowerCase();
  return CHURCH_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Claude Enrichment ───────────────────────────────────────────────────────

async function askClaude(prompt, maxTokens = 1024) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
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

async function enrichChurch(candidate) {
  const prompt = `You are enriching data about a church/worship ministry for a music discovery platform.

Church name: ${candidate.name}
Spotify playlists: ${candidate.playlistNames.join(", ")}
${candidate.playlistDescriptions.length ? `Playlist descriptions: ${candidate.playlistDescriptions.join(" | ")}` : ""}

Based on what you know about this church, return a JSON object. Omit any field you're not confident about:

{
  "description": "2-3 sentence description of the church and its worship music. Max 250 characters.",
  "country": "Country name",
  "location": "City",
  "denomination": "One of: Pentecostal, Charismatic, Evangelical, Baptist, Non-denominational, Anglican, Lutheran, Catholic, Methodist, Reformed, Orthodox, Vineyard, or null",
  "website": "https://official-website.com/",
  "musicStyle": ["contemporary worship", "gospel"],
  "language": "Primary language"
}

STRICT RULES:
- "description" should describe the church's identity and worship music. Not generic.
- "country" must be the full country name (e.g. "United Kingdom", not "UK")
- Only include fields you are genuinely confident about from your training data
- Return ONLY valid JSON, no explanation or markdown fences`;

  try {
    const raw = await askClaude(prompt);
    return parseJSON(raw);
  } catch (e) {
    console.warn(`  Failed to enrich ${candidate.name}: ${e.message}`);
    return null;
  }
}

// ─── Slug generation ─────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&[^;]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ─── Search Queries ──────────────────────────────────────────────────────────

const SEARCH_QUERIES = [
  // English - generic
  "church worship playlist",
  "church praise and worship",
  "worship ministry playlist",
  "church live worship music",
  "gospel church worship",
  "pentecostal worship music",
  "baptist church music",
  "charismatic worship playlist",
  "church contemporary worship",
  "megachurch worship",
  // City-based (high-value cities)
  "church worship Atlanta",
  "church worship Nashville",
  "church worship Houston",
  "church worship Dallas",
  "church worship Los Angeles",
  "church worship Chicago",
  "church worship Toronto",
  "church worship Singapore",
  "church worship Jakarta",
  "church worship Seoul",
  "church worship Manila",
  "church worship Nairobi",
  "church worship Johannesburg",
  "church worship São Paulo",
  "church worship Lagos",
  "church worship Accra",
  "church worship Kampala",
  // Network/denomination specific
  "assembly of god worship playlist",
  "vineyard worship playlist",
  "calvary chapel worship",
  "foursquare church worship",
  "church of god worship music",
  // Non-English
  "kyrka lovsång spotify",
  "igreja louvor playlist",
  "iglesia adoracion playlist",
  "Gemeinde Lobpreis playlist",
  "église louange playlist",
  "gereja worship playlist",
  "교회 찬양 playlist",
  // Worship bands/teams
  "worship team playlist church",
  "worship night church",
  "sunday worship set church",
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Discovering ${TARGET} new churches with Spotify playlists\n`);
  if (DRY_RUN) console.log("  (dry run - no database writes)\n");

  // 1. Load existing churches to exclude
  const existingRows = await sql`
    SELECT slug, name, spotify_owner_id FROM churches WHERE status = 'approved'
  `;
  const existingNames = new Set(existingRows.map((r) => normalizeName(r.name)));
  const existingSlugs = new Set(existingRows.map((r) => r.slug));
  const existingOwnerIds = new Set(
    existingRows.filter((r) => r.spotify_owner_id).map((r) => r.spotify_owner_id)
  );
  console.log(`📚 ${existingRows.length} existing churches loaded\n`);

  // 2. Search Spotify
  const token = await getSpotifyToken();
  console.log("✅ Spotify authenticated\n");

  const candidateMap = new Map(); // owner_id → candidate
  let apiCalls = 0;

  for (let qi = 0; qi < SEARCH_QUERIES.length; qi++) {
    const query = SEARCH_QUERIES[qi];

    const playlists = await searchPlaylists(token, query);
    apiCalls++;

    for (const playlist of playlists) {
      if (!playlist?.owner) continue;

      const ownerId = playlist.owner.id;
      const ownerName = playlist.owner.display_name || ownerId;

      if (!looksLikeChurch(ownerName)) continue;
      if (existingNames.has(normalizeName(ownerName))) continue;
      if (existingOwnerIds.has(ownerId)) continue;

      const slug = slugify(ownerName);
      if (existingSlugs.has(slug)) continue;

      if (candidateMap.has(ownerId)) {
        const existing = candidateMap.get(ownerId);
        if (!existing.playlistIds.includes(playlist.id)) {
          existing.playlistIds.push(playlist.id);
          existing.playlistNames.push(playlist.name);
          if (playlist.description) existing.playlistDescriptions.push(playlist.description);
        }
      } else {
        candidateMap.set(ownerId, {
          name: ownerName,
          spotifyOwnerId: ownerId,
          playlistIds: [playlist.id],
          playlistNames: [playlist.name],
          playlistDescriptions: playlist.description ? [playlist.description] : [],
          firstPlaylistUrl: `https://open.spotify.com/playlist/${playlist.id}`,
        });
      }
    }

    await sleep(1500);

    if ((qi + 1) % 10 === 0) {
      console.log(`  [${qi + 1}/${SEARCH_QUERIES.length}] ${candidateMap.size} candidates found (${apiCalls} API calls)`);
    }
  }

  // Sort by number of playlists (more = more likely a real church)
  const candidates = [...candidateMap.values()]
    .sort((a, b) => b.playlistIds.length - a.playlistIds.length)
    .slice(0, TARGET + 20); // Get extra in case some fail enrichment

  console.log(`\n🎯 ${candidateMap.size} total candidates, taking top ${candidates.length} for enrichment\n`);

  if (candidates.length === 0) {
    console.log("No new candidates found.");
    return;
  }

  // 3. Enrich with Claude
  console.log("🤖 Enriching with Claude Haiku...\n");

  const enriched = [];
  for (let i = 0; i < candidates.length && enriched.length < TARGET; i++) {
    const candidate = candidates[i];
    const slug = slugify(candidate.name);

    console.log(`  [${i + 1}/${candidates.length}] ${candidate.name} (${candidate.playlistIds.length} playlists)`);

    const data = await enrichChurch(candidate);
    if (!data) continue;

    // Skip if no country could be determined
    if (!data.country) {
      console.log(`    ⚠ No country found, skipping`);
      continue;
    }

    // Skip if description is too short or generic
    if (!data.description || data.description.length < 40) {
      console.log(`    ⚠ Weak description, skipping`);
      continue;
    }

    enriched.push({
      slug,
      name: candidate.name,
      description: data.description,
      country: data.country,
      location: data.location || null,
      denomination: data.denomination || null,
      website: data.website ? toSiteRoot(data.website) : null,
      language: data.language || null,
      musicStyle: data.musicStyle || null,
      spotifyUrl: candidate.firstPlaylistUrl,
      spotifyPlaylistIds: candidate.playlistIds,
      spotifyOwnerId: candidate.spotifyOwnerId,
    });

    console.log(`    ✓ ${data.country}${data.location ? ` / ${data.location}` : ""} — ${data.denomination || "?"}`);

    await sleep(300); // Rate limit Claude
  }

  console.log(`\n✅ ${enriched.length} churches enriched successfully\n`);

  // 4. Preview
  console.log("─".repeat(80));
  console.log("PREVIEW:");
  console.log("─".repeat(80));
  for (const c of enriched) {
    console.log(`  ${c.name}`);
    console.log(`    ${c.country}${c.location ? ` / ${c.location}` : ""} — ${c.denomination || "N/A"}`);
    console.log(`    ${c.description.slice(0, 100)}...`);
    console.log(`    Playlists: ${c.spotifyPlaylistIds.length} | Spotify: ${c.spotifyUrl}`);
    console.log();
  }

  if (DRY_RUN) {
    console.log("🔸 Dry run complete. No database writes.");
    return;
  }

  // 5. Insert into database
  console.log(`\n💾 Inserting ${enriched.length} churches into database...\n`);

  let inserted = 0;
  let skipped = 0;

  for (const church of enriched) {
    try {
      await sql`
        INSERT INTO churches (
          slug, name, description, country, location, denomination, website,
          language, music_style, spotify_url, spotify_playlist_ids,
          spotify_owner_id, source_kind, status, confidence, reason,
          discovery_source, discovered_at
        ) VALUES (
          ${church.slug},
          ${church.name},
          ${church.description},
          ${church.country},
          ${church.location},
          ${church.denomination},
          ${church.website},
          ${church.language},
          ${church.musicStyle},
          ${church.spotifyUrl},
          ${church.spotifyPlaylistIds},
          ${church.spotifyOwnerId},
          'discovered',
          'approved',
          ${0.85},
          ${"Auto-discovered via Spotify search + Claude enrichment (2026-04-02)"},
          'spotify-search',
          ${new Date().toISOString()}
        )
        ON CONFLICT (slug) DO NOTHING
      `;
      inserted++;
      console.log(`  ✓ ${church.name}`);
    } catch (err) {
      if (err.message?.includes("idx_churches_spotify_owner_id")) {
        skipped++;
        console.log(`  ⊘ ${church.name} (duplicate spotify owner)`);
      } else {
        console.error(`  ✗ ${church.name}: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Done! Inserted ${inserted}, skipped ${skipped}`);
  console.log("👉 Check them at /admin/candidates or the live site");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
