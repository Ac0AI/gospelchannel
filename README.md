# GospelChannel — The Church Guide

Find the right church before your first visit.

Free global church guide with worship-aware profiles, built with Next.js 16, OpenNext on Cloudflare Workers, Cloudflare D1, Spotify, and YouTube.

> Solo-maintained project, and my first open source project. This repository is public so people can report bugs, suggest improvements, and send small focused pull requests. I am still learning the open source side of things, so patience and clarity help a lot.

## Status

- Production site: `https://gospelchannel.com`
- Contributor language: English or Swedish is fine
- Project direction is maintainer-led

## What the app does

- Find and compare churches by location, tradition, language, worship style, and service details
- Browse curated worship and gospel music connected to church profiles
- Explore church pages with Spotify embeds and YouTube video grids
- Submit church suggestions and ownership claims
- Run scheduled content refresh jobs
- Generate SEO assets such as `sitemap.xml`, `robots.txt`, and structured data

## Stack

- Next.js 16 (App Router)
- OpenNext + Cloudflare Workers
- Cloudflare D1 + Drizzle
- Better Auth
- Spotify Web API
- YouTube Data API
- Cloudflare R2 for media
- PostHog for analytics

## Local setup

Prerequisites:

- Node 22.x
- npm

If you use `nvm`, run:

```bash
nvm use
```

Install and start:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Helpful commands:

```bash
pnpm lint
pnpm build
pnpm smoke
pnpm check:env
```

## Database (Cloudflare D1)

Cloudflare D1 is the canonical database. The Worker uses the `GOSPEL_D1`
binding in `wrangler.jsonc`; it does not need a database URL or API token.
Local development uses an isolated local D1 database by default.

```bash
pnpm db:migrate:local
pnpm dev
```

Node maintenance jobs use `GOSPEL_D1_DATABASE_ID`, `CLOUDFLARE_ACCOUNT_ID`,
and `GOSPEL_D1_API_TOKEN` (or the existing `CLOUDFLARE_API_TOKEN`). The token
needs Account / D1 / Edit for jobs that write. Missing credentials fail closed.
For local jobs, an existing `wrangler login` can supply a refreshed token
without saving a second secret:

```bash
node scripts/with-d1-wrangler-auth.mjs node scripts/check-d1-access.mjs
```

Create a versioned SQL migration with `pnpm db:new-migration -- descriptive_name`,
keep the Drizzle models in `src/db/d1-schema` in sync, and apply with
`pnpm db:migrate` after checking the configured remote database. Production
imports must apply `0000_initial.sql`, load data, then apply the remaining
migrations so derived search triggers do not rewrite imported source rows.

All active maintenance/import scripts use D1, including the Supabase-export
importer. Node scripts use the same D1 account, database ID and token as scheduled
jobs; there is no Postgres driver or fallback. Run local commands through
`with-d1-wrangler-auth.mjs` when using the Wrangler login. Use `pnpm exec tsx`
for scripts which import TypeScript modules.

After a schema change, regenerate the Node field codecs with
`pnpm db:script-types`; the test suite checks that they match the Drizzle schema.
Live integration tests require `GOSPEL_D1_VERIFY_REMOTE=1` in addition to D1
credentials, so ordinary tests never query production implicitly.

## Environment variables

You do not need every external integration to read the code or work on docs and UI.

Typical local development:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEDIA_BASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- Local D1 initialized with `pnpm db:migrate:local`

Needed for specific integrations and production-like flows:

- `YOUTUBE_API_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `APIFY_TOKEN`
- `ANTHROPIC_API_KEY`
- `BREVO_API_KEY`
- `CRON_SECRET`

Admin access is database-backed.
Promote an account to admin with:

```bash
pnpm db:seed -- --emails=you@example.com
```

Notes:

- `pnpm build` uses offline mode for the content pipeline.
- Full admin, mail, sync, and deployment flows need real service credentials.
- Keep secrets in `.env.local`. Do not commit them.

## Contributing

Ideas, bug reports, and small PRs are welcome.

If you want to help, the easiest path is:

- open an issue
- keep the idea or fix small
- explain the problem in plain language

Best ways to help:

- Open an issue for bugs or feature ideas
- Send focused PRs that solve one problem at a time
- Include screenshots when changing UI
- Update docs if behavior changes

See `CONTRIBUTING.md` for the short version of how this repo is run.

## Security

Please do not post security issues publicly. See `SECURITY.md`.

## Deployment

The production app is deployed on Cloudflare Workers via OpenNext.
Contributors usually do not need deployment access.

Maintainer deploy command:

```bash
pnpm deploy
```

## Project notes

- Spotify can require Extended Quota Mode for some external playlist access.
- The app has manual data fallbacks in `src/data/manual/` for cases where API data is limited or unavailable.

## License

MIT. See `LICENSE`.
