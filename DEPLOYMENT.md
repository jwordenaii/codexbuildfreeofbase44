# Deployment Guide

Complete deployment checklist for the JWordenAI backend on Railway.

---

## Prerequisites

Before deploying, confirm the following are in place:

- A Railway project with four services provisioned: **API**, **Worker**, **Postgres**, and **Redis**
- All required environment variables set in Railway (see table below)
- PRs #60 (security) and #61 (monitoring) reviewed and approved

### Required Environment Variables

Set these in the Railway dashboard under each service's **Variables** tab. The API and Worker services share most of them.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (auto-set by Railway Postgres plugin) |
| `REDIS_URL` | ✅ | Redis connection string (auto-set by Railway Redis plugin) |
| `JWORDEN_MASTER_KEY` | ✅ | Long-lived API key for internal/frontend auth — generate with `openssl rand -hex 32` |
| `JWT_SECRET_KEY` | ✅ | Secret used to sign JWTs — generate with `openssl rand -hex 32` |
| `ADMIN_USERNAME` | ✅ | Username for the `/admin` dashboard (default: `admin`) |
| `ADMIN_PASSWORD` | ✅ | Password for the `/admin` dashboard — must be set or admin routes return 503 |
| `AUTO_CREATE_TABLES` | ✅ | Set to `false` in production; Alembic manages schema |
| `OPENAI_API_KEY` | ⚠️ | Required for AI chat and photo inspection; endpoints fall back to stubs without it |
| `SENTRY_DSN` | ⚠️ | Optional — enables Sentry error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | ⚠️ | Float 0.0–1.0; defaults to `0.1` (10% of traces) |
| `RESEND_API_KEY` | ⚠️ | Required for transactional email via Resend |
| `RESEND_FROM_EMAIL` | ⚠️ | Sender address for Resend emails |
| `SMTP_HOST` | ⚠️ | Fallback SMTP host if Resend is unavailable |
| `SMTP_USER` | ⚠️ | Fallback SMTP username |
| `SMTP_PASSWORD` | ⚠️ | Fallback SMTP password |
| `EXTRA_CORS_ORIGINS` | ⚠️ | Comma-separated list of additional allowed CORS origins |
| `DB_POOL_SIZE` | ⚠️ | SQLAlchemy pool size (default: `10`) |
| `DB_MAX_OVERFLOW` | ⚠️ | SQLAlchemy max overflow connections (default: `20`) |

---

## Step-by-Step Deployment

### 1. Merge PR #60 — Security

```
GitHub → Pull Requests → #60 → Merge pull request
```

Railway will automatically detect the push to `main` and begin a new deployment. Wait for the deployment to reach **Active** status before proceeding.

### 2. Verify the Security Deployment

```bash
# Health check — should return {"status": "ok", "service": "JWordenAI"}
curl https://<your-railway-domain>/health

# Confirm protected endpoints reject unauthenticated requests
curl -i https://<your-railway-domain>/api/v1/crm/leads
# Expected: HTTP 403 {"detail": "Unauthorized: no token"}
```

### 3. Merge PR #61 — Monitoring

```
GitHub → Pull Requests → #61 → Merge pull request
```

Wait for the deployment to reach **Active** status.

### 4. Verify the Monitoring Deployment

```bash
# Health check still passes
curl https://<your-railway-domain>/health

# Confirm the API docs are reachable
curl -i https://<your-railway-domain>/docs
```

### 5. Run Database Migrations

If this is the first production deployment, stamp the baseline migration so Alembic knows the current schema state:

```bash
# In Railway: open the API service shell, or run via Railway CLI
railway run alembic stamp bc2d5f75bee4

# For subsequent schema changes, apply migrations normally
railway run alembic upgrade head
```

Confirm the current revision:

```bash
railway run alembic current
```

### 6. Confirm Celery Workers Are Running

In the Railway dashboard, open the **Worker** service logs and confirm you see:

```
celery@<hostname> ready.
```

The beat scheduler (if deployed as a separate service) should show:

```
beat: Starting...
```

### 7. End-to-End Smoke Test

```bash
BASE=https://<your-railway-domain>

# Public endpoint
curl -s $BASE/api/v1/leads/estimate \
  -H "Content-Type: application/json" \
  -d '{"service_type":"sealcoating","property_type":"residential","project_size_sqft":2000}'

# Protected endpoint with master key
curl -s $BASE/api/v1/crm/leads \
  -H "Authorization: Bearer $JWORDEN_MASTER_KEY"
```

Both should return `200 OK` with JSON bodies.

---

## Health Check Verification

The primary health endpoint is unauthenticated and suitable for uptime monitors:

```
GET /health
→ {"status": "ok", "service": "JWordenAI"}
```

Set this URL as the health check path in the Railway service settings:

1. Railway dashboard → API service → **Settings** → **Health Check Path**
2. Enter `/health`
3. Railway will restart the service automatically if this endpoint stops responding.

---

## Monitoring Dashboard Setup

See [MONITORING.md](MONITORING.md) for the full monitoring setup guide.

Quick summary:
- Railway metrics are available under each service's **Metrics** tab (CPU, memory, request count)
- Set up Railway alerts under **Project Settings → Notifications**
- Optionally configure Sentry by setting `SENTRY_DSN` in the API service variables

---

## Troubleshooting Common Issues

### Deployment fails to start

Check the Railway build logs for import errors. The most common cause is a missing environment variable that is read at import time.

```bash
railway logs --service api --tail 100
```

### `500 Server authentication is not configured`

`JWT_SECRET_KEY` is not set. Add it to the API service variables and redeploy.

### `503 Admin dashboard is not configured`

`ADMIN_PASSWORD` is not set. Add it to the API service variables and redeploy.

### Database connection errors

Confirm `DATABASE_URL` is set and the Postgres service is running. Railway's Postgres plugin injects this automatically when the services are linked.

```bash
# Test connectivity from the API service shell
railway run python -c "from app.database import engine; engine.connect(); print('OK')"
```

### Celery tasks not processing

Confirm `REDIS_URL` is set in the Worker service variables. Check worker logs for connection errors:

```bash
railway logs --service worker --tail 50
```

### CORS errors from the frontend

Add the frontend origin to `EXTRA_CORS_ORIGINS` in the API service variables:

```
EXTRA_CORS_ORIGINS=https://your-frontend-domain.netlify.app
```

Redeploy the API service after saving.

### Rate limit errors (`429 Too Many Requests`)

The global default is 200 requests/minute per IP. Individual endpoints have tighter limits (30–60/minute). If a legitimate client is being rate-limited, contact the ops team to review the `slowapi` configuration in `app/core/limiter.py`.
