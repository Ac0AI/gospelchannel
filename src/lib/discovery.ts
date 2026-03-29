import { unstable_cache } from "next/cache";
import type { CatalogVideo, YouTubeVideo } from "@/types/gospel";
import { getStaffPicks, getTrendingCache } from "@/lib/content";
import { readJsonFile, writeJsonFile } from "@/lib/json-store";
import { searchYouTubeVideos } from "@/lib/youtube";
import { CONTENT_UPDATED_AT, normalizeText, uniqueBy } from "@/lib/utils";
import { upsertVideoCatalog } from "@/lib/catalog";

type DiscoverySection = {
  slug: string;
  title: string;
  description: string;
  videos: CatalogVideo[];
};

type DiscoveryFeed = {
  generatedAt: string;
  spotlight: CatalogVideo[];
  sections: DiscoverySection[];
};

type CandidateVideo = {
  video: YouTubeVideo;
  normalizedText: string;
  globalScore: number;
};

type SectionRule = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
};

const DISCOVERY_FILE = "cache/discovery-feed.json";
const PER_SECTION_LIMIT = 10;
const SPOTLIGHT_LIMIT = 8;

const DISCOVERY_QUERIES = [
  "gospel worship live official",
  "best gospel songs 2026 official",
  "black gospel choir live worship",
  "african gospel praise worship",
  "morning worship songs gospel",
  "late night prayer worship gospel",
  "contemporary gospel new release",
  "joyful praise gospel music",
];

const SECTION_RULES: SectionRule[] = [
  {
    slug: "spirit-lift",
    title: "Spirit Lift",
    description: "Joyful and high-energy praise that lifts the room.",
    keywords: ["praise", "joy", "celebrate", "rejoice", "victory", "hallelujah", "upbeat"],
  },
  {
    slug: "sunday-flow",
    title: "Sunday Flow",
    description: "Live worship moments built for Sunday rhythm.",
    keywords: ["sunday", "worship", "live", "church", "service", "session", "set"],
  },
  {
    slug: "choir-fire",
    title: "Choir Fire",
    description: "Power choirs, harmonies, and classic gospel force.",
    keywords: ["choir", "traditional", "hymn", "choral", "quartet", "classic", "gospel"],
  },
  {
    slug: "prayer-room",
    title: "Prayer Room",
    description: "Gentle worship and reflective songs for prayer.",
    keywords: ["prayer", "soaking", "quiet", "instrumental", "meditation", "night", "peace"],
  },
  {
    slug: "testimony-anthems",
    title: "Testimony Anthems",
    description: "Songs about grace, rescue, breakthrough, and faith.",
    keywords: ["grace", "testimony", "miracle", "breakthrough", "faith", "mercy", "deliver"],
  },
  {
    slug: "new-and-rising",
    title: "New and Rising",
    description: "Recent and fast-growing gospel videos worth catching early.",
    keywords: ["new", "latest", "release", "2026", "official", "premiere", "fresh"],
  },
];

const SPAM_TOKENS = [
  "reaction",
  "prank",
  "meme",
  "drama",
  "clickbait",
  "fake",
  "compilation",
  "vs",
  "beef",
  "politics",
];

function toCatalogVideo(video: YouTubeVideo): CatalogVideo {
  return {
    videoId: video.videoId,
    title: video.title,
    artist: video.channelTitle,
    thumbnailUrl: video.thumbnailUrl,
    source: "trending",
  };
}

function popularityScore(viewCount: number): number {
  if (!viewCount || viewCount <= 0) {
    return 0;
  }
  return Math.min(1, Math.log10(viewCount + 1) / 7);
}

function recencyScore(publishedAt?: string): number {
  if (!publishedAt) {
    return 0.25;
  }

  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) {
    return 0.25;
  }

  const now = Date.parse(CONTENT_UPDATED_AT);
  const ageDays = Math.max(0, Math.floor((now - published) / (1000 * 60 * 60 * 24)));

  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.8;
  if (ageDays <= 90) return 0.55;
  if (ageDays <= 365) return 0.3;
  return 0.15;
}

function keywordScore(normalizedText: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (normalizedText.includes(keyword)) {
      hits += 1;
    }
  }

  return hits / keywords.length;
}

function spamPenalty(normalizedText: string): number {
  for (const token of SPAM_TOKENS) {
    if (normalizedText.includes(token)) {
      return 0.45;
    }
  }
  return 0;
}

function scoreCandidate(video: YouTubeVideo): CandidateVideo {
  const normalizedText = normalizeText(`${video.title} ${video.channelTitle}`);

  const gospelIntent = keywordScore(normalizedText, [
    "gospel",
    "worship",
    "praise",
    "jesus",
    "church",
    "choir",
    "hallelujah",
  ]);

  const globalScore = Math.max(
    0,
    gospelIntent * 0.45 + popularityScore(video.viewCount) * 0.35 + recencyScore(video.publishedAt) * 0.2 - spamPenalty(normalizedText)
  );

  return {
    video,
    normalizedText,
    globalScore,
  };
}

function buildFallbackFeed(): DiscoveryFeed {
  const fallback = uniqueBy([...getTrendingCache(), ...getStaffPicks()], (video) => video.videoId);

  const spotlight = fallback.slice(0, SPOTLIGHT_LIMIT);
  const sections = SECTION_RULES.map((rule, index) => ({
    slug: rule.slug,
    title: rule.title,
    description: rule.description,
    videos: fallback.slice(index * 4, index * 4 + PER_SECTION_LIMIT),
  }));

  return {
    generatedAt: CONTENT_UPDATED_AT,
    spotlight,
    sections,
  };
}

function normalizeDiscoveryFeed(feed: DiscoveryFeed): DiscoveryFeed {
  const fallback = buildFallbackFeed();
  const spotlight = uniqueBy(
    [...(feed.spotlight ?? []), ...fallback.spotlight],
    (video) => video.videoId
  ).slice(0, SPOTLIGHT_LIMIT);

  const sectionBySlug = new Map((feed.sections ?? []).map((section) => [section.slug, section]));
  const sections = fallback.sections.map((fallbackSection) => {
    const source = sectionBySlug.get(fallbackSection.slug);
    const merged = uniqueBy(
      [
        ...(source?.videos ?? []),
        ...fallbackSection.videos,
        ...spotlight,
      ],
      (video) => video.videoId
    ).slice(0, PER_SECTION_LIMIT);

    return {
      slug: fallbackSection.slug,
      title: source?.title ?? fallbackSection.title,
      description: source?.description ?? fallbackSection.description,
      videos: merged,
    };
  });

  return {
    generatedAt: feed.generatedAt ?? fallback.generatedAt,
    spotlight,
    sections,
  };
}

function sectionFitScore(candidate: CandidateVideo, section: SectionRule): number {
  return section.keywords.filter((keyword) => candidate.normalizedText.includes(keyword)).length / section.keywords.length;
}

async function buildDiscoveryFeed(): Promise<DiscoveryFeed> {
  const collected: YouTubeVideo[] = [];

  for (const query of DISCOVERY_QUERIES) {
    const results = await searchYouTubeVideos(query, 10);
    collected.push(...results);
  }

  const deduped = uniqueBy(collected, (video) => video.videoId);
  if (deduped.length === 0) {
    return buildFallbackFeed();
  }

  const candidates = deduped.map(scoreCandidate).filter((candidate) => candidate.globalScore >= 0.2);
  if (candidates.length === 0) {
    return buildFallbackFeed();
  }

  const ranked = [...candidates].sort((a, b) => b.globalScore - a.globalScore);
  const spotlight = ranked.slice(0, SPOTLIGHT_LIMIT).map((candidate) => toCatalogVideo(candidate.video));

  const sections = SECTION_RULES.map((rule) => ({
    ...rule,
    videos: [] as CatalogVideo[],
  }));

  const usedInSections = new Set<string>();
  for (const candidate of ranked) {
    let bestSectionIndex = -1;
    let bestScore = 0;

    SECTION_RULES.forEach((rule, index) => {
      const fit = sectionFitScore(candidate, rule);
      const combined = fit * 0.7 + candidate.globalScore * 0.3;
      if (combined > bestScore) {
        bestScore = combined;
        bestSectionIndex = index;
      }
    });

    if (bestSectionIndex === -1 || bestScore < 0.2) {
      continue;
    }

    const target = sections[bestSectionIndex];
    if (target.videos.length >= PER_SECTION_LIMIT) {
      continue;
    }

    if (usedInSections.has(candidate.video.videoId)) {
      continue;
    }

    target.videos.push(toCatalogVideo(candidate.video));
    usedInSections.add(candidate.video.videoId);
  }

  const fallbackPool = uniqueBy([...spotlight, ...getStaffPicks(), ...getTrendingCache()], (video) => video.videoId);

  for (const section of sections) {
    if (section.videos.length >= 6) {
      continue;
    }

    for (const video of fallbackPool) {
      if (section.videos.length >= 6) {
        break;
      }
      if (usedInSections.has(video.videoId)) {
        continue;
      }
      section.videos.push(video);
      usedInSections.add(video.videoId);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    spotlight,
    sections: sections.map((section) => ({
      slug: section.slug,
      title: section.title,
      description: section.description,
      videos: section.videos,
    })),
  };
}

export async function syncDiscoveryFeed(): Promise<DiscoveryFeed> {
  const feed = await buildDiscoveryFeed();
  await writeJsonFile(DISCOVERY_FILE, feed);
  await upsertVideoCatalog(uniqueBy([...feed.spotlight, ...feed.sections.flatMap((section) => section.videos)], (video) => video.videoId));
  return feed;
}

export const getDiscoveryFeed = unstable_cache(
  async () => {
    const stored = await readJsonFile<DiscoveryFeed>(DISCOVERY_FILE, buildFallbackFeed());
    return normalizeDiscoveryFeed(stored);
  },
  ["discover"],
  { revalidate: 3600, tags: ["discover"] }
);
