# ── JWordenAI — Multi-stage Dockerfile ───────────────────────────────────────
#
# Stage 1 (builder): install Python dependencies into a virtual environment.
# Stage 2 (runtime): copy only the venv into a slim image.
#
# Build & run locally:
#   docker build -t jwordenai-api .
#   docker run -p 8000:8000 --env-file .env jwordenai-api
#
# Google Cloud Run deployment:
#   gcloud builds submit --tag gcr.io/PROJECT_ID/jwordenai-api
#   gcloud run deploy jwordenai-api \
#     --image gcr.io/PROJECT_ID/jwordenai-api \
#     --platform managed --region us-east4 \
#     --allow-unauthenticated --port 8000 \
#     --set-env-vars DATABASE_URL=postgresql://...

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# System deps required to compile psycopg2 (if psycopg2-binary is used,
# these are not strictly needed — kept for parity with psycopg2 source builds).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create isolated venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Copy only the venv and app source — no build tools in the final image
COPY --from=builder /opt/venv /opt/venv
COPY app/ ./app/

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── Gunicorn + Uvicorn workers ────────────────────────────────────────────────
# 2 Gunicorn workers × 1 Uvicorn worker class = 2 async worker processes.
# Scale workers via the WEB_CONCURRENCY env var (Cloud Run sets this automatically).
ENV WEB_CONCURRENCY=2

EXPOSE 8000

USER appuser

CMD ["sh", "-c", "gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers ${WEB_CONCURRENCY:-2} \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -"]
