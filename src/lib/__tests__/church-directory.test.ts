import { describe, expect, it } from "vitest";
import {
  buildChurchMatchReasons,
  filterChurchDirectory,
  getPrimaryDenominationFilter,
  getPrimaryStyleFilter,
  getStyleLinks,
  paginateChurches,
  type ChurchDirectoryEntry,
} from "@/lib/church-directory";

const churches: ChurchDirectoryEntry[] = [
  {
    slug: "hope-london",
    name: "Hope Church London",
    aliases: ["Hope London"],
    description: "Contemporary worship in London.",
    country: "United Kingdom",
    location: "London, United Kingdom",
    musicStyle: ["Contemporary Worship"],
    denomination: "Non-denominational",
    displayReady: true,
    promotionTier: "promotable" as const,
    displayScore: 82,
    qualityScore: 75,
    language: "English",
    enrichmentHint: {
      dataRichnessScore: 60,
      location: "London",
      serviceTimes: "Sunday 10:00",
      summary: "Hope Church",
      languages: ["English"],
      childrenMinistry: true,
    },
    spotifyPlaylistIds: ["abc"],
    additionalPlaylists: [],
    playlistCount: 2,
  },
  {
    slug: "victory-stockholm",
    name: "Victory Church Stockholm",
    aliases: ["Victory Stockholm"],
    description: "Spirit-led worship in Stockholm.",
    country: "Sweden",
    location: "Stockholm, Sweden",
    musicStyle: ["Charismatic Worship"],
    denomination: "Pentecostal",
    displayReady: true,
    promotionTier: "catalog_only" as const,
    displayScore: 70,
    qualityScore: 68,
    enrichmentHint: {
      dataRichnessScore: 45,
      location: "Stockholm",
      serviceTimes: "Sunday 11:00",
      summary: "Victory Church",
      youthMinistry: true,
    },
    spotifyPlaylistIds: ["def"],
    additionalPlaylists: [],
    playlistCount: 1,
  },
  {
    slug: "grace-berlin",
    name: "Grace Berlin",
    aliases: ["Grace"],
    description: "Gospel choir community in Berlin.",
    country: "Germany",
    location: "Berlin, Germany",
    musicStyle: ["Contemporary Gospel"],
    denomination: "Baptist",
    displayReady: true,
    promotionTier: "catalog_only" as const,
    displayScore: 60,
    qualityScore: 64,
    enrichmentHint: { dataRichnessScore: 35, location: "Berlin", serviceTimes: "Sunday 09:30", summary: "Grace Berlin" },
    spotifyPlaylistIds: [],
    additionalPlaylists: [],
    playlistCount: 0,
  },
  {
    slug: "stmarys-malaga",
    name: "St Mary's Málaga",
    aliases: ["St Marys Malaga"],
    description: "Historic church community in Málaga.",
    country: "Spain",
    location: "Málaga, Spain",
    musicStyle: ["Contemporary Worship"],
    denomination: "Anglican",
    displayReady: true,
    promotionTier: "catalog_only" as const,
    displayScore: 58,
    qualityScore: 60,
    enrichmentHint: { dataRichnessScore: 30, location: "Málaga", serviceTimes: "Sunday 10:30", summary: "St Mary's Málaga" },
    spotifyPlaylistIds: [],
    additionalPlaylists: [],
    playlistCount: 0,
  },
];

describe("church-directory", () => {
  it("matches primary style and denomination filters", () => {
    expect(getPrimaryStyleFilter(churches[0])?.slug).toBe("contemporary-worship");
    expect(getPrimaryStyleFilter(churches[1])?.slug).toBe("charismatic");
    expect(getPrimaryDenominationFilter(churches[1])?.slug).toBe("pentecostal");
  });

  it("filters by search query and city", () => {
    expect(filterChurchDirectory([...churches], { query: "london" }).map((church) => church.slug)).toEqual(["hope-london"]);
    expect(filterChurchDirectory([...churches], { citySlug: "berlin" }).map((church) => church.slug)).toEqual(["grace-berlin"]);
  });

  it("matches diacritics and apostrophes loosely in search", () => {
    expect(filterChurchDirectory([...churches], { query: "malaga" }).map((church) => church.slug)).toContain("stmarys-malaga");
    expect(filterChurchDirectory([...churches], { query: "málaga" }).map((church) => church.slug)).toContain("stmarys-malaga");
    expect(filterChurchDirectory([...churches], { query: "st marys" }).map((church) => church.slug)).toContain("stmarys-malaga");
    expect(filterChurchDirectory([...churches], { query: "st mary's" }).map((church) => church.slug)).toContain("stmarys-malaga");
  });

  it("filters by style and denomination", () => {
    expect(filterChurchDirectory([...churches], { styleSlug: "gospel" }).map((church) => church.slug)).toEqual(["grace-berlin"]);
    expect(filterChurchDirectory([...churches], { denominationSlug: "pentecostal" }).map((church) => church.slug)).toEqual(["victory-stockholm"]);
  });

  it("filters by an exact country value", () => {
    expect(filterChurchDirectory([...churches], { country: "Sweden" }).map((church) => church.slug)).toEqual(["victory-stockholm"]);
  });

  it("filters by language and kids/youth proof signals", () => {
    expect(filterChurchDirectory([...churches], { language: "English" }).map((church) => church.slug)).toEqual(["hope-london"]);

    const frenchCodeChurch = {
      ...churches[2]!,
      slug: "grace-paris",
      country: "France",
      location: "Paris, France",
      language: "fr",
    };
    expect(filterChurchDirectory([frenchCodeChurch], { language: "French" }).map((church) => church.slug)).toEqual(["grace-paris"]);

    const familyResults = filterChurchDirectory([...churches], { hasKids: true });
    expect(familyResults.map((church) => church.slug)).toEqual(["hope-london", "victory-stockholm"]);
    expect(familyResults[0]?.matchReasons).toBeUndefined();

    const familySearchResults = filterChurchDirectory([...churches], { query: "stockholm", hasKids: true });
    expect(familySearchResults.map((church) => church.slug)).toEqual(["victory-stockholm"]);
  });

  it("adds match reasons only when filter proof is present", () => {
    expect(buildChurchMatchReasons(churches[0]!, { hasKids: true })).toContain("Kids/youth ministry");
    expect(buildChurchMatchReasons(churches[2]!, { hasKids: true })).not.toContain("Kids/youth ministry");
  });

  it("paginates filtered results", () => {
    const result = paginateChurches(filterChurchDirectory([...churches]), 2, 2);
    expect(result.currentPage).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.pageItems).toHaveLength(2);
  });

  it("uses SEO labels for style landing links", () => {
    const labels = getStyleLinks([...churches]).map((link) => link.label);
    expect(labels).toContain("Contemporary Worship");
    expect(labels).not.toContain("Congregational");
  });
});
