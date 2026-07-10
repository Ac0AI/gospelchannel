import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChurchGridFilter } from "@/components/ChurchGridFilter";

describe("homepage content", () => {
  it("formats the Explore all church count with thousands separators", () => {
    const markup = renderToStaticMarkup(
      createElement(ChurchGridFilter, { churches: [], totalCount: 72217 }),
    );

    expect(markup).toContain("Explore all 72,217 churches");
    expect(markup).not.toContain("Explore all 72217 churches");
  });
});
