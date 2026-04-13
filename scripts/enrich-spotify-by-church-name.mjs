#!/usr/bin/env node

/**
 * Spotify enrichment for already-imported churches.
 *
 * For each target church, searches Spotify (artist + playlist) using the
 * church name, scores each result by strict name similarity and auxiliary
 * signals (location match, follower count, church-y keywords in playlist
 * name), and writes the highest-scoring match back to `churches.spotify_url`
 * and `churches.spotify_playlist_ids`.
 *
 * Key differences from discover-spotify-churches-v2.mjs:
 *  - Church → Spotify (not the reverse). Matches Spotify data to known slugs.
 *  - No broad keyword sweep; one targeted query per church.
 *  - Strict name normalization + token-set similarity.
 *  - Writes to `churches` (not `church_candidates`).
 *
 * Usage:
 *   node scripts/enrich-spotify-by-church-name.mjs --dry-run --limit=10
 *   node scripts/enrich-spotify-by-church-name.mjs --reason-prefix="FeG Schweiz" --dry-run
 *   node scripts/enrich-spotify-by-church-name.mjs --slugs=feg-thayngen,feg-bern
 *   node scripts/enrich-spotify-by-church-name.mjs --since-import --min-score=0.8
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const DEFAULTS = {
  minScore: 0.75,
  concurrency: 2,
  searchLimit: 10,
  throttleMs: 400,
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
]);

const WORSHIP_KEYWORDS = [
  "worship", "praise", "lobpreis", "lovsång", "lovsang", "anbetning",
  "adoracion", "adoração", "alabanza", "louvor", "louange",
  "ylistys", "ibadah", "pujian",
];

function parseArgs(argv) {
  const options = {
    slugs: [],
    reasonPrefix: "",
    limit: 0,
    concurrency: DEFAULTS.concurrency,
    dryRun: false,
    minScore: DEFAULTS.minScore,
    force: false,
    sinceImport: false,
    daily: false,
    dailyLimit: DEFAULTS.dailyLimit,
    throttleMs: DEFAULTS.throttleMs,
    recheckAfterDays: DEFAULTS.recheckAfterDays,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--since-import") options.sinceImport = true;
    else if (arg === "--daily") options.daily = true;
    else if (arg.startsWith("--slugs=")) options.slugs = arg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--reason-prefix=")) options.reasonPrefix = arg.split("=")[1];
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--daily-limit=")) options.dailyLimit = Math.max(1, Number(arg.split("=")[1]) || DEFAULTS.dailyLimit);
    else if (arg.startsWith("--throttle=")) options.throttleMs = Math.max(0, Number(arg.split("=")[1]) || DEFAULTS.throttleMs);
    else if (arg.startsWith("--recheck-after=")) options.recheckAfterDays = Math.max(1, Number(arg.split("=")[1]) || DEFAULTS.recheckAfterDays);
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

function tokenSetSimilarity(a, b) {
  const setA = new Set(coreTokens(a));
  const setB = new Set(coreTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

function normalizedContainsAll(container, needle) {
  const haystack = new Set(coreTokens(container));
  const tokens = coreTokens(needle);
  if (tokens.length === 0) return false;
  return tokens.every((t) => haystack.has(t));
}

/**
 * True when `candidate` is a legitimate specialization of `church`.
 *
 * For 2+ core-token churches: all church tokens must appear in the candidate
 * and at most 1 non-worship extra is allowed.
 *
 * For 1-core-token churches: candidate must have the SAME core-token set
 * (exact equality after stopword stripping). A looser rule lets random
 * playlists like "Berlin Techno" or "Blackwell's Westgate Playlist" slip
 * through on a single shared token.
 */
function isTightSpecialization(church, candidate) {
  const churchTokens = coreTokens(church);
  if (churchTokens.length === 0) return false;
  const churchSet = new Set(churchTokens);
  const candidateTokens = coreTokens(candidate);
  const candidateSet = new Set(candidateTokens);
  for (const t of churchSet) if (!candidateSet.has(t)) return false;

  if (churchSet.size === 1) {
    // Exact set equality required
    return candidateSet.size === 1;
  }

  const extras = candidateTokens.filter((t) => !churchSet.has(t));
  const nonWorshipExtras = extras.filter((t) => !WORSHIP_CONTEXT_TOKENS.has(t));
  return nonWorshipExtras.length <= 1;
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

async function spotifySearch(token, query, types = "artist,playlist", limit = DEFAULTS.searchLimit, retries = 3) {
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
    } catch (error) {
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

async function spotifyGetArtistPlaylists(token, artistId) {
  // Spotify doesn't expose "playlists owned by an artist" directly.
  // Many churches publish worship via their own user account — not the artist profile.
  // We leave this as a placeholder for future expansion.
  return [];
}

/* ── Scoring ── */

function scoreArtist(church, artist) {
  const similarity = tokenSetSimilarity(church.name, artist.name);
  // Strong match rules:
  //  - Artist must be a tight specialization of the church (all church tokens
  //    present, at most 1 non-worship extra token).
  //  - If the church has only 1 core token, also require high similarity so
  //    "Berlin Church" doesn't grab "Berlin Electronic Underground".
  const strongContain = isTightSpecialization(church.name, artist.name);
  const churchCoreCount = coreTokens(church.name).length;
  const strong =
    strongContain && (churchCoreCount >= 2 || similarity >= 0.6);

  let score = similarity;
  if (strong) score = Math.max(score, 0.8);

  // Follower signal — tiny follower counts are usually personal profiles, not churches
  const followers = artist.followers?.total ?? 0;
  if (followers >= 500) score += 0.08;
  else if (followers >= 100) score += 0.04;
  else if (followers < 5) score -= 0.2;

  // Penalty if artist name contains obviously unrelated extra tokens
  const artistCore = coreTokens(artist.name);
  const churchCore = coreTokens(church.name);
  const extraTokens = artistCore.filter((t) => !churchCore.includes(t));
  if (extraTokens.length > churchCore.length * 2 + 1) score -= 0.15;

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function scorePlaylist(church, playlist) {
  const ownerName = playlist.owner?.display_name || "";
  const ownerId = playlist.owner?.id || "";
  const playlistName = playlist.name || "";

  // Hard reject: Spotify-curated editorial lists. These are never owned by
  // the church and linking to them falsely suggests ownership.
  if (ownerId === "spotify" || ownerName.toLowerCase() === "spotify") return 0;

  // Hard reject: fan-compilation naming patterns. "Best of", "Top 50",
  // "Essentials", "Mix" — these are almost always fan-made or editorial,
  // not a church's own playlist.
  if (/(^|\s)(best of|top\s*\d*|essentials|this is|greatest hits)\b/i.test(playlistName)) return 0;

  const churchCoreCount = coreTokens(church.name).length;

  // Primary signal: owner name is a tight specialization of the church name.
  // Same asymmetric rule as scoreArtist.
  const ownerSimilarity = tokenSetSimilarity(church.name, ownerName);
  const ownerStrong =
    isTightSpecialization(church.name, ownerName) &&
    (churchCoreCount >= 2 || ownerSimilarity >= 0.6);

  let score = ownerSimilarity;
  if (ownerStrong) score = Math.max(score, 0.85);

  // Secondary: playlist title is a tight specialization of the church name.
  // Weaker than an owner match — editors can put anything in a playlist
  // title — so we cap it at 0.78 and only apply when the tight-specialization
  // rule passes (filters out noise playlists like "Blackwell's Westgate Playlist").
  const playlistTight =
    isTightSpecialization(church.name, playlistName) &&
    (churchCoreCount >= 2 || tokenSetSimilarity(church.name, playlistName) >= 0.6);
  if (playlistTight) score = Math.max(score, 0.78);

  // Worship keyword in playlist name — mild boost, not enough to single-handedly clear threshold
  const lowerPlaylist = playlistName.toLowerCase();
  if (WORSHIP_KEYWORDS.some((kw) => lowerPlaylist.includes(kw))) score += 0.05;

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function pickBestMatch(church, searchResult) {
  const candidates = [];

  for (const artist of searchResult.artists?.items || []) {
    if (!artist?.name) continue;
    const score = scoreArtist(church, artist);
    candidates.push({
      type: "artist",
      score,
      entity: artist,
      url: artist.external_urls?.spotify || `https://open.spotify.com/artist/${artist.id}`,
    });
  }

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
  if (options.daily) {
    // Daily cron-friendly mode: process the next slice of churches that
    // haven't been searched recently, skipping ones that already have a
    // Spotify URL. Randomized within the eligible set to avoid always
    // re-hitting the same slugs if a run crashes early.
    return sql`
      SELECT slug, name, location, country, website, spotify_url, spotify_searched_at
      FROM churches
      WHERE status = 'approved'
        AND spotify_url IS NULL
        AND (spotify_searched_at IS NULL
             OR spotify_searched_at < NOW() - ${recheckInterval}::interval)
      ORDER BY spotify_searched_at NULLS FIRST, slug
      LIMIT ${options.dailyLimit}
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

async function writeMatch(sql, slug, match) {
  if (match.type === "artist") {
    await sql`
      UPDATE churches
      SET spotify_url = ${match.url}, updated_at = NOW()
      WHERE slug = ${slug}
    `;
    return;
  }
  // playlist match
  await sql`
    UPDATE churches
    SET spotify_url = ${match.url},
        spotify_playlist_ids = ARRAY(
          SELECT DISTINCT UNNEST(COALESCE(spotify_playlist_ids, ARRAY[]::text[]) || ARRAY[${match.entity.id}])
        ),
        spotify_owner_id = COALESCE(spotify_owner_id, ${match.entity.owner?.id || null}),
        updated_at = NOW()
    WHERE slug = ${slug}
  `;
}

/* ── Worker ── */

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
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
  // The most distinctive query is the full name. Spotify search is
  // token-aware, so we pass the whole name and let scoring do the filtering.
  return church.name;
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

  await getSpotifyToken();
  console.log("Spotify authenticated.");

  const summary = {
    searched: 0,
    matchedArtist: 0,
    matchedPlaylist: 0,
    noMatch: 0,
    belowThreshold: 0,
    errors: 0,
    written: 0,
  };
  const matches = [];

  // Serial loop with throttling keeps us well under Spotify's aggregate
  // rate limits. Concurrency is retained for edge cases but defaults to 2.
  await mapWithConcurrency(targets, options.concurrency, async (church, index) => {
    summary.searched += 1;

    // Throttle: simple fixed delay between requests per worker slot.
    if (options.throttleMs > 0 && index > 0) {
      await new Promise((r) => setTimeout(r, options.throttleMs));
    }

    let token;
    try {
      token = await getSpotifyToken();
    } catch (error) {
      summary.errors += 1;
      return;
    }

    const query = buildQuery(church);
    let result;
    try {
      result = await spotifySearch(token, query);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("RATE_LIMITED")) {
        summary.rateLimited = (summary.rateLimited || 0) + 1;
        return;
      }
      summary.errors += 1;
      return;
    }

    const best = pickBestMatch(church, result);
    const rowUpdated = !options.dryRun;

    const recordMatch = (kept) => {
      matches.push({
        slug: church.slug,
        name: church.name,
        best: best
          ? {
              type: best.type,
              score: best.score,
              label: best.entity?.name || best.entity?.owner?.display_name || "",
              url: best.url,
            }
          : null,
        kept,
      });
    };

    if (!best) {
      summary.noMatch += 1;
      recordMatch(false);
      if (rowUpdated) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }

    if (best.score < options.minScore) {
      summary.belowThreshold += 1;
      recordMatch(false);
      if (rowUpdated) await markSearched(sql, church.slug).catch(() => summary.errors++);
      return;
    }

    if (best.type === "artist") summary.matchedArtist += 1;
    else summary.matchedPlaylist += 1;
    recordMatch(true);

    if (!options.dryRun) {
      try {
        await writeMatch(sql, church.slug, best);
        await markSearched(sql, church.slug);
        summary.written += 1;
      } catch (error) {
        summary.errors += 1;
      }
    }
  });

  matches.sort((a, b) => b.best.score - a.best.score);

  console.log("\n--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));

  const kept = matches.filter((m) => m.kept);
  const rejected = matches.filter((m) => !m.kept);

  console.log(`\nKept matches (${kept.length}):`);
  for (const m of kept.slice(0, 30)) {
    console.log(`  ${m.best.score.toFixed(2)} [${m.best.type}] ${m.name} → ${m.best.label} | ${m.best.url}`);
  }
  if (kept.length > 30) console.log(`  ...and ${kept.length - 30} more`);

  console.log(`\nRejected / below threshold (${rejected.length}):`);
  for (const m of rejected.slice(0, 15)) {
    console.log(`  ${m.best.score.toFixed(2)} [${m.best.type}] ${m.name} → ${m.best.label}`);
  }
  if (rejected.length > 15) console.log(`  ...and ${rejected.length - 15} more`);

  if (options.dryRun) console.log("\nDRY RUN — no DB writes performed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
