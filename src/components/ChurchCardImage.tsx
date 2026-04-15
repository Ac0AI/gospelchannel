"use client";

import { useState } from "react";
import { cfImage } from "@/lib/media";

type ChurchCardImageProps = {
  initials: string;
  gradient: string;
  thumbnailUrl?: string;
  logoUrl?: string;
};

// Card image is h-28 (112px) × variable width up to ~348px in the widest layout.
// We request a 2x raster (700×224) so both mobile and desktop get crisp delivery.
const CARD_IMG_WIDTH = 700;
const CARD_IMG_HEIGHT = 224;

export function ChurchCardImage({ initials, gradient, thumbnailUrl, logoUrl }: ChurchCardImageProps) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(thumbnailUrl || logoUrl);
  const showImage = Boolean(imageUrl);
  const isThumbnail = Boolean(thumbnailUrl) && imageUrl === thumbnailUrl;

  function handleError() {
    if (imageUrl === thumbnailUrl && logoUrl && logoUrl !== thumbnailUrl) {
      setImageUrl(logoUrl);
      return;
    }
    setImageUrl(undefined);
  }

  const optimizedSrc = showImage && imageUrl
    ? (isThumbnail
        ? cfImage(imageUrl, { width: CARD_IMG_WIDTH, height: CARD_IMG_HEIGHT, fit: "cover", format: "auto", quality: 78 })
        : cfImage(imageUrl, { width: CARD_IMG_WIDTH, fit: "contain", format: "auto", quality: 80 }))
    : undefined;

  return (
    <div className={`relative h-28 overflow-hidden rounded-xl ${showImage ? "" : `flex items-center justify-center bg-gradient-to-br ${gradient}`}`}>
      {showImage && optimizedSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={optimizedSrc}
            width={CARD_IMG_WIDTH}
            height={CARD_IMG_HEIGHT}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            onError={handleError}
            className={`absolute inset-0 h-full w-full ${isThumbnail ? "object-cover" : "object-contain p-4"} transition duration-500 group-hover:scale-105`}
          />
          {isThumbnail ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-espresso/50 to-transparent" />
              <span className="absolute bottom-2 left-3 text-lg font-bold tracking-wide text-white drop-shadow-sm">
                {initials}
              </span>
            </>
          ) : null}
        </>
      ) : (
        <>
          <svg className="absolute right-3 top-3 h-8 w-8 text-espresso/[0.06]" viewBox="0 0 24 24" fill="currentColor">
            <rect x="10.5" y="2" width="3" height="20" rx="1.5" />
            <rect x="4" y="7.5" width="16" height="3" rx="1.5" />
          </svg>
          <span className="relative text-3xl font-bold tracking-wide text-white drop-shadow-sm">
            {initials}
          </span>
        </>
      )}
    </div>
  );
}
