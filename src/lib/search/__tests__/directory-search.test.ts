import { describe, expect, it } from "vitest";
import { filterChurchDirectory, type ChurchDirectoryEntry } from "@/lib/church-directory";
import { describeSearch, relaxedSearches } from "../interpret-search";

function church(overrides: Partial<ChurchDirectoryEntry>): ChurchDirectoryEntry {
  return { slug: overrides.name?.toLowerCase().replace(/\W+/g, "-") ?? "c", name: "Church", ...overrides } as ChurchDirectoryEntry;
}

const CHURCHES = [
  church({ name: "Filadelfiakyrkan Stockholm", location: "Stockholm", country: "Sweden", denomination: "Pentecostal" }),
  church({ name: "Hillsong Sweden", location: "Stockholm", country: "Sweden", denomination: "Charismatic", musicStyle: ["contemporary worship"] }),
  church({ name: "Söderkyrkan", location: "Stockholm", country: "Sweden", denomination: "Lutheran" }),
  church({ name: "Vineyard Göteborg", location: "Göteborg", country: "Sweden", denomination: "Vineyard" }),
];

describe("directory search filters", () => {
  it("a family keeps Pentecostal and Charismatic churches in the city, not Lutheran ones", () => {
    const found = filterChurchDirectory(CHURCHES, { citySlug: "stockholm", familySlug: "charismatic" });
    expect(found.map((c) => c.name)).toEqual(["Filadelfiakyrkan Stockholm", "Hillsong Sweden"]);
  });

  it("name terms match every word anywhere, with or without Swedish letters", () => {
    expect(filterChurchDirectory(CHURCHES, { terms: ["hillsong"] }).map((c) => c.name)).toEqual(["Hillsong Sweden"]);
    expect(filterChurchDirectory(CHURCHES, { terms: ["soderkyrkan"] }).map((c) => c.name)).toEqual(["Söderkyrkan"]);
    expect(filterChurchDirectory(CHURCHES, { terms: ["vineyard", "goteborg"] }).map((c) => c.name)).toEqual(["Vineyard Göteborg"]);
  });
});

describe("describeSearch", () => {
  it("writes a readable summary of the interpretation", () => {
    expect(describeSearch({ familySlug: "charismatic", cityLabel: "Stockholm" })).toBe("Charismatic churches in Stockholm");
    expect(describeSearch({ language: "English", denominationSlug: "baptist", cityLabel: "London", hasKids: true })).toBe(
      "English-speaking Baptist churches in London with a kids ministry",
    );
    expect(describeSearch({ terms: ["hillsong"], cityLabel: "Stockholm" })).toBe('"hillsong" churches in Stockholm');
  });
});

describe("relaxedSearches", () => {
  it("drops the softest conditions first and keeps the place", () => {
    const steps = relaxedSearches({ citySlug: "lund", familySlug: "charismatic", language: "English", hasKids: true });
    expect(steps).toEqual([
      { citySlug: "lund", familySlug: "charismatic", language: "English" },
      { citySlug: "lund", familySlug: "charismatic" },
      { citySlug: "lund" },
    ]);
  });

  it("never drops name words, and keeps what the visitor chose in the URL", () => {
    expect(relaxedSearches({ citySlug: "lund", terms: ["hillsong"] })).toEqual([]);
    expect(relaxedSearches({ citySlug: "lund", language: "English", hasKids: true }, new Set(["language"]))).toEqual([
      { citySlug: "lund", language: "English" },
    ]);
  });

  it("does not widen to every church in the directory", () => {
    expect(relaxedSearches({ familySlug: "charismatic", language: "English" })).toEqual([]);
  });
});
