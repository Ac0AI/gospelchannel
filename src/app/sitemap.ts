import type { MetadataRoute } from "next";
import { getChurchesAsync } from "@/lib/content";
import {
  getCityLinks,
  getCountryLinks,
  getDenominationLinks,
  getStyleLinks,
} from "@/lib/church-directory";
import { CONTENT_UPDATED_AT } from "@/lib/utils";
import { getAllNetworks, getAllPublishedCampuses } from "@/lib/church-networks";
import { getAvailableCountries, getAvailableCities, getAvailableChurches } from "@/lib/prayer-filters";
import { getCompareGuideSlugs } from "@/lib/tooling";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://gospelchannel.com";
  const now = new Date(CONTENT_UPDATED_AT);
  const fallbackDate = Number.isNaN(now.getTime()) ? new Date() : now;

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/church",
    "/about",
    "/for-churches",
    "/church/suggest",
    "/tools",
    "/tools/church-fit-quiz",
    "/tools/first-visit-guide",
    "/tools/worship-style-match",
    "/compare",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: path === "" ? 1 : 0.8,
  }));

  const [churches, prayerCountries, prayerCities, prayerChurches] = await Promise.all([
    getChurchesAsync(),
    getAvailableCountries(),
    getAvailableCities(),
    getAvailableChurches(),
  ]);
  const churchRoutes: MetadataRoute.Sitemap = churches.map((church) => ({
    url: `${baseUrl}/church/${church.slug}`,
    lastModified: (() => {
      const date = new Date(church.verifiedAt ?? church.lastResearched ?? CONTENT_UPDATED_AT);
      return Number.isNaN(date.getTime()) ? fallbackDate : date;
    })(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const countryRoutes: MetadataRoute.Sitemap = getCountryLinks(churches).map((country) => ({
    url: `${baseUrl}${country.href}`,
    lastModified: fallbackDate,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  const cityRoutes: MetadataRoute.Sitemap = getCityLinks(churches).map((city) => ({
    url: `${baseUrl}${city.href}`,
    lastModified: fallbackDate,
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const styleRoutes: MetadataRoute.Sitemap = getStyleLinks(churches).map((style) => ({
    url: `${baseUrl}${style.href}`,
    lastModified: fallbackDate,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const denominationRoutes: MetadataRoute.Sitemap = getDenominationLinks(churches).map((denomination) => ({
    url: `${baseUrl}${denomination.href}`,
    lastModified: fallbackDate,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const compareRoutes: MetadataRoute.Sitemap = getCompareGuideSlugs().map((slug) => ({
    url: `${baseUrl}/compare/${slug}`,
    lastModified: fallbackDate,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Network pages
  const networks = await getAllNetworks();
  const networkRoutes: MetadataRoute.Sitemap = networks.map((network) => ({
    url: `${baseUrl}/network/${network.slug}`,
    lastModified: new Date(network.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Campus pages (rendered under /church/[slug])
  const campuses = await getAllPublishedCampuses();
  const campusRoutes: MetadataRoute.Sitemap = campuses.map((campus) => ({
    url: `${baseUrl}/church/${campus.slug}`,
    lastModified: new Date(campus.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Prayer wall routes
  const prayerWallRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/prayerwall`,
      lastModified: fallbackDate,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...prayerCountries.map((c) => ({
      url: `${baseUrl}/prayerwall/country/${c.slug}`,
      lastModified: fallbackDate,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...prayerCities.map((c) => ({
      url: `${baseUrl}/prayerwall/city/${c.slug}`,
      lastModified: fallbackDate,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...prayerChurches.map((c) => ({
      url: `${baseUrl}/prayerwall/church/${c.slug}`,
      lastModified: fallbackDate,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];

  return [
    ...staticRoutes,
    ...churchRoutes,
    ...countryRoutes,
    ...cityRoutes,
    ...styleRoutes,
    ...denominationRoutes,
    ...compareRoutes,
    ...networkRoutes,
    ...campusRoutes,
    ...prayerWallRoutes,
  ];
}
