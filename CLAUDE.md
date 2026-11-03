# GospelChannel

Kyrk-katalog med worship-musik. Next.js 16 + OpenNext på Cloudflare Workers (Enterprise).

## Deploy

**Alla git pushes ska följas av Cloudflare deploy:**
```bash
git push && pnpm run deploy
```

Aldrig pusha utan att deploya - koden är inte live förrän den når Cloudflare.

`pnpm run deploy` (`scripts/deploy-cloudflare.mjs`) gör i tur och ordning:

1. Bygger (`cf:build`).
2. **Lokal kontroll före trafik:** kör den byggda Workern i workerd (`wrangler dev --local`) och kräver 200 på `/robots.txt`, `/`, `/about`, `/guides` och `/church` samt att loggen inte innehåller `loadManifest`, `Uncaught` eller 1101. Faller kontrollen laddas inget upp. Lokalt finns ingen D1-data, men de sidorna renderar ändå via ögonblicksbilderna.
3. Sparar vilken version som har trafik (`wrangler deployments list`). Utan den avbryts deployen.
4. Deployar.
5. **Livekontroll:** väntar 15 s och kräver sedan 200 på `/`, `/church`, `/guides`, `/robots.txt` och `/sitemap.xml`, med tre försök. Faller den rullar skriptet automatiskt tillbaka till den sparade versionen och avslutar med fel.
6. Tömmer cachen (`/api/cron/sync?full=true`) och förvärmer.

`pnpm run deploy -- --check-only` bygger och kör den lokala kontrollen utan att ladda upp något. Kör den före riskabla uppgraderingar (Next, OpenNext, wrangler). Den 3 nov 2026 gav Next 16.4.4 med OpenNext 1.19.11 error 1101 på alla sidor i cirka 15 minuter, eftersom deployen då kontrollerade först efteråt. Den lokala kontrollen fångar exakt det felet. Vid en nödsituation: `DEPLOY_SKIP_LOCAL_CHECK=1` hoppar över steg 2, men rollbacken i steg 5 ligger kvar.

## Stack

- **Framework:** Next.js 16 (App Router, webpack via OpenNext)
- **Hosting:** Cloudflare Workers via OpenNext (`pnpm run deploy`)
- **Databas:** Cloudflare D1 (SQLite via Drizzle, Worker binding `GOSPEL_D1`)
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

## Open source

Repot är publikt. Tänk på:
- **Inga lokala sökvägar** (`/Users/...`) i kod eller docs som committas
- **Inga email-adresser** i committat material (använd env vars)
- **Inga API-nycklar** - allt via `.env.local` (gitignored) eller `wrangler secret`
- **Interna planer/strategier** ligger i `docs/superpowers/` och `docs/lemlist-*` som är gitignored
- Kör `git diff --cached` innan commit om du är osäker
