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

import os as _os
import sys as _sys

# Disable rate limiting under pytest or when explicitly turned off so test
# suites don't hit per-IP caps when looping requests.
_RATE_LIMIT_DISABLED = (
    "pytest" in _sys.modules
    or _os.getenv("PYTEST_CURRENT_TEST") is not None
    or _os.getenv("RATE_LIMIT_DISABLED", "").lower() in ("1", "true", "yes")
)

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[] if _RATE_LIMIT_DISABLED else ["200/minute"],
    enabled=not _RATE_LIMIT_DISABLED,
)

# ── Per-endpoint limit strings (use with @limiter.limit()) ────────────────────

PUBLIC_LIMIT: str = "10/minute"
ANALYTICS_LIMIT: str = "30/minute"
CRM_LIMIT: str = "60/minute"
HEALTH_LIMIT: str = "300/minute"
ADMIN_LIMIT: str = "100/minute"
SCAN_LIMIT: str = "30/minute"     # scan-campaign CRUD/export (admin/premium)
SCAN_RUN_LIMIT: str = "5/minute"  # scan-campaign pipeline run — hits Regrid/Maps/GPT-4o/Lob
