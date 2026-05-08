import { getSql } from "@/db";
import { hasServiceConfig } from "@/lib/neon-client";
import { filterCanonicalChurchSlugRecords } from "@/lib/church-slugs";
import { filterExplicitNonChurchRows } from "@/lib/non-church-slugs";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import type { ChurchConfig } from "@/types/gospel";

export const SEARCH_SUGGEST_MIN_QUERY_LENGTH = 2;
export const SEARCH_SUGGEST_DEFAULT_LIMIT = 8;
export const SEARCH_SUGGEST_MAX_LIMIT = 10;
export const SEARCH_SUGGEST_CACHE_SECONDS = 60;

export type ChurchSearchSuggestion = {
  id: string;
  type: "church";
  title: string;
  subtitle?: string;
  slug: string;
  href: string;
};

type SearchSuggestionRow = {
  target_type: string;
  target_id: string;
  title: string;
  subtitle: string | null;
  slug: string;
};

type CacheEntry = {
  expiresAt: number;
  value: ChurchSearchSuggestion[];
};

type LocalSuggestionCandidate = {
  suggestion: ChurchSearchSuggestion;
  popularity: number;
  keyLength: number;
};

const suggestionCache = new Map<string, CacheEntry>();

export function normalizeSuggestionQuery(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function getLimit(value?: number): number {
  if (!value || !Number.isFinite(value)) return SEARCH_SUGGEST_DEFAULT_LIMIT;
  return Math.min(SEARCH_SUGGEST_MAX_LIMIT, Math.max(1, Math.floor(value)));
}

function mapRowToSuggestion(row: SearchSuggestionRow): ChurchSearchSuggestion | null {
  if (row.target_type !== "church") return null;
  return {
    id: row.target_id,
    type: "church",
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    slug: row.slug,
    href: `/church/${encodeURIComponent(row.slug)}`,
  };
}

async function getDatabaseSuggestions(query: string, limit: number): Promise<ChurchSearchSuggestion[]> {
  const pattern = `${escapeLikePattern(query)}%`;
  const innerLimit = Math.max(limit * 10, 80);
  const rows = (await getSql().query(
    `
      WITH prefix_matches AS (
        SELECT
          target_type,
          target_id,
          title,
          subtitle,
          slug,
          popularity,
          CASE WHEN search_key = $1 THEN 0 ELSE 1 END AS match_rank,
          char_length(search_key) AS key_length
        FROM search_suggestions
        WHERE search_key LIKE $2 ESCAPE '\\'
        ORDER BY match_rank ASC, popularity DESC, key_length ASC, title ASC
        LIMIT $3
      ),
      deduped AS (
        SELECT DISTINCT ON (target_type, target_id)
          target_type,
          target_id,
          title,
          subtitle,
          slug,
          popularity,
          match_rank,
          key_length
        FROM prefix_matches
        ORDER BY target_type, target_id, match_rank ASC, popularity DESC, key_length ASC, title ASC
      )
      SELECT target_type, target_id, title, subtitle, slug
      FROM deduped
      ORDER BY match_rank ASC, popularity DESC, key_length ASC, title ASC
      LIMIT $4
    `,
    [query, pattern, innerLimit, limit],
  )) as SearchSuggestionRow[];

  return rows.map(mapRowToSuggestion).filter((row): row is ChurchSearchSuggestion => Boolean(row));
}

function getSearchValues(church: ChurchConfig): Array<{ value?: string; score: number }> {
  const city = church.location?.split(",")[0]?.trim();
  return [
    { value: church.name, score: 100 },
    ...(church.aliases ?? []).map((value) => ({ value, score: 90 })),
    { value: city, score: 80 },
    { value: church.country, score: 45 },
    { value: church.denomination, score: 35 },
  ];
}

export function getLocalSearchSuggestionsFromChurches(
  churches: ChurchConfig[],
  query: string,
  limit = SEARCH_SUGGEST_DEFAULT_LIMIT,
): ChurchSearchSuggestion[] {
  const normalized = normalizeSuggestionQuery(query);
  if (normalized.length < SEARCH_SUGGEST_MIN_QUERY_LENGTH) return [];

  const seen = new Set<string>();
  return filterExplicitNonChurchRows(filterCanonicalChurchSlugRecords(churches))
    .map((church): LocalSuggestionCandidate | null => {
      const match = getSearchValues(church)
        .map(({ value, score }) => ({ value: normalizeSuggestionQuery(value ?? ""), score }))
        .filter(({ value }) => value.startsWith(normalized))
        .sort((a, b) => b.score - a.score || a.value.length - b.value.length)[0];

      if (!match || seen.has(church.slug)) return null;
      seen.add(church.slug);

      const playlistCount = new Set([...(church.spotifyPlaylistIds ?? []), ...(church.additionalPlaylists ?? [])]).size;
      const popularity =
        match.score +
        playlistCount * 10 +
        (church.spotifyUrl ? 15 : 0) +
        (church.verifiedAt ? 20 : 0) +
        (church.headerImage || church.logo ? 8 : 0);

      const subtitle = [church.location, church.country].filter(Boolean).join(", ");

      return {
        suggestion: {
          id: church.slug,
          type: "church" as const,
          title: church.name,
          subtitle: subtitle || undefined,
          slug: church.slug,
          href: `/church/${encodeURIComponent(church.slug)}`,
        },
        popularity,
        keyLength: match.value.length,
      };
    })
    .filter((item): item is LocalSuggestionCandidate => Boolean(item))
    .sort((a, b) => b.popularity - a.popularity || a.keyLength - b.keyLength || a.suggestion.title.localeCompare(b.suggestion.title))
    .slice(0, getLimit(limit))
    .map((item) => item.suggestion);
}

async function getLocalSearchSuggestions(query: string, limit = SEARCH_SUGGEST_DEFAULT_LIMIT): Promise<ChurchSearchSuggestion[]> {
  const { getLocalChurchSnapshot } = await import("@/lib/content");
  return getLocalSearchSuggestionsFromChurches(getLocalChurchSnapshot(), query, limit);
}

export async function getChurchSearchSuggestions(query: string, limit = SEARCH_SUGGEST_DEFAULT_LIMIT): Promise<ChurchSearchSuggestion[]> {
  const normalized = normalizeSuggestionQuery(query);
  const safeLimit = getLimit(limit);
  if (normalized.length < SEARCH_SUGGEST_MIN_QUERY_LENGTH) return [];

  const cacheKey = `${normalized}:${safeLimit}`;
  const now = Date.now();
  const cached = suggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let suggestions: ChurchSearchSuggestion[];
  if (isOfflinePublicBuild() || !hasServiceConfig()) {
    suggestions = await getLocalSearchSuggestions(normalized, safeLimit);
  } else {
    try {
      suggestions = await getDatabaseSuggestions(normalized, safeLimit);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[search-suggest] Falling back to local suggestions: ${detail}`);
      suggestions = await getLocalSearchSuggestions(normalized, safeLimit);
    }
  }

  suggestionCache.set(cacheKey, {
    expiresAt: now + SEARCH_SUGGEST_CACHE_SECONDS * 1000,
    value: suggestions,
  });

  return suggestions;
}
