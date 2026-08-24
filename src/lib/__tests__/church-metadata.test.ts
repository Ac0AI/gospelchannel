import { describe, expect, it, vi } from "vitest";
import type { ChurchConfig, ChurchEnrichment } from "@/types/gospel";
import {
  buildChurchDescription,
  buildChurchTitle,
  classifyChurchTier,
  getChurchSearchAliases,
  type ChurchMetadataInput,
} from "../church-metadata";

vi.mock("@/lib/church", () => ({
  getChurchFacetPageData: vi.fn(async ({ kind }: { kind: string }) => ({
    label: {
      city: "London",
      country: "United Kingdom",
      denomination: "Pentecostal",
      style: "Contemporary Worship",
    }[kind],
    totalCount: 12,
  })),
}));

import { generateMetadata as generateCityMetadata } from "@/app/church/city/[slug]/page";
import { generateMetadata as generateCountryMetadata } from "@/app/church/country/[slug]/page";
import { generateMetadata as generateDenominationMetadata } from "@/app/church/denomination/[slug]/page";
import { generateMetadata as generateStyleMetadata } from "@/app/church/style/[slug]/page";
import { buildCityTitle, getCityGuideLinks } from "@/lib/city-page";

function makeChurch(overrides: Partial<ChurchConfig> = {}): ChurchConfig {
  return {
    slug: "example-church",
    name: "Example Church",
    description: "",
    spotifyPlaylistIds: [],
    logo: "",
    website: "",
    spotifyUrl: "",
    country: "United Kingdom",
    location: "London, United Kingdom",
    ...overrides,
  } as ChurchConfig;
}

function makeInput(
  church: Partial<ChurchConfig> = {},
  enrichment: Partial<ChurchEnrichment> | null = null,
  mergedProfile: Record<string, unknown> | null = null,
  displayName?: string,
): ChurchMetadataInput {
  const fullChurch = makeChurch(church);
  return {
    church: fullChurch,
    enrichment: enrichment as ChurchEnrichment | null,
    mergedProfile,
    displayName: displayName ?? fullChurch.name,
  };
}

describe("classifyChurchTier", () => {
  it("returns 'music' when church has spotify playlists", () => {
    const input = makeInput({ spotifyPlaylistIds: ["pl1"] });
    expect(classifyChurchTier(input)).toBe("music");
  });

  it("returns 'music' when church has additional playlists", () => {
    const input = makeInput({ spotifyPlaylistIds: [], additionalPlaylists: ["pl2"] });
    expect(classifyChurchTier(input)).toBe("music");
  });

  it("returns 'profile' when church has service times", () => {
    const input = makeInput({}, { serviceTimes: [{ day: "Sunday", time: "10:00" }] });
    expect(classifyChurchTier(input)).toBe("profile");
  });

  it("returns 'profile' when church has denomination only", () => {
    const input = makeInput({ denomination: "Pentecostal" });
    expect(classifyChurchTier(input)).toBe("profile");
  });

  it("returns 'profile' when church has long description (>=80 chars)", () => {
    const input = makeInput({
      description: "A welcoming community church serving the heart of the city with warmth.",
    });
    // Description length: 71 chars - too short
    expect(classifyChurchTier(input)).toBe("thin");

    const richer = makeInput({
      description: "A welcoming community church serving the heart of the city with warmth and devotion every Sunday.",
    });
    expect(classifyChurchTier(richer)).toBe("profile");
  });

  it("returns 'thin' when only name and country exist", () => {
    const input = makeInput({ denomination: undefined });
    expect(classifyChurchTier(input)).toBe("thin");
  });

  it("merged profile language array overrides enrichment", () => {
    const input = makeInput({}, { languages: [] }, { languages: ["English"] });
    expect(classifyChurchTier(input)).toBe("profile");
  });
});

describe("buildChurchTitle", () => {
  it("appends city to name when city is missing from name (music tier)", () => {
    const input = makeInput(
      { name: "Hillsong Church", spotifyPlaylistIds: ["pl1"], location: "London, UK" },
      null,
      null,
      "Hillsong Church",
    );
    expect(buildChurchTitle(input)).toBe(
      "Hillsong Church in London · Worship Music & Church Info",
    );
  });

  it("does not duplicate city when name already contains it", () => {
    const input = makeInput(
      { name: "Hope Church Copenhagen", spotifyPlaylistIds: ["pl1"], location: "Copenhagen, Denmark" },
      null,
      null,
      "Hope Church Copenhagen",
    );
    expect(buildChurchTitle(input)).toBe(
      "Hope Church Copenhagen · Worship Music & Church Info",
    );
  });

  it("uses profile template when no music data but has profile signals", () => {
    const input = makeInput(
      { name: "Hope Church", denomination: "Pentecostal", location: "Berlin, Germany" },
      null,
      null,
      "Hope Church",
    );
    expect(buildChurchTitle(input)).toBe(
      "Hope Church in Berlin · Church Info",
    );
  });

  it("uses thin template with country fallback when no other signals", () => {
    const input = makeInput(
      { name: "Small Church", denomination: undefined, location: undefined, country: "Greece" },
      null,
      null,
      "Small Church",
    );
    expect(buildChurchTitle(input)).toBe("Small Church in Greece · Church Profile");
  });

  it("does not duplicate country in thin tier when name already contains it", () => {
    const input = makeInput(
      { name: "Greece Worship Center", denomination: undefined, location: undefined, country: "Greece" },
      null,
      null,
      "Greece Worship Center",
    );
    expect(buildChurchTitle(input)).toBe("Greece Worship Center · Church Profile");
  });

  it("falls back gracefully when neither city nor country exists", () => {
    const input = makeInput(
      { name: "Mystery Church", denomination: undefined, location: undefined, country: "" },
      null,
      null,
      "Mystery Church",
    );
    expect(buildChurchTitle(input)).toBe("Mystery Church · Church Profile");
  });

  it("prioritizes service times and address for local-intent searches", () => {
    const input = makeInput(
      { name: "Stone Edge Church", location: "Macon", country: "United States" },
      {
        streetAddress: "5659 Zebulon Rd",
        serviceTimes: [{ day: "Sunday", time: "10:30" }],
      },
    );
    expect(buildChurchTitle(input)).toBe("Stone Edge Church in Macon · Service Times & Address");
  });

  it("prefers curated location over a district inferred from the street address", () => {
    const input = makeInput(
      { name: "Église Source de Siloé", slug: "not-overridden", location: "Gisors", country: "France" },
      { streetAddress: "17 Route De Delincourt, Zone Industrielle, 27140 Gisors, France" },
      { city: "Zone Industrielle" },
    );
    expect(buildChurchTitle(input)).toContain("in Gisors");
    expect(buildChurchTitle(input)).not.toContain("Zone Industrielle");
  });

  it("uses reviewed query variants for specific ranking church pages", () => {
    const input = makeInput({ slug: "every-nation-dalung-bali", name: "Every Nation Dalung, Bali" });
    expect(buildChurchTitle(input)).toBe("Every Nation Dalung, Bali · Church in Kabupaten Badung");
    expect(getChurchSearchAliases(input.church.slug)).toContain("Every Nation Dalung Kabupaten Badung");
  });

  it("keeps ICF Zurich focused on church visit intent", () => {
    const input = makeInput({
      slug: "icf-zurich",
      name: "ICF Zurich",
      location: "Dübendorf, Switzerland",
      spotifyPlaylistIds: ["pl1"],
    });

    expect(buildChurchTitle(input)).toBe(
      "ICF Church Zurich · Service Times, Address & Church Info",
    );
    expect(buildChurchDescription(input)).toContain("service times, address, visitor details");
    expect(getChurchSearchAliases(input.church.slug)).toContain("ICF Church Zürich");
  });
});

describe("buildChurchDescription", () => {
  it("opens with name in city, country", () => {
    const input = makeInput({ name: "Hillsong Church" }, null, null, "Hillsong Church");
    const desc = buildChurchDescription(input);
    expect(desc.startsWith("Hillsong Church in London, United Kingdom.")).toBe(true);
  });

  it("includes denomination and music differentiator (music tier prioritises moat)", () => {
    const input = makeInput(
      {
        name: "Hillsong Church",
        denomination: "Pentecostal",
        spotifyPlaylistIds: ["pl1"],
        notableArtists: ["Hillsong UNITED", "Brooke Ligertwood"],
      },
      {
        serviceTimes: [{ day: "Sunday", time: "10:00" }],
        languages: ["English", "Spanish"],
      } as Partial<ChurchEnrichment>,
      null,
      "Hillsong Church",
    );
    const desc = buildChurchDescription(input);
    expect(desc).toContain("Pentecostal church");
    expect(desc).toContain("Hillsong UNITED and Brooke Ligertwood");
    // Services and languages may or may not survive truncation depending on
    // upstream data length — the assertion is that the high-priority items
    // (identity, denomination, music moat) are always present.
  });

  it("includes service times and languages when description budget allows", () => {
    const input = makeInput(
      {
        name: "Hope Church",
        denomination: "Lutheran",
      },
      {
        serviceTimes: [{ day: "Sunday", time: "10:00" }],
        languages: ["English", "Swedish"],
      } as Partial<ChurchEnrichment>,
      null,
      "Hope Church",
    );
    const desc = buildChurchDescription(input);
    expect(desc).toContain("Services Sunday 10:00");
    expect(desc).toContain("English and Swedish");
    expect(desc).not.toContain("Church details");
  });

  it("includes the exact address before generic profile copy", () => {
    const input = makeInput(
      { name: "The Fountain Apostolic Church", location: "Ventura", country: "United States" },
      {
        streetAddress: "1000 N Ventura Ave, Ventura, CA 93001",
        serviceTimes: [{ day: "Sunday", time: "10AM" }],
      },
    );
    const desc = buildChurchDescription(input);
    expect(desc).toContain("Address: 1000 N Ventura Ave, Ventura, CA 93001.");
    expect(desc).toContain("Services Sunday 10AM.");
  });

  it("falls back to country alone when city missing", () => {
    const input = makeInput(
      { name: "Rural Church", location: undefined, country: "Norway" },
      null,
      null,
      "Rural Church",
    );
    const desc = buildChurchDescription(input);
    expect(desc.startsWith("Rural Church in Norway.")).toBe(true);
  });

  it("uses long description as filler when structured fields are sparse", () => {
    const longDesc = "A small but thriving congregation focused on worship and outreach in the local community.";
    const input = makeInput(
      { name: "Tiny Church", description: longDesc, denomination: undefined, location: undefined, country: undefined },
      null,
      null,
      "Tiny Church",
    );
    const desc = buildChurchDescription(input);
    expect(desc).toContain("Tiny Church.");
    expect(desc).toContain("thriving congregation");
  });

  it("never exceeds 158 characters", () => {
    const input = makeInput(
      {
        name: "Very Long Name Christian Worship Center Of The Holy Spirit Community",
        denomination: "Charismatic Pentecostal Evangelical",
        spotifyPlaylistIds: ["pl1"],
        notableArtists: ["Long Artist Name One", "Long Artist Name Two"],
      },
      {
        serviceTimes: [{ day: "Sunday", time: "10:00" }],
        languages: ["English", "Spanish", "Portuguese"],
      } as Partial<ChurchEnrichment>,
    );
    expect(buildChurchDescription(input).length).toBeLessThanOrEqual(158);
  });

  it("contains no em-dashes", () => {
    const input = makeInput({ name: "Hillsong Church", spotifyPlaylistIds: ["pl1"] });
    expect(buildChurchDescription(input)).not.toContain("—");
  });

  it("omits playlist sentence when no music data", () => {
    const input = makeInput({ name: "Hope Church", denomination: "Lutheran" });
    const desc = buildChurchDescription(input);
    expect(desc).not.toContain("playlist");
    expect(desc).not.toContain("Spotify");
  });

  it("omits service sentence when no service times", () => {
    const input = makeInput({ name: "Hope Church", denomination: "Lutheran" });
    expect(buildChurchDescription(input)).not.toContain("Services");
  });

  it("does not add first-visit details for thin profiles", () => {
    const input = makeInput(
      { name: "Small Church", denomination: undefined, description: "", location: undefined, country: "Greece" },
      null,
      null,
      "Small Church",
    );
    expect(buildChurchDescription(input)).not.toContain("Church details");
  });

  it("uses singular language phrasing for one language", () => {
    const input = makeInput({ name: "Test" }, { languages: ["swedish"] } as Partial<ChurchEnrichment>);
    expect(buildChurchDescription(input)).toContain("Worship in Swedish.");
  });

  it("dedupes city when already present in the display name", () => {
    const input = makeInput(
      { name: "Hope Church Copenhagen", country: "Denmark", location: "Copenhagen, Denmark" },
      null,
      null,
      "Hope Church Copenhagen",
    );
    const desc = buildChurchDescription(input);
    expect(desc).toContain("Hope Church Copenhagen, Denmark.");
    expect(desc).not.toContain("Copenhagen, Copenhagen");
    expect(desc).not.toContain("in Copenhagen");
  });

  it("dedupes country when already present in the display name", () => {
    const input = makeInput(
      { name: "Greece Worship Center", country: "Greece", location: undefined },
      null,
      null,
      "Greece Worship Center",
    );
    const desc = buildChurchDescription(input);
    expect(desc).toContain("Greece Worship Center.");
    expect(desc).not.toContain("in Greece");
  });
});

describe("facet metadata titles", () => {
  const metadataProps = (slug: string) => ({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({}),
  });

  it("uses the required city title format", async () => {
    const metadata = await generateCityMetadata(metadataProps("london"));
    expect(metadata.title).toBe("Churches in London: Service Times & Locations");
  });

  it("keeps flagged city titles within the search-result limit", () => {
    for (const city of ["Amsterdam", "Copenhagen", "Gold Coast"]) {
      expect(`${buildCityTitle(city)} | GospelChannel`.length).toBeLessThanOrEqual(70);
    }
  });

  it("links the Zurich city hub to its English-speaking guide", () => {
    expect(getCityGuideLinks("zurich")).toEqual([
      {
        href: "/church/english-speaking-churches-in-zurich",
        label: "English-speaking churches in Zurich",
      },
    ]);
    expect(getCityGuideLinks("london")).toEqual([]);
  });

  it("uses the required country title format", async () => {
    const metadata = await generateCountryMetadata(metadataProps("united-kingdom"));
    expect(metadata.title).toBe("United Kingdom Churches: Cities, Worship Styles & Service Times");
  });

  it("uses the required denomination title format", async () => {
    const metadata = await generateDenominationMetadata(metadataProps("pentecostal"));
    expect(metadata.title).toBe("Pentecostal Churches: Worship, Service Times & Locations");
  });

  it("uses the required worship-style title format", async () => {
    const metadata = await generateStyleMetadata(metadataProps("contemporary-worship"));
    expect(metadata.title).toBe("Contemporary Worship Churches: Music, Service Times & Locations");
  });
});
