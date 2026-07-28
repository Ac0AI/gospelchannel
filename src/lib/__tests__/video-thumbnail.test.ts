import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/video-thumbnail/[videoId]/route";
import {
  getVideoThumbnailPath,
  isValidYouTubeVideoId,
  proxyYouTubeThumbnailUrl,
} from "../video-thumbnail";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("video thumbnail URLs", () => {
  it("uses the same-origin proxy for a valid YouTube video ID", () => {
    expect(getVideoThumbnailPath("4dck2AX4xJg")).toBe("/api/video-thumbnail/4dck2AX4xJg");
    expect(isValidYouTubeVideoId("4dck2AX4xJg")).toBe(true);
  });

  it("uses the local fallback for an invalid video ID", () => {
    expect(getVideoThumbnailPath("../not-valid")).toBe("/placeholders/video-fallback.svg");
    expect(isValidYouTubeVideoId("../not-valid")).toBe(false);
  });

  it("rewrites stored YouTube thumbnails while preserving other image URLs", () => {
    expect(proxyYouTubeThumbnailUrl("https://i.ytimg.com/vi/4dck2AX4xJg/hqdefault_live.jpg"))
      .toBe("/api/video-thumbnail/4dck2AX4xJg");
    expect(proxyYouTubeThumbnailUrl("https://media.gospelchannel.com/church.jpg"))
      .toBe("https://media.gospelchannel.com/church.jpg");
  });
});

describe("video thumbnail proxy", () => {
  it("returns the fallback with a successful status when YouTube has no image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

    const response = await GET(
      new Request("https://gospelchannel.com/api/video-thumbnail/4dck2AX4xJg"),
      { params: Promise.resolve({ videoId: "4dck2AX4xJg" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(await response.text()).toContain("Video Unavailable");
  });

  it("passes through a valid upstream image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("jpeg-bytes", {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    })));

    const response = await GET(
      new Request("https://gospelchannel.com/api/video-thumbnail/4dck2AX4xJg"),
      { params: Promise.resolve({ videoId: "4dck2AX4xJg" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(await response.text()).toBe("jpeg-bytes");
  });
});
