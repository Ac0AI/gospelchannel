import { NextResponse, type NextRequest } from "next/server";
import {
  SEARCH_SUGGEST_CACHE_SECONDS,
  SEARCH_SUGGEST_DEFAULT_LIMIT,
  SEARCH_SUGGEST_MIN_QUERY_LENGTH,
  SEARCH_SUGGEST_MAX_LIMIT,
  getChurchSearchSuggestions,
  normalizeSuggestionQuery,
  type SearchSuggestion,
} from "@/lib/search-suggestions";
import { getChurchSearchCount } from "@/lib/church";
import { interpretChurchSearch } from "@/lib/search/interpret-search";
import { directoryPlaceLookup } from "@/lib/search/directory-place-lookup";

export const revalidate = 60;

function readLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return SEARCH_SUGGEST_DEFAULT_LIMIT;
  return Math.min(SEARCH_SUGGEST_MAX_LIMIT, Math.max(1, parsed));
}

// "karismatiska kyrkor i stokholm" → "Charismatic churches in Stockholm · 14 churches",
// linking to the directory, which applies the same interpretation.
async function interpretedSearchSuggestion(query: string): Promise<SearchSuggestion | null> {
  const interpretation = await interpretChurchSearch(query, directoryPlaceLookup);
  if (!interpretation.applied) return null;
  const count = await getChurchSearchCount({ ...interpretation.filters, query: "" });
  if (count === 0) return null;
  const correction = interpretation.corrections[0];
  return {
    id: `search:${query}`,
    type: "search",
    title: interpretation.summary,
    subtitle: [
      `${count.toLocaleString("en-US")} ${count === 1 ? "church" : "churches"}`,
      correction ? `showing ${correction.to} for "${correction.from}"` : "",
    ].filter(Boolean).join(" · "),
    href: `/church?${new URLSearchParams({ q: query }).toString()}`,
  };
}

export async function GET(request: NextRequest) {
  const query = normalizeSuggestionQuery(request.nextUrl.searchParams.get("q") ?? "");
  const limit = readLimit(request.nextUrl.searchParams.get("limit"));

  if (query.length < SEARCH_SUGGEST_MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { suggestions: [] },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      },
    );
  }

  const [churchSuggestions, interpreted] = await Promise.all([
    getChurchSearchSuggestions(query, limit),
    interpretedSearchSuggestion(query).catch(() => null),
  ]);
  const suggestions = interpreted ? [interpreted, ...churchSuggestions].slice(0, limit) : churchSuggestions;

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        "Cache-Control": `public, max-age=30, s-maxage=${SEARCH_SUGGEST_CACHE_SECONDS}, stale-while-revalidate=300`,
      },
    },
  );
}
