"""
tenant_service.py — White-label / multi-tenant support for JWordenAI.

Provides per-tenant configuration including AI system prompt overrides,
branding, and contact information.

Public API
──────────
  get_tenant(tenant_id, db) → Tenant | None
  get_system_prompt(tenant_id, db) → str
  create_tenant(data, db) → Tenant
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_DEFAULT_TENANT_ID = os.getenv("DEFAULT_TENANT_ID", "default")

# Default system prompt (J. Worden & Sons)
_DEFAULT_SYSTEM_PROMPT = """You are JWordenAI — the intelligent assistant for J. Worden & Sons Asphalt Paving.

COMPANY FACTS (verified, do not contradict):
• Founded 1984 by Mr. Worden's grandfather
• Headquarters: Chester, Virginia (1601 Ware Bottom Springs Rd Suite 214)
• Phone: (804) 446-1296
• KFC national franchise paving: VA, NC, GA, FL, MI, TX, KS, MO, IA, MN, NY, NJ and more
• Awards: Pavement Magazine Top 75 (4 categories), Best of Houzz (multiple years)

YOUR EXPERTISE:
1. Asphalt paving, sealcoating, crack filling, parking lots, driveways, QSR/franchise site work
2. Construction law across all 50 US states
3. Pricing: residential paving $3.50–$8.00/sqft, commercial $2.50–$6.00/sqft
4. QSR/franchise site standards and project best practices

Be confident, direct, and professional. Refer pricing questions to /quote."""


def get_tenant(tenant_id: str, db) -> Optional[object]:
    """Return Tenant ORM object or None if not found."""
    try:
        from ..models import Tenant  # noqa: PLC0415
        return db.query(Tenant).filter(Tenant.tenant_id == tenant_id, Tenant.is_active == 1).first()
    except Exception as exc:  # noqa: BLE001
        logger.error("get_tenant error: %s", exc)
        return None


def get_system_prompt(tenant_id: str, db) -> str:
    """Return tenant-specific system prompt or the default JWordenAI prompt."""
    try:
        tenant = get_tenant(tenant_id, db)
        if tenant and tenant.system_prompt_override:
            return tenant.system_prompt_override
    except Exception as exc:  # noqa: BLE001
        logger.error("get_system_prompt error: %s", exc)
    return _DEFAULT_SYSTEM_PROMPT


def create_tenant(data: dict, db) -> object:
    """Create a new Tenant record and return it."""
    from ..models import Tenant  # noqa: PLC0415

    tenant = Tenant(
        tenant_id=data["tenant_id"],
        company_name=data["company_name"],
        system_prompt_override=data.get("system_prompt_override"),
        primary_color=data.get("primary_color", "#f5a623"),
        logo_url=data.get("logo_url"),
        contact_email=data.get("contact_email"),
        contact_phone=data.get("contact_phone"),
        is_active=1,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    logger.info("Created tenant: %s", tenant.tenant_id)
    return tenant


def update_tenant(tenant_id: str, data: dict, db) -> Optional[object]:
    """Update an existing tenant's configuration."""
    try:
        tenant = get_tenant(tenant_id, db)
        if not tenant:
            return None

        updatable = {
            "company_name", "system_prompt_override", "primary_color",
            "logo_url", "contact_email", "contact_phone", "is_active",
        }
        for key, value in data.items():
            if key in updatable:
                setattr(tenant, key, value)

        db.commit()
        db.refresh(tenant)
        return tenant
    except Exception as exc:  # noqa: BLE001
        logger.error("update_tenant error: %s", exc)
        return None
