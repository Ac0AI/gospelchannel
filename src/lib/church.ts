import { revalidateTag, unstable_cache } from "next/cache";
import { getChurchLatestUpdates } from "@/lib/church-updates";
import { uniqueSpotifyPlaylistIds } from "@/lib/spotify-playlist";
import type { ChurchProfileEdit, YouTubeVideo, ChurchEnrichment, ChurchProfileScore } from "@/types/gospel";
import type { ChurchConfig } from "@/types/gospel";
import { CHURCH_INDEX_TAG, getChurchBySlugAsync, getLocalChurchSnapshot } from "@/lib/content";
import { getSql } from "@/db";
import { CONTENT_UPDATED_AT, normalizeText, tokenSimilarity } from "@/lib/utils";
import { hasServiceConfig, createAdminClient } from "@/lib/neon-client";
import { getCampusBySlug } from "@/lib/church-networks";
import { getApprovedProfileEditsForChurch, buildMergedProfile } from "@/lib/church-profile";
import { calculateProfileScore } from "@/lib/profile-score";
import { rewriteLegacyMediaUrl } from "@/lib/media";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import {
  filterCanonicalChurchSlugRecords,
  getChurchSlugRedirectAliases,
  getChurchSlugLookupCandidates,
  resolveCanonicalChurchSlug,
} from "@/lib/church-slugs";
import { filterExplicitNonChurchRows, getExplicitNonChurchSlugs } from "@/lib/non-church-slugs";
import { computeDataRichnessScore } from "@/lib/enrichment-richness";
import {
  deriveDisplayAssessment,
  getFirstServiceTimeLabel,
  getCompactLocationLabel,
  isGeneratedChurchDescription,
  normalizeDisplayText,
} from "@/lib/content-quality";
import {
  buildChurchMatchReasons,
  filterChurchDirectory,
  getDenominationFilterBySlug,
  getStyleFilterBySlug,
  paginateChurches,
  extractCity,
  STYLE_FILTERS,
  DENOMINATION_FILTERS,
  type ChurchDirectoryEntry,
  type ChurchDirectoryFilters,
  type FacetLink,
} from "@/lib/church-directory";
import { slugify } from "@/lib/slugify";

type CachedVideo = {
  videoId: string;
  title: string;
  channelTitle?: string;
  channelId?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
};

type ImageCandidate = {
  thumbnailUrl?: string | null;
} | null | undefined;

type VideoRelevance = "official" | "affiliated" | "uncertain" | "unrelated";

type ChurchVideoSignalsInput = {
  church: Pick<ChurchConfig, "name" | "aliases" | "youtubeChannelId">;
  enrichment?: Pick<ChurchEnrichment, "officialChurchName" | "youtubeUrl"> | null;
};

type ChurchPageProfileResult = {
  mergedProfile: Record<string, unknown>;
  profileScore: ChurchProfileScore;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type ChurchIndexSummary = {
  slug: string;
  name: string;
  logo?: string;
  country: string;
};

const CHURCH_INDEX_CACHE_SECONDS = 60 * 60;
export const CHURCH_CLAIM_STATUS_TAG = "church-claim-status";
const CHURCH_CLAIM_STATUS_SECONDS = 300;
let churchIndexDataCache: CacheEntry<Awaited<ReturnType<typeof _getChurchIndexData>>> | null = null;
let churchIndexDataPromise: Promise<Awaited<ReturnType<typeof _getChurchIndexData>>> | null = null;
let churchIndexSummaryCache: CacheEntry<Map<string, ChurchIndexSummary>> | null = null;
let churchIndexSummaryPromise: Promise<Map<string, ChurchIndexSummary>> | null = null;

const ALIAS_STOP_WORDS = new Set([
  "worship",
  "music",
  "church",
  "ministries",
  "ministry",
  "official",
]);

function getCachedVideos(church: ChurchConfig): CachedVideo[] {
  return ((church as Record<string, unknown>).youtubeVideos as CachedVideo[] | undefined) ?? [];
}

export function resolveChurchPrimaryImage({
  headerImage,
  videos,
  coverImageUrl,
}: {
  headerImage?: string | null;
  videos?: ImageCandidate[];
  coverImageUrl?: string | null;
}): string | undefined {
  return resolveChurchImageCandidates({ headerImage, videos, coverImageUrl })[0];
}

export function resolveChurchImageCandidates({
  headerImage,
  videos,
  coverImageUrl,
}: {
  headerImage?: string | null;
  videos?: ImageCandidate[];
  coverImageUrl?: string | null;
}): string[] {
  const seen = new Set<string>();
  return [
    headerImage,
    ...(videos ?? []).map((video) => video?.thumbnailUrl),
    coverImageUrl,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function isDevRuntime(): boolean {
  return process.env.NODE_ENV !== "production";
}

function shouldLogChurchProfileTiming(): boolean {
  return isDevRuntime() || process.env.CHURCH_PROFILE_TIMING === "1";
}

type ChurchTimingMap = Record<string, number>;

async function measureChurchStep<T>(
  timings: ChurchTimingMap,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  timings[label] = Math.round((performance.now() - start) * 10) / 10;
  return result;
}

function flushChurchTimingLog(slug: string, kind: "church" | "campus", timings: ChurchTimingMap): void {
  if (!shouldLogChurchProfileTiming()) return;
  console.info(`[church-profile] ${JSON.stringify({ slug, kind, timings })}`);
}

function lowerCaseLeadingCharacter(value: string): string {
  if (!value) return value;
  const [first, ...rest] = value;
  if (!first) return value;
  if (value === value.toUpperCase()) return value;
  return `${first.toLowerCase()}${rest.join("")}`;
}

function withIndefiniteArticle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "a church";
  const article = /^[aeiou]/i.test(trimmed) ? "an" : "a";
  return `${article} ${trimmed}`;
}

function buildChurchTypeLabel(denomination: string | undefined): string {
  const normalized = normalizeDisplayText(denomination);
  if (!normalized) return "church";
  const sentenceLabel = lowerCaseLeadingCharacter(normalized);
  if (/\b(church|cathedral|parish|congregation|fellowship|ministry|chapel|assembly)\b/i.test(sentenceLabel)) {
    return sentenceLabel;
  }
  return `${sentenceLabel} church`;
}

export function resolveChurchPublicDescription(input: {
  church: Pick<ChurchConfig, "name" | "description" | "country" | "location" | "denomination" | "musicStyle" | "spotifyPlaylistIds" | "additionalPlaylists">;
  enrichmentSummary?: string;
  seoDescription?: string;
  enrichmentLocation?: string;
  languages?: string[];
}): string {
  const summary = normalizeDisplayText(input.enrichmentSummary);
  if (summary) return summary;

  const description = normalizeDisplayText(input.church.description);
  if (description && !isGeneratedChurchDescription(description)) return description;

  const seoDescription = normalizeDisplayText(input.seoDescription);
  if (seoDescription) return seoDescription;

  const location = getCompactLocationLabel(input.enrichmentLocation, input.church.country)
    || getCompactLocationLabel(input.church.location, input.church.country)
    || normalizeDisplayText(input.church.country);
  const languageList = (input.languages ?? [])
    .map((value) => normalizeDisplayText(value))
    .filter((value): value is string => Boolean(value));
  const typeLabel = buildChurchTypeLabel(input.church.denomination);
  const playlistCount = new Set([
    ...(input.church.spotifyPlaylistIds ?? []),
    ...(input.church.additionalPlaylists ?? []),
  ]).size;

  let firstSentence = `${input.church.name} is ${withIndefiniteArticle(typeLabel)}`;
  if (location) firstSentence += ` in ${location}`;
  if (languageList.length === 1) firstSentence += ` with services in ${languageList[0]}`;
  if (languageList.length > 1) firstSentence += ` with services in ${languageList.slice(0, 2).join(" and ")}`;
  firstSentence += ".";

  const primaryStyle = input.church.musicStyle
    ?.map((value) => normalizeDisplayText(value))
    .find((value): value is string => Boolean(value));

  if (primaryStyle) {
    return `${firstSentence} The music leans ${primaryStyle}.`;
  }

  if (playlistCount > 0) {
    return `${firstSentence} You can preview ${playlistCount === 1 ? "their worship playlist" : "their worship playlists"} before your first visit.`;
  }

  return `${firstSentence} Explore their worship and community details before your first visit.`;
}

function extractYouTubeChannelId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/^\/channel\/([A-Za-z0-9_-]+)$/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function hasStrongAliasMatch(text: string, aliases: string[]): boolean {
  const normalized = normalizeText(text);
  return aliases.some((alias) => {
    if (alias.length < 4) return false;
    return normalized.includes(alias);
  });
}

function getAliasMatchScore(text: string, aliases: string[]): number {
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

function getChurchVideoAliases({ church, enrichment }: ChurchVideoSignalsInput): string[] {
  const aliases = new Set(
    buildChurchAliases(church as ChurchConfig)
      .map((alias) => normalizeText(alias))
      .filter(Boolean),
  );
  aliases.add(normalizeText(church.name));
  if (enrichment?.officialChurchName) aliases.add(normalizeText(enrichment.officialChurchName));
  return Array.from(aliases).filter(Boolean);
}

export function assessChurchVideoRelevance(
  video: YouTubeVideo,
  input: ChurchVideoSignalsInput,
): { relevance: VideoRelevance; relevanceScore: number } {
  const aliases = getChurchVideoAliases(input);
  const channelText = video.channelTitle ?? "";
  const titleText = video.title ?? "";
  const combinedText = `${channelText} ${titleText}`;
  const channelMatchScore = getAliasMatchScore(channelText, aliases);
  const titleMatchScore = getAliasMatchScore(titleText, aliases);
  const combinedMatchScore = getAliasMatchScore(combinedText, aliases);
  const officialChannelId = input.church.youtubeChannelId || extractYouTubeChannelId(input.enrichment?.youtubeUrl);
  const channelMatchesOfficialId = Boolean(video.channelId && officialChannelId && video.channelId === officialChannelId);
  const hasChurchKeyword = /\b(church|worship|ministr(?:y|ies)|campus|parish|cathedral|chapel)\b/i.test(channelText);
  const hasStrongChannelAlias = hasStrongAliasMatch(channelText, aliases);
  const hasStrongTitleAlias = hasStrongAliasMatch(titleText, aliases);

  if (channelMatchesOfficialId) {
    return { relevance: "official", relevanceScore: 1 };
  }

  if (channelMatchScore >= 0.82 || hasStrongChannelAlias) {
    return { relevance: "official", relevanceScore: Number((0.9 + combinedMatchScore * 0.1).toFixed(2)) };
  }

  if (channelMatchScore >= 0.52 || (channelMatchScore >= 0.35 && hasChurchKeyword)) {
    return { relevance: "affiliated", relevanceScore: Number((0.62 + combinedMatchScore * 0.18).toFixed(2)) };
  }

  if (channelMatchScore < 0.2 && titleMatchScore < 0.35) {
    return { relevance: "unrelated", relevanceScore: Number((combinedMatchScore * 0.25).toFixed(2)) };
  }

  if (hasStrongTitleAlias && channelMatchScore >= 0.2) {
    return { relevance: "uncertain", relevanceScore: Number((0.42 + combinedMatchScore * 0.12).toFixed(2)) };
  }

  if (titleMatchScore >= 0.5 || combinedMatchScore >= 0.45) {
    return { relevance: "uncertain", relevanceScore: Number((0.35 + combinedMatchScore * 0.15).toFixed(2)) };
  }

  return { relevance: "unrelated", relevanceScore: Number((combinedMatchScore * 0.2).toFixed(2)) };
}

function compareChurchVideos(a: YouTubeVideo, b: YouTubeVideo): number {
  const rank = (value: VideoRelevance | undefined): number => {
    if (value === "official") return 0;
    if (value === "affiliated") return 1;
    if (value === "uncertain") return 2;
    return 3;
  };

  const relevanceDiff = rank(a.relevance) - rank(b.relevance);
  if (relevanceDiff !== 0) return relevanceDiff;
  if ((b.relevanceScore ?? 0) !== (a.relevanceScore ?? 0)) return (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);

  const aPublished = Date.parse(a.publishedAt ?? "");
  const bPublished = Date.parse(b.publishedAt ?? "");
  if (!Number.isNaN(aPublished) && !Number.isNaN(bPublished) && aPublished !== bPublished) {
    return bPublished - aPublished;
  }

  if ((b.viewCount ?? 0) !== (a.viewCount ?? 0)) return (b.viewCount ?? 0) - (a.viewCount ?? 0);
  return a.title.localeCompare(b.title);
}

export function selectChurchPageVideos(
  videos: YouTubeVideo[],
  input: ChurchVideoSignalsInput,
): YouTubeVideo[] {
  const assessed = videos
    .map((video) => {
      const result = assessChurchVideoRelevance(video, input);
      return { ...video, ...result };
    })
    .sort(compareChurchVideos);

  const strong = assessed.filter((video) => video.relevance === "official" || video.relevance === "affiliated");
  if (strong.length >= 3) return strong;

  const uncertain = assessed.filter((video) => video.relevance === "uncertain");
  return [...strong, ...uncertain.slice(0, Math.max(0, 3 - strong.length))];
}

export function buildChurchPageProfile(args: {
  church: ChurchConfig;
  enrichment: ChurchEnrichment | null;
  edits: Array<Pick<ChurchProfileEdit, "fieldName" | "fieldValue" | "reviewStatus" | "submittedAt">>;
  isClaimed: boolean;
}): ChurchPageProfileResult {
  const mergedProfile = buildMergedProfile(args.enrichment, args.edits, args.church);
  return {
    mergedProfile,
    profileScore: calculateProfileScore({
      isClaimed: args.isClaimed,
      mergedData: mergedProfile,
    }),
  };
}

function isBadgeEligibleFromMergedProfile(mergedProfile: Record<string, unknown>): boolean {
  return calculateProfileScore({
    isClaimed: false,
    mergedData: mergedProfile,
  }).missingForBadge.length === 0;
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function daysSince(value: string): number | null {
  const reference = toTimestamp(CONTENT_UPDATED_AT);
  const timestamp = toTimestamp(value);
  if (reference === null || timestamp === null) return null;
  return Math.max(0, Math.floor((reference - timestamp) / (1000 * 60 * 60 * 24)));
}

function getDerivedVerifiedAt(church: ChurchConfig): string {
  return church.verifiedAt ?? church.lastResearched ?? CONTENT_UPDATED_AT;
}

function normalizeAlias(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

export function buildChurchAliases(church: ChurchConfig): string[] {
  const aliases = new Set<string>();

  for (const alias of church.aliases ?? []) {
    const normalized = normalizeAlias(alias);
    if (normalized) aliases.add(normalized);
  }

  const normalizedName = normalizeAlias(church.name);
  if (normalizedName) aliases.add(normalizedName);

  const compacted = normalizedName
    .split(" ")
    .filter((token) => !ALIAS_STOP_WORDS.has(token.toLowerCase()));
  if (compacted.length > 0) {
    aliases.add(compacted.join(" "));
  }

  if (/^[A-Z0-9\s]+$/.test(church.name)) {
    const friendly = titleCase(normalizedName);
    if (friendly) {
      aliases.add(friendly);
    }
  }

  return Array.from(aliases);
}

export function deriveChurchQuality(church: ChurchConfig): {
  playlistCount: number;
  qualityScore: number;
  verifiedAt: string;
  dataFlags: string[];
} {
  const playlistCount = uniqueSpotifyPlaylistIds([
    ...church.spotifyPlaylistIds,
    ...(church.additionalPlaylists ?? []),
  ]).length;
  const verifiedAt = getDerivedVerifiedAt(church);
  const dataFlags: string[] = [];

  let score = 0;

  if (playlistCount > 0) {
    score += 25;
  } else {
    dataFlags.push("missing_playlist");
  }

  if (church.description.trim().length >= 80) {
    score += 20;
  } else {
    dataFlags.push("weak_description");
  }

  if (church.logo) {
    score += 15;
  } else {
    dataFlags.push("missing_logo");
  }

  if (church.country && church.location) {
    score += 15;
  } else {
    dataFlags.push("missing_location");
  }

  if ((church.musicStyle?.length ?? 0) > 0) {
    score += 10;
  } else {
    dataFlags.push("missing_music_style");
  }

  const ageDays = daysSince(verifiedAt);
  if (ageDays !== null && ageDays <= 90) {
    score += 15;
  } else if (ageDays !== null && ageDays <= 180) {
    score += 7;
    dataFlags.push("stale_verification");
  } else {
    dataFlags.push("stale_verification");
  }

  if (!church.email) {
    dataFlags.push("missing_email");
  }

  const qualityScore = Math.min(100, Math.max(0, Math.round(score)));

  return {
    playlistCount,
    qualityScore,
    verifiedAt,
    dataFlags: Array.from(new Set(dataFlags)),
  };
}

export async function getChurchEnrichment(slug: string): Promise<ChurchEnrichment | null> {
  if (!hasServiceConfig()) return null;
  const sb = createAdminClient();
  const canonicalSlug = resolveCanonicalChurchSlug(slug);
  type ChurchEnrichmentRow = {
    id: string;
    church_slug: string | null;
    candidate_id: string | null;
    official_church_name: string | null;
    street_address: string | null;
    google_maps_url: string | null;
    latitude: number | null;
    longitude: number | null;
    service_times: ChurchEnrichment["serviceTimes"] | null;
    theological_orientation: string | null;
    denomination_network: string | null;
    languages: string[] | null;
    phone: string | null;
    contact_email: string | null;
    website_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    youtube_url: string | null;
    facebook_followers: number | null;
    instagram_followers: number | null;
    youtube_subscribers: number | null;
    social_stats_fetched_at: string | null;
    children_ministry: boolean | null;
    youth_ministry: boolean | null;
    ministries: string[] | null;
    church_size: ChurchEnrichment["churchSize"] | null;
    cover_image_url: string | null;
    logo_image_url: string | null;
    seo_description: string | null;
    summary: string | null;
    pastor_name: string | null;
    pastor_title: string | null;
    pastor_photo_url: string | null;
    livestream_url: string | null;
    giving_url: string | null;
    what_to_expect: string | null;
    service_duration_minutes: number | null;
    parking_info: string | null;
    good_fit_tags: string[] | null;
    visitor_faq: ChurchEnrichment["visitorFaq"] | null;
    sources: ChurchEnrichment["sources"] | null;
    enrichment_status: ChurchEnrichment["enrichmentStatus"];
    confidence: number;
    schema_version: number;
    last_enriched_at: string | null;
    created_at: string;
    updated_at: string;
  };
  const { data } = await sb
    .from<ChurchEnrichmentRow>("church_enrichments")
    .select("*")
    .in("church_slug", getChurchSlugLookupCandidates(canonicalSlug))
    .eq("enrichment_status", "complete");
  const enrichmentRows = (data as ChurchEnrichmentRow[] | null) ?? [];
  const row = enrichmentRows.find((entry) => entry.church_slug === canonicalSlug) ?? enrichmentRows[0] ?? null;
  if (!row) return null;
  return {
    id: row.id,
    churchSlug: row.church_slug ?? undefined,
    candidateId: row.candidate_id ?? undefined,
    officialChurchName: row.official_church_name ?? undefined,
    streetAddress: row.street_address ?? undefined,
    googleMapsUrl: row.google_maps_url ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    serviceTimes: row.service_times ?? undefined,
    theologicalOrientation: row.theological_orientation ?? undefined,
    denominationNetwork: row.denomination_network ?? undefined,
    languages: row.languages ?? undefined,
    phone: row.phone ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    instagramUrl: row.instagram_url ?? undefined,
    facebookUrl: row.facebook_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    facebookFollowers: row.facebook_followers ?? undefined,
    instagramFollowers: row.instagram_followers ?? undefined,
    youtubeSubscribers: row.youtube_subscribers ?? undefined,
    socialStatsFetchedAt: row.social_stats_fetched_at ?? undefined,
    childrenMinistry: row.children_ministry ?? undefined,
    youthMinistry: row.youth_ministry ?? undefined,
    ministries: row.ministries ?? undefined,
    churchSize: row.church_size ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    logoImageUrl: row.logo_image_url ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    summary: row.summary ?? undefined,
    pastorName: row.pastor_name ?? undefined,
    pastorTitle: row.pastor_title ?? undefined,
    pastorPhotoUrl: row.pastor_photo_url ?? undefined,
    livestreamUrl: row.livestream_url ?? undefined,
    givingUrl: row.giving_url ?? undefined,
    whatToExpect: row.what_to_expect ?? undefined,
    serviceDurationMinutes: row.service_duration_minutes ?? undefined,
    parkingInfo: row.parking_info ?? undefined,
    goodFitTags: row.good_fit_tags ?? undefined,
    visitorFaq: row.visitor_faq ?? undefined,
    sources: row.sources ?? undefined,
    enrichmentStatus: row.enrichment_status,
    confidence: row.confidence,
    schemaVersion: row.schema_version,
    lastEnrichedAt: row.last_enriched_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function _getChurchPageData(slug: string) {
  const totalStart = performance.now();
  const timings: ChurchTimingMap = {};
  const [
    church,
    enrichment,
    edits,
    isClaimed,
  ] = await Promise.all([
    measureChurchStep(timings, "church.base", () => getChurchBySlugAsync(slug)),
    measureChurchStep(timings, "church.enrichment", () => getChurchEnrichment(slug)),
    measureChurchStep(timings, "church.edits", () => getApprovedProfileEditsForChurch(slug)),
    measureChurchStep(timings, "church.claim_status", () => checkChurchClaimed(slug)),
  ]);

  if (church) {
    const metrics = await measureChurchStep(timings, "church.quality", async () => deriveChurchQuality(church));
    const cached = getCachedVideos(church);
    const resolvedDescription = resolveChurchPublicDescription({
      church,
      enrichmentSummary: enrichment?.summary,
      seoDescription: enrichment?.seoDescription,
      enrichmentLocation: enrichment?.streetAddress,
      languages: enrichment?.languages,
    });
    const videos = await measureChurchStep(timings, "church.videos", async () => selectChurchPageVideos(cached.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      channelTitle: v.channelTitle ?? church.name,
      viewCount: 0,
      channelId: v.channelId,
      publishedAt: v.publishedAt,
    })), { church, enrichment }));
    const { mergedProfile, profileScore } = await measureChurchStep(timings, "church.profile_score", async () =>
      buildChurchPageProfile({ church, enrichment, edits, isClaimed }),
    );
    const display = await measureChurchStep(timings, "church.display", async () => deriveDisplayAssessment({
      description: resolvedDescription,
      enrichmentSummary: enrichment?.summary,
      country: church.country,
      location: enrichment?.streetAddress || church.location,
      serviceTimeLabel: getFirstServiceTimeLabel(enrichment?.serviceTimes),
      websiteUrl: enrichment?.websiteUrl || church.website,
      contactEmail: enrichment?.contactEmail || church.email,
      spotifyUrl: church.spotifyUrl,
      playlistCount: metrics.playlistCount,
      videoCount: videos.length,
      thumbnailUrl: resolveChurchPrimaryImage({
        headerImage: church.headerImage,
        videos,
        coverImageUrl: enrichment?.coverImageUrl,
      }),
      logoUrl: church.logo || enrichment?.logoImageUrl,
      headerImage: church.headerImage,
    }));
    timings["church.total"] = Math.round((performance.now() - totalStart) * 10) / 10;
    flushChurchTimingLog(slug, "church", timings);

    return {
      church: {
        ...church,
        description: resolvedDescription,
        aliases: buildChurchAliases(church),
        ...metrics,
        ...display,
      },
      videos,
      enrichment,
      mergedProfile,
      profileScore,
      updatedAt: metrics.verifiedAt,
      network: undefined,
      campusCount: 0,
      isCampus: false,
      parentChurchName: undefined,
    };
  }

  // 2. Try campus lookup
  const campus = await measureChurchStep(timings, "campus.lookup", () => getCampusBySlug(slug));
  if (!campus) return null;

  // Build a ChurchConfig-like object for the campus
  const parentChurch = campus.network.parentChurchSlug
    ? await getChurchBySlugAsync(campus.network.parentChurchSlug)
    : null;

  const campusAsChurch: ChurchConfig = {
    slug: campus.slug,
    name: campus.name,
    description: campus.enrichment?.summary
      || `${campus.name} is part of ${campus.network.name}.${parentChurch ? ` Listen to music from ${parentChurch.name}.` : ""}`,
    spotifyPlaylistIds: parentChurch?.spotifyPlaylistIds ?? [],
    spotifyPlaylists: parentChurch?.spotifyPlaylists,
    logo: parentChurch?.logo ?? "",
    website: campus.enrichment?.websiteUrl ?? campus.network.website ?? "",
    spotifyUrl: parentChurch?.spotifyUrl ?? "",
    country: campus.country ?? campus.network.headquartersCountry ?? "",
    denomination: campus.enrichment?.denominationNetwork ?? parentChurch?.denomination,
    location: campus.city,
    musicStyle: parentChurch?.musicStyle,
    notableArtists: parentChurch?.notableArtists,
    additionalPlaylists: parentChurch?.additionalPlaylists,
    email: campus.enrichment?.contactEmail,
    sourceKind: "discovered",
  };

  const metrics = await measureChurchStep(timings, "campus.quality", async () => deriveChurchQuality(campusAsChurch));

  // Get videos from parent church if available
  const cached = parentChurch ? getCachedVideos(parentChurch) : [];
  const videos = await measureChurchStep(timings, "campus.videos", async () => selectChurchPageVideos(cached.map((v) => ({
    videoId: v.videoId,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    channelTitle: v.channelTitle ?? (parentChurch?.name ?? campus.name),
    viewCount: 0,
    channelId: v.channelId,
  })), { church: campusAsChurch, enrichment: campus.enrichment ?? null }));
  const { mergedProfile, profileScore } = await measureChurchStep(timings, "campus.profile_score", async () =>
    buildChurchPageProfile({
      church: campusAsChurch,
      enrichment: campus.enrichment ?? null,
      edits,
      isClaimed,
    }),
  );
  const display = await measureChurchStep(timings, "campus.display", async () => deriveDisplayAssessment({
    description: campusAsChurch.description,
    enrichmentSummary: campus.enrichment?.summary,
    country: campusAsChurch.country,
    location: campus.enrichment?.streetAddress || campusAsChurch.location,
    serviceTimeLabel: getFirstServiceTimeLabel(campus.enrichment?.serviceTimes),
    websiteUrl: campus.enrichment?.websiteUrl || campusAsChurch.website,
    contactEmail: campus.enrichment?.contactEmail || campusAsChurch.email,
    spotifyUrl: campusAsChurch.spotifyUrl,
    playlistCount: metrics.playlistCount,
    videoCount: videos.length,
    thumbnailUrl: resolveChurchPrimaryImage({
      headerImage: parentChurch?.headerImage,
      videos,
      coverImageUrl: campus.enrichment?.coverImageUrl,
    }),
    logoUrl: campusAsChurch.logo || campus.enrichment?.logoImageUrl,
    headerImage: parentChurch?.headerImage,
  }));
  timings["campus.total"] = Math.round((performance.now() - totalStart) * 10) / 10;
  flushChurchTimingLog(slug, "campus", timings);

  return {
    church: {
      ...campusAsChurch,
      aliases: [campus.name],
      ...metrics,
      ...display,
    },
    videos,
    enrichment: campus.enrichment ?? null,
    mergedProfile,
    profileScore,
    updatedAt: campus.updatedAt,
    network: campus.network,
    campusCount: 0,
    isCampus: true,
    parentChurchName: parentChurch?.name,
  };
}

export async function getChurchPagePayloadUncached(slug: string) {
  return _getChurchPageData(slug);
}

export const getChurchPagePayload = unstable_cache(
  async (slug: string) => _getChurchPageData(slug),
  ["church-page"],
  { revalidate: 3600, tags: ["church-page"] }
);

export const getChurchPageData = getChurchPagePayload;

async function _getChurchPublicPageData(slug: string) {
  const totalStart = performance.now();
  const timings: ChurchTimingMap = {};
  const church = await measureChurchStep(timings, "public.base", () => getChurchBySlugAsync(slug));

  const [enrichment, edits] = await Promise.all([
    measureChurchStep(timings, "public.enrichment", () => getChurchEnrichment(slug)),
    measureChurchStep(timings, "public.edits", () => getApprovedProfileEditsForChurch(slug)),
  ]);

  if (church) {
    const metrics = await measureChurchStep(timings, "public.quality", async () => deriveChurchQuality(church));
    const cached = getCachedVideos(church);
    const resolvedDescription = resolveChurchPublicDescription({
      church,
      enrichmentSummary: enrichment?.summary,
      seoDescription: enrichment?.seoDescription,
      enrichmentLocation: enrichment?.streetAddress,
      languages: enrichment?.languages,
    });
    const videos = await measureChurchStep(timings, "public.videos", async () => selectChurchPageVideos(cached.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      channelTitle: v.channelTitle ?? church.name,
      viewCount: 0,
      channelId: v.channelId,
    })), { church, enrichment }));
    const mergedProfile = await measureChurchStep(timings, "public.merged_profile", async () =>
      buildMergedProfile(enrichment, edits, church),
    );
    const latestUpdates = await measureChurchStep(timings, "public.updates", async () =>
      getChurchLatestUpdates(slug),
    );
    const display = await measureChurchStep(timings, "public.display", async () => deriveDisplayAssessment({
      description: resolvedDescription,
      enrichmentSummary: enrichment?.summary,
      country: church.country,
      location: enrichment?.streetAddress || church.location,
      serviceTimeLabel: getFirstServiceTimeLabel(enrichment?.serviceTimes),
      websiteUrl: enrichment?.websiteUrl || church.website,
      contactEmail: enrichment?.contactEmail || church.email,
      spotifyUrl: church.spotifyUrl,
      playlistCount: metrics.playlistCount,
      videoCount: videos.length,
      thumbnailUrl: resolveChurchPrimaryImage({
        headerImage: church.headerImage,
        videos,
        coverImageUrl: enrichment?.coverImageUrl,
      }),
      logoUrl: church.logo || enrichment?.logoImageUrl,
      headerImage: church.headerImage,
    }));
    timings["public.total"] = Math.round((performance.now() - totalStart) * 10) / 10;
    flushChurchTimingLog(slug, "church", timings);

    return {
      church: {
        ...church,
        description: resolvedDescription,
        aliases: buildChurchAliases(church),
        ...metrics,
        ...display,
      },
      videos,
      latestUpdates,
      enrichment,
      mergedProfile,
      badgeEligible: isBadgeEligibleFromMergedProfile(mergedProfile),
      updatedAt: metrics.verifiedAt,
      network: undefined,
      campusCount: 0,
      isCampus: false,
      parentChurchName: undefined,
    };
  }

  const campus = await measureChurchStep(timings, "public.campus_lookup", () => getCampusBySlug(slug));
  if (!campus) return null;

  const parentChurch = campus.network.parentChurchSlug
    ? await getChurchBySlugAsync(campus.network.parentChurchSlug)
    : null;

  const campusAsChurch: ChurchConfig = {
    slug: campus.slug,
    name: campus.name,
    description: campus.enrichment?.summary
      || `${campus.name} is part of ${campus.network.name}.${parentChurch ? ` Listen to music from ${parentChurch.name}.` : ""}`,
    spotifyPlaylistIds: parentChurch?.spotifyPlaylistIds ?? [],
    spotifyPlaylists: parentChurch?.spotifyPlaylists,
    logo: parentChurch?.logo ?? "",
    website: campus.enrichment?.websiteUrl ?? campus.network.website ?? "",
    spotifyUrl: parentChurch?.spotifyUrl ?? "",
    country: campus.country ?? campus.network.headquartersCountry ?? "",
    denomination: campus.enrichment?.denominationNetwork ?? parentChurch?.denomination,
    location: campus.city,
    musicStyle: parentChurch?.musicStyle,
    notableArtists: parentChurch?.notableArtists,
    additionalPlaylists: parentChurch?.additionalPlaylists,
    email: campus.enrichment?.contactEmail,
    sourceKind: "discovered",
  };

  const metrics = await measureChurchStep(timings, "public.campus_quality", async () => deriveChurchQuality(campusAsChurch));
  const cached = parentChurch ? getCachedVideos(parentChurch) : [];
  const videos = await measureChurchStep(timings, "public.campus_videos", async () => selectChurchPageVideos(cached.map((v) => ({
    videoId: v.videoId,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    channelTitle: v.channelTitle ?? (parentChurch?.name ?? campus.name),
    viewCount: 0,
    channelId: v.channelId,
  })), { church: campusAsChurch, enrichment: campus.enrichment ?? null }));
  const mergedProfile = await measureChurchStep(timings, "public.campus_merged_profile", async () =>
    buildMergedProfile(campus.enrichment ?? null, edits, campusAsChurch),
  );
  const latestUpdates = await measureChurchStep(timings, "public.campus_updates", async () =>
    getChurchLatestUpdates(slug),
  );
  const display = await measureChurchStep(timings, "public.campus_display", async () => deriveDisplayAssessment({
    description: campusAsChurch.description,
    enrichmentSummary: campus.enrichment?.summary,
    country: campusAsChurch.country,
    location: campus.enrichment?.streetAddress || campusAsChurch.location,
    serviceTimeLabel: getFirstServiceTimeLabel(campus.enrichment?.serviceTimes),
    websiteUrl: campus.enrichment?.websiteUrl || campusAsChurch.website,
    contactEmail: campus.enrichment?.contactEmail || campusAsChurch.email,
    spotifyUrl: campusAsChurch.spotifyUrl,
    playlistCount: metrics.playlistCount,
    videoCount: videos.length,
    thumbnailUrl: resolveChurchPrimaryImage({
      headerImage: parentChurch?.headerImage,
      videos,
      coverImageUrl: campus.enrichment?.coverImageUrl,
    }),
    logoUrl: campusAsChurch.logo || campus.enrichment?.logoImageUrl,
    headerImage: parentChurch?.headerImage,
  }));
  timings["public.total"] = Math.round((performance.now() - totalStart) * 10) / 10;
  flushChurchTimingLog(slug, "campus", timings);

  return {
    church: {
      ...campusAsChurch,
      aliases: [campus.name],
      ...metrics,
      ...display,
    },
    videos,
    latestUpdates,
    enrichment: campus.enrichment ?? null,
    mergedProfile,
    badgeEligible: isBadgeEligibleFromMergedProfile(mergedProfile),
    updatedAt: campus.updatedAt,
    network: campus.network,
    campusCount: 0,
    isCampus: true,
    parentChurchName: parentChurch?.name,
  };
}

export const getChurchPublicPageData = unstable_cache(
  async (slug: string) => _getChurchPublicPageData(slug),
  ["church-page-public"],
  { revalidate: 3600, tags: ["church-page-public"] }
);

export async function getNearbyChurches(
  slug: string,
  lat: number,
  lng: number,
  limit = 4
): Promise<Array<{ slug: string; name: string; distance: number; country: string; location?: string }>> {
  if (!hasServiceConfig()) return [];
  const sb = createAdminClient();
  const canonicalSlug = resolveCanonicalChurchSlug(slug);
  type NearbyChurchRow = {
    church_slug: string;
    latitude: number;
    longitude: number;
  };
  // Fetch all enrichments with coordinates — bounding box pre-filter (~200km)
  const MAX_RADIUS_KM = 200;
  const latDelta = MAX_RADIUS_KM / 111;
  const lngDelta = MAX_RADIUS_KM / (111 * Math.cos((lat * Math.PI) / 180));

  const { data } = await sb
    .from("church_enrichments")
    .select("church_slug, latitude, longitude")
    .not("latitude", "is", null)
    .eq("enrichment_status", "complete")
    .gte("latitude", lat - latDelta)
    .lte("latitude", lat + latDelta)
    .gte("longitude", lng - lngDelta)
    .lte("longitude", lng + lngDelta);
  const nearbyRows = (data as NearbyChurchRow[] | null) ?? [];
  if (nearbyRows.length === 0) return [];

  const nearbyByCanonicalSlug = new Map<string, number>();
  for (const row of nearbyRows) {
    const nearbyCanonicalSlug = resolveCanonicalChurchSlug(row.church_slug);
    if (nearbyCanonicalSlug === canonicalSlug) continue;

    const dlat = (row.latitude - lat) * 111;
    const dlng = (row.longitude - lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const distance = Math.sqrt(dlat * dlat + dlng * dlng);
    if (distance > MAX_RADIUS_KM) continue;

    const existingDistance = nearbyByCanonicalSlug.get(nearbyCanonicalSlug);
    if (typeof existingDistance !== "number" || distance < existingDistance) {
      nearbyByCanonicalSlug.set(nearbyCanonicalSlug, distance);
    }
  }

  const matchedSlugs = Array.from(nearbyByCanonicalSlug.keys());
  if (matchedSlugs.length === 0) return [];
  const { data: churchRows } = await sb
    .from("churches")
    .select("slug,name,country,location")
    .in("slug", matchedSlugs)
    .eq("status", "approved");

  const churchMap = new Map(
    ((churchRows as Array<{ slug: string; name: string; country: string | null; location: string | null }>) ?? []).map(
      (row) => [row.slug, { slug: row.slug, name: row.name, country: row.country || "", location: row.location || undefined }]
    )
  );

  return matchedSlugs
    .map((matchedSlug): { slug: string; name: string; distance: number; country: string; location?: string } | null => {
      const church = churchMap.get(matchedSlug);
      const distance = nearbyByCanonicalSlug.get(matchedSlug);
      if (!church || typeof distance !== "number") return null;
      return { slug: matchedSlug, name: church.name, distance, country: church.country, location: church.location };
    })
    .filter((c): c is { slug: string; name: string; distance: number; country: string; location?: string } => c !== null)
    .sort(
      (
        a: { slug: string; name: string; distance: number; country: string; location?: string },
        b: { slug: string; name: string; distance: number; country: string; location?: string }
      ) => a.distance - b.distance
    )
    .slice(0, limit);
}

/**
 * Paginate a database query that may return >1000 rows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllRows<T = any>(
  buildQuery: (sb: ReturnType<typeof createAdminClient>, from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const sb = createAdminClient();
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(sb, from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export type EnrichmentHint = {
  summary?: string;
  summaryLength: number;
  serviceTimes?: string;
  location?: string;
  languages?: string[];
  hasSocial: boolean;
  dataRichnessScore: number;
};

export type ChurchIndexRow = {
  slug: string;
  name: string;
  description: string | null;
  spotify_playlist_ids: string[] | null;
  additional_playlists: string[] | null;
  logo: string | null;
  website: string | null;
  spotify_url: string | null;
  country: string | null;
  denomination: string | null;
  location: string | null;
  music_style: string[] | null;
  email: string | null;
  header_image: string | null;
  verified_at: string | null;
  last_researched: string | null;
  aliases: string[] | null;
  language: string | null;
  source_kind: ChurchConfig["sourceKind"] | null;
};

export type IndexEnrichmentHint = EnrichmentHint & {
  coverImageUrl?: string;
  logoImageUrl?: string;
};

type ChurchIndexPageData = {
  currentPage: number;
  totalCount: number;
  totalPages: number;
  pageItems: ChurchDirectoryEntry[];
};

type ChurchIndexQueryRow = ChurchIndexRow & {
  total_count?: number | string | bigint | null;
};

async function getEnrichmentMeta(): Promise<Map<string, IndexEnrichmentHint>> {
  if (isOfflinePublicBuild() || !hasServiceConfig()) return new Map();
  type EnrichmentMetaRow = {
    church_slug: string | null;
    summary: string | null;
    service_times: Array<{ day: string; time: string }> | null;
    street_address: string | null;
    languages: string[] | null;
    instagram_url: string | null;
    facebook_url: string | null;
    youtube_url: string | null;
    cover_image_url: string | null;
    logo_image_url: string | null;
  };
  const data = await fetchAllRows((sb, from, to) =>
    sb.from<EnrichmentMetaRow[]>("church_enrichments")
      .select("church_slug, summary, service_times, street_address, languages, instagram_url, facebook_url, youtube_url, cover_image_url, logo_image_url")
      .eq("enrichment_status", "complete")
      .range(from, to)
  );
  const map = new Map<string, IndexEnrichmentHint>();
  for (const row of data ?? []) {
    if (!row.church_slug) continue;
    const canonicalSlug = resolveCanonicalChurchSlug(row.church_slug);
    const summaryLength = (row.summary ?? "").length;
    const hasSocial = !!(row.instagram_url || row.facebook_url || row.youtube_url);
    const serviceTimes = getFirstServiceTimeLabel((row.service_times as Array<{ day: string; time: string }> | null) ?? []);
    const score = computeDataRichnessScore({
      summaryLength,
      hasServiceTimes: Boolean((row.service_times as unknown[])?.length),
      hasStreetAddress: Boolean(row.street_address),
      hasSocial,
    });
    const hint: IndexEnrichmentHint = {
      summary: summaryLength >= 40 ? normalizeDisplayText(row.summary as string) : undefined,
      summaryLength,
      serviceTimes,
      location: normalizeDisplayText(row.street_address as string | undefined),
      languages: row.languages ?? undefined,
      hasSocial,
      dataRichnessScore: score,
      coverImageUrl: rewriteLegacyMediaUrl(row.cover_image_url ?? undefined),
      logoImageUrl: rewriteLegacyMediaUrl(row.logo_image_url ?? undefined),
    };
    const existing = map.get(canonicalSlug);
    if (!existing || hint.dataRichnessScore > existing.dataRichnessScore || (
      hint.dataRichnessScore === existing.dataRichnessScore && row.church_slug === canonicalSlug
    )) {
      map.set(canonicalSlug, hint);
    }
  }
  return map;
}

export function mapEnrichmentMetaRow(row: {
  church_slug: string | null;
  summary: string | null;
  service_times: Array<{ day: string; time: string }> | null;
  street_address: string | null;
  languages: string[] | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
}): { slug: string; hint: IndexEnrichmentHint } | null {
  if (!row.church_slug) return null;
  const canonicalSlug = resolveCanonicalChurchSlug(row.church_slug);
  const summaryLength = (row.summary ?? "").length;
  const hasSocial = !!(row.instagram_url || row.facebook_url || row.youtube_url);
  const serviceTimes = getFirstServiceTimeLabel((row.service_times as Array<{ day: string; time: string }> | null) ?? []);
  const score = computeDataRichnessScore({
    summaryLength,
    hasServiceTimes: Boolean((row.service_times as unknown[])?.length),
    hasStreetAddress: Boolean(row.street_address),
    hasSocial,
  });

  return {
    slug: canonicalSlug,
    hint: {
      summary: summaryLength >= 40 ? normalizeDisplayText(row.summary as string) : undefined,
      summaryLength,
      serviceTimes,
      location: normalizeDisplayText(row.street_address as string | undefined),
      languages: row.languages ?? undefined,
      hasSocial,
      dataRichnessScore: score,
      coverImageUrl: rewriteLegacyMediaUrl(row.cover_image_url ?? undefined),
      logoImageUrl: rewriteLegacyMediaUrl(row.logo_image_url ?? undefined),
    },
  };
}

async function getEnrichmentMetaForSlugs(slugs: string[]): Promise<Map<string, IndexEnrichmentHint>> {
  if (isOfflinePublicBuild() || !hasServiceConfig() || slugs.length === 0) return new Map();
  const sb = createAdminClient();
  type EnrichmentMetaRow = {
    church_slug: string | null;
    summary: string | null;
    service_times: Array<{ day: string; time: string }> | null;
    street_address: string | null;
    languages: string[] | null;
    instagram_url: string | null;
    facebook_url: string | null;
    youtube_url: string | null;
    cover_image_url: string | null;
    logo_image_url: string | null;
  };
  const lookupSlugs = Array.from(new Set(slugs.flatMap((slug) => getChurchSlugLookupCandidates(slug))));
  const { data } = await sb
    .from<EnrichmentMetaRow>("church_enrichments")
    .select("church_slug, summary, service_times, street_address, languages, instagram_url, facebook_url, youtube_url, cover_image_url, logo_image_url")
    .eq("enrichment_status", "complete")
    .in("church_slug", lookupSlugs);

  const map = new Map<string, IndexEnrichmentHint>();
  for (const row of (data as EnrichmentMetaRow[] | null) ?? []) {
    const mapped = mapEnrichmentMetaRow(row);
    if (!mapped) continue;
    const existing = map.get(mapped.slug);
    if (!existing || mapped.hint.dataRichnessScore > existing.dataRichnessScore || (
      mapped.hint.dataRichnessScore === existing.dataRichnessScore && row.church_slug === mapped.slug
    )) {
      map.set(mapped.slug, mapped.hint);
    }
  }
  return map;
}

async function getChurchIndexRows(): Promise<ChurchIndexRow[]> {
  if (isOfflinePublicBuild() || !hasServiceConfig()) return [];
  const rows = await fetchAllRows((sb, from, to) =>
    sb.from<ChurchIndexRow[]>("churches")
      .select("slug, name, description, spotify_playlist_ids, additional_playlists, logo, website, spotify_url, country, denomination, location, music_style, email, header_image, verified_at, last_researched, aliases, language, source_kind")
      .eq("status", "approved")
      .order("name")
      .range(from, to)
  );
  return filterExplicitNonChurchRows(rows);
}

// Exported for scripts/backfill-facet-columns.ts: the backfill builds index
// records via this exact function so the materialized directory_score equals
// the runtime getDirectoryScore input (zero-drift).
export function mapChurchToIndexRecord(church: ChurchConfig, enrichmentHint?: IndexEnrichmentHint) {
  const normalizedChurch: ChurchConfig = {
    ...church,
    logo: rewriteLegacyMediaUrl(church.logo) || "",
    headerImage: rewriteLegacyMediaUrl(church.headerImage || enrichmentHint?.coverImageUrl),
  };
  const metrics = deriveChurchQuality(normalizedChurch);
  const resolvedDescription = resolveChurchPublicDescription({
    church: normalizedChurch,
    enrichmentSummary: enrichmentHint?.summary,
    enrichmentLocation: enrichmentHint?.location,
    languages: enrichmentHint?.languages,
  });
  const thumbnailUrl = resolveChurchPrimaryImage({
    headerImage: normalizedChurch.headerImage,
    coverImageUrl: enrichmentHint?.coverImageUrl,
  });
  const logoUrl = normalizedChurch.logo || enrichmentHint?.logoImageUrl;
  const display = deriveDisplayAssessment({
    description: resolvedDescription,
    enrichmentSummary: enrichmentHint?.summary,
    country: normalizedChurch.country,
    location: enrichmentHint?.location || normalizedChurch.location,
    serviceTimeLabel: enrichmentHint?.serviceTimes,
    websiteUrl: normalizedChurch.website,
    contactEmail: normalizedChurch.email,
    spotifyUrl: normalizedChurch.spotifyUrl,
    playlistCount: metrics.playlistCount,
    videoCount: 0,
    thumbnailUrl,
    logoUrl,
    headerImage: normalizedChurch.headerImage,
  });

  return {
    ...normalizedChurch,
    description: resolvedDescription,
    aliases: buildChurchAliases(normalizedChurch),
    ...metrics,
    ...display,
    songCount: 0,
    thumbnailUrl,
    logo: logoUrl,
    updatedAt: metrics.verifiedAt,
    enrichmentHint,
  };
}

export function mapChurchIndexRowToConfig(row: ChurchIndexRow, enrichmentHint?: IndexEnrichmentHint): ChurchConfig {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    spotifyPlaylistIds: row.spotify_playlist_ids || [],
    logo: rewriteLegacyMediaUrl(row.logo) || "",
    website: row.website || "",
    spotifyUrl: row.spotify_url || "",
    country: row.country || "",
    denomination: row.denomination || undefined,
    location: row.location || undefined,
    musicStyle: row.music_style || undefined,
    additionalPlaylists: row.additional_playlists || undefined,
    email: row.email || undefined,
    headerImage: rewriteLegacyMediaUrl(row.header_image || enrichmentHint?.coverImageUrl),
    verifiedAt: row.verified_at || undefined,
    lastResearched: row.last_researched || undefined,
    aliases: row.aliases || undefined,
    language: row.language || undefined,
    sourceKind: row.source_kind || undefined,
  };
}

function withDirectoryMatchReasons(church: ChurchDirectoryEntry, filters: ChurchDirectoryFilters): ChurchDirectoryEntry {
  const matchReasons = buildChurchMatchReasons(church, filters);
  return matchReasons.length > 0 ? { ...church, matchReasons } : church;
}

function getLocalChurchIndexPageData(filters: ChurchDirectoryFilters, requestedPage: number, pageSize: number): ChurchIndexPageData {
  const filtered = filterChurchDirectory(
    filterCanonicalChurchSlugRecords(getLocalChurchSnapshot()).map((church) => mapChurchToIndexRecord(church)),
    filters,
  );
  const page = paginateChurches(filtered, requestedPage, pageSize);
  return {
    ...page,
    pageItems: page.pageItems.map((church) => withDirectoryMatchReasons(church, filters)),
  };
}

function getChurchIndexExcludedSlugs(): string[] {
  return Array.from(new Set([
    ...getExplicitNonChurchSlugs(),
    ...getChurchSlugRedirectAliases(),
  ]));
}

function toCount(value: number | string | bigint | null | undefined): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

function normalizePage(page: number): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function getSqlLikePatterns(values: string[]): string[] {
  return values.map((value) => `%${value}%`);
}

function buildChurchIndexWhereClause(filters: ChurchDirectoryFilters) {
  const params: unknown[] = [getChurchIndexExcludedSlugs()];
  const clauses = [
    "status = 'approved'",
    "NOT (slug = ANY($1::text[]))",
  ];
  const trimmedQuery = filters.query?.trim() ?? "";

  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    params.push(pattern);
    clauses.push(`(
          name ILIKE $2
          OR description ILIKE $2
          OR country ILIKE $2
          OR location ILIKE $2
          OR denomination ILIKE $2
          OR array_to_string(music_style, ' ') ILIKE $2
          OR array_to_string(aliases, ' ') ILIKE $2
        )`);
  }

  if (filters.styleSlug) {
    const filter = getStyleFilterBySlug(filters.styleSlug);
    if (filter) {
      params.push(getSqlLikePatterns(filter.match));
      clauses.push(`array_to_string(music_style, ' ') ILIKE ANY($${params.length}::text[])`);
    }
  }

  if (filters.denominationSlug) {
    const filter = getDenominationFilterBySlug(filters.denominationSlug);
    if (filter) {
      params.push(getSqlLikePatterns(filter.match));
      clauses.push(`denomination ILIKE ANY($${params.length}::text[])`);
    }
  }

  if (filters.citySlug) {
    params.push(filters.citySlug);
    clauses.push(`city_slug = $${params.length}`);
  }

  // Country facet: the facade resolves countrySlug → exact country string via
  // the SAME slugify over the small distinct-country set (zero-drift, no
  // country_slug column needed — only ~200 distinct countries).
  if (filters.country) {
    params.push(filters.country);
    clauses.push(`country = $${params.length}`);
  }

  // Browse parity: the old in-memory filterChurchDirectory hides
  // displayReady === false when there is no search query ("When browsing, hide
  // churches that aren't display-ready"). Search mode shows all, as before.
  if (!trimmedQuery) {
    clauses.push("directory_ready IS NOT FALSE");
  }

  if (filters.language) {
    params.push(`%${filters.language.trim()}%`);
    const index = params.length;
    clauses.push(`(
      language ILIKE $${index}
      OR EXISTS (
        SELECT 1 FROM church_enrichments ce
        WHERE ce.church_slug = churches.slug
          AND ce.enrichment_status = 'complete'
          AND array_to_string(ce.languages, ' ') ILIKE $${index}
      )
    )`);
  }

  if (filters.hasKids) {
    clauses.push(`EXISTS (
      SELECT 1 FROM church_enrichments ce
      WHERE ce.church_slug = churches.slug
        AND ce.enrichment_status = 'complete'
        AND (ce.children_ministry = true OR ce.youth_ministry = true)
    )`);
  }

  if (filters.hasServiceTimes) {
    clauses.push(`EXISTS (
      SELECT 1 FROM church_enrichments ce
      WHERE ce.church_slug = churches.slug
        AND ce.enrichment_status = 'complete'
        AND ce.service_times IS NOT NULL
        AND jsonb_typeof(ce.service_times) = 'array'
        AND jsonb_array_length(ce.service_times) > 0
    )`);
  }

  if (filters.hasMusic) {
    clauses.push(`(
      coalesce(cardinality(spotify_playlist_ids), 0) + coalesce(cardinality(additional_playlists), 0) > 0
      OR coalesce(spotify_url, '') <> ''
    )`);
  }

  return {
    sql: clauses.join("\n        AND "),
    params,
  };
}

/**
 * Page-rows query: drops `count(*) OVER()` to avoid full-table sort spill.
 * The total count is fetched separately (and cached) — see `getChurchIndexTotalCountCached`.
 * On cold isolate, this query now uses index-only scans + early LIMIT instead of
 * materializing all matching rows in memory before pagination.
 */
async function fetchChurchIndexPageRows(filters: ChurchDirectoryFilters, currentPage: number, pageSize: number): Promise<ChurchIndexQueryRow[]> {
  const sql = getSql();
  const offset = (currentPage - 1) * pageSize;
  const trimmedQuery = filters.query?.trim() ?? "";
  const where = buildChurchIndexWhereClause(filters);
  const prefixPattern = `${trimmedQuery}%`;

  if (trimmedQuery) {
    return (await sql.query(`
      SELECT
        slug, name, description, spotify_playlist_ids, additional_playlists, logo, website, spotify_url,
        country, denomination, location, music_style, email, header_image, verified_at, last_researched,
        aliases, language, source_kind
      FROM churches
      WHERE ${where.sql}
      ORDER BY
        CASE
          WHEN name ILIKE $${where.params.length + 1} THEN 100
          WHEN name ILIKE $2 THEN 70
          WHEN location ILIKE $${where.params.length + 1} THEN 60
          WHEN location ILIKE $2 THEN 45
          WHEN country ILIKE $${where.params.length + 1} THEN 35
          WHEN country ILIKE $2 THEN 30
          ELSE 10
        END DESC,
        CASE
          WHEN coalesce(cardinality(spotify_playlist_ids), 0) + coalesce(cardinality(additional_playlists), 0) > 0
            OR coalesce(spotify_url, '') <> ''
          THEN 1 ELSE 0
        END DESC,
        name ASC
      LIMIT $${where.params.length + 2}
      OFFSET $${where.params.length + 3}
    `, [...where.params, prefixPattern, pageSize, offset])) as ChurchIndexQueryRow[];
  }

  return (await sql.query(`
    SELECT
      slug, name, description, spotify_playlist_ids, additional_playlists, logo, website, spotify_url,
      country, denomination, location, music_style, email, header_image, verified_at, last_researched,
      aliases, language, source_kind
    FROM churches
    WHERE ${where.sql}
    -- Browse parity (locked): directory_rank is the global snapshot rank
    -- assigned by the EXACT JS browse comparator (compareDirectoryEntries) in
    -- scripts/backfill-facet-columns.ts. Ordering by it reproduces the old
    -- in-memory order byte-for-byte with zero SQL-collation / playlistCount
    -- drift. NULL rank (un-reconciled new row) sinks last — no name-sort
    -- fallback that would re-introduce the collation mismatch.
    ORDER BY directory_rank ASC NULLS LAST
    LIMIT $${where.params.length + 1}
    OFFSET $${where.params.length + 2}
  `, [...where.params, pageSize, offset])) as ChurchIndexQueryRow[];
}

async function fetchChurchIndexTotalCount(filters: ChurchDirectoryFilters): Promise<number> {
  const sql = getSql();
  const where = buildChurchIndexWhereClause(filters);

  const rows = (await sql.query(`
    SELECT count(*)::int AS count
    FROM churches
    WHERE ${where.sql}
  `, where.params)) as Array<{ count: number | string | bigint }>;
  return toCount(rows[0]?.count);
}

/**
 * Related-link facets over a facet subset, computed in SQL instead of by
 * pulling the full index and running getCountryLinks/getStyleLinks/
 * getDenominationLinks in JS. Parity is byte-for-byte:
 *
 *  - style/denom: ONE aggregate scan of the subset, one count(*) FILTER per
 *    STYLE_FILTERS / DENOMINATION_FILTERS entry. The FILTER predicate is the
 *    exact matchesStyle / matchesDenomination logic (`value.toLowerCase()
 *    .includes(candidate)` → `position(candidate in lower(value)) > 0`,
 *    candidates already lowercase). The .filter(count>0).sort(count DESC ||
 *    label.localeCompare).slice(limit) tail mirrors the JS builders exactly.
 *  - country: GROUP BY country over the subset, then slugify in JS (same
 *    slugify) and merge — distinct country strings collapsing to one slug is
 *    effectively impossible in clean data; on collision the higher-count /
 *    alphabetically-first country wins (deterministic; parity test guards).
 *
 * `filters` is the facet predicate in BROWSE mode (no query) so the
 * directory_ready exclusion applies, matching the page's own list.
 */
export type FacetRelatedLinks = {
  country: FacetLink[];
  city: FacetLink[];
  style: FacetLink[];
  denomination: FacetLink[];
};

function sortFacetLinks(links: FacetLink[]): FacetLink[] {
  return [...links].sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label));
}

export async function fetchFacetRelatedLinks(
  filters: ChurchDirectoryFilters,
  limits?: { country?: number; city?: number; style?: number; denomination?: number },
): Promise<FacetRelatedLinks> {
  const sql = getSql();
  const where = buildChurchIndexWhereClause(filters);
  const params: unknown[] = [...where.params];

  const styleExprs = STYLE_FILTERS.map((f) => {
    const ors = f.match.map((cand) => {
      params.push(cand.toLowerCase());
      return `position($${params.length} in lower(ms)) > 0`;
    });
    return `count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM unnest(coalesce(music_style, '{}'::text[])) ms
      WHERE ${ors.join(" OR ")}
    ))::int`;
  });
  const denomExprs = DENOMINATION_FILTERS.map((f) => {
    const ors = f.match.map((cand) => {
      params.push(cand.toLowerCase());
      return `position($${params.length} in lower(denomination)) > 0`;
    });
    return `count(*) FILTER (WHERE denomination IS NOT NULL AND (${ors.join(" OR ")}))::int`;
  });

  const aggSelect = [
    ...styleExprs.map((e, i) => `${e} AS s${i}`),
    ...denomExprs.map((e, i) => `${e} AS d${i}`),
  ].join(",\n    ");

  const [aggRow] = (await sql.query(
    `SELECT ${aggSelect} FROM churches WHERE ${where.sql}`,
    params,
  )) as Array<Record<string, number>>;

  const style = sortFacetLinks(
    STYLE_FILTERS.map((f, i) => ({
      slug: f.slug,
      label: f.seoLabel,
      href: `/church/style/${f.slug}`,
      count: aggRow?.[`s${i}`] ?? 0,
    })).filter((l) => l.count > 0),
  );
  const denomination = sortFacetLinks(
    DENOMINATION_FILTERS.map((f, i) => ({
      slug: f.slug,
      label: f.label,
      href: `/church/denomination/${f.slug}`,
      count: aggRow?.[`d${i}`] ?? 0,
    })).filter((l) => l.count > 0),
  );

  const countryRows = (await sql.query(
    `SELECT country, count(*)::int AS count
     FROM churches
     WHERE ${where.sql} AND coalesce(country, '') <> ''
     GROUP BY country`,
    where.params,
  )) as Array<{ country: string; count: number }>;
  const bySlug = new Map<string, { label: string; count: number; topCountry: string; topCount: number }>();
  for (const r of countryRows) {
    const slug = slugify(r.country);
    if (!slug) continue;
    const entry = bySlug.get(slug);
    if (!entry) {
      bySlug.set(slug, { label: r.country, count: r.count, topCountry: r.country, topCount: r.count });
    } else {
      entry.count += r.count;
      // Collision-only determinism: highest-count country wins the label,
      // alphabetical on tie. No-collision case → label === r.country (= JS).
      if (r.count > entry.topCount || (r.count === entry.topCount && r.country < entry.topCountry)) {
        entry.topCount = r.count;
        entry.topCountry = r.country;
        entry.label = r.country;
      }
    }
  }
  const country = sortFacetLinks(
    [...bySlug.entries()].map(([slug, v]) => ({
      slug,
      label: v.label,
      href: `/church/country/${slug}`,
      count: v.count,
    })),
  );

  // City links: city_slug is materialized; the label is extractCity(location)
  // of a representative row (deterministic via ORDER BY slug in array_agg),
  // mirroring getCityLinks (which keys by slugify(extractCity(location)) and
  // labels with the first-seen extracted city).
  const cityRows = (await sql.query(
    `SELECT city_slug,
            count(*)::int AS count,
            (array_agg(location ORDER BY slug))[1] AS sample_location
     FROM churches
     WHERE ${where.sql} AND city_slug IS NOT NULL AND city_slug <> ''
     GROUP BY city_slug`,
    where.params,
  )) as Array<{ city_slug: string; count: number; sample_location: string | null }>;
  const city = sortFacetLinks(
    cityRows
      .map((r) => ({
        slug: r.city_slug,
        label: extractCity(r.sample_location ?? undefined) ?? "",
        href: `/church/city/${r.city_slug}`,
        count: r.count,
      }))
      .filter((l) => l.label),
  );

  const cap = (links: FacetLink[], n?: number) =>
    typeof n === "number" ? links.slice(0, n) : links;
  return {
    country: cap(country, limits?.country),
    city: cap(city, limits?.city),
    style: cap(style, limits?.style),
    denomination: cap(denomination, limits?.denomination),
  };
}

/**
 * Cached count query — keyed on filter shape via the function args.
 * 1h TTL; invalidates with CHURCH_INDEX_TAG when an admin action fires
 * `revalidatePublicChurchContent()` in src/lib/content.ts.
 */
const getChurchIndexTotalCountCached = unstable_cache(
  async (filters: ChurchDirectoryFilters): Promise<number> => fetchChurchIndexTotalCount(filters),
  ["church-index-total-count-v1"],
  { revalidate: 3600, tags: [CHURCH_INDEX_TAG] }
);

export async function getChurchIndexPageData(input: {
  query?: string;
  filters?: Omit<ChurchDirectoryFilters, "query">;
  page: number;
  pageSize: number;
}): Promise<ChurchIndexPageData> {
  const filters: ChurchDirectoryFilters = {
    ...(input.filters ?? {}),
    query: input.query?.trim().slice(0, 80) ?? "",
  };
  const requestedPage = normalizePage(input.page);

  if (isOfflinePublicBuild() || !hasServiceConfig()) {
    return getLocalChurchIndexPageData(filters, requestedPage, input.pageSize);
  }

  try {
    // Page rows + total count run in parallel. Count is cached via
    // `getChurchIndexTotalCountCached` so most hits skip the DB entirely.
    const [firstRows, totalCount] = await Promise.all([
      fetchChurchIndexPageRows(filters, requestedPage, input.pageSize),
      getChurchIndexTotalCountCached(filters),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));
    const currentPage = Math.min(requestedPage, totalPages);
    const rows = currentPage === requestedPage ? firstRows : await fetchChurchIndexPageRows(filters, currentPage, input.pageSize);
    const filteredRows = filterExplicitNonChurchRows(filterCanonicalChurchSlugRecords(rows));
    const enrichmentMeta = await getEnrichmentMetaForSlugs(filteredRows.map((row) => row.slug));
    const pageItems = filteredRows.map((row) => {
      const enrichmentHint = enrichmentMeta.get(row.slug);
      return withDirectoryMatchReasons(
        mapChurchToIndexRecord(mapChurchIndexRowToConfig(row, enrichmentHint), enrichmentHint),
        filters,
      );
    });

    return {
      currentPage,
      totalCount,
      totalPages,
      pageItems,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[church-index-page] Falling back to local snapshot: ${detail}`);
    return getLocalChurchIndexPageData(filters, requestedPage, input.pageSize);
  }
}

// Distinct approved countries (~200 rows, well under 2 MB) cached cross-isolate
// so countrySlug → exact country resolves without scanning the full index.
// SAME slugify as the old getCountryLabelFromSlug, so zero-drift.
const _getDistinctCountries = unstable_cache(
  async (): Promise<string[]> => {
    const sql = getSql();
    const rows = (await sql.query(
      `SELECT DISTINCT country FROM churches
       WHERE status = 'approved' AND coalesce(country, '') <> ''`,
    )) as Array<{ country: string }>;
    return rows.map((r) => r.country);
  },
  ["distinct-countries-v1"],
  { revalidate: CHURCH_INDEX_CACHE_SECONDS, tags: [CHURCH_INDEX_TAG] },
);

async function resolveCountryFromSlug(countrySlug: string): Promise<string | undefined> {
  const countries = await _getDistinctCountries();
  return countries.find((c) => slugify(c) === countrySlug);
}

async function resolveCityLabelFromSlug(citySlug: string): Promise<string | undefined> {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT location FROM churches
     WHERE status = 'approved' AND city_slug = $1 AND directory_ready IS NOT FALSE
     LIMIT 1`,
    [citySlug],
  )) as Array<{ location: string | null }>;
  if (rows.length === 0) return undefined;
  return extractCity(rows[0]?.location ?? undefined);
}

export type FacetKind = "city" | "country" | "style" | "denomination";

export type ChurchFacetPageData = {
  pageItems: ChurchDirectoryEntry[];
  currentPage: number;
  totalCount: number;
  totalPages: number;
  label: string;
  relatedLinks: FacetRelatedLinks;
  breadcrumbCountry: FacetLink | null;
};

// Single public entry point for the four facet pages. Encapsulates the
// filter/label resolution, the (reused, parity-proven) paginated index path,
// and the SQL related-links — so pages never touch SQL internals or pull the
// full index. Returns null when the slug doesn't resolve → page calls
// notFound() FAST (no slow full-scan path → no 503).
export async function getChurchFacetPageData(input: {
  kind: FacetKind;
  slug: string;
  page: number;
  pageSize: number;
}): Promise<ChurchFacetPageData | null> {
  const { kind, slug } = input;
  let filters: ChurchDirectoryFilters;
  let label: string;

  if (kind === "city") {
    const cityLabel = await resolveCityLabelFromSlug(slug);
    if (!cityLabel) return null;
    filters = { citySlug: slug };
    label = cityLabel;
  } else if (kind === "country") {
    const country = await resolveCountryFromSlug(slug);
    if (!country) return null;
    filters = { country };
    label = country;
  } else if (kind === "style") {
    const filter = getStyleFilterBySlug(slug);
    if (!filter) return null;
    filters = { styleSlug: slug };
    label = filter.seoLabel;
  } else {
    const filter = getDenominationFilterBySlug(slug);
    if (!filter) return null;
    filters = { denominationSlug: slug };
    label = filter.label;
  }

  // Per-kind related-link limits, matching what each page rendered before.
  const limits: Record<FacetKind, { country?: number; city?: number; style?: number; denomination?: number }> = {
    city: { country: 12, style: 8, denomination: 8 },
    country: { city: 12, style: 8, denomination: 8 },
    style: { country: 12, city: 12, denomination: 8 },
    denomination: { country: 12, city: 12, style: 8 },
  };

  const [pageData, relatedLinks] = await Promise.all([
    getChurchIndexPageData({ filters, page: input.page, pageSize: input.pageSize }),
    fetchFacetRelatedLinks(filters, limits[kind]),
  ]);

  if (pageData.totalCount === 0) return null;

  const breadcrumbCountry =
    kind === "city" && relatedLinks.country.length === 1 ? relatedLinks.country[0] : null;

  return { ...pageData, label, relatedLinks, breadcrumbCountry };
}

// Exported for scripts/backfill-facet-columns.ts: the backfill ranks the
// EXACT array this returns (same enrichment-meta dedup, same mappers) so
// directory_rank/score/city_slug cannot drift from the runtime old path.
export async function _getChurchIndexData() {
  if (isOfflinePublicBuild() || !hasServiceConfig()) {
    return filterCanonicalChurchSlugRecords(getLocalChurchSnapshot()).map((church) => mapChurchToIndexRecord(church));
  }

  try {
    const [rows, enrichmentMeta] = await Promise.all([
      getChurchIndexRows(),
      getEnrichmentMeta(),
    ]);

    if (rows.length === 0) {
      console.error("[church-index] Falling back to local snapshot: public query returned 0 churches");
      return filterCanonicalChurchSlugRecords(getLocalChurchSnapshot()).map((church) => mapChurchToIndexRecord(church));
    }

    const churches = filterCanonicalChurchSlugRecords(rows).map((row) => {
      const enrichmentHint = enrichmentMeta.get(row.slug);
      return mapChurchToIndexRecord(mapChurchIndexRowToConfig(row, enrichmentHint), enrichmentHint);
    });

    if (churches.length === 0) {
      console.error("[church-index] Falling back to local snapshot: mapped church index was empty");
      return filterCanonicalChurchSlugRecords(getLocalChurchSnapshot()).map((church) => mapChurchToIndexRecord(church));
    }

    return churches;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[church-index] Falling back to local snapshot: ${detail}`);
    return filterCanonicalChurchSlugRecords(getLocalChurchSnapshot()).map((church) => mapChurchToIndexRecord(church));
  }
}

function buildChurchIndexSummaryLookup(
  churches: Array<{ slug: string; name: string; logo?: string; country: string }>,
): Map<string, ChurchIndexSummary> {
  return new Map(
    churches.map((church) => [
      church.slug,
      {
        slug: church.slug,
        name: church.name,
        logo: church.logo,
        country: church.country,
      },
    ]),
  );
}

// R2-backed cross-isolate cache. Without this, every fresh Cloudflare Worker
// isolate re-pulls all 79k churches + enrichments (~70 MB) since the
// module-level cache below only lives in a single isolate's memory. Egress
// blew up to 1.5 TB/month before this was added. Invalidated by
// revalidateTag(CHURCH_INDEX_TAG) (cron sync + admin actions).
//
// NOTE: facet/sitemap hot paths no longer call this — they use the
// materialized city_slug/directory_score columns + paginated queries. This
// remains for the search path; the prior module-cache revert was discarded.
const _getChurchIndexDataFromBackend = unstable_cache(
  async () => _getChurchIndexData(),
  ["church-index-data-v1"],
  { revalidate: CHURCH_INDEX_CACHE_SECONDS, tags: [CHURCH_INDEX_TAG] },
);

export async function getChurchIndexData() {
  if (churchIndexDataCache && churchIndexDataCache.expiresAt > Date.now()) {
    return churchIndexDataCache.value;
  }

  if (!churchIndexDataPromise) {
    churchIndexDataPromise = _getChurchIndexDataFromBackend()
      .then((value) => {
        const expiresAt = Date.now() + CHURCH_INDEX_CACHE_SECONDS * 1000;
        churchIndexDataCache = { value, expiresAt };
        churchIndexSummaryCache = {
          value: buildChurchIndexSummaryLookup(value),
          expiresAt,
        };
        return value;
      })
      .finally(() => {
        churchIndexDataPromise = null;
      });
  }

  return churchIndexDataPromise;
}

export async function getChurchIndexSummaryLookup(): Promise<Map<string, ChurchIndexSummary>> {
  if (churchIndexSummaryCache && churchIndexSummaryCache.expiresAt > Date.now()) {
    return churchIndexSummaryCache.value;
  }

  if (churchIndexDataCache && churchIndexDataCache.expiresAt > Date.now()) {
    const value = buildChurchIndexSummaryLookup(churchIndexDataCache.value);
    churchIndexSummaryCache = {
      value,
      expiresAt: churchIndexDataCache.expiresAt,
    };
    return value;
  }

  if (!churchIndexSummaryPromise) {
    churchIndexSummaryPromise = getChurchIndexData()
      .then((churches) => {
        const expiresAt = Date.now() + CHURCH_INDEX_CACHE_SECONDS * 1000;
        const value = buildChurchIndexSummaryLookup(churches);
        churchIndexSummaryCache = { value, expiresAt };
        return value;
      })
      .finally(() => {
        churchIndexSummaryPromise = null;
      });
  }

  return churchIndexSummaryPromise;
}

const getClaimedChurchSlugList = unstable_cache(
  async (): Promise<string[]> => {
    if (!hasServiceConfig()) return [];
    try {
      const client = createAdminClient();
      const { data } = await client
        .from<{ church_slug: string }>('church_memberships')
        .select('church_slug')
        .eq('status', 'active');
      return ((data as Array<{ church_slug: string }> | null) ?? []).map((row) => row.church_slug);
    } catch {
      return [];
    }
  },
  ["claimed-church-slugs-v1"],
  { revalidate: CHURCH_CLAIM_STATUS_SECONDS, tags: [CHURCH_CLAIM_STATUS_TAG] },
);

export function revalidateChurchClaimStatus(): void {
  revalidateTag(CHURCH_CLAIM_STATUS_TAG, "max");
}

export async function checkChurchClaimed(slug: string): Promise<boolean> {
  if (!hasServiceConfig()) return false;
  const claimedSlugs = await getClaimedChurchSlugList();
  return claimedSlugs.includes(slug);
}

export async function getClaimedChurchSlugs(): Promise<Set<string>> {
  return new Set(await getClaimedChurchSlugList());
}

export async function getChurchProfileScore(slug: string) {
  const [church, enrichment, edits, isClaimed] = await Promise.all([
    getChurchBySlugAsync(slug),
    getChurchEnrichment(slug),
    getApprovedProfileEditsForChurch(slug),
    checkChurchClaimed(slug),
  ]);
  if (!church) {
    const mergedProfile = buildMergedProfile(enrichment, edits);
    return { profileScore: calculateProfileScore({ isClaimed, mergedData: mergedProfile }), mergedProfile };
  }
  return buildChurchPageProfile({ church, enrichment, edits, isClaimed });
}
