# Data Source Of Truth

## Canonical data

- `public.churches` is the canonical source for approved church records and explicit Spotify fields:
  - `spotify_url`
  - `spotify_playlist_ids`
  - `additional_playlists`
  - `spotify_playlists`
- `public.church_networks` and `public.church_campuses` are the canonical source for network and campus pages.
- Campus pages can inherit music from their parent church at read time in [src/lib/church.ts](../src/lib/church.ts).

## Snapshot and fallback

- `src/data/churches.json` is a generated snapshot of approved rows from `public.churches`.
- It is a build/export artifact and local fallback, not the write source.
- Generate it from Neon with:
  - `npm run churches:reconcile`
  - or `node scripts/generate-churches-json.mjs`

## Public page model

- "Approved church with explicit playlists" means an approved `churches` row with `spotify_playlist_ids` or `additional_playlists`.
- "Public church page with playlists" includes:
  - approved church pages with explicit playlists
  - published campus pages whose parent church has playlist data
- This distinction matters for SEO, sitemap, and GSC counts.

## Non-canonical tables and caches

- `church_candidates` is intake/backlog data, not public truth.
- `church_feedback` and `church_suggestions` are user-submitted backlog, not public truth.
- `src/data/cache/church-candidate-screening.json` is screening/cache output, not public truth.
- `src/data/manual/*.json` is manual research input, not the deployed catalog source after import/reconcile.

## Operational rules

- Write approved church data to Neon first.
- Regenerate `src/data/churches.json` after approved church updates.
- Do not count `src/data/churches.json` alone when the question is about public pages; campuses live outside that snapshot.
- For Google indexing, use `sitemap.xml` as the canonical public URL list. `scripts/push-to-google.mjs` preserves the old queue order first, then appends any extra sitemap URLs so existing checkpoints remain valid.

## Playlist backfill flow

- `scripts/backfill-website-playlists.mjs` is the deterministic backfill path for explicit playlist fields.
- It only promotes playlist URLs that were already discovered in `src/data/cache/church-candidate-screening.json`.
- It writes only to approved rows in `public.churches` that do not already have explicit playlist fields.
- After a successful backfill run:
  - regenerate `src/data/churches.json`
  - run `npm run churches:audit`

## Verification

- Run `npm run churches:check` to verify approved church slug parity between Neon and `src/data/churches.json`.
- Run `npm run churches:audit` to verify:
  - slug parity
  - playlist field parity
  - explicit playlist counts on approved churches
  - inherited playlist reach across campuses
