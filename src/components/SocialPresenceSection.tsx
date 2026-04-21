import type { ChurchEnrichment } from "@/types/gospel";

type SocialPresenceProps = {
  enrichment: ChurchEnrichment;
  spotifyPlaylistCount: number;
  youtubeVideoCount: number;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

type PlatformCard = {
  id: string;
  name: string;
  url: string;
  count?: number;
  countLabel: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
};

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

export function SocialPresenceSection({
  enrichment,
  spotifyPlaylistCount,
  youtubeVideoCount,
}: SocialPresenceProps) {
  const platforms: PlatformCard[] = [];

  if (enrichment.youtubeUrl) {
    platforms.push({
      id: "youtube",
      name: "YouTube",
      url: enrichment.youtubeUrl,
      count: enrichment.youtubeSubscribers,
      countLabel: "subscribers",
      icon: <YouTubeIcon />,
      accentColor: "text-red-600",
      accentBg: "bg-red-50",
      accentBorder: "border-red-200/60",
    });
  }

  if (enrichment.instagramUrl) {
    platforms.push({
      id: "instagram",
      name: "Instagram",
      url: enrichment.instagramUrl,
      count: enrichment.instagramFollowers,
      countLabel: "followers",
      icon: <InstagramIcon />,
      accentColor: "text-pink-600",
      accentBg: "bg-pink-50",
      accentBorder: "border-pink-200/60",
    });
  }

  if (enrichment.facebookUrl) {
    platforms.push({
      id: "facebook",
      name: "Facebook",
      url: enrichment.facebookUrl,
      count: enrichment.facebookFollowers,
      countLabel: "followers",
      icon: <FacebookIcon />,
      accentColor: "text-blue-600",
      accentBg: "bg-blue-50",
      accentBorder: "border-blue-200/60",
    });
  }

  // Spotify and website are already shown elsewhere on the page (embed + platform links),
  // so we only include them here when there are follower stats to display.
  if (spotifyPlaylistCount > 0 && (enrichment.youtubeSubscribers || enrichment.instagramFollowers || enrichment.facebookFollowers)) {
    platforms.push({
      id: "spotify",
      name: "Spotify",
      url: "#spotify-playlists",
      count: spotifyPlaylistCount,
      countLabel: spotifyPlaylistCount === 1 ? "playlist" : "playlists",
      icon: <SpotifyIcon />,
      accentColor: "text-green-600",
      accentBg: "bg-green-50",
      accentBorder: "border-green-200/60",
    });
  }

  // Only show the section if there are at least 2 social platforms,
  // or 1 platform with follower stats. A single link without stats
  // looks too thin for its own section.
  const socialPlatforms = platforms.filter((p) =>
    p.id === "youtube" || p.id === "instagram" || p.id === "facebook"
  );
  const hasStats = socialPlatforms.some((p) => p.count != null);
  if (socialPlatforms.length === 0) return null;
  if (socialPlatforms.length === 1 && !hasStats) return null;

  // Total reach for the header
  const totalFollowers =
    (enrichment.youtubeSubscribers ?? 0) +
    (enrichment.instagramFollowers ?? 0) +
    (enrichment.facebookFollowers ?? 0);

  const hasAnyStats = totalFollowers > 0 || spotifyPlaylistCount > 0;

  // Two layout modes:
  // - "rich": at least one platform has follower counts — show big stat cards
  // - "compact": no stats at all — show clean horizontal link pills
  if (!hasAnyStats) {
    return (
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-gold">
          Connect
        </p>
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <a
              key={platform.id}
              href={platform.url}
              target={platform.url.startsWith("#") ? undefined : "_blank"}
              rel={platform.url.startsWith("#") ? undefined : "noreferrer"}
              className={`
                group inline-flex items-center gap-2 rounded-full border
                ${platform.accentBorder} bg-white
                px-4 py-2.5 transition-all duration-200
                hover:-translate-y-0.5 hover:shadow-md
              `}
            >
              <div className={platform.accentColor}>
                {platform.icon}
              </div>
              <span className="text-sm font-semibold text-espresso">
                {platform.name}
              </span>
              <svg className={`h-3.5 w-3.5 ${platform.accentColor} opacity-40 transition-opacity group-hover:opacity-100`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-gold">
            Connect
          </p>
          <h2 className="font-serif text-xl font-bold text-espresso sm:text-2xl">
            Where to find them
          </h2>
        </div>
        {totalFollowers > 0 && (
          <p className="hidden text-right text-sm text-muted-warm sm:block">
            <span className="font-bold text-espresso">{formatCount(totalFollowers)}</span>{" "}
            across platforms
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        {platforms.map((platform, i) => {
          const hasCount = platform.count != null;

          return (
            <a
              key={platform.id}
              href={platform.url}
              target={platform.url.startsWith("#") ? undefined : "_blank"}
              rel={platform.url.startsWith("#") ? undefined : "noreferrer"}
              className={`
                group relative overflow-hidden rounded-2xl border
                ${platform.accentBorder} ${platform.accentBg}
                transition-all duration-300 ease-out
                hover:-translate-y-0.5 hover:shadow-lg
                ${hasCount
                  ? "flex flex-col gap-3 px-4 py-4 sm:min-w-[160px] sm:flex-1"
                  : "flex items-center gap-2.5 px-4 py-3 sm:flex-initial"
                }
              `}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Platform icon + name */}
              <div className="flex items-center gap-2.5">
                <div className={`${platform.accentColor} transition-transform duration-300 group-hover:scale-110`}>
                  {platform.icon}
                </div>
                <span className="text-sm font-semibold text-espresso">
                  {platform.name}
                </span>
              </div>

              {/* Count — only when data exists */}
              {hasCount && (
                <div>
                  <span className="text-2xl font-black leading-none tracking-tight text-espresso sm:text-3xl">
                    {formatCount(platform.count!)}
                  </span>
                  <span className="ml-1.5 text-xs font-medium text-muted-warm">
                    {platform.countLabel}
                  </span>
                </div>
              )}

              {/* Subtle hover arrow */}
              <div className={`
                ${hasCount ? "absolute right-3 top-3" : "ml-auto"}
                translate-x-1 opacity-0 transition-all duration-300
                group-hover:translate-x-0 group-hover:opacity-100
              `}>
                <svg className={`h-3.5 w-3.5 ${platform.accentColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </div>
            </a>
          );
        })}
      </div>

      {/* Videos count footnote if relevant */}
      {youtubeVideoCount > 0 && !enrichment.youtubeUrl && (
        <p className="text-xs text-muted-warm">
          {youtubeVideoCount} worship {youtubeVideoCount === 1 ? "video" : "videos"} available below
        </p>
      )}
    </section>
  );
}
