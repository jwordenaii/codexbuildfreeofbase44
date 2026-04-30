# Admin Endpoints Reference

All endpoints under `/admin/*` are served by the FastAPI backend and protected
with **HTTP Basic Authentication**. They render HTML pages (Jinja2 templates)
and are intentionally excluded from the OpenAPI spec and CORS policy — they
cannot be reached from browser JavaScript on any other origin.

---

## Authentication

**Method:** HTTP Basic Auth
**Credentials:** Set via environment variables `ADMIN_USERNAME` / `ADMIN_PASSWORD`

```bash
# Set shell variables before running any examples
export BASE="https://<your-railway-domain>"
export ADMIN_USER="<ADMIN_USERNAME value from Railway>"
export ADMIN_PASS="<ADMIN_PASSWORD value from Railway>"
```

> If `ADMIN_PASSWORD` is not set in Railway, all admin routes return
> `503 Service Unavailable` with the message
> `"Admin dashboard is not configured. Set ADMIN_PASSWORD."`

The server uses `secrets.compare_digest` for credential comparison to prevent
timing-based attacks.

---

## Endpoints

### `GET /admin` — Root Redirect

Redirects to `/admin/dashboard`. Requires Basic auth.

```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASS" -L "$BASE/admin"
# Follows redirect to /admin/dashboard
```

---

### `GET /admin/dashboard` — Overview Dashboard

Returns an HTML page with:
- Total lead count
- HOT / WARM / COOL lead breakdown
- Overdue leads (past SLA)
- Total contact form submissions
- Content block count
- Top 10 ranked leads
- 10 most recent contact messages

```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/dashboard" | grep -i "hot\|warm\|cool"
```

**Rate limit:** 100 requests/minute (global admin limit)

**What "overdue" means:** A lead whose SLA window has passed without being
contacted. HOT leads have a 1-hour SLA; WARM leads have a 3-day SLA;
COOL leads have a 7-day SLA.

---

### `GET /admin/leads` — Full Lead List

Returns an HTML page with all leads, ranked by score. Supports query-string filters.

```bash
# All leads
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/leads"

# Filter by score label (HOT, WARM, or COOL)
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/leads?label=HOT"

# Filter by SLA status (overdue only)
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/leads?sla=overdue"

# Combine filters
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/leads?label=WARM&sla=overdue"
```

**Query parameters:**

| Parameter | Values | Description |
|---|---|---|
| `label` | `HOT`, `WARM`, `COOL` | Filter by lead score label |
| `sla` | `overdue` | Show only leads past their SLA window |

**Rate limit:** 100 requests/minute

---

### `GET /admin/content` — Content Block List

Returns an HTML page listing all CMS content blocks (used by the Webpage Maker feature).
Blocks are ordered alphabetically by key.

```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/content"
```

**Rate limit:** 100 requests/minute

---

### `GET /admin/content/new` — New Content Block Form

Returns the HTML form for creating a new content block.

```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/content/new"
```

---

### `POST /admin/content/new` — Create Content Block

Creates a new CMS content block. Submits as `application/x-www-form-urlencoded`.

```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASS" \
  -X POST "$BASE/admin/content/new" \
  --data-urlencode "key=homepage_hero" \
  --data-urlencode "title=Welcome to J. Worden & Sons" \
  --data-urlencode "body=<p>Fourth-generation asphalt paving...</p>" \
  --data-urlencode "meta_json={\"cta\": \"Get a Free Quote\"}"
```

**Form fields:**

| Field | Required | Constraints | Description |
|---|---|---|---|
| `key` | ✅ | Lowercase letters, numbers, `_`, `-` only | Unique identifier for the block |
| `title` | ✅ | — | Display title |
| `body` | — | — | HTML body content |
| `meta_json` | — | Must be valid JSON if provided | Arbitrary metadata (CTAs, flags, etc.) |

**On success:** Redirects to `/admin/content` with a flash message.
**On error:** Re-renders the form with an error message (duplicate key, invalid JSON, etc.).

---

### `GET /admin/content/{key}/edit` — Edit Content Block Form

Returns the HTML edit form for an existing content block.

```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE/admin/content/homepage_hero/edit"
```

Returns `404` if the key does not exist.

---

### `POST /admin/content/{key}/edit` — Save Content Block Changes

Updates an existing content block.

```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASS" \
  -X POST "$BASE/admin/content/homepage_hero/edit" \
  --data-urlencode "title=Updated Title" \
  --data-urlencode "body=<p>Updated content here.</p>" \
  --data-urlencode "meta_json={\"cta\": \"Request a Quote\"}"
```

**Form fields:** Same as create (`title`, `body`, `meta_json`). The `key` is
taken from the URL path and cannot be changed via this endpoint.

**On success:** Redirects to `/admin/content` with a flash message.
**On error:** Returns `422` if `meta_json` is invalid JSON, or `404` if the key
does not exist.

---

### `POST /admin/content/{key}/delete` — Delete Content Block

Permanently deletes a content block. This action cannot be undone.

```bash
curl -s -u "$ADMIN_USER:$ADMIN_PASS" \
  -X POST "$BASE/admin/content/homepage_hero/delete"
```

**On success:** Redirects to `/admin/content` with a flash message.
**On error:** Returns `404` if the key does not exist.

---

## Rate Limits

All admin endpoints share the global admin rate limit of **100 requests/minute per IP**.
This is enforced by `slowapi` using the `ADMIN_LIMIT` constant in `app/core/limiter.py`.

Exceeding the limit returns:
```
HTTP 429 Too Many Requests
```

---

## Security Notes

- Admin routes are **excluded from CORS** — browser JavaScript on any other
  origin cannot reach them, even with valid credentials.
- Admin routes are **excluded from the OpenAPI spec** (`include_in_schema=False`)
  — they do not appear in `/docs` or `/openapi.json`.
- Credentials are compared using `secrets.compare_digest` to prevent timing attacks.
- `ADMIN_PASSWORD` has no default value. If it is not set, all admin routes
  return `503` rather than falling back to an insecure default.
- All create/update/delete actions are logged at `INFO` level with the content
  block key for audit purposes.

---

## Troubleshooting

### `503 Service Unavailable` on all admin routes

`ADMIN_PASSWORD` is not set. Add it in Railway → API service → Variables and redeploy.

### `401 Unauthorized`

Credentials are wrong. Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Railway variables.

### `404 Not Found` on a content block

The key does not exist in the database. Use `GET /admin/content` to list all existing keys.

### `422 Unprocessable Entity` on content create/edit

`meta_json` contains invalid JSON. Validate it first:

```bash
echo '{"cta": "Get a Quote"}' | python3 -m json.tool
```
