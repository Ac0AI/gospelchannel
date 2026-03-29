#!/usr/bin/env node

/**
 * Spotify Church Discovery Script v2 — expanded search
 *
 * Searches Spotify broadly for church/worship playlists using:
 *   - Generic worship queries in many languages
 *   - City-specific searches
 *   - Denomination-specific terms
 *   - Pagination (offset) to get more results per query
 *
 * Usage:
 *   source .env.local && node scripts/discover-spotify-churches-v2.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ── Config ── */

const GENERIC_QUERIES = [
  // English
  "church worship playlist",
  "sunday service worship",
  "church praise and worship",
  "worship ministry",
  "church live worship",
  "gospel church",
  "evangelical church worship",
  "pentecostal worship",
  "baptist church music",
  "methodist church worship",
  "lutheran church music",
  "reformed church worship",
  "charismatic worship",
  "hillsong church",
  "church of god worship",
  "assembly of god worship",
  "chapel worship music",
  "cathedral worship",
  "parish worship",
  "church youth worship",
  "church contemporary worship",
  // Swedish
  "kyrka lovsång",
  "församling worship",
  "pingstkyrkan lovsång",
  "frikyrklig lovsång",
  "missionskyrkan",
  "lovsång gudstjänst",
  "svensk lovsång",
  // Spanish
  "iglesia adoracion",
  "alabanza iglesia",
  "iglesia evangelica musica",
  "iglesia pentecostal alabanza",
  "iglesia bautista musica",
  "culto iglesia",
  "ministerio de alabanza",
  "iglesia cristiana worship",
  // Portuguese
  "igreja adoração",
  "louvor igreja",
  "igreja evangelica louvor",
  "igreja batista louvor",
  "igreja pentecostal louvor",
  "culto igreja",
  "ministerio de louvor",
  "igreja presbiteriana",
  "igreja assembleia",
  // German
  "Gemeinde Lobpreis",
  "Kirche worship",
  "Freikirche Lobpreis",
  "Gottesdienst Musik",
  "evangelische Gemeinde Lobpreis",
  "Pfingstgemeinde",
  "Lobpreis Anbetung",
  // French
  "église louange",
  "église évangélique louange",
  "église protestante musique",
  "culte église",
  "louange adoration église",
  "église pentecôtiste",
  "église baptiste",
  // Norwegian
  "kirke lovsang",
  "menighet lovsang",
  "frikirke worship",
  "pinsemenighet",
  // Danish
  "kirke lovsang",
  "frikirke worship",
  "menighed lovsang",
  // Finnish
  "seurakunta worship",
  "kirkko musiikki",
  "helluntaiseurakunta",
  // Korean
  "교회 찬양",
  "교회 워십",
  "교회 예배",
  // Tagalog/Filipino
  "church worship philippines",
  "iglesia ni cristo",
  "christian church manila",
  // African
  "church worship nigeria",
  "church worship africa",
  "gospel church lagos",
  "rccg worship",
  "winners chapel worship",
  // Dutch
  "kerk worship",
  "gemeente aanbidding",
  // Italian
  "chiesa adorazione",
  "chiesa evangelica",
  // Indonesian
  "gereja worship",
  "gereja pujian",
  // Japanese
  "教会 ワーシップ",
  // Chinese
  "教會 敬拜",
];

const CITY_QUERIES = [
  // Scandinavia
  "church Stockholm", "church Gothenburg", "church Malmö", "church Uppsala",
  "church Oslo", "church Bergen", "church Trondheim", "church Stavanger",
  "church Copenhagen", "church Aarhus", "church Odense",
  "church Helsinki", "church Tampere", "church Espoo", "church Turku",
  "kyrka Stockholm", "kyrka Göteborg", "kyrka Uppsala", "kyrka Örebro",
  "kirke Oslo", "kirke Bergen", "kirke Trondheim",
  // UK
  "church London", "church Manchester", "church Birmingham", "church Bristol",
  "church Liverpool", "church Leeds", "church Sheffield", "church Edinburgh",
  "church Glasgow", "church Cardiff", "church Belfast", "church Nottingham",
  "church Newcastle", "church Brighton", "church Oxford", "church Cambridge",
  // Germany
  "Kirche Berlin", "Kirche Hamburg", "Kirche München", "Kirche Köln",
  "Kirche Frankfurt", "Kirche Stuttgart", "Kirche Düsseldorf", "Kirche Leipzig",
  "Gemeinde Berlin", "Gemeinde Hamburg", "Gemeinde München",
  "church Berlin", "church Hamburg", "church Munich",
  // France
  "église Paris", "église Lyon", "église Marseille", "église Toulouse",
  "église Bordeaux", "église Lille", "église Nantes", "église Strasbourg",
  "church Paris", "church Lyon", "church Marseille",
  // Switzerland
  "Kirche Zürich", "Kirche Basel", "Kirche Bern", "Kirche Genf",
  "church Zurich", "church Geneva", "church Lausanne", "church Basel",
  "église Genève", "église Lausanne",
  // Spain
  "iglesia Madrid", "iglesia Barcelona", "iglesia Valencia", "iglesia Sevilla",
  "iglesia Málaga", "iglesia Bilbao", "iglesia Zaragoza",
  "church Madrid", "church Barcelona",
  // Portugal
  "igreja Lisboa", "igreja Porto", "igreja Braga",
  // Brazil
  "igreja São Paulo", "igreja Rio de Janeiro", "igreja Belo Horizonte",
  "igreja Curitiba", "igreja Brasília", "igreja Salvador", "igreja Fortaleza",
  "igreja Recife", "igreja Porto Alegre", "igreja Manaus",
  // Philippines
  "church Manila", "church Cebu", "church Davao", "church Quezon City",
  // Nigeria
  "church Lagos", "church Abuja", "church Port Harcourt",
  // USA (large churches often have Spotify)
  "church Atlanta", "church Houston", "church Dallas", "church Nashville",
  "church Los Angeles", "church New York", "church Chicago",
  // Australia
  "church Sydney", "church Melbourne", "church Brisbane",
  // South Africa
  "church Johannesburg", "church Cape Town",
  // Netherlands
  "kerk Amsterdam", "kerk Rotterdam", "church Amsterdam",
  // Italy
  "chiesa Roma", "chiesa Milano",
  // South Korea
  "교회 서울",
  // Japan
  "教会 東京",
  // Indonesia
  "gereja Jakarta",
  // Additional Scandinavian cities
  "church Linköping", "church Västerås", "church Norrköping",
  "church Jönköping", "church Lund", "church Umeå",
  "church Kristiansand", "church Drammen", "church Fredrikstad",
  "church Aalborg", "church Roskilde",
  "church Oulu", "church Jyväskylä", "church Lahti",
];

const CHURCH_KEYWORDS = [
  "church", "chapel", "iglesia", "kyrka", "församling", "igreja",
  "kirche", "gemeinde", "église", "교회", "worship", "ministries",
  "ministry", "cathedral", "temple", "fellowship", "parish",
  "pingstkyrkan", "frikirke", "menighet", "seurakunta",
  "kerk", "chiesa", "gereja", "教会", "教會",
  "baptist", "methodist", "lutheran", "pentecostal", "evangelical",
  "apostolic", "presbyterian", "reformed", "assembleia", "asamblea",
  "rccg", "hillsong", "bethel", "calvary", "grace",
  "maranatha", "tabernacle", "sanctuary", "gospel",
];

const MAX_RESULTS_PER_QUERY = 50;
const OFFSETS = [0]; // single page per query to avoid rate limits

/* ── Spotify Auth ── */

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

/* ── Spotify Search ── */

async function searchPlaylists(token, query, offset = 0, retries = 3) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "playlist");
  url.searchParams.set("limit", String(MAX_RESULTS_PER_QUERY));
  url.searchParams.set("offset", String(offset));

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      return data.playlists?.items ?? [];
    }

    if (res.status === 429) {
      // Spotify sometimes returns absurd retry-after values; cap at 30s
      const retryAfter = Math.min(Number(res.headers.get("retry-after") || 5), 30);
      const wait = (retryAfter + 1) * 1000;
      if (attempt < retries) {
        console.warn(`  ⏳ Rate limited, waiting ${retryAfter + 1}s (attempt ${attempt + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }

    if (attempt < retries) {
      const backoff = (attempt + 1) * 3000;
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    console.warn(`  ⚠ Search failed for "${query}" offset=${offset}: ${res.status}`);
    return [];
  }
  return [];
}

/* ── Filter & Score ── */

function scoreCandidate(ownerName, playlistName) {
  let score = 0;
  const lowerOwner = ownerName.toLowerCase();
  const lowerPlaylist = playlistName.toLowerCase();

  const matchedKeywords = CHURCH_KEYWORDS.filter((kw) => lowerOwner.includes(kw));
  score += matchedKeywords.length * 0.25;

  if (/worship|praise|lovsång|adoraci[oó]n|louvor|lobpreis|찬양|lovsang|ワーシップ|敬拜|pujian/.test(lowerPlaylist)) {
    score += 0.2;
  }

  // Bonus for playlist name also containing church keywords
  const playlistChurchMatch = CHURCH_KEYWORDS.filter((kw) => lowerPlaylist.includes(kw));
  if (playlistChurchMatch.length > 0) {
    score += 0.1;
  }

  // Penalty for generic/personal names
  if (/^[a-z]+ [a-z]+$/i.test(ownerName) && matchedKeywords.length === 0) {
    score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}

function looksLikeChurch(ownerName) {
  const lower = ownerName.toLowerCase();
  return CHURCH_KEYWORDS.some((kw) => lower.includes(kw));
}

/* ── Main ── */

async function main() {
  console.log("🔍 Spotify Church Discovery v2 — Expanded Search\n");

  // Load existing churches to exclude
  const churchesPath = new URL("../src/data/churches.json", import.meta.url);
  const existing = JSON.parse(readFileSync(churchesPath, "utf8"));
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
  console.log(`📚 ${existing.length} existing churches loaded`);

  // Load existing candidates from Supabase to avoid duplicates
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase config");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: existingCandidates } = await supabase
    .from("church_candidates")
    .select("spotify_owner_id");
  const existingOwnerIds = new Set(
    (existingCandidates ?? []).map((c) => c.spotify_owner_id)
  );
  console.log(`📋 ${existingOwnerIds.size} existing candidates in database`);

  // Spotify auth
  const token = await getSpotifyToken();
  console.log("✅ Spotify authenticated\n");

  const allQueries = [...GENERIC_QUERIES, ...CITY_QUERIES];
  console.log(`📝 ${allQueries.length} queries × ${OFFSETS.length} pages = ${allQueries.length * OFFSETS.length} API calls\n`);

  const candidateMap = new Map(); // owner_id → candidate
  let apiCalls = 0;

  for (let qi = 0; qi < allQueries.length; qi++) {
    const query = allQueries[qi];
    const progress = `[${qi + 1}/${allQueries.length}]`;

    for (const offset of OFFSETS) {
      const playlists = await searchPlaylists(token, query, offset);
      apiCalls++;

      for (const playlist of playlists) {
        if (!playlist?.owner) continue;

        const ownerId = playlist.owner.id;
        const ownerName = playlist.owner.display_name || ownerId;

        if (!looksLikeChurch(ownerName)) continue;
        if (existingNames.has(ownerName.toLowerCase())) continue;
        if (existingOwnerIds.has(ownerId)) continue;

        const confidence = scoreCandidate(ownerName, playlist.name);
        if (confidence < 0.2) continue;

        if (candidateMap.has(ownerId)) {
          const existing = candidateMap.get(ownerId);
          if (!existing.spotifyPlaylistIds.includes(playlist.id)) {
            existing.spotifyPlaylistIds.push(playlist.id);
          }
          existing.confidence = Math.max(existing.confidence, confidence);
        } else {
          candidateMap.set(ownerId, {
            name: ownerName,
            spotifyOwnerId: ownerId,
            spotifyPlaylistIds: [playlist.id],
            confidence,
            reason: `Found via search: "${query}"`,
          });
        }
      }

      // Throttle to avoid rate limits
      await new Promise((r) => setTimeout(r, 2000));

      // If no results on this page, skip further offsets for this query
      if (playlists.length < MAX_RESULTS_PER_QUERY) break;
    }

    // Progress update every 20 queries
    if ((qi + 1) % 20 === 0 || qi === allQueries.length - 1) {
      console.log(`${progress} ${candidateMap.size} new candidates found so far (${apiCalls} API calls)`);
    }
  }

  const candidates = [...candidateMap.values()].sort(
    (a, b) => b.confidence - a.confidence
  );

  console.log(`\n🎯 Found ${candidates.length} new church candidates total\n`);

  if (candidates.length === 0) {
    console.log("No new candidates to save.");
    return;
  }

  // Show stats
  const high = candidates.filter((c) => c.confidence >= 0.8).length;
  const medium = candidates.filter((c) => c.confidence >= 0.5 && c.confidence < 0.8).length;
  const low = candidates.filter((c) => c.confidence < 0.5).length;
  console.log(`  High confidence (≥80%): ${high}`);
  console.log(`  Medium (50-79%): ${medium}`);
  console.log(`  Low (<50%): ${low}\n`);

  // Preview top 20
  console.log("Top 20 candidates:");
  for (const c of candidates.slice(0, 20)) {
    console.log(
      `  ${Math.round(c.confidence * 100)}% — ${c.name} (${c.spotifyPlaylistIds.length} playlists)`
    );
  }

  // Save to Supabase in batches
  console.log(`\n💾 Saving ${candidates.length} candidates to Supabase...`);

  const BATCH_SIZE = 100;
  let saved = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const rows = batch.map((c) => ({
      name: c.name,
      spotify_owner_id: c.spotifyOwnerId,
      spotify_playlist_ids: c.spotifyPlaylistIds,
      confidence: c.confidence,
      reason: c.reason,
      source: "spotify-search",
    }));

    const { error } = await supabase.from("church_candidates").insert(rows);
    if (error) {
      console.error(`  ❌ Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
    } else {
      saved += batch.length;
    }
  }

  console.log(`\n✅ Saved ${saved} new candidates to Supabase`);
  console.log("👉 Review them at /admin/candidates");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
