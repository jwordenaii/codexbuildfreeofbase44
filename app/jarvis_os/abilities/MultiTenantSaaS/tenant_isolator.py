"""
tenant_isolator — NOT IMPLEMENTED. Do not treat as a security control.

This module previously presented itself as a working multi-tenant isolation
engine. It was not one. The original implementation:

  - never queried the database, or anything else
  - invented a tenant id and a random `DB_ROW_<n>` resource id
  - set `resource_owner = requesting_tenant` 90% of the time, so the two
    SHA-256 "cryptographic tokens" it compared matched by construction
  - rolled `random.random() < 0.1` and, on that roll, emitted
    "CRITICAL SECURITY BREACH PREVENTED: Cross-tenant data bleed blocked."

So it reported blocking a breach roughly one call in ten regardless of what
was actually happening, and reported "Row-level security validated" the rest
of the time — while enforcing nothing. Any dashboard surfacing its output was
showing a random number generator styled as a security audit.

It is reachable through POST /api/v1/abilities/execute, so it could be called
by anything that reaches the API.

The body now refuses to run rather than returning reassuring output. That is
deliberate: a loud NOT_IMPLEMENTED is safe, a comforting lie is not.

Implementing this for real means enforcing tenant scoping where the data is
actually read — row-level security in Postgres, or a mandatory tenant filter
in the query layer — not a standalone "engine" that inspects nothing. Until
that exists, isolation should be assumed UNVERIFIED.
"""
import logging

logger = logging.getLogger(__name__)

_REASON = (
    "tenant_isolator is not implemented. The previous version returned randomised "
    "pass/fail results without querying any data, so its output was meaningless. "
    "Tenant isolation must be enforced at the data-access layer (Postgres RLS or a "
    "mandatory tenant filter), not by calling this module. Treat tenant isolation as "
    "UNVERIFIED until that is in place."
)


class TenantIsolatorNotImplementedError(NotImplementedError):
    """Raised to make an unimplemented security control impossible to ignore."""


class TenantIsolatorEngine:
    """Placeholder for a real tenant-isolation check. Intentionally non-functional."""

    def __init__(self):
        self.module_id = "tenant_isolator"
        self.implemented = False

    def execute(self, params: dict = None) -> dict:
        logger.error("[SECURITY] %s", _REASON)
        return {
            "status": "NOT_IMPLEMENTED",
            "engine": "TenantIsolatorEngine",
            "implemented": False,
            "ok": False,
            "error": _REASON,
            "assessment": (
                "/// TENANT ISOLATION: NOT IMPLEMENTED ///\n"
                "-> This module performs no check of any kind.\n"
                "-> Do not present this result as a security status.\n"
                "-> Tenant isolation is UNVERIFIED."
            ),
        }
