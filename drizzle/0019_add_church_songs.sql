-- Top worship songs per church, synced wholesale from the playlist.church corpus
-- (playlists repo: pipeline/src/sync-to-gospel.mjs). Gospel reads only; playlists
-- replaces all rows per sync inside one transaction.
CREATE TABLE IF NOT EXISTS church_songs (
  church_slug         text NOT NULL REFERENCES churches(slug) ON DELETE CASCADE,
  rank                integer NOT NULL,
  title               text NOT NULL,
  artist_name         text NOT NULL,
  art_url             text,
  adoption_count      integer NOT NULL DEFAULT 0,
  spotify_track_id    text,
  playlist_church_url text NOT NULL,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (church_slug, rank)
);
