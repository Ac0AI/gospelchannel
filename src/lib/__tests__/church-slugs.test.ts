import { describe, expect, it } from "vitest";
import {
  filterCanonicalChurchSlugRecords,
  getChurchSlugLookupCandidates,
  resolveCanonicalChurchSlug,
} from "@/lib/church-slugs";

describe("church slug canonicalization", () => {
  it("resolves aliases to their canonical slug", () => {
    expect(resolveCanonicalChurchSlug("partille-pingstforsamling")).toBe("vallhamrakyrkan");
    expect(resolveCanonicalChurchSlug("pingstkyrkan-stockholm")).toBe("filadelfiakyrkan-stockholm");
    expect(resolveCanonicalChurchSlug("vallhamrakyrkan")).toBe("vallhamrakyrkan");
  });

  it("includes canonical and alias slugs in lookup candidates", () => {
    expect(getChurchSlugLookupCandidates("vallhamrakyrkan")).toEqual([
      "vallhamrakyrkan",
      "partille-pingstforsamling",
    ]);
    expect(getChurchSlugLookupCandidates("partille-pingstforsamling")).toEqual([
      "vallhamrakyrkan",
      "partille-pingstforsamling",
    ]);
  });

  it("filters alias rows out of canonical church lists", () => {
    expect(
      filterCanonicalChurchSlugRecords([
        { slug: "vallhamrakyrkan", name: "Vallhamrakyrkan" },
        { slug: "partille-pingstforsamling", name: "Partille Pingstförsamling" },
      ])
    ).toEqual([{ slug: "vallhamrakyrkan", name: "Vallhamrakyrkan" }]);
  });
});
