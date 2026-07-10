import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FORBIDDEN_PUBLIC_COPY = [
  /\bproof routes?\b/i,
  /\bproof layer\b/i,
  /\bdatabase proof\b/i,
  /\bprofile (?:proof|evidence)\b/i,
  /\bdecision (?:engine|path)\b/i,
  /\banswer map\b/i,
  /\brequire evidence\b/i,
];

const FORBIDDEN_GUIDE_AND_AUDIENCE_COPY = [
  /\bproof profiles?\b/i,
  /\bproof database\b/i,
  /\bdoes the proof work\b/i,
];

const PUBLIC_COPY_GROUPS: Record<string, string[]> = {
  global: [
    "../../app/page.tsx",
    "../../app/layout.tsx",
    "../../app/about/page.tsx",
    "../../app/contact/page.tsx",
    "../../app/for-churches/page.tsx",
    "../../app/prayerwall/page.tsx",
    "../../app/prayerwall/[...segments]/page.tsx",
    "../../components/HomeHero.tsx",
    "../../components/SiteFooter.tsx",
  ],
  guidesAndAudiences: [
    "../../app/for/page.tsx",
    "../../app/for/[slug]/page.tsx",
    "../../app/guides/page.tsx",
    "../../app/guides/church-choice-answers/page.tsx",
    "../../app/guides/church-fit-quiz/page.tsx",
    "../../app/guides/denominations-comparison/page.tsx",
    "../../app/guides/first-visit-guide/page.tsx",
    "../../app/guides/how-to-find-the-right-church/page.tsx",
    "../../app/guides/prayer-guide/page.tsx",
    "../../app/guides/worship-styles-explained/page.tsx",
    "../../components/ForAudienceLayout.tsx",
    "../../components/guides/GuideChurchEvidence.tsx",
    "../../components/guides/GuideProofLinks.tsx",
    "../../components/tools/ChurchFitQuizClient.tsx",
    "../../lib/church-choice-answers.ts",
    "../../lib/for-audience-data.ts",
    "../../lib/search-suggestions.ts",
    "../../lib/seo-schema.ts",
    "../../lib/tooling.ts",
  ],
};

describe("public copy", () => {
  for (const [group, paths] of Object.entries(PUBLIC_COPY_GROUPS)) {
    it(`${group} uses visitor language instead of internal GEO terminology`, () => {
      for (const path of paths) {
        const source = readFileSync(new URL(path, import.meta.url), "utf8");
        const forbiddenPatterns = [
          ...FORBIDDEN_PUBLIC_COPY,
          ...(group === "guidesAndAudiences" ? FORBIDDEN_GUIDE_AND_AUDIENCE_COPY : []),
        ];
        for (const pattern of forbiddenPatterns) {
          expect(source, `${path} contains ${pattern}`).not.toMatch(pattern);
        }
      }
    });
  }

  it("uses concrete visitor next steps in Prayer Wall social metadata", () => {
    const source = readFileSync(new URL("../../app/prayerwall/page.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("verify fit in church profiles");
    expect(source).toContain("open church pages for service details, worship, location, and first-visit information");
  });
});
