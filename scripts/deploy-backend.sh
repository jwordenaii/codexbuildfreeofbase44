#!/usr/bin/env bash
# deploy-backend.sh — Automated back-end deployment.
#
# This script:
#   1. Bootstraps .env from .env.example if missing.
#   2. Creates a Python virtual environment and installs requirements.
#   3. Runs Alembic database migrations.
#   4. Builds and launches Docker containers (optional, skipped with --no-docker).
#   5. Runs the pytest suite to verify back-end readiness.
#   6. Starts the production Gunicorn server (skipped with --no-gunicorn).
#
# Usage:
#   ./scripts/deploy-backend.sh                # full deployment
#   ./scripts/deploy-backend.sh --no-docker    # skip Docker steps
#   ./scripts/deploy-backend.sh --no-gunicorn  # skip Gunicorn start (CI mode)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

NO_DOCKER=0
NO_GUNICORN=0
for arg in "$@"; do
  case "$arg" in
    --no-docker)   NO_DOCKER=1 ;;
    --no-gunicorn) NO_GUNICORN=1 ;;
  esac
done

log()  { echo "[deploy-backend] $*"; }
err()  { echo "[deploy-backend] ERROR: $*" >&2; exit 1; }

# ── Load local .env if present (won't override already-exported vars) ─────────
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  log "Loaded .env"
fi

# ── Step 1: ensure .env exists ────────────────────────────────────────────────
log "Step 1/6 — Checking environment file..."
if [ ! -f .env ]; then
  log "  .env not found — running setup-env.sh..."
  bash scripts/setup-env.sh
fi

# ── Step 2: Python virtual environment + dependencies ────────────────────────
log "Step 2/6 — Setting up Python virtual environment..."
VENV_DIR=".venv"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
  log "  Virtual environment created at $VENV_DIR"
else
  log "  Virtual environment already exists at $VENV_DIR"
fi

# Activate venv
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
log "  Virtual environment activated."

log "  Installing Python dependencies from requirements.txt..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
log "  Dependencies installed."

# ── Step 3: Database migrations ───────────────────────────────────────────────
log "Step 3/6 — Running Alembic database migrations..."
DATABASE_URL="${DATABASE_URL:-sqlite:///./jworden_leads.db}"
export DATABASE_URL
log "  Using DATABASE_URL: $DATABASE_URL"

alembic upgrade head
log "  Migrations applied."

# ── Step 4: Docker containers (optional) ──────────────────────────────────────
if [ "$NO_DOCKER" -eq 0 ]; then
  log "Step 4/6 — Building and launching Docker containers..."
  if ! command -v docker &>/dev/null; then
    err "Docker is not installed.  Install Docker or pass --no-docker to skip."
  fi

  docker compose build --parallel
  docker compose up -d db redis
  log "  Waiting for database and Redis to be healthy..."
  docker compose up -d api worker beat
  log "  Docker containers started.  Check status with: docker compose ps"
else
  log "Step 4/6 — Skipping Docker (--no-docker flag set)."
fi

# ── Step 5: Run pytest ────────────────────────────────────────────────────────
log "Step 5/6 — Running backend test suite..."
JWORDEN_MASTER_KEY="${JWORDEN_MASTER_KEY:-ci-test-key}" \
JWT_SECRET_KEY="${JWT_SECRET_KEY:-ci-test-secret}" \
AUTO_CREATE_TABLES="true" \
pytest -q tests/backend
log "  All tests passed."

# ── Step 6: Start Gunicorn (optional — skip in CI / Docker deployments) ───────
if [ "$NO_GUNICORN" -eq 0 ] && [ "$NO_DOCKER" -eq 1 ]; then
  log "Step 6/6 — Starting Gunicorn production server..."
  log "  Command: gunicorn app.main:app --config gunicorn.conf.py"
  exec gunicorn app.main:app --config gunicorn.conf.py
else
  log "Step 6/6 — Gunicorn not started here (running inside Docker or --no-gunicorn)."
  log "  To start manually: gunicorn app.main:app --config gunicorn.conf.py"
fi

log "Back-end deployment complete!"
