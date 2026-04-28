# J. Worden & Sons Platform

Production web + FastAPI backend for lead intake, CRM operations, proposals, and command center workflows.

## Quality Gates

- Frontend lint: `npm run lint`
- Frontend build: `npm run build`
- Frontend unit tests: `npm test`
- Backend API tests: `pytest -q`
- E2E smoke tests: `npm run test:e2e`

## Frontend Deploy Checklist

Keep the Netlify/public-site deploy separate from backend infrastructure changes unless the release explicitly includes both.

Before merging a frontend deploy PR:

- Confirm Netlify installs dependencies and runs `npm run build`.
- Set required Netlify environment variables:
  - `VITE_API_BASE_URL`
  - `VITE_SITE_URL`
  - `VITE_GA4_ID`
  - `VITE_GOOGLE_MAPS_API_KEY`
  - `VITE_STRIPE_PUBLISHABLE_KEY` if payments are live
- Do not add backend/admin secrets with a `VITE_` prefix. Vite exposes those values in browser JavaScript.
- Do not set or rely on `VITE_MASTER_API_KEY`; keep master/admin API keys server-side only.
- Confirm the sitemap and canonical URLs use the production domain.

After deploy:

- Submit a quote and contact form.
- Confirm the frontend calls the intended backend API URL.
- Confirm Google Maps loads anywhere it is used.
- Confirm Stripe checkout uses the intended live or test publishable key.
- Confirm the backend health endpoint returns OK: `GET /health`.

## Backend Deploy Notes

Postgres and Redis are backend infrastructure and can be handled in a separate deployment PR. For a beginner-friendly production path, use managed Postgres and Redis from the same backend host when possible, such as Render or Railway.

Before moving production traffic to Postgres:

- Apply Alembic migrations.
- Set `AUTO_CREATE_TABLES=false`.
- Enable database backups.
- Keep Redis configured for Celery, caching, and background jobs.

## Database Migrations (Alembic)

Alembic is now the schema evolution path.

- Create migration: `alembic revision -m "describe_change"`
- Apply migrations: `alembic upgrade head`
- Show current revision: `alembic current`

For existing environments with pre-existing tables, stamp baseline once:

```bash
alembic stamp bc2d5f75bee4
```

Set `AUTO_CREATE_TABLES=false` in production.

## Payments (Stripe)

- Backend checkout session endpoint: `POST /api/v1/payments/checkout-session`
- Backend webhook endpoint: `POST /api/v1/payments/webhook`
- Lead payment status endpoint: `GET /api/v1/payments/status/{lead_id}`

Frontend quote success flow now includes a **Pay Deposit** checkout action.

## Transactional Email

- Primary: Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
- Fallback: SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`)

## Local Containers

```bash
docker compose up --build
```

Services:
- `api` (FastAPI)
- `postgres`
- `redis`
- `worker` (Celery)
- `beat` (Celery scheduler)
