import { describe, expect, it } from "vitest";
import { getLocalSearchSuggestionsFromChurches } from "@/lib/search-suggestions";
import type { ChurchConfig } from "@/types/gospel";

function church(input: Partial<ChurchConfig> & Pick<ChurchConfig, "slug" | "name">): ChurchConfig {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description ?? "",
    spotifyPlaylistIds: input.spotifyPlaylistIds ?? [],
    additionalPlaylists: input.additionalPlaylists ?? [],
    logo: input.logo ?? "",
    website: input.website ?? "",
    spotifyUrl: input.spotifyUrl ?? "",
    country: input.country ?? "",
    denomination: input.denomination,
    location: input.location,
    aliases: input.aliases,
    headerImage: input.headerImage,
    verifiedAt: input.verifiedAt,
  };
}

describe("search suggestions", () => {
  const churches = [
    church({
      slug: "hope-london",
      name: "Hope Church London",
      country: "United Kingdom",
      location: "London, United Kingdom",
      aliases: ["Hope City"],
      spotifyPlaylistIds: ["one"],
    }),
    church({
      slug: "malaga-fellowship",
      name: "International Fellowship",
      country: "Spain",
      location: "Malaga, Spain",
      denomination: "Pentecostal",
      spotifyPlaylistIds: ["one", "two"],
      verifiedAt: "2026-01-01",
    }),
  ];

  it("requires at least two characters", () => {
    expect(getLocalSearchSuggestionsFromChurches(churches, "h")).toEqual([]);
  });

  it("matches church names, aliases, cities, and countries by prefix", () => {
    expect(getLocalSearchSuggestionsFromChurches(churches, "hope").map((item) => item.slug)).toEqual(["hope-london"]);
    expect(getLocalSearchSuggestionsFromChurches(churches, "lond").map((item) => item.slug)).toEqual(["hope-london"]);
    expect(getLocalSearchSuggestionsFromChurches(churches, "spai").map((item) => item.slug)).toEqual(["malaga-fellowship"]);
    expect(getLocalSearchSuggestionsFromChurches(churches, "hope city").map((item) => item.slug)).toEqual(["hope-london"]);
  });

  it("dedupes multiple matching keys for the same church", () => {
    const results = getLocalSearchSuggestionsFromChurches([
      church({
        slug: "stockholm-church",
        name: "Stockholm Church",
        country: "Sweden",
        location: "Stockholm, Sweden",
        aliases: ["Stockholm Church"],
      }),
    ], "stock");

    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("stockholm-church");
  });
});
