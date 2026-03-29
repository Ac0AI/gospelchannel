#!/usr/bin/env node

import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";
import { mapWithConcurrency } from "./lib/enrichment/rate-limiter.mjs";
import { normalizeHost } from "./lib/church-intake-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SCREENING_PATH = join(ROOT_DIR, "src", "data", "cache", "church-candidate-screening.json");
const PAGE_SIZE = 1000;
const DEEP_PAGE_LIMIT = 5;
const INTERNAL_PATH_HINTS = [
  "/about", "/about-us", "/contact", "/connect", "/visit", "/new", "/im-new",
  "/service", "/services", "/times", "/plan", "/community", "/worship",
];
const EUROPE_COUNTRIES = new Set([
  "Albania","Andorra","Armenia","Austria","Azerbaijan","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic",
  "Denmark","Estonia","Finland","France","Georgia","Germany","Greece","Hungary","Iceland","Ireland","Italy",
  "Latvia","Lithuania","Luxembourg","Macedonia","Malta","Moldova","Monaco","Netherlands","Norway","Poland",
  "Portugal","Romania","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Turkey","Ukraine","United Kingdom",
]);
const GENERIC_TOKENS = new Set([
  "church","churches","worship","ministries","ministry","official","tv","live","community","center","centre",
  "iglesia","eglise","kirche","kyrka","kyrkan","gemeinde","kirken","seurakunta","parroquia",
]);

function parseArgs(argv) {
  const options = {
    preview: false,
    limit: 0,
    concurrency: 8,
    region: "europe",
    status: "approved",
  };

  for (const arg of argv) {
    if (arg === "--preview") options.preview = true;
    else if (arg.startsWith("--limit=")) options.limit = Math.max(0, Number(arg.split("=")[1]) || 0);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Math.max(1, Number(arg.split("=")[1]) || 8);
    else if (arg.startsWith("--region=")) options.region = arg.split("=")[1] || "europe";
    else if (arg.startsWith("--status=")) options.status = arg.split("=")[1] || "approved";
  }

  return options;
}

function matchesRegion(country, region) {
  if (region !== "europe") return true;
  return EUROPE_COUNTRIES.has(country);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function fetchHtml(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GospelChannelBot/1.0)" },
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function absolutize(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractLinksFromHtml(html, baseUrl) {
  return [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absolutize(match[1], baseUrl))
    .filter(Boolean);
}

function normalizeFacebookUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.facebook.com");
    if (!/facebook\.com$/i.test(parsed.hostname) && !/\.facebook\.com$/i.test(parsed.hostname)) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    const root = parts[0].toLowerCase();
    if (["share.php", "sharer.php", "dialog", "plugins", "photo.php", "watch", "reel", "reels", "stories"].includes(root)) {
      return "";
    }
    if (root === "profile.php") {
      const id = parsed.searchParams.get("id");
      return id ? `https://www.facebook.com/profile.php?id=${id}` : "";
    }
    return `https://www.facebook.com/${parts.join("/")}`;
  } catch {
    return "";
  }
}

function normalizeInstagramUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.instagram.com");
    if (!/instagram\.com$/i.test(parsed.hostname) && !/\.instagram\.com$/i.test(parsed.hostname)) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    const username = parts[0].replace(/^@/, "");
    if (!username) return "";
    if (["p", "reel", "reels", "stories", "explore", "tv", "accounts"].includes(username.toLowerCase())) return "";
    return `https://www.instagram.com/${username}/`;
  } catch {
    return "";
  }
}

function normalizeYouTubeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") return "";
    if (!host.endsWith("youtube.com")) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    const first = parts[0];
    if (first.startsWith("@")) return `https://www.youtube.com/${first}`;
    if (first.toLowerCase() === "channel" && /^UC[A-Za-z0-9_-]{20,}$/i.test(parts[1] || "")) {
      return `https://www.youtube.com/${first}/${parts[1]}`;
    }
    if (["user", "c"].includes(first.toLowerCase()) && parts[1]) {
      return `https://www.youtube.com/${first}/${parts[1]}`;
    }
    if (parts.length === 1 && !["watch", "playlist", "results", "feed", "shorts", "embed", "live", "channel", "user", "c"].includes(first.toLowerCase())) {
      return `https://www.youtube.com/${first}`;
    }
  } catch {
    return "";
  }
  return "";
}

function extractDirectYouTubeChannelId(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, "https://www.youtube.com");
    const match = parsed.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{20,})$/i);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

async function resolveYouTubeChannelId(youtubeUrl) {
  if (!youtubeUrl) return "";
  const verifyCandidate = async (candidate) => {
    if (!candidate) return "";
    if (!process.env.YOUTUBE_API_KEY) return candidate;
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&id=${encodeURIComponent(candidate)}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return json.items?.[0]?.id || "";
    } catch {
      return "";
    }
  };

  const direct = await verifyCandidate(extractDirectYouTubeChannelId(youtubeUrl));
  if (direct) return direct;

  const html = await fetchHtml(youtubeUrl, 12000);
  if (html) {
    const patterns = [
      /"channelId":"(UC[A-Za-z0-9_-]{20,})"/,
      /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{20,})["']/i,
      /https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      const verified = await verifyCandidate(match?.[1] || "");
      if (verified) return verified;
    }
  }

  if (!process.env.YOUTUBE_API_KEY) return "";

  try {
    const parsed = new URL(youtubeUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("@")) {
      const handle = parts[0].slice(1);
      if (!handle) return "";
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return await verifyCandidate(json.items?.[0]?.id || "");
    }
    if (parts[0] === "user" && parts[1]) {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${encodeURIComponent(parts[1])}&key=${process.env.YOUTUBE_API_KEY}`);
      if (!response.ok) return "";
      const json = await response.json();
      return await verifyCandidate(json.items?.[0]?.id || "");
    }
  } catch {
    return "";
  }

  return "";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getChurchTokens(church) {
  return new Set(
    [church.slug, church.name]
      .flatMap((value) => normalizeText(value).split(" "))
      .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token)),
  );
}

function getChurchAliases(church) {
  return new Set(
    [church.slug, church.name]
      .map((value) => compactText(value))
      .filter((value) => value.length >= 6),
  );
}

function getScreeningTokens(screening) {
  return new Set(
    [screening?.location, screening?.country]
      .flatMap((value) => normalizeText(value).split(" "))
      .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token)),
  );
}

function getReadableSocialHandle(url, platform) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (platform === "facebook") {
      return parts[0] || "";
    }
    if (platform === "instagram") return parts[0] || "";
    if (platform === "youtube") {
      if (parts[0]?.startsWith("@")) return parts[0].slice(1);
      if (parts[0] === "c" || parts[0] === "user") return parts[1] || "";
      if (parts[0] === "channel") return "";
      return parts[0] || "";
    }
  } catch {
    return "";
  }
  return "";
}

function getTokenMatches(text, tokens) {
  if (!text || tokens.size === 0) return [];
  return [...tokens].filter((token) => text.includes(token));
}

function scoreSocialCandidate(url, church, screening, platform) {
  const parsed = new URL(url);
  const rawHandle = getReadableSocialHandle(url, platform);
  const readableHandle = normalizeText(rawHandle);
  const compactHandle = compactText(rawHandle);

  if (platform === "youtube" && church.youtube_channel_id) {
    const officialPath = `/channel/${church.youtube_channel_id}`.toLowerCase();
    if (parsed.pathname.toLowerCase() === officialPath) {
      return { accepted: true, score: 100 };
    }
  }

  if (!readableHandle) return { accepted: false, score: 0 };

  const churchTokens = getChurchTokens(church);
  if (churchTokens.size === 0) return { accepted: false, score: 0 };

  const screeningTokens = getScreeningTokens(screening);
  const aliasMatches = [...getChurchAliases(church)].filter((alias) =>
    compactHandle === alias || compactHandle.includes(alias),
  );
  const churchMatches = getTokenMatches(readableHandle, churchTokens);
  const screeningMatches = getTokenMatches(readableHandle, screeningTokens);
  const longChurchMatches = churchMatches.filter((token) => token.length >= 5);
  const locationMatches = screeningMatches.filter((token) => token === normalizeText(screening?.location));
  const score =
    (aliasMatches.length * 8) +
    (churchMatches.length * 3) +
    (longChurchMatches.length * 2) +
    (locationMatches.length * 3) +
    (screeningMatches.length * 1.5);

  const exactAlias = aliasMatches.some((alias) => compactHandle === alias);
  const strongAlias = aliasMatches.some((alias) => alias.length >= 8);
  const accepted =
    exactAlias ||
    strongAlias ||
    churchMatches.length >= 2 ||
    (longChurchMatches.length >= 1 && churchMatches.length >= 1) ||
    (churchMatches.length >= 1 && locationMatches.length >= 1);

  if (platform === "facebook") return { accepted: accepted && score >= 6, score };
  if (platform === "instagram") return { accepted: accepted && score >= 7, score };
  if (platform === "youtube") return { accepted: accepted && score >= 6, score };
  return { accepted, score };
}

function normalizeSocialUrl(value, platform) {
  if (platform === "facebook") return normalizeFacebookUrl(value);
  if (platform === "instagram") return normalizeInstagramUrl(value);
  if (platform === "youtube") return normalizeYouTubeUrl(value);
  return "";
}

function pickBestCandidate(values, church, screening, platform) {
  let best = null;
  for (const value of values) {
    const normalized = normalizeSocialUrl(value, platform);
    if (!normalized) continue;
    const assessment = scoreSocialCandidate(normalized, church, screening, platform);
    if (!assessment.accepted) continue;
    if (!best || assessment.score > best.score) {
      best = { url: normalized, score: assessment.score };
    }
  }
  return best;
}

function chooseDeepLinks(homepageHtml, website) {
  const baseHost = normalizeHost(website);
  const unique = new Set([website]);
  for (const link of extractLinksFromHtml(homepageHtml, website)) {
    if (normalizeHost(link) !== baseHost) continue;
    const lower = link.toLowerCase();
    if (INTERNAL_PATH_HINTS.some((hint) => lower.includes(hint))) {
      unique.add(link);
    }
    if (unique.size >= DEEP_PAGE_LIMIT) break;
  }
  return [...unique].slice(0, DEEP_PAGE_LIMIT);
}

async function extractDeepSocials(website, church, screening) {
  const homepageHtml = await fetchHtml(website);
  if (!homepageHtml) return { facebook: "", instagram: "", youtube: "" };

  const deepLinks = chooseDeepLinks(homepageHtml, website);
  const pages = [homepageHtml];
  const extraLinks = deepLinks.slice(1);
  if (extraLinks.length > 0) {
    const extras = await Promise.all(extraLinks.map((url) => fetchHtml(url)));
    pages.push(...extras.filter(Boolean));
  }

  const links = pages.flatMap((html, index) => extractLinksFromHtml(html, index === 0 ? website : extraLinks[index - 1] || website));
  return {
    facebook: pickBestCandidate(links, church, screening, "facebook")?.url || "",
    instagram: pickBestCandidate(links, church, screening, "instagram")?.url || "",
    youtube: pickBestCandidate(links, church, screening, "youtube")?.url || "",
  };
}

async function loadChurches(supabase, region, statuses) {
  const rows = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("churches")
      .select("slug,name,website,country,location,status,youtube_channel_id")
      .range(from, from + PAGE_SIZE - 1);
    if (statuses.length === 1) query = query.eq("status", statuses[0]);
    else query = query.in("status", statuses);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load churches: ${error.message}`);
    rows.push(...(data || []).filter((row) => matchesRegion(row.country, region)));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function loadEnrichments(supabase, slugs) {
  const map = new Map();
  for (let index = 0; index < slugs.length; index += 200) {
    const batch = slugs.slice(index, index + 200);
    const { data, error } = await supabase
      .from("church_enrichments")
      .select("church_slug,facebook_url,instagram_url,youtube_url")
      .in("church_slug", batch);
    if (error) throw new Error(`Failed to load enrichments: ${error.message}`);
    for (const row of data || []) map.set(row.church_slug, row);
  }
  return map;
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const options = parseArgs(process.argv.slice(2));
  const statuses = String(options.status || "approved")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const churches = await loadChurches(supabase, options.region, statuses);
  const enrichments = await loadEnrichments(supabase, churches.map((church) => church.slug));
  const screeningRows = readJson(SCREENING_PATH, []);
  const screeningBySlug = new Map(screeningRows.map((row) => [row.slug, row]));
  const candidates = churches.map((church) => {
    const enrichment = enrichments.get(church.slug);
    const screening = screeningBySlug.get(church.slug);
    const hasYoutube = Boolean(normalizeYouTubeUrl(enrichment?.youtube_url || ""));
    const missingFacebook = !enrichment?.facebook_url;
    const missingInstagram = !enrichment?.instagram_url;
    const missingYoutube = !hasYoutube;
    const needsChannelId = hasYoutube && !church.youtube_channel_id;
    const instagramCandidates = splitList(screening?.social_instagram_urls);
    const youtubeCandidates = splitList(screening?.social_youtube_urls);

    let potentialScore = 0;
    if (missingInstagram && instagramCandidates.length > 0) potentialScore += 4;
    if (missingYoutube && youtubeCandidates.length > 0) potentialScore += 4;
    if ((missingFacebook || missingInstagram || missingYoutube) && church.website) potentialScore += 2;
    if (needsChannelId) potentialScore += 2;

    return {
      ...church,
      potentialScore,
      missingFacebook,
      missingInstagram,
      missingYoutube,
      needsChannelId,
    };
  }).filter((church) =>
    church.potentialScore > 0 && (church.missingFacebook || church.missingInstagram || church.missingYoutube || church.needsChannelId)
  ).sort((a, b) => b.potentialScore - a.potentialScore || a.name.localeCompare(b.name));

  const queue = options.limit > 0 ? candidates.slice(0, options.limit) : candidates;

  console.log(`Second-wave social candidates: ${queue.length}`);

  const results = await mapWithConcurrency(queue, options.concurrency, async (church) => {
    const enrichment = enrichments.get(church.slug) || {};
    const screening = screeningBySlug.get(church.slug);

    let facebookUrl = enrichment.facebook_url || "";
    let instagramUrl = enrichment.instagram_url || "";
    let youtubeUrl = normalizeYouTubeUrl(enrichment.youtube_url || "");
    const sources = [];

    if (!instagramUrl && screening) {
      const best = pickBestCandidate(splitList(screening.social_instagram_urls), church, screening, "instagram");
      if (best?.url) {
        instagramUrl = best.url;
        sources.push("screening_instagram");
      }
    }

    if (!youtubeUrl && screening) {
      const best = pickBestCandidate(splitList(screening.social_youtube_urls), church, screening, "youtube");
      if (best?.url) {
        youtubeUrl = best.url;
        sources.push("screening_youtube");
      }
    }

    if ((!facebookUrl || !instagramUrl || !youtubeUrl) && church.website) {
      const deep = await extractDeepSocials(church.website, church, screening);
      if (!facebookUrl && deep.facebook) {
        facebookUrl = deep.facebook;
        sources.push("deepcrawl_facebook");
      }
      if (!instagramUrl && deep.instagram) {
        instagramUrl = deep.instagram;
        sources.push("deepcrawl_instagram");
      }
      if (!youtubeUrl && deep.youtube) {
        youtubeUrl = deep.youtube;
        sources.push("deepcrawl_youtube");
      }
    }

    const youtubeChannelId = youtubeUrl && !church.youtube_channel_id
      ? await resolveYouTubeChannelId(youtubeUrl)
      : "";

    const update = {
      church_slug: church.slug,
      ...(facebookUrl ? { facebook_url: facebookUrl } : {}),
      ...(instagramUrl ? { instagram_url: instagramUrl } : {}),
      ...(youtubeUrl ? { youtube_url: youtubeUrl } : {}),
    };

    const changedFields = Object.keys(update).filter((key) => key !== "church_slug" && enrichment[key] !== update[key]);
    if (changedFields.length === 0 && !youtubeChannelId) {
      return { slug: church.slug, updated: false, reason: "no_new_fields" };
    }

    if (!options.preview) {
      if (changedFields.length > 0) {
        const { error } = await supabase
          .from("church_enrichments")
          .upsert(update, { onConflict: "church_slug" });
        if (error) throw new Error(`Failed to update enrichment for ${church.slug}: ${error.message}`);
      }
      if (youtubeChannelId) {
        const { error } = await supabase
          .from("churches")
          .update({ youtube_channel_id: youtubeChannelId })
          .eq("slug", church.slug)
          .is("youtube_channel_id", null);
        if (error) throw new Error(`Failed to update YouTube channel for ${church.slug}: ${error.message}`);
      }
    }

    return {
      slug: church.slug,
      updated: true,
      fields: changedFields,
      facebook: facebookUrl,
      instagram: instagramUrl,
      youtube: youtubeUrl,
      youtubeChannelId,
      sources,
      domain: normalizeHost(church.website || ""),
    };
  });

  const updated = results.filter((result) => result.ok && result.value?.updated).map((result) => result.value);
  console.log(`Updated: ${updated.length}`);
  console.log(`Facebook added or kept: ${updated.filter((row) => row.facebook).length}`);
  console.log(`Instagram added or kept: ${updated.filter((row) => row.instagram).length}`);
  console.log(`YouTube added or kept: ${updated.filter((row) => row.youtube).length}`);
  console.log(`YouTube channel IDs added or kept: ${updated.filter((row) => row.youtubeChannelId).length}`);
  console.log(JSON.stringify(updated.slice(0, 20), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
