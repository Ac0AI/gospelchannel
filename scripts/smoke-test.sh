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
  for file in "${SMOKE_TMP_FILES[@]:-}"; do
    rm -f "$file"
  done
}
trap cleanup EXIT

SMOKE_TMP_FILES=()

fetch_page() {
  local path="$1"
  local file
  file="$(mktemp)"
  SMOKE_TMP_FILES+=("$file")

  curl -fsS "$BASE_URL$path" -o "$file"

  if grep -Eiq '<meta name="next-error" content="not-found"|NEXT_HTTP_ERROR_FALLBACK;404|<title>Church Not Found' "$file"; then
    echo "[smoke] Page rendered a not-found state: $path"
    exit 1
  fi
}

CHURCH_SLUG="${CHURCH_SLUG:-$(node -e "const churches=require('./src/data/churches.json'); const church=churches.find((item) => item && item.slug); if (!church) process.exit(1); process.stdout.write(church.slug);")}"

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
fetch_page "/"
fetch_page "/church"
fetch_page "/church/${CHURCH_SLUG}"
fetch_page "/prayerwall"

echo "[smoke] Checking APIs"
curl -fsS "$BASE_URL/api/church/vote?slugs=${CHURCH_SLUG}" >/dev/null
curl -fsS "$BASE_URL/api/church/vote/top?period=30d&limit=8" >/dev/null

if [[ "${SMOKE_WITH_CRON:-0}" == "1" ]] && grep -Eq "^CRON_SECRET=.+" .env.local 2>/dev/null; then
  CRON_SECRET="$(grep -E '^CRON_SECRET=' .env.local | tail -n1 | cut -d= -f2-)"
  if [[ -n "$CRON_SECRET" ]]; then
    curl -fsS "$BASE_URL/api/cron/sync?secret=${CRON_SECRET}" >/dev/null
  fi
fi

echo "[smoke] PASS"
