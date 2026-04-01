import type { ServiceTime } from "@/types/gospel";

export type PromotionTier = "promotable" | "catalog_only";

type DisplayAssessmentInput = {
  description?: string;
  enrichmentSummary?: string;
  country?: string;
  location?: string;
  serviceTimeLabel?: string;
  websiteUrl?: string;
  contactEmail?: string;
  spotifyUrl?: string;
  playlistCount?: number;
  videoCount?: number;
  thumbnailUrl?: string;
  logoUrl?: string;
  headerImage?: string;
};

const PLACEHOLDER_PATTERN = /^(?:null|undefined|n\/a|na|none|unknown|tbd)$/i;
const SUSPICIOUS_TEXT_PATTERN = /\b(?:null|undefined)\b/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[\d\s().-]{7,}$/;
const PLAYABLE_SPOTIFY_PATH = /^\/(?:playlist|album|artist|track|show|episode)\//i;
const NON_OFFICIAL_WEBSITE_HOST_PATTERNS = [
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "spotify.com",
  "soundcloud.com",
  "linktr.ee",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "eniro.se",
  "hitta.se",
  "findachurch.co.uk",
  "yelp.com",
  "tripadvisor.com",
];
const GENERATED_CHURCH_DESCRIPTION_PATTERNS = [
  /^discover worship music and playlists from .+/i,
  /^listen to (?:worship )?music and playlists from .+/i,
];

export function normalizeDisplayText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  if (PLACEHOLDER_PATTERN.test(normalized)) return undefined;
  if (SUSPICIOUS_TEXT_PATTERN.test(normalized)) return undefined;
  return normalized;
}

export function isGeneratedChurchDescription(value: string | null | undefined): boolean {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  return GENERATED_CHURCH_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalized))
    || normalized.includes("Listen to their curated worship playlists on GospelChannel.");
}

export function joinDisplayParts(
  values: Array<string | null | undefined>,
  separator = " · ",
): string | undefined {
  const parts = values
    .map((value) => normalizeDisplayText(value))
    .filter((value): value is string => Boolean(value));
  if (parts.length === 0) return undefined;
  return parts.join(separator);
}

export function isValidPublicUrl(value: string | null | undefined): value is string {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function isBlockedOfficialWebsiteHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  return NON_OFFICIAL_WEBSITE_HOST_PATTERNS.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
}

export function isValidOfficialWebsiteUrl(value: string | null | undefined): value is string {
  if (!isValidPublicUrl(value)) return false;
  return !isBlockedOfficialWebsiteHost(new URL(value).hostname);
}

export function isPlayableSpotifyUrl(value: string | null | undefined): value is string {
  if (!isValidPublicUrl(value)) return false;
  const parsed = new URL(value);
  if (!/(\.|^)spotify\.com$/i.test(parsed.hostname)) return false;
  if (parsed.pathname.startsWith("/search")) return false;
  return PLAYABLE_SPOTIFY_PATH.test(parsed.pathname);
}

export function isCorruptEmail(value: string | null | undefined): boolean {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  if (/^[a-f0-9]{8,}[.@-]/i.test(normalized)) return true;
  if (normalized.includes("noreply") || normalized.includes("no-reply")) return true;
  return false;
}

export function isValidPublicEmail(value: string | null | undefined): value is string {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  if (isCorruptEmail(normalized)) return false;
  return EMAIL_PATTERN.test(normalized);
}

export function isValidPublicPhone(value: string | null | undefined): value is string {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  if (!PHONE_PATTERN.test(normalized)) return false;
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function getPublicHostLabel(value: string | null | undefined): string | undefined {
  if (!isValidPublicUrl(value)) return undefined;
  return new URL(value).hostname.replace(/^www\./i, "");
}

export function isValidMediaAsset(value: string | null | undefined): boolean {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return false;
  if (normalized.startsWith("/")) return true;
  return isValidPublicUrl(normalized);
}

function normalizeDay(day: string | null | undefined): string | undefined {
  const normalized = normalizeDisplayText(day);
  if (!normalized) return undefined;

  const lower = normalized.toLowerCase();
  if (lower.endsWith("s") && lower.length > 3) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function normalizeTime(time: string | null | undefined): string | undefined {
  const normalized = normalizeDisplayText(time);
  if (!normalized) return undefined;
  if (!/\d/.test(normalized)) return undefined;
  return normalized;
}

export function sanitizeServiceTimes(times: ServiceTime[] | null | undefined): ServiceTime[] {
  if (!Array.isArray(times)) return [];

  return times.flatMap((slot) => {
    const day = normalizeDay(slot.day);
    const time = normalizeTime(slot.time);
    if (!day || !time) return [];
    const label = normalizeDisplayText(slot.label);
    return [{ day, time, ...(label ? { label } : {}) }];
  });
}

export function getFirstServiceTimeLabel(times: ServiceTime[] | null | undefined): string | undefined {
  const [first] = sanitizeServiceTimes(times);
  if (!first) return undefined;
  return `${first.day} ${first.time}`;
}

export function getValidServiceTimeLabel(value: string | null | undefined): string | undefined {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return undefined;
  if (!/\d/.test(normalized)) return undefined;
  return normalized;
}

export function getCompactLocationLabel(
  location: string | null | undefined,
  country?: string | null | undefined,
): string | undefined {
  const normalizedLocation = normalizeDisplayText(location);
  if (!normalizedLocation) return undefined;

  const normalizedCountry = normalizeDisplayText(country)?.toLowerCase();
  const parts = normalizedLocation
    .split(",")
    .map((part) => normalizeDisplayText(part))
    .filter((part): part is string => Boolean(part));

  if (parts.length === 0) return undefined;

  const filtered = normalizedCountry
    ? parts.filter((part) => part.toLowerCase() !== normalizedCountry)
    : parts;
  const candidates = filtered.length > 0 ? filtered : parts;
  const first = candidates[0];

  if (!first) return undefined;
  if (!/\d/.test(first)) return first;

  const fallback = candidates.find((part) => !/\d/.test(part));
  return fallback || first;
}

export function buildChurchCardMetaLabel(input: {
  location?: string;
  serviceTimes?: string;
  playlistCount?: number;
  country?: string;
}): string {
  const serviceTimes = getValidServiceTimeLabel(input.serviceTimes);
  const location = getCompactLocationLabel(input.location, input.country);
  const country = normalizeDisplayText(input.country);

  const combined = joinDisplayParts([location, serviceTimes]);
  if (combined) return combined;
  if (serviceTimes) return serviceTimes;

  const playlistCount = typeof input.playlistCount === "number" && input.playlistCount > 0
    ? `${input.playlistCount} ${input.playlistCount === 1 ? "playlist" : "playlists"}`
    : undefined;

  return playlistCount || country || "Profile";
}

export function getNearbyChurchPlaceLabel(location?: string, country?: string): string | undefined {
  return joinDisplayParts([location, country], ", ");
}

export function hasPlayableMusicSource(input: {
  spotifyUrl?: string;
  playlistCount?: number;
  videoCount?: number;
}): boolean {
  return isPlayableSpotifyUrl(input.spotifyUrl)
    || (input.playlistCount ?? 0) > 0
    || (input.videoCount ?? 0) > 0;
}

export function isCriticalDisplayFlag(flag: string): boolean {
  return flag.startsWith("critical_");
}

export function deriveDisplayAssessment(input: DisplayAssessmentInput): {
  promotionTier: PromotionTier;
  displayScore: number;
  displayFlags: string[];
  displayReady: boolean;
} {
  const displayFlags: string[] = [];

  if (input.websiteUrl && !isValidOfficialWebsiteUrl(input.websiteUrl)) {
    displayFlags.push("warning_invalid_website_url");
  }

  if (input.contactEmail && !isValidPublicEmail(input.contactEmail)) {
    displayFlags.push("warning_invalid_contact_email");
  }

  if (input.serviceTimeLabel && !getValidServiceTimeLabel(input.serviceTimeLabel)) {
    displayFlags.push("warning_invalid_service_time");
  }

  if (input.description && !normalizeDisplayText(input.description)) {
    displayFlags.push("critical_invalid_description_text");
  }

  if (isGeneratedChurchDescription(input.description)) {
    displayFlags.push("warning_generated_description");
  }

  if (input.enrichmentSummary && !normalizeDisplayText(input.enrichmentSummary)) {
    displayFlags.push("critical_invalid_summary_text");
  }

  if (input.location && !normalizeDisplayText(input.location)) {
    displayFlags.push("critical_invalid_location_text");
  }

  if (input.spotifyUrl && !isPlayableSpotifyUrl(input.spotifyUrl) && (input.playlistCount ?? 0) === 0 && (input.videoCount ?? 0) === 0) {
    displayFlags.push("critical_invalid_music_source");
  }

  const hasLongText = ((normalizeDisplayText(input.enrichmentSummary)?.length ?? 0) >= 80)
    || (!isGeneratedChurchDescription(input.description) && (normalizeDisplayText(input.description)?.length ?? 0) >= 80);
  const hasVisualAsset = [input.thumbnailUrl, input.logoUrl, input.headerImage].some((value) => isValidMediaAsset(value));
  const hasMusic = hasPlayableMusicSource({
    spotifyUrl: input.spotifyUrl,
    playlistCount: input.playlistCount,
    videoCount: input.videoCount,
  });

  if (!hasLongText) displayFlags.push("warning_thin_public_text");
  if (!hasVisualAsset) displayFlags.push("warning_missing_visual_asset");
  if (!hasMusic) displayFlags.push("warning_missing_playable_music");

  const displayReady = !displayFlags.some((flag) => isCriticalDisplayFlag(flag));
  const promotionTier: PromotionTier = displayReady && hasLongText && hasVisualAsset && hasMusic
    ? "promotable"
    : "catalog_only";

  let displayScore = 0;
  if (displayReady) displayScore += 20;
  if (hasLongText) displayScore += 35;
  if (hasVisualAsset) displayScore += 20;
  if (hasMusic) displayScore += 25;

  return {
    promotionTier,
    displayScore,
    displayFlags: Array.from(new Set(displayFlags)),
    displayReady,
  };
}
