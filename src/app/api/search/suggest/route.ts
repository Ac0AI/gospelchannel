import { NextResponse, type NextRequest } from "next/server";
import {
  SEARCH_SUGGEST_CACHE_SECONDS,
  SEARCH_SUGGEST_DEFAULT_LIMIT,
  SEARCH_SUGGEST_MIN_QUERY_LENGTH,
  SEARCH_SUGGEST_MAX_LIMIT,
  getChurchSearchSuggestions,
  normalizeSuggestionQuery,
} from "@/lib/search-suggestions";

export const revalidate = 60;

function readLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return SEARCH_SUGGEST_DEFAULT_LIMIT;
  return Math.min(SEARCH_SUGGEST_MAX_LIMIT, Math.max(1, parsed));
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

  const suggestions = await getChurchSearchSuggestions(query, limit);

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        "Cache-Control": `public, max-age=30, s-maxage=${SEARCH_SUGGEST_CACHE_SECONDS}, stale-while-revalidate=300`,
      },
    },
  );
}
