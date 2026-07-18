import { describe, expect, it } from "vitest";
import {
  buildDiscoveryChurchProofs,
  formatDiscoveryLanguage,
  formatDiscoveryStyles,
  type DiscoveryChurch,
} from "@/lib/discovery-churches";

function makeChurch(overrides: Partial<DiscoveryChurch> = {}): DiscoveryChurch {
  return {
    name: "Example Church",
    slug: "example-church",
    location: "London",
    country: "United Kingdom",
    website: "https://example.church",
    denomination: "Pentecostal",
    musicStyle: ["charismatic worship", "gospel"],
    language: "en",
    headerImage: null,
    logo: null,
    serviceTimeLabel: "Sunday 10:30",
    playlistCount: 2,
    videoCount: 4,
    directoryScore: 120,
    ...overrides,
  };
}

describe("discovery churches", () => {
  it("formats language and worship styles for discovery tables", () => {
    expect(formatDiscoveryLanguage("en")).toBe("English");
    expect(formatDiscoveryLanguage("swedish")).toBe("Swedish");
    expect(formatDiscoveryStyles(["charismatic worship", "gospel"])).toBe("Charismatic worship, Gospel");
  });

  it("builds compact proof lines from real profile signals", () => {
    expect(buildDiscoveryChurchProofs(makeChurch())).toEqual([
      "Meets Sunday 10:30",
      "2 worship playlists",
      "4 worship videos",
      "Known for Charismatic worship, Gospel",
    ]);
  });

  it("falls back to durable profile signals when music evidence is missing", () => {
    expect(
      buildDiscoveryChurchProofs(
        makeChurch({
          serviceTimeLabel: null,
          playlistCount: 0,
          videoCount: 0,
          musicStyle: null,
        }),
      ),
    ).toEqual(["Services in English", "Official website available", "In London, United Kingdom"]);
  });
});
