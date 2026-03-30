import { describe, expect, it } from "vitest";
import { buildApprovalDecision, resolveApprovedChurchName } from "../../../scripts/lib/church-approval.mjs";

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

  it("ignores suspicious header images from enrichment when merging approval signals", () => {
    const decision = buildApprovalDecision(
      {
        slug: "barcelona-121",
        name: "Barcelona International Church",
        website: "https://barcelona.example.org",
        email: "",
        location: "Barcelona",
        country: "Spain",
        confidence: 0.75,
        header_image: "",
      },
      {
        enrichment: {
          contact_email: "info@barcelona.example.org",
          facebook_url: "https://www.facebook.com/barcelonachurch",
          cover_image_url: "https://www.facebook.com/tr?id=123",
          confidence: 0.76,
        },
        screening: {
          verdict: "verified_church_needs_playlist",
          websiteChurchScore: 0.83,
          location: "Barcelona",
          country: "Spain",
        },
        approvalThreshold: 70,
      }
    );

    expect(decision.merged.headerImage).toBe("");
    expect(decision.wave).toBe(2);
  });

  it("ignores junk emails and email-like locations during approval merging", () => {
    const decision = buildApprovalDecision(
      {
        slug: "wurzburg-jesus-no-borders-church",
        name: "Jesus No Borders Church",
        website: "https://jesusnoborders.com",
        email: "",
        location: "jesusnoborders@gmail.com",
        country: "Germany",
        confidence: 0.8,
        header_image: "",
      },
      {
        enrichment: {
          contact_email: "user@domain.com",
          street_address: "Wurzburg",
          facebook_url: "https://www.facebook.com/JesusnoBorders/",
          confidence: 0.76,
        },
        screening: {
          verdict: "verified_church_needs_playlist",
          websiteChurchScore: 0.83,
          location: "Germany",
          country: "Germany",
        },
        approvalThreshold: 70,
      }
    );

    expect(decision.merged.email).toBe("");
    expect(decision.merged.location).toBe("Wurzburg");
  });

  it("prefers official church names when the original name is too generic", () => {
    const decision = buildApprovalDecision(
      {
        slug: "bethel",
        name: "Bethel",
        website: "https://www.bethel-llantwit.org.uk/",
        email: "",
        location: "Llantwit Major",
        country: "United Kingdom",
        confidence: 0.7,
        header_image: "",
      },
      {
        enrichment: {
          official_church_name: "Bethel Baptist Church",
          confidence: 0.8,
        },
        approvalThreshold: 70,
      }
    );

    expect(decision.blockers).not.toContain("weak_identity_signal");
    expect(resolveApprovedChurchName("Bethel", "Bethel Baptist Church")).toBe("Bethel Baptist Church");
  });

  it("treats established church network names as identity signals", () => {
    const decision = buildApprovalDecision(
      {
        slug: "groningen-vineyard",
        name: "Groningen Vineyard",
        website: "https://vineyardgroningen.com/",
        email: "",
        location: "Groningen",
        country: "Netherlands",
        confidence: 0.76,
        header_image: "",
      },
      {
        approvalThreshold: 70,
      }
    );

    expect(decision.blockers).not.toContain("weak_identity_signal");
  });
});
