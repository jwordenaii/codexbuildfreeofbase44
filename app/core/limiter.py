"""
Shared SlowAPI rate limiter instance and per-endpoint limit constants.

Import this in app/main.py to attach to the FastAPI app state, and
in individual routers to apply per-endpoint limits via @limiter.limit().

Per-endpoint rate limit strategy (requests per minute per IP):
  PUBLIC_LIMIT     = "10/minute"   — quote, contact, estimate (public-facing)
  ANALYTICS_LIMIT  = "30/minute"   — expensive BI aggregations
  CRM_LIMIT        = "60/minute"   — moderate-cost CRM reads/writes
  HEALTH_LIMIT     = "300/minute"  — health/metrics probes
  ADMIN_LIMIT      = "100/minute"  — admin dashboard operations
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── Per-endpoint limit strings (use with @limiter.limit()) ────────────────────

PUBLIC_LIMIT: str = "10/minute"
ANALYTICS_LIMIT: str = "30/minute"
CRM_LIMIT: str = "60/minute"
HEALTH_LIMIT: str = "300/minute"
ADMIN_LIMIT: str = "100/minute"
