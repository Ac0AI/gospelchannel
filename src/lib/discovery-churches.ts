import { unstable_cache } from "next/cache";
import { getSql, hasDatabaseConfig } from "@/db";
import { CHURCH_INDEX_TAG } from "@/lib/content";
import { getFirstServiceTimeLabel } from "@/lib/content-quality";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import type { ServiceTime } from "@/types/gospel";

// Both pages below are force-dynamic (never prerendered against the DB at
// build time), which means every request would otherwise hit Neon directly —
// exactly the pattern that caused a prior Neon-egress incident when these
// pages are also the ones we've deliberately made attractive to AI crawlers.
// unstable_cache is the project's R2-backed cache (see CLAUDE.md: never use
// module-level caches on Workers), so repeat requests within the revalidate
// window are served from R2 instead of Neon.
const DISCOVERY_CACHE_REVALIDATE_SECONDS = 3600;

export type DiscoveryChurch = {
  name: string;
  slug: string;
  location: string | null;
  country: string | null;
  website: string | null;
  denomination: string | null;
  musicStyle: string[] | null;
  language: string | null;
  headerImage: string | null;
  logo: string | null;
  serviceTimeLabel: string | null;
  playlistCount: number;
  videoCount: number;
  directoryScore: number | null;
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  english: "English",
  es: "Spanish",
  spanish: "Spanish",
  fr: "French",
  french: "French",
  de: "German",
  german: "German",
  it: "Italian",
  italian: "Italian",
  sv: "Swedish",
  swedish: "Swedish",
  pt: "Portuguese",
  portuguese: "Portuguese",
  ko: "Korean",
};

export function formatDiscoveryLanguage(lang: string | null): string | null {
  if (!lang) return null;
  const key = lang.trim().toLowerCase();
  return LANGUAGE_LABELS[key] ?? lang.charAt(0).toUpperCase() + lang.slice(1);
}

export function formatDiscoveryStyles(styles: string[] | null): string | null {
  if (!styles || styles.length === 0) return null;
  return styles.map((style) => style.charAt(0).toUpperCase() + style.slice(1)).join(", ");
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

export function buildDiscoveryChurchProofs(church: DiscoveryChurch): string[] {
  const proofs = [
    church.serviceTimeLabel ? `Meets ${church.serviceTimeLabel}` : null,
    church.playlistCount > 0 ? formatCount(church.playlistCount, "worship playlist", "worship playlists") : null,
    church.videoCount > 0 ? formatCount(church.videoCount, "worship video", "worship videos") : null,
    church.musicStyle && church.musicStyle.length > 0 ? `Known for ${formatDiscoveryStyles(church.musicStyle)}` : null,
    formatDiscoveryLanguage(church.language) ? `Services in ${formatDiscoveryLanguage(church.language)}` : null,
    church.website ? "Official website available" : null,
    church.location || church.country ? `In ${[church.location, church.country].filter(Boolean).join(", ")}` : null,
  ].filter((proof): proof is string => Boolean(proof));

  return proofs.slice(0, 4);
}

// Charismatic / Pentecostal / gospel churches across Greater London.
//
// Two data wrinkles this query is deliberately built around (verified 2026-07-01):
//   1. "London" is fragmented across city_slug values (london, north-london,
//      southeast-london, southwest-london, ...), so we match the whole area with
//      ILIKE '%london%' rather than an exact slug — otherwise we undercount badly
//      (e.g. miss Hillsong North/Southeast/Southwest London).
//   2. The intent cluster is tradition-based (Pentecostal, Charismatic, Vineyard,
//      Elim) OR worship-style-tagged (charismatic/pentecostal/gospel) — deliberately
//      NOT plain "contemporary worship", which would drag in Baptist / Evangelical
//      Free churches that nobody means by "charismatic or gospel".
//
// Ranked by the same directory_score the rest of the site uses, so the flagships
// (Hillsong Church London, Kensington Temple) surface first. Real data only.
export const getLondonCharismaticChurches = unstable_cache(
  async (): Promise<DiscoveryChurch[]> => {
    if (isOfflinePublicBuild() || !hasDatabaseConfig()) return [];
    try {
      const sql = getSql();
      const rows = (await sql`
        SELECT
          name,
          slug,
          location,
          country,
          website,
          denomination,
          music_style,
          language,
          header_image,
          logo,
          service_times,
          COALESCE(cardinality(spotify_playlist_ids), 0) + COALESCE(cardinality(additional_playlists), 0) AS playlist_count,
          CASE
            WHEN jsonb_typeof(youtube_videos) = 'array' THEN jsonb_array_length(youtube_videos)
            ELSE 0
          END AS video_count,
          directory_score
        FROM churches
        WHERE status = 'approved'
          AND city_slug ILIKE '%london%'
          AND (
            denomination ILIKE ANY(ARRAY['%pentecostal%', '%charismatic%', '%elim%', '%vineyard%'])
            OR music_style && ARRAY['charismatic worship', 'pentecostal', 'gospel']
          )
        ORDER BY directory_score DESC NULLS LAST, name
      `) as Array<Record<string, unknown>>;

      return rows.map(toDiscoveryChurch);
    } catch {
      return [];
    }
  },
  ["discovery-london-charismatic-churches-v2"],
  { revalidate: DISCOVERY_CACHE_REVALIDATE_SECONDS, tags: [CHURCH_INDEX_TAG] },
);

// Global "worship-known" churches — the same directory_score ranking the rest of
// the site uses, filtered to churches whose data already flags them as worship-
// led (contemporary/charismatic worship, gospel, pentecostal tags or tradition).
// No independent "best" claim beyond our own directory ranking — the page discloses
// that methodology rather than asserting an unverifiable superlative.
const getBestWorshipChurchesCached = unstable_cache(
  async (limit: number): Promise<DiscoveryChurch[]> => {
    if (isOfflinePublicBuild() || !hasDatabaseConfig()) return [];
    try {
      const sql = getSql();
      const rows = (await sql`
        SELECT
          name,
          slug,
          location,
          country,
          website,
          denomination,
          music_style,
          language,
          header_image,
          logo,
          service_times,
          COALESCE(cardinality(spotify_playlist_ids), 0) + COALESCE(cardinality(additional_playlists), 0) AS playlist_count,
          CASE
            WHEN jsonb_typeof(youtube_videos) = 'array' THEN jsonb_array_length(youtube_videos)
            ELSE 0
          END AS video_count,
          directory_score
        FROM churches
        WHERE status = 'approved'
          AND (
            denomination ILIKE ANY(ARRAY['%pentecostal%', '%charismatic%', '%elim%', '%vineyard%'])
            OR music_style && ARRAY['charismatic worship', 'pentecostal', 'gospel', 'contemporary worship']
          )
        ORDER BY directory_score DESC NULLS LAST, name
        LIMIT ${limit}
      `) as Array<Record<string, unknown>>;

      return rows.map(toDiscoveryChurch);
    } catch {
      return [];
    }
  },
  ["discovery-best-worship-churches-v2"],
  { revalidate: DISCOVERY_CACHE_REVALIDATE_SECONDS, tags: [CHURCH_INDEX_TAG] },
);

export async function getBestWorshipChurches(limit = 30): Promise<DiscoveryChurch[]> {
  return getBestWorshipChurchesCached(limit);
}

function toDiscoveryChurch(row: Record<string, unknown>): DiscoveryChurch {
  return {
    name: String(row.name),
    slug: String(row.slug),
    location: (row.location as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    denomination: (row.denomination as string | null) ?? null,
    musicStyle: (row.music_style as string[] | null) ?? null,
    language: (row.language as string | null) ?? null,
    headerImage: (row.header_image as string | null) ?? null,
    logo: (row.logo as string | null) ?? null,
    serviceTimeLabel: getFirstServiceTimeLabel((row.service_times as ServiceTime[] | null) ?? null) ?? null,
    playlistCount: Number(row.playlist_count ?? 0),
    videoCount: Number(row.video_count ?? 0),
    directoryScore: typeof row.directory_score === "number" ? row.directory_score : null,
  };
}
