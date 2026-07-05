#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const PAGE_SIZE = 500;

function parseArgs(argv) {
  const options = {
    preview: false,
    limit: 50,
    reasonPrefix: "",
    country: "",
    nameTerms: [],
    requireSpotifyPresence: false,
    preferCampusParents: false,
    preserveSpotifyUrl: true,
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg === "--require-spotify-presence") options.requireSpotifyPresence = true;
    else if (arg === "--prefer-campus-parents") options.preferCampusParents = true;
    else if (arg === "--replace-spotify-url") options.preserveSpotifyUrl = false;
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 50);
    else if (arg.startsWith("--reason-prefix=")) options.reasonPrefix = arg.split("=")[1] || "";
    else if (arg.startsWith("--country=")) options.country = arg.split("=")[1] || "";
    else if (arg.startsWith("--name-terms=")) {
      options.nameTerms = arg
        .split("=")[1]
        .split(",")
        .map((value) => normalize(value))
        .filter(Boolean);
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const LOW_SIGNAL_TOKENS = new Set([
  "the",
  "church",
  "chapel",
  "cathedral",
  "parish",
  "saint",
  "st",
  "methodist",
  "baptist",
  "catholic",
  "roman",
  "apostolic",
  "christian",
  "community",
]);

const REJECT_PLAYLIST_PATTERNS = [
  /\bschool\b/,
  /\bmarches\b/,
  /\bbrass\b/,
  /\bpodcast\b/,
  /\bsermon\b/,
  /\baudiobook\b/,
];

function getInformativeTokens(value = "") {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 4 && !LOW_SIGNAL_TOKENS.has(token));
}

function isGenericChurchName(church) {
  const informative = getInformativeTokens(church.name);
  return informative.length <= 1;
}

function hasLocationMatch(text, church) {
  const locationTokens = getInformativeTokens(church.location || "");
  return locationTokens.some((token) => text.includes(token));
}

function looksPersonLike(value = "") {
  const cleaned = String(value || "").trim();
  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(cleaned);
}

function getSpotifyPathSegments(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    if (!/(\.|^)spotify\.com$/i.test(parsed.hostname)) return [];

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0]?.startsWith("intl-")) {
      return segments.slice(1);
    }
    return segments;
  } catch {
    return [];
  }
}

function extractSpotifySearchQuery(url) {
  const segments = getSpotifyPathSegments(url);
  if (segments[0] !== "search") return "";
  return decodeURIComponent(segments.slice(1).join(" ")).replace(/\s+/g, " ").trim();
}

function isSpotifySearchUrl(url) {
  return getSpotifyPathSegments(url)[0] === "search";
}

function hasExplicitPlaylistData(church) {
  return (church.spotify_playlist_ids || []).length > 0 || (church.additional_playlists || []).length > 0;
}

function hasSpotifyPresence(church) {
  return Boolean(church.spotify_url)
    || (church.spotify_artist_ids || []).length > 0
    || (church.spotify_playlists || []).length > 0;
}

function scorePlaylist(playlist, church) {
  const playlistName = normalize(playlist.name || "");
  const owner = normalize(playlist.owner?.display_name || "");
  const churchName = normalize(church.name || "");
  const location = normalize(church.location || "");
  const country = normalize(church.country || "");

  let score = 0;

  if (playlistName.includes(churchName)) score += 55;
  if (owner.includes(churchName)) score += 45;

  for (const token of churchName.split(" ").filter((part) => part.length >= 4)) {
    if (playlistName.includes(token)) score += 8;
    if (owner.includes(token)) score += 6;
  }

  if (location && playlistName.includes(location)) score += 10;
  if (location && owner.includes(location)) score += 8;
  if (country && playlistName.includes(country)) score += 4;

  if (/worship|praise|songs|setlist|playlist|music/.test(playlistName)) score += 8;
  if (/official|church|ministry|worship/.test(owner)) score += 6;
  if ((playlist.tracks?.total || 0) >= 8) score += 4;

  if (hasLocationMatch(playlistName, church)) score += 14;
  if (hasLocationMatch(owner, church)) score += 10;

  if (/podcast|sermon|message|teaching|audiobook/.test(playlistName)) score -= 30;
  if (/top hits|best of|reggaeton|party|club|rap|hip hop/.test(playlistName)) score -= 50;
  if (REJECT_PLAYLIST_PATTERNS.some((pattern) => pattern.test(playlistName))) score -= 60;
  if (REJECT_PLAYLIST_PATTERNS.some((pattern) => pattern.test(owner))) score -= 40;
  if (looksPersonLike(playlist.owner?.display_name || "") && !owner.includes("church") && !owner.includes("worship")) score -= 20;

  return score;
}

function buildQueries(church) {
  const candidateQueries = [
    extractSpotifySearchQuery(church.spotify_url),
    `${church.name} worship`,
    `${church.name} playlist`,
    church.location ? `${church.name} ${church.location}` : church.name,
  ].filter(Boolean);

  const uniqueQueries = [];
  const seen = new Set();
  for (const query of candidateQueries) {
    const key = normalize(query);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueQueries.push(query);
  }

  return uniqueQueries;
}

async function getSpotifyToken(clientId, clientSecret) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Spotify auth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function searchSpotify(token, query, limit = 8) {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after") || 3);
    await sleep(retryAfter * 1000);
    return searchSpotify(token, query, limit);
  }

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return payload.playlists?.items || [];
}

async function validateWithAnthropic(apiKey, church, playlists) {
  if (!apiKey || playlists.length === 0) return null;

  const list = playlists
    .slice(0, 6)
    .map((playlist, index) => {
      const owner = playlist.owner?.display_name || "";
      const tracks = playlist.tracks?.total || 0;
      return `${index + 1}. "${playlist.name}" by ${owner} (${tracks} tracks) — ${playlist.external_urls?.spotify || ""}`;
    })
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: "You match Spotify playlists to churches. Pick the single playlist most likely to belong to the church itself. Reject generic worship playlists, playlists for another church, or weak matches. Respond JSON only: {\"pick\": 1} or {\"pick\": null}.",
      messages: [
        {
          role: "user",
          content: `Church: "${church.name}" (${church.location || church.country || "unknown location"})\n\nCandidates:\n${list}`,
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const payload = await response.json();
  const text = payload.content?.[0]?.text || "{}";
  const match = text.match(/\{[^}]+\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.pick >= 1 && parsed.pick <= playlists.length) {
      return playlists[parsed.pick - 1];
    }
  } catch {
    return null;
  }

  return null;
}

async function loadCampusParentSlugs(supabase) {
  const { data: campuses, error: campusesError } = await supabase
    .from("church_campuses")
    .select("network_id")
    .eq("status", "published");

  if (campusesError) {
    throw new Error(`Failed to load campuses: ${campusesError.message}`);
  }

  const networkIds = [...new Set((campuses || []).map((campus) => campus.network_id).filter(Boolean))];
  if (networkIds.length === 0) {
    return new Set();
  }

  const { data: networks, error: networksError } = await supabase
    .from("church_networks")
    .select("id,parent_church_slug")
    .in("id", networkIds);

  if (networksError) {
    throw new Error(`Failed to load networks: ${networksError.message}`);
  }

  return new Set((networks || []).map((network) => network.parent_church_slug).filter(Boolean));
}

function resolveUpdatedSpotifyUrl(currentSpotifyUrl, playlist, options) {
  const pickedUrl = playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`;
  if (!options.preserveSpotifyUrl) return pickedUrl;

  const current = String(currentSpotifyUrl || "").trim();
  if (!current) return pickedUrl;
  if (isSpotifySearchUrl(current)) return pickedUrl;
  if (getSpotifyPathSegments(current)[0] === "playlist") return pickedUrl;
  return current;
}

async function loadChurches(supabase, options) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("churches")
      .select("slug,name,country,location,spotify_playlist_ids,additional_playlists,spotify_playlists,spotify_artist_ids,spotify_url,reason,status")
      .eq("status", "approved")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load churches: ${error.message}`);
    }

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const campusParentSlugs = options.preferCampusParents ? await loadCampusParentSlugs(supabase) : new Set();

  return rows
    .filter((row) => !hasExplicitPlaylistData(row))
    .filter((row) => !options.requireSpotifyPresence || hasSpotifyPresence(row))
    .filter((row) => !options.reasonPrefix || String(row.reason || "").startsWith(options.reasonPrefix))
    .filter((row) => !options.country || row.country === options.country)
    .filter((row) => options.nameTerms.length === 0 || options.nameTerms.some((term) => normalize(row.name).includes(term)))
    .sort((left, right) => {
      if (!options.preferCampusParents) return String(left.name || "").localeCompare(String(right.name || ""));

      const leftScore = campusParentSlugs.has(left.slug) ? 1 : 0;
      const rightScore = campusParentSlugs.has(right.slug) ? 1 : 0;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return String(left.name || "").localeCompare(String(right.name || ""));
    })
    .slice(0, options.limit);
}

async function updateChurches(supabase, updates) {
  for (const update of updates) {
    const { error } = await supabase
      .from("churches")
      .update({
        spotify_playlist_ids: [update.playlistId],
        spotify_url: update.spotifyUrl,
      })
      .eq("slug", update.slug);

    if (error) {
      throw new Error(`Failed to update ${update.slug}: ${error.message}`);
    }
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const churches = await loadChurches(supabase, options);
  const token = await getSpotifyToken(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET);
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";

  console.log(`Playlist matching candidates: ${churches.length}`);

  const matched = [];

  for (let index = 0; index < churches.length; index += 1) {
    const church = churches[index];
    const queries = buildQueries(church);
    const allResults = [];

    for (const query of queries) {
      const results = await searchSpotify(token, query, 8);
      allResults.push(...results);
      await sleep(150);
    }

    const unique = [];
    const seen = new Set();
    for (const playlist of allResults) {
      if (!playlist?.id || seen.has(playlist.id)) continue;
      seen.add(playlist.id);
      unique.push(playlist);
    }

    const scored = unique
      .map((playlist) => ({ playlist, score: scorePlaylist(playlist, church) }))
      .filter((row) => row.score >= 45)
      .filter((row) => {
        const playlistName = normalize(row.playlist.name || "");
        const owner = normalize(row.playlist.owner?.display_name || "");
        const genericName = isGenericChurchName(church);
        const exactNameMatch = playlistName.includes(normalize(church.name)) || owner.includes(normalize(church.name));
        const locationMatch = hasLocationMatch(playlistName, church) || hasLocationMatch(owner, church);
        if (genericName) {
          return locationMatch;
        }
        return exactNameMatch || locationMatch;
      })
      .sort((left, right) => right.score - left.score);

    let picked = null;
    if (scored.length > 0) {
      const topCandidates = scored.slice(0, 6).map((row) => row.playlist);
      picked = await validateWithAnthropic(anthropicKey, church, topCandidates);
      if (!picked && scored[0].score >= 82) {
        picked = scored[0].playlist;
      }
    }

    if (!picked) {
      console.log(`[${index + 1}/${churches.length}] - ${church.name}: no confident playlist match`);
      continue;
    }

    const nextSpotifyUrl = resolveUpdatedSpotifyUrl(church.spotify_url, picked, options);
    matched.push({
      slug: church.slug,
      name: church.name,
      playlistId: picked.id,
      spotifyUrl: nextSpotifyUrl,
      playlistName: picked.name || "",
      owner: picked.owner?.display_name || "",
      previousSpotifyUrl: church.spotify_url || "",
    });
    console.log(`[${index + 1}/${churches.length}] ✓ ${church.name}: "${picked.name}" by ${picked.owner?.display_name || "unknown"}`);
    await sleep(200);
  }

  console.log(`Matched: ${matched.length}`);
  console.log(JSON.stringify(matched.slice(0, 20), null, 2));

  if (options.preview || matched.length === 0) {
    return;
  }

  await updateChurches(supabase, matched);
  console.log(`Updated ${matched.length} churches with Spotify playlists.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
