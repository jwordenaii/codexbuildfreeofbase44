#!/usr/bin/env bash
# deploy-frontend.sh — Automated Netlify front-end deployment.
#
# Prerequisites:
#   • Node 20 installed and on PATH
#   • NETLIFY_AUTH_TOKEN  — personal access token from app.netlify.com/user/applications
#   • NETLIFY_SITE_ID     — found in Site settings → General → Site details
#
# Environment variables can be exported beforehand or placed in .env:
#   export NETLIFY_AUTH_TOKEN=nfp_...
#   export NETLIFY_SITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#
# Usage:
#   ./scripts/deploy-frontend.sh           # deploy to production
#   DEPLOY_PREVIEW=1 ./scripts/deploy-frontend.sh   # draft/preview deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log()  { echo "[deploy-frontend] $*"; }
err()  { echo "[deploy-frontend] ERROR: $*" >&2; exit 1; }

# ── Load local .env if present (won't override already-exported vars) ─────────
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  log "Loaded .env"
fi

# ── Validate required secrets ─────────────────────────────────────────────────
: "${NETLIFY_AUTH_TOKEN:?NETLIFY_AUTH_TOKEN must be set}"
: "${NETLIFY_SITE_ID:?NETLIFY_SITE_ID must be set}"

# ── Step 1: ensure .env exists ────────────────────────────────────────────────
log "Step 1/5 — Checking environment file..."
if [ ! -f .env ]; then
  log "  .env not found — running setup-env.sh..."
  bash scripts/setup-env.sh
fi

# ── Step 2: install Node dependencies ────────────────────────────────────────
log "Step 2/5 — Installing Node dependencies..."
npm ci --prefer-offline 2>&1 | tail -5
log "  Dependencies installed."

# ── Step 3: build the front-end ───────────────────────────────────────────────
log "Step 3/5 — Building front-end..."
npm run build
if [ ! -d dist ]; then
  err "Build did not produce a dist/ directory."
fi
log "  Build complete. dist/ contents:"
ls -lh dist/

# ── Step 4: validate the build ────────────────────────────────────────────────
log "Step 4/5 — Validating build..."
[ -f dist/index.html ] || err "dist/index.html is missing — build may have failed."
log "  dist/index.html found."

# ── Step 5: deploy to Netlify ─────────────────────────────────────────────────
log "Step 5/5 — Deploying to Netlify..."

DEPLOY_FLAGS="--dir=dist --site=$NETLIFY_SITE_ID"
if [ "${DEPLOY_PREVIEW:-0}" = "1" ]; then
  log "  Deploying as draft/preview..."
  npx netlify-cli deploy $DEPLOY_FLAGS 2>&1
else
  log "  Deploying to production..."
  npx netlify-cli deploy $DEPLOY_FLAGS --prod 2>&1
fi

log "Deployment complete!"
