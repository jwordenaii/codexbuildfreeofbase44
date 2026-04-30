# Blog Search Service

Full-text search for blog posts powered by Elasticsearch 8.

---

## Setup

### 1. Environment variable

Set `ELASTICSEARCH_URL` to point at your Elasticsearch instance:

```
ELASTICSEARCH_URL=http://localhost:9200
```

The default is `http://localhost:9200`. On Railway, add this variable to the service environment and point it at your Elasticsearch service's internal URL (e.g. `http://elasticsearch.railway.internal:9200`).

### 2. Install dependencies

```bash
pip install elasticsearch==8.13.0
```

This is already included in `requirements.txt`.

### 3. First-time index build

After deploying, trigger a full reindex to populate the search index with all existing blog posts:

```bash
curl -X POST https://your-api.railway.app/api/v1/admin/search/reindex \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

The index is named `blog_posts` and is created automatically on first use.

---

## Search Endpoint

### `GET /api/v1/search/blog`

Public endpoint — no authentication required.

| Parameter | Type    | Default | Description                        |
|-----------|---------|---------|------------------------------------|
| `q`       | string  | —       | Search query (required, 1–200 chars)|
| `limit`   | integer | `10`    | Max results to return (1–50)       |

**Example request:**

```
GET /api/v1/search/blog?q=sealcoating&limit=5
```

**Example response:**

```json
{
  "query": "sealcoating",
  "limit": 5,
  "total": 3,
  "results": [
    {
      "post_id": 12,
      "slug": "how-often-should-you-sealcoat-your-driveway",
      "title": "How Often Should You Sealcoat Your Driveway?",
      "excerpt": "Sealcoating protects your asphalt from UV damage, water, and oil...",
      "category": "maintenance",
      "published_at": "2024-03-15T00:00:00+00:00",
      "score": 8.4321,
      "highlight": {
        "title": ["How Often Should You <mark>Sealcoat</mark> Your Driveway?"],
        "excerpt": ["<mark>Sealcoating</mark> protects your asphalt from UV damage..."]
      }
    }
  ]
}
```

---

## Search Syntax

### Keyword search

Simple terms are matched across title (3× boost), excerpt (2× boost), body, and tags:

```
GET /api/v1/search/blog?q=asphalt+paving
```

### Phrase search

Wrap terms in quotes to require them to appear together in that order:

```
GET /api/v1/search/blog?q="sealcoating+driveway"
```

### Fuzzy matching

Fuzzy matching is applied automatically. Minor typos (e.g. `sealcoting`) are tolerated. The fuzziness level is `AUTO`, which allows 1 edit for terms of 3–5 characters and 2 edits for longer terms.

### Boolean / multi-term

Multiple terms are scored independently and combined. Posts matching more terms rank higher:

```
GET /api/v1/search/blog?q=asphalt+crack+repair+driveway
```

---

## Admin Endpoints

Both endpoints require a valid bearer token (`Authorization: Bearer <token>`).

### `POST /api/v1/admin/search/reindex`

Rebuild the entire search index from the database. Drops the existing index and re-indexes all published blog posts. Runs as a Celery background task when Celery is available; otherwise runs in a FastAPI background task.

```bash
curl -X POST /api/v1/admin/search/reindex \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:

```json
{
  "status": "queued",
  "message": "Reindex task queued. Check /api/v1/admin/search/status for progress."
}
```

### `GET /api/v1/admin/search/status`

Check the current state of the Elasticsearch index.

```bash
curl /api/v1/admin/search/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response (healthy):

```json
{
  "available": true,
  "doc_count": 23,
  "index_name": "blog_posts",
  "es_url": "http://localhost:9200",
  "status": "green"
}
```

Response (Elasticsearch unreachable):

```json
{
  "available": false,
  "doc_count": 0,
  "index_name": "blog_posts",
  "es_url": "http://localhost:9200",
  "error": "Connection refused"
}
```

---

## Automatic Indexing

Blog posts are indexed automatically when:

| Action                          | Behaviour                                      |
|---------------------------------|------------------------------------------------|
| `POST /api/v1/blog` (published) | Indexed immediately                            |
| `POST /api/v1/blog` (draft)     | Not indexed (drafts are excluded from search)  |
| `POST /api/v1/blog/draft` (auto_publish=true) | Indexed immediately              |
| `PUT /api/v1/blog/{slug}` (published) | Re-indexed with updated content          |
| `PUT /api/v1/blog/{slug}` (draft/archived) | Removed from index                  |
| `POST /api/v1/blog/{slug}/publish` | Indexed when published                      |

---

## Reindexing Procedure

Use this procedure when:
- Elasticsearch was unavailable during post creation/updates
- The index mapping was changed
- Posts were modified directly in the database

1. Call `POST /api/v1/admin/search/reindex` with an admin token.
2. Wait for the background task to complete (typically a few seconds for 23 posts).
3. Verify with `GET /api/v1/admin/search/status` — `doc_count` should match the number of published posts.
4. Test a search: `GET /api/v1/search/blog?q=asphalt`.

---

## Troubleshooting

### Search returns no results

1. Check that Elasticsearch is running: `GET /api/v1/admin/search/status`
2. Verify `ELASTICSEARCH_URL` is set correctly.
3. Run a reindex: `POST /api/v1/admin/search/reindex`
4. Confirm posts have `status = "published"` in the database.

### `available: false` in status response

Elasticsearch is unreachable. The search endpoint will return an empty result set gracefully — it will not crash. Fix the connection and reindex.

### Index mapping errors

If you change the index mapping in `search_service.py`, you must reindex to apply the new mapping. The reindex endpoint drops and recreates the index automatically.

### Celery task not running

If Celery workers are not running, the reindex endpoint falls back to a FastAPI background task. The reindex still completes — it just runs in the web process rather than a worker. For production, ensure Celery workers are running:

```bash
celery -A app.celery_app worker --loglevel=info
```

---

## Index Schema

The `blog_posts` index uses a custom `blog_analyzer` (standard tokenizer + lowercase + stop words + snowball stemming) with the following field mapping:

| Field        | Type    | Boost | Notes                          |
|--------------|---------|-------|--------------------------------|
| `post_id`    | integer | —     | Maps to database primary key   |
| `slug`       | keyword | —     | URL slug (exact match only)    |
| `title`      | text    | 3×    | Highest relevance weight       |
| `excerpt`    | text    | 2×    | Medium relevance weight        |
| `body`       | text    | 1×    | Full article content           |
| `tags`       | text    | 1×    | Comma-separated tag string     |
| `category`   | keyword | —     | Exact match filter             |
| `status`     | keyword | —     | Always filtered to `published` |
| `published_at` | date  | —     | ISO 8601 timestamp             |
