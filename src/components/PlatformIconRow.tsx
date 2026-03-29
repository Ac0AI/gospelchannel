type PlatformIconRowProps = {
  spotifyUrl?: string;
  appleMusicUrl: string;
  youtubeMusicUrl: string;
  churchWebsite?: string;
};

const icons = {
  spotify: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  ),
  appleMusic: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043A5.022 5.022 0 0 0 19.7.195C18.98.066 18.246.015 17.512.003 17.393.001 17.273 0 17.152 0H6.847c-.166 0-.333.001-.498.005-.73.012-1.463.063-2.18.192A5.02 5.02 0 0 0 2.3.88C1.183 1.612.437 2.613.12 3.924a9.23 9.23 0 0 0-.24 2.19C-.074 6.813-.083 7.51-.083 8.21v7.58c0 .7.009 1.398.063 2.096.041.732.125 1.46.24 2.19.318 1.31 1.063 2.31 2.18 3.043.538.354 1.13.586 1.77.72.717.128 1.45.178 2.18.19.166.004.332.005.498.005h10.306c.166 0 .334-.001.5-.005.73-.012 1.462-.062 2.18-.19a5.02 5.02 0 0 0 1.77-.72c1.117-.733 1.862-1.733 2.18-3.043a9.23 9.23 0 0 0 .24-2.19c.054-.698.063-1.396.063-2.096V8.21c0-.7-.009-1.397-.063-2.086zM16.95 16.61a.625.625 0 0 1-.238.04.636.636 0 0 1-.591-.393l-.007-.014-1.068-2.553h-6.09l-1.068 2.553a.636.636 0 0 1-.591.407.625.625 0 0 1-.238-.046.625.625 0 0 1-.353-.814l4.368-10.473a.636.636 0 0 1 1.174 0l4.368 10.473a.644.644 0 0 1-.02.485.625.625 0 0 1-.334.335h-.002v-.001zM12 6.834l2.548 6.108h-5.1L12 6.835v-.001z" />
    </svg>
  ),
  youtubeMusic: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228 18.228 15.432 18.228 12 15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

export function PlatformIconRow({ spotifyUrl, appleMusicUrl, youtubeMusicUrl, churchWebsite }: PlatformIconRowProps) {
  const platforms = [
    spotifyUrl
      ? {
          key: "spotify",
          href: spotifyUrl,
          icon: icons.spotify,
          label: "Open on Spotify",
          shortLabel: "Spotify",
          className: "border-transparent bg-[#1DB954] text-white hover:bg-[#179c46]",
        }
      : null,
    {
      key: "apple-music",
      href: appleMusicUrl,
      icon: icons.appleMusic,
      label: "Search on Apple Music",
      shortLabel: "Apple Music",
      className: "border-rose-200 bg-white text-espresso hover:bg-blush-light",
    },
    {
      key: "youtube-music",
      href: youtubeMusicUrl,
      icon: icons.youtubeMusic,
      label: "Search on YouTube Music",
      shortLabel: "YouTube",
      className: "border-rose-200 bg-white text-espresso hover:bg-blush-light",
    },
    churchWebsite
      ? {
          key: "website",
          href: churchWebsite,
          icon: icons.website,
          label: "Church Website",
          shortLabel: "Website",
          className: "border-rose-200 bg-white text-espresso hover:bg-blush-light",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    href: string;
    icon: React.ReactNode;
    label: string;
    shortLabel: string;
    className: string;
  }>;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {platforms.map((p) => (
        <a
          key={p.key}
          href={p.href}
          target="_blank"
          rel="noreferrer"
          title={p.label}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${p.className}`}
        >
          {p.icon}
          <span>{p.shortLabel}</span>
        </a>
      ))}
    </div>
  );
}
