import { SectionHeader } from "@/components/SectionHeader";
import type { ChurchTopSong } from "@/lib/church";

type ChurchSongsListProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  songs: ChurchTopSong[];
  chartHref: string;
};

/**
 * "What they sing" — the church's most-adopted worship songs, from the
 * playlist.church corpus (church_songs, synced by the playlists repo).
 * Presentational only; renders nothing when the list is empty.
 */
export function ChurchSongsList({ eyebrow, title, subtitle, songs, chartHref }: ChurchSongsListProps) {
  if (songs.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/50 p-5 shadow-sm sm:p-8">
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <ol className="divide-y divide-rose-100 rounded-2xl border border-rose-200/70 bg-white/85 shadow-sm">
        {songs.map((song) => (
          <li key={song.rank} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
            <span className="w-6 shrink-0 text-center font-serif text-lg font-semibold text-rose-gold-deep">
              {song.rank}
            </span>
            {song.artUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={song.artUrl}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                className="h-12 w-12 shrink-0 rounded-lg border border-rose-100 object-cover"
              />
            ) : (
              <span className="h-12 w-12 shrink-0 rounded-lg border border-rose-100 bg-blush-light" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <a
                href={song.playlistChurchUrl}
                target="_blank"
                rel="noopener"
                className="block truncate font-serif text-base font-semibold text-espresso hover:text-rose-gold-deep"
              >
                {song.title}
              </a>
              <p className="truncate text-xs text-muted-warm">{song.artistName}</p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-blush-light px-2.5 py-1 text-[11px] font-semibold text-rose-gold-deep sm:inline-flex">
              sung by {song.adoptionCount} churches
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-sm">
        <a
          href={chartHref}
          target="_blank"
          rel="noopener"
          className="font-semibold text-rose-gold-deep hover:underline"
        >
          See the full chart on playlist.church →
        </a>
      </p>
    </section>
  );
}
