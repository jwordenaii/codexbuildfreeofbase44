# Sentry Setup Guide

This guide walks you through connecting the JWordenAI FastAPI backend to Sentry for
production error tracking and performance monitoring.

---

## 1. Create a Sentry Account

1. Go to **https://sentry.io** and click **Get Started**.
2. Sign up with GitHub, Google, or an email address.
3. The **free Developer plan** is sufficient for a single project with up to 5 000 errors/month.

---

## 2. Create a Sentry Project

1. In the Sentry dashboard, click **Projects → Create Project**.
2. Select **Python** as the platform.
3. Give the project a name — e.g. `jworden-backend`.
4. Click **Create Project**.
5. Sentry will display your **DSN** (Data Source Name). It looks like:

   ```
   https://abc123def456@o123456.ingest.sentry.io/789012
   ```

   Copy this value — you will need it in the next step.

---

## 3. Set `SENTRY_DSN` in Railway

1. Open the [Railway dashboard](https://railway.app) and navigate to your project.
2. Select the **API service** (the FastAPI backend).
3. Go to **Variables**.
4. Click **New Variable** and add:

   | Variable | Value |
   |---|---|
   | `SENTRY_DSN` | `https://…@….ingest.sentry.io/…` |

5. Optionally, tune the performance sampling rate (default is 10 %):

   | Variable | Value | Notes |
   |---|---|---|
   | `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | 0.0 = off, 1.0 = 100 % of requests |

6. Click **Deploy** (or Railway will redeploy automatically).

---

## 4. What Sentry Captures

Once `SENTRY_DSN` is set, the following are captured automatically:

### Errors
| Source | How it's captured |
|---|---|
| Unhandled HTTP exceptions (500) | FastAPI + Starlette integration |
| Database connection / query errors | SQLAlchemy integration + explicit `capture_exception` in `database.py` |
| OpenAI API errors (vision, chat, contact-suggest) | Explicit `_capture_exception()` calls in `app/routers/ai.py` |
| Celery task failures (scraper, vision batch) | Celery integration + explicit `capture_exception` in task handlers |
| Rate-limit errors (429) | Starlette integration captures the `RateLimitExceeded` handler |
| `logger.error(…)` calls anywhere in the app | Logging integration (ERROR level → Sentry event) |

### Performance Traces
| Metric | Integration |
|---|---|
| HTTP request latency (p50/p95/p99) | FastAPI integration |
| Database query duration | SQLAlchemy integration |
| Celery task duration | Celery integration |
| OpenAI API call latency | Captured inside the traced HTTP request span |

---

## 5. Verify It's Working

After deploying with `SENTRY_DSN` set:

1. Check the Railway logs for:
   ```
   INFO  Sentry initialised (env=production)
   ```
2. In the Sentry dashboard, go to **Issues** — any errors that occur will appear here
   within a few seconds.
3. To trigger a test event manually, you can temporarily add a route that raises an
   exception, or use the Sentry CLI:
   ```bash
   pip install sentry-cli
   sentry-cli send-event -m "Test event from JWordenAI"
   ```

---

## 6. View Errors in the Sentry Dashboard

- **Issues** — every unique error grouped by type, with stack traces, request context,
  and breadcrumbs (recent log lines leading up to the error).
- **Performance** — p50/p95 latency per endpoint, slowest DB queries, slowest Celery tasks.
- **Releases** — errors are tagged with the Railway git commit SHA
  (`RAILWAY_GIT_COMMIT_SHA`) so you can see exactly which deploy introduced a regression.

---

## 7. Set Up Alerts

1. In Sentry, go to **Alerts → Create Alert**.
2. Recommended alerts:

   | Alert | Condition | Action |
   |---|---|---|
   | New issue | A new error type appears for the first time | Email / Slack |
   | Error spike | Error rate > 10/min for 5 minutes | Email / PagerDuty |
   | High latency | p95 response time > 2 s | Slack |
   | Celery failure | `scrape_virginia_lis` or `process_vision_batch` fails | Email |

3. Connect Slack by going to **Settings → Integrations → Slack** and following the OAuth flow.

---

## 8. Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SENTRY_DSN` | Yes (for Sentry) | _(empty — Sentry disabled)_ | DSN from your Sentry project settings |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` | Fraction of requests to trace (0.0–1.0) |
| `RAILWAY_ENVIRONMENT_NAME` | Set by Railway | `production` | Tags all events with the environment name |
| `RAILWAY_GIT_COMMIT_SHA` | Set by Railway | `unknown` | Tags all events with the deploying commit |

---

## 9. SDK Details

The backend uses **`sentry-sdk[fastapi]==2.22.0`** with the following integrations enabled
when `SENTRY_DSN` is present:

- `StarletteIntegration` — request context, unhandled exceptions
- `FastApiIntegration` — endpoint-level transactions
- `SqlalchemyIntegration` — DB query spans and errors
- `CeleryIntegration` — task spans, failures, and Beat monitoring
- `LoggingIntegration` — `WARNING` → breadcrumb, `ERROR` → Sentry event

All integrations are initialised **before** the FastAPI app object is created in
`app/main.py`, ensuring no early startup errors are missed.
