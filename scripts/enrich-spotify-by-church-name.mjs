#!/usr/bin/env node

/**
 * Spotify enrichment for already-imported churches.
 *
 * For each target church, searches Spotify using "Church name playlist" or
 * "Church name city playlist". It scores each result by strict name similarity
 * and auxiliary signals, then writes the highest-scoring match back to
 * `churches.spotify_url` and `churches.spotify_playlist_ids`.
 *
 * Key differences from discover-spotify-churches-v2.mjs:
 *  - Church → Spotify (not the reverse). Matches Spotify data to known slugs.
 *  - No broad keyword sweep; one targeted playlist query per church.
 *  - Strict name normalization + token-set similarity.
 *  - Writes to `churches` (not `church_candidates`).
 *
 * Usage:
 *   node scripts/enrich-spotify-by-church-name.mjs --dry-run --limit=10
 *   node scripts/enrich-spotify-by-church-name.mjs --reason-prefix="FeG Schweiz" --dry-run
 *   node scripts/enrich-spotify-by-church-name.mjs --slugs=feg-thayngen,feg-bern
 *   node scripts/enrich-spotify-by-church-name.mjs --since-import --min-score=0.8
 *   node scripts/enrich-spotify-by-church-name.mjs --dry-run --headed
 *   node scripts/enrich-spotify-by-church-name.mjs --dry-run --api --limit=10
 *   node scripts/enrich-spotify-by-church-name.mjs --daily --daily-limit=1000 --offset=25 --dry-run
 *   node scripts/enrich-spotify-by-church-name.mjs --high-likelihood --limit=1000 --dry-run
 *   node scripts/enrich-spotify-by-church-name.mjs --all-missing --searched-before=2026-07-17T17:00:00Z --min-score=0.7
 *   node scripts/enrich-spotify-by-church-name.mjs --audit-since=2026-07-17T17:00:00Z --min-score=0.7
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const DEFAULTS = {
  minScore: 0.75,
  concurrency: 1,
  searchLimit: 10,
  throttleMs: 800,
  dailyLimit: 500,
  recheckAfterDays: 30,
};

// Words to strip when comparing church names — they carry no distinguishing signal.
// Brand-family markers (FeG, BEFG, BFP, Pingst, Hillsong, etc.) are deliberately
// NOT stripped because they help distinguish "Hillsong Sweden" from "Hillsong
// Worship" and give single-city churches a second token. "Worship" is also kept
// as a signal token rather than a stopword.
const CHURCH_STOPWORDS = new Set([
  // English
  "church", "chapel", "fellowship", "community", "international", "ministries",
  "ministry", "cathedral", "parish", "centre", "center",
  // German
  "kirche", "freie", "evangelische", "evangelisch", "gemeinde", "freikirchliche",
  "bund", "der", "die", "das",
  // Swedish / Norwegian / Danish
  "kyrka", "kyrkan", "forsamling", "forsamlingen", "forsamlingar",
  "frikyrka", "missionsforsamling", "kyrkans", "menighet", "menigheten",
  // Spanish / Portuguese
  "iglesia", "evangelica", "evangelico", "evangelical", "cristiana", "cristiano",
  "asambleas", "asamblea", "ministerio", "comunidad", "igreja",
  // French
  "eglise", "evangelique", "protestante",
  // Italian
  "chiesa",
  // Dutch
  "kerk", "gemeente",
  // Generic connectors
  "the", "of", "a", "an", "de", "la", "el", "y", "e", "du", "des", "von", "zu", "am",
  "in", "an", "im", "est", "sum", "sunt",
  // Playlist / listing noise
  "playlist", "songs", "musik", "music", "tracks",
]);

// Tokens considered "worship context" — their presence as an extra in a candidate
// name is not noise, it's evidence the candidate is religious in nature.
const WORSHIP_CONTEXT_TOKENS = new Set([
  "worship", "lobpreis", "lovsang", "lovsang", "praise", "anbetung", "adoracion",
  "adoracao", "alabanza", "louvor", "louange", "ylistys", "gottesdienst",
  "gospel", "sunday", "service", "live", "sanctuary",
  "night", "youth", "ya", "student", "students", "congregational",
  "weekend", "current", "upcoming", "canon",
]);

const WORSHIP_KEYWORDS = [
  "worship", "praise", "lobpreis", "lovsång", "lovsang", "anbetning",
  "adoracion", "adoração", "alabanza", "louvor", "louange",
  "ylistys", "ibadah", "pujian", "sunday", "songs", "setlist", "vbs", "music",
];

const CHURCH_IDENTITY_WORDS = new Set([
  "church", "chapel", "fellowship", "ministry", "ministries", "cathedral", "parish",
  "temple", "center", "centre", "christian", "baptist", "pentecostal", "presbyterian", "methodist",
  "lutheran", "adventist", "kyrka", "kyrkan", "forsamling", "menighet",
  "kirche", "gemeinde", "freikirche", "eglise", "chiesa", "kerk",
  "iglesia", "cristiana", "cristiano", "igreja", "crista",
]);

function parseArgs(argv) {
  const options = {
    slugs: [],
    reasonPrefix: "",
    limit: 0,
    offset: 0,
    concurrency: DEFAULTS.concurrency,
    dryRun: false,
    minScore: DEFAULTS.minScore,
    force: false,
    sinceImport: false,
    daily: false,
    dailyLimit: DEFAULTS.dailyLimit,
    throttleMs: DEFAULTS.throttleMs,
    recheckAfterDays: DEFAULTS.recheckAfterDays,
    revalidateLegacy: false,
    highLikelihood: false,
    allMissing: false,
    searchedBefore: "",
    auditSince: "",
    source: "web",
    headed: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--since-import") options.sinceImport = true;
    else if (arg === "--daily") options.daily = true;
    else if (arg === "--revalidate-legacy") options.revalidateLegacy = true;
    else if (arg === "--high-likelihood") options.highLikelihood = true;
    else if (arg === "--all-missing") options.allMissing = true;
    else if (arg === "--api") options.source = "api";
    else if (arg === "--headed") options.headed = true;
    else if (arg.startsWith("--slugs=")) options.slugs = arg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--reason-prefix=")) options.reasonPrefix = arg.split("=")[1];
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--offset=")) options.offset = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--daily-limit=")) options.dailyLimit = Math.max(1, Number(arg.split("=")[1]) || DEFAULTS.dailyLimit);
    else if (arg.startsWith("--throttle=")) options.throttleMs = Math.max(0, Number(arg.split("=")[1]) || DEFAULTS.throttleMs);
    else if (arg.startsWith("--recheck-after=")) options.recheckAfterDays = Math.max(1, Number(arg.split("=")[1]) || DEFAULTS.recheckAfterDays);
    else if (arg.startsWith("--searched-before=")) options.searchedBefore = arg.slice("--searched-before=".length);
    else if (arg.startsWith("--audit-since=")) options.auditSince = arg.slice("--audit-since=".length);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || DEFAULTS.concurrency);
    else if (arg.startsWith("--min-score=")) options.minScore = Math.max(0, Math.min(1, Number(arg.split("=")[1]) || DEFAULTS.minScore));
  }
  return options;
}

/* ── Name normalization ── */

function stripDiacritics(s) {
  return String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeName(name) {
  const cleaned = stripDiacritics(String(name))
    .toLowerCase()
    .replace(/[|\-–—:;,()]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function toTokens(normalized) {
  return normalized.split(" ").filter((t) => t && !CHURCH_STOPWORDS.has(t));
}

function coreTokens(name) {
  return toTokens(normalizeName(name));
}

function containsWholePhrase(value, phrase) {
  const normalizedValue = normalizeName(value);
  const normalizedPhrase = normalizeName(phrase);
  if (normalizedPhrase.length < 4) return false;
  return ` ${normalizedValue} `.includes(` ${normalizedPhrase} `);
}

function hasChurchIdentityWord(value) {
  const normalized = normalizeName(value);
  return normalized.split(" ").some((token) => CHURCH_IDENTITY_WORDS.has(token)) ||
    /(?:church|kirke|kyrka|kyrkan|kerk|kirche)$/.test(normalized);
}

function tokenSetSimilarity(a, b) {
  const setA = new Set(coreTokens(a));
  const setB = new Set(coreTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

function candidateContainsLocation(church, ...values) {
  const city = normalizeName(String(church.location || "").split(",")[0]);
  if (city.length < 3) return false;
  const candidate = normalizeName(values.filter(Boolean).join(" "));
  return ` ${candidate} `.includes(` ${city} `);
}

/**
 * True when `candidate` is a legitimate specialization of `church`.
 *
 * All church tokens must appear in the candidate and every extra token must
 * be worship context. Location variants are handled separately so a leading
 * modifier cannot turn "Grace Church" into "Sovereign Grace Church".
 *
 * For 1-core-token churches, only worship-context extras are permitted. This
 * keeps names such as "Åbenkirke Lovsang" while rejecting unrelated suffixes.
 */
function isTightSpecialization(church, candidate) {
  const churchTokens = coreTokens(church);
  if (churchTokens.length === 0) return false;
  const churchSet = new Set(churchTokens);
  const candidateTokens = coreTokens(candidate);
  const candidateSet = new Set(candidateTokens);
  for (const t of churchSet) if (!candidateSet.has(t)) return false;

  if (churchSet.size === 1) {
    const extras = candidateTokens.filter((token) => !churchSet.has(token));
    return extras.every((token) => WORSHIP_CONTEXT_TOKENS.has(token));
  }

  const extras = candidateTokens.filter((t) => !churchSet.has(t));
  return extras.every((token) => WORSHIP_CONTEXT_TOKENS.has(token));
}

/* ── Spotify API ── */

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let spotifyTokenCache = null;
async function getSpotifyToken() {
  if (spotifyTokenCache && spotifyTokenCache.expiresAt > Date.now() + 30000) {
    return spotifyTokenCache.token;
  }
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing SPOTIFY_CLIENT_ID/SECRET");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchWithTimeout(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    },
    8000,
  );
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  spotifyTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

let rateLimitedUntil = 0;

async function spotifySearch(token, query, types = "playlist", limit = DEFAULTS.searchLimit, retries = 3) {
  if (Date.now() < rateLimitedUntil) {
    throw new Error("RATE_LIMITED");
  }
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", types);
  url.searchParams.set("limit", String(limit));
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let res;
    try {
      res = await fetchWithTimeout(
        url,
        { headers: { Authorization: `Bearer ${token}` } },
        12000,
      );
    } catch {
      // Timeout or network error — backoff and retry
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      return { artists: { items: [] }, playlists: { items: [] } };
    }
    if (res.ok) return res.json();
    if (res.status === 429) {
      const retryAfterRaw = Number(res.headers.get("retry-after") || 60);
      // If Spotify signals a long backoff (>5 min), mark the session as
      // rate-limited and abort the run entirely. Daily cron retries
      // naturally from here.
      if (retryAfterRaw > 300) {
        rateLimitedUntil = Date.now() + retryAfterRaw * 1000;
        throw new Error(`RATE_LIMITED retry-after=${retryAfterRaw}s`);
      }
      const retryAfter = Math.min(retryAfterRaw, 20);
      await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
      continue;
    }
    if (res.status === 401) {
      spotifyTokenCache = null;
      token = await getSpotifyToken();
      continue;
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
      continue;
    }
    return { artists: { items: [] }, playlists: { items: [] } };
  }
  return { artists: { items: [] }, playlists: { items: [] } };
}

async function spotifyWebSearch(page, query, limit = DEFAULTS.searchLimit) {
  const url = `https://open.spotify.com/search/${encodeURIComponent(query)}/playlists`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const responsePromise = page.waitForResponse((response) => {
        if (!response.url().includes("/pathfinder/v2/query")) return false;
        try {
          const body = JSON.parse(response.request().postData() || "{}");
          return body.operationName === "searchPlaylists" && body.variables?.searchTerm === query;
        } catch {
          return false;
        }
      }, { timeout: 20000 });

      const searchInput = page.getByTestId("search-input");
      let response;
      if (attempt === 0 && page.url().startsWith("https://open.spotify.com/search/") && await searchInput.count()) {
        await searchInput.fill(query);
        [, response] = await Promise.all([searchInput.press("Enter"), responsePromise]);
      } else {
        [, response] = await Promise.all([
          page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }),
          responsePromise,
        ]);
      }

      if (response.status() === 429) throw new Error("RATE_LIMITED: Spotify web returned 429");
      if (!response.ok()) throw new Error(`Spotify web search returned ${response.status()}`);

      const payload = await response.json();
      const items = payload?.data?.searchV2?.playlists?.items || [];
      const playlists = items.slice(0, limit).flatMap((item) => {
        const data = item?.data;
        const id = data?.uri?.match(/^spotify:playlist:([A-Za-z0-9]{22})$/)?.[1];
        if (!id || !data?.name) return [];
        const owner = data.ownerV2?.data || {};
        return [{
          id,
          name: data.name,
          description: data.description || "",
          owner: { id: owner.username || "", display_name: owner.name || "" },
          external_urls: { spotify: `https://open.spotify.com/playlist/${id}` },
        }];
      });
      return { artists: { items: [] }, playlists: { items: playlists } };
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout((attempt + 1) * 1000);
    }
  }
  return { artists: { items: [] }, playlists: { items: [] } };
}

/* ── Scoring ── */

function scorePlaylist(church, playlist) {
  const ownerName = playlist.owner?.display_name || "";
  const ownerId = playlist.owner?.id || "";
  const playlistName = playlist.name || "";

  if (
    church.ambiguousName &&
    !candidateContainsLocation(church, playlistName, playlist.description, ownerName)
  ) {
    return 0;
  }

  // Hard reject: Spotify-curated editorial lists. These are never owned by
  // the church and linking to them falsely suggests ownership.
  if (ownerId === "spotify" || ownerName.toLowerCase() === "spotify") return 0;

  // Hard reject: fan-compilation naming patterns. "Best of", "Top 50",
  // "Essentials", "Mix" — these are almost always fan-made or editorial,
  // not a church's own playlist.
  if (/(^|\s)(best of|top\s*\d*|essentials|this is|greatest hits)\b/i.test(playlistName)) return 0;

  // Primary signal: owner name is a tight specialization of the church name.
  const ownerSimilarity = tokenSetSimilarity(church.name, ownerName);
  const ownerHasExactName = containsWholePhrase(ownerName, church.name);
  const churchHasIdentity = hasChurchIdentityWord(church.name);
  const ownerHasIdentity = hasChurchIdentityWord(ownerName);
  const lowerPlaylist = normalizeName(playlistName);
  const hasWorshipContext = WORSHIP_KEYWORDS.some((keyword) => lowerPlaylist.includes(keyword));
  const ownerStrong =
    ownerHasExactName && (churchHasIdentity || ownerHasIdentity) &&
    isTightSpecialization(church.name, ownerName);
  const ownerCoreStrong = ownerHasIdentity &&
    isTightSpecialization(church.name, ownerName) &&
    tokenSetSimilarity(church.name, playlistName) >= 0.5 &&
    hasWorshipContext;

  let score = ownerStrong ? ownerSimilarity : ownerSimilarity * 0.5;
  if (ownerStrong) score = Math.max(score, 0.85);
  if (ownerCoreStrong) score = Math.max(score, 0.8);

  // A matching title or location is useful for search ranking, but it is not
  // ownership evidence. Any personal account can publish a playlist with a
  // church name, so neither signal may clear the automatic-write threshold.

  // Worship keyword in playlist name — mild boost, not enough to single-handedly clear threshold
  if (hasWorshipContext) score += 0.05;

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function pickBestMatch(church, searchResult) {
  const candidates = [];

  for (const playlist of searchResult.playlists?.items || []) {
    if (!playlist?.name || !playlist?.owner) continue;
    const score = scorePlaylist(church, playlist);
    candidates.push({
      type: "playlist",
      score,
      entity: playlist,
      url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function pickExistingMatch(church, searchResult) {
  const existingId = String(church.spotify_url || "").match(/\/playlist\/([A-Za-z0-9]{22})/)?.[1];
  if (!existingId) return null;
  const playlist = (searchResult.playlists?.items || []).find((item) => item?.id === existingId);
  if (!playlist) return null;
  return {
    type: "playlist",
    score: scorePlaylist(church, playlist),
    entity: playlist,
    url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
  };
}

/* ── DB ── */

async function loadTargets(sql, options) {
  const recheckInterval = `${options.recheckAfterDays} days`;

  if (options.slugs.length > 0) {
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
      FROM churches
      WHERE slug = ANY(${options.slugs}::text[])
        AND status = 'approved'
    `;
  }
  if (options.auditSince) {
    if (Number.isNaN(Date.parse(options.auditSince))) {
      throw new Error("--audit-since requires a valid ISO timestamp");
    }
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_owner_id, spotify_searched_at
      FROM churches
      WHERE status = 'approved'
        AND spotify_url IS NOT NULL
        AND spotify_searched_at >= ${options.auditSince}::timestamp
      ORDER BY slug
      LIMIT ${options.limit > 0 ? options.limit : 100000}
    `;
  }
  if (options.allMissing) {
    if (!options.searchedBefore || Number.isNaN(Date.parse(options.searchedBefore))) {
      throw new Error("--all-missing requires a valid --searched-before=<ISO timestamp>");
    }
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
      FROM churches
      WHERE status = 'approved'
        AND spotify_url IS NULL
        AND (spotify_searched_at IS NULL OR spotify_searched_at < ${options.searchedBefore}::timestamp)
      ORDER BY (
        CASE WHEN youtube_channel_id IS NOT NULL THEN 30 ELSE 0 END
        + CASE WHEN jsonb_array_length(coalesce(youtube_videos, '[]'::jsonb)) > 0 THEN 25 ELSE 0 END
        + CASE WHEN cardinality(music_style) > 0 THEN 20 ELSE 0 END
        + CASE WHEN website IS NOT NULL THEN 5 ELSE 0 END
        + least(coalesce(display_score, 0), 125) / 25
      ) DESC, directory_score DESC NULLS LAST, slug
      LIMIT ${options.limit > 0 ? options.limit : 100000}
    `;
  }
  if (options.revalidateLegacy) {
    // Legacy matches: spotify_url set by the old discover flow but never
    // checked by this matcher (spotify_searched_at IS NULL). Existing links
    // may be manually curated, so revalidation is intentionally non-destructive:
    // it records the search timestamp but never replaces or clears the URL.
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
      FROM churches
      WHERE status = 'approved'
        AND spotify_url IS NOT NULL
        AND spotify_searched_at IS NULL
      ORDER BY slug
      LIMIT ${options.limit > 0 ? options.limit : 1000}
    `;
  }
  if (options.highLikelihood) {
    const HIGH_HIT_COUNTRIES = [
      "United Kingdom", "Sweden", "Norway", "Denmark", "Finland",
      "Netherlands", "Switzerland", "Australia", "Canada", "South Africa",
      "Brazil", "Philippines", "Germany",
    ];
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
      FROM churches
      WHERE status = 'approved'
        AND spotify_url IS NULL
        AND country = ANY(${HIGH_HIT_COUNTRIES}::text[])
        AND (
          youtube_channel_id IS NOT NULL
          OR jsonb_array_length(coalesce(youtube_videos, '[]'::jsonb)) > 0
          OR cardinality(music_style) > 0
        )
      ORDER BY (
        CASE WHEN youtube_channel_id IS NOT NULL THEN 30 ELSE 0 END
        + CASE WHEN jsonb_array_length(coalesce(youtube_videos, '[]'::jsonb)) > 0 THEN 25 ELSE 0 END
        + CASE WHEN cardinality(music_style) > 0 THEN 20 ELSE 0 END
        + CASE WHEN verified_at IS NOT NULL THEN 15 ELSE 0 END
        + CASE WHEN website IS NOT NULL THEN 5 ELSE 0 END
        + CASE WHEN spotify_searched_at IS NULL THEN 5 ELSE 0 END
        + least(coalesce(display_score, 0), 125) / 25
      ) DESC, directory_score DESC NULLS LAST, slug
      LIMIT ${options.limit > 0 ? options.limit : 1000}
      OFFSET ${options.offset}
    `;
  }
  if (options.daily) {
    // Daily cron-friendly mode: process the next slice of churches that
    // haven't been searched recently, skipping ones that already have a
    // Spotify URL. Country priority drains high-hit-rate markets first
    // (DE/UK/Nordics/AU at 30-80% match) before chewing through the long
    // US tail (~10% match). Within a tier, oldest-searched wins.
    const HIGH_PRIORITY_COUNTRIES = [
      "Germany",
      "United Kingdom",
      "Sweden",
      "Denmark",
      "Norway",
      "Netherlands",
      "France",
      "Switzerland",
      "Australia",
    ];
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
      FROM churches
      WHERE status = 'approved'
        AND spotify_url IS NULL
        AND (spotify_searched_at IS NULL
             OR spotify_searched_at < NOW() - ${recheckInterval}::interval)
      ORDER BY
        CASE WHEN country = ANY(${HIGH_PRIORITY_COUNTRIES}::text[]) THEN 0 ELSE 1 END,
        spotify_searched_at NULLS FIRST,
        slug
      LIMIT ${options.dailyLimit}
      OFFSET ${options.offset}
    `;
  }
  if (options.reasonPrefix) {
    const like = `%${options.reasonPrefix}%`;
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
      FROM churches
      WHERE reason LIKE ${like}
        AND status = 'approved'
        AND (spotify_url IS NULL OR ${options.force}::boolean)
      ORDER BY slug
      LIMIT ${options.limit > 0 ? options.limit : 10000}
    `;
  }
  if (options.sinceImport) {
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
      FROM churches
      WHERE (reason LIKE 'directory-import:%' OR reason LIKE 'directory-import-fallback:%')
        AND status = 'approved'
        AND spotify_url IS NULL
      ORDER BY slug
      LIMIT ${options.limit > 0 ? options.limit : 10000}
    `;
  }
  return sql`
    SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
    FROM churches
    WHERE status = 'approved' AND spotify_url IS NULL
    ORDER BY slug
    LIMIT ${options.limit > 0 ? options.limit : 100}
  `;
}

async function markSearched(sql, slug) {
  await sql`UPDATE churches SET spotify_searched_at = NOW(), updated_at = NOW() WHERE slug = ${slug}`;
}

async function writeMatch(sql, slug, match, ownerIdToClaim = null) {
  await sql`
    UPDATE churches
    SET spotify_url = ${match.url},
        spotify_playlist_ids = ARRAY(
          SELECT DISTINCT UNNEST(COALESCE(spotify_playlist_ids, ARRAY[]::text[]) || ARRAY[${match.entity.id}])
        ),
        spotify_owner_id = COALESCE(spotify_owner_id, ${ownerIdToClaim}),
        updated_at = NOW()
    WHERE slug = ${slug}
  `;
}

async function clearAutomatedMatch(sql, church) {
  const playlistId = String(church.spotify_url || "").match(/\/playlist\/([A-Za-z0-9]{22})/)?.[1] || null;
  await sql`
    UPDATE churches
    SET spotify_playlist_ids = CASE
          WHEN ${playlistId}::text IS NULL THEN spotify_playlist_ids
          ELSE array_remove(spotify_playlist_ids, ${playlistId})
        END,
        spotify_url = NULL,
        spotify_owner_id = NULL,
        spotify_searched_at = NOW(),
        updated_at = NOW()
    WHERE slug = ${church.slug}
  `;
}

/* ── Worker ── */

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async (_, workerIndex) => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await worker(items[i], i, workerIndex) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

/* ── Main ── */

function buildQuery(church) {
  const city = String(church.location || "").split(",")[0].trim();
  const nameAlreadyContainsCity = city && normalizeName(church.name).includes(normalizeName(city));
  return city && !nameAlreadyContainsCity
    ? `${church.name} ${city} playlist`
    : `${church.name} playlist`;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED");
  }
  const sql = neon(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED);

  const targets = await loadTargets(sql, options);
  console.log(`Targets: ${targets.length} churches`);
  if (targets.length === 0) return;

  const targetNames = [...new Set(targets.map((church) => church.name.toLowerCase()))];
  const duplicateNames = await sql`
    SELECT lower(name) AS name
    FROM churches
    WHERE status = 'approved'
      AND lower(name) = ANY(${targetNames}::text[])
    GROUP BY lower(name)
    HAVING count(*) > 1
  `;
  const ambiguousNames = new Set(duplicateNames.map((row) => row.name));
  for (const church of targets) {
    church.ambiguousName = ambiguousNames.has(church.name.toLowerCase());
  }

  // spotify_owner_id is a one-to-one identity claim. A playlist maintained
  // by an owner already linked to another church needs location evidence;
  // otherwise generic church names create convincing but incorrect matches.
  const ownerRows = await sql`
    SELECT spotify_owner_id, slug
    FROM churches
    WHERE spotify_owner_id IS NOT NULL
  `;
  const claimedOwnerSlugs = new Map(ownerRows.map((row) => [row.spotify_owner_id, row.slug]));

  let browser = null;
  const pages = [];
  if (options.source === "web") {
    options.concurrency = Math.min(options.concurrency, 24);
    browser = await chromium.launch({ headless: !options.headed });
    const context = await browser.newContext({ serviceWorkers: "block" });
    for (let index = 0; index < options.concurrency; index += 1) {
      const page = await context.newPage();
      await page.route("**/*", (route) => {
        const type = route.request().resourceType();
        return ["image", "media", "font"].includes(type) ? route.abort() : route.continue();
      });
      pages.push(page);
    }
    console.log(`Spotify web search ready (${pages.length} browser tab${pages.length === 1 ? "" : "s"}).`);
  } else {
    await getSpotifyToken();
    console.log("Spotify API authenticated.");
  }

  const summary = {
    searched: 0,
    matchedPlaylist: 0,
    noMatch: 0,
    belowThreshold: 0,
    ownerConflicts: 0,
    errors: 0,
    written: 0,
    kept: 0,
    removed: 0,
  };
  const matches = [];

  // Each worker owns a browser tab. The default remains deliberately serial;
  // larger runs can opt into up to twenty-four isolated browser tabs.
  await mapWithConcurrency(targets, options.concurrency, async (church, index, workerIndex) => {
    const searchedCount = ++summary.searched;

    // Throttle: simple fixed delay between requests per worker slot.
    if (options.throttleMs > 0 && index > 0) {
      await new Promise((r) => setTimeout(r, options.throttleMs));
    }

    const query = buildQuery(church);
    let result;
    try {
      if (options.source === "web") {
        result = await spotifyWebSearch(pages[workerIndex], query);
      } else {
        const token = await getSpotifyToken();
        result = await spotifySearch(token, query, "playlist");
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("RATE_LIMITED")) {
        summary.rateLimited = (summary.rateLimited || 0) + 1;
        return;
      }
      summary.errors += 1;
      if (summary.errors <= 10) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        console.warn(`[web error ${summary.errors}] ${church.slug}: ${message}`);
      }
      return;
    }

    if (searchedCount % 25 === 0) {
      console.log(`[${searchedCount}/${targets.length}] searched · ${summary.matchedPlaylist} playlist matches · ${summary.errors} errors`);
    }

    const best = options.auditSince
      ? pickExistingMatch(church, result)
      : pickBestMatch(church, result);
    const rowUpdated = !options.dryRun;

    const recordMatch = (action) => {
      matches.push({
        slug: church.slug,
        name: church.name,
        existingUrl: church.spotify_url || null,
        best: best
          ? {
              type: best.type,
              score: best.score,
              label: best.entity?.name || best.entity?.owner?.display_name || "",
              url: best.url,
            }
          : null,
        action,
      });
    };

    const passesThreshold = best && best.score >= options.minScore;

    if (options.auditSince) {
      if (passesThreshold) {
        summary.matchedPlaylist += 1;
        summary.kept += 1;
        recordMatch("kept");
        if (rowUpdated) await markSearched(sql, church.slug).catch(() => summary.errors++);
      } else {
        if (!best) summary.noMatch += 1;
        else summary.belowThreshold += 1;
        summary.removed += 1;
        recordMatch("removed");
        if (rowUpdated) {
          await clearAutomatedMatch(sql, church).catch(() => summary.errors++);
        }
      }
      return;
    }

    if (!passesThreshold) {
      if (!best) summary.noMatch += 1;
      else summary.belowThreshold += 1;

      // A search miss cannot prove that an existing curated URL is wrong.
      if (options.revalidateLegacy && church.spotify_url) {
        recordMatch("unverified");
        summary.kept += 1;
        if (rowUpdated) {
          try {
            await markSearched(sql, church.slug);
          } catch {
            summary.errors += 1;
          }
        }
        return;
      }

      recordMatch("rejected");
      if (rowUpdated) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }

    const ownerId = best.entity.owner?.id || "";
    const claimedOwnerSlug = ownerId ? claimedOwnerSlugs.get(ownerId) : null;
    if (claimedOwnerSlug && claimedOwnerSlug !== church.slug) {
      summary.ownerConflicts += 1;
      recordMatch("owner-conflict");
      if (rowUpdated) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }

    const ownerIdToClaim = ownerId && !claimedOwnerSlug ? ownerId : null;
    if (ownerIdToClaim) claimedOwnerSlugs.set(ownerIdToClaim, church.slug);
    summary.matchedPlaylist += 1;

    // Never let an automated search overwrite an existing curated URL. A
    // different high-scoring result is reported as a conflict for review.
    if (options.revalidateLegacy) {
      const isSame = church.spotify_url === best.url;
      recordMatch(isSame ? "kept" : "conflict");
      summary.kept += 1;
      if (!options.dryRun) {
        try {
          await markSearched(sql, church.slug);
        } catch {
          summary.errors += 1;
        }
      }
      return;
    }

    recordMatch("written");
    if (!options.dryRun) {
      try {
        await writeMatch(sql, church.slug, best, ownerIdToClaim);
        await markSearched(sql, church.slug);
        summary.written += 1;
      } catch (error) {
        summary.errors += 1;
        if (summary.errors <= 10) {
          const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
          console.warn(`[write error ${summary.errors}] ${church.slug}: ${message}`);
        }
      }
    }
  });

  if (browser) await browser.close();

  matches.sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1));

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));

  if (options.auditSince) {
    const kept = matches.filter((m) => m.action === "kept");
    const removed = matches.filter((m) => m.action === "removed");

    console.log(`\nValidated automated matches (${kept.length}):`);
    for (const m of kept.slice(0, 30)) {
      console.log(`  ${m.best.score.toFixed(2)} [${m.best.type}] ${m.name} → ${m.best.label} | ${m.best.url}`);
    }
    if (kept.length > 30) console.log(`  ...and ${kept.length - 30} more`);

    console.log(`\nRemoved automated matches (${removed.length}):`);
    for (const m of removed.slice(0, 30)) {
      const result = m.best ? `${m.best.score.toFixed(2)} → ${m.best.label}` : "not in current top results";
      console.log(`  ${m.name} | ${result} | ${m.existingUrl}`);
    }
    if (removed.length > 30) console.log(`  ...and ${removed.length - 30} more`);
  } else if (options.revalidateLegacy) {
    const conflicts = matches.filter((m) => m.action === "conflict");
    const kept = matches.filter((m) => m.action === "kept");
    const unverified = matches.filter((m) => m.action === "unverified");

    console.log(`\nConflicts (${conflicts.length}) — kept existing URL; matcher found a different candidate:`);
    for (const m of conflicts.slice(0, 30)) {
      console.log(`  ${m.best.score.toFixed(2)} [${m.best.type}] ${m.name}`);
      console.log(`        existing:  ${m.existingUrl}`);
      console.log(`        candidate: ${m.best.url} (${m.best.label})`);
    }
    if (conflicts.length > 30) console.log(`  ...and ${conflicts.length - 30} more`);

    console.log(`\nUnverified (${unverified.length}) — kept existing URL; no candidate above threshold:`);
    for (const m of unverified.slice(0, 30)) {
      const top = m.best ? `${m.best.score.toFixed(2)} [${m.best.type}] → ${m.best.label}` : "(no candidate)";
      console.log(`  ${m.name}`);
      console.log(`        existing: ${m.existingUrl}`);
      console.log(`        top: ${top}`);
    }
    if (unverified.length > 30) console.log(`  ...and ${unverified.length - 30} more`);

    console.log(`\nKept (${kept.length}) — existing match validated by strict matcher:`);
    for (const m of kept.slice(0, 10)) {
      console.log(`  ${m.best.score.toFixed(2)} [${m.best.type}] ${m.name} | ${m.best.url}`);
    }
    if (kept.length > 10) console.log(`  ...and ${kept.length - 10} more`);
  } else {
    const kept = matches.filter((m) => m.action === "written");
    const rejected = matches.filter((m) => m.action === "rejected");
    const ownerConflicts = matches.filter((m) => m.action === "owner-conflict");

    console.log(`\nKept matches (${kept.length}):`);
    for (const m of kept.slice(0, 30)) {
      console.log(`  ${m.best.score.toFixed(2)} [${m.best.type}] ${m.name} → ${m.best.label} | ${m.best.url}`);
    }
    if (kept.length > 30) console.log(`  ...and ${kept.length - 30} more`);

    console.log(`\nOwner conflicts (${ownerConflicts.length}) — skipped without location evidence:`);
    for (const m of ownerConflicts.slice(0, 15)) {
      console.log(`  ${m.best.score.toFixed(2)} [${m.best.type}] ${m.name} → ${m.best.label}`);
    }
    if (ownerConflicts.length > 15) console.log(`  ...and ${ownerConflicts.length - 15} more`);

    console.log(`\nRejected / below threshold (${rejected.length}):`);
    for (const m of rejected.slice(0, 15)) {
      if (m.best) {
        console.log(`  ${m.best.score.toFixed(2)} [${m.best.type}] ${m.name} → ${m.best.label}`);
      } else {
        console.log(`  (no match)   ${m.name}`);
      }
    }
    if (rejected.length > 15) console.log(`  ...and ${rejected.length - 15} more`);
  }

  if (options.dryRun) console.log("\nDRY RUN — no DB writes performed.");
}

export { buildQuery, normalizeName, pickBestMatch, scorePlaylist };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
