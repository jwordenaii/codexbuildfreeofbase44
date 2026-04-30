# Vector Search (Semantic Blog Search)

Semantic search lets customers find relevant blog posts even when they use
different words than those in the post.  A search for *"driveway repair"*
will surface posts about *"asphalt patching"*, *"pothole filling"*, and
*"resurfacing"* — without any keyword overlap.

This is powered by **OpenAI embeddings** (text-embedding-3-small) stored in
a **Pinecone** vector database.

---

## Architecture

```
Customer query
     │
     ▼
OpenAI text-embedding-3-small  →  1536-dim vector
     │
     ▼
Pinecone cosine similarity search
     │
     ▼
Top-N matching blog post metadata
     │
     ▼
JSON response to frontend
```

Blog posts are indexed automatically whenever they are created, updated, or
published via the admin API.  A full reindex can be triggered manually via
the admin endpoint or Celery task.

---

## Setup

### 1. Create a Pinecone account and index

1. Sign up at [console.pinecone.io](https://console.pinecone.io)
2. Create a new **index** with these settings:
   - **Dimensions**: `1536`
   - **Metric**: `cosine`
   - **Name**: choose a name (e.g. `blog-posts`)
3. Copy your **API key** from the Pinecone console

### 2. Add environment variables to Railway

In your Railway service, add the following environment variables:

| Variable             | Value                                      |
|----------------------|--------------------------------------------|
| `PINECONE_API_KEY`   | Your Pinecone API key                      |
| `PINECONE_INDEX_NAME`| The index name you created (e.g. `blog-posts`) |
| `OPENAI_API_KEY`     | Your OpenAI API key (already set for AI features) |

### 3. Reindex all existing posts

After adding the environment variables, trigger a full reindex to populate
the vector index with all existing blog posts:

```bash
# Via the admin API (requires bearer token):
curl -X POST https://your-api.railway.app/api/v1/admin/search/vector-reindex \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The reindex runs as a background Celery task and may take a few minutes for
large blogs.  Check progress with the status endpoint (see below).

---

## API Endpoints

### Public: Semantic Search

```
GET /api/v1/search/semantic?q=<query>&limit=<n>
```

No authentication required.

**Query parameters:**

| Parameter | Type    | Default | Description                          |
|-----------|---------|---------|--------------------------------------|
| `q`       | string  | —       | Search query (required, 2–500 chars) |
| `limit`   | integer | `10`    | Max results to return (1–50)         |

**Example request:**

```bash
curl "https://your-api.railway.app/api/v1/search/semantic?q=sealcoating+benefits&limit=5"
```

**Example response:**

```json
{
  "query": "sealcoating benefits",
  "limit": 5,
  "count": 3,
  "results": [
    {
      "post_id": 12,
      "title": "Why Sealcoating Extends Your Driveway's Life",
      "excerpt": "Sealcoating is one of the most cost-effective ways to protect your asphalt...",
      "slug": "why-sealcoating-extends-your-driveways-life",
      "category": "maintenance",
      "tags": "sealcoating,driveway,protection",
      "score": 0.9312
    },
    {
      "post_id": 7,
      "title": "Asphalt Maintenance: A Complete Guide",
      "excerpt": "Regular maintenance keeps your pavement looking great and lasting longer...",
      "slug": "asphalt-maintenance-complete-guide",
      "category": "maintenance",
      "tags": "maintenance,asphalt,tips",
      "score": 0.8741
    }
  ]
}
```

Results are ordered by descending similarity score (0–1).  Only published
posts are returned.

---

### Admin: Check Index Status

```
GET /api/v1/admin/search/vector-status
Authorization: Bearer <token>
```

**Example response:**

```json
{
  "vector_index": {
    "configured": true,
    "index_name": "blog-posts",
    "total_vector_count": 47,
    "dimension": 1536,
    "namespaces": {}
  }
}
```

If Pinecone is not configured:

```json
{
  "vector_index": {
    "configured": false,
    "reason": "PINECONE_API_KEY is not set"
  }
}
```

---

### Admin: Trigger Full Reindex

```
POST /api/v1/admin/search/vector-reindex
Authorization: Bearer <token>
```

Dispatches a Celery background task to reindex all blog posts.  Returns
immediately with a task ID.

**Example response (Celery available):**

```json
{
  "status": "queued",
  "task_id": "a3f2c1d4-...",
  "message": "Reindex task dispatched. Check /api/v1/admin/search/vector-status for progress."
}
```

**Example response (Celery not available — synchronous fallback):**

```json
{
  "status": "completed",
  "task_id": null,
  "message": "Reindex completed synchronously (Celery not available).",
  "result": {
    "total": 47,
    "indexed": 47,
    "failed": 0
  }
}
```

---

## Automatic Indexing

Blog posts are automatically indexed in Pinecone whenever:

| Action                          | Endpoint                          |
|---------------------------------|-----------------------------------|
| Post created (manual)           | `POST /api/v1/blog`               |
| Post created (AI draft)         | `POST /api/v1/blog/draft`         |
| Post updated                    | `PUT /api/v1/blog/{slug}`         |
| Draft published                 | `POST /api/v1/blog/{slug}/publish`|
| Post deleted                    | `DELETE /api/v1/blog/{slug}`      |

Indexing failures are logged as warnings but do not cause the blog CRUD
operation to fail.  The API will continue to work even if Pinecone is
temporarily unavailable.

---

## Reindexing Procedure

Use the reindex endpoint when:

- **First deployment** — after adding Pinecone credentials to Railway
- **Bulk import** — after importing many posts at once
- **Model change** — if you switch to a different embedding model
- **Index corruption** — if search results seem wrong or stale

```bash
# 1. Trigger reindex
curl -X POST https://your-api.railway.app/api/v1/admin/search/vector-reindex \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Wait ~1 minute per 50 posts, then check status
curl https://your-api.railway.app/api/v1/admin/search/vector-status \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Verify total_vector_count matches your post count
```

---

## Troubleshooting

### "PINECONE_API_KEY is not set"

Add `PINECONE_API_KEY` to your Railway environment variables and redeploy.

### "PINECONE_INDEX_NAME is not set"

Add `PINECONE_INDEX_NAME` to your Railway environment variables.  The value
must match the index name you created in the Pinecone console exactly.

### Search returns 0 results

1. Check that the index has vectors: `GET /api/v1/admin/search/vector-status`
2. If `total_vector_count` is 0, run a reindex: `POST /api/v1/admin/search/vector-reindex`
3. Verify `OPENAI_API_KEY` is set (required for generating query embeddings)

### Search results seem irrelevant

- The index may be stale — run a full reindex
- Try a more specific query (longer phrases work better than single words)
- Verify the index was created with `metric=cosine` and `dimension=1536`

### Reindex task never completes

- Check Celery worker logs: `celery -A app.celery_app worker --loglevel=info`
- Verify `REDIS_URL` is set (required for Celery task queue)
- For very large blogs (500+ posts), the task may hit the 30-minute time limit;
  contact support to increase `time_limit` in `app/tasks/vector_tasks.py`

### IndexError / dimension mismatch

The Pinecone index must be created with `dimension=1536` to match the
`text-embedding-3-small` model.  If you created the index with a different
dimension, delete it and create a new one with the correct settings.

---

## Embedding Model

| Property       | Value                      |
|----------------|----------------------------|
| Model          | `text-embedding-3-small`   |
| Dimensions     | 1536                       |
| Max input      | 8191 tokens (~6000 words)  |
| Pinecone metric| cosine                     |

Blog post body text is truncated to 4000 characters before embedding to
stay well within the token limit while capturing the most relevant content.

---

## Cost Estimate

OpenAI charges per token for embeddings.  At typical blog post lengths
(~800 words ≈ ~1000 tokens):

| Posts | Tokens    | Cost (approx.)  |
|-------|-----------|-----------------|
| 50    | 50,000    | ~$0.01          |
| 500   | 500,000   | ~$0.10          |
| 5,000 | 5,000,000 | ~$1.00          |

Pinecone's free Starter plan supports up to 100,000 vectors — sufficient
for most small-to-medium blogs.

Pricing as of 2024; check [openai.com/pricing](https://openai.com/pricing)
and [pinecone.io/pricing](https://www.pinecone.io/pricing/) for current rates.
