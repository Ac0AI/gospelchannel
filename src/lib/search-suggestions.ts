import { getSql } from "@/db";
import { hasServiceConfig } from "@/lib/neon-client";
import { filterCanonicalChurchSlugRecords } from "@/lib/church-slugs";
import { filterExplicitNonChurchRows } from "@/lib/non-church-slugs";
import { isOfflinePublicBuild } from "@/lib/runtime-mode";
import {
  CHURCH_CHOICE_ANSWER_PAGE_PATH,
  CHURCH_CHOICE_ANSWER_PAGE_TITLE,
  CHURCH_CHOICE_ANSWERS,
} from "@/lib/church-choice-answers";
import { FOR_AUDIENCE } from "@/lib/for-audience-data";
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

export type DecisionSearchSuggestion = {
  id: string;
  type: "guide" | "compare" | "proof_route";
  title: string;
  subtitle?: string;
  href: string;
};

export type SearchSuggestion = ChurchSearchSuggestion | DecisionSearchSuggestion;

type SearchSuggestionRow = {
  target_type: string;
  target_id: string;
  title: string;
  subtitle: string | null;
  slug: string;
};

type CacheEntry = {
  expiresAt: number;
  value: SearchSuggestion[];
};

type LocalSuggestionCandidate = {
  suggestion: ChurchSearchSuggestion;
  popularity: number;
  keyLength: number;
};

type DecisionSuggestionMatch = {
  suggestion: DecisionSearchSuggestion;
  priority: number;
  keyLength: number;
};

const suggestionCache = new Map<string, CacheEntry>();

type DecisionSuggestionCandidate = DecisionSearchSuggestion & {
  queries: string[];
  priority: number;
};

const CHURCH_CHOICE_ANSWER_QUERIES = [
  "best church for me",
  "which church should i choose",
  "church choice answers",
  "church decision guide",
  "recommend a church",
  "help me choose a church",
  "what church is right for me",
  ...CHURCH_CHOICE_ANSWERS.map((item) => item.question),
  ...CHURCH_CHOICE_ANSWERS.map((item) => item.question.replace(/\?$/, "")),
];

const AUDIENCE_QUERY_ALIASES: Record<string, string[]> = {
  expats: [
    "church for expats",
    "english speaking church abroad",
    "international church",
    "english church in a new country",
    "church for immigrants",
  ],
  students: [
    "church for students",
    "church near campus",
    "university church",
    "college church",
    "student friendly church",
  ],
  "young-adults": [
    "church for young adults",
    "young adult church",
    "church for 20 somethings",
    "contemporary church for young adults",
  ],
  families: [
    "church for families",
    "family friendly church",
    "family friendly church near me",
    "church with kids ministry",
    "church for parents",
  ],
  "new-believers": [
    "church for new believers",
    "church for new christians",
    "welcoming church for new christians",
    "first church for new believer",
  ],
  deconstructing: [
    "church after deconstruction",
    "church for deconstructing seekers",
    "low pressure church",
    "church after church hurt",
  ],
};

const AUDIENCE_DECISION_SUGGESTIONS: DecisionSuggestionCandidate[] = Object.values(FOR_AUDIENCE).map((audience) => ({
  id: `for-${audience.slug}`,
  type: "guide",
  title: audience.hero_eyebrow,
  subtitle: "Guidance for your situation, with churches to explore next.",
  href: `/for/${audience.slug}`,
  priority: 88,
  queries: [
    audience.audience_name,
    audience.meta_title,
    audience.meta_description,
    audience.hero_h1,
    audience.hero_lede,
    ...audience.solutions.map((solution) => solution.title),
    ...audience.curated_cards.map((card) => card.title),
    ...(AUDIENCE_QUERY_ALIASES[audience.slug] ?? []),
  ],
}));

const DECISION_SUGGESTIONS: DecisionSuggestionCandidate[] = [
  {
    id: "church-choice-answers",
    type: "guide",
    title: CHURCH_CHOICE_ANSWER_PAGE_TITLE.replace(" - What Church Should I Visit?", ""),
    subtitle: "Direct answers, a guide to read, and churches to explore.",
    href: CHURCH_CHOICE_ANSWER_PAGE_PATH,
    priority: 98,
    queries: CHURCH_CHOICE_ANSWER_QUERIES,
  },
  {
    id: "first-visit-guide",
    type: "guide",
    title: "First-Time Church Visit Guide",
    subtitle: "What to wear, what happens, and what to check before Sunday.",
    href: "/guides/first-visit-guide",
    priority: 100,
    queries: [
      "first visit",
      "first time church",
      "what should i wear to church",
      "what happens at church",
      "what happens at a church service",
      "how long is a church service",
      "church service length",
      "church etiquette",
      "church service expectations",
      "altar call",
      "communion first visit",
    ],
  },
  {
    id: "church-fit-quiz",
    type: "guide",
    title: "Church Fit Quiz",
    subtitle: "Answer a few questions, then browse matching churches.",
    href: "/guides/church-fit-quiz",
    priority: 95,
    queries: [
      "what church should i visit",
      "find my church fit",
      "church fit quiz",
      "which church is right for me",
      "help me choose a church",
      "where should i go to church",
    ],
  },
  {
    id: "how-to-find-the-right-church",
    type: "guide",
    title: "How to Find the Right Church",
    subtitle: "A step-by-step plan for finding a church that fits.",
    href: "/guides/how-to-find-the-right-church",
    priority: 90,
    queries: [
      "how to find the right church",
      "church search checklist",
      "what should i check before joining a church",
      "how many churches should i visit",
      "choose a church",
      "find the right church",
    ],
  },
  {
    id: "prayer-guide",
    type: "guide",
    title: "Prayer Guide",
    subtitle: "Pray first, then check church details before visiting.",
    href: "/guides/prayer-guide",
    priority: 90,
    queries: [
      "how to pray",
      "prayer guide",
      "pray before choosing a church",
      "where can i pray",
      "community prayer signals",
      "pray before church",
    ],
  },
  {
    id: "prayer-wall",
    type: "guide",
    title: "Prayer Wall",
    subtitle: "Community prayer requests and church details in one place.",
    href: "/prayerwall",
    priority: 99,
    queries: [
      "prayer wall",
      "gospelchannel prayer wall",
      "community prayers",
      "church prayer requests",
      "prayer requests",
    ],
  },
  {
    id: "worship-style-match",
    type: "guide",
    title: "Church Sound Match",
    subtitle: "Match your worship taste to churches you can explore.",
    href: "/guides/worship-style-match",
    priority: 99,
    queries: [
      "worship style",
      "church sound",
      "contemporary worship",
      "gospel worship",
      "charismatic worship",
    ],
  },
  {
    id: "contemporary-worship-churches",
    type: "proof_route",
    title: "Contemporary Worship Churches",
    subtitle: "Find churches with contemporary worship.",
    href: "/church/style/contemporary-worship",
    priority: 92,
    queries: [
      "contemporary worship church near me",
      "contemporary worship churches near me",
      "churches with contemporary worship",
      "modern worship churches",
      "contemporary church worship",
    ],
  },
  {
    id: "charismatic-worship-churches",
    type: "proof_route",
    title: "Charismatic Worship Churches",
    subtitle: "Explore churches with spirit-led worship.",
    href: "/church/style/charismatic",
    priority: 92,
    queries: [
      "charismatic church near me",
      "charismatic worship church near me",
      "churches with charismatic worship",
      "spirit led church near me",
      "spirit led worship churches",
    ],
  },
  {
    id: "gospel-worship-churches",
    type: "proof_route",
    title: "Gospel Worship Churches",
    subtitle: "Explore churches with gospel worship.",
    href: "/church/style/gospel",
    priority: 92,
    queries: [
      "gospel church near me",
      "gospel churches near me",
      "gospel worship church near me",
      "churches with gospel worship",
      "gospel worship churches",
    ],
  },
  {
    id: "acoustic-worship-churches",
    type: "proof_route",
    title: "Acoustic Worship Churches",
    subtitle: "Explore churches with acoustic and reflective worship.",
    href: "/church/style/acoustic",
    priority: 92,
    queries: [
      "acoustic worship church near me",
      "acoustic worship churches",
      "churches with acoustic worship",
      "quiet worship church",
    ],
  },
  {
    id: "latin-worship-churches",
    type: "proof_route",
    title: "Latin Worship Churches",
    subtitle: "Explore churches with Latin worship.",
    href: "/church/style/latin",
    priority: 92,
    queries: [
      "latin worship church near me",
      "latin worship churches",
      "churches with latin worship",
      "spanish worship church near me",
    ],
  },
  {
    id: "african-worship-churches",
    type: "proof_route",
    title: "African Worship Churches",
    subtitle: "Explore African and diaspora worship churches.",
    href: "/church/style/african",
    priority: 92,
    queries: [
      "african worship church near me",
      "african worship churches",
      "churches with african worship",
      "african praise church near me",
    ],
  },
  {
    id: "traditional-vs-contemporary-worship",
    type: "compare",
    title: "Traditional vs Contemporary Worship",
    subtitle: "Choose between rooted liturgy and a modern worship entry point.",
    href: "/compare/traditional-vs-contemporary-worship",
    priority: 84,
    queries: [
      "traditional vs contemporary worship",
      "traditional or contemporary worship",
      "traditional contemporary church",
      "traditional church vs contemporary church",
      "traditional worship vs modern worship",
      "contemporary vs traditional church",
    ],
  },
  {
    id: "baptist-vs-pentecostal",
    type: "compare",
    title: "Baptist vs Pentecostal",
    subtitle: "Compare teaching style, worship energy, and Sunday room feel.",
    href: "/compare/baptist-vs-pentecostal",
    priority: 84,
    queries: [
      "baptist vs pentecostal",
      "pentecostal vs baptist",
      "baptist pentecostal",
      "baptist or pentecostal church",
      "difference between baptist and pentecostal",
      "baptist church vs pentecostal church",
    ],
  },
  {
    id: "liturgical-vs-free-worship",
    type: "compare",
    title: "Liturgical vs Free Worship",
    subtitle: "Choose between clear structure and freer response before visiting.",
    href: "/compare/liturgical-vs-free-worship",
    priority: 84,
    queries: [
      "liturgical vs free worship",
      "free worship vs liturgical worship",
      "liturgical or free worship",
      "liturgical free worship",
      "structured worship vs free worship",
      "liturgical church vs charismatic church",
    ],
  },
  {
    id: "big-church-vs-small-church",
    type: "compare",
    title: "Big Church vs Small Church",
    subtitle: "Choose between a larger room and a closer-knit Sunday rhythm.",
    href: "/compare/big-church-vs-small-church",
    priority: 80,
    queries: [
      "big church vs small church",
      "large church or small church",
      "megachurch or small church",
      "church size",
      "church size guide",
      "small church",
      "big church",
    ],
  },
  {
    id: "denominations-comparison",
    type: "guide",
    title: "Denominations Compared",
    subtitle: "Understand church traditions, then check the details that matter to you.",
    href: "/guides/denominations-comparison",
    priority: 75,
    queries: [
      "denominations compared",
      "church denomination",
      "baptist vs pentecostal",
      "pentecostal church",
      "baptist church",
      "non denominational church",
    ],
  },
  {
    id: "service-ready-profiles",
    type: "proof_route",
    title: "Profiles with Service Times",
    subtitle: "Find churches with published service times.",
    href: "/church/churches-with-service-times",
    priority: 99,
    queries: [
      "service times",
      "church service times",
      "church this sunday",
      "visit ready churches",
      "church near me sunday",
    ],
  },
  {
    id: "profiles-with-kids-ministry",
    type: "proof_route",
    title: "Profiles with Kids or Youth Signals",
    subtitle: "Find churches with kids or youth information.",
    href: "/church/family-friendly-churches",
    priority: 97,
    queries: [
      "church with kids ministry near me",
      "churches with kids ministry",
      "kids ministry church",
      "church with youth group near me",
      "churches with youth ministry",
      "family church with kids program",
    ],
  },
  {
    id: "english-language-profiles",
    type: "proof_route",
    title: "English-Language Church Profiles",
    subtitle: "Explore English-speaking churches.",
    href: "/church/english-speaking-churches",
    priority: 97,
    queries: [
      "english speaking church near me",
      "english speaking churches",
      "churches with english services",
      "english language church",
      "english church near me",
      "international church english service",
    ],
  },
  {
    id: "church-network-campuses",
    type: "proof_route",
    title: "Church Networks & Campuses",
    subtitle: "Compare network campuses and check their local church details.",
    href: "/network",
    priority: 99,
    queries: [
      "church networks",
      "church network campuses",
      "multi campus church",
      "multi campus churches",
      "church campuses",
      "campus church network",
      "hillsong campuses",
      "c3 campuses",
      "icf campuses",
    ],
  },
  {
    id: "london-charismatic-gospel-churches",
    type: "proof_route",
    title: "Charismatic & Gospel Churches in London",
    subtitle: "Explore charismatic, Pentecostal, and gospel churches in London.",
    href: "/church/charismatic-churches-in-london",
    priority: 98,
    queries: [
      "charismatic churches in london",
      "charismatic church london",
      "gospel churches in london",
      "gospel church london",
      "pentecostal churches in london",
      "pentecostal church london",
      "spirit filled church london",
      "spirit filled churches in london",
      "spirit led church london",
      "english speaking charismatic church london",
    ],
  },
  {
    id: "churches-by-city",
    type: "proof_route",
    title: "Churches by City",
    subtitle: "Find churches by city.",
    href: "/church/city",
    priority: 99,
    queries: [
      "church near me",
      "churches near me",
      "church in my city",
      "churches in my city",
      "local churches",
      "find churches by city",
      "churches by city",
      "churches in london",
      "church in london",
    ],
  },
  {
    id: "profiles-with-music",
    type: "proof_route",
    title: "Profiles with Worship Music",
    subtitle: "Listen to worship music before you visit.",
    href: "/church/churches-with-worship-music",
    priority: 97,
    queries: [
      "churches with music",
      "worship playlist",
      "listen before visiting church",
      "church worship music",
      "spotify church",
    ],
  },
  {
    id: "best-worship-churches",
    type: "proof_route",
    title: "Best Worship Churches",
    subtitle: "Explore churches known for worship.",
    href: "/church/best-worship-churches",
    priority: 83,
    queries: [
      "best worship churches",
      "best worship church",
      "top worship churches",
      "best churches for worship",
      "best contemporary worship churches",
      "churches known for worship",
      "famous worship churches",
      "best worship church reddit",
    ],
  },
  ...AUDIENCE_DECISION_SUGGESTIONS,
];

export function normalizeSuggestionQuery(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

const DECISION_MATCH_STOPWORDS = new Set(["a", "an", "and", "for", "i", "is", "me", "my", "of", "or", "the", "to", "with"]);

function normalizeDecisionToken(token: string): string {
  if (token === "churches") return "church";
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function getDecisionTokens(value: string): string[] {
  return normalizeSuggestionQuery(value)
    .split(/[^a-z0-9]+/)
    .map(normalizeDecisionToken)
    .filter((token) => token.length >= 2 && !DECISION_MATCH_STOPWORDS.has(token));
}

function matchesDecisionValue(value: string, query: string): boolean {
  if (value.startsWith(query) || value.includes(` ${query}`)) return true;

  const queryTokens = getDecisionTokens(query);
  if (queryTokens.length === 0) return false;
  const valueTokens = new Set(getDecisionTokens(value));

  return queryTokens.every((token) => valueTokens.has(token));
}

export function getDecisionSearchSuggestions(
  query: string,
  limit = SEARCH_SUGGEST_DEFAULT_LIMIT,
): DecisionSearchSuggestion[] {
  const normalized = normalizeSuggestionQuery(query);
  if (normalized.length < SEARCH_SUGGEST_MIN_QUERY_LENGTH) return [];

  const safeLimit = getLimit(limit);
  const matches: DecisionSuggestionMatch[] = [];
  const normalizedTokens = getDecisionTokens(normalized);
  const isGenericChurchQuery = normalizedTokens.length === 1 && normalizedTokens[0] === "church";

  for (const candidate of DECISION_SUGGESTIONS) {
    if (isGenericChurchQuery && candidate.type === "proof_route") continue;
    if (isGenericChurchQuery && candidate.id === "worship-style-match") continue;
    if (isGenericChurchQuery && (candidate.id === "prayer-guide" || candidate.id === "prayer-wall")) continue;

    const values = [
      candidate.title,
      candidate.subtitle,
      ...candidate.queries,
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalizeSuggestionQuery);
    const match = values
      .filter((value) => matchesDecisionValue(value, normalized))
      .sort((a, b) => a.length - b.length)[0];

    if (match) {
      const exactAudienceAliasMatch = candidate.id.startsWith("for-")
        && candidate.queries.some((value) => normalizeSuggestionQuery(value) === normalized);
      const exactCompareAliasMatch = candidate.type === "compare"
        && candidate.queries.some((value) => normalizeSuggestionQuery(value) === normalized);
      const exactPrayerWallMatch = candidate.id === "prayer-wall"
        && [candidate.title, ...candidate.queries].some((value) => normalizeSuggestionQuery(value) === normalized);

      matches.push({
        suggestion: {
          id: candidate.id,
          type: candidate.type,
          title: candidate.title,
          subtitle: candidate.subtitle,
          href: candidate.href,
        } satisfies DecisionSearchSuggestion,
        priority: exactPrayerWallMatch ? 100 : exactCompareAliasMatch ? 100 : exactAudienceAliasMatch ? 99 : candidate.priority,
        keyLength: match.length,
      });
    }
  }

  return matches
    .sort((a, b) => b.priority - a.priority || a.keyLength - b.keyLength || a.suggestion.title.localeCompare(b.suggestion.title))
    .slice(0, safeLimit)
    .map((item) => item.suggestion);
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

export async function getChurchSearchSuggestions(query: string, limit = SEARCH_SUGGEST_DEFAULT_LIMIT): Promise<SearchSuggestion[]> {
  const normalized = normalizeSuggestionQuery(query);
  const safeLimit = getLimit(limit);
  if (normalized.length < SEARCH_SUGGEST_MIN_QUERY_LENGTH) return [];

  const cacheKey = `${normalized}:${safeLimit}`;
  const now = Date.now();
  const cached = suggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const decisionSuggestions = getDecisionSearchSuggestions(normalized, Math.min(3, safeLimit));
  const churchLimit = Math.max(0, safeLimit - decisionSuggestions.length);
  let churchSuggestions: ChurchSearchSuggestion[];
  if (isOfflinePublicBuild() || !hasServiceConfig()) {
    churchSuggestions = churchLimit > 0 ? await getLocalSearchSuggestions(normalized, churchLimit) : [];
  } else {
    try {
      churchSuggestions = churchLimit > 0 ? await getDatabaseSuggestions(normalized, churchLimit) : [];
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[search-suggest] Falling back to local suggestions: ${detail}`);
      churchSuggestions = churchLimit > 0 ? await getLocalSearchSuggestions(normalized, churchLimit) : [];
    }
  }

  const suggestions: SearchSuggestion[] = [...decisionSuggestions, ...churchSuggestions].slice(0, safeLimit);

  suggestionCache.set(cacheKey, {
    expiresAt: now + SEARCH_SUGGEST_CACHE_SECONDS * 1000,
    value: suggestions,
  });

  return suggestions;
}
