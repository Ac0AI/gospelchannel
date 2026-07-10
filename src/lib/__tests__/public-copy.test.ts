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
};

describe("public copy", () => {
  for (const [group, paths] of Object.entries(PUBLIC_COPY_GROUPS)) {
    it(`${group} uses visitor language instead of internal GEO terminology`, () => {
      for (const path of paths) {
        const source = readFileSync(new URL(path, import.meta.url), "utf8");
        for (const pattern of FORBIDDEN_PUBLIC_COPY) {
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
