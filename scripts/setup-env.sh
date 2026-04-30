#!/usr/bin/env bash
# setup-env.sh — Bootstrap .env files from .env.example for both front-end and
# back-end.  Safe to run multiple times: existing files are never overwritten.
#
# Usage:
#   ./scripts/setup-env.sh
#   ./scripts/setup-env.sh --force   # overwrite existing .env (use with care)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORCE="${1:-}"

log()  { echo "[setup-env] $*"; }
warn() { echo "[setup-env] WARNING: $*" >&2; }

copy_env() {
  local src="$1"
  local dst="$2"

  if [ ! -f "$src" ]; then
    warn "$src not found — skipping."
    return
  fi

  if [ -f "$dst" ] && [ "$FORCE" != "--force" ]; then
    log "$dst already exists — skipping (use --force to overwrite)."
    return
  fi

  cp "$src" "$dst"
  log "Created $dst from $src"
  log "  → Open $dst and fill in production values before deploying."
}

cd "$REPO_ROOT"

# Root .env (used by both Vite and FastAPI via python-dotenv)
copy_env ".env.example" ".env"

# .env.local is used by docker-compose for local overrides
copy_env ".env.example" ".env.local"

log "Done.  Remember:"
log "  • Never commit .env or .env.local to source control."
log "  • Set VITE_* variables in Netlify site settings (UI or netlify.toml)."
log "  • Set backend secrets as Railway / Render environment variables."
