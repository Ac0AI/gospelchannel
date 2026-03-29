import { describe, expect, it } from "vitest";
import { buildApprovalDecision } from "../../../scripts/lib/church-approval.mjs";

describe("church approval decisions", () => {
  it("approves strong churches and merges enrichment signals", () => {
    const decision = buildApprovalDecision(
      {
        slug: "new-life-stockholm",
        name: "Stockholm New Life Church",
        website: "https://newlife.nu/stockholm/",
        email: "",
        location: "",
        country: "Sweden",
        confidence: 0.82,
        header_image: "",
      },
      {
        enrichment: {
          street_address: "Missionsvägen 75, Bromma",
          contact_email: "info@newlife.nu",
          facebook_url: "https://www.facebook.com/NewLifeStockholm",
          cover_image_url: "https://cdn.example.com/cover.jpg",
          confidence: 0.76,
        },
        screening: {
          verdict: "verified_church_needs_playlist",
          websiteChurchScore: 0.83,
          headerImageUrl: "",
          location: "Stockholm",
          country: "Sweden",
        },
        approvalThreshold: 70,
      }
    );

    expect(decision.eligible).toBe(true);
    expect(decision.wave).toBe(1);
    expect(decision.merged.email).toBe("info@newlife.nu");
    expect(decision.merged.facebookUrl).toBe("https://www.facebook.com/NewLifeStockholm");
    expect(decision.merged.headerImage).toBe("https://cdn.example.com/cover.jpg");
  });

  it("blocks approval when place or official website is missing", () => {
    const decision = buildApprovalDecision(
      {
        slug: "mystery-church",
        name: "Mystery Fellowship",
        website: "https://www.facebook.com/mysteryfellowship",
        email: "",
        location: "",
        country: "Sweden",
        confidence: 0.71,
        header_image: "",
      },
      {
        screening: {
          verdict: "weak_church_signal",
          websiteChurchScore: 0.4,
          location: "",
          country: "Sweden",
        },
        approvalThreshold: 70,
      }
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("missing_official_website");
    expect(decision.blockers).toContain("missing_place");
  });
});
