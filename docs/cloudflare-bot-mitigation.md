# Cloudflare Bot Mitigation

GospelChannel runs on Cloudflare Workers and uses zone-level WAF + Bot Management
to block scrapers that don't add value. This doc describes what's blocked, why,
and how to operate it.

## Background

A 30-day Cloudflare Analytics window in April 2026 showed ~418k "Total visits"
to the zone. Cross-referenced with Google Search Console:

| Source | Count | Note |
|---|---|---|
| Cloudflare visits | ~418k | All requests, including bots |
| GSC impressions | ~7,900 | Real Google search appearances |
| GSC clicks | ~39 | Real human clicks from Google |
| Chrome browser hits (CF source breakdown) | ~6.7k | Closest proxy to "real humans" |

Conclusion: ~98% of traffic was bots/scrapers, not humans. The biggest categories
were SEO scrapers (SemrushBot, AhrefsBot, DataForSeoBot — collectively ~172k),
AI training crawlers (GPTBot, ClaudeBot, CCBot etc.), and unidentified
"Unknown browser" traffic from cloud ASNs (AWS, Hetzner, OVH).

This wasn't just noise — it was driving Worker invocations and Neon database
egress. A 1.5 TB Neon egress incident on 2026-04-27 was traced back to bot
traffic hitting cache-miss paths.

## What's blocked

### Custom WAF rules (zone `gospelchannel.com`)

Rule 1: Block SEO scrapers by user-agent
```
(lower(http.user_agent) contains "semrushbot")
or (lower(http.user_agent) contains "ahrefsbot")
or (lower(http.user_agent) contains "dataforseobot")
or (lower(http.user_agent) contains "mj12bot")
or (lower(http.user_agent) contains "dotbot")
or (lower(http.user_agent) contains "petalbot")
or (lower(http.user_agent) contains "blexbot")
or (lower(http.user_agent) contains "seekport")
or (lower(http.user_agent) contains "serpstatbot")
```
Action: **Block**. These crawlers feed third-party SEO databases and provide
no value to GospelChannel users.

Rule 2: Block specific Hetzner IP `136.243.220.209` — a single host running
DataForSeoBot scrapes that accounted for 69k requests/month.

### Bot Management settings

- `ai_bots_protection: block` — blocks Cloudflare's curated AI training crawler
  list (GPTBot, ClaudeBot, CCBot, Google-Extended, Bytespider, etc.)
- `sbfm_verified_bots: allow` — Googlebot, Bingbot, AppleBot, etc. are
  identified by reverse-DNS verification and pass through
- `sbfm_definitely_automated: allow` — Super Bot Fight Mode disabled (see
  "Lessons learned" below)
- `sbfm_likely_automated: allow` — same reason
- `crawler_protection: disabled` — caused false-positive blocks on legitimate
  crawler-shaped UAs without IP verification
- `enable_js: true` — passive JS-based bot fingerprinting (non-blocking)

## Verification

Run from any non-Cloudflare IP:

```bash
# Should return 200
curl -sI https://gospelchannel.com/ \
  -H "User-Agent: Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Should return 403
curl -sI https://gospelchannel.com/ -H "User-Agent: Mozilla/5.0 (compatible; SemrushBot/7)"
curl -sI https://gospelchannel.com/ -H "User-Agent: Mozilla/5.0 (compatible; GPTBot/1.2)"
```

Note: testing `Bingbot` UA from a non-Microsoft IP will return 403 — that's
correct. Cloudflare's verified-bot system requires both UA and source IP/ASN
to match. Real Bingbot crawls from Microsoft's infrastructure are still allowed.

## How to add a new block

Adding more user-agents to the SEO scraper list, e.g. `BLEXBot`:

```bash
# 1. Get current ruleset
curl -sS "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# 2. PUT the full rules array (PUT replaces all rules — preserve existing)
curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/phases/http_request_firewall_custom/entrypoint" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @rules.json
```

Required token scopes: `Zone:WAF:Edit`, `Zone:Zone:Read`, `Account:Account WAF:Edit`.

## Lessons learned

**Super Bot Fight Mode is too aggressive for Worker-driven sites.** The first
configuration set `sbfm_definitely_automated: block` and `enable_js: true`,
which started returning 403 "Attention Required" interstitials to legitimate
Chrome browsers within seconds. We rolled back to `allow` on all SBFM tiers.

The combination of explicit Custom WAF rules + AI Bots Protection covers what
we actually wanted to block, without the false-positive risk SBFM brings on a
Workers-routed zone.

**Cloudflare Cache Rules don't apply to Worker-handled routes.** A Cache Rule
was created for `/church/*` and similar paths, but Workers run before the
Cloudflare cache layer, so the rule doesn't trigger. Edge caching is instead
handled in `worker.ts` via `caches.open(HTML_EDGE_CACHE_NAME)` (commit
`38dfa842`). That custom named cache doesn't show up in the standard
"Cache statuses" panel of Cloudflare Analytics, which is why the analytics
showed 0.13% cache hit rate — it was always going through the worker's own
cache layer.

**Verifying bot blocks from outside is unreliable.** Cloudflare verifies bots
by source IP/ASN, so curl with a fake UA will be classified differently than
the real bot. The honest verification is to watch GSC and Bing Webmaster Tools
indexation in the days after a change.

## Related

- [`worker.ts`](../worker.ts) — Worker-level edge cache for HTML responses
- `MEMORY.md` (Claude memory) — internal notes on the 2026-04-27 Neon egress incident
