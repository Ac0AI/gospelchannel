import { describe, expect, it } from "vitest";
import { getCompareGuideBySlug, getCompareGuideContent } from "@/lib/tooling";
import { getWorshipByDenominationReport } from "@/lib/worship-by-denomination-report";

const SLUG = "baptist-vs-pentecostal";

describe("baptist-vs-pentecostal compare guide", () => {
  const content = getCompareGuideContent(SLUG);
  const report = getWorshipByDenominationReport();
  const baptist = report.families.find((family) => family.family === "Baptist");
  const pentecostal = report.families.find((family) => family.family === "Pentecostal");

  it("points its worship data at families that exist in the study snapshot", () => {
    expect(content?.worshipData?.familyA).toBe("Baptist");
    expect(content?.worshipData?.familyB).toBe("Pentecostal");
    expect(baptist).toBeDefined();
    expect(pentecostal).toBeDefined();
  });

  it("quotes playlist numbers that match the study snapshot", () => {
    const worshipAnswer = content?.faq.find((faq) => faq.question.startsWith("What's the difference"))?.answer ?? "";
    expect(worshipAnswer).toContain(`${baptist?.megachurchAnthemPct}% of Baptist churches`);
    expect(worshipAnswer).toContain(`${pentecostal?.megachurchAnthemPct}% of Pentecostal churches`);
    expect(worshipAnswer).toContain(`${baptist?.modernHymnPct}% of Baptist churches also sing modern hymns`);
    expect(worshipAnswer).toContain(`against ${pentecostal?.modernHymnPct}% of Pentecostal churches`);
    expect(content?.seoDescription).toContain(
      `${(baptist?.churches ?? 0) + (pentecostal?.churches ?? 0)} churches`,
    );
  });

  it("keeps search-result copy inside its length limits", () => {
    expect(`${content?.seoTitle} | GospelChannel`.length).toBeLessThanOrEqual(60);
    expect(content?.seoDescription?.length ?? 0).toBeGreaterThanOrEqual(150);
    expect(content?.seoDescription?.length ?? 0).toBeLessThanOrEqual(160);
  });

  it("never uses an em dash in visible copy", () => {
    const copy = JSON.stringify(content) + JSON.stringify(getCompareGuideBySlug(SLUG));
    expect(copy).not.toContain("—");
  });

  it("answers the questions searchers ask about the two traditions", () => {
    const questions = content?.faq.map((faq) => faq.question) ?? [];
    expect(questions).toContain("Do Baptists believe in speaking in tongues?");
    expect(questions).toContain("What's the difference between Baptist and Pentecostal worship?");
    expect(questions).toContain("Can a Baptist attend a Pentecostal church?");
  });
});
