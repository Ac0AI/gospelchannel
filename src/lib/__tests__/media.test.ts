import { describe, expect, it } from "vitest";
import { rewriteSpotifyArtUrl } from "../media";

describe("rewriteSpotifyArtUrl", () => {
  it("rewrites regional spotifycdn edge hosts to the canonical i.scdn.co", () => {
    expect(
      rewriteSpotifyArtUrl("https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e02046d056fc8d2cab5b9c8d")
    ).toBe("https://i.scdn.co/image/ab67616d00001e02e02046d056fc8d2cab5b9c8d");
    expect(
      rewriteSpotifyArtUrl("https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0290e22400e515676843c29fe0")
    ).toBe("https://i.scdn.co/image/ab67616d00001e0290e22400e515676843c29fe0");
  });

  it("leaves canonical and unrelated URLs untouched", () => {
    expect(rewriteSpotifyArtUrl("https://i.scdn.co/image/abc123")).toBe("https://i.scdn.co/image/abc123");
    expect(rewriteSpotifyArtUrl("https://media.gospelchannel.com/photos/x/1.webp")).toBe(
      "https://media.gospelchannel.com/photos/x/1.webp"
    );
  });

  it("returns null for empty input", () => {
    expect(rewriteSpotifyArtUrl(null)).toBeNull();
    expect(rewriteSpotifyArtUrl(undefined)).toBeNull();
    expect(rewriteSpotifyArtUrl("  ")).toBeNull();
  });
});
