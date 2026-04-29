# Frontend Integration Guide — J. Worden & Sons AI Backend

> **Single source of truth** for connecting the React/Vite frontend to the FastAPI backend.
> Start here. Everything else is linked from this document.

---

## Table of Contents

1. [Auth Flow Overview](#1-auth-flow-overview)
2. [Environment Variables](#2-environment-variables)
3. [Setup Steps](#3-setup-steps)
4. [API Contract Reference](#4-api-contract-reference)
5. [Error Handling Patterns](#5-error-handling-patterns)
6. [Security Checklist](#6-security-checklist)

---

## 1. Auth Flow Overview

The master key (`JWORDEN_MASTER_KEY`) **never touches the browser**. A Netlify Function acts as a secure intermediary that calls the FastAPI token endpoint and forwards only the resulting JWT to the browser.

```
Browser                  Netlify Function              FastAPI Backend
  │                           │                              │
  │  POST /.netlify/functions/get-token                      │
  │──────────────────────────►│                              │
  │                           │  POST /api/v1/auth/token     │
  │                           │  Authorization: Bearer <MASTER_KEY>
  │                           │─────────────────────────────►│
  │                           │                              │ validate master key
  │                           │                              │ sign JWT (HS256, 24h)
  │                           │◄─────────────────────────────│
  │                           │  { access_token, expires_in }│
  │◄──────────────────────────│                              │
  │  { token, expires_at }    │                              │
  │                           │                              │
  │  GET /api/v1/crm/leads                                   │
  │  Authorization: Bearer <JWT>                             │
  │─────────────────────────────────────────────────────────►│
  │                           │                              │ verify JWT (HS256)
  │◄─────────────────────────────────────────────────────────│
  │  { total, leads: [...] }  │                              │
```

**Key points:**

- The Netlify Function calls `POST /api/v1/auth/token` on the FastAPI backend, passing the master key as a Bearer token.
- The backend validates the master key, signs a JWT (HS256, 24-hour TTL), and returns it.
- The Netlify Function forwards only the JWT to the browser — the master key stays server-side.
- The browser stores the JWT **in memory only** (never `localStorage`, never a cookie without `HttpOnly`+`Secure`).
- A proactive refresh fires 5 minutes before expiry so users never hit an expired-token error mid-session.
- On any `401`/`403` response, `apiFetch` automatically refreshes the token and retries once.
- Concurrent refresh calls are deduplicated — only one in-flight request is made at a time.

---

## 2. Environment Variables

### Browser-safe (`VITE_` prefix — bundled into JS, visible to anyone)

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.jwordenasphaltpaving.com` | FastAPI backend base URL |
| `VITE_SITE_URL` | `https://jwordenasphaltpaving.com` | Public site URL |
| `VITE_GA4_ID` | `G-XXXXXXXXXX` | Google Analytics 4 measurement ID |
| `VITE_GOOGLE_MAPS_API_KEY` | `AIza...` | Maps API key (restrict to your domain in GCP) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Stripe publishable key only |

### Server-side only (Netlify env — **NEVER** add a `VITE_` prefix)

| Variable | Set In | Purpose |
|---|---|---|
| `JWORDEN_MASTER_KEY` | Netlify UI → Site → Environment variables | Long-lived master API key — exchanged for JWT by the Netlify Function |
| `JWT_SECRET_KEY` | Netlify UI (Option B only) | HS256 signing secret — must match backend exactly |
| `USE_BACKEND_TOKEN_ENDPOINT` | Netlify UI | Set `true` to proxy to FastAPI (Option A); omit for local JWT generation (Option B, default) |

> ⚠️ **Never create `VITE_MASTER_API_KEY` or any `VITE_` variable containing a secret.** Vite statically inlines `VITE_*` values into the browser bundle at build time — they are visible to anyone who opens DevTools.

---

## 3. Setup Steps

### Step 1 — Copy the auth files

```
FRONTEND_AUTH_CLIENT.ts       → src/lib/auth.ts
FRONTEND_REACT_EXAMPLES.ts    → src/hooks/  (copy individual hooks as needed)
FRONTEND_NETLIFY_FUNCTION.ts  → netlify/functions/get-token.ts
```

### Step 2 — Install dependencies

```bash
# Auth client + React hooks
npm install @tanstack/react-query

# Netlify Function (Option B — local JWT generation, default)
npm install jose

# Netlify Function runtime types
npm install --save-dev @netlify/functions
```

### Step 3 — Configure `netlify.toml`

```toml
[functions]
  directory = "netlify/functions"

[build]
  command = "npm run build"
  publish = "dist"
```

### Step 4 — Set environment variables

In **Netlify UI → Site → Environment variables**, add:

```
JWORDEN_MASTER_KEY   = <value from backend .env>
JWT_SECRET_KEY       = <value from backend .env>   # Option B only
VITE_API_BASE_URL    = https://api.jwordenasphaltpaving.com
```

For **local development**, create `.env.local` (gitignored by Vite):

```bash
# .env.local — read by Vite dev server
VITE_API_BASE_URL=http://localhost:8000

# .env — read by `netlify dev` for the Netlify Function runtime
JWORDEN_MASTER_KEY=your-master-key-here
JWT_SECRET_KEY=your-jwt-secret-here
```

### Step 5 — Wrap your app root

```tsx
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/AuthProvider'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
)
```

### Step 6 — Test locally

```bash
# Start Netlify dev (runs both Vite and Netlify Functions)
npx netlify dev

# Verify the token function works
curl -X POST http://localhost:8888/.netlify/functions/get-token
# Expected: { "token": "eyJ...", "expires_at": 1234567890 }

# Verify the JWT works against the backend
curl -H "Authorization: Bearer eyJ..." http://localhost:8000/api/v1/crm/leads
```

---

## 4. API Contract Reference

### Auth

#### `POST /api/v1/auth/token`

Exchange the master key for a 24-hour JWT. **Called by the Netlify Function, not the browser directly.**

**Request:**
```http
POST /api/v1/auth/token
Authorization: Bearer <JWORDEN_MASTER_KEY>
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

**JWT claims:** `sub: "Admin"`, `tenant_id: "JWORDEN_HQ"`, `iat`, `exp`

**Errors:**
- `401` — No `Authorization` header provided
- `403` — Invalid master key
- `500` — `JWORDEN_MASTER_KEY` or `JWT_SECRET_KEY` not configured on server

---

### Public Endpoints (no auth required)

#### `POST /api/v1/leads/quote`

Submit a customer quote request. Triggers lead scoring, DB persistence, email notification, and automatic follow-up scheduling.

**Request body:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "555-867-5309",
  "service_type": "paving",
  "property_type": "commercial",
  "urgency": "within_1_week",
  "project_size_sqft": 5000,
  "address": "123 Main St, Columbus OH 43215",
  "message": "Parking lot needs full replacement"
}
```

**Field constraints:**
- `service_type`: `paving | sealcoating | crackfill | parking_lot | driveway`
- `property_type`: `residential | commercial`
- `urgency`: `asap | within_1_week | within_1_month | flexible`
- `project_size_sqft`: 0 – 10,000,000 (optional)
- `message`: max 2,000 characters (optional)

**Response `200`:**
```json
{
  "status": "received",
  "message": "Thank you! We will contact you within 24 hours.",
  "lead_score": "HOT",
  "priority": 1,
  "follow_up_sla": "1 hour"
}
```

**Rate limit:** 10 requests/minute per IP

---

#### `POST /api/v1/leads/contact`

Submit a general contact form message.

**Request body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "555-123-4567",
  "message": "Do you service the Dayton area?"
}
```

**Response `200`:**
```json
{
  "status": "received",
  "message": "Thank you for reaching out! We will get back to you soon."
}
```

**Rate limit:** 10 requests/minute per IP

---

#### `POST /api/v1/leads/estimate`

Get a ballpark price estimate without submitting a lead. Helps prospects self-qualify.

**Request body:**
```json
{
  "service_type": "sealcoating",
  "property_type": "residential",
  "project_size_sqft": 2000
}
```

**Response `200`:**
```json
{
  "estimate_available": true,
  "service_type": "sealcoating",
  "low_usd": 400,
  "high_usd": 800,
  "unit": "per sqft range"
}
```

**Rate limit:** 30 requests/minute per IP

---

#### `POST /api/v1/ai/chat`

Natural language Q&A using the J. Worden AI persona. No auth required.

**Request body:**
```json
{
  "message": "How long does sealcoating take to cure?",
  "session_id": "optional-session-id-for-context"
}
```

---

### Protected Endpoints (require `Authorization: Bearer <JWT>`)

All protected endpoints return `403` if the token is missing or invalid. The `apiFetch` wrapper in `FRONTEND_AUTH_CLIENT.ts` handles token injection and automatic retry on auth failures.

---

#### CRM — Lead Pipeline

##### `GET /api/v1/crm/leads`

List leads with optional pipeline stage and score label filters.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `pipeline_stage` | string | — | `new \| contacted \| proposal_sent \| negotiating \| won \| lost` |
| `score_label` | string | — | `HOT \| WARM \| COOL` |
| `limit` | int | 50 | Max results (1–200) |
| `offset` | int | 0 | Pagination offset |

**Response `200`:**
```json
{
  "total": 142,
  "offset": 0,
  "limit": 50,
  "leads": [
    {
      "id": 1,
      "name": "John Smith",
      "email": "john@example.com",
      "phone": "555-867-5309",
      "service_type": "paving",
      "urgency": "asap",
      "score_label": "HOT",
      "pipeline_stage": "new",
      "contacted_at": null,
      "proposal_sent_at": null,
      "closed_at": null,
      "closed_reason": null,
      "created_at": "2024-01-15T10:30:00+00:00"
    }
  ]
}
```

**Rate limit:** 60 requests/minute

---

##### `PATCH /api/v1/crm/leads/{lead_id}/stage`

Move a lead to a new pipeline stage. Automatically sets stage timestamps (`contacted_at`, `proposal_sent_at`, `closed_at`).

**Request body:**
```json
{
  "pipeline_stage": "contacted",
  "closed_reason": null
}
```

**Valid stages:** `new | contacted | proposal_sent | negotiating | won | lost`

**Response `200`:**
```json
{
  "id": 1,
  "pipeline_stage": "contacted",
  "status": "updated"
}
```

**Errors:**
- `404` — Lead not found
- `422` — Invalid pipeline stage value

---

##### `GET /api/v1/crm/funnel`

Aggregate lead counts by pipeline stage for funnel visualization.

**Response `200`:**
```json
{
  "funnel": [
    { "stage": "new",           "count": 45 },
    { "stage": "contacted",     "count": 32 },
    { "stage": "proposal_sent", "count": 18 },
    { "stage": "negotiating",   "count": 12 },
    { "stage": "won",           "count": 28 },
    { "stage": "lost",          "count": 7  }
  ],
  "total": 142,
  "won": 28,
  "win_rate_pct": 19.7
}
```

---

#### Analytics — Business Intelligence

##### `GET /api/v1/analytics/dashboard`

Full BI dashboard — all metrics in a single payload. Use for the Command Center overview.

**Rate limit:** 30 requests/minute

---

##### `GET /api/v1/analytics/funnel`

Lead conversion funnel broken down by stage, score label, service type, and urgency.

**Rate limit:** 60 requests/minute

---

##### `GET /api/v1/analytics/revenue-forecast`

Revenue projection from HOT leads × win rate × average job value by service type.

**Rate limit:** 30 requests/minute

---

##### `GET /api/v1/analytics/monthly-volume`

Monthly lead counts and HOT lead breakdown for the last 12 months.

**Response `200`:**
```json
{
  "monthly_volume": [
    { "month": "2024-01", "total": 18, "hot": 5 },
    { "month": "2024-02", "total": 22, "hot": 7 }
  ]
}
```

---

#### KPI Wall

##### `GET /api/v1/kpi-wall`

Aggregate KPIs from all modules — bid win rate, on-time delivery, safety TRIR, 13-week cash projection, certification currency, and client NPS.

**Response `200`:**
```json
{
  "generated_at": "2024-01-15T10:30:00+00:00",
  "kpis": {
    "bid_win_rate": {
      "label": "Bid Win Rate",
      "value": 42.5,
      "unit": "%",
      "target": 40.0,
      "total_bids": 80,
      "total_won": 34,
      "status": "green"
    },
    "on_time_delivery": {
      "label": "On-Time Delivery",
      "value": 88.0,
      "unit": "%",
      "target": 90.0,
      "total_projects": 25,
      "on_time_projects": 22,
      "status": "yellow"
    },
    "safety_trir":     { "label": "Safety TRIR",      "value": 2.1,  "unit": "per 100 workers", "target": 3.4,  "status": "green"  },
    "projected_cash":  { "label": "13-Week Cash",     "value": 45000,"unit": "$",               "target": 10000,"status": "green"  },
    "cert_current_pct":{ "label": "Cert Currency",    "value": 96.0, "unit": "%",               "target": 95.0, "status": "green"  },
    "client_nps":      { "label": "Avg Client NPS",   "value": 8.4,  "unit": "/10",             "target": 8.0,  "status": "green"  }
  },
  "monthly_lead_trend": [
    { "month": "2024-01", "count": 18 },
    { "month": "2024-02", "count": 22 }
  ]
}
```

**KPI `status` values:** `green | yellow | red | gray` (gray = no data yet)

**Rate limit:** 30 requests/minute

---

#### Proposals

##### `POST /api/v1/proposals/generate`

Generate a text + PDF proposal for a lead. Also advances the lead to `proposal_sent` stage if currently `new` or `contacted`.

**Request body:**
```json
{
  "lead_id": 42,
  "include_pdf": true
}
```

**Response `200`:**
```json
{
  "proposal_id": 42,
  "lead_id": 42,
  "lead_name": "John Smith",
  "proposal_text": "Dear John Smith,\n\nThank you for...",
  "pdf_b64": "JVBERi0xLjQ...",
  "pdf_base64": "JVBERi0xLjQ...",
  "pdf_size_bytes": 48320
}
```

**Errors:** `404` — Lead not found

**Rate limit:** 10 requests/minute

---

##### `POST /api/v1/proposals/{lead_id}/send`

Generate and email a proposal directly to the lead's email address (background task).

**Response `200`:**
```json
{
  "status": "queued",
  "message": "Proposal will be emailed to john@example.com",
  "lead_id": 42,
  "lead_name": "John Smith"
}
```

**Errors:** `404` — Lead not found; `422` — Lead has no valid email address

**Rate limit:** 5 requests/minute

---

#### Customers

##### `POST /api/v1/customers`

Create a customer record.

**Request body:** `CustomerCreate` — `name` (required), plus optional `email`, `phone`, `company`, `address`, `city`, `state_code` (2-letter), `zip_code`, `customer_type`, `is_franchise` (0/1), `brand`, `notes`, `tags`, `external_id`, `source`.

---

##### `GET /api/v1/customers`

List customers with optional filters.

**Query parameters:** `state_code`, `customer_type`, `is_franchise` (0/1), `search` (name/email/company), `limit`, `offset`

**Response `200`:**
```json
{
  "total": 380,
  "offset": 0,
  "limit": 50,
  "items": [
    {
      "id": 1,
      "name": "Acme Corp",
      "email": "ops@acme.com",
      "phone": "555-000-1234",
      "company": "Acme Corporation",
      "state_code": "OH",
      "city": "Columbus",
      "customer_type": "commercial",
      "is_franchise": 0,
      "brand": null,
      "total_jobs": 4,
      "total_revenue": 28500.00,
      "ltv_score": null,
      "churn_risk": null,
      "created_at": "2023-06-01T00:00:00+00:00"
    }
  ]
}
```

---

##### `GET /api/v1/customers/stats/overview`

Overall CRM statistics.

**Response `200`:**
```json
{
  "total_customers": 380,
  "franchise_accounts": 12,
  "states_represented": 8,
  "total_jobs_on_record": 1420,
  "total_revenue_on_record": 2850000.00
}
```

---

##### `GET /api/v1/customers/{id}/history`

Service history for a specific customer.

**Response `200`:**
```json
{
  "customer_id": 1,
  "jobs": 4,
  "history": [
    {
      "id": 10,
      "job_date": "2023-09-15T00:00:00+00:00",
      "service_type": "paving",
      "scope_summary": "Full parking lot replacement",
      "sqft": 8000,
      "revenue": 12000.00
    }
  ]
}
```

---

#### Payments

##### `POST /api/v1/payments/checkout-session`

Create a Stripe checkout session for a lead deposit (20% of low estimate, minimum $100).

**Request body:**
```json
{
  "lead_id": 42,
  "success_url": "https://jwordenasphaltpaving.com/quote?payment=success",
  "cancel_url": "https://jwordenasphaltpaving.com/quote?payment=cancel"
}
```

**Response `200`:**
```json
{
  "payment_id": 7,
  "lead_id": 42,
  "amount_usd": 240.00,
  "checkout_session_id": "cs_live_...",
  "checkout_url": "https://checkout.stripe.com/pay/cs_live_...",
  "status": "pending"
}
```

**Rate limit:** 20 requests/minute

---

##### `GET /api/v1/payments/status/{lead_id}`

Get the latest payment status for a lead.

**Response `200`:**
```json
{
  "lead_id": 42,
  "has_payment": true,
  "status": "paid",
  "amount_usd": 240.00,
  "paid_at": "2024-01-15T14:22:00+00:00"
}
```

**Rate limit:** 60 requests/minute

---

#### Follow-ups

##### `GET /api/v1/followups`

List follow-up tasks with optional filters.

**Query parameters:** `status` (`pending | sent | cancelled`), `lead_id`, `task_type` (`hot_1h | warm_3d | cool_7d`), `limit`, `offset`

**Response `200`:**
```json
{
  "total": 28,
  "tasks": [
    {
      "id": 5,
      "lead_id": 42,
      "task_type": "hot_1h",
      "scheduled_at": "2024-01-15T11:30:00+00:00",
      "sent_at": null,
      "status": "pending",
      "created_at": "2024-01-15T10:30:00+00:00"
    }
  ]
}
```

---

##### `POST /api/v1/followups/{task_id}/cancel`

Cancel a pending follow-up task.

**Response `200`:**
```json
{ "id": 5, "status": "cancelled" }
```

**Errors:** `404` — Task not found; `400` — Task already sent or cancelled

---

#### Documents

##### `POST /api/v1/documents/parse-contract`

Upload a contract PDF or image for AI extraction of key terms, deadlines, payment milestones, and risk flags.

**Request:** `multipart/form-data` with `file` field.
Accepted types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`. Max 20 MB.

**Response `200`:**
```json
{
  "status": "ok",
  "filename": "contract.pdf",
  "parties": ["J. Worden & Sons", "Acme Corp"],
  "scope_of_work": "Full parking lot resurfacing...",
  "payment_milestones": [],
  "risk_flags": []
}
```

**Rate limit:** 10 requests/minute

---

##### `POST /api/v1/documents/parse-blueprint`

Upload a blueprint or site plan image for AI square footage estimation.

**Request:** `multipart/form-data` with `file` field. Accepted types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Max 20 MB.

---

##### `POST /api/v1/documents/parse-permit`

Upload a permit PDF for AI extraction of permit number, address, expiry date, and approved scope.

**Request:** `multipart/form-data` with `file` field. Accepted type: `application/pdf`. Max 20 MB.

---

#### AI — Photo Inspection (protected)

##### `POST /api/v1/ai/photo-inspect`

GPT-4 Vision asphalt damage assessment. Upload a photo for AI analysis of damage type, severity, and recommended service.

**Request:** `multipart/form-data` with `file` field (JPEG/PNG/WebP, max 20 MB).

---

#### Operational Metrics (protected)

| Endpoint | Description | Rate limit |
|---|---|---|
| `GET /api/v1/metrics/celery` | Celery queue depth, active tasks, worker status | 30/min |
| `GET /api/v1/metrics/redis` | Redis memory, key count, connected clients | 30/min |
| `GET /api/v1/metrics/database` | Postgres pool stats and `SELECT 1` latency | 30/min |
| `GET /api/v1/metrics/ai` | OpenAI call counts, latency, error rate | 30/min |
| `GET /health` | Health check — **public**, no auth required | — |

---

## 5. Error Handling Patterns

### Standard error response shape

All FastAPI errors follow this shape:

```json
{ "detail": "Human-readable error message" }
```

Validation errors (422) return an array:

```json
{
  "detail": [
    {
      "loc": ["body", "pipeline_stage"],
      "msg": "Invalid stage. Must be one of: contacted, lost, negotiating, new, proposal_sent, won",
      "type": "value_error"
    }
  ]
}
```

### HTTP status code reference

| Code | Meaning | Frontend action |
|---|---|---|
| `200` | Success | Render data |
| `400` | Bad request (e.g. cancel already-sent task) | Show validation message |
| `401` | Token expired or missing | `apiFetch` auto-refreshes and retries once |
| `403` | Invalid token or master key | `apiFetch` auto-refreshes and retries once; show auth error if retry fails |
| `404` | Resource not found | Show "not found" UI |
| `413` | File too large (>20 MB) | Show file size error |
| `415` | Unsupported file type | Show accepted types list |
| `422` | Validation error (invalid field value) | Show field-level error from `detail` array |
| `429` | Rate limit exceeded | Back off and retry after 60 seconds |
| `500` | Server error | Show generic error, log to Sentry |
| `503` | Dependency unavailable (Redis/DB down) | Show "service unavailable" |

### Token refresh behaviour

| Scenario | What happens |
|---|---|
| App loads | `AuthProvider` calls `initAuth()`, fetches a fresh token from the Netlify Function |
| Token is within 5 minutes of expiry | Proactive refresh fires automatically in the background |
| API call returns `401` or `403` | `apiFetch` refreshes the token and retries the request once |
| Multiple concurrent `401`s | Only one refresh request is made (deduplicated via promise cache) |
| Refresh fails | `AuthProvider` sets `error` state; `useAuthGuard` renders an error UI with a Retry button |
| Page reload | Token is cleared from memory; `AuthProvider` fetches a new one on mount |

### Rate limit handling

```typescript
try {
  const data = await getCrmLeads()
} catch (err) {
  if (err instanceof Error && err.message.includes('429')) {
    showToast('Too many requests — please wait a moment and try again.')
  }
}
```

---

## 6. Security Checklist

- [ ] `JWORDEN_MASTER_KEY` is set **only** in Netlify environment variables — never in any `VITE_` variable, never committed to git
- [ ] `JWT_SECRET_KEY` is set **only** in Netlify environment variables (Option B) or backend environment — never in frontend code
- [ ] The Netlify Function (`netlify/functions/get-token.ts`) is the **only** place that reads `JWORDEN_MASTER_KEY`
- [ ] JWT is stored **in memory only** — not in `localStorage`, `sessionStorage`, or an unprotected cookie
- [ ] `ALLOWED_ORIGINS` in the Netlify Function matches your production and preview URLs exactly
- [ ] `ALLOWED_ORIGINS` in the FastAPI backend (`app/main.py`) matches your Netlify domain
- [ ] File uploads are validated for type and size client-side before sending (reduces wasted requests)
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` is the **publishable** key only — the Stripe secret key stays on the backend
- [ ] Rate limits are respected — implement exponential backoff for `429` responses
- [ ] `JWT_SECRET_KEY` is a long random string (minimum 32 characters): `openssl rand -hex 32`
- [ ] Sentry is configured on both frontend and backend for error visibility

---

## File Map

| File | Purpose | Deploy to |
|---|---|---|
| `FRONTEND_INTEGRATION.md` | This document — start here | — |
| `FRONTEND_AUTH_CLIENT.ts` | Auth token lifecycle + `apiFetch` + typed API helpers | `src/lib/auth.ts` |
| `FRONTEND_REACT_EXAMPLES.ts` | React hooks: `AuthProvider`, `useAuth`, `useCrmLeads`, `useAuthGuard` | `src/hooks/` (individual hooks) |
| `FRONTEND_NETLIFY_FUNCTION.ts` | Server-side token proxy (master key → JWT via FastAPI) | `netlify/functions/get-token.ts` |
