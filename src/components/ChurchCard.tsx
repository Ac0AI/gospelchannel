import Link from "next/link";
import { ChurchCardFeedbackSheet } from "@/components/ChurchCardFeedbackSheet";
import { ChurchCardImage } from "@/components/ChurchCardImage";
import { relativeHoursFrom } from "@/lib/utils";
import {
  buildChurchCardMetaLabel,
  getValidServiceTimeLabel,
  normalizeDisplayText,
} from "@/lib/content-quality";

type ChurchCardProps = {
  slug: string;
  name: string;
  description: string;
  country: string;
  logoUrl?: string;
  playlistCount?: number;
  updatedAt?: string;
  musicStyle?: string[];
  thumbnailUrl?: string;
  showFeedback?: boolean;
  enrichmentLocation?: string;
  serviceTimes?: string;
  enrichmentSummary?: string;
};

const GRADIENTS = [
  "from-[#f5e6df] to-[#e8cfc2]",
  "from-[#f0ddd4] to-[#dfc0b0]",
  "from-[#f8ece6] to-[#e5d0c4]",
  "from-[#f2e0d6] to-[#ddc4b4]",
  "from-[#f6e8e0] to-[#e2c8ba]",
  "from-[#f4e2da] to-[#e0c6b8]",
  "from-[#f7ebe4] to-[#e6cec0]",
  "from-[#f3dfD5] to-[#ddc2b2]",
  "from-[#f5e4dc] to-[#e4c9bc]",
  "from-[#f8ede8] to-[#e7d2c6]",
];

function getInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function ChurchCard({
  slug,
  name,
  description,
  country,
  logoUrl,
  playlistCount,
  updatedAt,
  musicStyle,
  thumbnailUrl,
  showFeedback = true,
  enrichmentLocation,
  serviceTimes,
  enrichmentSummary,
}: ChurchCardProps) {
  const initials = getInitials(name);
  const gradient = getGradient(name);
  const style = musicStyle?.[0];
  const displayDescription = normalizeDisplayText(enrichmentSummary) || normalizeDisplayText(description) || "Church profile";
  const compactDescription = displayDescription.length > 128 ? `${displayDescription.slice(0, 125).trimEnd()}...` : displayDescription;
  const hasPlaylist = typeof playlistCount === "number" && playlistCount > 0;
  const normalizedServiceTimes = getValidServiceTimeLabel(serviceTimes);
  const metaLabel = buildChurchCardMetaLabel({
    location: enrichmentLocation,
    serviceTimes: normalizedServiceTimes,
    playlistCount,
    country,
  });
  const actionLabel = "Open church";
  const isVisitorFriendly = Boolean(normalizeDisplayText(enrichmentLocation) && normalizedServiceTimes);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-rose-200/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-rose-300 hover:shadow-md active:scale-[0.97] sm:hover:-translate-y-1">
      <Link href={`/church/${slug}`} prefetch={false} className="group flex flex-1 flex-col">
        <ChurchCardImage
          initials={initials}
          gradient={gradient}
          thumbnailUrl={thumbnailUrl}
          logoUrl={logoUrl}
        />

        <div className="flex flex-1 flex-col pt-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-blush-light px-2 py-0.5 text-xs font-semibold text-rose-gold-deep">
              {country}
            </span>
            {style ? (
              <span className="inline-flex items-center rounded-full border border-rose-200/60 px-2 py-0.5 text-xs font-medium text-muted-warm">
                {style}
              </span>
            ) : null}
            {isVisitorFriendly && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                Visitor-friendly
              </span>
            )}
          </div>
          <h3 className="line-clamp-2 font-serif text-base font-semibold text-espresso transition-colors group-hover:text-rose-gold sm:min-h-[3rem]">
            {name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-warm sm:min-h-[3.5rem]">{compactDescription}</p>
        </div>
      </Link>

      <div className="mt-auto border-t border-rose-200/50 pt-3">
        <p className="text-xs font-medium text-mauve">{metaLabel}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {hasPlaylist && (enrichmentLocation || serviceTimes) && (
              <span className="inline-flex rounded-full bg-blush-light px-2 py-0.5 text-[10px] font-semibold text-rose-gold">
                {playlistCount} {playlistCount === 1 ? "playlist" : "playlists"}
              </span>
            )}
            <p className="mt-1 hidden text-[11px] text-muted-warm sm:block">Updated {relativeHoursFrom(updatedAt)}</p>
          </div>
          <Link
            href={`/church/${slug}`}
            prefetch={false}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-rose-gold px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-gold-deep"
          >
            {actionLabel}
          </Link>
        </div>
        {showFeedback ? (
          <div className="mt-2">
            <ChurchCardFeedbackSheet churchSlug={slug} churchName={name} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
