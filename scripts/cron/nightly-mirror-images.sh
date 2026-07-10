#!/usr/bin/env bash
# Nightly foreign-image mirror job.
# Mirrors rotating Google image hosts (Place Photos, Street View thumbnails)
# to our own R2 bucket so stored DB URLs stay permanent and CSP-safe.
# Schedule via crontab, e.g.:
#   47 4 * * * /Users/dpr/Code/Projekt/gospelmigration/scripts/cron/nightly-mirror-images.sh >> /tmp/mirror-images-cron.log 2>&1
# The odd minute avoids the :00 thundering herd; 04:47 stays clear of the
# 03:03 Spotify enrich job and the Worker crons (04:00, 06:23 UTC).

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export NODE_OPTIONS="--no-warnings"
# Machine runs Node 26 while the repo pins engines to 22.x; pnpm exec needs
# the engine gate off to run at all (same bypass the deploy path uses).
export npm_config_engine_strict=false

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] mirror-foreign-images nightly run"
# Steady-state this is a no-op scan (new enrichments are protected within
# ~24h). Cap the batch so a sudden backlog never runs unbounded overnight.
pnpm exec tsx scripts/backfill-mirror-foreign-images.ts --limit=2000
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] done"
