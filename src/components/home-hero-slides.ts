// Kept out of HomeHero ("use client") so the server-rendered home page can
// preload the first slide, which is the page's LCP element.
export const HERO_SLIDES = [
  {
    avif: "/hero/worship-arena.avif",
    webp: "/hero/worship-arena.webp",
  },
  {
    avif: "/hero/intimate-worship.avif",
    webp: "/hero/intimate-worship.webp",
  },
  {
    avif: "/hero/outdoor-gathering.avif",
    webp: "/hero/outdoor-gathering.webp",
  },
] as const;
