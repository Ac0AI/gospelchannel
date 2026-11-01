import { describe, expect, it } from "vitest";
import { isConversationalQuery, wantsNearbyChurches } from "../intent";

describe("isConversationalQuery", () => {
  // Every one of these was typed into the search box between 2026-08 and 2026-10.
  it.each([
    "toronto",
    "Marseille france",
    "Simi valley, ca",
    "37918",
    "Kings church Frodsham",
    "salem chapel",
    "penang malaysia",
    "Christian Liquid Church USA",
    "tempe first united methodist",
    "southwest park baptist church",
    "Mission Timothée Alsace",
    "Reformed",
    "",
  ])("keeps the lookup %j in the directory search", (query) => {
    expect(isConversationalQuery(query)).toBe(false);
  });

  it.each([
    "English church in Madrid with kids ministry",
    "Which churches in Malaga have English services?",
    "contemporary worship near me",
    "church for students in Berlin",
    "What happens on a first visit?",
    "I'm moving to Austin and want a charismatic church",
    "vilka kyrkor i Stockholm har engelsk gudstjänst",
    "Assemblies of God church in Pharr Texas",
  ])("sends the question %j to the chat", (query) => {
    expect(isConversationalQuery(query)).toBe(true);
  });
});

describe("wantsNearbyChurches", () => {
  it("detects a near-me request", () => {
    expect(wantsNearbyChurches("contemporary church near me")).toBe(true);
    expect(wantsNearbyChurches("churches nearby with kids")).toBe(true);
    expect(wantsNearbyChurches("English church in Madrid")).toBe(false);
  });
});
