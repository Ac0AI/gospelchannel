# Launch Checklist

## 1) External accounts (manual)

- [ ] Create YouTube Data API key and enable YouTube Data API v3
- [ ] Create Spotify app (Client ID/Secret)
- [ ] Apply for Spotify Extended Quota Mode
- [ ] Configure Cloudflare Worker routes and cron trigger
- [ ] Configure Neon production database access

## 2) Local config

- [x] `.env.local` created
- [ ] Fill real values for:
  - [ ] `YOUTUBE_API_KEY`
  - [ ] `SPOTIFY_CLIENT_ID`
  - [ ] `SPOTIFY_CLIENT_SECRET`
  - [ ] `DATABASE_URL`
  - [ ] `BETTER_AUTH_SECRET`
  - [ ] `NEXT_PUBLIC_SITE_URL`
  - [ ] `CRON_SECRET`
- [ ] Run `npm run check:env`

## 3) Technical verification

- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run check:data`
- [x] `npm run smoke`
- [ ] Run cron with real API keys: `/api/cron/sync?secret=...`
- [ ] Confirm church pages use Spotify API data (not only manual fallback)

## 4) Production verification

- [ ] Open `/`
- [ ] Open `/church`
- [ ] Open at least 3 church pages
- [ ] Open `/category/praise-and-worship`
- [ ] Open `/trending`
- [ ] Test `This Moved Me` button increments
- [ ] Confirm `https://gospelchannel.com/sitemap.xml`
- [ ] Confirm `https://gospelchannel.com/robots.txt`

## 5) Growth/monetization setup

- [ ] Add Google Search Console + submit sitemap
- [ ] Add Analytics (GA4 or Plausible)
- [ ] Apply for AdSense
- [ ] Activate AdSense script after approval
