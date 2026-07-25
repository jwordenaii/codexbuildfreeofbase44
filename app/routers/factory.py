"""
factory.py — Public SaaS tenant self-provisioning for the JWordenAI white-label
platform (thewordenstandard.com's SaaSPlatformPortal signup form).

Routes:
  POST /api/v1/factory/saas/provision  — public signup, creates a Tenant row

Unlike /api/v1/tenants (master-key gated, for admin tenant management), this
endpoint is intentionally public — it's the backend for a self-serve signup
form — but it's rate-limited and only writes a narrow, safe field set.
"""

import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..database import get_db
from ..services.tenant_service import get_tenant, create_tenant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/factory", tags=["factory"])

VALID_TIERS = {"starter", "pro", "enterprise"}
TIER_MONTHLY_USD = {"starter": 299, "pro": 599, "enterprise": 1299}


class SaasProvisionRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=200)
    contact_email: EmailStr
    contact_phone: str = Field("", max_length=30)
    subdomain_slug: str = Field(..., min_length=2, max_length=63)
    subscription_tier: str = Field("pro")


def _slugify(raw: str) -> str:
    slug = re.sub(r"[^a-z0-9-]+", "-", raw.strip().lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug[:63]


@router.post("/saas/provision", summary="Self-serve SaaS tenant signup")
@limiter.limit("5/minute")
async def provision_saas_tenant(
    request: Request,
    body: SaasProvisionRequest,
    db: Session = Depends(get_db),
):
    tier = body.subscription_tier.strip().lower()
    if tier not in VALID_TIERS:
        raise HTTPException(status_code=400, detail=f"subscription_tier must be one of {sorted(VALID_TIERS)}")

    slug = _slugify(body.subdomain_slug)
    if not slug:
        raise HTTPException(status_code=400, detail="subdomain_slug must contain at least one letter or number")

    try:
        existing = get_tenant(slug, db)
        if existing:
            # Slug collision — append a short suffix instead of failing the
            # signup outright, since the slug is user-chosen and collisions
            # are expected once there are enough tenants.
            slug = f"{slug}-{uuid.uuid4().hex[:5]}"

        tenant = create_tenant(
            {
                "tenant_id": slug,
                "company_name": body.company_name.strip(),
                "contact_email": str(body.contact_email),
                "contact_phone": body.contact_phone.strip(),
                "subscription_tier": tier,
            },
            db,
        )
        logger.info("SaaS tenant provisioned: %s (%s tier)", tenant.tenant_id, tier)

        return {
            "status": "provisioned",
            "tenant_id": tenant.tenant_id,
            "company_name": tenant.company_name,
            "subscription_tier": tenant.subscription_tier,
            "monthly_price_usd": TIER_MONTHLY_USD[tier],
            "portal_url": f"https://{tenant.tenant_id}.thewordenstandard.com",
            "next_step": "billing_not_yet_wired",
        }
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("SaaS provisioning failed: %s", exc)
        raise HTTPException(status_code=500, detail="Provisioning failed. Please try again.") from exc
