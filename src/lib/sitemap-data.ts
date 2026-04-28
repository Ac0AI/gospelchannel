// Shared sitemap data-assembly used by the sitemap index + chunk route handlers.
// Kept in /lib (not /app) so importing doesn't pull Next metadata helpers.

import { unstable_cache } from "next/cache";
import {
  CHURCH_INDEX_TAG,
  getChurchDirectorySeedCountAsync,
  getChurchDirectorySeedSliceAsync,
  getChurchDirectorySeedAsync,
  type ChurchDirectorySeed,
} from "@/lib/content";
import {
  getCityLinks,
  getCountryLinks,
  getDenominationLinks,
  getStyleLinks,
  type FacetLink,
} from "@/lib/church-directory";
import {
  getNetworkCount,
  getNetworksSlice,
  getPublishedCampusCount,
  getPublishedCampusesSlice,
} from "@/lib/church-networks";
import { getPrayerFilterIndex, type FilterOption } from "@/lib/prayer-filters";
import { getChurchSlugsWithPrayers } from "@/lib/prayer";
import { getCompareGuideSlugs } from "@/lib/tooling";
import { CONTENT_UPDATED_AT } from "@/lib/utils";

export const BASE_URL = "https://gospelchannel.com";

// Google allows up to 50 000 URLs per sitemap, but smaller chunks avoid Worker
// timeouts while rendering large XML responses at the edge.
export const CHUNK_SIZE = 5_000;

const STATIC_ROUTE_PATHS = [
  "",
  "/church",
  "/about",
  "/for-churches",
  "/church/suggest",
  "/guides",
  "/guides/church-fit-quiz",
  "/guides/first-visit-guide",
  "/guides/worship-style-match",
  "/compare",
] as const;

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

type SectionWindow = {
  offset: number;
  limit: number;
};

type SitemapFacetData = {
  countryLinks: FacetLink[];
  cityLinks: FacetLink[];
  styleLinks: FacetLink[];
  denominationLinks: FacetLink[];
};

type SitemapPrayerData = {
  countryOptions: FilterOption[];
  cityOptions: FilterOption[];
  prayerChurchCount: number;
};

type SitemapSectionCounts = {
  churchCount: number;
  countryLinkCount: number;
  cityLinkCount: number;
  styleLinkCount: number;
  denominationLinkCount: number;
  compareSlugs: string[];
  networkCount: number;
  campusCount: number;
  prayerCountryCount: number;
  prayerCityCount: number;
  prayerChurchCount: number;
};

function getSitemapLastModified(): Date {
  const date = new Date(CONTENT_UPDATED_AT);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildStaticRoute(path: string, lastModified: Date): SitemapEntry {
  return {
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
  };
}

function buildChurchRoute(church: Pick<ChurchDirectorySeed, "slug">, lastModified: Date): SitemapEntry {
  return {
    url: `${BASE_URL}/church/${church.slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.8,
  };
}

function buildFacetRoute(link: FacetLink, lastModified: Date, priority: number): SitemapEntry {
  return {
    url: `${BASE_URL}${link.href}`,
    lastModified,
    changeFrequency: "weekly",
    priority,
  };
}

function buildCompareRoute(slug: string, lastModified: Date): SitemapEntry {
  return {
    url: `${BASE_URL}/compare/${slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  };
}

function buildPrayerRootRoute(lastModified: Date): SitemapEntry {
  return {
    url: `${BASE_URL}/prayerwall`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.8,
  };
}

function buildPrayerCountryRoute(option: FilterOption, lastModified: Date): SitemapEntry {
  return {
    url: `${BASE_URL}/prayerwall/country/${option.slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.7,
  };
}

function buildPrayerCityRoute(option: FilterOption, lastModified: Date): SitemapEntry {
  return {
    url: `${BASE_URL}/prayerwall/city/${option.slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.6,
  };
}

function buildPrayerChurchRoute(option: Pick<FilterOption, "slug">, lastModified: Date): SitemapEntry {
  return {
    url: `${BASE_URL}/prayerwall/church/${option.slug}`,
    lastModified,
    changeFrequency: "daily",
    priority: 0.6,
  };
}

function getSectionWindow(
  rangeStart: number,
  rangeEndExclusive: number,
  sectionStart: number,
  sectionLength: number,
): SectionWindow | null {
  const sectionEndExclusive = sectionStart + sectionLength;
  const overlapStart = Math.max(rangeStart, sectionStart);
  const overlapEndExclusive = Math.min(rangeEndExclusive, sectionEndExclusive);
  if (overlapStart >= overlapEndExclusive) {
    return null;
  }

  return {
    offset: overlapStart - sectionStart,
    limit: overlapEndExclusive - overlapStart,
  };
}

function appendMappedSlice<T>(
  entries: SitemapEntry[],
  items: readonly T[],
  window: SectionWindow | null,
  mapper: (item: T) => SitemapEntry,
): void {
  if (!window) {
    return;
  }

  entries.push(...items.slice(window.offset, window.offset + window.limit).map(mapper));
}

function getSitemapEntryCountFromSections(data: SitemapSectionCounts): number {
  return STATIC_ROUTE_PATHS.length
    + data.churchCount
    + data.countryLinkCount
    + data.cityLinkCount
    + data.styleLinkCount
    + data.denominationLinkCount
    + data.compareSlugs.length
    + data.networkCount
    + data.campusCount
    + 1
    + data.prayerCountryCount
    + data.prayerCityCount
    + data.prayerChurchCount;
}

const getSitemapFacetDataCached = unstable_cache(
  async (): Promise<SitemapFacetData> => {
    const churches = await getChurchDirectorySeedAsync();
    return {
      countryLinks: getCountryLinks(churches),
      cityLinks: getCityLinks(churches),
      styleLinks: getStyleLinks(churches),
      denominationLinks: getDenominationLinks(churches),
    };
  },
  ["sitemap-facets-v1"],
  { revalidate: 3600, tags: [CHURCH_INDEX_TAG] },
);

const getSitemapPrayerDataCached = unstable_cache(
  async (): Promise<SitemapPrayerData> => {
    // Only emit sitemap entries for filter pages that have at least one
    // prayer. Empty filter pages share the same shell and triggered "Duplicate
    // without user-selected canonical" issues for ~1.6k URLs in GSC.
    const [index, prayerSlugs] = await Promise.all([
      getPrayerFilterIndex(),
      getChurchSlugsWithPrayers(),
    ]);

    const populatedChurchSlugs = new Set<string>();
    const populatedCountrySlugs = new Set<string>();
    const populatedCitySlugs = new Set<string>();
    for (const churchSlug of prayerSlugs) {
      populatedChurchSlugs.add(churchSlug);
      const country = index.countrySlugByChurchSlug[churchSlug];
      if (country) populatedCountrySlugs.add(country);
      // City lookup is by reverse: walk allCityOptions to find which contain this slug.
    }
    // Country/city options that have prayers
    const countryOptions = index.countryOptions.filter((o) =>
      populatedCountrySlugs.has(o.slug),
    );
    const cityOptions = index.allCityOptions.filter((opt) => {
      // Key for "no country, just city" entries from getCountryCityKey
      const cityChurches = index.churchOptionsByCountryAndCity[`::${opt.slug}`];
      if (!cityChurches) return false;
      return cityChurches.some((c) => populatedChurchSlugs.has(c.slug));
    });

    return {
      countryOptions,
      cityOptions,
      prayerChurchCount: populatedChurchSlugs.size,
    };
  },
  ["sitemap-prayer-v2"],
  { revalidate: 3600, tags: [CHURCH_INDEX_TAG] },
);

const getSitemapSectionCountsCached = unstable_cache(
  async (): Promise<SitemapSectionCounts> => {
    const [churchCount, facetData, prayerData, networkCount, campusCount] = await Promise.all([
      getChurchDirectorySeedCountAsync(),
      getSitemapFacetDataCached(),
      getSitemapPrayerDataCached(),
      getNetworkCount(),
      getPublishedCampusCount(),
    ]);

    return {
      churchCount,
      countryLinkCount: facetData.countryLinks.length,
      cityLinkCount: facetData.cityLinks.length,
      styleLinkCount: facetData.styleLinks.length,
      denominationLinkCount: facetData.denominationLinks.length,
      compareSlugs: getCompareGuideSlugs(),
      networkCount,
      campusCount,
      prayerCountryCount: prayerData.countryOptions.length,
      prayerCityCount: prayerData.cityOptions.length,
      prayerChurchCount: prayerData.prayerChurchCount,
    };
  },
  ["sitemap-section-counts-v1"],
  { revalidate: 3600, tags: [CHURCH_INDEX_TAG] },
);

export async function getSitemapEntryCount(): Promise<number> {
  const data = await getSitemapSectionCountsCached();
  return getSitemapEntryCountFromSections(data);
}

export async function buildSitemapEntriesForChunk(id: number): Promise<SitemapEntry[]> {
  const counts = await getSitemapSectionCountsCached();
  const totalEntries = getSitemapEntryCountFromSections(counts);
  const rangeStart = id * CHUNK_SIZE;
  if (rangeStart >= totalEntries) {
    return [];
  }

  const rangeEndExclusive = Math.min(totalEntries, rangeStart + CHUNK_SIZE);
  const lastModified = getSitemapLastModified();
  const entries: SitemapEntry[] = [];
  let cursor = 0;

  appendMappedSlice(
    entries,
    STATIC_ROUTE_PATHS,
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, STATIC_ROUTE_PATHS.length),
    (path) => buildStaticRoute(path, lastModified),
  );
  cursor += STATIC_ROUTE_PATHS.length;

  const churchWindow = getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.churchCount);
  if (churchWindow) {
    const churches = await getChurchDirectorySeedSliceAsync(churchWindow.offset, churchWindow.limit);
    entries.push(...churches.map((church) => buildChurchRoute(church, lastModified)));
  }
  cursor += counts.churchCount;

  const facetDataPromise =
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.countryLinkCount)
    || getSectionWindow(rangeStart, rangeEndExclusive, cursor + counts.countryLinkCount, counts.cityLinkCount)
    || getSectionWindow(rangeStart, rangeEndExclusive, cursor + counts.countryLinkCount + counts.cityLinkCount, counts.styleLinkCount)
    || getSectionWindow(
      rangeStart,
      rangeEndExclusive,
      cursor + counts.countryLinkCount + counts.cityLinkCount + counts.styleLinkCount,
      counts.denominationLinkCount,
    )
      ? getSitemapFacetDataCached()
      : null;
  const facetData = facetDataPromise ? await facetDataPromise : null;

  appendMappedSlice(
    entries,
    facetData?.countryLinks ?? [],
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.countryLinkCount),
    (link) => buildFacetRoute(link, lastModified, 0.75),
  );
  cursor += counts.countryLinkCount;

  appendMappedSlice(
    entries,
    facetData?.cityLinks ?? [],
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.cityLinkCount),
    (link) => buildFacetRoute(link, lastModified, 0.65),
  );
  cursor += counts.cityLinkCount;

  appendMappedSlice(
    entries,
    facetData?.styleLinks ?? [],
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.styleLinkCount),
    (link) => buildFacetRoute(link, lastModified, 0.7),
  );
  cursor += counts.styleLinkCount;

  appendMappedSlice(
    entries,
    facetData?.denominationLinks ?? [],
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.denominationLinkCount),
    (link) => buildFacetRoute(link, lastModified, 0.7),
  );
  cursor += counts.denominationLinkCount;

  appendMappedSlice(
    entries,
    counts.compareSlugs,
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.compareSlugs.length),
    (slug) => buildCompareRoute(slug, lastModified),
  );
  cursor += counts.compareSlugs.length;

  const networkWindow = getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.networkCount);
  if (networkWindow) {
    const networks = await getNetworksSlice(networkWindow.offset, networkWindow.limit);
    entries.push(...networks.map((network) => ({
      url: `${BASE_URL}/network/${network.slug}`,
      lastModified: new Date(network.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })));
  }
  cursor += counts.networkCount;

  const campusWindow = getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.campusCount);
  if (campusWindow) {
    const campuses = await getPublishedCampusesSlice(campusWindow.offset, campusWindow.limit);
    entries.push(...campuses.map((campus) => ({
      url: `${BASE_URL}/church/${campus.slug}`,
      lastModified: new Date(campus.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })));
  }
  cursor += counts.campusCount;

  appendMappedSlice(
    entries,
    [0],
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, 1),
    () => buildPrayerRootRoute(lastModified),
  );
  cursor += 1;

  const prayerDataPromise =
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.prayerCountryCount)
    || getSectionWindow(rangeStart, rangeEndExclusive, cursor + counts.prayerCountryCount, counts.prayerCityCount)
      ? getSitemapPrayerDataCached()
      : null;
  const prayerData = prayerDataPromise ? await prayerDataPromise : null;

  appendMappedSlice(
    entries,
    prayerData?.countryOptions ?? [],
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.prayerCountryCount),
    (option) => buildPrayerCountryRoute(option, lastModified),
  );
  cursor += counts.prayerCountryCount;

  appendMappedSlice(
    entries,
    prayerData?.cityOptions ?? [],
    getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.prayerCityCount),
    (option) => buildPrayerCityRoute(option, lastModified),
  );
  cursor += counts.prayerCityCount;

  const prayerChurchWindow = getSectionWindow(rangeStart, rangeEndExclusive, cursor, counts.prayerChurchCount);
  if (prayerChurchWindow) {
    // Filter to slugs that actually have prayers — emitting all 72k church
    // slugs as prayer-wall entries causes Google to flag empty pages as
    // duplicates.
    const [prayerIndex, prayerSlugs] = await Promise.all([
      getPrayerFilterIndex(),
      getChurchSlugsWithPrayers(),
    ]);
    const populatedChurches = prayerIndex.allChurchOptions.filter((o) =>
      prayerSlugs.has(o.slug),
    );
    const prayerChurches = populatedChurches.slice(
      prayerChurchWindow.offset,
      prayerChurchWindow.offset + prayerChurchWindow.limit,
    );
    entries.push(...prayerChurches.map((option) => buildPrayerChurchRoute(option, lastModified)));
  }

  return entries;
}

export const getSitemapIndexXml = unstable_cache(
  async (): Promise<string> => {
    const entryCount = await getSitemapEntryCount();
    const chunkCount = Math.max(1, Math.ceil(entryCount / CHUNK_SIZE));
    return renderIndexXml(chunkCount, getSitemapLastModified());
  },
  ["sitemap-index-xml-v1"],
  { revalidate: 3600, tags: [CHURCH_INDEX_TAG] },
);

export const getSitemapChunkXml = unstable_cache(
  async (id: number): Promise<string | null> => {
    const entries = await buildSitemapEntriesForChunk(id);
    if (entries.length === 0) {
      return null;
    }
    return renderUrlsetXml(entries);
  },
  ["sitemap-chunk-xml-v1"],
  { revalidate: 3600, tags: [CHURCH_INDEX_TAG] },
);

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderUrlsetXml(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const parts = [`<loc>${escapeXml(e.url)}</loc>`];
      if (e.lastModified) parts.push(`<lastmod>${e.lastModified.toISOString()}</lastmod>`);
      if (e.changeFrequency) parts.push(`<changefreq>${e.changeFrequency}</changefreq>`);
      if (typeof e.priority === "number") parts.push(`<priority>${e.priority.toFixed(2)}</priority>`);
      return `<url>${parts.join("")}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function renderIndexXml(chunkCount: number, lastModified: Date): string {
  const items: string[] = [];
  for (let i = 0; i < chunkCount; i += 1) {
    items.push(
      `<sitemap><loc>${BASE_URL}/sitemap-chunk/${i}.xml</loc><lastmod>${lastModified.toISOString()}</lastmod></sitemap>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.join("")}</sitemapindex>`;
}
