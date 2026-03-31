"use client";

import { useState } from "react";
import { cfImage } from "@/lib/media";

const HERO_WIDTHS = [640, 960, 1280, 1920] as const;

export function HeroImage({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) return null;

  const srcSet = HERO_WIDTHS
    .map((w) => `${cfImage(src, { width: w, quality: 75 })} ${w}w`)
    .join(", ");

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cfImage(src, { width: 1280, quality: 75 })}
      srcSet={srcSet}
      sizes="100vw"
      alt=""
      aria-hidden="true"
      loading="eager"
      fetchPriority="high"
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
