# Data Source Of Truth

## Canonical data

- `churches` is the canonical source for approved church records and explicit Spotify fields:
  - `spotify_url`
  - `spotify_playlist_ids`
  - `additional_playlists`
  - `spotify_playlists`
- `church_networks` and `church_campuses` are the canonical source for network and campus pages.
- Campus pages can inherit music from their parent church at read time in [src/lib/church.ts](../src/lib/church.ts).

## Snapshot and fallback

- `src/data/churches.json` is an offline/build fallback, not the write source.
- The live D1 directory is much larger, so exact slug parity is intentionally not required.
- Keep exports private and review them for personal data before publishing a fallback. The legacy Postgres export scripts are archived and must not be used against the live D1 database.

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

- Write approved church data to D1 first.
- Keep fallback rows valid, but do not regenerate the full snapshot after every approved church update.
- Do not count `src/data/churches.json` alone when the question is about public pages; campuses live outside that snapshot.
- For Google indexing, use `sitemap.xml` as the canonical public URL list. `scripts/push-to-google.mjs` preserves the old queue order first, then appends any extra sitemap URLs so existing checkpoints remain valid.

## Scheduled writes

- Gospel's Spotify enrichment and directory reconciliation jobs write to D1.
- The playlist.church pipeline reads D1 and atomically replaces `church_songs`.
- Local image mirroring uses the existing Wrangler login through
  `scripts/with-d1-wrangler-auth.mjs`.
- Historical Postgres backfills must be ported and checked before reuse; do not
  restore a legacy database URL to an active scheduled job.

## Verification

- Run `pnpm churches:check` to verify live directory invariants and confirm that every fallback slug still resolves to an approved D1 row.
- If the check reports fallback rows that are no longer approved, review the sample and run `pnpm churches:check -- --fix-fallback` to prune only those stale rows.
