import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAllPublishedCampusesMock,
  getNetworkForWorshipChurchMock,
  getNetworkCampusesMock,
} = vi.hoisted(() => ({
  getAllPublishedCampusesMock: vi.fn(),
  getNetworkForWorshipChurchMock: vi.fn(),
  getNetworkCampusesMock: vi.fn(),
}));

vi.mock("@/lib/church-networks", () => ({
  getAllPublishedCampuses: getAllPublishedCampusesMock,
  getNetworkForWorshipChurch: getNetworkForWorshipChurchMock,
  getNetworkCampuses: getNetworkCampusesMock,
}));

import { type ChurchDirectorySeed } from "@/lib/content";
import {
  buildPrayerFilterIndex,
  extractPrayerCity,
  getChurchSlugsForNetwork,
} from "@/lib/prayer-filters";

const churches: ChurchDirectorySeed[] = [
  {
    slug: "hope-nyc",
    name: "Hope NYC",
    country: "usa",
    location: "New York, United States",
    musicStyle: ["Contemporary Worship"],
    denomination: "Non-denominational",
  },
  {
    slug: "mercy-london",
    name: "Mercy London",
    country: "uk",
    location: "London, United Kingdom",
    musicStyle: ["Gospel"],
    denomination: "Pentecostal",
  },
];

const campuses = [
  {
    slug: "hope-brooklyn",
    name: "Hope Brooklyn",
    city: "Brooklyn",
    country: "United States",
  },
  {
    slug: "mercy-manchester",
    name: "Mercy Manchester",
    city: "Manchester",
    country: "United Kingdom",
  },
];

describe("prayer-filters", () => {
  beforeEach(() => {
    getAllPublishedCampusesMock.mockReset();
    getNetworkForWorshipChurchMock.mockReset();
    getNetworkCampusesMock.mockReset();
  });

  it("extracts valid prayer cities and rejects bad values", () => {
    const knownCountrySlugs = new Set(["united-states", "united-kingdom"]);

    expect(extractPrayerCity("Stockholm, Sweden", "Sweden", knownCountrySlugs)).toBe("Stockholm");
    expect(extractPrayerCity("12345", "Sweden", knownCountrySlugs)).toBeUndefined();
    expect(extractPrayerCity("Worldwide", "Sweden", knownCountrySlugs)).toBeUndefined();
    expect(extractPrayerCity("United States, United States", "United States", knownCountrySlugs)).toBeUndefined();
  });

  it("builds normalized country, city, and church options from churches and campuses", () => {
    const index = buildPrayerFilterIndex(churches, campuses);

    expect(index.countryOptions.map((option) => option.slug)).toEqual([
      "united-kingdom",
      "united-states",
    ]);
    expect(index.countryLabelBySlug["united-states"]).toBe("United States");
    expect(index.countryLabelBySlug["united-kingdom"]).toBe("United Kingdom");

    expect(index.citiesByCountry["united-states"]).toEqual([
      { slug: "brooklyn", label: "Brooklyn" },
      { slug: "new-york", label: "New York" },
    ]);
    expect(index.churchOptionsByCountry["united-states"]).toEqual([
      { slug: "hope-brooklyn", label: "Hope Brooklyn" },
      { slug: "hope-nyc", label: "Hope NYC" },
    ]);
    expect(index.churchOptionsByCountryAndCity["united-states::brooklyn"]).toEqual([
      { slug: "hope-brooklyn", label: "Hope Brooklyn" },
    ]);
    expect(index.churchSlugsByCity.brooklyn).toEqual(["hope-brooklyn"]);
    expect(index.churchSlugsByCountry["united-kingdom"]).toEqual([
      "mercy-london",
      "mercy-manchester",
    ]);
  });

  it("expands a church filter to its published network campuses", async () => {
    getNetworkForWorshipChurchMock.mockResolvedValue({
      id: "network-1",
      slug: "hope-network",
      name: "Hope Network",
    });
    getNetworkCampusesMock.mockResolvedValue([
      { slug: "hope-brooklyn" },
      { slug: "hope-queens" },
    ]);

    await expect(getChurchSlugsForNetwork("hope-nyc-network-test")).resolves.toEqual([
      "hope-brooklyn",
      "hope-nyc-network-test",
      "hope-queens",
    ]);
    expect(getNetworkCampusesMock).toHaveBeenCalledWith("network-1");
  });

  it("returns the base church slug when no network exists", async () => {
    getNetworkForWorshipChurchMock.mockResolvedValue(null);

    await expect(getChurchSlugsForNetwork("solo-church-network-test")).resolves.toEqual([
      "solo-church-network-test",
    ]);
    expect(getNetworkCampusesMock).not.toHaveBeenCalled();
  });
});
