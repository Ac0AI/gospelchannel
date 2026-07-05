#!/usr/bin/env node

/**
 * Spotify Church Discovery Script
 *
 * Searches Spotify for playlists owned by churches/worship ministries,
 * filters results, and saves candidates to Supabase.
 *
 * Usage:
 *   source .env.local && node scripts/discover-spotify-churches.mjs
 *
 * Required env vars:
 *   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

loadLocalEnv(join(dirname(fileURLToPath(import.meta.url)), ".."));

/* ── Name Sanitization ── */

/**
 * Clean up a church name from Spotify/web scraping.
 * Decodes HTML entities, strips nav prefixes, deduplicates repeated names.
 */
function sanitizeChurchName(name) {
  let clean = name;

  // Decode common HTML entities
  clean = clean
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&middot;/g, "\u00B7")
    .replace(/&raquo;/g, "\u00BB")
    .replace(/&laquo;/g, "\u00AB")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&[a-z]+;/gi, (entity) => {
      const map = { "&eacute;": "\u00E9", "&aacute;": "\u00E1", "&iacute;": "\u00ED",
        "&oacute;": "\u00F3", "&uacute;": "\u00FA", "&ntilde;": "\u00F1",
        "&auml;": "\u00E4", "&ouml;": "\u00F6", "&uuml;": "\u00FC",
        "&aring;": "\u00E5", "&egrave;": "\u00E8", "&agrave;": "\u00E0" };
      return map[entity.toLowerCase()] || entity;
    });

  // Strip navigation prefixes (Home », Home -, Home ›, etc.)
  clean = clean.replace(/^Home\s*[\u00BB\u203A\u2013\u2014>|:»›–-]\s*/i, "");
  clean = clean.replace(/^[-|]\s+/, "");

  // Deduplicate repeated names ("Oasis Church · Oasis Church" → "Oasis Church")
  if (/\s[·\u00B7|]\s/.test(clean)) {
    const parts = clean.split(/\s[·\u00B7|]\s/);
    if (parts.length === 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
      clean = parts[0].trim();
    }
  }

  return clean.trim();
}

/**
 * Convert a church name to a URL-safe slug.
 */
function slugify(name) {
  return sanitizeChurchName(name).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

/**
 * Normalize a name for fuzzy duplicate comparison.
 * Strips common words, lowercases, removes punctuation.
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(the|church|of|in|de|la|el|les|des|und|och|i)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if a name is too generic to be useful.
 */
function isGenericName(name) {
  const lower = name.toLowerCase().trim();
  return ["home", "forside", "start", "welcome", "church", "worship", "playlist"].includes(lower);
}

/* ── Config ── */

const SEARCH_QUERIES = [
  // English
  "church worship",
  "sunday service worship",
  "church praise",
  "worship ministry playlist",
  // Spanish
  "iglesia adoracion",
  "alabanza iglesia",
  // Swedish
  "kyrka lovsång",
  "församling worship",
  // Portuguese
  "igreja adoração",
  "louvor igreja",
  // German
  "Gemeinde Lobpreis",
  "Kirche worship",
  // French
  "église louange",
  // Korean
  "교회 찬양",
];

const CHURCH_KEYWORDS = [
  "church",
  "chapel",
  "iglesia",
  "kyrka",
  "församling",
  "igreja",
  "kirche",
  "gemeinde",
  "église",
  "교회",
  "worship",
  "ministries",
  "ministry",
  "cathedral",
  "temple",
  "fellowship",
];

const MAX_RESULTS_PER_QUERY = 50;

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

async function searchPlaylists(token, query, retries = 3) {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "playlist");
  url.searchParams.set("limit", String(MAX_RESULTS_PER_QUERY));

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      return data.playlists?.items ?? [];
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") || 5);
      const wait = (retryAfter + 1) * 1000;
      if (attempt < retries) {
        console.warn(`  ⏳ Rate limited, waiting ${retryAfter + 1}s (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }

    console.warn(`  Search failed for "${query}": ${res.status}`);
    return [];
  }
  return [];
}

/* ── Filter & Score ── */

function looksLikeChurch(ownerName) {
  const lower = ownerName.toLowerCase();
  return CHURCH_KEYWORDS.some((kw) => lower.includes(kw));
}

function scoreCandidate(ownerName, playlistName) {
  let score = 0;
  const lowerOwner = ownerName.toLowerCase();
  const lowerPlaylist = playlistName.toLowerCase();

  // Owner name contains church keywords
  const matchedKeywords = CHURCH_KEYWORDS.filter((kw) => lowerOwner.includes(kw));
  score += matchedKeywords.length * 0.25;

  // Playlist name contains worship-related terms
  if (/worship|praise|lovsång|adoraci[oó]n|louvor|lobpreis|찬양/.test(lowerPlaylist)) {
    score += 0.2;
  }

  // Penalty for generic/personal names
  if (/^[a-z]+ [a-z]+$/i.test(ownerName) && matchedKeywords.length === 0) {
    score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}

/* ── Main ── */

async function main() {
  console.log("🔍 Spotify Church Discovery Script\n");

  // Load existing churches to exclude
  const churchesPath = new URL("../src/data/churches.json", import.meta.url);
  const existing = JSON.parse(readFileSync(churchesPath, "utf8"));
  const existingSlugs = new Set(existing.map((c) => c.slug));
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
  const existingNormalized = new Set(existing.map((c) => normalizeName(c.name)));
  console.log(`📚 ${existingSlugs.size} existing churches loaded\n`);

  // Spotify auth
  const token = await getSpotifyToken();
  console.log("✅ Spotify authenticated\n");

  // Search and collect candidates
  const candidateMap = new Map(); // owner_id → candidate

  for (const query of SEARCH_QUERIES) {
    console.log(`🔎 Searching: "${query}"`);
    const playlists = await searchPlaylists(token, query);

    for (const playlist of playlists) {
      if (!playlist?.owner) continue;

      const ownerId = playlist.owner.id;
      const rawName = playlist.owner.display_name || ownerId;
      const ownerName = sanitizeChurchName(rawName);

      if (isGenericName(ownerName)) continue;
      if (!looksLikeChurch(ownerName)) continue;
      if (existingNames.has(ownerName.toLowerCase())) continue;
      if (existingNormalized.has(normalizeName(ownerName))) continue;

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

    // Rate limit — Spotify allows ~30 req/s but be conservative
    await new Promise((r) => setTimeout(r, 1000));
  }

  const candidates = [...candidateMap.values()].sort(
    (a, b) => b.confidence - a.confidence
  );

  console.log(`\n🎯 Found ${candidates.length} new church candidates\n`);

  if (candidates.length === 0) {
    console.log("No new candidates to save.");
    return;
  }

  // Preview top candidates
  for (const c of candidates.slice(0, 15)) {
    console.log(
      `  ${Math.round(c.confidence * 100)}% — ${c.name} (${c.spotifyPlaylistIds.length} playlists)`
    );
  }

  // Save to Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log("\n⚠️  Supabase not configured — skipping database save.");
    console.log("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to enable.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check for existing entries to avoid duplicates
  const { data: existingChurches } = await supabase
    .from("churches")
    .select("spotify_owner_id");
  const existingOwnerIds = new Set(
    (existingChurches ?? []).map((c) => c.spotify_owner_id).filter(Boolean)
  );

  const newCandidates = candidates.filter(
    (c) => !existingOwnerIds.has(c.spotifyOwnerId)
  );

  if (newCandidates.length === 0) {
    console.log("\nAll candidates already exist in Supabase.");
    return;
  }

  const rows = newCandidates.map((c) => {
    const name = sanitizeChurchName(c.name);
    return {
      slug: slugify(name),
      name,
      description: "",
      country: "",
      spotify_owner_id: c.spotifyOwnerId,
      spotify_playlist_ids: c.spotifyPlaylistIds,
      confidence: c.confidence,
      reason: c.reason,
      discovery_source: "spotify-search",
      source_kind: "discovered",
      status: "pending",
    };
  });

  const { error } = await supabase.from("churches").upsert(rows, { onConflict: "slug", ignoreDuplicates: true });

  if (error) {
    console.error("\n❌ Failed to save candidates:", error.message);
    return;
  }

  console.log(`\n✅ Saved ${newCandidates.length} new candidates to Supabase`);
  console.log("👉 Review them at /admin/candidates");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
