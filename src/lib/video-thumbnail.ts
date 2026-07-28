const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function getVideoThumbnailPath(videoId: string): string {
  return YOUTUBE_VIDEO_ID.test(videoId)
    ? `/api/video-thumbnail/${videoId}`
    : "/placeholders/video-fallback.svg";
}

export function isValidYouTubeVideoId(videoId: string): boolean {
  return YOUTUBE_VIDEO_ID.test(videoId);
}

export function proxyYouTubeThumbnailUrl(value: string): string;
export function proxyYouTubeThumbnailUrl(value: null | undefined): undefined;
export function proxyYouTubeThumbnailUrl(value: string | null | undefined): string | undefined;
export function proxyYouTubeThumbnailUrl(value: string | null | undefined): string | undefined {
  const src = value?.trim();
  if (!src) return undefined;

  try {
    const parsed = new URL(src);
    if (parsed.hostname !== "i.ytimg.com" && parsed.hostname !== "img.youtube.com") {
      return src;
    }

    const videoId = parsed.pathname.split("/").filter(Boolean)[1];
    return videoId && isValidYouTubeVideoId(videoId)
      ? getVideoThumbnailPath(videoId)
      : "/placeholders/video-fallback.svg";
  } catch {
    return src;
  }
}
