# GospelChannel

Kyrk-katalog med worship-musik. Next.js 16 + OpenNext på Cloudflare Workers (Enterprise).

## Deploy

**Alla git pushes ska följas av Cloudflare deploy:**
```bash
git push && pnpm run deploy
```

Aldrig pusha utan att deploya - koden är inte live förrän den når Cloudflare.

## Stack

- **Framework:** Next.js 16 (App Router, webpack via OpenNext)
- **Hosting:** Cloudflare Workers via OpenNext (`pnpm run deploy`)
- **Databas:** Neon Postgres (via `@neondatabase/serverless`)
- **Bildlagring:** Cloudflare R2 (`church-assets` bucket)
- **Bildoptimering:** Cloudflare Image Resizing (Enterprise) via `cfImage()` i `src/lib/media.ts`
- **Bild-CDN:** `media.gospelchannel.com` (R2 custom domain)
- **Analytics:** PostHog (cookieless, memory-only, EU)
- **AI:** Claude Haiku för auto-enrichment av kyrkor
- **DNS:** Porkbun -> Cloudflare nameservers

## Cloudflare Enterprise

Zonen `gospelchannel.com` kör Enterprise med $5000 credits.
- Image Resizing: ON
- Tiered Cache: ON
- Security Headers: via Transform Rules (HSTS, X-Frame-Options, CSP etc.)
- WAF/Bot Management: konfigurera i dashboard (API-token saknar permissions)
- Zone ID: `fdbbb865c3c520e9a914a015a20345c7`

## Viktiga filer

- `worker.ts` - Cloudflare Worker entry point + cron handler
- `wrangler.jsonc` - Worker config, R2-bindings, cron
- `open-next.config.ts` - OpenNext/Cloudflare bridge config
- `src/lib/media.ts` - `cfImage()` och `rewriteLegacyMediaUrl()`
- `src/lib/auto-enrich.ts` - Haiku-baserad auto-enrichment vid suggestions
- `scripts/quality-check-pending.mjs` - Batch-kvalitetskontroll av kyrkor
- `scripts/backfill-emails.mjs` - Crawla kyrk-hemsidor efter kontakt-email

## Admin

- `/admin/candidates` - Alla kyrkor (pending/approved/rejected) med edit-formulär inkl. hero image
- `/admin/suggestions` - Inkomna förslag
- Auto-enrichment körs i bakgrunden (waitUntil) när suggestions submittas
