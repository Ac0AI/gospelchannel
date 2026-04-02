const LEGACY_STORAGE_PREFIX = "/storage/v1/object/public/church-assets/";

const MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");

function getMediaBaseUrl() {
  return MEDIA_BASE_URL;
}

export function rewriteLegacyMediaUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    const index = parsed.pathname.indexOf(LEGACY_STORAGE_PREFIX);
    if (index < 0) {
      return trimmed;
    }

    const key = parsed.pathname.slice(index + LEGACY_STORAGE_PREFIX.length).replace(/^\/+/, "");
    if (!key) {
      return trimmed;
    }

    return `${getMediaBaseUrl()}/${key}`;
  } catch {
    return trimmed;
  }
}

/**
 * Build a Cloudflare Image Resizing URL for images on our domain.
 * Falls back to the original URL for external images (YouTube thumbnails etc.).
 *
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url/
 */
export function cfImage(
  src: string,
  opts: { width?: number; height?: number; fit?: "cover" | "contain" | "crop" | "scale-down"; quality?: number; format?: "auto" | "webp" | "avif" } = {},
): string {
  if (!src) return src;

  // Only transform images served from our own domain (R2 via media.gospelchannel.com
  // or same-origin paths). External images (ytimg, scdn) can't go through our CDN.
  const isOwnDomain = src.startsWith(MEDIA_BASE_URL) || src.startsWith("/");
  if (!isOwnDomain) return src;

  const { width, height, fit = "cover", quality = 80, format = "auto" } = opts;

  const parts = [`format=${format}`, `quality=${quality}`, `fit=${fit}`];
  if (width) parts.push(`width=${width}`);
  if (height) parts.push(`height=${height}`);

  // For absolute URLs, extract the path
  let imagePath = src;
  if (src.startsWith(MEDIA_BASE_URL)) {
    imagePath = src.slice(MEDIA_BASE_URL.length);
  }

  return `${MEDIA_BASE_URL}/cdn-cgi/image/${parts.join(",")}${imagePath}`;
}
