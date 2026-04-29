# Monitoring Guide

How to monitor the JWordenAI backend in production.

---

## Health Check Endpoints

### Primary Health Check

```
GET /health
```

No authentication required. Returns immediately without touching the database or Redis.

```json
{"status": "ok", "service": "JWordenAI"}
```

**Use this URL for:**
- Railway health check path (set in service Settings)
- External uptime monitors (UptimeRobot, Better Uptime, Pingdom)
- Load balancer health probes

**Expected behaviour:**
- `200 OK` — service is running
- `502 Bad Gateway` — service is down or restarting
- `503 Service Unavailable` — Railway is deploying a new version

### OpenAPI Schema (Liveness Indicator)

```
GET /openapi.json
```

Returns the full OpenAPI schema. A successful response confirms the FastAPI application loaded all routers without import errors.

---

## Railway Built-In Metrics

Every Railway service exposes real-time metrics in the dashboard under the **Metrics** tab:

| Metric | What to watch for |
|---|---|
| **CPU usage** | Sustained >80% — scale up or add workers |
| **Memory usage** | Approaching the service limit — check for memory leaks |
| **Network in/out** | Sudden spikes may indicate a traffic surge or scraper activity |
| **Replica count** | Confirm the expected number of replicas are running |

### Viewing Logs

```bash
# Stream live logs for the API service
railway logs --service api

# Stream live logs for the Celery worker
railway logs --service worker

# Show the last 200 lines
railway logs --service api --tail 200
```

Key log patterns to watch for:

| Pattern | Meaning |
|---|---|
| `JWordenAI backend starting up` | Successful startup |
| `Database tables verified/created` | DB connection succeeded |
| `Sentry initialised` | Sentry is active |
| `Could not create database tables` | DB connection failed — check `DATABASE_URL` |
| `Sentry init failed` | `SENTRY_DSN` is set but invalid |
| `OpenAI vision call failed` | OpenAI API error — check `OPENAI_API_KEY` and quota |
| `Could not save session messages` | Redis or DB write error |

---

## Setting Up Railway Alerts

1. Open the Railway dashboard → **Project Settings** → **Notifications**
2. Connect a Slack workspace or webhook URL
3. Enable alerts for:
   - **Deployment failed** — triggers when a build or start fails
   - **Service crashed** — triggers when a service exits unexpectedly
   - **Health check failed** — triggers when `/health` stops returning 200

### Recommended Alert Thresholds

| Alert | Threshold | Action |
|---|---|---|
| API health check failure | 2 consecutive failures | Page on-call engineer |
| Worker service crash | Any crash | Investigate Redis connectivity |
| Deployment failure | Any failure | Check build logs for import errors |
| CPU > 90% for 5 minutes | Sustained | Scale up API replicas |

---

## Interpreting Key Endpoints

### Analytics Dashboard

```bash
curl -s "$BASE/api/v1/analytics/dashboard" \
  -H "Authorization: Bearer $MASTER_KEY"
```

Returns a full business intelligence payload. Key fields to monitor:

- `total_leads` — total leads in the database
- `hot_leads` — leads scored HOT (high-value, urgent)
- `conversion_rate` — percentage of leads that reached `won` stage
- `avg_response_time_hours` — average time from lead creation to first contact

### Revenue Forecast

```bash
curl -s "$BASE/api/v1/analytics/revenue-forecast" \
  -H "Authorization: Bearer $MASTER_KEY"
```

Projects revenue from HOT leads using win rate and average job value. Use this weekly to track pipeline health.

### CRM Funnel

```bash
curl -s "$BASE/api/v1/crm/funnel" \
  -H "Authorization: Bearer $MASTER_KEY"
```

Returns lead counts by pipeline stage. A healthy funnel has leads progressing through stages. Watch for:

- Large `new` count with low `contacted` count — follow-up SLA may be missed
- High `lost` count — review closed reasons for patterns

### Project Metrics Trends

```bash
curl -s "$BASE/api/v1/project-metrics/trends" \
  -H "Authorization: Bearer $MASTER_KEY"
```

Returns portfolio-level averages:

- `cost_accuracy_pct` — how close actual costs are to estimates (target: >90%)
- `schedule_adherence_pct` — on-time delivery rate (target: >95%)
- `avg_client_nps` — client satisfaction score (target: >8.0)
- `punch_closure_pct` — punch list completion rate (target: 100%)

---

## Celery Worker Monitoring

### Check Worker Status

```bash
# From the Railway CLI or service shell
celery -A app.celery_app inspect active
celery -A app.celery_app inspect reserved
celery -A app.celery_app inspect stats
```

### Scheduled Tasks

The Celery Beat scheduler runs two periodic tasks:

| Task | Schedule | Purpose |
|---|---|---|
| `scrape_virginia_lis` | Every 6 hours | Scrapes Virginia LIS for permit data |
| `process_vision_batch` | Every 15 minutes | Processes queued photo inspection jobs |

If these tasks stop running, check:
1. The Beat service is running (`railway logs --service beat`)
2. Redis is reachable from the Beat service
3. The task queue is not backed up (`celery -A app.celery_app inspect active`)

### Redis Queue Depth

A growing queue depth indicates workers are falling behind. Monitor via:

```bash
# From the Railway service shell
redis-cli -u $REDIS_URL llen celery
```

If the queue depth exceeds 1000, add more Celery worker replicas.

---

## Sentry Integration (Optional)

Sentry captures unhandled exceptions and performance traces automatically when `SENTRY_DSN` is set.

### Setup

1. Create a project at [sentry.io](https://sentry.io) (Python / FastAPI)
2. Copy the DSN from **Project Settings → Client Keys**
3. Set in Railway API service variables:
   ```
   SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
   SENTRY_TRACES_SAMPLE_RATE=0.1
   ```
4. Redeploy the API service

### What Sentry Captures

- Unhandled Python exceptions (500 errors)
- Slow requests (when `traces_sample_rate > 0`)
- Database query performance (via SQLAlchemy integration, if configured)

### Sentry Alerts

In the Sentry dashboard, configure:
- **Issue alert** — notify on first occurrence of any new error
- **Performance alert** — notify when p95 response time exceeds 2 seconds
- **Error rate alert** — notify when error rate exceeds 1% over 5 minutes

---

## Log Aggregation

Railway streams logs to the dashboard in real time. For persistent log storage and search:

### Option A — Railway Log Drain (Recommended)

1. Railway dashboard → **Project Settings** → **Log Drains**
2. Add a drain to Datadog, Papertrail, Logtail, or any syslog-compatible endpoint
3. All services (API, Worker, Beat) stream to the same drain

### Option B — Self-Hosted (Loki + Grafana)

Deploy a Loki instance and configure the Railway log drain to send to it. Use Grafana to query and visualise logs.

### Useful Log Queries

Once logs are in an aggregation tool, use these queries:

```
# All errors in the last hour
level=error service=api

# Rate limit events
"429" service=api

# Slow database queries (if SQLAlchemy echo is enabled)
"SELECT" duration>1000ms

# Celery task failures
"Task" "FAILURE" service=worker
```

---

## Debugging Common Issues

### API returns 500 on all requests

1. Check Railway deployment logs for startup errors
2. Confirm `DATABASE_URL` is set and Postgres is running
3. Confirm `JWT_SECRET_KEY` is set
4. Check Sentry for the exception traceback

### AI endpoints return stub responses

`OPENAI_API_KEY` is not set or has exceeded its quota. Check:

```bash
railway logs --service api | grep "OpenAI"
```

### Celery tasks not executing

1. Confirm `REDIS_URL` is set in the Worker service
2. Check worker logs: `railway logs --service worker`
3. Verify Redis is reachable: `redis-cli -u $REDIS_URL ping`

### Database connection pool exhausted

Symptoms: `TimeoutError: QueuePool limit of size 10 overflow 20 reached`

Increase pool settings in Railway API service variables:

```
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
```

Or reduce the number of concurrent requests hitting the API.

### Rate limit errors from legitimate traffic

The global limit is 200 requests/minute per IP. Individual endpoints have tighter limits. If a legitimate client is being throttled, review `app/core/limiter.py` and adjust the limits for the specific endpoint.
