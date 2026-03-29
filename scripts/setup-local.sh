#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  echo "[setup] Created .env.local from .env.example"
else
  echo "[setup] .env.local already exists"
fi

npm install --cache .npm-cache

echo "[setup] Running lint + Next build + Cloudflare build to verify baseline"
npm run lint
npm run build
npm run cf:build

echo "[setup] Done. Next: fill API keys in .env.local and run npm run smoke"
