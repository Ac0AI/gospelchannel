import { getSql } from "@/db";
import { fetchChurchIndexTotalCount, fetchFacetRelatedLinks } from "@/lib/church";
import { DENOMINATION_FILTERS, STYLE_FILTERS, type ChurchDirectoryFilters } from "@/lib/church-directory";
import { FACET_RELATED_LIMITS, facetLinksToRows, type FacetLinkRow, type FacetLinkSourceKind } from "@/lib/facet-links";
import { slugify } from "@/lib/slugify";

type Source = { kind: Exclude<FacetLinkSourceKind, "all">; slug: string; filters: ChurchDirectoryFilters };

const OVERLOAD = /\b429\b|overloaded|Too many resources/i;
const DEFAULT_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000];

/**
 * A batch job waits out D1's resource window instead of failing: on an
 * overload it pauses and tries the same query again. (A page view must not do
 * this, D1's advice is to spread load, which is what the pauses are for; but a
 * nightly job that gives up after 14 minutes discards everything it computed,
 * as on 2026-11-04 when the facet pages still computed live and competed with
 * it.) Any other error fails at once.
 */
async function withOverloadRetry<T>(run: () => Promise<T>, delaysMs: number[], label: string): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!OVERLOAD.test(message) || attempt >= delaysMs.length) throw error;
      console.warn(`  ${label}: D1 overloaded, retrying in ${delaysMs[attempt] / 1000} s (${message})`);
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}

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
 * denomination and country, one at a time. The links and the total of a
 * style or denomination are each a scan of every approved church, so there is
 * a pause before each of them: D1 limits resources per database in 10-second
 * windows, and the site serves visitors from the same database meanwhile.
 */
export async function computeFacetLinkRows(
  options: { pauseMs?: number; retryDelaysMs?: number[]; onSource?: (source: string) => void } = {},
): Promise<{ rows: FacetLinkRow[]; sources: number }> {
  const pause = () => new Promise((resolve) => setTimeout(resolve, options.pauseMs ?? 0));
  const retry = <T>(label: string, run: () => Promise<T>) =>
    withOverloadRetry(run, options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS, label);

  const all = await retry("all:links", () => fetchFacetRelatedLinks({}));
  if (all.country.length === 0 || all.city.length === 0) {
    throw new Error("Whole-directory facet links came back empty; keeping the previous generation.");
  }
  // Totals with the facet page's own filters (getChurchIndexPageData adds query: "").
  const rows = facetLinksToRows("all", "", all, await retry("all:total", () => fetchChurchIndexTotalCount({ query: "" })));

  const countries = await retry("countries", distinctCountries);
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
    const name = `${source.kind}:${source.slug}`;
    const links = await retry(`${name}:links`, () => fetchFacetRelatedLinks(source.filters, FACET_RELATED_LIMITS[source.kind]));
    await pause();
    const total = await retry(`${name}:total`, () => fetchChurchIndexTotalCount({ ...source.filters, query: "" }));
    rows.push(...facetLinksToRows(source.kind, source.slug, links, total));
  }
  return { rows, sources: sources.length + 1 };
}
