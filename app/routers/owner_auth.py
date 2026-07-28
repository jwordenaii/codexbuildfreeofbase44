"""
owner_auth.py — placeholder router.

app.main imports and mounts this module, but the file was never committed
(the whole backend was added in one commit that referenced it without ever
creating it), which means `from app.main import app` — and therefore every
CI run and any real deployment of this backend — has been failing at import
time. No frontend code calls anything under this router, so this is a
router-less stub to restore a working import; it intentionally adds no
routes rather than guessing at an unverified auth contract.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/owner", tags=["owner-auth"])
