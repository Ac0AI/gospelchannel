import { describe, expect, it } from "vitest";
import {
  addChurchToIndex,
  areChurchesDuplicate,
  createChurchIndex,
  findChurchDuplicate,
  isOfficialWebsiteUrl,
} from "../../../scripts/lib/church-intake-utils.mjs";
import {
  findLikelyHeroImage,
  scoreWebsiteSignals,
} from "../../../scripts/lib/church-quality.mjs";

describe("church intake utils", () => {
  it("treats same name, country, and location as duplicates", () => {
    expect(
      areChurchesDuplicate(
        {
          name: "Greek Evangelical Church",
          country: "Cyprus",
          location: "Nicosia",
          website: "https://www.geccy.org/en/",
        },
        {
          name: "Greek Evangelical Church",
          country: "Cyprus",
          location: "Nicosia",
          website: "https://www.geccy.org/en/",
        }
      )
    ).toBe(true);
  });

  it("allows same host and name when the campus location is distinct", () => {
    expect(
      areChurchesDuplicate(
        {
          name: "Greek Evangelical Church",
          country: "Cyprus",
          location: "Nicosia",
          website: "https://www.geccy.org/en/",
        },
        {
          name: "Greek Evangelical Church",
          country: "Cyprus",
          location: "Larnaca",
          website: "https://www.geccy.org/en/",
        }
      )
    ).toBe(false);
  });

  it("keeps name-country duplicates blocked when a location is missing", () => {
    expect(
      areChurchesDuplicate(
        {
          name: "International Evangelical Church",
          country: "Cyprus",
          location: "",
          website: "https://ieccyprus.com/",
        },
        {
          name: "International Evangelical Church",
          country: "Cyprus",
          location: "Limassol",
          website: "https://ieccyprus.com/",
        }
      )
    ).toBe(true);
  });

  it("finds duplicates through the combined host and name-country index", () => {
    const index = createChurchIndex();
    addChurchToIndex(index, {
      slug: "greek-evangelical-church-nicosia",
      name: "Greek Evangelical Church",
      country: "Cyprus",
      location: "Nicosia",
      website: "https://www.geccy.org/en/",
    });

    expect(
      findChurchDuplicate(index, {
        name: "Greek Evangelical Church",
        country: "Cyprus",
        location: "Nicosia",
        website: "https://www.geccy.org/en/",
      })?.slug
    ).toBe("greek-evangelical-church-nicosia");
  });

  it("rejects social links as official church websites", () => {
    expect(isOfficialWebsiteUrl("https://www.facebook.com/examplechurch")).toBe(false);
    expect(isOfficialWebsiteUrl("https://examplechurch.org")).toBe(true);
  });

  it("treats casino-like page signals as non-church evidence", () => {
    const review = scoreWebsiteSignals({
      candidateName: "Bethel AG Church",
      pageTitle: "Be The Lag Church - L'église de l'actu",
      nameCandidates: ["Be The Lag Church"],
      pageText: "Mon exploration du catalogue de jeux de Rockstar Casino avec jackpot bonus et poker.",
      finalUrl: "https://www.bethelagchurch.com/",
      emails: [],
      location: "",
      headerImageUrl: "https://www.bethelagchurch.com/wp-content/uploads/2026/02/inscription-rockstar-casino-750x410.webp",
    });

    expect(review.flags).toContain("non_church_page");
    expect(review.flags).toContain("suspicious_header_image");
    expect(review.score).toBeLessThan(0.6);
  });

  it("skips suspicious og:image assets when selecting a hero image", () => {
    const html = `
      <meta property="og:image" content="/wp-content/uploads/rockstar-casino.webp" />
      <img src="/wp-content/uploads/logo.png" />
      <img src="/wp-content/uploads/church-hero.jpg" />
    `;

    expect(findLikelyHeroImage(html, "https://example.org")).toBe(
      "https://example.org/wp-content/uploads/church-hero.jpg",
    );
  });
});
