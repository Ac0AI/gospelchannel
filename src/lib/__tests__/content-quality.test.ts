import { describe, expect, it } from "vitest";
import {
  buildChurchCardMetaLabel,
  deriveDisplayAssessment,
  getFirstServiceTimeLabel,
  getNearbyChurchPlaceLabel,
  getValidServiceTimeLabel,
  isGeneratedChurchDescription,
  isCriticalDisplayFlag,
  isIndexableChurch,
  INDEXABLE_ONBRAND_SCORE_MIN,
  isValidOfficialWebsiteUrl,
  sanitizeServiceTimes,
} from "../content-quality";

describe("content-quality", () => {
  it("derives promotable tier for strong public content", () => {
    const result = deriveDisplayAssessment({
      description: "A welcoming church with vibrant congregational worship, clear Sunday gatherings, and a strong local community presence for new visitors.",
      country: "Sweden",
      spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      thumbnailUrl: "/churches/default-church.svg",
    });

    expect(result.promotionTier).toBe("promotable");
    expect(result.displayReady).toBe(true);
    expect(result.displayFlags).toEqual([]);
  });

  it("demotes weak content without marking it critical", () => {
    const result = deriveDisplayAssessment({
      description: "Short text",
      country: "Sweden",
    });

    expect(result.promotionTier).toBe("catalog_only");
    expect(result.displayReady).toBe(true);
    expect(result.displayFlags).toContain("warning_thin_public_text");
    expect(result.displayFlags).toContain("warning_missing_visual_asset");
    expect(result.displayFlags).toContain("warning_missing_playable_music");
  });

  it("marks suspicious public text as critical", () => {
    const result = deriveDisplayAssessment({
      description: "Community update null",
      country: "Sweden",
      spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      thumbnailUrl: "/churches/default-church.svg",
    });

    expect(result.displayReady).toBe(false);
    expect(result.displayFlags).toContain("critical_invalid_description_text");
    expect(isCriticalDisplayFlag("critical_invalid_description_text")).toBe(true);
  });

  it("detects generated import descriptions and demotes them", () => {
    expect(
      isGeneratedChurchDescription("Discover worship music and playlists from Aarhus Domkirke. Based in Denmark. Listen to their curated worship playlists on GospelChannel."),
    ).toBe(true);

    const result = deriveDisplayAssessment({
      description: "Discover worship music and playlists from Aarhus Domkirke. Based in Denmark. Listen to their curated worship playlists on GospelChannel.",
      country: "Denmark",
      spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      thumbnailUrl: "/churches/default-church.svg",
    });

    expect(result.displayFlags).toContain("warning_generated_description");
    expect(result.displayFlags).toContain("warning_thin_public_text");
    expect(result.promotionTier).toBe("catalog_only");
  });

  it("sanitizes invalid service times", () => {
    expect(
      sanitizeServiceTimes([
        { day: "Sundays", time: "10:00" },
        null as never,
        { day: "Sunday", time: "null" },
      ]),
    ).toEqual([{ day: "Sunday", time: "10:00" }]);
  });

  it("builds safe service time labels", () => {
    expect(getFirstServiceTimeLabel([{ day: "Sundays", time: "10:00" }])).toBe("Sunday 10:00");
    expect(getValidServiceTimeLabel("Sundays null")).toBeUndefined();
  });

  it("builds safe meta labels for church cards", () => {
    expect(
      buildChurchCardMetaLabel({
        location: "4 Rue des Magasins, Strasbourg",
        serviceTimes: "Sunday 10:00",
        country: "France",
      }),
    ).toBe("Strasbourg · Sunday 10:00");

    expect(
      buildChurchCardMetaLabel({
        serviceTimes: "Sundays null",
        playlistCount: 3,
        country: "France",
      }),
    ).toBe("3 playlists");
  });

  it("formats nearby church places safely", () => {
    expect(getNearbyChurchPlaceLabel("Strasbourg", "France")).toBe("Strasbourg, France");
    expect(getNearbyChurchPlaceLabel(undefined, "France")).toBe("France");
  });

  it("rejects directory hosts as official church websites", () => {
    expect(isValidOfficialWebsiteUrl("https://www.eniro.se/")).toBe(false);
    expect(isValidOfficialWebsiteUrl("https://www.facebook.com/examplechurch")).toBe(false);
    expect(isValidOfficialWebsiteUrl("https://www.filadelfiakyrkan.se")).toBe(true);
  });

  // Gate that drives robots noindex + sitemap inclusion on ~7,400 thin
  // church pages. A flipped null-default or off-by-one on the threshold
  // silently deindexes real pages or leaves empty stubs indexed, only
  // visible in GSC days later — hence explicit boundary coverage.
  describe("isIndexableChurch (on-brand concentration gate)", () => {
    it("worship playlist → indexable regardless of denomination/score", () => {
      expect(isIndexableChurch({ indexScore: 0, denomination: null, hasWorship: true })).toBe(true);
      expect(isIndexableChurch({ indexScore: null, denomination: "Catholic", hasWorship: true })).toBe(true);
    });

    it("on-brand denomination at the on-brand floor → indexable (boundary inclusive)", () => {
      expect(isIndexableChurch({ indexScore: INDEXABLE_ONBRAND_SCORE_MIN, denomination: "Baptist" })).toBe(true);
    });

    it("on-brand denomination just below the floor → not indexable", () => {
      expect(isIndexableChurch({ indexScore: INDEXABLE_ONBRAND_SCORE_MIN - 1, denomination: "Baptist" })).toBe(false);
    });

    it("off-brand denomination → not indexable even with a high score", () => {
      expect(isIndexableChurch({ indexScore: 100, denomination: "Catholic" })).toBe(false);
      expect(isIndexableChurch({ indexScore: 100, denomination: "Methodist" })).toBe(false);
    });

    it("unknown/empty denomination without worship → not indexable", () => {
      expect(isIndexableChurch({ indexScore: 100, denomination: null })).toBe(false);
      expect(isIndexableChurch({ indexScore: 100, denomination: "" })).toBe(false);
    });

    it("null score on-brand without worship → not indexable", () => {
      expect(isIndexableChurch({ indexScore: null, denomination: "Baptist" })).toBe(false);
    });
  });

  // Orphan-pages plan, deploy 1 (2026-05-20). Prayer wall as the 4th content
  // signal. Monotonic + deterministic: only-gains, never-losses, exactly +25
  // when present. Single source of truth for the gate (no parallel boolean
  // predicate — see [[parity-gate-shared-comparator]] / DRY).
  describe("hasPrayers input (deploy 1)", () => {
    const thinMetadataOnly = {
      country: "Sweden",
      location: "Stockholm",
      // No description, no enrichment summary, no music, no images.
    };

    it("prayer-only church with valid metadata lands exactly at the substance score", () => {
      const result = deriveDisplayAssessment({ ...thinMetadataOnly, hasPrayers: true });
      // displayReady (no critical flags) +20 + prayers +25 = 45.
      expect(result.displayScore).toBe(45);
      // Post-concentration: prayers alone (no on-brand denomination, no worship
      // playlist) no longer make a page indexable — score 45 < on-brand floor.
      expect(isIndexableChurch({ indexScore: result.displayScore, denomination: null })).toBe(false);
    });

    it("no-prayers thin church stays below the substance score", () => {
      const result = deriveDisplayAssessment({ ...thinMetadataOnly });
      expect(result.displayScore).toBe(20); // displayReady only
      expect(isIndexableChurch({ indexScore: result.displayScore, denomination: null })).toBe(false);
    });

    it("prayers boost is exactly +25 (matches hasMusic, deterministic)", () => {
      const withoutPrayers = deriveDisplayAssessment({ ...thinMetadataOnly });
      const withPrayers = deriveDisplayAssessment({ ...thinMetadataOnly, hasPrayers: true });
      expect(withPrayers.displayScore - withoutPrayers.displayScore).toBe(25);
    });

    it("monotonic: prayers never LOWERS the score (any church)", () => {
      // A church that already passes everything: prayers should still only add.
      const strongInputs = {
        description:
          "A welcoming church with vibrant congregational worship, clear Sunday gatherings, and a strong local community presence for new visitors.",
        country: "Sweden",
        spotifyUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
        thumbnailUrl: "/churches/default-church.svg",
      };
      const without = deriveDisplayAssessment(strongInputs);
      const withp = deriveDisplayAssessment({ ...strongInputs, hasPrayers: true });
      expect(withp.displayScore).toBeGreaterThanOrEqual(without.displayScore);
      expect(withp.displayScore - without.displayScore).toBe(25);
    });

    it("hasPrayers=false is equivalent to omitted (no flag, no perturbation)", () => {
      const omitted = deriveDisplayAssessment({ ...thinMetadataOnly });
      const explicit = deriveDisplayAssessment({ ...thinMetadataOnly, hasPrayers: false });
      expect(explicit.displayScore).toBe(omitted.displayScore);
      expect(explicit.displayFlags).toEqual(omitted.displayFlags);
    });

    it("does not introduce a 'missing_prayers' flag (absence is not a quality issue)", () => {
      const result = deriveDisplayAssessment({ ...thinMetadataOnly });
      for (const flag of result.displayFlags) {
        expect(flag.toLowerCase()).not.toContain("prayer");
      }
    });
  });
});
