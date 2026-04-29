# Deployment Checklist

Step-by-step checklist for deploying changes to the JWordenAI backend on Railway.
Follow this checklist for every production deployment, no matter how small.

---

## Before Deploying

### Code Quality

- [ ] All changes are committed and pushed to a feature branch
- [ ] Pull request is open and has been reviewed
- [ ] No merge conflicts with `main`

```bash
# Run the test suite locally
pytest -q

# Check for obvious import errors
python3 -c "from app.main import app; print('Import OK')"

# Lint (if configured)
ruff check app/
```

### Environment Variables

- [ ] Any new environment variables are documented in `ENVIRONMENT_VARIABLES.md`
- [ ] New variables are set in Railway **before** merging (not after)
- [ ] No secrets are hardcoded in source code
- [ ] No `VITE_` prefixed variables contain backend secrets

```bash
# Verify required variables are set in Railway
railway variables --service api | grep -E "JWORDEN_MASTER_KEY|JWT_SECRET_KEY|ADMIN_PASSWORD|DATABASE_URL|REDIS_URL"
```

### Database Migrations

- [ ] If the PR adds or modifies database models, a new Alembic migration has been created
- [ ] The migration has been tested locally against a copy of the schema
- [ ] `AUTO_CREATE_TABLES=false` is set in Railway (Alembic manages schema in production)

```bash
# Check current migration state
railway run --service api alembic current

# Preview what will be applied
railway run --service api alembic history --verbose
```

### Security Review

- [ ] New endpoints that should be protected have `Depends(verify_premium_security)`
- [ ] New admin endpoints have `Depends(_require_admin)` and `include_in_schema=False`
- [ ] No new endpoints accidentally expose sensitive data without auth
- [ ] Rate limits are applied to all new public-facing endpoints

---

## During Deployment

### Merge and Monitor

```bash
# After merging the PR to main, Railway auto-deploys.
# Watch the build and deploy logs in real time:
railway logs --service api

# Or watch from the Railway dashboard:
# Dashboard → API service → Deployments → (latest) → View Logs
```

### What to Watch For in Logs

```bash
# Good — startup sequence
# "JWordenAI backend starting up (FastAPI ...)"
# "Application startup complete."

# Bad — startup failures
railway logs --service api | grep -i "error\|exception\|import\|traceback"
```

**Common startup failures:**

| Log Message | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError` | Missing dependency in `requirements.txt` | Add the package and redeploy |
| `KeyError` / `AttributeError` at import | Env var read at import time is missing | Set the variable in Railway |
| `sqlalchemy.exc.OperationalError` | Database unreachable | Check `DATABASE_URL` and Postgres service status |
| `redis.exceptions.ConnectionError` | Redis unreachable | Check `REDIS_URL` and Redis service status |

### Deployment Status Check

```bash
# Check Railway deployment status
railway status

# Confirm the service is running
curl -s "$BASE/health"
# Expected: {"status": "ok", "service": "JWordenAI"}
```

---

## After Deploying

### Smoke Tests

Run these immediately after every deployment:

```bash
export BASE="https://<your-railway-domain>"
export MASTER_KEY="<your-JWORDEN_MASTER_KEY>"

# 1. Basic liveness
curl -s "$BASE/health"
# Expected: {"status": "ok", "service": "JWordenAI"}

# 2. Full readiness (DB + Redis + Celery)
curl -s "$BASE/health/ready" | python3 -m json.tool
# Expected: {"status": "ready", "checks": {"redis": {"ok": true}, "database": {"ok": true}, ...}}

# 3. Protected endpoint still requires auth
curl -i "$BASE/api/v1/crm/leads"
# Expected: HTTP 403 {"detail": "Unauthorized: no token"}

# 4. Protected endpoint works with master key
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool
# Expected: {"total": N, "leads": [...]}

# 5. Public endpoint still works
curl -s -X POST "$BASE/api/v1/leads/estimate" \
  -H "Content-Type: application/json" \
  -d '{"service_type": "sealcoating", "property_type": "residential", "project_size_sqft": 2000}'
# Expected: {"estimate_available": true, ...}

# 6. Admin dashboard accessible
curl -i -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/dashboard"
# Expected: HTTP 200 with HTML body
```

### Apply Database Migrations (If Any)

```bash
# Apply pending migrations
railway run --service api alembic upgrade head

# Verify the migration applied
railway run --service api alembic current
# Should show the latest revision hash

# Run a quick sanity check on the DB
curl -s "$BASE/health/ready" | python3 -c "import sys,json; d=json.load(sys.stdin); print('DB:', d['checks']['database'])"
```

### Verify Celery Workers

```bash
# Check worker logs
railway logs --service worker --tail 50

# Ping workers directly
railway run --service worker celery -A app.celery_app inspect ping
# Expected: {"celery@<hostname>": {"ok": "pong"}}

# Check queue depth
curl -s "$BASE/api/v1/metrics/celery" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool
```

### Verify Metrics Endpoints

```bash
# All metrics endpoints should return 200
for endpoint in celery redis database ai cache; do
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE/api/v1/metrics/$endpoint" \
    -H "Authorization: Bearer $MASTER_KEY")
  echo "$endpoint: HTTP $status"
done
```

### Check Sentry (If Configured)

- [ ] Open the Sentry dashboard and confirm no new error spikes after deployment
- [ ] Confirm the `release` tag matches the current git commit SHA

```bash
# The release tag is set from RAILWAY_GIT_COMMIT_SHA
railway variables --service api | grep RAILWAY_GIT_COMMIT_SHA
```

---

## Rollback Procedures

### Standard Rollback (Railway Dashboard)

1. Railway dashboard → API service → **Deployments**
2. Find the last known-good deployment (green checkmark)
3. Click **Redeploy** on that deployment
4. Monitor the rollback deployment in the logs

```bash
# Verify the rollback succeeded
curl -s "$BASE/health"
```

### Rollback via CLI

```bash
# List recent deployments
railway deployments --service api

# Redeploy a specific deployment
railway redeploy <deployment-id> --service api
```

### Rollback a Database Migration

> **Important:** Always roll back the migration before rolling back the code
> if the old code is incompatible with the new schema.

```bash
# Roll back one migration step
railway run --service api alembic downgrade -1

# Roll back to a specific revision
railway run --service api alembic downgrade bc2d5f75bee4

# Verify
railway run --service api alembic current
```

### Emergency: Take the API Offline

If the deployment is causing active harm (data corruption, security issue):

```bash
# Scale API replicas to 0 — all requests get 502 Bad Gateway
# Railway dashboard → API service → Settings → Replicas → 0

# Perform emergency fix, then restore
# Railway dashboard → API service → Settings → Replicas → 1
```

---

## Deployment Scenarios

### Scenario: Adding a New Protected Endpoint

1. [ ] Write the endpoint with `Depends(verify_premium_security)`
2. [ ] Add `@limiter.limit(...)` with an appropriate rate limit
3. [ ] Write a test in `tests/`
4. [ ] Run `pytest -q` locally
5. [ ] Push and open a PR
6. [ ] Merge → Railway auto-deploys
7. [ ] Run smoke tests
8. [ ] Test the new endpoint: `curl -s "$BASE/api/v1/new-endpoint" -H "Authorization: Bearer $MASTER_KEY"`

### Scenario: Rotating a Secret

1. [ ] Generate a new value: `openssl rand -hex 32`
2. [ ] Set it in Railway: `railway variables set KEY="new-value" --service api`
3. [ ] Railway auto-redeploys — monitor logs
4. [ ] Verify the new value works
5. [ ] Confirm the old value is rejected
6. [ ] Update any downstream systems that used the old value (e.g. frontend Netlify functions)

### Scenario: Adding a New Environment Variable

1. [ ] Add the variable to Railway **before** merging the code that uses it
2. [ ] Document it in `ENVIRONMENT_VARIABLES.md`
3. [ ] Merge the PR → Railway auto-deploys
4. [ ] Verify the feature works end-to-end

### Scenario: Schema Change (New Column or Table)

1. [ ] Create the Alembic migration: `alembic revision -m "describe_change"`
2. [ ] Edit the generated file in `alembic/versions/`
3. [ ] Test locally: `alembic upgrade head`
4. [ ] Push and merge the PR
5. [ ] After Railway deploys the new code: `railway run --service api alembic upgrade head`
6. [ ] Verify: `railway run --service api alembic current`

---

## Monitoring After Deployment

```bash
# Watch for errors in the first 10 minutes after deployment
railway logs --service api | grep -i "error\|500\|exception"

# Check request latency via metrics
curl -s "$BASE/api/v1/metrics/database" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print('DB latency:', d.get('query_latency_ms'), 'ms')"

# Check Redis health
curl -s "$BASE/api/v1/metrics/redis" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool
```

**Escalate if any of the following occur within 10 minutes of deployment:**
- `/health` returns non-200
- `/health/ready` shows `"status": "degraded"`
- More than 3 consecutive `500` responses in the logs
- Sentry shows a new error spike
- DB query latency exceeds 500ms

---

## Emergency Contacts

| Role | Responsibility |
|---|---|
| Backend on-call | Railway deployment issues, API errors, database problems |
| Database admin | Schema migrations, backup/restore, connection pool issues |
| Security lead | Credential rotation, auth failures, suspected breaches |

**If a secret is compromised:**
1. Rotate it immediately via Railway CLI (see `ENVIRONMENT_VARIABLES.md` → Rotation Procedure)
2. Notify the security lead
3. Review Railway logs for unauthorized access: `railway logs --service api | grep "403\|401"`
4. Check Sentry for any anomalous activity around the time of the suspected leak
