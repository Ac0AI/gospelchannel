import { describe, expect, it } from "vitest";
import type { ChurchDirectoryEntry } from "@/lib/church-directory";
import {
  buildCompareGuide,
  buildDiscoveryLanes,
  buildSoundProfiles,
  collectLaneChurchMatches,
  collectTopChurchMatches,
  getCompareGuideSlugs,
  scoreQuizLanes,
  scoreSoundProfiles,
  toToolChurchPreview,
} from "@/lib/tooling";

function createChurch(overrides: Partial<ChurchDirectoryEntry> & Pick<ChurchDirectoryEntry, "slug" | "name">): ChurchDirectoryEntry {
  return {
    slug: overrides.slug,
    name: overrides.name,
    description: overrides.description ?? `${overrides.name} church profile.`,
    country: overrides.country ?? "United Kingdom",
    location: overrides.location ?? "London, United Kingdom",
    musicStyle: overrides.musicStyle ?? ["Contemporary Worship"],
    denomination: overrides.denomination ?? "Non-denominational",
    displayReady: overrides.displayReady ?? true,
    promotionTier: overrides.promotionTier ?? "catalog_only",
    displayScore: overrides.displayScore ?? 60,
    qualityScore: overrides.qualityScore ?? 60,
    enrichmentHint: overrides.enrichmentHint ?? {
      dataRichnessScore: 40,
      location: overrides.location ?? "London, United Kingdom",
      serviceTimes: "Sunday 10:00",
      summary: `${overrides.name} summary`,
    },
    spotifyPlaylistIds: overrides.spotifyPlaylistIds ?? [],
    additionalPlaylists: overrides.additionalPlaylists ?? [],
    playlistCount: overrides.playlistCount ?? 1,
    logo: overrides.logo,
    thumbnailUrl: overrides.thumbnailUrl,
    aliases: overrides.aliases,
    updatedAt: overrides.updatedAt,
    songCount: overrides.songCount,
    sourceKind: overrides.sourceKind,
  };
}

const churches: ChurchDirectoryEntry[] = [
  createChurch({
    slug: "anthem-city",
    name: "Anthem City",
    musicStyle: ["Contemporary Worship", "Christian Rock"],
    denomination: "Non-denominational",
    displayScore: 82,
    qualityScore: 75,
  }),
  createChurch({
    slug: "spirit-fire",
    name: "Spirit Fire Church",
    location: "Manchester, United Kingdom",
    musicStyle: ["Charismatic Worship"],
    denomination: "Pentecostal",
    displayScore: 78,
    qualityScore: 73,
  }),
  createChurch({
    slug: "gospel-choir",
    name: "Gospel Choir Church",
    location: "Birmingham, United Kingdom",
    musicStyle: ["Contemporary Gospel"],
    denomination: "Baptist",
    displayScore: 74,
    qualityScore: 71,
  }),
  createChurch({
    slug: "rooted-parish",
    name: "Rooted Parish",
    location: "Oxford, United Kingdom",
    musicStyle: ["Choral Worship"],
    denomination: "Anglican",
    displayScore: 72,
    qualityScore: 70,
  }),
  createChurch({
    slug: "quiet-room",
    name: "Quiet Room Church",
    location: "Bristol, United Kingdom",
    musicStyle: ["Acoustic Worship"],
    denomination: "Evangelical",
    displayScore: 68,
    qualityScore: 66,
  }),
  createChurch({
    slug: "bible-neighborhood",
    name: "Bible Neighborhood Church",
    location: "Leeds, United Kingdom",
    musicStyle: ["Teaching Worship"],
    denomination: "Baptist",
    displayScore: 70,
    qualityScore: 72,
  }),
  createChurch({
    slug: "vida-espanol",
    name: "Vida Espanol",
    location: "Madrid, Spain",
    country: "Spain",
    musicStyle: ["Latin Worship"],
    denomination: "Pentecostal",
    displayScore: 76,
    qualityScore: 69,
  }),
  createChurch({
    slug: "diaspora-praise",
    name: "Diaspora Praise",
    location: "Lagos, Nigeria",
    country: "Nigeria",
    musicStyle: ["African Worship"],
    denomination: "Pentecostal",
    displayScore: 75,
    qualityScore: 70,
  }),
];

describe("tooling", () => {
  it("builds discovery lanes with fallback church samples when rules miss", () => {
    const fallbackOnly = [
      createChurch({
        slug: "single-fallback",
        name: "Single Fallback Church",
        musicStyle: ["Contemporary Worship"],
      }),
    ];

    const lanes = buildDiscoveryLanes(fallbackOnly);

    expect(lanes).toHaveLength(7);
    expect(lanes.every((lane) => lane.sampleChurches.length === 1)).toBe(true);
    expect(lanes.every((lane) => lane.sampleChurches[0]?.slug === "single-fallback")).toBe(true);
  });

  it("scores quiz lanes and returns the strongest three matches", () => {
    const lanes = buildDiscoveryLanes(churches);
    const results = scoreQuizLanes(
      {
        energy: "expressive",
        tradition: "free",
        size: "large",
        family: "low",
        teaching: "prophetic",
        social: "expressive",
        travel: "special-worship",
      },
      lanes,
    );

    expect(results).toHaveLength(3);
    expect(results[0]?.id).toBe("spirit-led");
    expect(results[0]?.sampleChurches[0]?.slug).toBe("spirit-fire");
  });

  it("builds sound profiles and falls back safely when a profile has no direct match", () => {
    const fallbackOnly = [
      createChurch({
        slug: "single-sound-fallback",
        name: "Single Sound Fallback",
        musicStyle: ["Contemporary Worship"],
      }),
    ];

    const profiles = buildSoundProfiles(fallbackOnly);

    expect(profiles).toHaveLength(6);
    expect(profiles.every((profile) => profile.sampleChurches[0]?.slug === "single-sound-fallback")).toBe(true);
  });

  it("scores sound profiles toward the selected worship sound", () => {
    const profiles = buildSoundProfiles(churches);
    const results = scoreSoundProfiles(
      {
        sound: "latin",
        feeling: "global",
        artists: "latin",
      },
      profiles,
    );

    expect(results).toHaveLength(3);
    expect(results[0]?.id).toBe("latin-rhythm");
    expect(results[0]?.sampleChurches[0]?.slug).toBe("vida-espanol");
  });

  it("deduplicates collected church matches across result groups", () => {
    const anthem = toToolChurchPreview(churches[0]);
    const spirit = toToolChurchPreview(churches[1]);
    const gospel = toToolChurchPreview(churches[2]);

    const matches = collectTopChurchMatches(
      [
        { sampleChurches: [anthem, spirit] },
        { sampleChurches: [anthem, gospel] },
      ],
      3,
    );

    expect(matches.map((church) => church.slug)).toEqual(["anthem-city", "spirit-fire", "gospel-choir"]);
  });

  it("collects direct church matches from the strongest lanes", () => {
    const lanes = buildDiscoveryLanes(churches);
    const matches = collectLaneChurchMatches(churches, [
      lanes.find((lane) => lane.id === "spirit-led")!,
      lanes.find((lane) => lane.id === "anthem-contemporary")!,
    ], { limit: 4 });

    expect(matches.map((church) => church.slug)).toEqual([
      "spirit-fire",
      "diaspora-praise",
      "vida-espanol",
      "anthem-city",
    ]);
  });

  it("narrows direct church matches by area query", () => {
    const lanes = buildDiscoveryLanes(churches);
    const matches = collectLaneChurchMatches(churches, [
      lanes.find((lane) => lane.id === "spirit-led")!,
      lanes.find((lane) => lane.id === "global-multilingual")!,
    ], { query: "Madrid", limit: 4 });

    expect(matches.map((church) => church.slug)).toEqual(["vida-espanol"]);
  });

  it("builds compare guides with populated choices", () => {
    const guide = buildCompareGuide("baptist-vs-pentecostal", churches);

    expect(guide?.choices).toHaveLength(2);
    expect(guide?.choices[0]?.sampleChurches.map((church) => church.slug)).toContain("bible-neighborhood");
    expect(guide?.choices[0]?.sampleChurches.map((church) => church.slug)).toContain("gospel-choir");
    expect(guide?.choices[1]?.sampleChurches.map((church) => church.slug)).toContain("spirit-fire");
  });

  it("returns the published compare guide slugs", () => {
    expect(getCompareGuideSlugs()).toEqual([
      "traditional-vs-contemporary-worship",
      "baptist-vs-pentecostal",
      "liturgical-vs-free-worship",
      "big-church-vs-small-church",
    ]);
  });
});
