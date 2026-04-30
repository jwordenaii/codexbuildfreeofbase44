# Environment Variables Reference

Complete reference for every environment variable used by the JWordenAI backend.
Set production values in Railway's **Variables** tab. Never commit secrets to git.

---

## Sensitivity Classification

| Classification | Meaning |
|---|---|
| 🔴 **SECRET** | Never expose. Rotate immediately if leaked. |
| 🟡 **INTERNAL** | Safe within the team; do not expose publicly. |
| 🟢 **SAFE** | Safe to expose in logs, dashboards, or documentation. |

---

## Required Variables

These must be set for the application to start and function correctly in production.

| Variable | Sensitivity | Description | How to Generate |
|---|---|---|---|
| `DATABASE_URL` | 🔴 SECRET | PostgreSQL connection string | Auto-set by Railway Postgres plugin when services are linked |
| `REDIS_URL` | 🔴 SECRET | Redis connection string (Celery broker + result backend) | Auto-set by Railway Redis plugin when services are linked |
| `JWORDEN_MASTER_KEY` | 🔴 SECRET | Long-lived master API key. Accepted directly as a Bearer token or exchanged for a JWT via `POST /api/v1/auth/token` | `openssl rand -hex 32` |
| `JWT_SECRET_KEY` | 🔴 SECRET | HMAC-SHA256 secret used to sign and verify JWT tokens | `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | 🔴 SECRET | Password for the `/admin` dashboard (HTTP Basic auth). No default — admin routes return 503 if unset | `openssl rand -base64 24` |

---

## Authentication Variables

| Variable | Sensitivity | Default | Description |
|---|---|---|---|
| `JWORDEN_MASTER_KEY` | 🔴 SECRET | *(none — required)* | Master API key. Used directly as a Bearer token or to issue JWTs. Rotate with `openssl rand -hex 32`. |
| `JWT_SECRET_KEY` | 🔴 SECRET | *(none — required for JWT)* | Signs and verifies HS256 JWTs. If unset, the master key still works for direct Bearer auth, but `/api/v1/auth/token` returns 500. |
| `ADMIN_USERNAME` | 🟡 INTERNAL | `admin` | Username for the `/admin` dashboard. |
| `ADMIN_PASSWORD` | 🔴 SECRET | *(none — required)* | Password for the `/admin` dashboard. Must be set or all admin routes return 503. |

---

## External API Keys

| Variable | Sensitivity | Used By | Notes |
|---|---|---|---|
| `OPENAI_API_KEY` | 🔴 SECRET | `/api/v1/ai/photo-inspect`, `/api/v1/ai/chat`, `/api/v1/ai/contact-suggest`, `/api/v1/blog/draft`, `/api/v1/project-metrics/{id}/case-study` | Required for all AI features. Endpoints return stubs or 500 without it. |
| `GOOGLE_API_KEY` | 🔴 SECRET | Geo endpoints, review fetching | Required for live Google Maps / Places data. |
| `STRIPE_SECRET_KEY` | 🔴 SECRET | `/api/v1/payments/checkout-session` | Stripe secret key. Use `sk_test_...` for staging, `sk_live_...` for production. |
| `STRIPE_WEBHOOK_SECRET` | 🔴 SECRET | `/api/v1/payments/webhook` | Stripe webhook signing secret. Obtained from the Stripe dashboard → Webhooks. |
| `STRIPE_SUCCESS_URL` | 🟢 SAFE | `/api/v1/payments/checkout-session` | Redirect URL after successful payment. Default: `http://localhost:5173/quote?payment=success` |
| `STRIPE_CANCEL_URL` | 🟢 SAFE | `/api/v1/payments/checkout-session` | Redirect URL after cancelled payment. Default: `http://localhost:5173/quote?payment=cancel` |
| `TWILIO_ACCOUNT_SID` | 🔴 SECRET | `/api/v1/voice/*` | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | 🔴 SECRET | `/api/v1/voice/*` | Twilio auth token. |
| `TWILIO_PHONE_NUMBER` | 🟡 INTERNAL | `/api/v1/voice/*` | Twilio phone number in E.164 format (e.g. `+18045550100`). |
| `OPENWEATHERMAP_API_KEY` | 🔴 SECRET | `/api/v1/weather/*` | OpenWeatherMap API key. |

---

## Email Variables

| Variable | Sensitivity | Default | Description |
|---|---|---|---|
| `RESEND_API_KEY` | 🔴 SECRET | *(none)* | Resend transactional email API key. Primary email provider. |
| `RESEND_FROM_EMAIL` | 🟡 INTERNAL | *(none)* | Sender address for Resend emails (e.g. `noreply@jwordenasphaltpaving.com`). |
| `SMTP_HOST` | 🟡 INTERNAL | *(none)* | Fallback SMTP host if Resend is unavailable. |
| `SMTP_USER` | 🟡 INTERNAL | *(none)* | Fallback SMTP username. |
| `SMTP_PASSWORD` | 🔴 SECRET | *(none)* | Fallback SMTP password. |

---

## Observability Variables

| Variable | Sensitivity | Default | Description |
|---|---|---|---|
| `SENTRY_DSN` | 🟡 INTERNAL | *(disabled)* | Sentry DSN for error tracking and performance monitoring. If unset, Sentry is disabled. |
| `SENTRY_TRACES_SAMPLE_RATE` | 🟢 SAFE | `0.1` | Fraction of transactions sent to Sentry (0.0–1.0). `0.1` = 10% sampling. |
| `LOG_FORMAT` | 🟢 SAFE | `text` | Log output format. Use `json` in production for Railway log aggregation; `text` for local development. |
| `LOG_LEVEL` | 🟢 SAFE | `INFO` | Minimum log level: `DEBUG`, `INFO`, `WARNING`, `ERROR`. |

---

## Application Behaviour Variables

| Variable | Sensitivity | Default | Description |
|---|---|---|---|
| `AUTO_CREATE_TABLES` | 🟢 SAFE | `true` | Automatically create DB tables on startup. Set to `false` in production — Alembic manages schema. |
| `EXTRA_CORS_ORIGINS` | 🟢 SAFE | *(none)* | Comma-separated list of additional allowed CORS origins. Built-in origins: `https://jworden.netlify.app`, `https://jwordenasphaltpaving.com`, `http://localhost:5173`, `http://localhost:3000`. |

---

## Database Pool Tuning

These variables tune the SQLAlchemy connection pool. The defaults are appropriate
for most Railway deployments. Increase `DB_POOL_SIZE` if you see connection timeout errors.

| Variable | Sensitivity | Default | Description |
|---|---|---|---|
| `DB_POOL_SIZE` | 🟢 SAFE | `10` | Number of persistent connections in the pool. |
| `DB_MAX_OVERFLOW` | 🟢 SAFE | `20` | Extra connections allowed beyond `DB_POOL_SIZE`. |
| `DB_POOL_RECYCLE` | 🟢 SAFE | `1800` | Seconds before idle connections are recycled (prevents stale connections). |
| `DB_POOL_TIMEOUT` | 🟢 SAFE | `30` | Seconds to wait for a connection before raising an error. |

---

## Celery / Redis Variables

| Variable | Sensitivity | Default | Description |
|---|---|---|---|
| `REDIS_URL` | 🔴 SECRET | `redis://localhost:6379/0` | Redis URL used as Celery broker and result backend. |
| `CELERY_RESULT_BACKEND` | 🔴 SECRET | *(same as `REDIS_URL`)* | Override the Celery result backend URL. |

---

## Railway-Injected Variables (Read-Only)

These are set automatically by Railway and are available at runtime. Do not set them manually.

| Variable | Sensitivity | Description |
|---|---|---|
| `RAILWAY_GIT_COMMIT_SHA` | 🟢 SAFE | Git commit SHA of the current deployment. Used as the Sentry `release` tag. |
| `RAILWAY_ENVIRONMENT_NAME` | 🟢 SAFE | Railway environment name (e.g. `production`, `staging`). Used as the Sentry `environment` tag. |

---

## How to Set Variables in Railway

### Via the Dashboard

1. Railway dashboard → select your project
2. Click the **API** service (or **Worker** / **Beat** as appropriate)
3. Click the **Variables** tab
4. Click **New Variable**, enter the name and value, click **Add**
5. Click **Save** — Railway triggers a redeploy automatically

### Via the Railway CLI

```bash
# Set a single variable
railway variables set JWORDEN_MASTER_KEY="$(openssl rand -hex 32)" --service api

# Set multiple variables
railway variables set \
  JWT_SECRET_KEY="$(openssl rand -hex 32)" \
  LOG_FORMAT="json" \
  AUTO_CREATE_TABLES="false" \
  --service api

# View all current variables
railway variables --service api

# Delete a variable
railway variables delete OLD_VAR_NAME --service api
```

---

## How to Set Variables Locally (.env)

Create a `.env` file in the project root. This file is loaded automatically by
`python-dotenv` at startup. **Never commit this file to git** — it is listed in `.gitignore`.

```env
# .env — local development only

# Database (SQLite for local dev, PostgreSQL for staging/prod)
DATABASE_URL=sqlite:///./jworden_leads.db

# Redis (local Redis instance)
REDIS_URL=redis://localhost:6379/0

# Auth
JWORDEN_MASTER_KEY=dev-master-key-change-in-prod
JWT_SECRET_KEY=dev-jwt-secret-change-in-prod

# Admin dashboard
ADMIN_USERNAME=admin
ADMIN_PASSWORD=dev-admin-password

# OpenAI
OPENAI_API_KEY=sk-proj-your-key-here

# Logging
LOG_FORMAT=text
LOG_LEVEL=DEBUG

# Schema management
AUTO_CREATE_TABLES=true
```

---

## Which Services Need Which Variables

| Variable | API | Worker | Beat |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ |
| `REDIS_URL` | ✅ | ✅ | ✅ |
| `JWORDEN_MASTER_KEY` | ✅ | — | — |
| `JWT_SECRET_KEY` | ✅ | — | — |
| `ADMIN_USERNAME` | ✅ | — | — |
| `ADMIN_PASSWORD` | ✅ | — | — |
| `OPENAI_API_KEY` | ✅ | ✅ | — |
| `SENTRY_DSN` | ✅ | ✅ | — |
| `STRIPE_SECRET_KEY` | ✅ | — | — |
| `STRIPE_WEBHOOK_SECRET` | ✅ | — | — |
| `TWILIO_ACCOUNT_SID` | ✅ | — | — |
| `TWILIO_AUTH_TOKEN` | ✅ | — | — |
| `RESEND_API_KEY` | ✅ | ✅ | — |
| `LOG_FORMAT` | ✅ | ✅ | ✅ |
| `LOG_LEVEL` | ✅ | ✅ | ✅ |
| `AUTO_CREATE_TABLES` | ✅ | — | — |
| `EXTRA_CORS_ORIGINS` | ✅ | — | — |
| `CELERY_RESULT_BACKEND` | — | ✅ | ✅ |

---

## When to Rotate Secrets

| Variable | Rotate When |
|---|---|
| `JWORDEN_MASTER_KEY` | Leaked, shared with a departing team member, or every 90 days |
| `JWT_SECRET_KEY` | Leaked, or when you need to invalidate all active sessions immediately |
| `ADMIN_PASSWORD` | Leaked, or when admin access changes hands |
| `OPENAI_API_KEY` | Leaked, or when rotating per OpenAI's security recommendations |
| `STRIPE_SECRET_KEY` | Leaked, or when rotating per Stripe's security recommendations |
| `DATABASE_URL` | After a database credential rotation (Railway Postgres → Credentials → Rotate) |

### Rotation Procedure

```bash
# 1. Generate a new value
openssl rand -hex 32

# 2. Update in Railway
railway variables set JWORDEN_MASTER_KEY="<new-value>" --service api

# 3. Railway auto-redeploys — verify the new key works
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer <new-value>"

# 4. Confirm the old key is rejected
curl -i "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer <old-value>"
# Expected: HTTP 403 Forbidden
```

> **Note:** Rotating `JWT_SECRET_KEY` immediately invalidates all outstanding JWTs.
> Any active frontend sessions will receive a 403 on their next request and must
> re-authenticate by calling `POST /api/v1/auth/token` with the master key.
