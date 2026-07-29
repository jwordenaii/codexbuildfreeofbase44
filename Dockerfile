FROM python:3.11-slim AS builder

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM builder AS runtime

EXPOSE 8000
# Default runtime entrypoint runs Uvicorn without --reload so it is safe to
# use as a production fallback. docker-compose overrides the command for
# local development to add --reload.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ── Production stage ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS production

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy installed packages and application from builder
COPY --from=builder /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app /app

EXPOSE 8000
# Use the gunicorn config file for binding instead of an exec-form -b flag.
# Exec-form CMD does NOT run a shell, so "${PORT:-8000}" was passed to gunicorn
# as a literal string and never expanded — a latent bind failure. gunicorn.conf.py
# reads the PORT env var itself (bind = f"0.0.0.0:{os.getenv('PORT','8000')}"),
# so this binds correctly whether PORT is set (Fly) or not (local).
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-c", "gunicorn.conf.py", "app.main:app"]
