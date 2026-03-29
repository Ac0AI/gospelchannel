import type { CatalogVideo, SpotifyTrack, TrackMatch, YouTubeVideo } from "@/types/gospel";
import { readJsonFile, writeJsonFile } from "@/lib/json-store";
import { CONTENT_UPDATED_AT, tokenSimilarity, uniqueBy } from "@/lib/utils";
import { getCatalogVideoById, upsertVideoCatalog } from "@/lib/catalog";

type SearchItem = {
  id: { videoId: string };
  snippet: {
    title: string;
    channelId?: string;
    channelTitle: string;
    thumbnails?: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
    publishedAt?: string;
  };
};

type VideosDetailsItem = {
  id: string;
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
    thumbnails?: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
    publishedAt?: string;
  };
  statistics?: { viewCount?: string };
};

type TrackMatchCache = Record<string, TrackMatch>;

const TRACK_MATCHES_FILE = "cache/track-matches.json";
const TRENDING_FILE = "cache/trending.json";

function thumbnailFromId(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function fallbackVideo(videoId: string, title: string, channelTitle = "YouTube"): YouTubeVideo {
  return {
    videoId,
    title,
    thumbnailUrl: thumbnailFromId(videoId),
    channelTitle,
    viewCount: 0,
  };
}

async function readTrackMatchCache(): Promise<TrackMatchCache> {
  return readJsonFile<TrackMatchCache>(TRACK_MATCHES_FILE, {});
}

async function writeTrackMatchCache(cache: TrackMatchCache): Promise<void> {
  await writeJsonFile(TRACK_MATCHES_FILE, cache);
}

function hasYouTubeApiKey(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

async function searchYouTubeRaw(query: string, maxResults = 5): Promise<SearchItem[]> {
  if (!hasYouTubeApiKey()) {
    return [];
  }

  const params = new URLSearchParams({
    key: process.env.YOUTUBE_API_KEY!,
    part: "snippet",
    type: "video",
    maxResults: String(maxResults),
    videoCategoryId: "10",
    videoEmbeddable: "true",
    q: query,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { items?: SearchItem[] };
  return payload.items ?? [];
}

async function hydrateWithVideoStats(items: SearchItem[]): Promise<YouTubeVideo[]> {
  if (!hasYouTubeApiKey() || items.length === 0) {
    return [];
  }

  const ids = items.map((item) => item.id.videoId).join(",");
  const params = new URLSearchParams({
    key: process.env.YOUTUBE_API_KEY!,
    part: "snippet,statistics",
    id: ids,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnailUrl:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.default?.url ??
        thumbnailFromId(item.id.videoId),
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      viewCount: 0,
      publishedAt: item.snippet.publishedAt,
    }));
  }

  const payload = (await response.json()) as { items?: VideosDetailsItem[] };
  const byId = new Map<string, VideosDetailsItem>();
  for (const item of payload.items ?? []) {
    byId.set(item.id, item);
  }

  return items.map((item) => {
    const details = byId.get(item.id.videoId);

    return {
      videoId: item.id.videoId,
      title: details?.snippet?.title ?? item.snippet.title,
      thumbnailUrl:
        details?.snippet?.thumbnails?.high?.url ??
        details?.snippet?.thumbnails?.medium?.url ??
        details?.snippet?.thumbnails?.default?.url ??
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.default?.url ??
        thumbnailFromId(item.id.videoId),
      channelId: details?.snippet?.channelId ?? item.snippet.channelId,
      channelTitle: details?.snippet?.channelTitle ?? item.snippet.channelTitle,
      viewCount: Number(details?.statistics?.viewCount ?? 0),
      publishedAt: details?.snippet?.publishedAt ?? item.snippet.publishedAt,
    };
  });
}

export async function searchYouTubeVideos(query: string, maxResults = 8): Promise<YouTubeVideo[]> {
  const raw = await searchYouTubeRaw(query, maxResults);
  return hydrateWithVideoStats(raw);
}

function toCatalogVideo(video: YouTubeVideo, source: CatalogVideo["source"], artist?: string): CatalogVideo {
  return {
    videoId: video.videoId,
    title: video.title,
    artist,
    thumbnailUrl: video.thumbnailUrl,
    source,
  };
}

export async function matchSpotifyTrackToYouTube(track: SpotifyTrack): Promise<{
  video: YouTubeVideo | null;
  confidence: number;
  lowConfidence: boolean;
}> {
  const cache = await readTrackMatchCache();
  const cacheEntry = cache[track.spotifyId];

  if (cacheEntry?.youtubeVideoId) {
    const catalogVideo = await getCatalogVideoById(cacheEntry.youtubeVideoId);
    const video = catalogVideo
      ? fallbackVideo(catalogVideo.videoId, catalogVideo.title, catalogVideo.artist ?? "YouTube")
      : fallbackVideo(cacheEntry.youtubeVideoId, `${track.artist} - ${track.title}`);

    return {
      video,
      confidence: cacheEntry.confidence,
      lowConfidence: Boolean(cacheEntry.lowConfidence),
    };
  }

  if (track.manualYoutubeVideoId) {
    cache[track.spotifyId] = {
      youtubeVideoId: track.manualYoutubeVideoId,
      confidence: 1,
      matchedAt: CONTENT_UPDATED_AT,
      manualOverride: true,
      lowConfidence: false,
    };

    await writeTrackMatchCache(cache);
    await upsertVideoCatalog([
      {
        videoId: track.manualYoutubeVideoId,
        title: `${track.artist} - ${track.title}`,
        artist: track.artist,
        thumbnailUrl: thumbnailFromId(track.manualYoutubeVideoId),
        source: "church",
      },
    ]);

    return {
      video: fallbackVideo(track.manualYoutubeVideoId, `${track.artist} - ${track.title}`, track.artist),
      confidence: 1,
      lowConfidence: false,
    };
  }

  if (!hasYouTubeApiKey()) {
    return {
      video: null,
      confidence: 0,
      lowConfidence: true,
    };
  }

  const attempts = [`${track.artist} ${track.title} official`, `${track.title} ${track.artist}`];
  let bestVideo: YouTubeVideo | null = null;
  let bestScore = 0;

  for (const query of attempts) {
    const candidates = await searchYouTubeVideos(query, 5);
    for (const candidate of candidates) {
      const titleScore = tokenSimilarity(candidate.title, `${track.artist} ${track.title}`);
      const channelScore = tokenSimilarity(candidate.channelTitle, track.artist);
      const viewsBoost = candidate.viewCount > 10_000 ? 0.05 : 0;
      const score = Math.min(1, titleScore * 0.75 + channelScore * 0.2 + viewsBoost);

      if (score > bestScore) {
        bestScore = score;
        bestVideo = candidate;
      }
    }

    if (bestScore >= 0.72) {
      break;
    }
  }

  if (!bestVideo) {
    return {
      video: null,
      confidence: 0,
      lowConfidence: true,
    };
  }

  const lowConfidence = bestScore < 0.6;
  cache[track.spotifyId] = {
    youtubeVideoId: bestVideo.videoId,
    confidence: Number(bestScore.toFixed(2)),
    matchedAt: CONTENT_UPDATED_AT,
    manualOverride: false,
    lowConfidence,
  };

  await writeTrackMatchCache(cache);
  await upsertVideoCatalog([toCatalogVideo(bestVideo, "church", track.artist)]);

  return {
    video: bestVideo,
    confidence: Number(bestScore.toFixed(2)),
    lowConfidence,
  };
}

export async function getTrendingGospelVideos(): Promise<YouTubeVideo[]> {
  if (!hasYouTubeApiKey()) {
    return readJsonFile<YouTubeVideo[]>(TRENDING_FILE, []);
  }

  const queries = [
    "gospel music live worship 2026",
    "new gospel songs worship",
    "gospel choir praise",
  ];

  const videos: YouTubeVideo[] = [];
  for (const query of queries) {
    const found = await searchYouTubeVideos(query, 6);
    videos.push(...found);
  }

  const deduped = uniqueBy(videos, (video) => video.videoId).slice(0, 24);
  return deduped;
}

export async function syncTrendingCache(): Promise<YouTubeVideo[]> {
  const trending = await getTrendingGospelVideos();
  await writeJsonFile(TRENDING_FILE, trending);
  await upsertVideoCatalog(
    trending.map((video) => ({
      videoId: video.videoId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      source: "trending",
    }))
  );
  return trending;
}
