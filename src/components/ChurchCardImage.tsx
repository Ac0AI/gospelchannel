import { cfImage } from "@/lib/media";

type ChurchCardImageProps = {
  name: string;
  initials: string;
  gradient: string;
  mediaUrl?: string;
  isThumbnail: boolean;
};

const CARD_WIDTHS = [320, 480, 640] as const;

export function ChurchCardImage({ name, initials, gradient, mediaUrl, isThumbnail }: ChurchCardImageProps) {
  const showImage = Boolean(mediaUrl);

  const src = showImage ? cfImage(mediaUrl!, { width: 480, height: 212, quality: 70 }) : undefined;
  const srcSet = showImage
    ? CARD_WIDTHS.map((w) => `${cfImage(mediaUrl!, { width: w, height: Math.round(w * 0.44), quality: 70 })} ${w}w`).join(", ")
    : undefined;

  return (
    <div className={`relative h-28 overflow-hidden rounded-xl ${showImage ? "" : `flex items-center justify-center bg-gradient-to-br ${gradient}`}`}>
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            srcSet={srcSet}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            alt={`${name} worship`}
            loading="lazy"
            decoding="async"
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
