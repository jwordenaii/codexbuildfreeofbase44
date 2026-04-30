# Full-Text Search — Elasticsearch Integration

JWordenAI uses **Elasticsearch 8.x** to power fast, relevant full-text search
across blog posts and CMS content blocks.  The integration is designed for
graceful degradation: the API continues to function normally when Elasticsearch
is unavailable, returning empty search results instead of errors.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Elasticsearch Setup — Local](#elasticsearch-setup--local)
3. [Elasticsearch Setup — Railway](#elasticsearch-setup--railway)
4. [Environment Variables](#environment-variables)
5. [Index Strategy](#index-strategy)
6. [Search Query Syntax](#search-query-syntax)
7. [API Endpoints](#api-endpoints)
8. [Indexing Strategy](#indexing-strategy)
9. [Testing Instructions](#testing-instructions)
10. [Graceful Degradation](#graceful-degradation)

---

## Architecture

```
FastAPI backend
    │
    ├── app/services/search_service.py   ← ES client wrapper (singleton)
    │       ├── index_blog_post()
    │       ├── index_content_block()
    │       ├── search()
    │       ├── delete_index()
    │       └── health()
    │
    ├── app/routers/search.py            ← HTTP endpoints
    │       ├── GET  /api/v1/search
    │       ├── POST /api/v1/search/reindex
    │       └── GET  /api/v1/search/status
    │
    └── app/routers/blog.py              ← Auto-indexes on create/update/publish/delete
```

**Indexes:**

| Index name               | Content                          |
|--------------------------|----------------------------------|
| `jworden_blog_posts`     | Blog posts (title, body, tags…)  |
| `jworden_content_blocks` | CMS page content blocks          |

---

## Elasticsearch Setup — Local

### Option A: Docker (recommended)

```bash
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.13.0
```

Verify it's running:

```bash
curl http://localhost:9200
# → {"name":"...","cluster_name":"docker-cluster","version":{"number":"8.13.0",...}}
```

### Option B: Homebrew (macOS)

```bash
brew tap elastic/tap
brew install elastic/tap/elasticsearch-full
brew services start elastic/tap/elasticsearch-full
```

### Option C: Download

Download from https://www.elastic.co/downloads/elasticsearch and follow the
platform-specific instructions.

---

## Elasticsearch Setup — Railway

1. In your Railway project, click **+ New** → **Database** → **Elasticsearch**
   (or deploy the official Elasticsearch template).

2. Railway will provision an Elasticsearch instance and expose these variables:

   ```
   ELASTICSEARCH_HOST
   ELASTICSEARCH_PORT
   ELASTICSEARCH_USER      (if auth is enabled)
   ELASTICSEARCH_PASSWORD  (if auth is enabled)
   ```

3. Copy those variables into your FastAPI service's environment (Railway
   dashboard → your service → Variables tab).

4. Redeploy the FastAPI service.  On startup you will see:

   ```
   Elasticsearch connected: host=<host> status=green nodes=1
   ```

---

## Environment Variables

| Variable               | Default     | Description                              |
|------------------------|-------------|------------------------------------------|
| `ELASTICSEARCH_HOST`   | `localhost` | Elasticsearch hostname                   |
| `ELASTICSEARCH_PORT`   | `9200`      | Elasticsearch port                       |
| `ELASTICSEARCH_USER`   | _(empty)_   | Basic-auth username (optional)           |
| `ELASTICSEARCH_PASSWORD` | _(empty)_ | Basic-auth password (optional)           |

All variables are **optional**.  When `ELASTICSEARCH_HOST` is not set, the
service defaults to `localhost:9200`.  If ES is unreachable, search endpoints
return empty results rather than errors.

---

## Index Strategy

### Blog Posts (`jworden_blog_posts`)

Each document represents one `BlogPost` row.  Document ID: `blog_{post.id}`.

| Field              | ES type   | Boost | Notes                              |
|--------------------|-----------|-------|------------------------------------|
| `title`            | text      | 3×    | English analyzer, highest weight   |
| `excerpt`          | text      | 2×    | English analyzer                   |
| `body`             | text      | 1×    | Full article body                  |
| `tags`             | text      | 1×    | Comma-separated tag string         |
| `focus_keyword`    | keyword   | 2×    | Exact keyword match                |
| `category`        | keyword   | —     | Used for filtering                 |
| `status`           | keyword   | —     | "draft" \| "published" \| "archived" |
| `slug`             | keyword   | —     | URL slug                           |
| `published_at`     | date      | —     | ISO 8601                           |

### Content Blocks (`jworden_content_blocks`)

Each document represents one `PageContent` row.  Document ID: `content_{block.id}`.

| Field       | ES type | Boost | Notes                    |
|-------------|---------|-------|--------------------------|
| `title`     | text    | 3×    | English analyzer         |
| `body`      | text    | 1×    | HTML/Markdown body       |
| `key`       | keyword | —     | CMS block key (e.g. "hero") |
| `updated_at`| date    | —     | ISO 8601                 |

### Analyzer

Both indexes use the built-in **`english`** analyzer, which applies:
- Lowercase tokenisation
- English stop-word removal ("the", "a", "is"…)
- Porter stemming ("paving" → "pave", "asphalt" → "asphalt")

---

## Search Query Syntax

The search endpoint uses Elasticsearch's `multi_match` query with:
- **`best_fields`** type — scores by the best-matching field
- **`fuzziness: AUTO`** — tolerates 1–2 character typos automatically
- **`minimum_should_match: 75%`** — at least 75% of query terms must match

### Examples

```
# Simple keyword search
GET /api/v1/search?q=asphalt+driveway

# Search only blog posts
GET /api/v1/search?q=pothole+repair&type=blog

# Search with category filter
GET /api/v1/search?q=sealcoating&type=blog&category=maintenance

# Search content blocks only
GET /api/v1/search?q=free+estimate&type=content

# Paginate results
GET /api/v1/search?q=paving&size=10&page=2
```

### Response shape

```json
{
  "query": "asphalt driveway",
  "type": "all",
  "total": 12,
  "page": 1,
  "size": 20,
  "hits": [
    {
      "_id": "blog_42",
      "_index": "jworden_blog_posts",
      "_score": 4.87,
      "_source": {
        "doc_type": "blog_post",
        "slug": "asphalt-driveway-guide",
        "title": "Complete Asphalt Driveway Guide",
        "excerpt": "Everything you need to know...",
        "category": "driveways",
        "status": "published"
      },
      "highlights": {
        "title": ["Complete <mark>Asphalt</mark> <mark>Driveway</mark> Guide"],
        "body": ["...your <mark>asphalt driveway</mark> needs sealcoating..."]
      }
    }
  ],
  "es_available": true
}
```

---

## API Endpoints

### `GET /api/v1/search`

Full-text search.  **Public** — no authentication required.

| Parameter  | Type    | Default      | Description                              |
|------------|---------|--------------|------------------------------------------|
| `q`        | string  | _(required)_ | Search query (1–500 chars)               |
| `type`     | string  | `"all"`      | `"blog"` \| `"content"` \| `"all"`      |
| `category` | string  | _(none)_     | Filter blog posts by category            |
| `status`   | string  | `"published"`| Filter blog posts by status              |
| `size`     | integer | `20`         | Results per page (max 100)               |
| `page`     | integer | `1`          | Page number (1-based)                    |

Rate limit: **60 requests/minute**.

---

### `POST /api/v1/search/reindex`

Rebuild all Elasticsearch indexes from the database.  **Admin only** — requires
a valid bearer token (`Authorization: Bearer <token>`).

```bash
curl -X POST https://your-api.railway.app/api/v1/search/reindex \
  -H "Authorization: Bearer $JWORDEN_MASTER_KEY"
```

Response:

```json
{
  "status": "complete",
  "total_indexed": 47,
  "total_failed": 0,
  "blog_posts": { "total": 40, "indexed": 40, "failed": 0 },
  "content_blocks": { "total": 7, "indexed": 7, "failed": 0 }
}
```

Returns **503** if Elasticsearch is unavailable.

Rate limit: **5 requests/minute**.

---

### `GET /api/v1/search/status`

Elasticsearch cluster health.  **Public** — no authentication required.

```bash
curl https://your-api.railway.app/api/v1/search/status
```

Response (ES available):

```json
{
  "elasticsearch": {
    "ok": true,
    "status": "green",
    "cluster_name": "docker-cluster",
    "number_of_nodes": 1,
    "latency_ms": 3.2,
    "host": "localhost:9200"
  },
  "search_available": true
}
```

Response (ES unavailable):

```json
{
  "elasticsearch": {
    "ok": false,
    "status": "unreachable",
    "error": "Connection refused",
    "host": "localhost:9200"
  },
  "search_available": false
}
```

Always returns **HTTP 200** — check `search_available` in the body.

---

## Testing Instructions

### 1. Start Elasticsearch locally

```bash
docker run -d --name es-test -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.13.0
```

### 2. Set environment variables

```bash
export ELASTICSEARCH_HOST=localhost
export ELASTICSEARCH_PORT=9200
```

### 3. Start the FastAPI server

```bash
uvicorn app.main:app --reload
```

You should see in the logs:
```
Elasticsearch connected: host=localhost:9200 status=green nodes=1
```

### 4. Test blog post indexing

Create a blog post (requires auth):

```bash
curl -X POST http://localhost:8000/api/v1/blog \
  -H "Authorization: Bearer $JWORDEN_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "How to Repair Asphalt Potholes",
    "excerpt": "Potholes are a common problem for asphalt driveways.",
    "body": "Asphalt potholes form when water seeps into cracks...",
    "category": "maintenance",
    "tags": "pothole, repair, asphalt",
    "status": "published"
  }'
```

### 5. Test search query

```bash
curl "http://localhost:8000/api/v1/search?q=pothole+repair"
```

Expected: the blog post appears in `hits` with highlighted matches.

### 6. Test type filter

```bash
# Blog posts only
curl "http://localhost:8000/api/v1/search?q=asphalt&type=blog"

# Content blocks only
curl "http://localhost:8000/api/v1/search?q=estimate&type=content"
```

### 7. Test category filter

```bash
curl "http://localhost:8000/api/v1/search?q=repair&type=blog&category=maintenance"
```

### 8. Test reindex endpoint

```bash
curl -X POST http://localhost:8000/api/v1/search/reindex \
  -H "Authorization: Bearer $JWORDEN_MASTER_KEY"
```

### 9. Test with ES unavailable (graceful degradation)

Stop Elasticsearch:

```bash
docker stop es-test
```

Then run a search:

```bash
curl "http://localhost:8000/api/v1/search?q=asphalt"
```

Expected response (HTTP 200, empty results — no error):

```json
{
  "query": "asphalt",
  "type": "all",
  "total": 0,
  "page": 1,
  "size": 20,
  "hits": [],
  "es_available": true
}
```

The API returns HTTP 200 with an empty result set.  All other endpoints
continue to work normally.

### 10. Test health status

```bash
curl http://localhost:8000/api/v1/search/status
curl http://localhost:8000/health/ready
```

The `/health/ready` response now includes an `elasticsearch` key in `checks`.
ES being down does **not** cause `/health/ready` to return 503 — only Redis
and the database are required for readiness.

---

## Graceful Degradation

The search service is designed to never crash the application:

| Scenario                          | Behaviour                                      |
|-----------------------------------|------------------------------------------------|
| ES not installed                  | Warning logged at startup; search returns `[]` |
| ES unreachable                    | Warning logged; search returns `[]`            |
| ES times out during search        | Retried up to 3× then returns `[]`             |
| ES down during blog post creation | Post saved to DB; indexing skipped with warning|
| ES down during reindex            | Returns HTTP 503 with clear error message      |

The `ELASTICSEARCH_HOST` environment variable is **optional**.  Deployments
without it will run in degraded-search mode with no other impact.
