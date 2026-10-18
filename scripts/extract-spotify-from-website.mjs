#!/usr/bin/env node

/**
 * Find a church's Spotify music by reading the church's own website.
 *
 * A Spotify link on the church's own site is the strongest ownership evidence
 * we can get: the church itself points visitors to it. The name-search matcher
 * (enrich-spotify-by-church-name.mjs) has saturated at well under one match a
 * day, while a recon of church sites showed ~4% link Spotify directly.
 *
 * For each approved church with a website and no music yet:
 *   1. Fetch the homepage; if it has no Spotify link, follow up to two
 *      same-site links that look like worship/music/media pages.
 *   2. Collect open.spotify.com playlist and artist links (embeds included).
 *      Podcasts/episodes are sermons, not music, and are ignored.
 *   3. Verify each candidate with the Spotify Web API. Playlists must exist
 *      and not be owned by Spotify itself (editorial lists would falsely
 *      suggest ownership). Playlists and artists must be recognisably the
 *      church's own (isChurchOwned) and never a widely linked worship artist.
 *   4. Write playlists to spotify_playlist_ids + spotify_url (first playlist),
 *      or the artist URL when the site links an artist and no playlist.
 *
 * Progress is kept in a local JSON file so a long run can stop and resume
 * without a schema change. Matches are also written to an audit file.
 *
 * Usage:
 *   node scripts/extract-spotify-from-website.mjs --dry-run --limit=200
 *   node scripts/extract-spotify-from-website.mjs --limit=5000 --concurrency=8
 *   node scripts/extract-spotify-from-website.mjs --slugs=foo,bar --dry-run
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_PLAYLISTS = 5;
const FETCH_TIMEOUT_MS = 8000;

// Hosts that are not the church's own site: a Spotify link there says nothing
// about the church.
const NOT_OWN_SITE = [
  "facebook.com", "instagram.com", "youtube.com", "twitter.com", "x.com", "tiktok.com",
  "google.com", "goo.gl", "yelp.com", "churchfinder.com", "yellowpages.com",
  "tripadvisor.com", "wikipedia.org", "gospelchannel.com", "playlist.church",
];

const SPOTIFY_RE = /https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(playlist|artist)\/([A-Za-z0-9]{22})/g;
const MUSIC_PAGE_RE = /(worship|music|listen|playlist|media|songs)/i;

function parseArgs(argv) {
  const options = {
    slugs: [],
    limit: 0,
    concurrency: 8,
    dryRun: false,
    progressPath: join(ROOT_DIR, "tmp", "spotify-site-progress.json"),
  };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("--slugs=")) options.slugs = arg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || 8);
    else if (arg.startsWith("--progress=")) options.progressPath = resolve(arg.split("=")[1]);
  }
  return options;
}

/* ── Pure helpers (tested) ── */

function siteHost(website) {
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isOwnSite(website) {
  const host = siteHost(website);
  if (!host) return false;
  return !NOT_OWN_SITE.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function extractSpotifyLinks(html) {
  const seen = new Set();
  const out = [];
  for (const match of String(html).matchAll(SPOTIFY_RE)) {
    const key = `${match[1]}:${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: match[1], id: match[2] });
  }
  return out;
}

function findMusicPageLinks(html, baseUrl, max = 2) {
  const base = new URL(baseUrl);
  const out = [];
  for (const match of String(html).matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, label] = match;
    if (!MUSIC_PAGE_RE.test(href) && !MUSIC_PAGE_RE.test(label.replace(/<[^>]+>/g, ""))) continue;
    let url;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    const clean = `${url.origin}${url.pathname}`;
    if (clean === `${base.origin}${base.pathname}` || out.includes(clean)) continue;
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

// The Spotify API no longer returns track counts or follower counts to this
// app, so a playlist is accepted when it exists and Spotify does not own it.
function acceptPlaylist(playlist) {
  if (!playlist?.id || !playlist.owner) return false;
  const ownerId = String(playlist.owner.id || "").toLowerCase();
  const ownerName = String(playlist.owner.display_name || "").toLowerCase();
  return ownerId !== "spotify" && ownerName !== "spotify";
}

// Words that say nothing about which church a playlist or artist belongs to.
const GENERIC_WORDS = new Set([
  "the", "of", "and", "a", "an", "at", "in", "on", "for", "to", "de", "la", "el", "los", "las", "da", "do",
  "worship", "music", "church", "band", "collective", "live", "ministries", "ministry", "community",
  "christian", "center", "centre", "fellowship", "chapel", "international", "family", "city", "new",
  "first", "global", "praise", "choir", "gospel", "official", "team", "youth", "kids", "sounds", "songs",
  "song", "records", "united", "baptist", "methodist", "pentecostal", "assembly", "assemblies", "god",
  "evangelical", "free", "st", "saint", "kirche", "iglesia", "eglise", "igreja", "kyrka", "campus", "inc",
  "playlist", "sunday", "spotify", "weekly", "weekend", "list",
]);

// Church-name words so common that sharing one proves nothing ("Calvary
// Christian Center" is not "Calvary Worship").
const COMMON_CHURCH_WORDS = new Set([
  "calvary", "grace", "victory", "hope", "faith", "trinity", "christ", "jesus", "lord", "holy", "word",
  "bible", "life",
]);

// Worship artists so widely linked that a church sharing a word with them
// (any "Bethel Baptist", any "Gateway Church") is not evidence they are its own.
const FAMOUS_ARTISTS = new Set([
  "bethel music", "hillsong worship", "hillsong united", "hillsong young free", "elevation worship",
  "maverick city music", "upperroom", "jesus culture", "passion", "gateway worship", "vertical worship",
  "planetshakers", "housefires", "life church worship", "red rocks worship", "north point worship",
  "cityalight", "sovereign grace music", "the belonging co", "kingdom city", "influence music",
  "seu worship", "phil wickham", "chris tomlin", "brandon lake", "matt redman", "matt papa",
  "keith kristyn getty", "getty music", "cece winans", "kari jobe", "lauren daigle",
]);
const FAMOUS_WORDS = new Set(["getty", "hillsong", "elevation", "maverick", "upperroom"]);

function wordsOf(name) {
  return String(name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/).filter(Boolean);
}

function hostOf(website) {
  try {
    return new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// A link on the church's site can still point at someone else's music (another
// church's playlist, a label, a famous songwriter). It only counts when the
// playlist/artist name or the playlist owner is recognisably the church's own:
// a distinctive word in common, two consecutive name words, the church's
// initials, or a distinctive word that is part of the church's own web host.
// A 520-match run audited at 85% precision before this rule, 45 dropped by it.
function isChurchOwned({ name, owner = "", type }, churchName, website = "") {
  const textWords = wordsOf(`${name} ${owner}`);
  if (type === "artist" && FAMOUS_ARTISTS.has(wordsOf(name).join(" "))) return false;
  const churchWords = wordsOf(churchName);
  if (textWords.some((w) => FAMOUS_WORDS.has(w)) && !churchWords.some((w) => FAMOUS_WORDS.has(w))) return false;

  const distinctive = new Set(
    churchWords.filter((w) => !GENERIC_WORDS.has(w) && !COMMON_CHURCH_WORDS.has(w) && w.length > 2),
  );
  if (textWords.some((w) => distinctive.has(w))) return true;

  const joined = ` ${textWords.join(" ")} `;
  for (let i = 0; i < churchWords.length - 1; i += 1) {
    const [x, y] = [churchWords[i], churchWords[i + 1]];
    if (GENERIC_WORDS.has(x) && GENERIC_WORDS.has(y)) continue;
    if (joined.includes(` ${x} ${y} `)) return true;
  }

  const stop = new Set(["of", "the", "and", "de", "la", "el"]);
  for (const seq of [churchWords, churchWords.filter((w) => !stop.has(w))]) {
    for (let k = seq.length; k >= 3; k -= 1) {
      const initials = seq.slice(0, k).map((w) => w[0]).join("");
      if (textWords.some((t) => t === initials || (t.length <= initials.length + 4 && t.startsWith(initials)))) return true;
    }
  }

  const host = hostOf(website);
  if (host && textWords.some((t) => t.length >= 4 && !GENERIC_WORDS.has(t) && !COMMON_CHURCH_WORDS.has(t) && host.includes(t))) {
    return true;
  }
  return [...distinctive].some((w) => w.length >= 5 && textWords.some((t) => t.includes(w)));
}

function acceptArtist(artistName, churchName, website = "") {
  return isChurchOwned({ name: artistName, type: "artist" }, churchName, website);
}

/* ── IO ── */

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
    });
    if (!res.ok) return null;
    return { html: (await res.text()).slice(0, 800_000), finalUrl: res.url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let spotifyToken = null;
let spotifyTokenExpires = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpires - 60_000) return spotifyToken;
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`);
  const data = await res.json();
  spotifyToken = data.access_token;
  spotifyTokenExpires = Date.now() + data.expires_in * 1000;
  return spotifyToken;
}

async function spotifyGet(path, attempt = 0) {
  const res = await fetch(`https://api.spotify.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${await getSpotifyToken()}` },
  });
  if (res.status === 429 && attempt < 4) {
    const wait = Number(res.headers.get("retry-after") || 5) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return spotifyGet(path, attempt + 1);
  }
  if (!res.ok) return null;
  return res.json();
}

async function verifyCandidates(candidates, churchName, website) {
  const playlists = [];
  let artist = null;
  for (const c of candidates) {
    if (c.type === "playlist" && playlists.length < MAX_PLAYLISTS) {
      const p = await spotifyGet(`playlists/${c.id}?fields=id,name,owner(id,display_name)`);
      if (acceptPlaylist(p) && isChurchOwned({ name: p.name, owner: p.owner.display_name, type: "playlist" }, churchName, website)) {
        playlists.push({ id: p.id, name: p.name, owner: p.owner.display_name });
      }
    } else if (c.type === "artist" && !artist) {
      const a = await spotifyGet(`artists/${c.id}`);
      if (a?.id && acceptArtist(a.name, churchName, website)) artist = { id: a.id, name: a.name };
    }
  }
  return { playlists, artist };
}

async function scanChurch(church) {
  const start = /^https?:\/\//i.test(church.website) ? church.website : `https://${church.website}`;
  const home = await fetchText(start);
  if (!home) return { status: "unreachable" };
  let candidates = extractSpotifyLinks(home.html);
  if (candidates.length === 0) {
    for (const url of findMusicPageLinks(home.html, home.finalUrl)) {
      const page = await fetchText(url);
      if (page) candidates = candidates.concat(extractSpotifyLinks(page.html));
      if (candidates.length > 0) break;
    }
  }
  if (candidates.length === 0) return { status: "none" };
  const verified = await verifyCandidates(candidates, church.name, church.website);
  if (verified.playlists.length === 0 && !verified.artist) return { status: "rejected", candidates };
  return { status: "match", ...verified };
}

async function writeMatch(sql, slug, result) {
  if (result.playlists.length > 0) {
    const ids = result.playlists.map((p) => p.id);
    await sql`
      UPDATE churches
      SET spotify_url = ${`https://open.spotify.com/playlist/${ids[0]}`},
          spotify_playlist_ids = ARRAY(
            SELECT DISTINCT UNNEST(COALESCE(spotify_playlist_ids, ARRAY[]::text[]) || ${ids}::text[])
          ),
          updated_at = NOW()
      WHERE slug = ${slug} AND spotify_url IS NULL
    `;
  } else {
    await sql`
      UPDATE churches
      SET spotify_url = ${`https://open.spotify.com/artist/${result.artist.id}`}, updated_at = NOW()
      WHERE slug = ${slug} AND spotify_url IS NULL
    `;
  }
}

function loadProgress(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) throw new Error("Missing Spotify credentials");
  const sql = neon(DATABASE_URL);

  mkdirSync(dirname(options.progressPath), { recursive: true });
  const progress = loadProgress(options.progressPath);

  const rows = options.slugs.length > 0
    ? await sql`SELECT slug, name, website FROM churches WHERE slug = ANY(${options.slugs})`
    : await sql`
        SELECT slug, name, website FROM churches
        WHERE status = 'approved'
          AND website IS NOT NULL AND website <> ''
          AND spotify_url IS NULL
          AND COALESCE(array_length(spotify_playlist_ids, 1), 0) = 0
        ORDER BY display_score DESC NULLS LAST, slug
      `;
  const queue = rows
    .filter((r) => options.slugs.length > 0 || !progress[r.slug])
    .filter((r) => isOwnSite(r.website))
    .slice(0, options.limit > 0 ? options.limit : undefined);

  console.log(`${rows.length} candidates, ${queue.length} to scan${options.dryRun ? " (dry run)" : ""}`);
  const counts = { match: 0, none: 0, rejected: 0, unreachable: 0, error: 0 };
  const matches = [];
  let done = 0;

  async function worker() {
    while (queue.length > 0) {
      const church = queue.shift();
      let result;
      try {
        result = await scanChurch(church);
      } catch (error) {
        result = { status: "error", error: String(error?.message || error) };
      }
      counts[result.status] = (counts[result.status] || 0) + 1;
      if (result.status === "match") {
        matches.push({ slug: church.slug, name: church.name, website: church.website, playlists: result.playlists, artist: result.artist });
        if (!options.dryRun) await writeMatch(sql, church.slug, result);
      }
      if (!options.dryRun) progress[church.slug] = { status: result.status, at: new Date().toISOString() };
      done += 1;
      if (done % 100 === 0) {
        console.log(`${done} scanned · ${JSON.stringify(counts)}`);
        if (!options.dryRun) writeFileSync(options.progressPath, JSON.stringify(progress));
      }
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, worker));
  if (!options.dryRun) writeFileSync(options.progressPath, JSON.stringify(progress));
  const auditPath = join(ROOT_DIR, "tmp", `spotify-site-matches-${new Date().toISOString().slice(0, 10)}${options.dryRun ? "-dry" : ""}.json`);
  writeFileSync(auditPath, JSON.stringify(matches, null, 1));
  console.log(`\n--- Summary ---\n${JSON.stringify(counts, null, 2)}\nMatches written to ${auditPath}`);
}

export { acceptArtist, acceptPlaylist, isChurchOwned, extractSpotifyLinks, findMusicPageLinks, isOwnSite, siteHost };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
