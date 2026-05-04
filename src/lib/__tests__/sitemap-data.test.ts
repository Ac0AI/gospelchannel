import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getChurchDirectorySeedAsyncMock,
  getChurchDirectorySeedCountAsyncMock,
  getChurchDirectorySeedSliceAsyncMock,
  getCountryLinksMock,
  getCityLinksMock,
  getStyleLinksMock,
  getDenominationLinksMock,
  getNetworkCountMock,
  getNetworksSliceMock,
  getPublishedCampusCountMock,
  getPublishedCampusesSliceMock,
  getPrayerFilterIndexMock,
  getCompareGuideSlugsMock,
  getChurchSlugsWithPrayersMock,
} = vi.hoisted(() => ({
  getChurchDirectorySeedAsyncMock: vi.fn(),
  getChurchDirectorySeedCountAsyncMock: vi.fn(),
  getChurchDirectorySeedSliceAsyncMock: vi.fn(),
  getCountryLinksMock: vi.fn(),
  getCityLinksMock: vi.fn(),
  getStyleLinksMock: vi.fn(),
  getDenominationLinksMock: vi.fn(),
  getNetworkCountMock: vi.fn(),
  getNetworksSliceMock: vi.fn(),
  getPublishedCampusCountMock: vi.fn(),
  getPublishedCampusesSliceMock: vi.fn(),
  getPrayerFilterIndexMock: vi.fn(),
  getCompareGuideSlugsMock: vi.fn(),
  getChurchSlugsWithPrayersMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/lib/content", () => ({
  CHURCH_INDEX_TAG: "church-index",
  getChurchDirectorySeedAsync: getChurchDirectorySeedAsyncMock,
  getChurchDirectorySeedCountAsync: getChurchDirectorySeedCountAsyncMock,
  getChurchDirectorySeedSliceAsync: getChurchDirectorySeedSliceAsyncMock,
}));

vi.mock("@/lib/church-directory", () => ({
  getCountryLinks: getCountryLinksMock,
  getCityLinks: getCityLinksMock,
  getStyleLinks: getStyleLinksMock,
  getDenominationLinks: getDenominationLinksMock,
}));

vi.mock("@/lib/church-networks", () => ({
  getNetworkCount: getNetworkCountMock,
  getNetworksSlice: getNetworksSliceMock,
  getPublishedCampusCount: getPublishedCampusCountMock,
  getPublishedCampusesSlice: getPublishedCampusesSliceMock,
}));

vi.mock("@/lib/prayer-filters", () => ({
  getPrayerFilterIndex: getPrayerFilterIndexMock,
}));

vi.mock("@/lib/prayer", () => ({
  getChurchSlugsWithPrayers: getChurchSlugsWithPrayersMock,
}));

vi.mock("@/lib/tooling", () => ({
  getCompareGuideSlugs: getCompareGuideSlugsMock,
}));

import { buildSitemapEntriesForChunk, getSitemapEntryCount } from "@/lib/sitemap-data";

function makeChurch(slug: string) {
  return {
    slug,
    name: slug,
    country: "Sweden",
    location: "Stockholm, Sweden",
    musicStyle: undefined,
    denomination: undefined,
  };
}

describe("sitemap-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getCountryLinksMock.mockReturnValue([
      { slug: "sweden", label: "Sweden", href: "/church/country/sweden", count: 12 },
    ]);
    getCityLinksMock.mockReturnValue([
      { slug: "stockholm", label: "Stockholm", href: "/church/city/stockholm", count: 8 },
    ]);
    getStyleLinksMock.mockReturnValue([
      { slug: "gospel", label: "Gospel", href: "/church/style/gospel", count: 4 },
    ]);
    getDenominationLinksMock.mockReturnValue([
      { slug: "pentecostal", label: "Pentecostal", href: "/church/denomination/pentecostal", count: 3 },
    ]);

    getChurchDirectorySeedAsyncMock.mockResolvedValue([makeChurch("church-0")]);
    getNetworkCountMock.mockResolvedValue(1);
    getNetworksSliceMock.mockResolvedValue([
      { slug: "network-1", updatedAt: "2026-04-20T00:00:00.000Z" },
    ]);
    getPublishedCampusCountMock.mockResolvedValue(1);
    getPublishedCampusesSliceMock.mockResolvedValue([
      { slug: "campus-1", updatedAt: "2026-04-20T00:00:00.000Z" },
    ]);
    getPrayerFilterIndexMock.mockResolvedValue({
      countryOptions: [{ slug: "sweden", label: "Sweden" }],
      allCityOptions: [{ slug: "stockholm", label: "Stockholm" }],
      allChurchOptions: [
        { slug: "prayer-1", label: "Prayer 1" },
        { slug: "prayer-2", label: "Prayer 2" },
      ],
      countrySlugByChurchSlug: {
        "prayer-1": "sweden",
        "prayer-2": "sweden",
      },
      churchOptionsByCountryAndCity: {
        "sweden::stockholm": [
          { slug: "prayer-1", label: "Prayer 1" },
          { slug: "prayer-2", label: "Prayer 2" },
        ],
        "::stockholm": [
          { slug: "prayer-1", label: "Prayer 1" },
          { slug: "prayer-2", label: "Prayer 2" },
        ],
      },
    });
    getCompareGuideSlugsMock.mockReturnValue(["compare-a"]);
    getChurchSlugsWithPrayersMock.mockResolvedValue(new Set(["prayer-1", "prayer-2"]));
  });

  it("computes the total sitemap entry count from section counts", async () => {
    getChurchDirectorySeedCountAsyncMock.mockResolvedValue(3);

    await expect(getSitemapEntryCount()).resolves.toBe(26);
  });

  it("builds chunk 0 from the exact church slice without touching later DB slices", async () => {
    getChurchDirectorySeedCountAsyncMock.mockResolvedValue(5_002);
    getChurchDirectorySeedSliceAsyncMock.mockImplementation(async (offset: number, limit: number) => (
      Array.from({ length: limit }, (_, index) => makeChurch(`church-${offset + index}`))
    ));

    const entries = await buildSitemapEntriesForChunk(0);

    expect(entries).toHaveLength(2_500);
    expect(entries[0]?.url).toBe("https://gospelchannel.com");
    expect(entries[9]?.url).toBe("https://gospelchannel.com/compare");
    expect(entries[10]?.url).toBe("https://gospelchannel.com/european-church-tech-2026");
    expect(entries[11]?.url).toBe("https://gospelchannel.com/church/church-0");
    expect(entries.at(-1)?.url).toBe("https://gospelchannel.com/church/church-2488");
    expect(getChurchDirectorySeedSliceAsyncMock).toHaveBeenCalledWith(0, 2_489);
    expect(getNetworksSliceMock).not.toHaveBeenCalled();
    expect(getPublishedCampusesSliceMock).not.toHaveBeenCalled();
  });

  it("builds later chunks in section order after the church slice ends", async () => {
    getChurchDirectorySeedCountAsyncMock.mockResolvedValue(5_002);
    getChurchDirectorySeedSliceAsyncMock.mockImplementation(async (offset: number, limit: number) => (
      Array.from({ length: limit }, (_, index) => makeChurch(`church-${offset + index}`))
    ));

    const entries = await buildSitemapEntriesForChunk(2);

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://gospelchannel.com/church/church-4989",
      "https://gospelchannel.com/church/church-4990",
      "https://gospelchannel.com/church/church-4991",
      "https://gospelchannel.com/church/church-4992",
      "https://gospelchannel.com/church/church-4993",
      "https://gospelchannel.com/church/church-4994",
      "https://gospelchannel.com/church/church-4995",
      "https://gospelchannel.com/church/church-4996",
      "https://gospelchannel.com/church/church-4997",
      "https://gospelchannel.com/church/church-4998",
      "https://gospelchannel.com/church/church-4999",
      "https://gospelchannel.com/church/church-5000",
      "https://gospelchannel.com/church/church-5001",
      "https://gospelchannel.com/church/country/sweden",
      "https://gospelchannel.com/church/city/stockholm",
      "https://gospelchannel.com/church/style/gospel",
      "https://gospelchannel.com/church/denomination/pentecostal",
      "https://gospelchannel.com/compare/compare-a",
      "https://gospelchannel.com/network/network-1",
      "https://gospelchannel.com/church/campus-1",
      "https://gospelchannel.com/prayerwall",
      "https://gospelchannel.com/prayerwall/country/sweden",
      "https://gospelchannel.com/prayerwall/city/stockholm",
      "https://gospelchannel.com/prayerwall/church/prayer-1",
      "https://gospelchannel.com/prayerwall/church/prayer-2",
    ]);
    expect(getChurchDirectorySeedSliceAsyncMock).toHaveBeenCalledWith(4_989, 13);
    expect(getNetworksSliceMock).toHaveBeenCalledWith(0, 1);
    expect(getPublishedCampusesSliceMock).toHaveBeenCalledWith(0, 1);
  });
});
