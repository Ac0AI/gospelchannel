"use client";

import { useCallback, useRef, useState } from "react";

type Video = {
  videoId: string;
  title: string;
};

export function PlayAllButton({ videos }: { videos: Video[] }) {
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);

  const start = useCallback(() => {
    setPlaying(true);
    setCurrentIndex(0);
    // Scroll to the player
    setTimeout(() => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((i) => {
      if (i + 1 >= videos.length) {
        setPlaying(false);
        return 0;
      }
      return i + 1;
    });
  }, [videos.length]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  if (videos.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-2 rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-warm-brown hover:shadow-md"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Play All ({videos.length})
      </button>

      {playing && (
        <div ref={playerRef} className="mt-6 rounded-2xl border border-blush bg-espresso/5 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mauve">
                Now Playing — {currentIndex + 1} of {videos.length}
              </p>
              <p className="mt-1 truncate font-serif text-sm font-semibold text-espresso">
                {videos[currentIndex].title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                disabled={currentIndex === 0}
                className="rounded-full border border-blush p-2 text-espresso transition-colors hover:bg-blush-light disabled:opacity-30"
                aria-label="Previous"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={next}
                className="rounded-full border border-blush p-2 text-espresso transition-colors hover:bg-blush-light"
                aria-label="Next"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPlaying(false)}
                className="rounded-full border border-blush p-2 text-espresso transition-colors hover:bg-blush-light"
                aria-label="Close player"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="aspect-video overflow-hidden rounded-xl">
            <iframe
              key={videos[currentIndex].videoId}
              src={`https://www.youtube-nocookie.com/embed/${videos[currentIndex].videoId}?autoplay=1&rel=0`}
              title={videos[currentIndex].title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
