"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { getMusicPlatformLinks } from "@/lib/music-platform";

type VideoCardProps = {
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl: string;
  rank?: number;
};

export function VideoCard({ videoId, title, channelTitle, thumbnailUrl, rank }: VideoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const validVideoId = /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  const likelyBlockedByRights = /vevo/i.test(channelTitle ?? "");
  const canEmbed = validVideoId && !likelyBlockedByRights;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const effectiveThumbnail = thumbnailFailed ? "/placeholders/video-fallback.svg" : thumbnailUrl;
  const platformLinks = useMemo(
    () => getMusicPlatformLinks({ title, channelTitle }),
    [title, channelTitle]
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-rose-200/60 bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
      <button
        type="button"
        onClick={() => {
          if (!canEmbed) {
            window.open(youtubeUrl, "_blank", "noopener,noreferrer");
            return;
          }
          setExpanded((value) => !value);
        }}
        className="group relative block aspect-video w-full overflow-hidden bg-blush-light"
        aria-label={canEmbed ? `Play ${title}` : `${title} unavailable`}
      >
        {expanded && canEmbed ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <>
            <Image
              src={effectiveThumbnail}
              alt={title}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              onError={() => setThumbnailFailed(true)}
            />
            {rank != null && (
              <span className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-lg bg-espresso/70 px-2 py-0.5 backdrop-blur-sm">
                <span className="font-serif text-2xl font-bold leading-none text-white">
                  #{rank}
                </span>
                {rank === 1 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                  </span>
                )}
              </span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-espresso/20 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-espresso shadow-sm">
                {canEmbed ? "▶ Play" : "Open on YouTube"}
              </span>
            </span>
          </>
        )}
      </button>

      <div className="space-y-2.5 p-4">
        <h3 className="font-serif line-clamp-2 text-sm font-semibold leading-snug text-espresso">{title}</h3>
        {channelTitle ? <p className="text-xs text-muted-warm">{channelTitle}</p> : null}
        {likelyBlockedByRights ? (
          <p className="text-xs text-rose-gold-deep">
            Embed can be blocked by rights owner. Open on YouTube if playback fails.
          </p>
        ) : null}

        <div className="rounded-xl border border-rose-200/70 bg-linen-deep/70">
          <button
            type="button"
            onClick={() => setSaveOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-mauve transition-colors hover:text-espresso"
          >
            Find on streaming
            <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${saveOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {saveOpen && (
            <div className="flex flex-wrap gap-2 px-2.5 pb-2.5">
              {platformLinks.map((platform) => (
                <a
                  key={platform.id}
                  href={platform.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-espresso transition-colors hover:bg-blush-light hover:text-rose-gold-deep"
                >
                  Search {platform.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-semibold text-rose-gold hover:text-rose-gold-deep ${canEmbed ? "hidden sm:inline-flex" : "inline-flex"}`}
        >
          Open on YouTube ↗
        </a>
      </div>
    </article>
  );
}
