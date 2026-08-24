import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ForAudienceLayout } from "@/components/ForAudienceLayout";
import * as forAudienceModule from "@/lib/for-audience-data";

type AudienceProofRoute = {
  href: string;
  label: string;
};

type GetAudienceProofRoutes = (
  audience: forAudienceModule.ForAudienceData,
  limit?: number,
) => AudienceProofRoute[];

const getAudienceProofRoutes = (
  forAudienceModule as typeof forAudienceModule & {
    getAudienceProofRoutes?: GetAudienceProofRoutes;
  }
).getAudienceProofRoutes;

describe("audience proof routes", () => {
  it("exposes an explicit primary proof route for every audience intent", () => {
    expect(getAudienceProofRoutes).toBeTypeOf("function");
    if (!getAudienceProofRoutes) return;

    const expectedPrimaryRoutes: Record<string, string> = {
      expats: "/church/english-speaking-churches",
      students: "/church/city",
      "young-adults": "/church/style/contemporary-worship",
      families: "/church/family-friendly-churches",
      "new-believers": "/church/churches-with-service-times",
      deconstructing: "/church",
    };

    for (const audience of Object.values(forAudienceModule.FOR_AUDIENCE)) {
      const routes = getAudienceProofRoutes(audience);

      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].href).toBe(expectedPrimaryRoutes[audience.slug]);
      expect(routes.every((route) => /^\/(?:church|network)\b/.test(route.href))).toBe(true);
      expect(routes.every((route) => route.label.length > 0)).toBe(true);
      expect(new Set(routes.map((route) => route.href)).size).toBe(routes.length);
    }

    expect(getAudienceProofRoutes(forAudienceModule.FOR_AUDIENCE.deconstructing).slice(0, 2)).toEqual([
      { href: "/church", label: "Browse church profiles" },
      { href: "/church/churches-with-service-times", label: "Churches with service times" },
    ]);
    expect(getAudienceProofRoutes(forAudienceModule.FOR_AUDIENCE.expats).slice(0, 2)).toEqual([
      { href: "/church/english-speaking-churches", label: "English-speaking churches" },
      {
        href: "/church/english-speaking-churches-in-zurich",
        label: "English-speaking churches in Zurich",
      },
    ]);
  });

  it("limits proof routes without admitting guide pages", () => {
    expect(getAudienceProofRoutes).toBeTypeOf("function");
    if (!getAudienceProofRoutes) return;

    const routes = getAudienceProofRoutes(forAudienceModule.FOR_AUDIENCE["new-believers"], 3);

    expect(routes).toHaveLength(3);
    expect(routes.map((route) => route.href)).toEqual([
      "/church/churches-with-service-times",
      "/church/denomination/non-denominational",
      "/church/denomination/baptist",
    ]);
  });

  it("uses the audience-specific primary proof route for the first page CTA", () => {
    const html = renderToStaticMarkup(createElement(ForAudienceLayout, {
      data: forAudienceModule.FOR_AUDIENCE.expats,
      siblings: [],
    }));
    const firstHref = html.match(/<a[^>]*href="([^"]+)"/)?.[1];

    expect(firstHref).toBe("/church/english-speaking-churches");
  });
});
