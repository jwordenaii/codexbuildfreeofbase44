# Performance Optimization Guide

This document describes the caching strategy, query optimizations, connection
pool tuning, and monitoring setup introduced to support 10× traffic growth
(100 → 1000+ requests/day) without scaling the infrastructure.

---

## 1. Redis Caching Layer (`app/core/cache.py`)

### Cache-Aside Pattern

Every cached endpoint follows the same pattern:

1. Check Redis for the key.
2. On a **hit** — return the cached value immediately (no DB query).
3. On a **miss** — query the database, store the result in Redis with a TTL,
   then return the result.

### TTL Strategy

| Data                  | Cache Key                  | TTL       | Rationale                              |
|-----------------------|----------------------------|-----------|----------------------------------------|
| CRM leads list        | `crm:leads:<md5>`          | 30 s      | Frequently updated pipeline data       |
| CRM funnel            | `crm:funnel`               | 30 s      | Aggregate changes with every stage move|
| Analytics dashboard   | `analytics:dashboard`      | 60 s      | Expensive multi-table aggregation      |
| Analytics funnel      | `analytics:funnel`         | 60 s      | Same source data as CRM funnel         |
| Revenue forecast      | `analytics:revenue`        | 60 s      | Derived from HOT leads                 |
| Monthly volume        | `analytics:monthly`        | 60 s      | 12-month rolling window                |
| KPI wall              | `kpi:wall`                 | 5 min     | Aggregate across 6 modules             |
| Customer list         | `customers:list:<md5>`     | 2 min     | Reference data, changes infrequently   |
| Customer stats        | `customers:stats`          | 2 min     | Aggregate counts                       |
| Customer detail       | `customers:detail:<id>`    | 2 min     | Single record                          |
| Blog posts            | `blog:list` / `blog:post:*`| 1 hour    | Static content                         |
| Estimates / pricing   | *(future)*                 | 24 hours  | Pricing rarely changes                 |

All TTLs are configurable via environment variables:

```
CACHE_TTL_CRM_LEADS=30
CACHE_TTL_ANALYTICS=60
CACHE_TTL_KPI_WALL=300
CACHE_TTL_CUSTOMERS=120
CACHE_TTL_BLOG=3600
CACHE_TTL_ESTIMATES=86400
```

### Cache Key Design

- **Static keys** (e.g. `kpi:wall`, `analytics:dashboard`) — single key for
  the entire result set.
- **Parameterised keys** (e.g. `crm:leads:<md5>`) — the MD5 of the
  JSON-serialised query parameters ensures each unique filter combination gets
  its own cache entry.

---

## 2. Cache Invalidation (`app/core/cache.py`)

Caches are invalidated immediately after any write operation so stale data is
never served for longer than the TTL.

| Write operation              | Invalidated keys                                              |
|------------------------------|---------------------------------------------------------------|
| `PATCH /crm/leads/{id}/stage`| `crm:leads:*`, `crm:funnel`, all `analytics:*`, `kpi:wall`   |
| `POST /customers`            | `customers:list:*`, `customers:stats`                         |
| `PATCH /customers/{id}`      | `customers:list:*`, `customers:stats`, `customers:detail:{id}`|
| `POST /customers/{id}/history`| `customers:list:*`, `customers:stats`, `customers:detail:{id}`|

Pattern-based deletion (`cache_delete_pattern`) uses Redis `SCAN` to avoid
blocking the server on large key sets.

---

## 3. Cache Warming (`app/tasks/cache_warmer.py`)

A Celery Beat task runs every 5 minutes and pre-loads the four most expensive
cache keys:

- `analytics:dashboard` — full BI dashboard
- `analytics:monthly` — 12-month lead volume
- `kpi:wall` — KPI wall aggregate
- `crm:leads:<md5>` — top 100 leads (default page)

This eliminates cold-start latency: even after a TTL expiry, the next request
hits a warm cache rather than the database.

The task is registered in `app/celery_app.py` under the key
`warm-cache-every-5m`.

---

## 4. Adding Caching to a New Endpoint

### Simple (fixed key)

```python
from ..core.cache import cache_get, cache_set, ANALYTICS_TTL

@router.get("/my-endpoint")
async def my_endpoint(db: Session = Depends(get_db)):
    cached = cache_get("my:key")
    if cached is not None:
        return cached
    result = expensive_db_query(db)
    cache_set("my:key", result, ANALYTICS_TTL)
    return result
```

### Parameterised key

```python
import hashlib, json
from ..core.cache import cache_get, cache_set, CUSTOMERS_TTL

@router.get("/my-list")
async def my_list(filter_a: str, filter_b: int, db: Session = Depends(get_db)):
    params = json.dumps({"a": filter_a, "b": filter_b}, sort_keys=True)
    key = f"my:list:{hashlib.md5(params.encode()).hexdigest()}"
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = db_query(db, filter_a, filter_b)
    cache_set(key, result, CUSTOMERS_TTL)
    return result
```

### Invalidation on write

```python
from ..core.cache import cache_delete, cache_delete_pattern

@router.post("/my-resource")
async def create_resource(body: MySchema, db: Session = Depends(get_db)):
    obj = create_in_db(db, body)
    cache_delete("my:stats")
    cache_delete_pattern("my:list:*")
    return obj
```

---

## 5. Database Connection Pool (`app/database.py`)

| Parameter      | Before | After | Env var            |
|----------------|--------|-------|--------------------|
| `pool_size`    | 10     | 20    | `DB_POOL_SIZE`     |
| `max_overflow` | 20     | 40    | `DB_MAX_OVERFLOW`  |
| `pool_recycle` | 1800 s | 1800 s| `DB_POOL_RECYCLE`  |
| `pool_timeout` | 30 s   | 30 s  | `DB_POOL_TIMEOUT`  |
| `pool_pre_ping`| ✓      | ✓     | —                  |

**pool_size = 20** — keeps 20 connections open at all times, eliminating
connection establishment overhead for concurrent requests.

**max_overflow = 40** — allows up to 60 total connections during traffic
spikes (20 steady-state + 40 overflow), enough to handle 10× growth without
exhausting the pool.

**pool_pre_ping = True** — verifies each connection with `SELECT 1` before
use, preventing errors from stale connections after PostgreSQL's idle timeout.

---

## 6. Response Compression (`app/main.py`)

GZip middleware compresses all responses larger than 500 bytes:

```python
app.add_middleware(GZipMiddleware, minimum_size=500)
```

- Covers JSON, HTML, CSS, and JS responses automatically.
- Binary formats (images, PDFs) are already compressed and are not re-compressed.
- Expected 60–80 % reduction in JSON payload size for list endpoints.

---

## 7. Rate Limiting (`app/core/limiter.py`)

Per-endpoint limits tuned to endpoint cost:

| Limit constant   | Value       | Applied to                                    |
|------------------|-------------|-----------------------------------------------|
| `PUBLIC_LIMIT`   | 10/min/IP   | Quote, contact, estimate (public-facing)       |
| `ANALYTICS_LIMIT`| 30/min/IP   | Dashboard, KPI wall, revenue forecast          |
| `CRM_LIMIT`      | 60/min/IP   | CRM leads, funnel, customers, analytics funnel |
| `HEALTH_LIMIT`   | 300/min/IP  | Health checks, metrics endpoints               |
| `ADMIN_LIMIT`    | 100/min/IP  | Admin dashboard operations                     |

---

## 8. Monitoring (`GET /api/v1/metrics/cache`)

The `/api/v1/metrics/cache` endpoint returns per-process cache statistics:

```json
{
  "hits": 1420,
  "misses": 180,
  "errors": 0,
  "total_requests": 1600,
  "hit_ratio_pct": 88.75,
  "note": "Counters are per-process and reset on worker restart."
}
```

**Healthy targets:**
- `hit_ratio_pct` ≥ 70 % — cache is working effectively.
- `hit_ratio_pct` < 30 % — TTLs may be too short or the cache warmer is not
  running. Check Celery Beat with `GET /api/v1/metrics/celery`.

Redis memory and keyspace stats are available at `/api/v1/metrics/redis`.

---

## 9. Performance Benchmarks (Expected)

| Metric                        | Before  | After (expected) |
|-------------------------------|---------|------------------|
| DB queries per 100 requests   | ~400    | ~120 (70 % ↓)    |
| Avg response time (cached)    | 180 ms  | 8 ms (96 % ↓)    |
| Avg response time (uncached)  | 180 ms  | 160 ms (11 % ↓)  |
| JSON payload size (list)      | 48 KB   | 9 KB (81 % ↓)    |
| Max concurrent requests       | ~30     | ~100 (3× ↑)      |

Benchmark with Apache Bench:

```bash
# Baseline (no cache)
ab -n 500 -c 20 -H "Authorization: Bearer $TOKEN" \
  https://your-api.railway.app/api/v1/analytics/dashboard

# After warm-up (cache populated)
ab -n 500 -c 20 -H "Authorization: Bearer $TOKEN" \
  https://your-api.railway.app/api/v1/analytics/dashboard
```

Or with k6:

```js
import http from 'k6/http';
export const options = { vus: 20, duration: '30s' };
export default function () {
  http.get('https://your-api.railway.app/api/v1/kpi-wall', {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });
}
```

---

## 10. Post-Deploy Checklist

1. **Redeploy** — Railway auto-deploys on merge.
2. **Verify Redis** — `GET /api/v1/metrics/redis` should return `"status": "ok"`.
3. **Verify Celery Beat** — `GET /api/v1/metrics/celery` should show ≥ 1 active worker.
4. **Check cache hit ratio** — `GET /api/v1/metrics/cache` after 5 minutes should
   show `hit_ratio_pct` ≥ 50 %.
5. **Monitor Sentry** — watch for `redis.exceptions.ConnectionError` or
   `sqlalchemy.exc.TimeoutError` in the first 30 minutes.
6. **Run benchmark** — compare p95 latency before and after using Apache Bench
   or k6 (see §9 above).
