# GospelChannel.com

Kuraterad gospel-streamingportal byggd med Next.js 16, OpenNext på Cloudflare Workers, Neon, YouTube Data API och Spotify Web API.

## Node-version

Projektet ska köras på **Node 22.x**.

- Lokalt: kör `nvm use` om du har `nvm` installerat. Repo:t innehåller `.nvmrc`.
- Cloudflare/OpenNext-builden ska köras med `Node.js 22.x`. Nyare versioner kan ge build-fel med Next 16.

## Snabbstart

```bash
cd "/Users/dpr/Desktop/Egna Appar/Projekt/Gospelmigration"
nvm use
npm run setup
```

Detta gör följande automatiskt:
- skapar `.env.local` från `.env.example` (om den saknas)
- installerar dependencies
- kör `lint` och `build`

## Miljövariabler

Fyll i dessa i `.env.local`:
- `YOUTUBE_API_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `APIFY_TOKEN`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEDIA_BASE_URL`
- `CRON_SECRET`
- `ADMIN_EMAILS`

Valfritt:
- `BREVO_API_KEY` för att skicka e-post när en claim verifieras
- `RESEND_API_KEY` som alternativ mail-provider
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

Kontrollera att allt är ifyllt:

```bash
npm run check:env
```

## Lokala kommandon

```bash
npm run dev         # starta lokalt
npm run lint        # eslint
npm run build       # produktionsbuild
npm run check:data  # validera kyrk/kategori-data
npm run churches:check  # verifiera approved church slugs mellan Neon och snapshot
npm run churches:audit  # verifiera source-of-truth + playlist/campus-räkning
npm run backfill:website-playlists -- --preview  # previewa säkra playlist-backfills från screening-cache
npm run smoke       # starta dev-server + testa huvudrutter/API
npm run discover:global -- --preview
npm run screen:candidates -- --preview
```

`discover:global` kör en quality-first intake via Apify Google Search, dedupar mot både `churches.json` och befintliga `church_candidates`, verifierar officiell host och försöker fylla `website`, `country`, `location` och officiell `contact_email` innan den sparar.

`screen:candidates` granskar kandidatkön efter discovery och skriver `src/data/cache/church-candidate-screening.json` med verdicts, quality flags, header-bildsignal, officiell email och playlist-matchning för admin-review.

`backfill:website-playlists` promotar bara Spotify playlist-URL:er som redan hittats på kyrkans website/social-länkar i screening-cachen till explicita playlist-fält på approved rows i `public.churches`. Kör sedan `node scripts/generate-churches-json.mjs` och `npm run churches:audit`.

## Source of truth

- `public.churches` i Neon är canonical source för approved church-data och explicita Spotify-fält.
- `public.church_networks` + `public.church_campuses` i Neon är canonical source för network/campus-sidor.
- `src/data/churches.json` är en genererad snapshot/fallback, inte write source.
- `church_candidates`, `church_feedback`, `church_suggestions` och cache-filer under `src/data/cache/` är backlog eller arbetsdata, inte publik sanning.

Detaljer och driftregler finns i [docs/data-source-of-truth.md](docs/data-source-of-truth.md).

## Funktioner som finns implementerade

- Hemsida med sektioner: Most Moved, Church Playlists, Staff Picks, känslo-/SEO-samlingar, trending
- `/church` index + `/church/[slug]` med Spotify embed och YouTube-video-grid
- `This Moved Me` reaktionssystem (cookie + IP-rate limit)
- Databasdriven rate limiting och voting med in-memory fallback utan databas
- Daglig cron-sync: `/api/cron/sync` (konfigurerad via Cloudflare cron trigger)
- Sitemap + robots + JSON-LD
- Tag-baserad cachning för relevanta routes

## Deploy till Cloudflare

1. Fyll i deploy-env i `.env.local` och Cloudflare-secrets/vars.
2. Kör `npm run deploy`.
3. Verifiera:
   - `/`
   - `/church`
   - minst en `/church/[slug]`
   - `/api/cron/sync?secret=DIN_CRON_SECRET`

## Viktigt för Spotify (2026)

Ansök om **Extended Quota Mode** i Spotify Developer Dashboard. Utan detta kan externa publika playlist-items vara blockerade. Appen har fallback till manuella JSON-listor i `src/data/manual/`.
