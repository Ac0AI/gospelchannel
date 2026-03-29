#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";
import {
  absoluteUrl,
  extractEmailsFromHtml,
  extractLinks,
  extractLocationFromText,
  extractPlainText,
  extractJsonLdNames,
  extractHeadingText,
  findLikelyHeroImage,
  keywordOverlapScore,
  normalizeHost,
  parseCanonicalUrl,
  parseMetaContent,
  parseTitleFromHtml,
  scoreWebsiteSignals,
  uniqueStrings,
} from "./lib/church-quality.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const OUTPUT_PATH = join(ROOT_DIR, "src", "data", "cache", "church-candidate-screening.json");
const DEFAULT_CONCURRENCY = 6;
const EXTRA_EMAIL_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/connect",
  "/visit",
  "/new-here",
  "/staff",
  "/team",
  "/om",
  "/kontakt",
];

const COUNTRY_CITY_LOOKUP = {
  Sweden: ["Stockholm", "Göteborg", "Malmö", "Uppsala", "Jönköping", "Örebro", "Linköping", "Västerås", "Norrköping", "Umeå", "Lund", "Borås"],
  "United Kingdom": ["London", "Birmingham", "Manchester", "Bristol", "Leeds", "Glasgow", "Edinburgh", "Liverpool", "Sheffield", "Nottingham", "Cardiff", "Belfast"],
  Germany: ["Berlin", "Hamburg", "Cologne", "Munich", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig", "Dresden", "Hannover", "Nürnberg", "Bremen"],
  France: ["Paris", "Lyon", "Marseille", "Lille", "Toulouse", "Strasbourg", "Bordeaux", "Nantes", "Nice", "Montpellier", "Rennes", "Grenoble"],
  Switzerland: ["Zurich", "Geneva", "Basel", "Lausanne", "Bern", "Lucerne", "St. Gallen", "Winterthur", "Lugano", "Thun"],
  Norway: ["Oslo", "Bergen", "Stavanger", "Trondheim", "Kristiansand", "Drammen", "Fredrikstad", "Tromsø", "Sandnes", "Bodø"],
  Denmark: ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle", "Roskilde"],
  Finland: ["Helsinki", "Espoo", "Tampere", "Turku", "Oulu", "Vantaa", "Jyväskylä", "Kuopio", "Lahti", "Rovaniemi"],
  Spain: ["Madrid", "Barcelona", "Valencia", "Málaga", "Sevilla", "Bilbao", "Zaragoza", "Murcia", "Palma", "Las Palmas", "Alicante", "Granada"],
  Brazil: ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Recife", "Porto Alegre", "Brasília", "Salvador", "Fortaleza", "Manaus", "Goiânia", "Campinas"],
  Philippines: ["Manila", "Quezon City", "Cebu", "Davao", "Pasig", "Makati", "Taguig", "Cagayan de Oro", "Iloilo", "Bacolod"],
  Nigeria: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu", "Benin City", "Kano", "Kaduna", "Jos", "Calabar", "Uyo", "Owerri"],
};

function parseArgs(argv) {
  const options = {
    statuses: ["pending", "approved"],
    limit: 0,
    preview: false,
    concurrency: DEFAULT_CONCURRENCY,
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg.startsWith("--statuses=")) {
      options.statuses = arg
        .split("=")[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = Math.max(1, Number(arg.split("=")[1]) || DEFAULT_CONCURRENCY);
    }
  }

  return options;
}

async function fetchPage(url, timeoutMs = 12000) {
  if (!url) {
    return { html: "", finalUrl: "", ok: false, status: 0 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
      redirect: "follow",
    });
    const html = response.ok ? await response.text() : "";
    return {
      html,
      finalUrl: response.url || url,
      ok: response.ok,
      status: response.status,
    };
  } catch {
    return { html: "", finalUrl: url, ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function cleanLocation(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function detectLocation(candidate, pageText, pageTitle) {
  const preset = cleanLocation(candidate.location || "");
  if (preset) return preset;

  const cities = COUNTRY_CITY_LOOKUP[candidate.country || ""] || [];
  return extractLocationFromText(`${pageTitle} ${pageText}`, cities);
}

function scorePlaylistMatch(candidateName, playlist) {
  const fields = [playlist.name, playlist.owner, playlist.description].filter(Boolean).join(" ");
  const overlap = keywordOverlapScore(candidateName, fields);
  let score = overlap * 0.72;

  if (playlist.owner && keywordOverlapScore(candidateName, playlist.owner) > 0.4) score += 0.14;
  if (/church|worship|gospel|praise|jesus|faith|christian/i.test(fields)) score += 0.12;
  if (/top songs|favorites|best of/i.test(playlist.name || "")) score -= 0.08;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

let spotifyTokenCache = { token: "", expiresAt: 0 };

async function getSpotifyToken() {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return "";
  }

  if (spotifyTokenCache.token && Date.now() < spotifyTokenCache.expiresAt) {
    return spotifyTokenCache.token;
  }

  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    return "";
  }

  const json = await response.json();
  spotifyTokenCache = {
    token: json.access_token || "",
    expiresAt: Date.now() + Math.max(60, Number(json.expires_in || 3600) - 120) * 1000,
  };
  return spotifyTokenCache.token;
}

async function fetchSpotifyPlaylist(playlistId) {
  const token = await getSpotifyToken();
  if (!token) {
    return null;
  }

  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=id,name,description,external_urls,owner(display_name,id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function buildVerdict({ websiteScore, flags, keptPlaylists, hasWebsite }) {
  const hasStrongPlaylist = keptPlaylists.some((playlist) => playlist.score >= 0.6);
  const fatalFlags = ["blocked_host", "generic_title", "sentence_title", "non_church_page"];

  if (flags.some((flag) => fatalFlags.includes(flag)) && websiteScore < 0.6) {
    return "non_church";
  }

  if (!hasWebsite) {
    return keptPlaylists.length > 0 ? "playlist_found_needs_church_review" : "unclear";
  }

  if (websiteScore >= 0.72 && hasStrongPlaylist) {
    return "verified_church_with_playlist";
  }

  if (websiteScore >= 0.72) {
    return "verified_church_needs_playlist";
  }

  if (websiteScore >= 0.5 && keptPlaylists.length > 0) {
    return "playlist_found_needs_church_review";
  }

  if (websiteScore >= 0.4) {
    return "weak_church_signal";
  }

  return "unclear";
}

function buildNotes({ websiteScore, flags, emails, socialLinks, playlistCount }) {
  const parts = [`Website ${Math.round(websiteScore * 100)}%`];

  if (flags.length > 0) {
    parts.push(`Flags: ${flags.join(", ")}`);
  }

  if (emails[0]) {
    parts.push(`Email: ${emails[0]}`);
  }

  if (playlistCount > 0) {
    parts.push(`Playlists: ${playlistCount}`);
  }

  if (socialLinks.spotify[0]) {
    parts.push("Spotify link found on website");
  }

  if (socialLinks.youtube[0]) {
    parts.push("YouTube link found on website");
  }

  return parts.join(" | ");
}

async function screenCandidate(candidate) {
  const homepage = await fetchPage(candidate.website || "");
  const canonicalUrl = homepage.html ? parseCanonicalUrl(homepage.html, homepage.finalUrl || candidate.website || "") : "";
  const primaryUrl = canonicalUrl || homepage.finalUrl || candidate.website || "";
  const extraPages = primaryUrl
    ? await Promise.all(EXTRA_EMAIL_PATHS.map((path) => fetchPage(absoluteUrl(path, primaryUrl))))
    : [];

  const title =
    parseMetaContent(homepage.html, "property", "og:title")
    || parseMetaContent(homepage.html, "name", "og:title")
    || parseTitleFromHtml(homepage.html);

  const description =
    parseMetaContent(homepage.html, "property", "og:description")
    || parseMetaContent(homepage.html, "name", "description");
  const nameCandidates = uniqueStrings([
    parseMetaContent(homepage.html, "property", "og:site_name"),
    parseMetaContent(homepage.html, "name", "application-name"),
    ...extractHeadingText(homepage.html, "h1"),
    ...extractJsonLdNames(homepage.html),
  ]);

  const pageText = extractPlainText([homepage.html, ...extraPages.map((page) => page.html)].join(" "));
  const location = detectLocation(candidate, pageText, title);
  const emails = uniqueStrings([
    ...extractEmailsFromHtml(homepage.html, normalizeHost(primaryUrl)),
    ...extraPages.flatMap((page) => extractEmailsFromHtml(page.html, normalizeHost(primaryUrl))),
  ]);
  const headerImageUrl = findLikelyHeroImage(homepage.html, primaryUrl);
  const socialLinks = {
    spotify: extractLinks(homepage.html, [/spotify\.com/i]).map((url) => absoluteUrl(url, primaryUrl)),
    youtube: extractLinks(homepage.html, [/youtube\.com/i]).map((url) => absoluteUrl(url, primaryUrl)),
    instagram: extractLinks(homepage.html, [/instagram\.com/i]).map((url) => absoluteUrl(url, primaryUrl)),
  };

  const websiteReview = scoreWebsiteSignals({
    candidateName: candidate.name,
    pageTitle: title,
    nameCandidates,
    pageText: `${description} ${pageText}`,
    finalUrl: primaryUrl,
    emails,
    location,
    headerImageUrl,
  });

  const playlists = await Promise.all(
    (candidate.spotify_playlist_ids || []).slice(0, 6).map(async (playlistId) => {
      const playlist = await fetchSpotifyPlaylist(playlistId);
      if (!playlist) {
        return {
          id: playlistId,
          name: playlistId,
          owner: "",
          description: "",
          url: `https://open.spotify.com/playlist/${playlistId}`,
          score: 0,
        };
      }

      return {
        id: playlist.id || playlistId,
        name: playlist.name || playlistId,
        owner: playlist.owner?.display_name || playlist.owner?.id || "",
        description: playlist.description || "",
        url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlistId}`,
        score: scorePlaylistMatch(websiteReview.betterName || candidate.name, {
          name: playlist.name || "",
          owner: playlist.owner?.display_name || playlist.owner?.id || "",
          description: playlist.description || "",
        }),
      };
    })
  );

  const keptPlaylists = playlists.filter((playlist) => playlist.score >= 0.32);
  const verdict = buildVerdict({
    websiteScore: websiteReview.score,
    flags: websiteReview.flags,
    keptPlaylists,
    hasWebsite: Boolean(primaryUrl),
  });

  return {
    id: candidate.id,
    name: websiteReview.betterName || candidate.name,
    source: candidate.source,
    status: candidate.status,
    website_input_url: candidate.website || "",
    website_final_url: primaryUrl,
    website_title: title,
    website_description: description,
    website_emails: emails,
    website_church_score: Number(websiteReview.score.toFixed(2)),
    quality_flags: websiteReview.flags,
    location: location || candidate.location || "",
    country: candidate.country || "",
    header_image_url: headerImageUrl,
    social_spotify_urls: socialLinks.spotify,
    social_youtube_urls: socialLinks.youtube,
    social_instagram_urls: socialLinks.instagram,
    verified_playlist_count: keptPlaylists.length,
    verified_playlists: keptPlaylists.sort((left, right) => right.score - left.score),
    notes: buildNotes({
      websiteScore: websiteReview.score,
      flags: websiteReview.flags,
      emails,
      socialLinks,
      playlistCount: keptPlaylists.length,
    }),
    verdict,
  };
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let query = supabase
    .from("church_candidates")
    .select("id,name,website,contact_email,location,country,confidence,reason,discovered_at,source,status,spotify_playlist_ids")
    .in("status", options.statuses)
    .order("discovered_at", { ascending: false });

  if (options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = await mapWithConcurrency(data ?? [], options.concurrency, screenCandidate);
  const sortedRows = rows.sort((left, right) => {
    const verdictOrder = new Map([
      ["verified_church_with_playlist", 0],
      ["verified_church_needs_playlist", 1],
      ["playlist_found_needs_church_review", 2],
      ["weak_church_signal", 3],
      ["unclear", 4],
      ["non_church", 5],
    ]);

    const leftRank = verdictOrder.get(left.verdict) ?? 99;
    const rightRank = verdictOrder.get(right.verdict) ?? 99;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return right.website_church_score - left.website_church_score;
  });

  const counts = sortedRows.reduce((acc, row) => {
    acc[row.verdict] = (acc[row.verdict] || 0) + 1;
    return acc;
  }, {});

  console.log(`Screened ${sortedRows.length} candidates`);
  console.log(JSON.stringify(counts, null, 2));
  console.log(
    JSON.stringify(
      sortedRows.slice(0, 12).map((row) => ({
        name: row.name,
        verdict: row.verdict,
        score: row.website_church_score,
        flags: row.quality_flags,
        website: row.website_final_url,
        headerImage: Boolean(row.header_image_url),
      })),
      null,
      2
    )
  );

  if (options.preview) {
    console.log("Preview mode: no file written.");
    return;
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(sortedRows, null, 2)}\n`, "utf8");
  console.log(`Saved ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
