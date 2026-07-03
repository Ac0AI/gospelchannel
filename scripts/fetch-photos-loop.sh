#!/usr/bin/env bash
#
# Grind fetch-church-photos.mjs through ALL remaining eligible churches, one
# 400-chunk at a time, sequentially. Detached (nohup) so it survives a closed
# terminal. Waits for any in-flight chunk to finish before starting, then loops
# until the script reports "Targets: 0 churches" (nothing left to do).
#
# Launch:  nohup bash scripts/fetch-photos-loop.sh >/dev/null 2>&1 & disown
# Watch:   tail -f data/photo-loop.log
#
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
LOG="$ROOT/data/photo-loop.log"
mkdir -p "$ROOT/data"

echo "[loop] $(date '+%F %T') START — waiting for any in-flight chunk" >> "$LOG"
# Don't overlap with the chunk already running (would re-select the same churches).
while pgrep -f "scripts/fetch-church-photos.mjs" >/dev/null 2>&1; do
  sleep 15
done
echo "[loop] $(date '+%F %T') in-flight chunk cleared — starting loop" >> "$LOG"

fails=0
for i in $(seq 1 40); do
  echo "[loop] $(date '+%F %T') chunk $i starting" >> "$LOG"
  out=$(node scripts/fetch-church-photos.mjs --limit=400 --max-images=8 2>&1)
  code=$?
  printf '%s\n' "$out" >> "$LOG"

  if printf '%s' "$out" | grep -q '^Targets: 0 churches'; then
    echo "[loop] $(date '+%F %T') no eligible churches left — DONE" >> "$LOG"
    break
  fi

  if [ "$code" -ne 0 ]; then
    fails=$((fails + 1))
    echo "[loop] $(date '+%F %T') chunk $i FAILED (exit $code), consecutive=$fails" >> "$LOG"
    if [ "$fails" -ge 3 ]; then
      echo "[loop] $(date '+%F %T') aborting after 3 consecutive failures" >> "$LOG"
      break
    fi
    sleep 30
  else
    fails=0
    sleep 10
  fi
done

echo "[loop] $(date '+%F %T') loop finished" >> "$LOG"
