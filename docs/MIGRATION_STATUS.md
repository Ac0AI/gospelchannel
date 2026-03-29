# Gospelmigration Status

Last updated: 2026-03-29

## Workspace
- Active repo: `/Users/dpr/Desktop/Egna Appar/Projekt/Gospelmigration`
- Deploy model: direct local deploy to Cloudflare via `wrangler` / `opennextjs-cloudflare`
- Live URLs:
  - `https://gospelchannel.com`
  - `https://www.gospelchannel.com`
- Latest deployed Worker version: `9752047f-e1d9-4a8a-8588-452fffc57596`

## Current platform state
- Cloudflare zone `gospelchannel.com` is active.
- Live traffic is routed through Workers Routes:
  - `gospelchannel.com/*`
  - `www.gospelchannel.com/*`
- Neon is the active runtime database.
- Better Auth is the active auth layer.
- R2 buckets exist:
  - `church-assets`
  - `church-assets-preview`
- `media.gospelchannel.com` resolves and serves objects from R2.

## Verified working
- Public root routes return `200` and include `x-opennext: 1`:
  - `/`
  - `/church`
  - representative `/church/[slug]`
- Root church page verification:
  - `https://gospelchannel.com/church/wearechurch` returned `200`
  - response headers included `x-opennext: 1`
  - response body had no `supabase.co/storage` references
- Admin login works.
- Claim verification flow is green:
  - `POST /api/church/claim`
  - admin sign-in
  - `POST /api/admin/claims/verify`
  - membership creation in Neon
  - `POST /api/church-admin/access-code`
  - `POST /api/auth/email-otp/send-verification-otp`
- Church-admin write flow is green:
  - OTP sign-in
  - `POST /api/church/upload-logo` to R2
  - `POST /api/church/profile`
## Runtime data status
- Neon table counts previously verified:
  - `churches`: `3231`
  - `church_enrichments`: `3113`
  - `church_claims`: `5`
  - `church_memberships`: `2`
  - `prayers`: `110`
  - Better Auth tables are active in Neon (`user`, `session`, `account`, `verification`)
- Media fields in Neon were already free of Supabase Storage URLs before cutover.

## Media migration status
- Full legacy media backfill to R2 completed.
- Final backfill session completed successfully:
  - `uploaded`: `1072`
  - `failed`: `0`
- Snapshot rewrite completed:
  - file: `src/data/churches.json`
  - rewritten `headerImage` URLs: `1687`
- Current snapshot state:
  - `src/data/churches.json` contains no `supabase.co/storage` references
  - all rewritten snapshot media points at `https://media.gospelchannel.com/...`
- Sample R2 object check:
  - `https://media.gospelchannel.com/heroes/wearechurch.jpg` returns `200`

## Supabase shutdown status
- Supabase Storage is no longer needed by the live runtime.
- Live web traffic no longer depends on Vercel hosting.
- Structured runtime data no longer depends on Supabase Postgres.
- Remaining Supabase references in the repo are legacy/operations code only:
  - export/import helpers
  - older research/enrichment scripts
  - compatibility-layer filenames such as `src/lib/supabase.ts`
- Those legacy scripts can be cleaned up later, but they are not part of the live production path.

## Useful commands
- Deploy current build:
  - `npx wrangler deploy --config wrangler.jsonc`
- Media backfill script:
  - `npm run media:backfill`
- Media rewrite only:
  - `npm run media:backfill -- --rewrite-snapshot --rewrite-only`

## Notes
- This directory is not a git repository right now.
- If another account needs to continue, start in this exact folder:
  - `/Users/dpr/Desktop/Egna Appar/Projekt/Gospelmigration`
- Root-domain routing was completed with Workers Routes instead of `custom_domain` on apex/`www`, because the imported DNS records already existed in the zone.
