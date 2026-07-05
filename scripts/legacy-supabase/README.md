# Legacy Supabase scripts (archived 2026-07-05)

Dead since the Neon migration: everything here connects to the old Supabase
project via NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY, which is no longer
the source of truth (docs/data-source-of-truth.md: Neon public.churches is
canonical). Kept for reference only — do not run against production.

Spotify playlist EXPANSION (reading what's inside playlists) now lives in the
playlists repo (playlist.church), which writes per-church top songs back into
Neon church_songs. Discovery of NEW churches still belongs in this repo, but
any revival of these scripts should target Neon directly.
