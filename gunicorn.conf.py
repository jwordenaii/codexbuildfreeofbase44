"""Gunicorn production configuration for the JWordenAI FastAPI backend.

Usage:
    gunicorn app.main:app --config gunicorn.conf.py

Uvicorn worker class bridges Gunicorn's process management with ASGI.
"""

import multiprocessing

# ── Server socket ─────────────────────────────────────────────────────────────
bind = "0.0.0.0:8000"

# ── Workers ───────────────────────────────────────────────────────────────────
# Formula: (2 × CPU count) + 1 is a common starting point for I/O-bound apps.
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
threads = 1

# ── Timeouts ──────────────────────────────────────────────────────────────────
timeout = 120          # seconds before a worker is killed and restarted
graceful_timeout = 30  # seconds to finish in-flight requests on shutdown
keepalive = 5          # seconds to wait for the next request on a keep-alive connection

# ── Restart workers periodically to prevent memory leaks ─────────────────────
max_requests = 1000
max_requests_jitter = 100

# ── Logging ───────────────────────────────────────────────────────────────────
accesslog = "-"   # stdout
errorlog = "-"    # stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# ── Performance ───────────────────────────────────────────────────────────────
preload_app = True   # load app code before forking workers (saves memory via CoW)
