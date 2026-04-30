# Backend Security CLI Guide

Complete guide for managing security-sensitive backend logic via the command line.
Covers protected routes, environment variables, deployment, testing, and JWT verification.

---

## Prerequisites

### Tools Required

```bash
# Railway CLI
npm install -g @railway/cli

# Verify installation
railway --version

# Python (for JWT generation)
python3 --version   # 3.11+

# curl (for endpoint testing)
curl --version
```

### Clone the Backend Repo

```bash
git clone <your-backend-repo-url>
cd <repo-directory>

# Create a local virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Link to Railway

```bash
# Log in
railway login

# Link to the existing project
railway link

# Confirm the correct project and environment are selected
railway status
```

### Set Shell Variables

Set these once per terminal session before running any examples:

```bash
export BASE="https://<your-railway-domain>"   # e.g. https://jworden-api.up.railway.app
export MASTER_KEY="<your-JWORDEN_MASTER_KEY>" # from Railway → API service → Variables
export ADMIN_USER="<your-ADMIN_USERNAME>"     # from Railway → API service → Variables
export ADMIN_PASS="<your-ADMIN_PASSWORD>"     # from Railway → API service → Variables
```

---

## Modifying Protected Routes

All protected routes use `verify_premium_security` from `app/core/security.py`.
This dependency accepts either the raw master key or a signed JWT as a Bearer token.

### How `verify_premium_security` Works

```python
# app/core/security.py
def verify_premium_security(token: str = Security(oauth2_scheme)):
    # 1. Checks token against JWORDEN_MASTER_KEY (no expiry)
    # 2. Falls back to JWT verification using JWT_SECRET_KEY (HS256)
    # Returns: {"user": "Admin", "tenant_id": "JWORDEN_HQ"}
```

### Adding Auth to an Existing Endpoint

```python
# Before (unprotected)
@router.get("/api/v1/example")
async def my_endpoint(db: Session = Depends(get_db)):
    ...

# After (protected)
from ..core.security import verify_premium_security

@router.get("/api/v1/example")
async def my_endpoint(
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),   # add this line
):
    ...
```

### Adding a New Protected Endpoint

```python
# app/routers/my_router.py
from fastapi import APIRouter, Depends, Request
from ..core.limiter import CRM_LIMIT, limiter
from ..core.security import verify_premium_security
from ..database import get_db

router = APIRouter(prefix="/api/v1/my-feature", tags=["my-feature"])

@router.get("/data", summary="Get my feature data")
@limiter.limit(CRM_LIMIT)   # 60/minute — adjust as needed
async def get_data(
    request: Request,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    tenant = security["tenant_id"]   # "JWORDEN_HQ"
    return {"tenant": tenant, "data": [...]}
```

Register the router in `app/main.py`:

```python
from .routers import my_router as my_router_module
# ...
app.include_router(my_router_module.router)
```

### Adding a New Admin Endpoint

Admin endpoints use HTTP Basic Auth via `_require_admin` in `app/routers/admin.py`.
They are excluded from the OpenAPI spec (`include_in_schema=False`) and CORS.

```python
# app/routers/admin.py — add inside the existing router

@router.get("/my-admin-page", response_class=HTMLResponse)
def admin_my_page(
    request: Request,
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),   # HTTP Basic auth enforced here
):
    data = db.query(MyModel).all()
    return _render(request, "admin/my_page.html", db, active="my-page", data=data)
```

### Changing Rate Limits

Rate limits are defined in `app/core/limiter.py`:

| Constant | Value | Use Case |
|---|---|---|
| `PUBLIC_LIMIT` | `10/minute` | Public-facing forms |
| `ANALYTICS_LIMIT` | `30/minute` | Expensive BI queries |
| `CRM_LIMIT` | `60/minute` | CRM reads/writes |
| `HEALTH_LIMIT` | `300/minute` | Health/metrics probes |
| `ADMIN_LIMIT` | `100/minute` | Admin dashboard |
| *(global default)* | `200/minute` | All other endpoints |

To change a limit, edit the constant in `app/core/limiter.py` and redeploy.

---

## Managing Environment Variables via Railway CLI

### View Current Variables

```bash
# List all variables for the API service
railway variables --service api

# List variables for the worker service
railway variables --service worker
```

### Set a Variable

```bash
# Set a single variable
railway variables set JWORDEN_MASTER_KEY="new-value-here" --service api

# Set multiple variables at once
railway variables set \
  JWT_SECRET_KEY="$(openssl rand -hex 32)" \
  LOG_FORMAT="json" \
  --service api
```

### Delete a Variable

```bash
railway variables delete OLD_VARIABLE_NAME --service api
```

### Generate Secure Keys

```bash
# Generate a new master key (64 hex chars = 256 bits)
openssl rand -hex 32

# Generate a new JWT secret
openssl rand -hex 32

# Generate a new admin password
openssl rand -base64 24
```

### Copy Variables Between Environments

```bash
# Export from production
railway variables --service api --environment production > prod_vars.txt

# Review the file, then import to staging
# (set each variable manually — never commit secrets to git)
```

---

## Deploying Changes

### Standard Deployment (Recommended)

Railway auto-deploys on every push to `main`. This is the standard path:

```bash
# Make your changes
git add .
git commit -m "feat: add new protected endpoint"
git push origin main
```

Railway detects the push, builds the Docker image, and deploys automatically.
Monitor progress in the Railway dashboard or via CLI:

```bash
# Watch deployment logs in real time
railway logs --service api

# Check deployment status
railway status
```

### Force Deploy Without a Code Change

```bash
# Trigger a redeploy of the current commit
railway redeploy --service api
```

### Deploy via Railway CLI (Bypass Git)

Use `railway up` only for urgent hotfixes when you cannot push to git:

```bash
# Deploy current working directory directly
railway up --service api

# Deploy and detach (don't stream logs)
railway up --service api --detach
```

> **Warning:** `railway up` deploys uncommitted code. Always prefer `git push` so
> changes are tracked in version history.

### Verify a Deployment

```bash
# 1. Basic liveness
curl -s "$BASE/health"
# Expected: {"status": "ok", "service": "JWordenAI"}

# 2. Full readiness (checks DB + Redis + Celery)
curl -s "$BASE/health/ready" | python3 -m json.tool

# 3. Confirm a protected endpoint still works
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -m json.tool

# 4. Confirm an unauthenticated request is still rejected
curl -i "$BASE/api/v1/crm/leads"
# Expected: HTTP 403 {"detail": "Unauthorized: no token"}
```

---

## Testing Protected Endpoints

### Option A — Master Key (Simplest)

```bash
# Use the master key directly as a Bearer token
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $MASTER_KEY"
```

### Option B — Exchange Master Key for a JWT

```bash
# Step 1: Exchange the master key for a 24-hour JWT
TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/token" \
  -H "Authorization: Bearer $MASTER_KEY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "JWT: $TOKEN"

# Step 2: Use the JWT for subsequent requests
curl -s "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer $TOKEN"
```

### Option C — Generate a JWT Locally (No API Call)

```bash
python3 - <<'EOF'
import os, time
from jose import jwt

secret = os.environ["JWT_SECRET_KEY"]   # must be set locally
payload = {
    "sub": "Admin",
    "tenant_id": "JWORDEN_HQ",
    "iat": int(time.time()),
    "exp": int(time.time()) + 86400,    # 24 hours
}
token = jwt.encode(payload, secret, algorithm="HS256")
print(token)
EOF
```

### Test Auth Failure Cases

```bash
# No token — expect 403
curl -i "$BASE/api/v1/crm/leads"
# HTTP/1.1 403 Forbidden
# {"detail": "Unauthorized: no token"}

# Invalid token — expect 403
curl -i "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer this-is-not-valid"
# HTTP/1.1 403 Forbidden
# {"detail": "Unauthorized: invalid token"}

# Wrong master key — expect 403
curl -i "$BASE/api/v1/crm/leads" \
  -H "Authorization: Bearer wrong-key"
# HTTP/1.1 403 Forbidden
```

### Test Admin Endpoints

```bash
# Admin dashboard (HTTP Basic auth)
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/dashboard" | head -30

# Admin leads list
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/leads"

# Wrong credentials — expect 401
curl -i -u "wrong:credentials" "$BASE/admin/dashboard"
# HTTP/1.1 401 Unauthorized
# WWW-Authenticate: Basic realm="JWordenAI Admin"
```

---

## Verifying JWT Tokens

### Decode a JWT (Without Verification)

```bash
# Decode the payload section (base64) — does NOT verify the signature
echo "<your-jwt>" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
```

### Verify a JWT Signature

```python
# verify_jwt.py
import os, sys
from jose import jwt, JWTError

token = sys.argv[1]
secret = os.environ["JWT_SECRET_KEY"]

try:
    payload = jwt.decode(token, secret, algorithms=["HS256"])
    print("VALID:", payload)
except JWTError as e:
    print("INVALID:", e)
```

```bash
python3 verify_jwt.py "<your-jwt>"
# VALID: {'sub': 'Admin', 'tenant_id': 'JWORDEN_HQ', 'iat': 1748000000, 'exp': 1748086400}
```

### Check Token Expiry

```python
import time, base64, json, sys

token = sys.argv[1]
payload_b64 = token.split(".")[1]
# Pad base64 if needed
payload_b64 += "=" * (4 - len(payload_b64) % 4)
payload = json.loads(base64.b64decode(payload_b64))

exp = payload.get("exp", 0)
remaining = exp - int(time.time())
if remaining > 0:
    print(f"Token valid for {remaining // 3600}h {(remaining % 3600) // 60}m")
else:
    print(f"Token EXPIRED {abs(remaining) // 60} minutes ago")
```

---

## Checking Deployment Status

```bash
# Current deployment status
railway status

# Live API logs
railway logs --service api

# Live worker logs
railway logs --service worker

# Last 200 lines from API
railway logs --service api --tail 200

# Filter for errors only
railway logs --service api | grep -i "error\|exception\|traceback"

# Check Celery worker health
railway run --service worker celery -A app.celery_app inspect ping

# Check current Alembic migration revision
railway run --service api alembic current
```

---

## Rollback Procedures

### Rollback via Railway Dashboard

1. Railway dashboard → API service → **Deployments**
2. Find the last known-good deployment
3. Click **Redeploy** on that deployment

This redeploys the previous Docker image without a new build.

### Rollback via CLI

```bash
# List recent deployments
railway deployments --service api

# Redeploy a specific deployment by ID
railway redeploy <deployment-id> --service api
```

### Rollback a Database Migration

```bash
# Roll back one migration step
railway run --service api alembic downgrade -1

# Roll back to a specific revision
railway run --service api alembic downgrade bc2d5f75bee4

# Verify current revision
railway run --service api alembic current
```

> **Important:** Rolling back code does not roll back database migrations.
> If the old code is incompatible with the current schema, roll back the
> migration first, then roll back the code.

### Emergency: Take the API Offline

```bash
# Scale replicas to 0 (all requests get 502)
# Railway dashboard → API service → Settings → Replicas → 0

# Restore service
# Railway dashboard → API service → Settings → Replicas → 1 (or more)
```

---

## Local Development Setup

```bash
# Copy the example env file
cp .env.example .env   # or create manually (see ENVIRONMENT_VARIABLES.md)

# Start all services with Docker Compose
docker compose up --build

# Or run just the API locally (requires local Postgres + Redis)
uvicorn app.main:app --reload --port 8000

# Run tests
pytest -q

# Apply migrations locally
alembic upgrade head
```

---

## Quick Reference

| Task | Command |
|---|---|
| View Railway variables | `railway variables --service api` |
| Set a variable | `railway variables set KEY=value --service api` |
| Deploy (standard) | `git push origin main` |
| Force redeploy | `railway redeploy --service api` |
| View live logs | `railway logs --service api` |
| Run a command in production | `railway run --service api <command>` |
| Apply DB migrations | `railway run --service api alembic upgrade head` |
| Check migration status | `railway run --service api alembic current` |
| Roll back one migration | `railway run --service api alembic downgrade -1` |
| Generate a secure key | `openssl rand -hex 32` |
| Health check | `curl $BASE/health` |
| Full readiness check | `curl $BASE/health/ready` |
