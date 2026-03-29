import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFilePath), "..");
const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");

function readJson(rel) {
  const full = path.join(root, rel);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

const PLACEHOLDER_PATTERN = /^(?:null|undefined|n\/a|na|none|unknown|tbd)$/i;
const SUSPICIOUS_TEXT_PATTERN = /\b(?:null|undefined)\b/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLAYABLE_SPOTIFY_PATH = /^\/(?:playlist|album|artist|track|show|episode)\//i;
const ALIAS_STOP_WORDS = new Set(["worship", "music", "church", "ministries", "ministry", "official"]);

function normalizeDisplayText(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  if (PLACEHOLDER_PATTERN.test(normalized)) return undefined;
  if (SUSPICIOUS_TEXT_PATTERN.test(normalized)) return undefined;
  return normalized;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a, b) {
  const aTokens = new Set(normalizeText(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return (2 * overlap) / (aTokens.size + bTokens.size);
}

function buildAliases(church) {
  const aliases = new Set();
  const values = Array.isArray(church.aliases) ? church.aliases : [];
  for (const alias of values) {
    const normalized = normalizeText(alias);
    if (normalized) aliases.add(normalized);
  }
  const name = normalizeText(church.name);
  if (name) aliases.add(name);
  const compacted = name.split(" ").filter((token) => !ALIAS_STOP_WORDS.has(token));
  if (compacted.length > 0) aliases.add(compacted.join(" "));
  return Array.from(aliases).filter(Boolean);
}

function getAliasMatchScore(text, aliases) {
  const normalized = normalizeText(text);
  let best = 0;
  for (const alias of aliases) {
    if (!alias) continue;
    if (normalized === alias) best = Math.max(best, 1);
    if (alias.length >= 4 && normalized.includes(alias)) best = Math.max(best, 0.92);
    best = Math.max(best, tokenSimilarity(normalized, alias));
  }
  return best;
}

function assessVideoRelevance(video, church) {
  const aliases = buildAliases(church);
  const channel = video.channelTitle || "";
  const title = video.title || "";
  const channelScore = getAliasMatchScore(channel, aliases);
  const titleScore = getAliasMatchScore(title, aliases);
  const combinedScore = getAliasMatchScore(`${channel} ${title}`, aliases);
  const hasChurchKeyword = /\b(church|worship|ministr(?:y|ies)|campus|parish|cathedral|chapel)\b/i.test(channel);
  const strongChannelAlias = aliases.some((alias) => alias.length >= 4 && normalizeText(channel).includes(alias));

  if ((video.channelId && church.youtubeChannelId && video.channelId === church.youtubeChannelId) || channelScore >= 0.82 || strongChannelAlias) {
    return { relevance: "official", relevanceScore: 1 };
  }
  if (channelScore >= 0.52 || (channelScore >= 0.35 && hasChurchKeyword)) {
    return { relevance: "affiliated", relevanceScore: Number((0.62 + combinedScore * 0.18).toFixed(2)) };
  }
  if (channelScore < 0.2 && titleScore < 0.35) {
    return { relevance: "unrelated", relevanceScore: Number((combinedScore * 0.25).toFixed(2)) };
  }
  if (titleScore >= 0.5 || combinedScore >= 0.45) {
    return { relevance: "uncertain", relevanceScore: Number((0.35 + combinedScore * 0.15).toFixed(2)) };
  }
  return { relevance: "unrelated", relevanceScore: Number((combinedScore * 0.2).toFixed(2)) };
}

function isValidPublicUrl(value) {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function isCorruptEmail(value) {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  if (/^[a-f0-9]{8,}[.@-]/i.test(normalized)) return true;
  if (normalized.includes("noreply") || normalized.includes("no-reply")) return true;
  return false;
}

function isValidPublicEmail(value) {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  if (isCorruptEmail(normalized)) return false;
  return EMAIL_PATTERN.test(normalized);
}

function isPlayableSpotifyUrl(value) {
  if (!isValidPublicUrl(value)) return false;
  const parsed = new URL(value);
  if (!/(\.|^)spotify\.com$/i.test(parsed.hostname)) return false;
  if (parsed.pathname.startsWith("/search")) return false;
  return PLAYABLE_SPOTIFY_PATH.test(parsed.pathname);
}

function isValidMediaAsset(value) {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  if (normalized.startsWith("/")) return true;
  return isValidPublicUrl(normalized);
}

function normalizeDay(day) {
  const normalized = normalizeDisplayText(day);
  if (!normalized) return undefined;
  const lower = normalized.toLowerCase();
  if (lower.endsWith("s") && lower.length > 3) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function normalizeTime(time) {
  const normalized = normalizeDisplayText(time);
  if (!normalized) return undefined;
  if (!/\d/.test(normalized)) return undefined;
  return normalized;
}

function getFirstServiceTimeLabel(times) {
  if (!Array.isArray(times)) return undefined;
  for (const slot of times) {
    const day = normalizeDay(slot?.day);
    const time = normalizeTime(slot?.time);
    if (day && time) {
      return `${day} ${time}`;
    }
  }
  return undefined;
}

function getValidServiceTimeLabel(value) {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return undefined;
  if (!/\d/.test(normalized)) return undefined;
  return normalized;
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

function uniquePlaylistIds(values) {
  const seen = new Set();
  const ids = [];
  for (const value of values) {
    const id = extractPlaylistId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function isCriticalFlag(flag) {
  return flag.startsWith("critical_");
}

function deriveDisplayAssessment(church) {
  const playlistCount = uniquePlaylistIds([
    ...(Array.isArray(church.spotifyPlaylistIds) ? church.spotifyPlaylistIds : []),
    ...(Array.isArray(church.additionalPlaylists) ? church.additionalPlaylists : []),
  ]).length;
  const videoCount = Array.isArray(church.youtubeVideos) ? church.youtubeVideos.length : 0;
  const serviceTimeLabel = getValidServiceTimeLabel(getFirstServiceTimeLabel(church.serviceTimes));
  const displayFlags = [];

  if (church.description && !normalizeDisplayText(church.description)) {
    displayFlags.push("critical_invalid_description_text");
  }

  if (church.website && !isValidPublicUrl(church.website)) {
    displayFlags.push("warning_invalid_website_url");
  }

  if (church.email && !isValidPublicEmail(church.email)) {
    displayFlags.push("warning_invalid_contact_email");
  }

  if (church.serviceTimes && !serviceTimeLabel) {
    displayFlags.push("warning_invalid_service_time");
  }

  const hasLongText = (normalizeDisplayText(church.description)?.length ?? 0) >= 80;
  const hasVisualAsset = isValidMediaAsset(church.headerImage) || isValidMediaAsset(church.logo);
  const hasMusic = isPlayableSpotifyUrl(church.spotifyUrl) || playlistCount > 0 || videoCount > 0;

  if (!hasLongText) displayFlags.push("warning_thin_public_text");
  if (!hasVisualAsset) displayFlags.push("warning_missing_visual_asset");
  if (!hasMusic) displayFlags.push("warning_missing_playable_music");

  const displayReady = !displayFlags.some((flag) => isCriticalFlag(flag));
  const promotionTier = displayReady && hasLongText && hasVisualAsset && hasMusic
    ? "promotable"
    : "catalog_only";

  let displayScore = 0;
  if (displayReady) displayScore += 20;
  if (hasLongText) displayScore += 35;
  if (hasVisualAsset) displayScore += 20;
  if (hasMusic) displayScore += 25;

  return {
    playlistCount,
    videoCount,
    promotionTier,
    displayReady,
    displayScore,
    displayFlags,
  };
}

function createReport(totalChurches) {
  return {
    summary: {
      churches: totalChurches,
      promotable: 0,
      catalogOnly: 0,
      criticalCount: 0,
      warningCount: 0,
    },
    topFlags: [],
    examplesByFlag: {},
    backlog: {
      publiclyBroken: [],
      nearlyPromotable: [],
      highPotentialLowQuality: [],
      videoReviewNeeded: [],
    },
  };
}

function addIssue(state, severity, flag, church, message) {
  const bucket = state.flags.get(flag) ?? { severity, count: 0, examples: [] };
  bucket.count += 1;
  if (bucket.examples.length < 3) {
    bucket.examples.push({ slug: church.slug, message });
  }
  state.flags.set(flag, bucket);
  if (severity === "critical") state.report.summary.criticalCount += 1;
  else state.report.summary.warningCount += 1;
}

function pushBacklog(backlog, item, limit = 25) {
  if (backlog.length < limit) backlog.push(item);
}

function main() {
  const churches = readJson("src/data/churches.json");
  const state = {
    report: createReport(churches.length),
    flags: new Map(),
  };

  for (const church of churches) {
    const display = deriveDisplayAssessment(church);
    if (display.promotionTier === "promotable") state.report.summary.promotable += 1;
    else state.report.summary.catalogOnly += 1;

    if (!church.slug) {
      addIssue(state, "critical", "critical_missing_slug", { slug: "(missing-slug)" }, "Missing slug");
      continue;
    }

    if (!normalizeDisplayText(church.name)) {
      addIssue(state, "critical", "critical_missing_name", church, "Missing or invalid name");
    }

    if (!normalizeDisplayText(church.country)) {
      addIssue(state, "critical", "critical_missing_country", church, "Missing or invalid country");
    }

    if (church.spotifyPlaylistIds != null && !Array.isArray(church.spotifyPlaylistIds)) {
      addIssue(state, "critical", "critical_invalid_playlist_type", church, "spotifyPlaylistIds must be an array");
    }

    if (!normalizeDisplayText(church.description)) {
      addIssue(state, "warning", "warning_missing_description", church, "Missing usable description");
    }

    if (!isValidMediaAsset(church.logo)) {
      addIssue(state, "warning", "warning_missing_logo", church, "Missing valid logo");
    }

    if (!isValidPublicUrl(church.website)) {
      addIssue(state, "warning", "warning_missing_website", church, "Missing valid website");
    }

    if (!church.spotifyUrl && display.playlistCount === 0) {
      addIssue(state, "warning", "warning_missing_spotify_source", church, "Missing Spotify source");
    }

    const manualPath = path.join(root, "src/data/manual", `${church.slug}.json`);
    if (!fs.existsSync(manualPath)) {
      addIssue(state, "warning", "warning_missing_manual_fallback", church, "Missing manual fallback file");
    }

    for (const flag of display.displayFlags) {
      addIssue(
        state,
        isCriticalFlag(flag) ? "critical" : "warning",
        flag,
        church,
        flag,
      );
    }

    if (display.displayFlags.some((flag) => isCriticalFlag(flag))) {
      pushBacklog(state.report.backlog.publiclyBroken, {
        slug: church.slug,
        name: church.name,
        promotionTier: display.promotionTier,
        displayFlags: display.displayFlags.filter((flag) => isCriticalFlag(flag)),
      });
    }

    const missingPromotionFlags = display.displayFlags.filter((flag) =>
      flag === "warning_thin_public_text"
      || flag === "warning_missing_visual_asset"
      || flag === "warning_missing_playable_music"
    );

    if (
      display.promotionTier === "catalog_only"
      && display.displayReady
      && missingPromotionFlags.length > 0
      && missingPromotionFlags.length <= 2
    ) {
      pushBacklog(state.report.backlog.nearlyPromotable, {
        slug: church.slug,
        name: church.name,
        missing: missingPromotionFlags,
        displayScore: display.displayScore,
      });
    }

    if (
      display.promotionTier === "catalog_only"
      && (display.playlistCount > 0 || display.videoCount > 0)
      && display.displayScore >= 40
    ) {
      pushBacklog(state.report.backlog.highPotentialLowQuality, {
        slug: church.slug,
        name: church.name,
        displayScore: display.displayScore,
        playlistCount: display.playlistCount,
        videoCount: display.videoCount,
        displayFlags: display.displayFlags,
      });
    }

    if (Array.isArray(church.youtubeVideos) && church.youtubeVideos.length > 0) {
      const strongMatches = church.youtubeVideos.filter((video) => {
        const relevance = assessVideoRelevance(video, church).relevance;
        return relevance === "official" || relevance === "affiliated";
      });
      if (strongMatches.length === 0) {
        pushBacklog(state.report.backlog.videoReviewNeeded, {
          slug: church.slug,
          name: church.name,
          videoCount: church.youtubeVideos.length,
        });
      }
    }
  }

  const sortedFlags = [...state.flags.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  state.report.topFlags = sortedFlags.map(([flag, meta]) => ({
    flag,
    severity: meta.severity,
    count: meta.count,
  }));
  state.report.examplesByFlag = Object.fromEntries(
    sortedFlags.map(([flag, meta]) => [flag, meta.examples]),
  );

  if (jsonMode) {
    console.log(JSON.stringify(state.report, null, 2));
  } else {
    console.log(`[content] Churches checked: ${state.report.summary.churches}`);
    console.log(
      `[content] Promotable: ${state.report.summary.promotable} | Catalog-only: ${state.report.summary.catalogOnly}`,
    );
    console.log(
      `[content] Criticals: ${state.report.summary.criticalCount} | Warnings: ${state.report.summary.warningCount}`,
    );
    console.log("[content] Top flags:");
    for (const item of state.report.topFlags) {
      const examples = state.report.examplesByFlag[item.flag]
        .map((example) => example.slug)
        .join(", ");
      console.log(`- ${item.flag} (${item.severity}): ${item.count}${examples ? ` | e.g. ${examples}` : ""}`);
    }
    console.log("[content] Backlogs:");
    console.log(`- publicly_broken: ${state.report.backlog.publiclyBroken.length}`);
    console.log(`- nearly_promotable: ${state.report.backlog.nearlyPromotable.length}`);
    console.log(`- high_potential_low_quality: ${state.report.backlog.highPotentialLowQuality.length}`);
    console.log(`- video_review_needed: ${state.report.backlog.videoReviewNeeded.length}`);
  }

  process.exit(state.report.summary.criticalCount > 0 ? 1 : 0);
}

main();
