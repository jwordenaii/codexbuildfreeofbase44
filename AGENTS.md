# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Frontend (Vite) | `npm run dev:web` | 5173 | React 18 SPA |
| Backend (FastAPI) | `source .venv/bin/activate && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload` | 8000 | Uses SQLite by default in dev |

### Quick start

Standard commands are documented in `README.md`. Key deviations for cloud agents:

- **Backend uses SQLite fallback in dev** — no PostgreSQL or Redis required for core functionality. The app auto-creates tables when `AUTO_CREATE_TABLES=true` is set in `.env`.
- **AUTH_MODE=none** in `.env` disables bearer token checks on protected endpoints for easier local testing. Set to `required` to test production auth behavior.
- Redis warnings (`Error 111 connecting to localhost:6379`) are non-fatal — caching and Celery features degrade gracefully.

### Running tests

```bash
source .venv/bin/activate && python -m pytest --tb=short
```

- 3 tests in `tests/backend/test_auth_status_and_audit.py` and `tests/backend/test_public_core_boundary.py` will fail when `AUTH_MODE=none` — this is expected. To pass them: `AUTH_MODE=required python -m pytest tests/backend/test_auth_status_and_audit.py tests/backend/test_public_core_boundary.py`

### Lint / Build

- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run build` — Vite production build to `dist/`

### Environment setup

Copy `.env.example` to `.env` and `.env.local`. Key dev overrides:
- `VITE_API_BASE_URL=http://127.0.0.1:8000`
- `AUTH_MODE=none`
- `AUTO_CREATE_TABLES=true`
- `DATABASE_URL=sqlite:///./jworden_leads.db`

### Gotchas

- Many npm scripts use PowerShell (`.ps1`) — these are Windows-only dev tools. On Linux, use the underlying commands directly (e.g., `uvicorn app.main:app --reload` instead of `npm run dev:backend`).
- The `postbuild` step runs sitemap generation + IndexNow/GSC submission scripts that skip automatically outside Netlify production deploys.
- Python venv must be activated before running backend commands (`source .venv/bin/activate`).
- The backend's hot-reload (uvicorn `--reload`) watches the entire `/workspace` directory. If you install new pip packages, uvicorn will detect changes and restart automatically.
