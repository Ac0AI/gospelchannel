import { describe, expect, it } from "vitest";
import { computeCitySlug } from "../facet-scoring";
import { computeDataRichnessScore } from "../enrichment-richness";
import { slugify } from "../slugify";
import { extractCity } from "../church-directory";

describe("computeCitySlug", () => {
  it("null/undefined/empty → null (column stays NULL, city facet skips it)", () => {
    expect(computeCitySlug(null)).toBeNull();
    expect(computeCitySlug(undefined)).toBeNull();
    expect(computeCitySlug("")).toBeNull();
    expect(computeCitySlug("   ")).toBeNull();
  });

  it("takes the part before the first comma (extractCity), then slugifies", () => {
    expect(computeCitySlug("Stockholm, Sweden")).toBe("stockholm");
  });

  it("city longer than 60 chars → null (extractCity guard)", () => {
    expect(computeCitySlug(`${"x".repeat(61)}, Country`)).toBeNull();
  });

  // Zero-drift contract: computeCitySlug MUST equal slugify(extractCity(...)),
  // the exact expression the old in-memory citySlug predicate used. This is
  // what guarantees the materialized column matches old facet behavior — NOT
  // any transliteration assumption. (This project's slugify does NOT strip
  // diacritics: "São Paulo" → "s-o-paulo", a separate slug from "Sao Paulo".
  // That was already true in the old code; computeCitySlug preserves it.)
  it("equals slugify(extractCity(location)) for every shape", () => {
    for (const loc of [
      "Stockholm, Sweden",
      "São Paulo, Brazil",
      "Göteborg, Sweden",
      "New York City, USA",
      "Den Haag",
    ]) {
      const city = extractCity(loc);
      expect(computeCitySlug(loc)).toBe(city ? slugify(city) : null);
    }
  });
});

describe("computeDataRichnessScore", () => {
  it("zero signals → 0", () => {
    expect(
      computeDataRichnessScore({ summaryLength: 10, hasServiceTimes: false, hasStreetAddress: false, hasSocial: false }),
    ).toBe(0);
  });

  it("summary >= 80 chars → +40, < 80 → 0", () => {
    expect(computeDataRichnessScore({ summaryLength: 80, hasServiceTimes: false, hasStreetAddress: false, hasSocial: false })).toBe(40);
    expect(computeDataRichnessScore({ summaryLength: 79, hasServiceTimes: false, hasStreetAddress: false, hasSocial: false })).toBe(0);
  });

  it("each signal adds its weight, sum is additive (max 100)", () => {
    expect(
      computeDataRichnessScore({ summaryLength: 200, hasServiceTimes: true, hasStreetAddress: true, hasSocial: true }),
    ).toBe(100);
    expect(
      computeDataRichnessScore({ summaryLength: 0, hasServiceTimes: true, hasStreetAddress: false, hasSocial: true }),
    ).toBe(40);
  });
});
