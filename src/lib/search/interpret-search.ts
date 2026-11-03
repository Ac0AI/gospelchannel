// Free-text church search → directory filters. Used by the /church page, the
// search-box suggestions and the chat's city tool, so "karismatiska kyrkor i
// stokholm" means the same thing everywhere.

import type { ChurchDirectoryFilters } from "@/lib/church-directory";
import { getDenominationFilterBySlug, getStyleFilterBySlug } from "@/lib/church-directory";
import { getChurchFamily } from "./church-families";
import { resolvePlace, type PlaceLookup } from "./resolve-place";
import { hasConcepts, understandQuery } from "./understand-query";

export type InterpretedSearch = {
  /** False when nothing structured was found: keep the literal search. */
  applied: boolean;
  filters: Pick<
    ChurchDirectoryFilters,
    "citySlug" | "citySlugs" | "country" | "familySlug" | "denominationSlug" | "styleSlug" | "language" | "hasKids" | "hasServiceTimes" | "terms"
  >;
  cityLabel?: string;
  corrections: Array<{ from: string; to: string }>;
  /** "Charismatic churches in Stockholm", "English-speaking Baptist churches in London with a kids ministry". */
  summary: string;
};

export function describeSearch(parts: {
  familySlug?: string;
  denominationSlug?: string;
  styleSlug?: string;
  language?: string;
  hasKids?: boolean;
  hasServiceTimes?: boolean;
  terms?: string[];
  cityLabel?: string;
  country?: string;
}): string {
  const type =
    getChurchFamily(parts.familySlug)?.label ??
    getDenominationFilterBySlug(parts.denominationSlug ?? "")?.label ??
    "";
  const style = parts.styleSlug ? getStyleFilterBySlug(parts.styleSlug)?.label : undefined;
  const words = [
    parts.language ? `${parts.language}-speaking` : "",
    type,
    parts.terms?.length ? `"${parts.terms.join(" ")}"` : "",
    "churches",
  ].filter(Boolean);
  let summary = words.join(" ");
  const place = [parts.cityLabel, parts.cityLabel ? undefined : parts.country].filter(Boolean).join(", ");
  if (place) summary += ` in ${place}`;
  const extras = [
    style ? `${style.toLowerCase()} worship` : "",
    parts.hasKids ? "a kids ministry" : "",
    parts.hasServiceTimes ? "service times listed" : "",
  ].filter(Boolean);
  if (extras.length) summary += ` with ${extras.join(" and ")}`;
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

export async function interpretChurchSearch(query: string, lookup: PlaceLookup): Promise<InterpretedSearch> {
  const understood = understandQuery(query);
  const concepts = hasConcepts(understood);
  const place = await resolvePlace(understood.rest, understood.placeHint, lookup, { hasConcepts: concepts });
  const terms = place.nameTermIndexes.map((index) => understood.restOriginal[index] ?? understood.rest[index]);

  const filters: InterpretedSearch["filters"] = {
    ...(place.city && (place.citySlugs?.length ?? 0) > 1
      ? { citySlugs: place.citySlugs }
      : place.city
        ? { citySlug: place.city.citySlug }
        : {}),
    ...(place.country ? { country: place.country } : {}),
    ...(understood.familySlug ? { familySlug: understood.familySlug } : {}),
    ...(understood.denominationSlug ? { denominationSlug: understood.denominationSlug } : {}),
    ...(understood.styleSlug ? { styleSlug: understood.styleSlug } : {}),
    ...(understood.language ? { language: understood.language } : {}),
    ...(understood.hasKids ? { hasKids: true } : {}),
    ...(understood.hasServiceTimes ? { hasServiceTimes: true } : {}),
    ...(terms.length ? { terms } : {}),
  };
  const cityLabel = place.city?.label.split(",")[0]?.trim();
  const applied = concepts || Boolean(place.city || place.country);
  return {
    applied,
    filters,
    cityLabel,
    corrections: place.corrections,
    summary: applied ? describeSearch({ ...filters, cityLabel }) : "",
  };
}

type InterpretedFilters = InterpretedSearch["filters"];
type RelaxableKey = "hasServiceTimes" | "hasKids" | "styleSlug" | "language" | "familySlug" | "denominationSlug";

// Least important first. The place and the name words are never dropped: a
// search for "hillsong lund" should not turn into every church in Lund.
const RELAX_ORDER: RelaxableKey[][] = [
  ["hasServiceTimes"],
  ["hasKids"],
  ["styleSlug"],
  ["language"],
  ["familySlug", "denominationSlug"],
];

/**
 * Wider versions of an interpreted search, for when it finds nothing. Each step
 * drops one more of the softer conditions. Keys the visitor set explicitly in
 * the URL (`locked`) stay. Only steps that change something are returned.
 */
export function relaxedSearches(
  filters: InterpretedFilters,
  locked: ReadonlySet<string> = new Set(),
): InterpretedFilters[] {
  const steps: InterpretedFilters[] = [];
  let current: InterpretedFilters = { ...filters };
  for (const keys of RELAX_ORDER) {
    const droppable = keys.filter((key) => current[key] !== undefined && !locked.has(key));
    if (droppable.length === 0) continue;
    const next: InterpretedFilters = { ...current };
    for (const key of droppable) delete next[key];
    current = next;
    // A search with nothing left but "churches" helps no one.
    if (!next.citySlug && !next.citySlugs?.length && !next.country && !next.terms?.length) break;
    steps.push(next);
  }
  return steps;
}

