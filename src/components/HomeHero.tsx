"use client";

import { useEffect, useState } from "react";
import { HeroSearch } from "@/components/HeroSearch";

const HERO_SLIDES = [
  {
    avif: "/hero/worship-arena.avif",
    webp: "/hero/worship-arena.webp",
    caption: "Hands raised",
    city: "Contemporary worship",
  },
  {
    avif: "/hero/intimate-worship.avif",
    webp: "/hero/intimate-worship.webp",
    caption: "Eyes closed",
    city: "Sunday morning",
  },
  {
    avif: "/hero/outdoor-gathering.avif",
    webp: "/hero/outdoor-gathering.webp",
    caption: "Wide sky",
    city: "Sunset gathering",
  },
];

type Props = {
  surpriseSlugs: string[];
  churchCountLabel: string;
};

export function HomeHero({ surpriseSlugs, churchCountLabel }: Props) {
  const [idx, setIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // Defer rendering of slides 1-N until after hydration so the SSR'd LCP
    // image (slide 0) stays on the critical path. See commit 6b8ea0b2.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowAll(true);
    const id = setInterval(() => setIdx((i) => (i + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const current = HERO_SLIDES[idx];

  return (
    <section className="relative h-[560px] overflow-hidden sm:h-[680px] lg:h-[760px]">
      {/* Rotating background images */}
      {HERO_SLIDES.map((slide, i) => {
        const shouldRender = i === 0 || showAll;
        return (
          <div
            key={slide.avif}
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              opacity: i === idx ? 1 : 0,
              transform: i === idx ? "scale(1.02)" : "scale(1)",
              transition: "opacity 1.4s ease, transform 7s ease",
            }}
          >
            {shouldRender && (
              <picture>
                <source srcSet={slide.avif} type="image/avif" />
                <img
                  src={slide.webp}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "low"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </picture>
            )}
          </div>
        );
      })}

      {/* Cinematic vertical gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,12,8,0.55) 0%, rgba(20,12,8,0.25) 35%, rgba(20,12,8,0.55) 75%, rgba(20,12,8,0.85) 100%)",
        }}
      />

      {/* Hero content */}
      <div className="relative z-[2] flex h-full flex-col items-center justify-center px-5 text-center sm:px-12">
        <p className="font-serif text-base italic text-white/70 sm:text-[17px]">
          People find God in different ways.
        </p>
        <h1 className="mt-3 max-w-[12ch] font-serif text-5xl font-semibold leading-[1.08] tracking-[-0.02em] text-white drop-shadow-[0_2px_30px_rgba(0,0,0,0.3)] sm:text-7xl lg:whitespace-nowrap lg:text-[88px]">
          Find <em className="not-italic font-serif italic text-blush">yours</em>.
        </h1>
        <p className="mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-white/85 sm:text-lg lg:text-[19px]">
          Listen to worship. Watch sermons. Find where you belong &mdash; before Sunday.
        </p>

        <div className="mt-9 w-full max-w-[620px]">
          <HeroSearch surpriseSlugs={surpriseSlugs} variant="page" />
        </div>
      </div>

      {/* Hero attribution + page indicators */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[2] flex items-center justify-between px-5 sm:px-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/70 sm:text-xs">
          Now showing &middot; <span className="text-white">{current.caption}</span> &middot; {current.city}
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          {HERO_SLIDES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 24 : 6,
                background: i === idx ? "white" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Hidden honest count for crawlers — visible stats live in the strip below */}
      <span className="sr-only">
        Browse {churchCountLabel} churches.
      </span>
    </section>
  );
}
