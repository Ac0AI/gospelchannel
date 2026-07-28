import { NextResponse } from "next/server";
import { isValidYouTubeVideoId } from "@/lib/video-thumbnail";

const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
const FALLBACK_SVG = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1280" y2="720" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FDF2F8"/>
      <stop offset="1" stop-color="#FAE8FF"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="440" y="250" width="400" height="220" rx="24" fill="#FFFFFF" fill-opacity="0.85"/>
  <circle cx="590" cy="360" r="46" fill="#E11D48" fill-opacity="0.15"/>
  <path d="M575 336L622 360L575 384V336Z" fill="#BE123C"/>
  <text x="640" y="374" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#9F1239">Video Unavailable</text>
</svg>`.trim();

function fallbackResponse(): NextResponse {
  return new NextResponse(FALLBACK_SVG, {
    status: 200,
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await context.params;
  if (!isValidYouTubeVideoId(videoId)) {
    return fallbackResponse();
  }

  try {
    const upstream = await fetch(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, {
      headers: { Accept: "image/jpeg,image/*;q=0.8" },
    });
    const contentType = upstream.headers.get("content-type") || "";

    if (!upstream.ok || !upstream.body || !contentType.startsWith("image/")) {
      return fallbackResponse();
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fallbackResponse();
  }
}
