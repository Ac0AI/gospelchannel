# GospelChannel.com

Helping people find their way to the Lord - or just explore worship all over the world.

Curated gospel and worship discovery platform built with Next.js 16, OpenNext on Cloudflare Workers, Neon, Spotify, and YouTube.

> Solo-maintained project, and my first open source project. This repository is public so people can report bugs, suggest improvements, and send small focused pull requests. I am still learning the open source side of things, so patience and clarity help a lot.

## Status

- Production site: `https://gospelchannel.com`
- Contributor language: English or Swedish is fine
- Project direction is maintainer-led

## What the app does

- Browse curated church, worship, and gospel music content
- Explore church pages with Spotify embeds and YouTube video grids
- Submit church suggestions and ownership claims
- Run scheduled content refresh jobs
- Generate SEO assets such as `sitemap.xml`, `robots.txt`, and structured data

## Stack

- Next.js 16 (App Router)
- OpenNext + Cloudflare Workers
- Neon Postgres + Drizzle
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
npm install
cp .env.example .env.local
npm run dev
```

Helpful commands:

```bash
npm run lint
npm run build
npm run smoke
npm run check:env
```

## Database (Neon)

This project uses [Neon](https://neon.tech) serverless Postgres with Drizzle ORM.

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the connection strings into `.env.local`:
   - `DATABASE_URL` - pooled connection string
   - `DATABASE_URL_UNPOOLED` - direct connection (used by Drizzle migrations)
3. Run migrations:
   ```bash
   npx drizzle-kit push
   ```

## Environment variables

You do not need every external integration to read the code or work on docs and UI.

Typical local development:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEDIA_BASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `DATABASE_URL`

Needed for specific integrations and production-like flows:

- `YOUTUBE_API_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `APIFY_TOKEN`
- `ANTHROPIC_API_KEY`
- `BREVO_API_KEY`
- `ADMIN_EMAILS`
- `CRON_SECRET`

Notes:

- `npm run build` uses offline mode for the content pipeline.
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
npm run deploy
```

## Project notes

- Spotify can require Extended Quota Mode for some external playlist access.
- The app has manual data fallbacks in `src/data/manual/` for cases where API data is limited or unavailable.

## License

MIT. See `LICENSE`.
