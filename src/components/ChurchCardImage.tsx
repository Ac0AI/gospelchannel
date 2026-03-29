"use client";

import Image from "next/image";
import { useState } from "react";

type ChurchCardImageProps = {
  name: string;
  initials: string;
  gradient: string;
  mediaUrl?: string;
  isThumbnail: boolean;
};

export function ChurchCardImage({ name, initials, gradient, mediaUrl, isThumbnail }: ChurchCardImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = mediaUrl && !failed;

  return (
    <div className={`relative h-28 overflow-hidden rounded-xl ${showImage ? "" : `flex items-center justify-center bg-gradient-to-br ${gradient}`}`}>
      {showImage ? (
        <>
          <Image
            src={mediaUrl}
            alt={`${name} worship`}
            fill
            className={`${isThumbnail ? "object-cover" : "object-contain p-4"} transition duration-500 group-hover:scale-105`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            onError={() => setFailed(true)}
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
          {/* Decorative cross (same as loading spinner) */}
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
