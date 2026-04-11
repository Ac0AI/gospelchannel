import { describe, expect, it } from "vitest";
import { buildMergedProfile } from "../church-profile";
import {
  assessChurchVideoRelevance,
  buildChurchPageProfile,
  resolveChurchPublicDescription,
  resolveChurchPrimaryImage,
  selectChurchPageVideos,
} from "../church";

describe("church page quality", () => {
  const church = {
    slug: "sos-church",
    name: "SOS Church",
    description: "A welcoming worship church in Stockholm with contemporary services and strong community life for visitors and members.",
    spotifyPlaylistIds: [],
    logo: "/churches/sos.svg",
    website: "https://soschurch.se",
    spotifyUrl: "",
    country: "Sweden",
    youtubeChannelId: "UC123",
    instagramUrl: "https://www.instagram.com/soschurchmanual/",
  };

  it("uses claimed edits before enrichment before manual social fallback", () => {
    const merged = buildMergedProfile(
      {
        id: "1",
        enrichmentStatus: "complete",
        confidence: 1,
        schemaVersion: 1,
        createdAt: "",
        updatedAt: "",
        instagramUrl: "https://www.instagram.com/soschurchenrichment/",
      },
      [
        {
          fieldName: "instagram_url",
          fieldValue: "https://www.instagram.com/soschurchedit/",
          reviewStatus: "approved",
          submittedAt: "2026-03-18T00:00:00.000Z",
        },
      ],
      church,
    );

    expect(merged.instagramUrl).toBe("https://www.instagram.com/soschurchedit/");
    expect(merged.websiteUrl).toBe("https://soschurch.se");
  });

  it("uses a claimed hero image edit before enrichment or manual header image", () => {
    const merged = buildMergedProfile(
      {
        id: "2",
        enrichmentStatus: "complete",
        confidence: 1,
        schemaVersion: 1,
        createdAt: "",
        updatedAt: "",
        coverImageUrl: "https://images.example.com/enrichment-cover.jpg",
      },
      [
        {
          fieldName: "cover_image_url",
          fieldValue: "https://images.example.com/owner-cover.jpg",
          reviewStatus: "approved",
          submittedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
      {
        ...church,
        headerImage: "https://images.example.com/manual-header.jpg",
      },
    );

    expect(merged.coverImageUrl).toBe("https://images.example.com/owner-cover.jpg");
  });

  it("classifies official and unrelated church videos", () => {
    const official = assessChurchVideoRelevance(
      {
        videoId: "12345678901",
        title: "Sunday Worship",
        thumbnailUrl: "",
        channelTitle: "SOS Church Stockholm",
        channelId: "UC123",
        viewCount: 10,
      },
      { church, enrichment: { officialChurchName: "SOS Church", youtubeUrl: "https://www.youtube.com/channel/UC123" } },
    );
    const unrelated = assessChurchVideoRelevance(
      {
        videoId: "12345678902",
        title: "We The Kingdom - SOS (Live)",
        thumbnailUrl: "",
        channelTitle: "We The Kingdom",
        viewCount: 10,
      },
      { church, enrichment: null },
    );

    expect(official.relevance).toBe("official");
    expect(unrelated.relevance).toBe("unrelated");
  });

  it("filters out unrelated videos from church pages", () => {
    const videos = selectChurchPageVideos([
      {
        videoId: "12345678901",
        title: "Sunday Worship",
        thumbnailUrl: "",
        channelTitle: "SOS Church Stockholm",
        channelId: "UC123",
        viewCount: 10,
      },
      {
        videoId: "12345678902",
        title: "We The Kingdom - SOS (Live)",
        thumbnailUrl: "",
        channelTitle: "We The Kingdom",
        viewCount: 10,
      },
    ], { church, enrichment: null });

    expect(videos).toHaveLength(1);
    expect(videos[0].channelTitle).toBe("SOS Church Stockholm");
  });

  it("falls back to a video thumbnail when no header image exists", () => {
    expect(resolveChurchPrimaryImage({
      headerImage: "",
      videos: [
        { thumbnailUrl: "" },
        { thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg" },
      ],
      coverImageUrl: "https://images.example.com/cover.jpg",
    })).toBe("https://i.ytimg.com/vi/abc123/hqdefault.jpg");

    expect(resolveChurchPrimaryImage({
      headerImage: "https://images.example.com/header.jpg",
      videos: [{ thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg" }],
      coverImageUrl: "https://images.example.com/cover.jpg",
    })).toBe("https://images.example.com/header.jpg");
  });

  it("builds page profile score from fetched resources", () => {
    const result = buildChurchPageProfile({
      church,
      enrichment: {
        id: "3",
        enrichmentStatus: "complete",
        confidence: 1,
        schemaVersion: 1,
        createdAt: "",
        updatedAt: "",
        serviceTimes: [{ day: "Sunday", time: "10:00" }],
        streetAddress: "Main St 1, Stockholm, Sweden",
        contactEmail: "info@soschurch.se",
      },
      edits: [],
      isClaimed: true,
    });

    expect(result.profileScore.badgeStatus).toBe("verified");
    expect(result.mergedProfile.websiteUrl).toBe("https://soschurch.se");
  });

  it("rewrites generated church descriptions into factual fallback copy", () => {
    const description = resolveChurchPublicDescription({
      church: {
        name: "Aarhus Domkirke",
        description: "Discover worship music and playlists from Aarhus Domkirke. Based in Denmark. Listen to their curated worship playlists on GospelChannel.",
        spotifyPlaylistIds: [],
        additionalPlaylists: [],
        country: "Denmark",
        denomination: "Lutheran",
      },
    });

    expect(description).toBe("Aarhus Domkirke is a lutheran church in Denmark. Explore their worship and community details before your first visit.");
  });
});
