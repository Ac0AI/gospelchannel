"use client";

import { useState } from "react";

type ChurchCardImageProps = {
  initials: string;
  gradient: string;
  thumbnailUrl?: string;
  logoUrl?: string;
};

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

  return (
    <div className={`relative h-28 overflow-hidden rounded-xl ${showImage ? "" : `flex items-center justify-center bg-gradient-to-br ${gradient}`}`}>
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
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
