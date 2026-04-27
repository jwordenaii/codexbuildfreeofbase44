# J. Worden & Sons Platform

Production web + FastAPI backend for lead intake, CRM operations, proposals, and command center workflows.

## Quality Gates

- Frontend lint: `npm run lint`
- Frontend build: `npm run build`
- Frontend unit tests: `npm test`
- Backend API tests: `pytest -q`
- E2E smoke tests: `npm run test:e2e`

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
