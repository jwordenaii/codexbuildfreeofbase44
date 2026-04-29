# Environment Variables

Complete reference for all environment variables used by the JWordenAI backend.
Set these in Railway's **Variables** tab (or your `.env` file for local development).

---

## Required Variables

These must be set for the application to function correctly in production.

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `REDIS_URL` | Redis connection string (Celery broker + result backend) | `redis://default:pass@host:6379/0` |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o vision and chat endpoints | `sk-proj-...` |
| `JWORDEN_MASTER_KEY` | Long-lived master API key for internal tools and admin access | `jworden-prod-...` (generate with `openssl rand -hex 32`) |

---

## Authentication Variables

| Variable | Description | Default | Example |
|---|---|---|---|
| `JWORDEN_MASTER_KEY` | Master API key — accepted directly as a Bearer token or exchanged for a JWT via `POST /api/v1/auth/token` | *(none — required)* | `jworden-prod-abc123` |
| `JWT_SECRET_KEY` | HMAC-SHA256 secret used to sign and verify JWT tokens. Required for JWT auth to work. | *(none — required for JWT)* | `super-secret-key-min-32-chars` (generate with `openssl rand -hex 32`) |

> **Note:** If `JWT_SECRET_KEY` is not set, the master key still works for direct Bearer auth, but the `/api/v1/auth/token` endpoint will return 500.

---

## Optional Variables

| Variable | Description | Default | Example |
|---|---|---|---|
| `SENTRY_DSN` | Sentry DSN for error tracking and performance monitoring | *(disabled)* | `https://abc@o123.ingest.sentry.io/456` |
| `SENTRY_TRACES_SAMPLE_RATE` | Fraction of transactions to send to Sentry (0.0–1.0) | `0.1` | `0.25` |
| `LOG_FORMAT` | Log output format: `json` for structured logs (production), `text` for human-readable (development) | `text` | `json` |
| `LOG_LEVEL` | Minimum log level: `DEBUG`, `INFO`, `WARNING`, `ERROR` | `INFO` | `INFO` |
| `ADMIN_USERNAME` | Username for the admin dashboard | *(none)* | `admin` |
| `ADMIN_PASSWORD` | Password for the admin dashboard | *(none)* | `change-me-in-prod` |
| `AUTO_CREATE_TABLES` | Automatically create DB tables on startup (disable when using Alembic migrations) | `true` | `false` |
| `EXTRA_CORS_ORIGINS` | Comma-separated list of additional allowed CORS origins | *(none)* | `https://app.example.com,https://staging.example.com` |

---

## External API Keys

| Variable | Description | Used By |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | `/api/v1/ai/photo-inspect`, `/api/v1/ai/chat`, `/api/v1/ai/contact-suggest` |
| `GOOGLE_API_KEY` | Google Maps / Places API key | Geo endpoints, review fetching |
| `STRIPE_SECRET_KEY` | Stripe secret key for payment processing | `/api/v1/payments/checkout-session` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `/api/v1/payments/webhook` |
| `STRIPE_SUCCESS_URL` | Redirect URL after successful Stripe payment | `/api/v1/payments/checkout-session` |
| `STRIPE_CANCEL_URL` | Redirect URL after cancelled Stripe payment | `/api/v1/payments/checkout-session` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for voice/SMS | `/api/v1/voice/*` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `/api/v1/voice/*` |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (E.164 format) | `/api/v1/voice/*` |
| `OPENWEATHERMAP_API_KEY` | OpenWeatherMap API key for weather data | `/api/v1/weather/*` |

---

## Database Pool Tuning

These variables tune the SQLAlchemy connection pool for PostgreSQL. The defaults
are appropriate for most Railway deployments.

| Variable | Description | Default |
|---|---|---|
| `DB_POOL_SIZE` | Number of persistent connections in the pool | `10` |
| `DB_MAX_OVERFLOW` | Extra connections allowed beyond `DB_POOL_SIZE` | `20` |
| `DB_POOL_RECYCLE` | Seconds before idle connections are recycled | `1800` |
| `DB_POOL_TIMEOUT` | Seconds to wait for a connection before raising an error | `30` |

---

## Celery / Redis

| Variable | Description | Default |
|---|---|---|
| `REDIS_URL` | Redis URL used as Celery broker and result backend | `redis://localhost:6379/0` |
| `CELERY_RESULT_BACKEND` | Override the Celery result backend URL (defaults to `REDIS_URL`) | *(same as `REDIS_URL`)* |

---

## Railway Deployment Checklist

After merging the production infrastructure PR:

1. **Set `SENTRY_DSN`** — paste your Sentry project DSN for error tracking (optional but strongly recommended).
2. **Set `JWT_SECRET_KEY`** — generate with `openssl rand -hex 32`. Required for the `/api/v1/auth/token` endpoint.
3. **Set `LOG_FORMAT=json`** — enables structured JSON logs for Railway's log aggregation.
4. **Configure Railway health check** — set the health check path to `/health/ready` in your Railway service settings.
5. **Monitor metrics** — poll `/api/v1/metrics/celery`, `/api/v1/metrics/redis`, and `/api/v1/metrics/database` from your ops dashboard using the master key or a JWT.

---

## Local Development

Create a `.env` file in the project root (never commit this file):

```env
DATABASE_URL=sqlite:///./jworden_leads.db
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-proj-your-key-here
JWORDEN_MASTER_KEY=dev-master-key-change-in-prod
JWT_SECRET_KEY=dev-jwt-secret-change-in-prod
LOG_FORMAT=text
LOG_LEVEL=DEBUG
AUTO_CREATE_TABLES=true
```
