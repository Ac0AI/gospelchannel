import { getSql } from "@/db";
import { fetchChurchIndexTotalCount, fetchFacetRelatedLinks } from "@/lib/church";
import { DENOMINATION_FILTERS, STYLE_FILTERS, type ChurchDirectoryFilters } from "@/lib/church-directory";
import { FACET_RELATED_LIMITS, facetLinksToRows, type FacetLinkRow, type FacetLinkSourceKind } from "@/lib/facet-links";
import { slugify } from "@/lib/slugify";

type Source = { kind: Exclude<FacetLinkSourceKind, "all">; slug: string; filters: ChurchDirectoryFilters };

/** Same query as the country facet page's slug resolution (_getDistinctCountries). */
async function distinctCountries(): Promise<string[]> {
  const rows = (await getSql().query(
    `SELECT DISTINCT country FROM churches
      WHERE status = 'approved' AND coalesce(country, '') <> ''`,
  )) as Array<{ country: string }>;
  return rows.map((row) => row.country);
}

/**
 * Every precomputed source with the exact SQL the pages used
 * (fetchFacetRelatedLinks): the whole directory, then each style,
 * denomination and country, one at a time with a pause in between so the
 * build itself never bursts D1.
 */
export async function computeFacetLinkRows(
  options: { pauseMs?: number; onSource?: (source: string) => void } = {},
): Promise<{ rows: FacetLinkRow[]; sources: number }> {
  const pause = () => new Promise((resolve) => setTimeout(resolve, options.pauseMs ?? 0));

  const all = await fetchFacetRelatedLinks({});
  if (all.country.length === 0 || all.city.length === 0) {
    throw new Error("Whole-directory facet links came back empty; keeping the previous generation.");
  }
  // Totals with the facet page's own filters (getChurchIndexPageData adds query: "").
  const rows = facetLinksToRows("all", "", all, await fetchChurchIndexTotalCount({ query: "" }));

  const countries = await distinctCountries();
  const sources: Source[] = [
    ...STYLE_FILTERS.map((filter): Source => ({ kind: "style", slug: filter.slug, filters: { styleSlug: filter.slug } })),
    ...DENOMINATION_FILTERS.map((filter): Source => ({
      kind: "denomination",
      slug: filter.slug,
      filters: { denominationSlug: filter.slug },
    })),
    ...all.country.flatMap((link): Source[] => {
      const country = countries.find((name) => slugify(name) === link.slug);
      return country ? [{ kind: "country", slug: link.slug, filters: { country } }] : [];
    }),
  ];

  for (const source of sources) {
    await pause();
    options.onSource?.(`${source.kind}:${source.slug}`);
    const links = await fetchFacetRelatedLinks(source.filters, FACET_RELATED_LIMITS[source.kind]);
    const total = await fetchChurchIndexTotalCount({ ...source.filters, query: "" });
    rows.push(...facetLinksToRows(source.kind, source.slug, links, total));
  }
  return { rows, sources: sources.length + 1 };
}
