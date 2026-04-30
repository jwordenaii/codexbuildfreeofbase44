# Endpoint Testing Guide

Complete cURL reference for every endpoint category in the JWordenAI backend.

---

## Setup

Set these shell variables once before running any examples:

```bash
BASE="https://<your-railway-domain>"   # e.g. https://jworden-api.up.railway.app
MASTER_KEY="<your-JWORDEN_MASTER_KEY>" # from Railway environment variables
JWT_SECRET="<your-JWT_SECRET_KEY>"     # from Railway environment variables
```

---

## Authentication

### Option A — Use the Master Key Directly

The master key can be passed as a bearer token with no expiry. This is the simplest approach for internal tools and backend-to-backend calls.

```bash
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $MASTER_KEY"
```

### Option B — Exchange the Master Key for a JWT

Generate a short-lived JWT (24-hour expiry) using Python. This is the recommended approach for the frontend.

```bash
python3 - <<'EOF'
import os, time
from jose import jwt

secret = os.environ["JWT_SECRET_KEY"]
payload = {
    "sub": "frontend-app",
    "tenant_id": "JWORDEN_HQ",
    "iat": int(time.time()),
    "exp": int(time.time()) + 86400,   # 24 hours
}
token = jwt.encode(payload, secret, algorithm="HS256")
print(token)
EOF
```

Copy the printed token and export it:

```bash
export TOKEN="<paste-token-here>"
```

Use it in requests:

```bash
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Public Endpoints (No Auth Required)

These endpoints are open to the internet and rate-limited at 10–30 requests/minute per IP.

### Submit a Quote Request

```bash
curl -s -X POST "$BASE/api/v1/leads/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "804-555-0100",
    "service_type": "sealcoating",
    "property_type": "residential",
    "urgency": "within_1_month",
    "project_size_sqft": 2000,
    "address": "123 Main St, Chester, VA",
    "message": "Driveway needs sealcoating before winter."
  }'
```

**Expected response:**
```json
{
  "status": "received",
  "message": "Thank you! We will contact you within 24 hours.",
  "lead_score": "WARM",
  "priority": 2,
  "follow_up_sla": "3 days"
}
```

### Submit a Contact Form Message

```bash
curl -s -X POST "$BASE/api/v1/leads/contact" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob Jones",
    "email": "bob@example.com",
    "phone": "804-555-0200",
    "message": "Interested in a parking lot resurfacing quote."
  }'
```

**Expected response:**
```json
{
  "status": "received",
  "message": "Thank you for reaching out! We will get back to you soon."
}
```

### Get a Price Estimate

```bash
curl -s -X POST "$BASE/api/v1/leads/estimate" \
  -H "Content-Type: application/json" \
  -d '{
    "service_type": "sealcoating",
    "property_type": "residential",
    "project_size_sqft": 2000
  }'
```

**Expected response:**
```json
{
  "estimate_available": true,
  "low": 300.0,
  "high": 700.0,
  "unit": "USD"
}
```

### AI Chat (J. Worden Sr. Persona)

```bash
curl -s -X POST "$BASE/api/v1/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How much does sealcoating cost?",
    "state_code": "VA",
    "session_id": "test-session-001"
  }'
```

**Expected response:**
```json
{
  "answer": "Good news — asphalt is one of the most cost-effective surfaces...",
  "engine": "gpt-4o-mini",
  "session_id": "test-session-001"
}
```

### AI Contact Suggestion

```bash
curl -s -X POST "$BASE/api/v1/ai/contact-suggest" \
  -H "Content-Type: application/json" \
  -d '{"message": "My driveway has a lot of cracks and needs sealing"}'
```

**Expected response:**
```json
{
  "service_type": "crack_filling",
  "hint": "Tip: note how many linear feet of cracks if you can — we can ballpark from that.",
  "engine": "rule_engine"
}
```

---

## Protected Endpoints (Auth Required)

All protected endpoints return `403 Forbidden` without a valid bearer token.

### CRM — Lead Pipeline

**List all leads:**
```bash
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Filter by pipeline stage:**
```bash
curl -s "$BASE/api/v1/crm/leads?pipeline_stage=new&limit=20" \
  -H "Authorization: Bearer $MASTER_KEY"
```

Valid stages: `new`, `contacted`, `proposal_sent`, `negotiating`, `won`, `lost`

**Filter by score label:**
```bash
curl -s "$BASE/api/v1/crm/leads?score_label=HOT" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Update a lead's pipeline stage:**
```bash
curl -s -X PATCH "$BASE/api/v1/crm/leads/1/stage" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_stage": "contacted"}'
```

**Expected response:**
```json
{"id": 1, "pipeline_stage": "contacted", "status": "updated"}
```

**Mark a lead as won:**
```bash
curl -s -X PATCH "$BASE/api/v1/crm/leads/1/stage" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_stage": "won", "closed_reason": "Signed contract 2025-06-01"}'
```

**Get funnel counts:**
```bash
curl -s "$BASE/api/v1/crm/funnel" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Expected response:**
```json
{
  "funnel": [
    {"stage": "new", "count": 12},
    {"stage": "contacted", "count": 8},
    {"stage": "proposal_sent", "count": 5},
    {"stage": "negotiating", "count": 2},
    {"stage": "won", "count": 3},
    {"stage": "lost", "count": 1}
  ],
  "total": 31,
  "won": 3,
  "win_rate_pct": 9.7
}
```

### Analytics — Business Intelligence

**Full BI dashboard:**
```bash
curl -s "$BASE/api/v1/analytics/dashboard" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Lead conversion funnel:**
```bash
curl -s "$BASE/api/v1/analytics/funnel" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Revenue forecast:**
```bash
curl -s "$BASE/api/v1/analytics/revenue-forecast" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Monthly lead volume (12 months):**
```bash
curl -s "$BASE/api/v1/analytics/monthly-volume" \
  -H "Authorization: Bearer $MASTER_KEY"
```

### Project Metrics — Scorecard

**List all scorecards:**
```bash
curl -s "$BASE/api/v1/project-metrics" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Create a scorecard:**
```bash
curl -s -X POST "$BASE/api/v1/project-metrics" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "KFC Parking Lot — Richmond VA",
    "actual_cost": 48500,
    "estimated_cost": 50000,
    "scheduled_days": 5,
    "actual_days": 4,
    "client_nps": 9,
    "punch_list_items": 3,
    "punch_list_closed": 3,
    "completion_date": "2025-05-15"
  }'
```

**Portfolio trends:**
```bash
curl -s "$BASE/api/v1/project-metrics/trends" \
  -H "Authorization: Bearer $MASTER_KEY"
```

**Generate a GPT-4o case study:**
```bash
curl -s -X POST "$BASE/api/v1/project-metrics/1/case-study" \
  -H "Authorization: Bearer $MASTER_KEY"
```

### AI — Photo Inspection (Protected)

```bash
curl -s -X POST "$BASE/api/v1/ai/photo-inspect" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -F "file=@/path/to/asphalt-photo.jpg"
```

**Expected response:**
```json
{
  "status": "success",
  "tenant": "JWORDEN_HQ",
  "analysis": {
    "engine": "gpt-4o",
    "damage_detected": true,
    "severity": "moderate",
    "findings": [...],
    "recommended_services": ["crack_filling", "sealcoating"],
    "estimated_lifespan_years": 3
  }
}
```

### IoT — Truck Telemetry (Legacy, No Auth)

```bash
curl -s -X POST "$BASE/api/v1/iot/truck-ping" \
  -H "Content-Type: application/json" \
  -d '{
    "truck_id": "TRUCK-07",
    "asphalt_temp_f": 310.0,
    "delay_minutes": 15
  }'
```

---

## Health Check Endpoints

### Primary Health Check

```bash
curl -s "$BASE/health"
```

**Expected response:**
```json
{"status": "ok", "service": "JWordenAI"}
```

### OpenAPI Documentation

```bash
# Interactive Swagger UI
open "$BASE/docs"

# Raw OpenAPI JSON schema
curl -s "$BASE/openapi.json" | python3 -m json.tool | head -40
```

---

## Testing Auth Failure Cases

### No token — expect 403

```bash
curl -i "$BASE/api/v1/crm/leads"
# HTTP/1.1 403 Forbidden
# {"detail": "Unauthorized: no token"}
```

### Invalid token — expect 403

```bash
curl -i "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer this-is-not-a-valid-token"
# HTTP/1.1 403 Forbidden
# {"detail": "Unauthorized: invalid token"}
```

### Missing JWT_SECRET_KEY — expect 500

If `JWT_SECRET_KEY` is not set in the environment and a JWT (not the master key) is presented, the server returns:

```json
{"detail": "Server authentication is not configured. Set JWT_SECRET_KEY."}
```

---

## Admin Dashboard

The admin dashboard uses HTTP Basic Auth, not bearer tokens.

```bash
# Access via browser
open "$BASE/admin/dashboard"

# Or via curl
curl -s -u "admin:$ADMIN_PASSWORD" "$BASE/admin/dashboard" | head -20
```

The admin dashboard is excluded from the OpenAPI spec and CORS — it is not accessible from browser JavaScript on other origins.
