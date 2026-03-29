"use client";

import { useState } from "react";

type SpotifyEmbedCardProps = {
  playlistId?: string;
  artistId?: string;
  title: string;
  height: number;
  theme?: "light" | "dark";
  compact?: boolean;
};

export function SpotifyEmbedCard({
  playlistId,
  artistId,
  title,
  height,
  theme = "light",
  compact = false,
}: SpotifyEmbedCardProps) {
  const type = artistId ? "artist" : "playlist";
  const id = artistId || playlistId;
  const embedSrc = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator${theme === "dark" ? "&theme=0" : ""}`;

  return (
    <iframe
      title={`${title} on Spotify`}
      src={embedSrc}
      width="100%"
      height={`${height}`}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      className="border-0"
    />
  );
}
