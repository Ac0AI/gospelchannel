import { describe, expect, it } from "vitest";
import { parseOfficialChurchReview } from "@/lib/official-church-review";
import { buildChurchProfileSource } from "@/lib/church-profile-source";

const facts = {
  services: { value: "Sunday 10:00 AM", sourceUrl: "https://example.org/visit" },
  address: { value: "100 Church Street", sourceUrl: "https://example.org/visit" },
};

describe("official church reviews", () => {
  it("leaves unsupported needs unknown and preserves an independent profile status", () => {
    const review = parseOfficialChurchReview({ official_review: { checkedAt: "2026-09-05", facts } });
    expect(review?.facts.children).toBeUndefined();
    expect(review?.facts.accessibility).toBeUndefined();
    expect(buildChurchProfileSource({
      isClaimed: false, sourceKind: "discovered", lastResearched: review?.checkedAt, hasOfficialWebsite: true,
    }).status).toBe("Independent church guide profile");
  });

  it.each([undefined, [], { psalmlog: {} }, { official_review: { checkedAt: "2026-02-30", facts } }])(
    "does not manufacture a review from missing, legacy or invalid data", (sources) => {
      expect(parseOfficialChurchReview(sources)).toBeUndefined();
    },
  );

  it("excludes unsafe source links while retaining valid facts", () => {
    const review = parseOfficialChurchReview({ official_review: { checkedAt: "2026-09-05", facts: {
      ...facts,
      children: { value: "Nursery", sourceUrl: "javascript:alert(1)" },
      accessibility: { value: "Ramp", sourceUrl: "https://secret@example.org" },
    } } });
    expect(review?.facts).toEqual(facts);
  });

  it("requires sources for both the visit address and the service schedule", () => {
    expect(parseOfficialChurchReview({ official_review: { checkedAt: "2026-09-05", facts: {
      services: facts.services,
    } } })).toBeUndefined();
  });
});
