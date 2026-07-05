#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/local-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const CHURCHES_PATH = path.join(ROOT_DIR, "src", "data", "churches.json");
const SCREENING_PATH = path.join(ROOT_DIR, "src", "data", "cache", "church-candidate-screening.json");
const GENERIC_TOKENS = new Set([
  "church",
  "churches",
  "worship",
  "ministries",
  "ministry",
  "official",
  "tv",
  "live",
  "community",
  "center",
  "centre",
  "iglesia",
  "eglise",
  "kirche",
  "kyrka",
  "kyrkan",
  "gemeinde",
  "kirken",
  "seurakunta",
  "parroquia",
]);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
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
    if (platform === "instagram") {
      return parts[0] || "";
    }
    if (platform === "youtube") {
      if (parts[0]?.startsWith("@")) return parts[0].slice(1);
      if (parts[0] === "c" || parts[0] === "user") return parts[1] || "";
      if (parts[0] === "channel") return "";
      return parts[0] || "";
    }
    if (platform === "facebook") {
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

  if (platform === "youtube" && church.youtubeChannelId) {
    const officialPath = `/channel/${church.youtubeChannelId}`.toLowerCase();
    if (parsed.pathname.toLowerCase() === officialPath) {
      return { accepted: true, score: 100, confidence: "high" };
    }
  }

  if (!readableHandle) {
    return { accepted: false, score: 0, confidence: "low" };
  }

  const churchTokens = getChurchTokens(church);
  if (churchTokens.size === 0) return { accepted: false, score: 0, confidence: "low" };

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

  const confidence = exactAlias || strongAlias || score >= 10
    ? "high"
    : accepted && score >= 7
      ? "medium"
      : "low";

  if (platform === "instagram" && confidence !== "high") {
    return { accepted: false, score, confidence };
  }

  if (platform === "youtube" && confidence === "low") {
    return { accepted: false, score, confidence };
  }

  return { accepted, score, confidence };
}

function normalizeSocialUrl(value, platform) {
  if (!value) return null;
  try {
    const parsed = new URL(String(value).trim());
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (platform === "instagram") {
      if (hostname !== "instagram.com") return null;
      const parts = pathname.split("/").filter(Boolean);
      const handle = parts[0] || "";
      if (!handle) return null;
      if (pathname.startsWith("/p/") || pathname.startsWith("/reel/") || pathname.startsWith("/stories/")) return null;
      if (handle.startsWith("@")) return null;
      return `https://www.instagram.com/${handle}/`;
    }
    if (platform === "youtube") {
      if (!(hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtu.be")) return null;
      if (hostname === "youtu.be") return null;
      if (!pathname || pathname === "/") return null;
      if (pathname.startsWith("/watch") || pathname.startsWith("/shorts/") || pathname.startsWith("/playlist") || pathname.startsWith("/live/")) return null;
      const parts = pathname.split("/").filter(Boolean);
      if (parts[0]?.startsWith("@")) return `https://www.youtube.com/${parts[0]}`;
      if ((parts[0] === "c" || parts[0] === "user") && parts[1]) {
        return `https://www.youtube.com/${parts[0]}/${parts[1]}`;
      }
      return null;
    }
    if (platform === "facebook") {
      if (hostname !== "facebook.com" && hostname !== "m.facebook.com") return null;
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length === 0) return null;
      if (pathname.startsWith("/events/") || pathname.startsWith("/share/")) return null;
      return `https://www.facebook.com/${parts[0]}`;
    }
  } catch {
    return null;
  }
  return null;
}

function pickBestCandidate(values, church, screening, platform) {
  let best = null;
  for (const value of values) {
    const normalized = normalizeSocialUrl(value, platform);
    if (!normalized) continue;
    const assessment = scoreSocialCandidate(normalized, church, screening, platform);
    if (!assessment.accepted) continue;
    if (!best || assessment.score > best.score) {
      best = { score: assessment.score, url: normalized, confidence: assessment.confidence };
    }
  }
  return best;
}

function parseArgs(argv) {
  return {
    writeJson: argv.includes("--write-json"),
    json: argv.includes("--json"),
  };
}

function hasMissingPublicSocial(church, enrichmentMap, fieldName) {
  const enrichment = enrichmentMap.get(church.slug);
  return !church[fieldName] && !enrichment?.[fieldName];
}

async function loadEnrichments() {
  loadLocalEnv(ROOT_DIR);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceKey) {
    return new Map();
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await supabase
    .from("church_enrichments")
    .select("church_slug, instagram_url, facebook_url, youtube_url")
    .eq("enrichment_status", "complete");

  if (error || !data) return new Map();

  return new Map(
    data
      .filter((row) => row.church_slug)
      .map((row) => [row.church_slug, {
        instagramUrl: row.instagram_url || undefined,
        facebookUrl: row.facebook_url || undefined,
        youtubeUrl: row.youtube_url || undefined,
      }]),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const churches = readJson(CHURCHES_PATH, []);
  const screeningRows = readJson(SCREENING_PATH, []);
  const enrichments = await loadEnrichments();
  const screeningBySlug = new Map(screeningRows.map((row) => [row.slug, row]));
  const updates = [];
  const backlog = {
    missing_public_instagram_with_verified_candidate: [],
    missing_public_youtube_with_verified_candidate: [],
    invalid_social_fallback_url: [],
    pending_manual_review: [],
  };

  for (const church of churches) {
    const screening = screeningBySlug.get(church.slug);
    if (!screening) continue;

    if (!["verified_church_with_playlist", "verified_church_needs_playlist"].includes(screening.verdict)) {
      continue;
    }

    const socialInstagramUrls = splitList(screening.social_instagram_urls);
    const socialYoutubeUrls = splitList(screening.social_youtube_urls);
    const instagramCandidate = pickBestCandidate(socialInstagramUrls, church, screening, "instagram");
    const youtubeCandidate = church.youtubeChannelId
      ? { url: `https://www.youtube.com/channel/${church.youtubeChannelId}`, confidence: "high", score: 100 }
      : pickBestCandidate(socialYoutubeUrls, church, screening, "youtube");

    if (socialInstagramUrls.length > 0 && !instagramCandidate) {
      backlog.invalid_social_fallback_url.push({ slug: church.slug, platform: "instagram", candidates: socialInstagramUrls.slice(0, 3) });
    }
    if (socialYoutubeUrls.length > 0 && !youtubeCandidate && !church.youtubeChannelId) {
      backlog.pending_manual_review.push({ slug: church.slug, platform: "youtube", candidates: socialYoutubeUrls.slice(0, 3) });
    }

    const patch = { slug: church.slug };
    if (instagramCandidate && hasMissingPublicSocial(church, enrichments, "instagramUrl")) {
      patch.instagramUrl = instagramCandidate.url;
      backlog.missing_public_instagram_with_verified_candidate.push({ slug: church.slug, instagramUrl: instagramCandidate.url });
    }
    if (youtubeCandidate && hasMissingPublicSocial(church, enrichments, "youtubeUrl")) {
      patch.youtubeUrl = youtubeCandidate.url;
      backlog.missing_public_youtube_with_verified_candidate.push({ slug: church.slug, youtubeUrl: youtubeCandidate.url });
    }

    if (Object.keys(patch).length > 1) updates.push(patch);
  }

  if (options.writeJson && updates.length > 0) {
    const updateMap = new Map(updates.map((entry) => [entry.slug, entry]));
    const next = churches.map((church) => {
      const patch = updateMap.get(church.slug);
      return patch ? { ...church, ...patch } : church;
    });
    fs.writeFileSync(CHURCHES_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }

  const report = {
    summary: {
      updates: updates.length,
      instagramBackfill: backlog.missing_public_instagram_with_verified_candidate.length,
      youtubeBackfill: backlog.missing_public_youtube_with_verified_candidate.length,
      invalidCandidates: backlog.invalid_social_fallback_url.length,
      pendingManualReview: backlog.pending_manual_review.length,
      wroteJson: options.writeJson,
    },
    updates,
    backlog,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`[social-backfill] updates: ${report.summary.updates}`);
  console.log(`[social-backfill] instagram candidates: ${report.summary.instagramBackfill}`);
  console.log(`[social-backfill] youtube candidates: ${report.summary.youtubeBackfill}`);
  console.log(`[social-backfill] invalid candidates: ${report.summary.invalidCandidates}`);
  if (!options.writeJson) {
    console.log("[social-backfill] preview only; pass --write-json to persist safe fallbacks into churches.json");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
