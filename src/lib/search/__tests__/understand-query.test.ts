import { describe, expect, it } from "vitest";
import { hasConcepts, understandQuery } from "../understand-query";
import { resolvePlace, type PlaceCandidate, type PlaceLookup } from "../resolve-place";
import { matchesFamily } from "../church-families";

const CITIES: PlaceCandidate[] = [
  { citySlug: "stockholm", label: "Stockholm", country: "Sweden", churchCount: 120 },
  { citySlug: "g-teborg", label: "Göteborg", country: "Sweden", churchCount: 60 },
  { citySlug: "malm", label: "Malmö", country: "Sweden", churchCount: 40 },
  { citySlug: "london", label: "London", country: "United Kingdom", churchCount: 900 },
  { citySlug: "new-york", label: "New York", country: "United States", churchCount: 700 },
  { citySlug: "madrid", label: "Madrid", country: "Spain", churchCount: 80 },
  { citySlug: "grace", label: "Grace", country: "United States", churchCount: 1 },
  { citySlug: "k-benhavn", label: "København", country: "Denmark", churchCount: 30 },
  { citySlug: "gothenburg", label: "Gothenburg", country: "Sweden", churchCount: 5 },
];

const lookup: PlaceLookup = {
  async citiesByInitial(initial) {
    return CITIES.filter((city) => city.citySlug.startsWith(initial) || city.label.toLowerCase().normalize("NFKD").startsWith(initial));
  },
  async countries() {
    return [
      { country: "Sweden", churchCount: 400 },
      { country: "United Kingdom", churchCount: 2000 },
      { country: "Spain", churchCount: 300 },
    ];
  },
};

async function interpret(query: string) {
  const understood = understandQuery(query);
  const place = await resolvePlace(understood.rest, understood.placeHint, lookup, { hasConcepts: hasConcepts(understood) });
  return { understood, place };
}

describe("understandQuery", () => {
  it("reads the Swedish example: charismatic evangelical churches in Stockholm, misspelled", async () => {
    const { understood, place } = await interpret("karismatiska evangelikala kyrkor i stokholm");
    expect(understood.familySlug).toBe("charismatic");
    expect(place.city?.citySlug).toBe("stockholm");
    expect(place.corrections).toEqual([{ from: "stokholm", to: "Stockholm" }]);
    expect(place.nameTerms).toEqual([]);
  });

  it("reads English with a typo in the church type", async () => {
    const { understood, place } = await interpret("charismtic churches in london");
    expect(understood.familySlug).toBe("charismatic");
    expect(place.city?.citySlug).toBe("london");
  });

  it("a named denomination beats a family", () => {
    const understood = understandQuery("evangelical baptist church");
    expect(understood.denominationSlug).toBe("baptist");
    expect(understood.familySlug).toBeUndefined();
  });

  it("understands compounds and inflections: pingstkyrkor, baptistkyrkan", () => {
    expect(understandQuery("pingstkyrkor göteborg").denominationSlug).toBe("pentecostal");
    expect(understandQuery("baptistkyrkan").denominationSlug).toBe("baptist");
    expect(understandQuery("frikyrkor i malmö").familySlug).toBe("evangelical");
  });

  it("finds language, kids and style", () => {
    const understood = understandQuery("englishspeaking church with kids ministry in madrid");
    expect(understood.language).toBe("English");
    expect(understood.hasKids).toBe(true);
    expect(understood.placeHint).toBe("madrid");
    expect(understandQuery("gospel church").styleSlug).toBe("gospel");
    expect(understandQuery("engelskspråkig kyrka").language).toBe("English");
  });

  it("leaves plain names alone", () => {
    const understood = understandQuery("Kings church Frodsham");
    expect(hasConcepts(understood)).toBe(false);
    expect(understood.rest).toEqual(["kings", "frodsham"]);
  });
});

describe("displayCity", () => {
  it("drops trailing punctuation and the region part", async () => {
    const { displayCity } = await import("../resolve-place");
    expect(displayCity("London.")).toBe("London");
    expect(displayCity("Stockholm, Sweden")).toBe("Stockholm");
  });
});

describe("resolvePlace", () => {
  it("handles Swedish letters, English names and typos for cities", async () => {
    expect((await interpret("pingst göteborg")).place.city?.citySlug).toBe("g-teborg");
    expect((await interpret("pingst goteborg")).place.city?.citySlug).toBe("g-teborg");
    expect((await interpret("pentecostal gothenburg")).place.city?.citySlug).toBe("g-teborg");
    expect((await interpret("baptist gotebrog")).place.city?.citySlug).toBe("g-teborg");
    expect((await interpret("kyrka i köpenhamn")).place.city?.citySlug).toBe("k-benhavn");
  });

  it("covers a city stored under two names (Gothenburg and Göteborg)", async () => {
    for (const query of ["pentecostal gothenburg", "pingst göteborg"]) {
      const { place } = await interpret(query);
      expect(place.citySlugs?.sort()).toEqual(["g-teborg", "gothenburg"]);
    }
  });

  it("matches multi-word cities and countries", async () => {
    expect((await interpret("baptist church new york")).place.city?.citySlug).toBe("new-york");
    expect((await interpret("karismatiska kyrkor i sverige")).place.country).toBe("Sweden");
  });

  it("keeps the church name when a place follows it", async () => {
    const { place } = await interpret("hillsong stockolm");
    expect(place.city?.citySlug).toBe("stockholm");
    expect(place.nameTerms).toEqual(["hillsong"]);
  });

  it("does not turn a name word into a similarly spelled small town", async () => {
    const { place } = await interpret("grace church london");
    expect(place.city?.citySlug).toBe("london");
    expect(place.nameTerms).toEqual(["grace"]);
  });
});

describe("matchesFamily", () => {
  it("counts Pentecostal and Vineyard churches as charismatic, not Lutheran ones", () => {
    expect(matchesFamily({ denomination: "Pentecostal" }, "charismatic")).toBe(true);
    expect(matchesFamily({ denomination: "Vineyard" }, "charismatic")).toBe(true);
    expect(matchesFamily({ denomination: "Non-denominational", musicStyle: ["charismatic worship"] }, "charismatic")).toBe(true);
    expect(matchesFamily({ denomination: "Lutheran", musicStyle: ["traditional"] }, "charismatic")).toBe(false);
    expect(matchesFamily({ denomination: "Baptist" }, "evangelical")).toBe(true);
    expect(matchesFamily({ denomination: "Catholic" }, "evangelical")).toBe(false);
  });

  it("keeps Armenian, Orthodox and New Apostolic churches out even when filed as Apostolic", () => {
    expect(matchesFamily({ name: "Christ Apostolic Church", denomination: "Apostolic" }, "charismatic")).toBe(true);
    expect(matchesFamily({ name: "Holy Cross Armenian Church", denomination: "Apostolic" }, "charismatic")).toBe(false);
    expect(matchesFamily({ name: "Holy Cross Church of Armenia", denomination: "Armenian Apostolic" }, "charismatic")).toBe(false);
    expect(matchesFamily({ name: "Neuapostolische Kirche", denomination: "New Apostolic" }, "charismatic")).toBe(false);
    expect(matchesFamily({ name: "Holy Cross Armenian Church", denomination: "Apostolic" }, "evangelical")).toBe(false);
    expect(matchesFamily({ name: "Armenian Evangelical Church", denomination: "Evangelical" }, "evangelical")).toBe(true);
  });
});
