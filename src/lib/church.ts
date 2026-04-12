import { revalidateTag, unstable_cache } from "next/cache";
import { getChurchLatestUpdates } from "@/lib/church-updates";
import { uniqueSpotifyPlaylistIds } from "@/lib/spotify-playlist";
import type { ChurchProfileEdit, YouTubeVideo, ChurchEnrichment, ChurchProfileScore } from "@/types/gospel";
import type { ChurchConfig } from "@/types/gospel";
import { getChurchBySlugAsync, getLocalChurchSnapshot } from "@/lib/content";
import { CONTENT_UPDATED_AT, normalizeText, tokenSimilarity } from "@/lib/utils";
import { hasServiceConfig, createAdminClient } from "@/lib/neon-client";
import { getCampusBySlug } from "@/lib/church-networks";
import { getApprovedProfileEditsForChurch, buildMergedProfile } from "@/lib/church-profile";
import { calculateProfileScore } from "@/lib/profile-score";
import { rewriteLegacyMediaUrl } from "@/lib/media";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import {
  filterCanonicalChurchSlugRecords,
  getChurchSlugLookupCandidates,
  resolveCanonicalChurchSlug,
} from "@/lib/church-slugs";
import { filterExplicitNonChurchRows } from "@/lib/non-church-slugs";
import {
  deriveDisplayAssessment,
  getFirstServiceTimeLabel,
  getCompactLocationLabel,
  isGeneratedChurchDescription,
  normalizeDisplayText,
} from "@/lib/content-quality";

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
  const videoThumbnail = videos?.find((video) => typeof video?.thumbnailUrl === "string" && video.thumbnailUrl.trim().length > 0)
    ?.thumbnailUrl
    ?.trim();

  return [headerImage, videoThumbnail, coverImageUrl]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim();
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

type ChurchIndexRow = {
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

type IndexEnrichmentHint = EnrichmentHint & {
  coverImageUrl?: string;
  logoImageUrl?: string;
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
    let score = 0;
    if (summaryLength >= 80) score += 40;
    if ((row.service_times as unknown[])?.length) score += 30;
    if (row.street_address) score += 20;
    if (hasSocial) score += 10;
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

function mapChurchToIndexRecord(church: ChurchConfig, enrichmentHint?: IndexEnrichmentHint) {
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

async function _getChurchIndexData() {
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
      const church: ChurchConfig = {
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

      return mapChurchToIndexRecord(church, enrichmentHint);
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

export async function getChurchIndexData() {
  if (churchIndexDataCache && churchIndexDataCache.expiresAt > Date.now()) {
    return churchIndexDataCache.value;
  }

  if (!churchIndexDataPromise) {
    churchIndexDataPromise = _getChurchIndexData()
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
