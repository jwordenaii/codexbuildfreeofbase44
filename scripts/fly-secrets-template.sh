#!/usr/bin/env bash
# fly-secrets-template.sh — full backend secrets wiring for jworden-api on Fly.io
#
# Fill in every value below (leave truly optional ones blank to skip),
# then run:
#   ./scripts/fly-secrets-template.sh
#
# This uses `flyctl secrets set` in one batch per group so each group is a
# single Fly deploy. Requires `flyctl auth login` (or FLY_API_TOKEN exported)
# and -a jworden-api access.
#
# Generated from .env.example — every var here is read directly by the
# FastAPI backend (app/), not the Vite frontend (no VITE_* vars included;
# those are set in Vercel, not here).

set -euo pipefail
APP="jworden-api"

set_group() {
  local desc="$1"; shift
  local args=()
  for kv in "$@"; do
    local key="${kv%%=*}"
    local val="${kv#*=}"
    [ -z "$val" ] && continue   # skip unfilled optional vars
    args+=("$kv")
  done
  if [ "${#args[@]}" -eq 0 ]; then
    echo "skip: $desc (nothing filled in)"
    return
  fi
  echo "==> $desc (${#args[@]} keys)"
  flyctl secrets set -a "$APP" "${args[@]}"
}

# ── Core infra (REQUIRED — app will not boot correctly without these) ────────
set_group "Core infra" \
  "DATABASE_URL=" \
  "JWORDEN_MASTER_KEY=" \
  "JWT_SECRET_KEY=" \
  "ADMIN_USERNAME=admin" \
  "ADMIN_PASSWORD=" \
  "AUTH_MODE=required" \
  "AUTO_CREATE_TABLES=false" \
  "DEFAULT_TENANT_ID=default"

# ── AI brains (Jarvis, vision, blog, advisory) ────────────────────────────────
set_group "AI providers" \
  "ANTHROPIC_API_KEY=" \
  "OPENAI_API_KEY=" \
  "GEMINI_API_KEY=" \
  "GOOGLE_API_KEY=" \
  "PERPLEXITY_API_KEY=" \
  "XAI_API_KEY="

# ── Voice / TTS ────────────────────────────────────────────────────────────
set_group "Voice / TTS" \
  "ELEVENLABS_API_KEY=" \
  "ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB" \
  "JARVIS_TTS_VOICE=onyx" \
  "JARVIS_TTS_MODEL=tts-1-hd" \
  "VAPI_API_KEY=" \
  "VAPI_PHONE_NUMBER_ID=" \
  "VAPI_ASSISTANT_ID="

# ── SMS / Twilio ──────────────────────────────────────────────────────────
set_group "Twilio" \
  "TWILIO_ACCOUNT_SID=" \
  "TWILIO_AUTH_TOKEN=" \
  "TWILIO_FROM_NUMBER=" \
  "TWILIO_VERIFY_SERVICE_SID=" \
  "NOTIFY_TO_PHONE=" \
  "ADMIN_2FA_PHONE="

# ── Email ─────────────────────────────────────────────────────────────────
set_group "Email" \
  "SENDGRID_API_KEY=" \
  "SENDGRID_FROM_EMAIL=" \
  "SENDGRID_FROM_NAME=J. Worden & Sons Asphalt Paving" \
  "ADMIN_NOTIFY_EMAIL=" \
  "RESEND_API_KEY=" \
  "RESEND_FROM_EMAIL=" \
  "SMTP_HOST=smtp.gmail.com" \
  "SMTP_PORT=587" \
  "SMTP_USER=" \
  "SMTP_PASSWORD=" \
  "NOTIFY_TO_EMAIL="

# ── Background tasks: Celery + Redis ──────────────────────────────────────
set_group "Celery / Redis" \
  "REDIS_URL=" \
  "CELERY_BROKER_URL=" \
  "CELERY_RESULT_BACKEND=" \
  "FOLLOWUP_CHECK_INTERVAL_MINUTES=15" \
  "WEB_CONCURRENCY=3"

# ── Google Maps / Places / GBP (Command Center + reviews + mailer imagery) ──
set_group "Google Maps / Places / GBP" \
  "GOOGLE_MAPS_API_KEY=" \
  "GOOGLE_PLACES_API_KEY=" \
  "GOOGLE_PLACE_ID=" \
  "GOOGLE_PAGESPEED_API_KEY=" \
  "GBP_OAUTH_TOKEN=" \
  "GBP_ACCOUNT_ID=" \
  "GBP_REVIEW_LINK="

# ── Google Ads / Search Console / Analytics reporting ─────────────────────
set_group "Google Ads / GSC / GA4" \
  "GOOGLE_ADS_DEVELOPER_TOKEN=" \
  "GOOGLE_ADS_CLIENT_ID=" \
  "GOOGLE_ADS_CLIENT_SECRET=" \
  "GOOGLE_ADS_REFRESH_TOKEN=" \
  "GOOGLE_ADS_CUSTOMER_ID=" \
  "GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON=" \
  "GOOGLE_SEARCH_CONSOLE_SITE_URL=" \
  "GOOGLE_ANALYTICS_PROPERTY_ID="

# ── Zip-scan mailer pipeline (Regrid parcel lookup + Lob physical mail) ────
# Leave blank to run in honest mock/demo mode — see app/services/
# parcel_service.py + mailer_service.py.
set_group "Zip-scan mailer pipeline" \
  "REGRID_API_KEY=" \
  "LOB_API_KEY="

# ── Payments (Stripe) ───────────────────────────────────────────────────────
set_group "Stripe" \
  "STRIPE_SECRET_KEY=" \
  "STRIPE_WEBHOOK_SECRET=" \
  "STRIPE_SUCCESS_URL=https://jwordenasphaltpaving.com/quote?payment=success" \
  "STRIPE_CANCEL_URL=https://jwordenasphaltpaving.com/quote?payment=cancel"

# ── Search / vector / observability ─────────────────────────────────────────
set_group "Search + observability" \
  "PINECONE_API_KEY=" \
  "PINECONE_INDEX_NAME=" \
  "ELASTICSEARCH_HOST=" \
  "ELASTICSEARCH_PORT=9200" \
  "ELASTICSEARCH_USER=" \
  "ELASTICSEARCH_PASSWORD=" \
  "SENTRY_DSN=" \
  "SENTRY_TRACES_SAMPLE_RATE=0.1" \
  "DATADOG_API_KEY=" \
  "SLACK_WEBHOOK_URL=" \
  "LANGSMITH_API_KEY=" \
  "LANGSMITH_PROJECT=jworden-ai" \
  "LANGSMITH_TRACING_V2=false"

# ── Permit / market data feeds ───────────────────────────────────────────────
set_group "Permit + market data" \
  "VIRGINIA_LIS_API_KEY=" \
  "VPT_ENDPOINT=https://permits.virginia.gov/api" \
  "DEQ_PEEP_ENDPOINT=https://www.deq.virginia.gov/api/peep" \
  "APIFY_TOKEN=" \
  "NYC_OPENDATA_APP_TOKEN=" \
  "EIA_API_KEY=" \
  "OPENWEATHERMAP_API_KEY=" \
  "ENABLE_LIS_SCRAPER_STUB=false"

# ── Kickserv field-service integration ───────────────────────────────────────
set_group "Kickserv" \
  "KICKSERV_API_KEY=" \
  "KICKSERV_ACCOUNT=" \
  "KICKSERV_BASE_URL=https://api.kickserv.com/v1"

# ── Business identity (Schema.org / JSON-LD / proposals) ────────────────────
set_group "Business identity" \
  "BUSINESS_PHONE=+18044461296" \
  "BUSINESS_EMAIL=contact@jwordenasphaltpaving.com" \
  "BUSINESS_STREET=1601 Ware Bottom Springs Rd Suite 214" \
  "BUSINESS_CITY=Chester" \
  "BUSINESS_STATE=VA" \
  "BUSINESS_ZIP=23836" \
  "BUSINESS_LAT=37.352900" \
  "BUSINESS_LNG=-77.432600" \
  "SITE_URL=https://jwordenasphaltpaving.com" \
  "PROPOSAL_SENDER_NAME=J. Worden & Sons Asphalt Paving" \
  "COMPANY_PHONE=+18044461296" \
  "COMPANY_EMAIL=contact@jwordenasphaltpaving.com" \
  "COMPANY_WEBSITE=https://jwordenasphaltpaving.com" \
  "COMPANY_ADDRESS=1601 Ware Bottom Springs Rd Suite 214, Chester, VA 23836"

echo
echo "Done. Verify with: flyctl secrets list -a $APP"
echo "Each non-empty group above triggered its own rolling deploy."
