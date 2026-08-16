import { describe, expect, it } from "vitest";
import { getDecisionSearchSuggestions, getLocalSearchSuggestionsFromChurches } from "@/lib/search-suggestions";
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

  it("routes answer-first church choice searches to guides and proof routes", () => {
    expect(getDecisionSearchSuggestions("what should i wear")[0]).toMatchObject({
      type: "guide",
      href: "/guides/first-visit-guide",
    });
    expect(getDecisionSearchSuggestions("what happens at church service")[0]).toMatchObject({
      type: "guide",
      href: "/guides/first-visit-guide",
    });
    expect(getDecisionSearchSuggestions("how long is church service")[0]).toMatchObject({
      type: "guide",
      href: "/guides/first-visit-guide",
    });
    expect(getDecisionSearchSuggestions("church fit")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-fit-quiz",
    });
    expect(getDecisionSearchSuggestions("worship style")[0]).toMatchObject({
      type: "guide",
      href: "/guides/worship-style-match",
    });
    expect(getDecisionSearchSuggestions("best church for me")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("best church near me")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("what church should i visit first")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("traditional vs contemporary worship")[0]).toMatchObject({
      type: "compare",
      href: "/compare/traditional-vs-contemporary-worship",
    });
    expect(getDecisionSearchSuggestions("should i choose traditional or contemporary worship")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("baptist vs pentecostal")[0]).toMatchObject({
      type: "compare",
      href: "/compare/baptist-vs-pentecostal",
    });
    expect(getDecisionSearchSuggestions("should i choose baptist or pentecostal")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("liturgical vs free worship")[0]).toMatchObject({
      type: "compare",
      href: "/compare/liturgical-vs-free-worship",
    });
    expect(getDecisionSearchSuggestions("should i choose liturgical or free worship")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("big church vs small church")[0]).toMatchObject({
      type: "compare",
      href: "/compare/big-church-vs-small-church",
    });
    expect(getDecisionSearchSuggestions("service times")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/churches-with-service-times",
    });
    expect(getDecisionSearchSuggestions("church near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/city",
    });
    expect(getDecisionSearchSuggestions("churches in my city")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/city",
    });
    expect(getDecisionSearchSuggestions("church near me sunday")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/churches-with-service-times",
    });
    expect(getDecisionSearchSuggestions("church with kids ministry near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/family-friendly-churches",
    });
    expect(getDecisionSearchSuggestions("english speaking church near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/english-speaking-churches",
    });
    expect(getDecisionSearchSuggestions("english speaking churches in zurich")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/english-speaking-churches-in-zurich",
    });
    expect(getDecisionSearchSuggestions("charismatic churches in london")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/charismatic-churches-in-london",
    });
  });

  it("describes search destinations in visitor language", () => {
    expect(getDecisionSearchSuggestions("service times")[0]).toMatchObject({
      href: "/church/churches-with-service-times",
      subtitle: "Find churches with published service times.",
    });
    expect(getDecisionSearchSuggestions("english speaking church near me")).toContainEqual(expect.objectContaining({
      href: "/church/english-speaking-churches",
      subtitle: "Explore English-speaking churches.",
    }));
  });

  it("matches natural decision queries even when words are reordered or shortened", () => {
    expect(getDecisionSearchSuggestions("wear church")[0]).toMatchObject({
      href: "/guides/first-visit-guide",
    });
    expect(getDecisionSearchSuggestions("baptist pentecostal")[0]).toMatchObject({
      href: "/compare/baptist-vs-pentecostal",
    });
    expect(getDecisionSearchSuggestions("traditional contemporary church")[0]).toMatchObject({
      href: "/compare/traditional-vs-contemporary-worship",
    });
    expect(getDecisionSearchSuggestions("liturgical free worship")[0]).toMatchObject({
      href: "/compare/liturgical-vs-free-worship",
    });
    expect(getDecisionSearchSuggestions("church size guide")[0]).toMatchObject({
      href: "/compare/big-church-vs-small-church",
    });
    expect(getDecisionSearchSuggestions("check before joining church")[0]).toMatchObject({
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("which campus of a church network should i visit")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("which worship style fits me")[0]).toMatchObject({
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("can i listen to a church before visiting")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("where can i find charismatic pentecostal gospel churches in london")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("how do i find churches known for worship")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("how do expats find an english speaking church abroad")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("how do students find a church near campus")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("how do young adults find a contemporary worship church")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("how do families choose a family friendly church")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("how do i find a low pressure church after church hurt")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("where can i pray or see community prayer signals before choosing a church")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("pray before choosing a church")[0]).toMatchObject({
      type: "guide",
      href: "/guides/church-choice-answers",
    });
    expect(getDecisionSearchSuggestions("how to pray")[0]).toMatchObject({
      type: "guide",
      href: "/guides/prayer-guide",
    });
    expect(getDecisionSearchSuggestions("prayer wall")[0]).toMatchObject({
      type: "guide",
      href: "/prayerwall",
    });
    expect(getDecisionSearchSuggestions("worship playlist")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/churches-with-worship-music",
    });
    expect(getDecisionSearchSuggestions("worship music")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/churches-with-worship-music",
    });
    expect(getDecisionSearchSuggestions("churches with music")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/churches-with-worship-music",
    });
    expect(getDecisionSearchSuggestions("gospel church near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/style/gospel",
    });
    expect(getDecisionSearchSuggestions("contemporary worship church near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/style/contemporary-worship",
    });
    expect(getDecisionSearchSuggestions("charismatic church near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/style/charismatic",
    });
    expect(getDecisionSearchSuggestions("latin worship church near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/style/latin",
    });
    expect(getDecisionSearchSuggestions("african worship church near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/style/african",
    });
    expect(getDecisionSearchSuggestions("acoustic worship church near me")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/style/acoustic",
    });
    expect(getDecisionSearchSuggestions("best worship churches")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/best-worship-churches",
    });
    expect(getDecisionSearchSuggestions("top worship churches")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/best-worship-churches",
    });
    expect(getDecisionSearchSuggestions("churches with youth ministry")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/family-friendly-churches",
    });
    expect(getDecisionSearchSuggestions("churches with english services")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/english-speaking-churches",
    });
    expect(getDecisionSearchSuggestions("church networks")[0]).toMatchObject({
      type: "proof_route",
      href: "/network",
    });
    expect(getDecisionSearchSuggestions("multi campus churches")[0]).toMatchObject({
      type: "proof_route",
      href: "/network",
    });
    expect(getDecisionSearchSuggestions("gospel churches in london")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/charismatic-churches-in-london",
    });
    expect(getDecisionSearchSuggestions("pentecostal churches in london")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/charismatic-churches-in-london",
    });
    expect(getDecisionSearchSuggestions("spirit filled church london")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/charismatic-churches-in-london",
    });
    expect(getDecisionSearchSuggestions("english speaking charismatic church london")[0]).toMatchObject({
      type: "proof_route",
      href: "/church/charismatic-churches-in-london",
    });
  });

  it("routes audience-intent searches to the matching for pages", () => {
    expect(getDecisionSearchSuggestions("english speaking church abroad")[0]).toMatchObject({
      type: "guide",
      href: "/for/expats",
    });
    expect(getDecisionSearchSuggestions("church near campus")[0]).toMatchObject({
      type: "guide",
      href: "/for/students",
    });
    expect(getDecisionSearchSuggestions("young adult church")[0]).toMatchObject({
      type: "guide",
      href: "/for/young-adults",
    });
    expect(getDecisionSearchSuggestions("family friendly church")[0]).toMatchObject({
      type: "guide",
      href: "/for/families",
    });
    expect(getDecisionSearchSuggestions("family friendly church near me")[0]).toMatchObject({
      type: "guide",
      href: "/for/families",
    });
    expect(getDecisionSearchSuggestions("church for new believers")[0]).toMatchObject({
      type: "guide",
      href: "/for/new-believers",
    });
    expect(getDecisionSearchSuggestions("church after deconstruction")[0]).toMatchObject({
      type: "guide",
      href: "/for/deconstructing",
    });
  });

  it("limits decision suggestions so church profile matches still have room", () => {
    const results = getDecisionSearchSuggestions("church", 3);

    expect(results).toHaveLength(3);
    expect(results.map((item) => item.href)).toContain("/guides/church-fit-quiz");
  });
});
