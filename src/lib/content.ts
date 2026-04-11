import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import churchesJson from "@/data/churches.json";
import staffPicksJson from "@/data/staff-picks.json";
import trendingJson from "@/data/cache/trending.json";
import type { ChurchConfig, CatalogVideo } from "@/types/gospel";
import { hasServiceConfig, createAdminClient } from "@/lib/neon-client";
import { rewriteLegacyMediaUrl } from "@/lib/media";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import {
  getCompactLocationLabel,
  isGeneratedChurchDescription,
  isPlayableSpotifyUrl,
  normalizeDisplayText,
} from "@/lib/content-quality";
import {
  filterCanonicalChurchSlugRecords,
  getChurchSlugLookupCandidates,
  resolveCanonicalChurchSlug,
} from "@/lib/church-slugs";
import { filterExplicitNonChurchRows, isExplicitNonChurchSlug } from "@/lib/non-church-slugs";
import { uniqueSpotifyPlaylistIds } from "@/lib/spotify-playlist";

const CHURCH_CONTENT_TAG = "church-content";
const CHURCH_INDEX_TAG = "church-index";
const CHURCH_STATS_TAG = "church-stats";
const CHURCH_PAGE_TAG = "church-page";
const CHURCH_PAGE_PUBLIC_TAG = "church-page-public";
const HOME_TAG = "home";
const EMPTY_CHURCH_DIRECTORY_ERROR = "No approved churches returned from database";

export type ChurchDirectorySeed = Pick<
  ChurchConfig,
  "slug" | "name" | "country" | "location" | "musicStyle" | "denomination"
>;

export type HomepageShowcaseChurch = {
  slug: string;
  name: string;
  description: string;
  country: string;
  location?: string;
  logo?: string;
  playlistCount?: number;
  updatedAt?: string;
  musicStyle?: string[];
  thumbnailUrl?: string;
};

type ChurchDirectorySeedRow = {
  slug: string;
  name: string;
  country: string | null;
  location: string | null;
  music_style: string[] | null;
  denomination: string | null;
};

type ChurchDataRow = ChurchDirectorySeedRow & {
  description: string | null;
  spotify_playlist_ids: string[] | null;
  spotify_playlists: ChurchConfig["spotifyPlaylists"] | null;
  logo: string | null;
  website: string | null;
  spotify_url: string | null;
  founded: number | null;
  notable_artists: string[] | null;
  youtube_channel_id: string | null;
  spotify_artist_ids: string[] | null;
  additional_playlists: string[] | null;
  email: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  header_image: string | null;
  header_image_attribution: string | null;
  last_researched: string | null;
  verified_at: string | null;
  show_email_publicly: boolean | null;
  aliases: string[] | null;
  language: string | null;
  source_kind: ChurchConfig["sourceKind"] | null;
  youtube_videos?: ChurchConfig["youtubeVideos"] | null;
};

let localChurchSnapshotCache: ChurchConfig[] | null = null;
let fallbackChurchMapCache: Map<string, ChurchConfig> | null = null;
const loggedChurchFallbacks = new Set<string>();

function tryLoadLocalChurchSnapshot(): ChurchConfig[] {
  if (localChurchSnapshotCache) {
    return localChurchSnapshotCache;
  }

  localChurchSnapshotCache = filterExplicitNonChurchRows(
    filterCanonicalChurchSlugRecords(churchesJson as ChurchConfig[]),
  );
  return localChurchSnapshotCache;
}

function logChurchSnapshotFallback(scope: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  const key = `${scope}:${detail}`;
  if (loggedChurchFallbacks.has(key)) {
    return;
  }
  loggedChurchFallbacks.add(key);
  console.error(`[church-content] Falling back to local snapshot for ${scope}: ${detail}`);
}

function getFallbackChurchSnapshot(scope: string, error: unknown): ChurchConfig[] {
  logChurchSnapshotFallback(scope, error);
  return tryLoadLocalChurchSnapshot();
}

function createEmptyChurchDirectoryError(): Error {
  return new Error(EMPTY_CHURCH_DIRECTORY_ERROR);
}

function getFallbackChurchMap(): Map<string, ChurchConfig> {
  if (!fallbackChurchMapCache) {
    fallbackChurchMapCache = new Map(
      tryLoadLocalChurchSnapshot().map((church) => [church.slug, church]),
    );
  }

  return fallbackChurchMapCache;
}

function toChurchDirectorySeed(church: ChurchConfig): ChurchDirectorySeed {
  return {
    slug: church.slug,
    name: church.name,
    country: church.country,
    location: church.location,
    musicStyle: church.musicStyle,
    denomination: church.denomination,
  };
}

function getHomepageShowcaseDescription(church: ChurchConfig): string {
  const description = normalizeDisplayText(church.description);
  if (description && !isGeneratedChurchDescription(description)) return description;

  const location = getCompactLocationLabel(church.location, church.country);
  if (location) return `${church.name} is a church in ${location}.`;
  if (description) return description;
  return `Explore ${church.name} on GospelChannel.`;
}

function getHomepageShowcaseScore(church: ChurchConfig): number {
  const description = normalizeDisplayText(church.description);
  const playlistCount = uniqueSpotifyPlaylistIds([
    ...church.spotifyPlaylistIds,
    ...(church.additionalPlaylists ?? []),
  ]).length;
  const hasMusic = playlistCount > 0 || isPlayableSpotifyUrl(church.spotifyUrl);
  const hasLongText = Boolean(description && !isGeneratedChurchDescription(description) && description.length >= 80);
  const hasVisual = Boolean(rewriteLegacyMediaUrl(church.headerImage) || rewriteLegacyMediaUrl(church.logo));
  const hasLocation = Boolean(getCompactLocationLabel(church.location, church.country));
  const hasStyle = (church.musicStyle?.length ?? 0) > 0;

  let score = 0;
  if (hasMusic) score += 30;
  if (hasLongText) score += 25;
  if (hasVisual) score += 20;
  if (hasLocation) score += 15;
  if (hasStyle) score += 10;

  return score;
}

function getStableChurchHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function mapChurchToHomepageShowcase(church: ChurchConfig): HomepageShowcaseChurch {
  return {
    slug: church.slug,
    name: church.name,
    description: getHomepageShowcaseDescription(church),
    country: church.country,
    location: getCompactLocationLabel(church.location, church.country),
    logo: rewriteLegacyMediaUrl(church.logo) || undefined,
    playlistCount: uniqueSpotifyPlaylistIds([
      ...church.spotifyPlaylistIds,
      ...(church.additionalPlaylists ?? []),
    ]).length,
    updatedAt: church.verifiedAt,
    musicStyle: church.musicStyle,
    thumbnailUrl: rewriteLegacyMediaUrl(church.headerImage) || undefined,
  };
}

function buildHomepageShowcaseChurches(churches: ChurchConfig[]): HomepageShowcaseChurch[] {
  return [...churches]
    .sort((left, right) => {
      const scoreDiff = getHomepageShowcaseScore(right) - getHomepageShowcaseScore(left);
      if (scoreDiff !== 0) return scoreDiff;
      return getStableChurchHash(left.slug) - getStableChurchHash(right.slug);
    })
    .slice(0, 96)
    .map(mapChurchToHomepageShowcase);
}

function mergeChurchFallback(church: ChurchConfig): ChurchConfig {
  const fallback = getFallbackChurchMap().get(church.slug);
  if (!fallback) return church;

  const churchVideos = ((church as Record<string, unknown>).youtubeVideos as ChurchConfig["youtubeVideos"] | undefined) ?? undefined;
  const fallbackVideos = ((fallback as Record<string, unknown>).youtubeVideos as ChurchConfig["youtubeVideos"] | undefined) ?? undefined;

  return {
    ...church,
    logo: rewriteLegacyMediaUrl(church.logo || fallback.logo) || "",
    headerImage: rewriteLegacyMediaUrl(church.headerImage || fallback.headerImage),
    headerImageAttribution: church.headerImageAttribution || fallback.headerImageAttribution,
    youtubeChannelId: church.youtubeChannelId || fallback.youtubeChannelId,
    instagramUrl: church.instagramUrl || fallback.instagramUrl,
    facebookUrl: church.facebookUrl || fallback.facebookUrl,
    youtubeUrl: church.youtubeUrl || fallback.youtubeUrl,
    ...(churchVideos?.length ? { youtubeVideos: churchVideos } : fallbackVideos?.length ? { youtubeVideos: fallbackVideos } : {}),
  };
}

async function fetchApprovedEnrichmentMap(sb: ReturnType<typeof createAdminClient>, slugs: string[]) {
  const map = new Map<string, Record<string, unknown>>();
  const canonicalSlugs = Array.from(new Set(slugs.map((slug) => resolveCanonicalChurchSlug(slug)).filter(Boolean)));
  const lookupSlugs = Array.from(new Set(canonicalSlugs.flatMap((slug) => getChurchSlugLookupCandidates(slug))));

  for (let index = 0; index < lookupSlugs.length; index += 200) {
    const batch = lookupSlugs.slice(index, index + 200);
    const { data, error } = await sb
      .from<{ church_slug: string } & Record<string, unknown>>("church_enrichments")
      .select("church_slug,contact_email,instagram_url,facebook_url,youtube_url,cover_image_url")
      .in("church_slug", batch);

    if (error) {
      throw new Error(`Failed to load church enrichments: ${error.message}`);
    }

    for (const row of ((data as Array<{ church_slug: string } & Record<string, unknown>> | null) ?? [])) {
      const canonicalSlug = resolveCanonicalChurchSlug(row.church_slug);
      if (!canonicalSlugs.includes(canonicalSlug)) continue;
      if (!map.has(canonicalSlug) || row.church_slug === canonicalSlug) {
        map.set(canonicalSlug, row as Record<string, unknown>);
      }
    }
  }

  return map;
}

function mapRowToChurchDirectorySeed(row: ChurchDirectorySeedRow): ChurchDirectorySeed {
  return {
    slug: row.slug,
    name: row.name,
    country: row.country || "",
    location: row.location || undefined,
    musicStyle: row.music_style || undefined,
    denomination: row.denomination || undefined,
  };
}

/**
 * Map a churches row to a ChurchConfig object.
 */
function mapRowToChurchConfig(row: ChurchDataRow, enrichment?: Record<string, unknown>): ChurchConfig {
  return mergeChurchFallback({
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    spotifyPlaylistIds: row.spotify_playlist_ids || [],
    spotifyPlaylists: row.spotify_playlists || undefined,
    logo: rewriteLegacyMediaUrl(row.logo) || "",
    website: row.website || "",
    spotifyUrl: row.spotify_url || "",
    country: row.country || "",
    denomination: row.denomination || undefined,
    founded: row.founded || undefined,
    location: row.location || undefined,
    musicStyle: row.music_style || undefined,
    notableArtists: row.notable_artists || undefined,
    youtubeChannelId: row.youtube_channel_id || undefined,
    spotifyArtistIds: row.spotify_artist_ids || undefined,
    additionalPlaylists: row.additional_playlists || undefined,
    email: row.email || (enrichment?.contact_email as string | undefined) || undefined,
    instagramUrl: row.instagram_url || (enrichment?.instagram_url as string | undefined) || undefined,
    facebookUrl: row.facebook_url || (enrichment?.facebook_url as string | undefined) || undefined,
    youtubeUrl: row.youtube_url || (enrichment?.youtube_url as string | undefined) || undefined,
    headerImage: rewriteLegacyMediaUrl(row.header_image || (enrichment?.cover_image_url as string | undefined)),
    headerImageAttribution: row.header_image_attribution || undefined,
    lastResearched: row.last_researched || undefined,
    verifiedAt: row.verified_at || undefined,
    showEmailPublicly: row.show_email_publicly ?? false,
    aliases: row.aliases || undefined,
    language: row.language || undefined,
    sourceKind: row.source_kind || undefined,
    // Map youtube_videos JSONB back
    ...(row.youtube_videos ? { youtubeVideos: row.youtube_videos } : {}),
  });
}

async function fetchApprovedChurchesFromDb(): Promise<ChurchConfig[]> {
  const sb = createAdminClient();
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await sb
      .from("churches")
      .select("*")
      .eq("status", "approved")
      .order("name")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load approved churches: ${error.message}`);
    }

    if (!data) {
      break;
    }

    const pageRows = data as ChurchDataRow[];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const churchRows = rows as ChurchDataRow[];
  const enrichmentMap = await fetchApprovedEnrichmentMap(sb, churchRows.map((row) => String(row.slug || "")));
  return filterExplicitNonChurchRows(
    churchRows.map((row) => mapRowToChurchConfig(row, enrichmentMap.get(String(row.slug || "")))),
  );
}

async function fetchSingleChurchBySlug(slug: string): Promise<ChurchConfig | undefined> {
  if (isExplicitNonChurchSlug(slug)) {
    return undefined;
  }

  const sb = createAdminClient();

  const { data: churchRow, error: churchError } = await sb
    .from("churches")
    .select("*")
    .eq("slug", slug)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  if (churchError) {
    throw new Error(`Failed to load church ${slug}: ${churchError.message}`);
  }

  if (!churchRow) {
    return undefined;
  }

  const { data: enrichmentRows } = await sb
    .from("church_enrichments")
    .select("church_slug,contact_email,instagram_url,facebook_url,youtube_url,cover_image_url")
    .in("church_slug", getChurchSlugLookupCandidates(slug));

  const enrichmentCandidates = (enrichmentRows as Array<Record<string, unknown> & { church_slug?: string }> | null) ?? [];
  const enrichment = enrichmentCandidates.find((row) => row.church_slug === slug) ?? enrichmentCandidates[0];

  const church = mapRowToChurchConfig(churchRow as ChurchDataRow, enrichment);
  return isExplicitNonChurchSlug(church.slug) ? undefined : church;
}

async function fetchApprovedChurchDirectorySeedFromDb(): Promise<ChurchDirectorySeed[]> {
  const sb = createAdminClient();
  const PAGE_SIZE = 1000;
  const rows: ChurchDirectorySeed[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await sb
      .from("churches")
      .select("slug,name,country,location,music_style,denomination")
      .eq("status", "approved")
      .order("name")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load approved church directory seed: ${error.message}`);
    }

    if (!data) {
      break;
    }

    const pageRows = data as ChurchDirectorySeedRow[];
    rows.push(...pageRows.map(mapRowToChurchDirectorySeed));
    if (pageRows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return filterExplicitNonChurchRows(filterCanonicalChurchSlugRecords(rows));
}

function formatChurchCountLabel(count: number): string {
  const rounded = Math.floor(count / 100) * 100;
  return `${rounded.toLocaleString("en-US")}+`;
}

const getApprovedChurchDirectorySeedCached = unstable_cache(
  async (): Promise<ChurchDirectorySeed[]> => {
    if (isOfflinePublicBuild() || !hasServiceConfig()) {
      return tryLoadLocalChurchSnapshot().map(toChurchDirectorySeed);
    }

    try {
      const churches = await fetchApprovedChurchDirectorySeedFromDb();
      if (churches.length === 0) {
        return getFallbackChurchSnapshot(
          "directory-seed",
          createEmptyChurchDirectoryError(),
        ).map(toChurchDirectorySeed);
      }
      return filterCanonicalChurchSlugRecords(churches);
    } catch (error) {
      return getFallbackChurchSnapshot("directory-seed", error).map(toChurchDirectorySeed);
    }
  },
  ["approved-church-directory-seed-v2"],
  { revalidate: 3600, tags: [CHURCH_CONTENT_TAG, CHURCH_INDEX_TAG] }
);

const getApprovedChurchStatsCached = unstable_cache(
  async () => {
    const churches = await getApprovedChurchDirectorySeedCached();
    return {
      churchCount: churches.length,
      churchCountLabel: formatChurchCountLabel(churches.length),
      countryCount: new Set(churches.map((church) => church.country).filter(Boolean)).size,
    };
  },
  ["approved-church-stats-v2"],
  { revalidate: 3600, tags: [CHURCH_CONTENT_TAG, CHURCH_STATS_TAG] }
);

// Full church payload now exceeds Next's 2 MB data-cache ceiling, so keep it
// memoized in-process for a request/build and reserve unstable_cache for slimmer projections.
const getApprovedChurches = cache(async (): Promise<ChurchConfig[]> => {
  if (isOfflinePublicBuild() || !hasServiceConfig()) {
    return tryLoadLocalChurchSnapshot();
  }

  try {
    const churches = filterCanonicalChurchSlugRecords(await fetchApprovedChurchesFromDb());
    if (churches.length === 0) {
      return getFallbackChurchSnapshot("churches", createEmptyChurchDirectoryError());
    }
    return churches;
  } catch (error) {
    return getFallbackChurchSnapshot("churches", error);
  }
});

/**
 * Get all approved churches from the public source of truth.
 * Falls back to the local snapshot when the public source is unavailable.
 */
export async function getChurchesAsync(): Promise<ChurchConfig[]> {
  return getApprovedChurches();
}

export async function getChurchDirectorySeedAsync(): Promise<ChurchDirectorySeed[]> {
  return getApprovedChurchDirectorySeedCached();
}

/**
 * Local snapshot helper for scripts/offline use only.
 */
export function getLocalChurchSnapshot(): ChurchConfig[] {
  return tryLoadLocalChurchSnapshot();
}

/**
 * Get a single approved church by slug from the public source of truth.
 */
export async function getChurchBySlugAsync(
  slug: string
): Promise<ChurchConfig | undefined> {
  const canonicalSlug = resolveCanonicalChurchSlug(slug);

  if (isOfflinePublicBuild() || !hasServiceConfig()) {
    return getFallbackChurchMap().get(canonicalSlug);
  }

  try {
    const church = await fetchSingleChurchBySlug(canonicalSlug);
    if (church) return church;
    return getFallbackChurchMap().get(canonicalSlug);
  } catch (error) {
    logChurchSnapshotFallback(`church-by-slug:${canonicalSlug}`, error);
    return getFallbackChurchMap().get(canonicalSlug);
  }
}

/**
 * Local snapshot slug lookup for scripts/offline use only.
 */
export function getLocalChurchBySlug(slug: string): ChurchConfig | undefined {
  const canonicalSlug = resolveCanonicalChurchSlug(slug);
  return getLocalChurchSnapshot().find((church) => church.slug === canonicalSlug);
}

export async function getChurchStatsAsync(): Promise<{
  churchCount: number;
  churchCountLabel: string;
  countryCount: number;
}> {
  return getApprovedChurchStatsCached();
}

export const getHomepageShowcaseChurches = unstable_cache(
  async (): Promise<HomepageShowcaseChurch[]> => buildHomepageShowcaseChurches(tryLoadLocalChurchSnapshot()),
  ["homepage-showcase-v1"],
  { revalidate: 3600, tags: [CHURCH_CONTENT_TAG, HOME_TAG] }
);

/**
 * Nuclear revalidation — invalidates ALL church-related caches and paths.
 * Use for admin operations (approve, status change, profile edit) where
 * the full scope of change is unknown.
 */
export function revalidatePublicChurchContent(): void {
  revalidateTag(CHURCH_CONTENT_TAG, "max");
  revalidateTag(CHURCH_INDEX_TAG, "max");
  revalidateTag(CHURCH_STATS_TAG, "max");
  revalidateTag(CHURCH_PAGE_TAG, "max");
  revalidateTag(CHURCH_PAGE_PUBLIC_TAG, "max");
  revalidateTag(HOME_TAG, "max");
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/for-churches");
  revalidatePath("/church");
  revalidatePath("/church/[slug]", "page");
  revalidatePath("/church/[slug]/claim", "page");
  revalidatePath("/church/country/[slug]", "page");
  revalidatePath("/church/city/[slug]", "page");
  revalidatePath("/church/style/[slug]", "page");
  revalidatePath("/church/denomination/[slug]", "page");
  revalidatePath("/guides");
  revalidatePath("/guides/church-fit-quiz");
  revalidatePath("/guides/first-visit-guide");
  revalidatePath("/guides/worship-style-match");
  revalidatePath("/compare");
  revalidatePath("/compare/[slug]", "page");
  revalidatePath("/network/[slug]", "page");
  revalidatePath("/prayerwall");
  revalidatePath("/prayerwall/[...segments]", "page");
  revalidatePath("/sitemap.xml");
}

/**
 * Lightweight revalidation for the daily cron sync.
 * Only refreshes data caches (tags) without blasting every rendered path.
 * Individual church pages pick up fresh data on their next ISR cycle.
 */
export function revalidateCronSync(): void {
  revalidateTag(CHURCH_CONTENT_TAG, "max");
  revalidateTag(CHURCH_INDEX_TAG, "max");
  revalidateTag(CHURCH_PAGE_PUBLIC_TAG, "max");
  revalidatePath("/church");
  revalidatePath("/sitemap.xml");
}

export function getStaffPicks(): CatalogVideo[] {
  return staffPicksJson as CatalogVideo[];
}

export function getTrendingCache(): CatalogVideo[] {
  const items = trendingJson as Array<{
    videoId: string;
    title: string;
    thumbnailUrl: string;
    channelTitle?: string;
  }>;
  const fallback = getStaffPicks()
    .slice(0, 24)
    .map((item) => ({
      videoId: item.videoId,
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnailUrl,
      source: "trending" as const,
    }));

  if (items.length === 0) {
    return fallback;
  }

  return items.map((item) => ({
    videoId: item.videoId,
    title: item.title,
    artist: item.channelTitle,
    thumbnailUrl: item.thumbnailUrl,
    source: "trending",
  }));
}
