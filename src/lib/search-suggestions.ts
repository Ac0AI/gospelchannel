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

// Minimum query length before the fuzzy (typo-tolerant) fallback kicks in.
// Below this, word_similarity() on short strings is too noisy to be useful.
const FUZZY_MIN_QUERY_LENGTH = 4;

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
          char_length(search_key) AS key_length,
          1.0::real AS sim
        FROM search_suggestions
        WHERE search_key LIKE $2 ESCAPE '\\'
        ORDER BY match_rank ASC, popularity DESC, key_length ASC, title ASC
        LIMIT $3
      ),
      -- Typo-tolerant fallback: word_similarity() finds the best-matching word/
      -- span inside a longer search_key, unlike plain trigram similarity() which
      -- unfairly penalizes short queries against long strings. Index-accelerated
      -- via the gin_trgm_ops index (see migration 0017).
      fuzzy_matches AS (
        SELECT
          target_type,
          target_id,
          title,
          subtitle,
          slug,
          popularity,
          2 AS match_rank,
          char_length(search_key) AS key_length,
          word_similarity($1, search_key) AS sim
        FROM search_suggestions
        WHERE char_length($1) >= ${FUZZY_MIN_QUERY_LENGTH} AND $1 <% search_key
        ORDER BY sim DESC, popularity DESC
        LIMIT $3
      ),
      combined AS (
        SELECT * FROM prefix_matches
        UNION ALL
        SELECT * FROM fuzzy_matches
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
          key_length,
          sim
        FROM combined
        ORDER BY target_type, target_id, match_rank ASC, sim DESC, popularity DESC, key_length ASC, title ASC
      )
      SELECT target_type, target_id, title, subtitle, slug
      FROM deduped
      ORDER BY match_rank ASC, sim DESC, popularity DESC, key_length ASC, title ASC
      LIMIT $4
    `,
    [query, pattern, innerLimit, limit],
  )) as SearchSuggestionRow[];

  return rows.map(mapRowToSuggestion).filter((row): row is ChurchSearchSuggestion => Boolean(row));
}

// Local/offline mirror of the DB's word_similarity() fallback: bounded edit
// distance against individual words rather than the whole value, so a typo in
// one word of a multi-word name/city doesn't get diluted by string length.
function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => [i, ...new Array(cols - 1).fill(0)]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

function allowedEditDistance(queryLength: number): number {
  if (queryLength <= 4) return 1;
  if (queryLength <= 7) return 2;
  return 3;
}

function fuzzyWordMatch(value: string, query: string): boolean {
  if (query.length < FUZZY_MIN_QUERY_LENGTH) return false;
  const threshold = allowedEditDistance(query.length);
  return value.split(" ").some((word) => Math.abs(word.length - query.length) <= threshold && levenshtein(word, query) <= threshold);
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
      const values = getSearchValues(church).map(({ value, score }) => ({ value: normalizeSuggestionQuery(value ?? ""), score }));

      const prefixMatch = values
        .filter(({ value }) => value.startsWith(normalized))
        .sort((a, b) => b.score - a.score || a.value.length - b.value.length)[0];

      // Typo-tolerant fallback only when no exact prefix match exists, and
      // always scored lower so correctly-spelled prefix matches still win.
      const fuzzyMatch = prefixMatch
        ? undefined
        : values
            .filter(({ value }) => fuzzyWordMatch(value, normalized))
            .sort((a, b) => b.score - a.score || a.value.length - b.value.length)[0];

      const match = prefixMatch ?? fuzzyMatch;
      if (!match || seen.has(church.slug)) return null;
      seen.add(church.slug);

      const playlistCount = new Set([...(church.spotifyPlaylistIds ?? []), ...(church.additionalPlaylists ?? [])]).size;
      const popularity =
        (prefixMatch ? match.score : match.score - 20) +
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
