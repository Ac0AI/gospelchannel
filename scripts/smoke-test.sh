#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"
BASE_URL="http://127.0.0.1:${PORT}"

cleanup() {
  if [[ -n "${DEV_PID:-}" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[smoke] Starting Next.js dev server on port ${PORT}"
PORT="$PORT" npm run dev > /tmp/gospel-smoke-dev.log 2>&1 &
DEV_PID=$!

for i in {1..40}; do
  if curl -fsS "$BASE_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$i" -eq 40 ]]; then
    echo "[smoke] Dev server failed to start"
    tail -n 60 /tmp/gospel-smoke-dev.log || true
    exit 1
  fi
done

echo "[smoke] Checking pages"
curl -fsS "$BASE_URL/" >/dev/null
curl -fsS "$BASE_URL/church" >/dev/null
curl -fsS "$BASE_URL/church/hillsong-worship" >/dev/null
curl -fsS "$BASE_URL/prayerwall" >/dev/null

echo "[smoke] Checking APIs"
curl -fsS "$BASE_URL/api/church/vote?slugs=hillsong-worship" >/dev/null
curl -fsS "$BASE_URL/api/church/vote/top?period=30d&limit=8" >/dev/null

if [[ "${SMOKE_WITH_CRON:-0}" == "1" ]] && grep -Eq "^CRON_SECRET=.+" .env.local 2>/dev/null; then
  CRON_SECRET="$(grep -E '^CRON_SECRET=' .env.local | tail -n1 | cut -d= -f2-)"
  if [[ -n "$CRON_SECRET" ]]; then
    curl -fsS "$BASE_URL/api/cron/sync?secret=${CRON_SECRET}" >/dev/null
  fi
fi

echo "[smoke] PASS"
