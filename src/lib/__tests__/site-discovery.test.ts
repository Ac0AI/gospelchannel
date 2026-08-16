import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as siteFooterModule from "@/components/SiteFooter";
import { FOR_AUDIENCE } from "@/lib/for-audience-data";

type FooterColumn = {
  title: string;
  links: Array<{ label: string; href: string }>;
};

describe("site discovery", () => {
  it("links the answer map and every audience route from the global footer", () => {
    const columns = (
      siteFooterModule as typeof siteFooterModule & {
        SITE_FOOTER_COLUMNS?: FooterColumn[];
      }
    ).SITE_FOOTER_COLUMNS ?? [];
    const hrefs = columns.flatMap((column) => column.links.map((link) => link.href));

    expect(hrefs).toContain("/guides/church-choice-answers");
    expect(hrefs).toContain("/for");
    for (const audience of Object.values(FOR_AUDIENCE)) {
      expect(hrefs).toContain(`/for/${audience.slug}`);
    }
  });

  it("declares the audience route hub as part of the root WebSite schema", () => {
    const layoutSource = readFileSync(
      new URL("../../app/layout.tsx", import.meta.url),
      "utf8",
    );

    expect(layoutSource).toContain('name: "Audience church-search routes"');
    expect(layoutSource).toContain('url: "https://gospelchannel.com/for"');
  });

  it("links audience proof routes directly from the audience hub", () => {
    const audienceHubSource = readFileSync(
      new URL("../../app/for/page.tsx", import.meta.url),
      "utf8",
    );

    expect(audienceHubSource).toContain("href={route.href}");
  });

  it("uses real directory freshness on every church proof route", () => {
    const proofPagePaths = [
      "../../app/church/churches-with-service-times/page.tsx",
      "../../app/church/churches-with-worship-music/page.tsx",
      "../../app/church/english-speaking-churches/page.tsx",
      "../../app/church/english-speaking-churches-in-zurich/page.tsx",
      "../../app/church/family-friendly-churches/page.tsx",
      "../../app/church/best-worship-churches/page.tsx",
      "../../app/church/charismatic-churches-in-london/page.tsx",
    ];

    for (const path of proofPagePaths) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");

      expect(source).toContain("getFreshestChurchUpdatedAtAsync");
      expect(source).not.toMatch(/updated(?:Iso)?\s*=\s*new Date\(\)/);
    }
  });

  it("does not label an external maps link as the database proof layer", () => {
    const profileSource = readFileSync(
      new URL("../../app/church/[slug]/page.tsx", import.meta.url),
      "utf8",
    );

    expect(profileSource).toContain('key: "location", label: "Location"');
    expect(profileSource).not.toContain('label: "Location proof"');
  });

  it("keeps comparison schema in the answer layer", () => {
    const comparisonSource = readFileSync(
      new URL("../../app/compare/[slug]/page.tsx", import.meta.url),
      "utf8",
    );

    expect(comparisonSource).toContain('{ name: "Church comparison guides", url: "https://gospelchannel.com/compare" }');
    expect(comparisonSource).not.toContain("Church comparison proof routes");
  });
});
