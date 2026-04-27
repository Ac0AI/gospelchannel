#!/usr/bin/env bash
# Daily Spotify enrichment job.
# Schedule via crontab, e.g.:
#   3 3 * * * /Users/dpr/Code/Projekt/gospelmigration/scripts/cron/daily-spotify-enrich.sh >> /tmp/spotify-cron.log 2>&1
# The odd minute (3) avoids the :00 thundering herd.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export NODE_OPTIONS="--no-warnings"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Phase 1: revalidate-legacy (small batch)"
# Re-runs the strict matcher on legacy unverified matches (spotify_url set
# by the old discover flow but never validated). No-op once the legacy
# pool is drained. Capped at 50/night to leave Spotify quota for Phase 2.
node scripts/enrich-spotify-by-church-name.mjs \
  --revalidate-legacy \
  --limit=50 \
  --throttle=400 \
  --concurrency=2 || echo "[warn] phase 1 exited non-zero"

# Brief pause between bursts to ease aggregate rate-limit pressure.
sleep 60

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Phase 2: daily enrichment"
node scripts/enrich-spotify-by-church-name.mjs \
  --daily \
  --daily-limit=500 \
  --throttle=400 \
  --concurrency=2
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Finished"
