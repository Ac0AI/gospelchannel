import { describe, expect, it } from "vitest";
import {
  buildChurchCardMetaLabel,
  deriveDisplayAssessment,
  getFirstServiceTimeLabel,
  getNearbyChurchPlaceLabel,
  getValidServiceTimeLabel,
  isGeneratedChurchDescription,
  isCriticalDisplayFlag,
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
});
