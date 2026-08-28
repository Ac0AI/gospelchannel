import { describe, expect, it } from "vitest";
import { buildChurchProfileSource } from "@/lib/church-profile-source";

describe("buildChurchProfileSource", () => {
  it("separates church verification from directory research", () => {
    expect(buildChurchProfileSource({
      isClaimed: false,
      sourceKind: "discovered",
      verifiedAt: "2026-08-21T10:00:00.000Z",
      lastResearched: "2026-08-12T10:00:00.000Z",
      hasOfficialWebsite: true,
    })).toEqual({
      status: "Independent church guide profile",
      source: "Official church website and public sources",
      freshnessLabel: "Details checked",
      freshnessValue: "Aug 21, 2026",
      freshnessDate: "2026-08-21T10:00:00.000Z",
    });
  });

  it("only calls a profile church-verified when the claim is active", () => {
    const result = buildChurchProfileSource({
      isClaimed: true,
      sourceKind: "claimed",
      lastResearched: "2026-07-04",
      hasOfficialWebsite: false,
    });

    expect(result.status).toBe("Verified by church leaders");
    expect(result.source).toBe("Church-submitted details");
    expect(result.freshnessLabel).toBe("Last researched");
  });

  it("does not invent a freshness date", () => {
    const result = buildChurchProfileSource({
      isClaimed: false,
      sourceKind: "suggested",
      verifiedAt: "not-a-date",
      hasOfficialWebsite: false,
    });

    expect(result.freshnessLabel).toBe("Freshness");
    expect(result.freshnessValue).toBe("No review date recorded");
    expect(result.freshnessDate).toBeUndefined();
  });
});
