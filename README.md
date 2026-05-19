# The Worden Standard v4

Internal contractor operations platform — 15 stations, 51-state legal database, Jarvis AI.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite, inline styles (no Tailwind), IBM Plex Mono |
| Backend | FastAPI + Uvicorn |
| AI | Anthropic Claude (Jarvis + narrative) |
| Auth | 4-digit PIN → HMAC-signed session cookie |
| DB | Neon Postgres (optional — ForecastStation signal history) |

## Stations

| # | Station | Route |
|---|---------|-------|
| 1 | Home | `/home` |
| 2 | Jarvis AI | `/jarvis` |
| 3 | Estimate | `/estimate` |
| 4 | Jobs | `/jobs` |
| 5 | Crew | `/crew` |
| 6 | Equipment | `/equipment` |
| 7 | Weather | `/weather` |
| 8 | Banking | `/banking` |
| 9 | Legal / Compliance | `/legal` |
| 10 | IronGrid Map | `/ironmap` |
| 11 | Pre-Con Omni | `/precon` |
| 12 | Investor ROI | `/investor` |
| 13 | Forecast Station | `/forecast` |
| 14 | Dispatch Weather | `/dispatch` |
| 15 | Reality Engine | `/reality` |

## Quick start

### 1. Copy env

```bash
cp .env.example .env
# Edit .env — set WS_PIN and SESSION_SECRET at minimum
```

### 2. Frontend

```bash
npm install
npm run dev        # http://localhost:5174
```

### 3. Backend

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8010 --reload
```

### 4. Open

Navigate to `http://localhost:5174` and enter your 4-digit PIN.

## Production build

```bash
npm run build
# dist/ is created. FastAPI serves it automatically when dist/ exists.
uvicorn backend.main:app --host 0.0.0.0 --port 8010
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WS_PIN` | ✅ | 4-digit PIN for the app gate |
| `SESSION_SECRET` | ✅ | Long random string for session signing |
| `ANTHROPIC_API_KEY` | ⚠️ | Required for Jarvis AI and narrative generation |
| `DATABASE_URL` | ⚠️ | Neon Postgres — required for ForecastStation |
| `MAPBOX_TOKEN` | ⚠️ | Required for PreCon Omni geocoding |
| `VITE_DISPATCH_LAT` | — | Default lat when geolocation denied (default: 37.5407) |
| `VITE_DISPATCH_LON` | — | Default lng when geolocation denied (default: -77.4360) |

## Architecture notes

- The PIN is **never** in the client bundle. It is checked server-side and a signed HMAC session cookie is returned.
- All stations behind the PIN gate. PinGate checks `/api/auth/session` on mount — no re-entry on refresh.
- `⌘K` opens the command palette anywhere in the app.
- Intelligence stations (IronGrid, PreCon, Investor, Forecast, Reality) degrade gracefully when API keys are absent — they render with empty/stub data rather than crashing.
