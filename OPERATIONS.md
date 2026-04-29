# Operations Runbook

Day-to-day operations guide for the JWordenAI backend.

---

## Checking System Health

### Quick Status Check

```bash
BASE="https://<your-railway-domain>"

# 1. API health
curl -s "$BASE/health"
# Expected: {"status": "ok", "service": "JWordenAI"}

# 2. Database connectivity (via a protected endpoint)
curl -s "$BASE/api/v1/crm/funnel" \
  -H "Authorization: Bearer $MASTER_KEY"
# Expected: JSON with funnel stage counts

# 3. Celery worker status (from Railway CLI)
railway run --service worker celery -A app.celery_app inspect ping
# Expected: {"celery@<hostname>": {"ok": "pong"}}
```

### Full Health Dashboard

```bash
# Analytics dashboard — confirms DB reads are working
curl -s "$BASE/api/v1/analytics/dashboard" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool
```

---

## Viewing Logs

```bash
# Live API logs
railway logs --service api

# Live worker logs
railway logs --service worker

# Live beat scheduler logs
railway logs --service beat

# Last 500 lines from API
railway logs --service api --tail 500

# Filter for errors only (pipe through grep)
railway logs --service api | grep -i "error\|exception\|traceback"
```

---

## Rotating the Master Key

The master key (`JWORDEN_MASTER_KEY`) is a long-lived credential. Rotate it if it is ever exposed or as part of a regular security review.

### Steps

1. **Generate a new key:**
   ```bash
   openssl rand -hex 32
   ```

2. **Update Railway:**
   - Railway dashboard → API service → **Variables**
   - Update `JWORDEN_MASTER_KEY` to the new value
   - Click **Save** — Railway will trigger a redeploy automatically

3. **Update the frontend server-side function:**
   - If the frontend server-side function uses the master key directly (not recommended — it should use `JWT_SECRET_KEY`), update it there too

4. **Verify the new key works:**
   ```bash
   NEW_KEY="<new-key>"
   curl -s "$BASE/api/v1/crm/leads" \
     -H "Authorization: Bearer $NEW_KEY"
   # Expected: 200 OK with leads JSON
   ```

5. **Confirm the old key is rejected:**
   ```bash
   OLD_KEY="<old-key>"
   curl -i "$BASE/api/v1/crm/leads" \
     -H "Authorization: Bearer $OLD_KEY"
   # Expected: 403 Forbidden
   ```

### Rotating the JWT Secret Key

Rotating `JWT_SECRET_KEY` immediately invalidates all outstanding JWTs. Any frontend sessions will need to re-authenticate.

```bash
# Generate new secret
openssl rand -hex 32

# Update in Railway → API service → Variables → JWT_SECRET_KEY
# Redeploy triggers automatically
```

After rotation, the frontend's server-side token function will generate new JWTs signed with the new secret on the next call. Existing in-memory tokens will fail with 403 and trigger a refresh (see `FRONTEND_INTEGRATION.md`).

---

## Database Migrations

### Applying Migrations

```bash
# Apply all pending migrations
railway run --service api alembic upgrade head

# Check current revision
railway run --service api alembic current

# Show migration history
railway run --service api alembic history
```

### Creating a New Migration

```bash
# Locally (with DATABASE_URL pointing to production or a staging DB)
alembic revision -m "add_column_to_leads"

# Edit the generated file in alembic/versions/
# Then apply
alembic upgrade head
```

### Rolling Back a Migration

```bash
# Roll back one step
railway run --service api alembic downgrade -1

# Roll back to a specific revision
railway run --service api alembic downgrade bc2d5f75bee4
```

### Stamping the Baseline (First-Time Setup)

For environments where tables were created by `AUTO_CREATE_TABLES=true` before Alembic was introduced:

```bash
railway run --service api alembic stamp bc2d5f75bee4
railway run --service api alembic current
# Should show: bc2d5f75bee4 (head)
```

Then set `AUTO_CREATE_TABLES=false` in Railway variables.

---

## Scaling Celery Workers

### Increase Worker Concurrency

The default concurrency is 4 threads per worker process. Increase it for higher task throughput:

In the Railway Worker service **Start Command**, change:

```bash
# Default
celery -A app.celery_app worker --loglevel=info --concurrency=4 --queues=celery

# Higher throughput
celery -A app.celery_app worker --loglevel=info --concurrency=8 --queues=celery
```

### Add More Worker Replicas

In Railway dashboard → Worker service → **Settings** → **Replicas**, increase the replica count. Each replica runs an independent worker process.

### Monitor Queue Depth

```bash
# Check how many tasks are waiting
redis-cli -u $REDIS_URL llen celery

# Check active tasks
railway run --service worker celery -A app.celery_app inspect active
```

A queue depth above 500 is a signal to add replicas or increase concurrency.

---

## Handling Database Migrations in Production

Follow this sequence to apply schema changes with zero downtime:

1. **Deploy the new code** — if the new code is backward-compatible with the old schema, deploy first
2. **Apply the migration** — `railway run --service api alembic upgrade head`
3. **Verify** — check the API health endpoint and run a smoke test
4. **If the migration is not backward-compatible** — put the API in maintenance mode (scale replicas to 0), apply the migration, then scale back up

---

## Backing Up Data

### PostgreSQL Backup

Railway's managed Postgres includes automatic daily backups. To take a manual backup:

```bash
# From the Railway CLI or a local machine with pg_dump installed
pg_dump "$DATABASE_URL" -Fc -f "jworden_backup_$(date +%Y%m%d).dump"
```

Store backups in an S3 bucket or equivalent object storage.

### Restoring from Backup

```bash
pg_restore -d "$DATABASE_URL" --clean --no-owner jworden_backup_20250601.dump
```

**Warning:** `--clean` drops and recreates all tables. Only use this on a fresh database or in a recovery scenario.

### Redis Backup

Redis is used for Celery task queuing and result storage only — it is not the source of truth for any business data. If Redis is lost, in-flight tasks will be lost but no permanent data is affected. The Celery Beat schedule will resume on the next worker restart.

---

## Responding to Alerts

### Alert: API Health Check Failed

1. Check Railway dashboard — is the service running?
2. Check deployment logs for startup errors: `railway logs --service api --tail 100`
3. If the service is running but `/health` is failing, check for database connectivity issues
4. If the service is crashed, Railway will restart it automatically — monitor the restart

**Escalate if:** The service fails to restart after 3 attempts, or if the health check fails for more than 5 minutes.

### Alert: Deployment Failed

1. Open the failed deployment in the Railway dashboard
2. Read the build logs — look for pip install errors or import errors
3. Common causes:
   - A new dependency was added to `requirements.txt` but is not installable
   - A syntax error in a Python file
   - An environment variable referenced at import time is missing
4. Fix the issue in a new commit and push — Railway will retry the deployment

### Alert: Worker Service Crashed

1. Check worker logs: `railway logs --service worker --tail 100`
2. Common causes:
   - Redis is unreachable — check `REDIS_URL` and Redis service status
   - A task raised an unhandled exception that killed the worker process
3. Railway will restart the worker automatically
4. If the crash is recurring, check Sentry for the exception traceback

### Alert: High Memory Usage

1. Check which service is consuming memory (Railway Metrics tab)
2. For the API service: look for memory leaks in long-running requests or large response payloads
3. For the Worker service: a task may be loading a large dataset into memory
4. Short-term fix: restart the service (Railway dashboard → service → **Restart**)
5. Long-term fix: profile the memory usage and fix the leak

### Alert: High Error Rate

1. Check Sentry for the most frequent exceptions
2. Check API logs for 500 responses: `railway logs --service api | grep " 500 "`
3. Common causes:
   - Database connection pool exhausted (increase `DB_POOL_SIZE`)
   - OpenAI API quota exceeded (check OpenAI dashboard)
   - A recent deployment introduced a bug (roll back if needed)

---

## Rolling Back a Deployment

Railway keeps a deployment history. To roll back:

1. Railway dashboard → API service → **Deployments**
2. Find the last known-good deployment
3. Click **Redeploy** on that deployment

This redeploys the previous Docker image without a new build.

**Note:** Rolling back the code does not roll back database migrations. If the migration is incompatible with the old code, roll back the migration first:

```bash
railway run --service api alembic downgrade -1
```

---

## Maintenance Mode

To take the API offline for maintenance (e.g. a large migration):

1. Railway dashboard → API service → **Settings** → **Replicas** → set to `0`
2. Perform maintenance
3. Set replicas back to the desired count

During maintenance, all requests will receive a `502 Bad Gateway` from Railway's edge.

---

## Environment Variable Reference

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | API, Worker, Beat | PostgreSQL connection string |
| `REDIS_URL` | API, Worker, Beat | Redis connection string |
| `JWORDEN_MASTER_KEY` | API | Long-lived bearer token for internal auth |
| `JWT_SECRET_KEY` | API | Secret for signing JWTs |
| `ADMIN_USERNAME` | API | Admin dashboard username |
| `ADMIN_PASSWORD` | API | Admin dashboard password |
| `AUTO_CREATE_TABLES` | API | `false` in production |
| `OPENAI_API_KEY` | API, Worker | OpenAI API key for AI features |
| `SENTRY_DSN` | API | Sentry error tracking DSN |
| `SENTRY_TRACES_SAMPLE_RATE` | API | Sentry performance sampling rate (0.0–1.0) |
| `RESEND_API_KEY` | API | Resend transactional email API key |
| `RESEND_FROM_EMAIL` | API | Sender address for Resend |
| `SMTP_HOST` | API | Fallback SMTP host |
| `SMTP_USER` | API | Fallback SMTP username |
| `SMTP_PASSWORD` | API | Fallback SMTP password |
| `EXTRA_CORS_ORIGINS` | API | Comma-separated additional CORS origins |
| `DB_POOL_SIZE` | API | SQLAlchemy connection pool size (default: 10) |
| `DB_MAX_OVERFLOW` | API | SQLAlchemy max overflow (default: 20) |
| `DB_POOL_RECYCLE` | API | Connection recycle interval in seconds (default: 1800) |
| `DB_POOL_TIMEOUT` | API | Connection acquisition timeout in seconds (default: 30) |
| `CELERY_RESULT_BACKEND` | Worker, Beat | Celery result backend URL (defaults to `REDIS_URL`) |
