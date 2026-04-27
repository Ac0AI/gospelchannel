import { NextResponse } from "next/server";

const MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://media.gospelchannel.com").replace(/\/$/, "");

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { path } = await context.params;
  const safePath = path
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .map(encodeURIComponent)
    .join("/");

  if (!safePath) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const upstreamUrl = `${MEDIA_BASE_URL}/${safePath}`;
  const upstream = await fetch(upstreamUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "GospelChannel local dev media proxy",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(null, { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");
  const etag = upstream.headers.get("etag");
  const lastModified = upstream.headers.get("last-modified");

  if (contentType) headers.set("content-type", contentType);
  if (contentLength) headers.set("content-length", contentLength);
  if (etag) headers.set("etag", etag);
  if (lastModified) headers.set("last-modified", lastModified);
  headers.set("cache-control", "public, max-age=300");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
