# Legacy Supabase scripts (archived 2026-07-05)

Archived since the earlier database migrations: everything here connects to the old Supabase
project via NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY, which is no longer
the source of truth (docs/data-source-of-truth.md: D1 public.churches is
canonical). Kept for reference only — do not run against production.

Spotify playlist EXPANSION (reading what's inside playlists) now lives in the
playlists repo (playlist.church), which writes per-church top songs back into
D1 church_songs. Discovery of NEW churches still belongs in this repo, but
any revival of these scripts should target D1 directly.
