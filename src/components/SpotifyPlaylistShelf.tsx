import { SectionHeader } from "@/components/SectionHeader";
import { SpotifyEmbedCard } from "@/components/SpotifyEmbedCard";

type SpotifyPlaylistItem = {
  playlistId: string;
  title: string;
  subtitle?: string;
  description?: string;
  tag?: string;
  href?: string;
};

type SpotifyPlaylistShelfProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: SpotifyPlaylistItem[];
  compact?: boolean;
};

export function SpotifyPlaylistShelf({
  eyebrow,
  title,
  subtitle,
  items,
  compact = true,
}: SpotifyPlaylistShelfProps) {
  if (items.length === 0) {
    return null;
  }

  const featured = items.slice(0, 3);
  const remainder = items.slice(3);

  return (
    <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/50 p-5 shadow-sm sm:p-8">
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <div className="scrollbar-hide -mx-5 flex gap-4 overflow-x-auto px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-3" style={{ scrollSnapType: "x mandatory" }}>
        {featured.map((item) => (
          <article
            key={item.playlistId}
            className="w-[280px] shrink-0 overflow-hidden rounded-2xl border border-rose-200/70 bg-white/85 shadow-sm lg:w-auto"
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="flex items-center justify-between border-b border-rose-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mauve">Spotify Playlist</p>
                <h3 className="font-serif text-lg font-semibold text-espresso">{item.title}</h3>
                {item.subtitle ? <p className="text-xs text-muted-warm">{item.subtitle}</p> : null}
                {item.description ? (
                  <p className="mt-2 line-clamp-2 max-w-xs text-sm leading-relaxed text-warm-brown">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 pl-4">
                {item.tag ? (
                  <span className="mb-2 inline-flex rounded-full bg-blush-light px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-gold-deep">
                    {item.tag}
                  </span>
                ) : null}
                <a
                  href={item.href ?? `https://open.spotify.com/playlist/${item.playlistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-full border border-blush px-4 py-2 text-xs font-semibold text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso"
                >
                  Open ↗
                </a>
              </div>
            </div>

            <SpotifyEmbedCard
              playlistId={item.playlistId}
              title={item.title}
              height={compact ? 152 : 352}
              compact={compact}
            />
          </article>
        ))}
      </div>

      {remainder.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-rose-200/70 bg-white/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mauve">
            More In This Collection
          </p>
          <div className="mt-3 divide-y divide-rose-100">
            {remainder.map((item) => (
              <div key={item.playlistId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-espresso">{item.title}</p>
                  {item.subtitle ? <p className="truncate text-xs text-muted-warm">{item.subtitle}</p> : null}
                </div>
                <a
                  href={item.href ?? `https://open.spotify.com/playlist/${item.playlistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full border border-blush px-4 py-2 text-xs font-semibold text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso"
                >
                  Open ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
