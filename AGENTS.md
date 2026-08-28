# GospelChannel

Kyrk-katalog med worship-musik. Next.js 16 + OpenNext på Cloudflare Workers (Enterprise).

## AI-searchagenda

**Position:** GospelChannel Church Guide ska vinna problemet "best church near me" genom verifierbara kyrkoprofiler, fit-baserad sökning och trygg planering inför ett första besök. Vi rankar inte kyrkor efter popularitet, recensioner eller betalning.

**North-star-flöde:** AI/lokal sökning -> nearby- eller stadsresultat -> kyrkoprofil -> officiell verifiering/visit intent -> claim eller korrigering från kyrkan.

### Baseline 2026-08-28

ZeroRanks engångs-fanout innehöll 1 300 GospelChannel-frågor. Vid exporten var 1 592 av 5 200 möjliga modellsvar färdiga och ingen prompt hade alla fyra modellsvar, så resultatet är en riktad före-baseline, inte marknadsandel.

- Brand/positionering: 60/60 omnämnanden och 39/60 citerade GospelChannel.
- Stadssökningar: 4/300 citerade GospelChannel.
- "Best churches near me" med stad: 0/300 citerade GospelChannel.
- Generella "best church near me": 0/100 citerade GospelChannel.
- Flerspråkiga kyrkor: 0/80 citerade GospelChannel.
- Tradition/samfund: 0/100 citerade GospelChannel.
- Pastor/admin för claim och korrigering: 0/50 citerade GospelChannel.

Auditen gjordes före releaserna av `/church-near-me`, nearby-sökningen på startsidan, Austin-fyndaren och MCP-integrationen. Bevara därför frågorna som före-baseline och mät med en mindre, oförändrad kontrollpanel efter meningsfull crawl-/modellfördröjning.

### Prioriterad agenda

1. **Austin som canary.** Gör de viktigaste Austin-profilerna källstarka innan fler specialbyggda städer skapas.
2. **Profilernas beslutsdata.** Publicera endast verifierade service times, språk, denomination/tradition, worship style, children/youth och safeguarding, accessibility, transport, pastoral care/small groups, kontakt, kontroll-datum och officiella källor.
3. **Claim och correction.** Gör vägen för pastor/kyrkoadmin att claima, korrigera och bekräfta en profil till en tydlig canonical resa med synliga beviskrav.
4. **Flerspråkigt och tradition.** Förstärk befintliga filter, hubbar och profildata. Massproducera inte tunna språk-, samfunds- eller stadssidor.
5. **Mät affärskedjan.** Håll omnämnande, länkad citation, MCP-anrop, AI-referral, profilvisning, visit intent, claim och intäkt som separata mått.
6. **Skala först efter bevis.** Replikera Austin-mönstret till nästa stad först när oförändrade frågor visar bättre retrieval/citation eller när verklig användning visar profil- och visit intent.

### Regler för AI-searcharbetet

- Skapa inte nya sidor direkt från varje fanout. Förstärk befintlig canonical eller datan bakom den först.
- Neon är canonical för kyrkodata. Fält som saknas ska visas som "Not published", aldrig tolkas som att kyrkan saknar egenskapen.
- Officiella kyrksidor vinner lokala AI-svar. Varje profil ska därför visa kontrollerade fakta, freshness och tydliga officiella länkar, inte bara generell katalogtext.
- Använd samma bild- och kortdesign som den ordinarie kyrkolistan för nearby- och stadsresultat.
- Lagra eller analysera inte användarens exakta koordinater. Mät verktyg och utfall utan rå position.
- OpenAI-pluginversion `1.0.0` skickades till review 2026-08-28. Verifiera aktuell portalstatus innan den kallas godkänd eller publik och ändra inte review-kontraktet utan att bedöma granskningspåverkan.

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
- **Analytics:** PostHog (memory-only före consent; localStorage/cookie efter consent; IP-anonymisering; ingen session recording)
- **AI:** Codex Haiku för auto-enrichment av kyrkor
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
