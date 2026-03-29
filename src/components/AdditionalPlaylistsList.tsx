"use client";

import { useState } from "react";

type Playlist = {
  playlistId: string;
  title: string;
  href: string;
};

type AdditionalPlaylistsListProps = {
  playlists: Playlist[];
  churchName: string;
};

function SpotifyLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="#1DB954" width="20" height="20" className="shrink-0">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

export function AdditionalPlaylistsList({ playlists, churchName }: AdditionalPlaylistsListProps) {
  const [expanded, setExpanded] = useState(false);

  if (playlists.length === 0) return null;

  const visible = expanded ? playlists : playlists.slice(0, 4);
  const hasMore = playlists.length > 4;

  return (
    <section className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">More Playlists</p>
      <h3 className="mt-2 font-serif text-xl font-semibold text-espresso">
        {churchName} Playlist Collection
      </h3>

      <div className="mt-4 divide-y divide-rose-100">
        {visible.map((playlist) => (
          <div key={playlist.playlistId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm font-medium text-warm-brown truncate">{playlist.title}</span>
            <a
              href={playlist.href}
              target="_blank"
              rel="noreferrer"
              title={`Open "${playlist.title}" on Spotify`}
              className="transition-transform hover:scale-110"
            >
              <SpotifyLinkIcon />
            </a>
          </div>
        ))}
      </div>

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 text-sm font-semibold text-rose-gold transition-colors hover:text-rose-gold-deep"
        >
          Show all {playlists.length} playlists
        </button>
      )}
    </section>
  );
}
