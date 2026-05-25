# J. Worden Luxury Paving

Professional asphalt paving and maintenance across Virginia. This repo is the full-stack project: a React + Vite frontend (deployed on Netlify) and a FastAPI + PostgreSQL + Celery backend (deployed on Railway).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, Tailwind CSS, shadcn/ui, React Router v6, TanStack Query |
| Backend | FastAPI, SQLAlchemy, Alembic, Celery, Redis, PostgreSQL |
| Frontend deploy | Netlify (auto-deploy from `main`) |
| Backend deploy | Railway (API service + Worker service + Postgres + Redis) |
| Payments | Stripe |
| AI | OpenAI (GPT-4), optional Gemini / Claude / Perplexity |
| Voice | Vapi + Twilio |
| Monitoring | Sentry (frontend + backend) |

---

## J. Worden | Authority — Per-city Verified Proof engine

Tenant-aware content engine that produces equipment-specific, technically credible per-city copy for the 56-city Virginia grid (and any customer site the Website Factory spins up). Powered by Gemini 2.5 Flash with GPT-4o fallback, all routed through the unified [app/services/llm_client.py](app/services/llm_client.py). Designed to win the May 2026 Google Core Update by giving the algorithm prerendered, structurally-sound proof content instead of generic marketing fluff.

**Architecture**

```
LOCATIONS (src/lib/locations.js)
  → scripts/ai-authority-factory.mjs   (build-time, per tenant)
    → GET /api/v1/authority/local-proof (FastAPI on Railway)
      → app/services/ai_foreman.py
        → llm_client.chat(task='city_authority', ...)
          → Gemini 2.5 Flash  (primary)  or  GPT-4o  (fallback)
  ← cache: src/generated/authorityContent.{tenant}.json (committed)
  → Vite build + postbuild prerender → static HTML indexed by Google
```

Every successful generation logs a row to `audit_events` (existing table — no migration) with `event_type='authority_generation'`, enabling per-tenant cost ledger in the Command Center.

**City grid**: 56 Virginia entries — 15 rich entries (original) + 41 skeletal entries ported from `genewgeorge76/spacexgeminijworden`. Skeletal entries render correctly because city-page components null-check optional rich fields (neighborhoods, climate, faqs). Backfill rich content per city in a future pass.

**Regenerate content locally**

```bash
# Plan only — log what would happen, no API calls, no writes
npm run ai:authority:dry-run

# Generate just two cities (uses VITE_API_BASE_URL or --api-base)
node scripts/ai-authority-factory.mjs --cities=chester-va,richmond-va

# Force-regenerate all VA cities (ignore the TTL cache)
npm run ai:authority:force

# Tighten freshness window
node scripts/ai-authority-factory.mjs --ttl-days=7

# Different tenant (enterprise customer site)
node scripts/ai-authority-factory.mjs --tenant=acme
```

**Build pipeline**: Netlify runs `npm run ai:authority && npm run build` automatically. Cache file is committed for build determinism; Railway-down builds degrade to the last cached content rather than failing.

**Required env vars**
- Railway: `GEMINI_API_KEY` (or `GOOGLE_API_KEY` — `llm_client.py` accepts either)
- Netlify build: `VITE_API_BASE_URL` (set in [netlify.toml](netlify.toml))

**Endpoint reference**

```
GET /api/v1/authority/local-proof
  ?tenant=jworden              (site-factory profile key, default 'jworden')
  &city=Richmond               (required)
  &project_type=...            (default 'commercial parking lot repaving')
  &equipment=Mauldin 690,LeeBoy
  &state=VA                    (optional override, e.g. 'NC' for OBX)

→ 200 ProofResponse  { tenant, city, verified_content, model, provider, fallback_used, latency_ms }
→ 400 if tenant is not in siteFactoryManifest.json
→ 502 if all providers in the city_authority chain fail
```

See [.env.example](.env.example) for the full variable list and [scripts/factory-launch-pack.mjs](scripts/factory-launch-pack.mjs) for how Authority generation slots into new-market launches.

---

## Local Development

### Prerequisites

- Node 20+
- Python 3.11+
- PostgreSQL (or use the Railway dev database)

### Frontend

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev:web                # starts on http://127.0.0.1:5173
```

### Backend

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
alembic upgrade head
npm run dev:backend            # starts on first bindable local port (default 8003)
```

If port 8000 is blocked on your machine (common on Windows), the backend launcher
automatically picks a bindable port and prints the exact URL.

---

## Environment Variables

### Frontend (Netlify / `.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | FastAPI backend URL — e.g. `https://jworden-api.up.railway.app` |
| `VITE_AUTH_MODE` | ✅ | Auth gate mode. Set to `none` to disable for public-only builds |
| `VITE_SENTRY_DSN` | ⚠️ | Frontend Sentry DSN (optional — enables browser error tracking) |
| `VITE_GA4_ID` | ⚠️ | Google Analytics 4 measurement ID |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ⚠️ | Stripe publishable key (`pk_live_...` or `pk_test_...`) |
| `VITE_SITE_URL` | ⚠️ | Canonical site URL — e.g. `https://www.jwordenasphaltpaving.com` |

### Backend (Railway Variables tab)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (auto-set by Railway Postgres plugin) |
| `REDIS_URL` | ✅ | Redis connection string (auto-set by Railway Redis plugin) |
| `JWORDEN_MASTER_KEY` | ✅ | Long-lived API key — generate with `openssl rand -hex 32` |
| `JWT_SECRET_KEY` | ✅ | JWT signing secret — generate with `openssl rand -hex 32` |
| `ADMIN_USERNAME` | ✅ | Admin dashboard username (default: `admin`) |
| `ADMIN_PASSWORD` | ✅ | Admin dashboard password — must be set or admin routes return 503 |
| `OPENAI_API_KEY` | ⚠️ | Required for AI chat, photo inspection, blog drafts |
| `GOOGLE_API_KEY` | ⚠️ | Required for live Google Maps / Places data |
| `STRIPE_SECRET_KEY` | ⚠️ | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ | Stripe webhook signing secret |
| `TWILIO_ACCOUNT_SID` | ⚠️ | Twilio account SID (voice features) |
| `TWILIO_AUTH_TOKEN` | ⚠️ | Twilio auth token (voice features) |
| `TWILIO_PHONE_NUMBER` | ⚠️ | Twilio number in E.164 format — e.g. `+18045550100` |
| `SENTRY_DSN` | ⚠️ | Backend Sentry DSN |
| `SENTRY_ENVIRONMENT` | ⚠️ | Set to `production` for Railway deploys |

Full reference: see [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md)

---

## Deployment

### Netlify (frontend)

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | `20` |

SPA fallback and `jwordenasphaltpaving.com → www` redirects are pre-configured in `netlify.toml`.

### Railway (backend)

Start command (set in Railway → Service → Settings → Deploy):

```
bash scripts/railway_start.sh
```

This runs `alembic upgrade head` before starting Gunicorn so migrations are always applied on every deploy.

Full checklist: see [`DEPLOYMENT.md`](DEPLOYMENT.md)

---

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint (quiet) |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run ai:build-pages` | AI page factory (generates pages from blueprints) |
| `npm run ops:preflight` | Pre-deploy repo health check |
| `npm run ops:live-check` | Verify live deployment is healthy |
| `npm run ops:tech-radar` | Run AI capability/tech radar snapshot + report |
| `npm run ops:tech-radar:diff` | Show only new items since last radar snapshot |
| `npm run ops:logic-snapshot` | Capture full logic snapshot with old/new catalog |
| `npm run ops:clean-house` | Generate non-destructive repo cleanup report |
| `npm run ops:legal-advisory` | Generate legal advisory change + impact report |
| `npm run ops:legal-advisory:update-baseline` | Generate report and advance legal advisory baseline |
| `npm run ops:reliability-synthetic` | Run synthetic uptime + latency monitor and write reliability artifacts |
| `npm run ops:phase2` | Run logic snapshot + clean-house report together |
| `npm run mrworden:cli` | Mr. Worden admin CLI (lead management) |
| `npm run media:ingest` | Media ingest CLI (Dropbox / Google Photos) |

---

## Project Structure

```
src/
  api/          — API client (src/api/client.js)
  components/   — Reusable UI components + admin panels
  generated/    — AI-generated page registry
  hooks/        — Custom React hooks
  lib/          — Auth context, utilities, business data
  pages/        — Route-level page components
  utils/        — Shared utilities
app/
  main.py       — FastAPI app entry point
  models.py     — SQLAlchemy ORM models
  routers/      — API route handlers
  services/     — Business logic
  tasks/        — Celery background tasks
  core/         — Security, config, dependencies
alembic/        — Database migration history
scripts/        — Ops, SEO, and deploy scripts
```

---

## Documentation

| File | Topic |
|---|---|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Full Railway + Netlify deployment checklist |
| [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md) | All env vars with sensitivity classification |
| [`SECURITY.md`](SECURITY.md) | Auth flows, secrets management, OWASP notes |
| [`TESTING.md`](TESTING.md) | cURL endpoint tests, Playwright setup |
| [`MONITORING.md`](MONITORING.md) | Sentry + uptime monitoring setup |
| [`docs/RELIABILITY_SLO.md`](docs/RELIABILITY_SLO.md) | SLO targets, error budget, and self-heal incident playbooks |
| [`docs/AI_TECH_RADAR.md`](docs/AI_TECH_RADAR.md) | Automated AI capability monitoring workflow |
| [`docs/CLEAN_HOUSE_PHASE2.md`](docs/CLEAN_HOUSE_PHASE2.md) | Logic preservation + cleanup batch workflow |
| [`docs/LEGAL_ADVISORY_LAUNCH.md`](docs/LEGAL_ADVISORY_LAUNCH.md) | Launch + compliance advisory packaging and rollout |
| [`BACKEND_LOGIC_INVENTORY.md`](BACKEND_LOGIC_INVENTORY.md) | All API endpoint inventory |
| [`WEBSOCKET_CHAT.md`](WEBSOCKET_CHAT.md) | Real-time chat / WebSocket setup |
| [`VECTOR_SEARCH.md`](VECTOR_SEARCH.md) | Semantic search / vector store setup |

