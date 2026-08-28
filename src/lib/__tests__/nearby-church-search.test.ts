import { describe, expect, it } from "vitest";
import {
  formatNearbyServiceTime,
  getSafeExternalUrl,
  parseNearbyChurchSearchInput,
  roundNearbyCoordinate,
} from "@/lib/nearby-church-search";

describe("nearby church search", () => {
  it("rounds location before a search leaves the browser", () => {
    expect(roundNearbyCoordinate(40.712776)).toBe(40.71);
    expect(roundNearbyCoordinate(-74.005974)).toBe(-74.01);
  });

  it("validates coordinates, bounds the search, and normalizes filters", () => {
    expect(parseNearbyChurchSearchInput({ latitude: 91, longitude: 0 })).toMatchObject({ ok: false });

    const result = parseNearbyChurchSearchInput({
      latitude: 30.267153,
      longitude: -97.743057,
      radiusKm: 500,
      limit: 100,
      worshipStyle: "  Contemporary   Worship  ",
      denomination: "Baptist",
      language: "English",
      hasServiceTimes: true,
      kids: true,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        latitude: 30.27,
        longitude: -97.74,
        radiusKm: 100,
        limit: 20,
        worshipStyle: "Contemporary Worship",
        denomination: "Baptist",
        language: "English",
        hasServiceTimes: true,
        kids: true,
      },
    });
  });

  it("prefers a labeled Sunday gathering and ignores malformed times", () => {
    expect(formatNearbyServiceTime([
      { day: "Wednesday", time: "19:00", label: "Prayer" },
      { day: "Sunday", time: "11:00", label: "Main worship service" },
      { day: "Sunday", time: "soon" },
    ])).toBe("Sunday 11:00");
    expect(formatNearbyServiceTime({ day: "Sunday", time: "10:00" })).toBeNull();
  });

  it("only renders safe official website protocols", () => {
    expect(getSafeExternalUrl("https://example.church/visit")).toBe("https://example.church/visit");
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeExternalUrl("not a url")).toBeNull();
  });
});
