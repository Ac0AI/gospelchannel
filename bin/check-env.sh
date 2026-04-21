#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[check-env] Missing $ENV_FILE"
  exit 1
fi

required=(
  DATABASE_URL
  BETTER_AUTH_SECRET
  BETTER_AUTH_URL
  NEXT_PUBLIC_SITE_URL
  NEXT_PUBLIC_MEDIA_BASE_URL
  ADMIN_EMAILS
  AUTH_FROM_EMAIL
  NOTIFY_FROM_EMAIL
)

missing=0
for key in "${required[@]}"; do
  line="$(grep -E "^${key}=" "$ENV_FILE" || true)"
  value="${line#*=}"
  if [[ -z "$value" ]]; then
    echo "[check-env] Missing value for $key"
    missing=1
    continue
  fi

  if [[ "$value" == PASTE_*_HERE ]]; then
    echo "[check-env] Placeholder value detected for $key"
    missing=1
  fi
done

if [[ "$missing" -eq 1 ]]; then
  echo "[check-env] Incomplete environment configuration"
  exit 1
fi

resend_line="$(grep -E '^RESEND_API_KEY=' "$ENV_FILE" || true)"
resend_value="${resend_line#*=}"
brevo_line="$(grep -E '^BREVO_API_KEY=' "$ENV_FILE" || true)"
brevo_value="${brevo_line#*=}"

if [[ -z "$resend_value" && -z "$brevo_value" ]]; then
  echo "[check-env] Missing mail provider. Set either RESEND_API_KEY or BREVO_API_KEY"
  exit 1
fi

deploy_missing=0
for key in CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN CLOUDFLARE_ZONE_ID R2_BUCKET_NAME; do
  line="$(grep -E "^${key}=" "$ENV_FILE" || true)"
  value="${line#*=}"
  if [[ -z "$value" ]]; then
    echo "[check-env] Warning: missing deploy value for $key"
    deploy_missing=1
  fi
done

if [[ "$deploy_missing" -eq 1 ]]; then
  echo "[check-env] Core app env is valid, but Cloudflare deploy values are incomplete"
  exit 1
fi

echo "[check-env] All required environment variables are set"
