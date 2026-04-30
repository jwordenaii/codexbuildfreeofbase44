# Protected Endpoints Reference

All protected endpoints require a valid **Bearer token** in the `Authorization` header.
Two token types are accepted:

1. **Master key** (`JWORDEN_MASTER_KEY`) — long-lived, no expiry. For internal tools and backend-to-backend calls.
2. **JWT** — short-lived (24-hour expiry), signed with `JWT_SECRET_KEY`. Recommended for frontend sessions.

---

## Getting a Token

### Option A — Use the Master Key Directly

```bash
export BASE="https://<your-railway-domain>"
export MASTER_KEY="<your-JWORDEN_MASTER_KEY>"

curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $MASTER_KEY"
```

### Option B — Exchange Master Key for a JWT (Recommended for Frontend)

```bash
# POST to /api/v1/auth/token with the master key as a Bearer token
TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/token" \
  -H "Authorization: Bearer $MASTER_KEY" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "JWT: $TOKEN"
# Use $TOKEN in subsequent requests
```

**Response from `/api/v1/auth/token`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### Option C — Generate a JWT Locally

```bash
python3 - <<'EOF'
import os, time
from jose import jwt

secret = os.environ["JWT_SECRET_KEY"]
payload = {
    "sub": "Admin",
    "tenant_id": "JWORDEN_HQ",
    "iat": int(time.time()),
    "exp": int(time.time()) + 86400,
}
token = jwt.encode(payload, secret, algorithm="HS256")
print(token)
EOF
```

---

## Auth Endpoint

### `POST /api/v1/auth/token` — Issue JWT

Exchange the master key for a 24-hour JWT.

```bash
curl -s -X POST "$BASE/api/v1/auth/token" \
  -H "Authorization: Bearer $MASTER_KEY"
```

| Condition | Response |
|---|---|
| Valid master key | `200` with `access_token` |
| Missing `Authorization` header | `401 Unauthorized` |
| Wrong master key | `403 Forbidden` |
| `JWORDEN_MASTER_KEY` not set | `500 Internal Server Error` |
| `JWT_SECRET_KEY` not set | `500 Internal Server Error` |

---

## Public Endpoints (No Auth Required)

These endpoints are open to the internet and rate-limited per IP.

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| `POST` | `/api/v1/leads/quote` | 10/min | Customer quote submission |
| `POST` | `/api/v1/leads/contact` | 10/min | Customer contact form |
| `POST` | `/api/v1/leads/estimate` | 30/min | Ballpark price estimate |
| `POST` | `/api/v1/ai/chat` | *(global 200/min)* | Public chatbot (J. Worden persona) |
| `POST` | `/api/v1/ai/contact-suggest` | *(global 200/min)* | Form field suggestions |
| `GET` | `/health` | *(global 200/min)* | Basic liveness check |
| `GET` | `/health/live` | *(global 200/min)* | Liveness probe |
| `GET` | `/health/ready` | *(global 200/min)* | Readiness probe (DB + Redis + Celery) |
| `GET` | `/api/v1/blog/*` | *(global 200/min)* | Public blog content |
| `GET` | `/api/v1/advisor/*` | *(global 200/min)* | Public advisory content |
| `GET` | `/api/v1/reviews` | *(global 200/min)* | Public reviews |
| `GET` | `/api/v1/schema/*` | *(global 200/min)* | SEO schema markup |
| `GET` | `/api/v1/content/*` | *(global 200/min)* | CMS content blocks |
| `POST` | `/api/v1/visualizer/proposal` | *(global 200/min)* | 3D build quote submission |
| `POST` | `/api/v1/voice/twilio-webhook` | *(global 200/min)* | Twilio TwiML (validated by Twilio) |
| `POST` | `/api/v1/voice/twilio-recording-callback` | *(global 200/min)* | Twilio recording callback |
| `POST` | `/api/v1/payments/webhook` | *(global 200/min)* | Stripe webhook (validated by Stripe signature) |
| `POST` | `/api/v1/iot/truck-ping` | *(global 200/min)* | IoT truck telemetry (legacy, no auth) |

---

## Protected Endpoints (Bearer Token Required)

All endpoints below return `403 Forbidden` without a valid token.

### Authentication

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/token` | *(global 200/min)* | Exchange master key for a 24-hour JWT |

---

### CRM — Lead Pipeline

**Rate limit:** 60 requests/minute

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/crm/leads` | List leads with optional filters |
| `PATCH` | `/api/v1/crm/leads/{lead_id}/stage` | Update a lead's pipeline stage |
| `GET` | `/api/v1/crm/funnel` | Lead conversion funnel counts by stage |

```bash
# List all leads
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $MASTER_KEY"

# Filter by pipeline stage
curl -s "$BASE/api/v1/crm/leads?pipeline_stage=new&limit=20" \
  -H "Authorization: Bearer $MASTER_KEY"

# Filter by score label
curl -s "$BASE/api/v1/crm/leads?score_label=HOT" \
  -H "Authorization: Bearer $MASTER_KEY"

# Update pipeline stage
curl -s -X PATCH "$BASE/api/v1/crm/leads/1/stage" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_stage": "contacted"}'

# Mark as won
curl -s -X PATCH "$BASE/api/v1/crm/leads/1/stage" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_stage": "won", "closed_reason": "Signed contract 2025-06-01"}'

# Get funnel counts
curl -s "$BASE/api/v1/crm/funnel" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Valid pipeline stages:** `new`, `contacted`, `proposal_sent`, `negotiating`, `won`, `lost`

**`GET /api/v1/crm/leads` query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `pipeline_stage` | string | Filter by stage |
| `score_label` | string | Filter by `HOT`, `WARM`, or `COOL` |
| `limit` | int (1–200, default 50) | Page size |
| `offset` | int (default 0) | Pagination offset |

---

### Analytics — Business Intelligence

**Rate limit:** 30 requests/minute

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/dashboard` | Full BI dashboard (all metrics) |
| `GET` | `/api/v1/analytics/funnel` | Lead conversion funnel |
| `GET` | `/api/v1/analytics/revenue-forecast` | Revenue projection |
| `GET` | `/api/v1/analytics/monthly-volume` | Monthly lead volume (12 months) |

```bash
curl -s "$BASE/api/v1/analytics/dashboard" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool

curl -s "$BASE/api/v1/analytics/revenue-forecast" \
  -H "Authorization: Bearer $MASTER_KEY"

curl -s "$BASE/api/v1/analytics/monthly-volume" \
  -H "Authorization: Bearer $MASTER_KEY"
```

---

### AI — Photo Inspection

**Rate limit:** Global 200/minute

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/ai/photo-inspect` | Bearer token | GPT-4 Vision asphalt damage assessment |

```bash
curl -s -X POST "$BASE/api/v1/ai/photo-inspect" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -F "file=@/path/to/asphalt-photo.jpg"
```

**Accepted file types:** `image/jpeg`, `image/png`, `image/webp` (max 10 MB)

**Example response:**
```json
{
  "status": "success",
  "tenant": "JWORDEN_HQ",
  "analysis": {
    "engine": "gpt-4o",
    "damage_detected": true,
    "severity": "moderate",
    "recommended_services": ["crack_filling", "sealcoating"],
    "estimated_lifespan_years": 3
  }
}
```

---

### AI — Compliance Check (Legacy)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/ai/compliance` | State construction code compliance analysis |

```bash
curl -s -X POST "$BASE/api/v1/ai/compliance" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"state": "VA", "project_scope": "commercial parking lot resurfacing"}'
```

---

### Blog — Admin Operations

Public read endpoints (`GET /api/v1/blog`, `GET /api/v1/blog/{slug}`) require no auth.
Write operations require a Bearer token.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/blog/draft` | AI-generate a blog post draft (GPT-4o) |
| `POST` | `/api/v1/blog` | Create/publish a blog post |
| `PUT` | `/api/v1/blog/{slug}` | Update a blog post |
| `POST` | `/api/v1/blog/{slug}/publish` | Publish a draft post |

```bash
# Generate an AI draft
curl -s -X POST "$BASE/api/v1/blog/draft" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic": "How to extend the life of your asphalt driveway"}'

# Publish a draft
curl -s -X POST "$BASE/api/v1/blog/extend-asphalt-life/publish" \
  -H "Authorization: Bearer $MASTER_KEY"
```

---

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/payments/checkout-session` | Bearer token | Create Stripe checkout session for deposit |
| `GET` | `/api/v1/payments/status/{lead_id}` | Bearer token | Get payment status for a lead |
| `POST` | `/api/v1/payments/webhook` | None (Stripe signature) | Stripe webhook handler |

```bash
# Create a checkout session
curl -s -X POST "$BASE/api/v1/payments/checkout-session" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lead_id": 42}'

# Check payment status
curl -s "$BASE/api/v1/payments/status/42" \
  -H "Authorization: Bearer $MASTER_KEY"
```

---

### Voice / Transcription

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/voice/transcribe` | Bearer token | Transcribe audio + extract lead entities |
| `POST` | `/api/v1/voice/twilio-webhook` | None (Twilio) | Twilio TwiML call handler |
| `POST` | `/api/v1/voice/twilio-recording-callback` | None (Twilio) | Process completed Twilio recording |

```bash
# Transcribe an audio file
curl -s -X POST "$BASE/api/v1/voice/transcribe" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -F "file=@/path/to/call-recording.mp3"
```

**Rate limit on `/transcribe`:** 10 requests/minute

---

### Metrics — Operational Monitoring

**Rate limit:** 300 requests/minute

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/metrics/celery` | Celery queue depth, active tasks, worker status |
| `GET` | `/api/v1/metrics/redis` | Redis memory, key count, connected clients |
| `GET` | `/api/v1/metrics/database` | Postgres pool stats and query latency |
| `GET` | `/api/v1/metrics/ai` | OpenAI call counts, latency, error rate |
| `GET` | `/api/v1/metrics/cache` | Redis cache hit/miss ratio |

```bash
curl -s "$BASE/api/v1/metrics/celery" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool

curl -s "$BASE/api/v1/metrics/database" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool

curl -s "$BASE/api/v1/metrics/redis" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool
```

---

### Other Protected Endpoints

The following endpoint groups all require a Bearer token and follow the same
authentication pattern. Rate limits are 60 requests/minute unless noted.

| Prefix | Description | Rate Limit |
|---|---|---|
| `GET /api/v1/bid-intelligence/*` | Bid analysis and competitive intelligence | 30/min |
| `GET /api/v1/cashflow/*` | Cash flow analysis | 60/min |
| `GET /api/v1/customers/*` | Customer management | 60/min |
| `GET /api/v1/documents/*` | Document management | 60/min |
| `GET /api/v1/followups/*` | Follow-up task management | 60/min |
| `GET /api/v1/foreman/*` | Job site management | 60/min |
| `GET /api/v1/geo/*` | Geospatial data | 60/min |
| `GET /api/v1/human-review/*` | AI decision review queue | 60/min |
| `GET /api/v1/igrade/*` | Grading and inspection | 60/min |
| `GET /api/v1/innovations/*` | Innovation tracking | 60/min |
| `GET /api/v1/kpi-wall/*` | KPI dashboard | 30/min |
| `GET /api/v1/liens/*` | Lien deadline tracking | 60/min |
| `GET /api/v1/market/*` | Market intelligence data | 30/min |
| `GET /api/v1/materials/*` | Material pricing (internal) | 60/min |
| `GET /api/v1/permits/*` | Permit tracking | 60/min |
| `GET /api/v1/project-metrics/*` | Project scorecards and trends | 60/min |
| `GET /api/v1/proposals/*` | Proposal management | 60/min |
| `GET /api/v1/retrospectives/*` | Project retrospectives | 60/min |
| `GET /api/v1/reviews/respond` | AI review response drafting | 60/min |
| `GET /api/v1/safety/*` | Safety tracking | 60/min |
| `GET /api/v1/seo/*` | SEO content generation | 30/min |
| `GET /api/v1/subcontractors/*` | Subcontractor management | 60/min |
| `GET /api/v1/takeoff/*` | Project takeoff | 60/min |
| `GET /api/v1/tenants/*` | Tenant management | 60/min |
| `GET /api/v1/visualizer/parcel` | Parcel lookup (internal) | 60/min |
| `GET /api/v1/visualizer/ai-suggestions` | AI design suggestions (internal) | 60/min |
| `GET /api/v1/weather/*` | Weather scheduling (internal) | 60/min |
| `GET /api/v1/workforce/*` | Workforce management | 60/min |

---

## Error Reference

| Status | Body | Cause |
|---|---|---|
| `403` | `{"detail": "Unauthorized: no token"}` | No `Authorization` header |
| `403` | `{"detail": "Unauthorized: invalid token"}` | Token is not the master key and JWT verification failed |
| `500` | `{"detail": "Server authentication is not configured. Set JWT_SECRET_KEY."}` | `JWT_SECRET_KEY` env var is missing |
| `429` | `{"error": "Rate limit exceeded"}` | Too many requests from this IP |

---

## OpenAPI Documentation

The interactive API docs list all protected endpoints with their schemas:

```bash
# Open Swagger UI in browser
open "$BASE/docs"

# Download the raw OpenAPI schema
curl -s "$BASE/openapi.json" | python3 -m json.tool > openapi.json
```

> Admin endpoints (`/admin/*`) are excluded from the OpenAPI spec by design.
