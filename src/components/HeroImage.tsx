"use client";

import { useState } from "react";

export function HeroImage({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
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
