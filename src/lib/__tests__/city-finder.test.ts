import { describe, expect, it } from "vitest";
import { getCityFinderMatches, getDistanceMiles, type CityFinderChurch } from "@/lib/city-finder";
import { getCityPageCopy } from "@/lib/city-page";
import { buildCityHubContent } from "@/lib/hub-content";

const AUSTIN = { label: "Central Austin", latitude: 30.2672, longitude: -97.7431 };

function church(overrides: Partial<CityFinderChurch> = {}): CityFinderChurch {
  return {
    slug: "central-community",
    name: "Central Community",
    country: "United States",
    address: "Austin, Texas",
    latitude: 30.2672,
    longitude: -97.7431,
    denomination: "Non-denominational",
    denominationSlugs: ["non-denominational"],
    worshipStyles: ["Contemporary"],
    styleSlugs: ["contemporary-worship"],
    languages: ["English"],
    serviceTime: "Sunday 10:00 AM",
    servicePeriods: ["morning"],
    hasKids: true,
    hasWorshipPreview: true,
    hasVisitorDetails: true,
    qualityScore: 80,
    ...overrides,
  };
}

describe("city church finder", () => {
  it("calculates local distance in miles", () => {
    expect(getDistanceMiles(AUSTIN, church())).toBe(0);
    expect(getDistanceMiles(AUSTIN, church({ latitude: 30.5083, longitude: -97.6789 }))).toBeGreaterThan(15);
  });

  it("sorts local matches by distance and removes churches outside the radius", () => {
    const matches = getCityFinderMatches({
      churches: [
        church({ slug: "round-rock", name: "Round Rock", latitude: 30.5083, longitude: -97.6789, qualityScore: 100 }),
        church({ slug: "east-austin", name: "East Austin", latitude: 30.2621, longitude: -97.6926, qualityScore: 20 }),
        church(),
      ],
      location: AUSTIN,
      radiusMiles: 10,
      filters: {},
    });

    expect(matches.map((match) => match.church.slug)).toEqual(["central-community", "east-austin"]);
  });

  it("combines factual filters and falls back to quality for citywide results", () => {
    const matches = getCityFinderMatches({
      churches: [
        church({ slug: "lower-quality", qualityScore: 40 }),
        church({ slug: "higher-quality", qualityScore: 90 }),
        church({ slug: "spanish", languages: ["Spanish"], qualityScore: 100 }),
      ],
      radiusMiles: 10,
      filters: { language: "English", servicePeriod: "morning", kids: true },
    });

    expect(matches.map((match) => match.church.slug)).toEqual(["higher-quality", "lower-quality"]);
  });
});

describe("Austin search intent copy", () => {
  it("targets best-church intent without claiming a universal winner", () => {
    const copy = getCityPageCopy({ slug: "austin", label: "Austin", totalCount: 341 });
    expect(copy.metadataTitle).toBe("Find the Best Church for You in Austin");
    expect(copy.pageTitle).toBe("Find the Best Church for You in Austin");
    expect(copy.quickAnswer).toContain("no universal best church");
  });

  it("explains local matching in visible FAQ copy", () => {
    const content = buildCityHubContent({
      city: "Austin",
      country: "United States",
      totalCount: 341,
      denominations: [{ label: "Baptist", count: 45 }],
      styles: [{ label: "Contemporary Worship", count: 80 }],
      hasLocalFinder: true,
    });

    expect(content?.faqs.map((faq) => faq.question)).toContain("What is the best church in Austin for me?");
    expect(content?.faqs.find((faq) => faq.question.includes("use my location"))?.answer).toContain("stay in the browser");
  });
});
