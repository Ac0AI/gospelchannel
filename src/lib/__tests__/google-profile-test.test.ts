import { describe, expect, it } from "vitest";
import cohort from "@/data/google-profile-test-2026-10-17.json";
import { isGoogleHoldoutProfile, slugHash } from "@/lib/google-profile-test";

describe("Google profile test", () => {
  it("hashes with 32-bit FNV-1a so a profile never switches group", () => {
    // Published FNV-1a 32-bit test vectors.
    expect(slugHash("")).toBe(0x811c9dc5);
    expect(slugHash("a")).toBe(0xe40c292c);
    expect(slugHash("foobar")).toBe(0xbf9cf968);
  });

  it("always keeps profiles with music for Google", () => {
    const slugs = Array.from({ length: 200 }, (_, i) => `test-church-${i}`);
    expect(slugs.filter((slug) => isGoogleHoldoutProfile(slug, true))).toEqual([]);
  });

  it("always keeps profiles that had Google impressions before the start", () => {
    for (const slug of cohort.keepByImpressions.slice(0, 200)) {
      expect(isGoogleHoldoutProfile(slug, false)).toBe(false);
    }
  });

  it("holds out roughly half of the remaining profiles", () => {
    const slugs = Array.from({ length: 4000 }, (_, i) => `test-church-${i}`);
    const share = slugs.filter((slug) => isGoogleHoldoutProfile(slug, false)).length / slugs.length;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });
});
