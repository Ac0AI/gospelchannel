#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CHURCHES_PATH = join(ROOT, "src", "data", "churches.json");
const TMP_DIR = join(ROOT, "tmp", "spreadsheets");
const PLAYLIST_LEVEL_PATH = join(
  TMP_DIR,
  "sweden-church-playlists-playlist-level.json"
);
const CHURCH_LEVEL_PATH = join(
  TMP_DIR,
  "sweden-church-playlists-church-level.json"
);

const SEARCH_QUERIES = [
  "kyrka lovsang",
  "kyrka lovsång",
  "forsamling lovsang",
  "församling lovsång",
  "pingstkyrkan lovsang",
  "filadelfiakyrkan lovsang",
  "frikyrka lovsang",
  "smyrnakyrkan lovsang",
  "equmeniakyrkan lovsang",
  "svensk kyrka worship",
  "swedish church worship",
  "livets ord worship",
  "sos church sweden worship",
  "filadelfia stockholm worship",
  "korskyrkan stockholm worship",
  "gudstjanst lovsang sverige",
  "svensk gospel kyrka"
];

const TAVILY_QUERIES = [
  'site:open.spotify.com/playlist "kyrka" "sverige"',
  'site:open.spotify.com/playlist "församling" "lovsång"',
  'site:open.spotify.com/playlist "pingstkyrkan"',
  'site:open.spotify.com/playlist "filadelfiakyrkan"',
  'site:open.spotify.com/playlist "smyrnakyrkan"',
  'site:open.spotify.com/playlist "equmeniakyrkan"',
  'site:open.spotify.com/playlist "gudstjänst" "sverige"',
  'site:open.spotify.com/playlist "swedish church worship"',
  'site:open.spotify.com/playlist "stockholm church"',
  'site:open.spotify.com/playlist "göteborg kyrka"',
  'site:open.spotify.com/playlist "livets ord"',
  'site:open.spotify.com/playlist "sos church sweden"',
];

const CHURCH_KEYWORDS = [
  "church",
  "kyrka",
  "kyrkan",
  "forsamling",
  "församling",
  "frikyrka",
  "chapel",
  "cathedral",
  "domkyrka",
  "pingst",
  "pingstkyrkan",
  "filadelfia",
  "smyrna",
  "equmenia",
  "missionskyrka",
  "worship",
  "lovsang",
  "lovsång",
  "gospel",
];

const OWNER_CHURCH_KEYWORDS = [
  "church",
  "kyrka",
  "kyrkan",
  "forsamling",
  "församling",
  "frikyrka",
  "cathedral",
  "domkyrka",
  "pingst",
  "pingstkyrkan",
  "filadelfia",
  "smyrna",
  "equmenia",
  "missionskyrka",
  "svenska kyrkan",
];

const SWEDEN_KEYWORDS = [
  "sweden",
  "sverige",
  "svensk",
  "stockholm",
  "goteborg",
  "göteborg",
  "malmo",
  "malmö",
  "uppsala",
  "vasteras",
  "västerås",
  "orebro",
  "örebro",
  "jonkoping",
  "jönköping",
  "linkoping",
  "linköping",
  "sodertalje",
  "södertälje",
  "helsingborg",
  "umea",
  "umeå",
  "lulea",
  "luleå",
  "gavle",
  "gävle",
  "norrkoping",
  "norrköping",
  "boras",
  "borås",
  "eskilstuna",
  "sundsvall",
  "karlstad",
  "vaxjo",
  "växjö",
  "skane",
  "skåne",
];

const CITY_HINTS = [
  "Stockholm",
  "Gothenburg",
  "Malmo",
  "Uppsala",
  "Vasteras",
  "Orebro",
  "Linkoping",
  "Helsingborg",
  "Jonkoping",
  "Norrkoping",
  "Lund",
  "Umea",
  "Gavle",
  "Boras",
  "Sodertalje",
  "Eskilstuna",
  "Karlstad",
  "Vaxjo",
  "Sundsvall",
  "Lulea",
  "Skovde",
  "Kungsangen",
];

const WORSHIP_KEYWORDS = [
  "worship",
  "lovsang",
  "lovsång",
  "gospel",
  "praise",
  "worship night",
  "gudstjanst",
  "gudstjänst",
];

const URL_REGEX = /https?:\/\/[^\s)]+/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const SPOTIFY_PLAYLIST_REGEX =
  /(?:open\.spotify\.com\/playlist\/|spotify:playlist:)([a-zA-Z0-9]{22})/gi;

const MAX_RESULTS_PER_QUERY = 10;
const MAX_PAGES_PER_QUERY = 1;
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 1;
const MAX_TAVILY_RESULTS = 10;
const TAVILY_DELAY_MS = 350;
const PLAYLIST_META_DELAY_MS = 150;

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractPlaylistId(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]{22})$/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = trimmed.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]{22})/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

function playlistUrlFromId(id) {
  return `https://open.spotify.com/playlist/${id}`;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseCityFromLocation(location = "") {
  const firstPart = String(location).split(",")[0].trim();
  return firstPart || "";
}

function extractUrls(text = "") {
  return unique((String(text).match(URL_REGEX) || []).map((url) => url.replace(/[.,;]$/, "")));
}

function extractEmails(text = "") {
  return unique(String(text).match(EMAIL_REGEX) || []);
}

function firstNonSpotifyUrl(urls = []) {
  return urls.find((url) => !/spotify\.com/i.test(url)) || "";
}

function extractSpotifyPlaylistIds(text = "") {
  SPOTIFY_PLAYLIST_REGEX.lastIndex = 0;
  const matches = [];
  let match;
  while ((match = SPOTIFY_PLAYLIST_REGEX.exec(String(text))) !== null) {
    matches.push(match[1]);
  }
  return unique(matches);
}

function countHits(text, keywords) {
  const normalized = normalizeText(text);
  return keywords.reduce((count, keyword) => {
    const needle = normalizeText(keyword);
    return normalized.includes(needle) ? count + 1 : count;
  }, 0);
}

function hasSwedishChars(text = "") {
  return /[åäöÅÄÖ]/.test(text);
}

function looksLikePersonName(value = "") {
  const compact = value.trim();
  if (!compact) return false;
  return /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(compact);
}

function isLikelyChurchOwner(ownerName = "") {
  const normalized = normalizeText(ownerName);
  if (!normalized) return false;
  if (countHits(ownerName, OWNER_CHURCH_KEYWORDS) > 0) return true;
  if (normalized.includes("svenska kyrkan")) return true;
  return false;
}

function isSwedishChurchRecord(church) {
  const country = normalizeText(church.country);
  const location = normalizeText(church.location);
  return country.includes("sweden") || country.includes("sverige") || location.includes("sweden");
}

function buildSwedishLookup(swedishChurches) {
  const lookup = new Map();

  function addKey(rawKey, church) {
    const key = normalizeText(rawKey);
    if (!key || key.length < 3) return;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key).push(church);
  }

  for (const church of swedishChurches) {
    addKey(church.name, church);
    addKey(church.slug, church);
    for (const alias of toArray(church.aliases)) addKey(alias, church);
    const locationCity = parseCityFromLocation(church.location);
    if (locationCity) addKey(`${church.name} ${locationCity}`, church);
  }

  return lookup;
}

function matchExistingChurch(lookup, swedishChurches, ownerName, playlistName) {
  const ownerKey = normalizeText(ownerName);
  const playlistKey = normalizeText(playlistName);

  for (const key of [ownerKey, playlistKey]) {
    const direct = lookup.get(key);
    if (direct && direct.length > 0) return direct[0];
  }

  const haystacks = [ownerKey, playlistKey].filter(Boolean);
  for (const church of swedishChurches) {
    const candidateNames = unique([church.name, ...toArray(church.aliases)]);
    for (const candidateName of candidateNames) {
      const candidateKey = normalizeText(candidateName);
      if (candidateKey.length < 5) continue;
      if (haystacks.some((haystack) => haystack.includes(candidateKey))) {
        return church;
      }
    }
  }

  return null;
}

function guessCity(text = "", fallback = "") {
  if (fallback) return fallback;
  const normalized = normalizeText(text);
  for (const city of CITY_HINTS) {
    if (normalized.includes(normalizeText(city))) return city;
  }
  return "";
}

function computeConfidence({
  existingMatch,
  churchHits,
  ownerChurchHits,
  swedenHits,
  worshipHits,
  ownerName,
}) {
  let score = 0.1;
  if (existingMatch) score += 0.3;
  score += Math.min(0.3, churchHits * 0.08);
  score += Math.min(0.25, ownerChurchHits * 0.12);
  score += Math.min(0.2, swedenHits * 0.08);
  if (worshipHits > 0) score += 0.1;
  if (hasSwedishChars(ownerName)) score += 0.05;
  if (looksLikePersonName(ownerName) && ownerChurchHits === 0) score -= 0.15;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function buildChurchKey(name) {
  return normalizeText(name);
}

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

  if (!res.ok) {
    throw new Error(`Spotify auth failed (${res.status})`);
  }

  const json = await res.json();
  return json.access_token;
}

async function searchSpotifyPlaylists(token, query, offset) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "playlist");
    url.searchParams.set("limit", String(MAX_RESULTS_PER_QUERY));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("market", "SE");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") || "1");
      const waitMs = Number.isFinite(retryAfter)
        ? Math.min(1000, Math.max(300, retryAfter * 1000))
        : 500;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      console.warn(`Search failed (${res.status}) for "${query}" offset ${offset}: ${body.slice(0, 180)}`);
      return [];
    }

    const data = await res.json();
    return data.playlists?.items || [];
  }

  console.warn(`Search failed after retries for "${query}" offset ${offset}`);
  return [];
}

async function getSpotifyPlaylistMeta(token, playlistId) {
  const fields =
    "id,name,description,owner(id,display_name),external_urls,followers(total),tracks(total)";
  const url = `https://api.spotify.com/v1/playlists/${playlistId}?market=SE&fields=${encodeURIComponent(fields)}`;

  for (let attempt = 0; attempt < MAX_RETRIES + 1; attempt += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") || "1");
      const waitMs = Number.isFinite(retryAfter)
        ? Math.min(5000, Math.max(300, retryAfter * 1000))
        : 500;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) return null;
    return res.json();
  }

  return null;
}

async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        max_results: MAX_TAVILY_RESULTS,
        include_answer: "basic",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`Tavily failed (${res.status}) for "${query}": ${body.slice(0, 160)}`);
      return null;
    }

    return res.json();
  } catch (error) {
    console.warn(`Tavily error for "${query}": ${error.message}`);
    return null;
  }
}

async function collectTavilyPlaylistCandidates() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return new Map();

  const candidateMap = new Map();

  for (const query of TAVILY_QUERIES) {
    const result = await tavilySearch(query);
    if (!result) continue;

    const texts = [result.answer || ""];
    for (const item of result.results || []) {
      texts.push(item.url || "");
      texts.push(item.title || "");
      texts.push(item.content || "");
      texts.push(item.raw_content || "");
    }

    const ids = unique(texts.flatMap((text) => extractSpotifyPlaylistIds(text)));
    for (const id of ids) {
      if (!candidateMap.has(id)) {
        candidateMap.set(id, {
          playlistId: id,
          queries: new Set(),
          sourceUrls: new Set(),
        });
      }

      const entry = candidateMap.get(id);
      entry.queries.add(query);
      for (const item of result.results || []) {
        const itemText = `${item.url || ""} ${item.title || ""} ${item.content || ""} ${item.raw_content || ""}`;
        if (extractSpotifyPlaylistIds(itemText).includes(id)) {
          if (item.url) entry.sourceUrls.add(item.url);
        }
      }
    }

    await sleep(TAVILY_DELAY_MS);
  }

  return candidateMap;
}

function buildExistingPlaylistRows(swedishChurches) {
  const rows = [];

  for (const church of swedishChurches) {
    const ids = unique([
      ...toArray(church.spotifyPlaylistIds).map(extractPlaylistId),
      ...toArray(church.additionalPlaylists).map(extractPlaylistId),
      extractPlaylistId(church.spotifyUrl || ""),
    ]);

    for (const playlistId of ids) {
      rows.push({
        church_name: church.name,
        city: parseCityFromLocation(church.location),
        location: church.location || "",
        website: church.website || "",
        email: church.email || "",
        playlist_name: "",
        playlist_id: playlistId,
        playlist_url: playlistUrlFromId(playlistId),
        owner_name: church.name,
        owner_id: "",
        playlist_description: "",
        confidence: 1,
        source: "existing-catalog",
        matched_queries: "",
        notes: "Swedish church already in src/data/churches.json with Spotify playlist",
      });
    }
  }

  return rows;
}

function aggregateChurchRows(playlistRows) {
  const byChurch = new Map();

  for (const row of playlistRows) {
    const key = buildChurchKey(row.church_name);
    if (!key) continue;

    if (!byChurch.has(key)) {
      byChurch.set(key, {
        church_name: row.church_name,
        city: row.city || "",
        location: row.location || "",
        website: row.website || "",
        email: row.email || "",
        playlist_ids: new Set(),
        playlist_urls: new Set(),
        owner_names: new Set(),
        confidence: row.confidence || 0,
        sources: new Set(),
        notes: new Set(),
      });
    }

    const entry = byChurch.get(key);

    if (!entry.city && row.city) entry.city = row.city;
    if (!entry.location && row.location) entry.location = row.location;
    if (!entry.website && row.website) entry.website = row.website;
    if (!entry.email && row.email) entry.email = row.email;

    if (row.playlist_id) entry.playlist_ids.add(row.playlist_id);
    if (row.playlist_url) entry.playlist_urls.add(row.playlist_url);
    if (row.owner_name) entry.owner_names.add(row.owner_name);
    if (row.source) entry.sources.add(row.source);
    if (row.notes) entry.notes.add(row.notes);

    if ((row.confidence || 0) > entry.confidence) {
      entry.confidence = row.confidence;
    }
  }

  return [...byChurch.values()]
    .map((entry) => ({
      church_name: entry.church_name,
      city: entry.city,
      location: entry.location,
      website: entry.website,
      email: entry.email,
      playlist_count: entry.playlist_ids.size,
      playlist_ids: [...entry.playlist_ids].join(" | "),
      playlist_urls: [...entry.playlist_urls].join(" | "),
      owner_names: [...entry.owner_names].join(" | "),
      confidence: Number(entry.confidence.toFixed(2)),
      sources: [...entry.sources].join(" | "),
      notes: [...entry.notes].join(" | "),
    }))
    .filter((row) => row.playlist_count > 0)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (b.playlist_count !== a.playlist_count) return b.playlist_count - a.playlist_count;
      return a.church_name.localeCompare(b.church_name);
    });
}

function upsertDiscoveredRow(discoveredByPlaylistId, row) {
  const playlistId = row.playlist_id;
  if (!playlistId) return;

  const existing = discoveredByPlaylistId.get(playlistId);
  if (!existing) {
    discoveredByPlaylistId.set(playlistId, row);
    return;
  }

  existing.confidence = Math.max(existing.confidence, row.confidence);
  existing.matched_queries = unique(
    `${existing.matched_queries} | ${row.matched_queries}`
      .split("|")
      .map((value) => value.trim())
  ).join(" | ");

  if (!existing.website && row.website) existing.website = row.website;
  if (!existing.email && row.email) existing.email = row.email;
  if (!existing.city && row.city) existing.city = row.city;
  if (!existing.location && row.location) existing.location = row.location;
  if (!existing.playlist_name && row.playlist_name) existing.playlist_name = row.playlist_name;
  if (!existing.playlist_description && row.playlist_description) {
    existing.playlist_description = row.playlist_description;
  }
  if (!existing.owner_name && row.owner_name) existing.owner_name = row.owner_name;
  if (!existing.owner_id && row.owner_id) existing.owner_id = row.owner_id;

  existing.source = unique(`${existing.source} | ${row.source}`.split("|").map((value) => value.trim())).join(
    " | "
  );
}

async function main() {
  mkdirSync(TMP_DIR, { recursive: true });

  const churches = JSON.parse(readFileSync(CHURCHES_PATH, "utf8"));
  const swedishChurches = churches.filter(isSwedishChurchRecord);
  const lookup = buildSwedishLookup(swedishChurches);

  console.log(`Loaded ${swedishChurches.length} Swedish churches from catalog`);

  const token = await getSpotifyToken();
  console.log("Spotify auth: OK");

  const discoveredByPlaylistId = new Map();
  let inspectedPlaylists = 0;

  for (const query of SEARCH_QUERIES) {
    for (let page = 0; page < MAX_PAGES_PER_QUERY; page += 1) {
      const offset = page * MAX_RESULTS_PER_QUERY;
      const playlists = await searchSpotifyPlaylists(token, query, offset);
      if (playlists.length === 0) continue;

      for (const playlist of playlists) {
        inspectedPlaylists += 1;
        const playlistId = extractPlaylistId(playlist?.id || "");
        if (!playlistId) continue;

        const ownerName = playlist?.owner?.display_name || playlist?.owner?.id || "";
        const ownerId = playlist?.owner?.id || "";
        const playlistName = playlist?.name || "";
        const playlistDescription = playlist?.description || "";

        const combined = `${ownerName} ${playlistName} ${playlistDescription}`;
        const existingMatch = matchExistingChurch(
          lookup,
          swedishChurches,
          ownerName,
          `${playlistName} ${playlistDescription}`
        );

        const churchHits = countHits(combined, CHURCH_KEYWORDS);
        const ownerChurchHits = countHits(ownerName, CHURCH_KEYWORDS);
        const swedenHits =
          countHits(combined, SWEDEN_KEYWORDS) +
          (hasSwedishChars(combined) ? 1 : 0);
        const worshipHits = countHits(combined, WORSHIP_KEYWORDS);

        if (!existingMatch && !isLikelyChurchOwner(ownerName)) continue;
        if (!existingMatch && swedenHits === 0) continue;
        if (looksLikePersonName(ownerName) && ownerChurchHits === 0 && !existingMatch) {
          continue;
        }

        const confidence = computeConfidence({
          existingMatch,
          churchHits,
          ownerChurchHits,
          swedenHits,
          worshipHits,
          ownerName,
        });
        if (confidence < 0.35) continue;

        const descriptionUrls = extractUrls(playlistDescription);
        const descriptionEmails = extractEmails(playlistDescription);

        const churchName = existingMatch?.name || ownerName || playlistName;
        const city = guessCity(
          combined,
          existingMatch ? parseCityFromLocation(existingMatch.location) : ""
        );
        const location = existingMatch?.location || (city ? `${city}, Sweden` : "");
        const website = existingMatch?.website || firstNonSpotifyUrl(descriptionUrls) || "";
        const email = existingMatch?.email || descriptionEmails[0] || "";

        const row = {
          church_name: churchName,
          city,
          location,
          website,
          email,
          playlist_name: playlistName,
          playlist_id: playlistId,
          playlist_url:
            playlist?.external_urls?.spotify || playlistUrlFromId(playlistId),
          owner_name: ownerName,
          owner_id: ownerId,
          playlist_description: playlistDescription,
          confidence,
          source: existingMatch ? "existing-match+spotify-search" : "spotify-search",
          matched_queries: query,
          notes: existingMatch
            ? "Matched existing Swedish church in catalog"
            : "Discovered from Spotify search with Swedish church keywords",
        };

        upsertDiscoveredRow(discoveredByPlaylistId, row);
      }

      await sleep(REQUEST_DELAY_MS);
    }
  }

  const tavilyCandidates = await collectTavilyPlaylistCandidates();
  let tavilyChecked = 0;
  let tavilyAccepted = 0;

  if (tavilyCandidates.size > 0) {
    console.log(`Tavily candidates: ${tavilyCandidates.size}`);
  }

  for (const candidate of tavilyCandidates.values()) {
    if (discoveredByPlaylistId.has(candidate.playlistId)) continue;

    tavilyChecked += 1;
    const metadata = await getSpotifyPlaylistMeta(token, candidate.playlistId);
    if (!metadata) continue;

    const ownerName = metadata?.owner?.display_name || metadata?.owner?.id || "";
    const ownerId = metadata?.owner?.id || "";
    const playlistName = metadata?.name || "";
    const playlistDescription = metadata?.description || "";
    const queryText = [...candidate.queries].join(" | ");
    const sourceUrlText = [...candidate.sourceUrls].join(" ");

    const combined = `${ownerName} ${playlistName} ${playlistDescription} ${queryText}`;
    const existingMatch = matchExistingChurch(
      lookup,
      swedishChurches,
      ownerName,
      `${playlistName} ${playlistDescription}`
    );

    const churchHits = countHits(combined, CHURCH_KEYWORDS);
    const ownerChurchHits = countHits(ownerName, CHURCH_KEYWORDS);
    const swedenHits =
      countHits(`${combined} ${sourceUrlText}`, SWEDEN_KEYWORDS) +
      (hasSwedishChars(combined) ? 1 : 0);
    const worshipHits = countHits(combined, WORSHIP_KEYWORDS);

    if (!existingMatch && !isLikelyChurchOwner(ownerName)) continue;
    if (!existingMatch && swedenHits === 0) continue;
    if (looksLikePersonName(ownerName) && ownerChurchHits === 0 && !existingMatch) {
      continue;
    }

    const confidence = computeConfidence({
      existingMatch,
      churchHits,
      ownerChurchHits,
      swedenHits,
      worshipHits,
      ownerName,
    });
    if (!existingMatch && confidence < 0.55) continue;

    const descriptionUrls = extractUrls(`${playlistDescription} ${sourceUrlText}`);
    const descriptionEmails = extractEmails(playlistDescription);

    const churchName = existingMatch?.name || ownerName || playlistName;
    const city = guessCity(
      `${combined} ${sourceUrlText}`,
      existingMatch ? parseCityFromLocation(existingMatch.location) : ""
    );
    const location = existingMatch?.location || (city ? `${city}, Sweden` : "");
    const website = existingMatch?.website || firstNonSpotifyUrl(descriptionUrls) || "";
    const email = existingMatch?.email || descriptionEmails[0] || "";

    const row = {
      church_name: churchName,
      city,
      location,
      website,
      email,
      playlist_name: playlistName,
      playlist_id: candidate.playlistId,
      playlist_url: metadata?.external_urls?.spotify || playlistUrlFromId(candidate.playlistId),
      owner_name: ownerName,
      owner_id: ownerId,
      playlist_description: playlistDescription,
      confidence,
      source: existingMatch ? "existing-match+tavily-web-search" : "tavily-web-search",
      matched_queries: queryText,
      notes: existingMatch
        ? "Matched existing Swedish church in catalog (found via Tavily)"
        : "Discovered via Tavily web search for Spotify playlist URLs",
    };

    upsertDiscoveredRow(discoveredByPlaylistId, row);
    tavilyAccepted += 1;
    await sleep(PLAYLIST_META_DELAY_MS);
  }

  const playlistRows = [
    ...buildExistingPlaylistRows(swedishChurches),
    ...[...discoveredByPlaylistId.values()],
  ];

  const uniquePlaylistRows = [];
  const seenPlaylistAndChurch = new Set();
  for (const row of playlistRows) {
    const key = `${row.playlist_id}::${buildChurchKey(row.church_name)}`;
    if (!row.playlist_id || seenPlaylistAndChurch.has(key)) continue;
    seenPlaylistAndChurch.add(key);
    uniquePlaylistRows.push(row);
  }

  const churchRows = aggregateChurchRows(uniquePlaylistRows);

  writeFileSync(PLAYLIST_LEVEL_PATH, `${JSON.stringify(uniquePlaylistRows, null, 2)}\n`);
  writeFileSync(CHURCH_LEVEL_PATH, `${JSON.stringify(churchRows, null, 2)}\n`);

  console.log(`Inspected playlists from Spotify search: ${inspectedPlaylists}`);
  console.log(`Checked Tavily playlist candidates: ${tavilyChecked}`);
  console.log(`Accepted Tavily playlist rows: ${tavilyAccepted}`);
  console.log(`Playlist-level rows: ${uniquePlaylistRows.length}`);
  console.log(`Church-level rows: ${churchRows.length}`);
  console.log(`Wrote: ${PLAYLIST_LEVEL_PATH}`);
  console.log(`Wrote: ${CHURCH_LEVEL_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
