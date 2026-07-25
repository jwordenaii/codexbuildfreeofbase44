"""
factory.py — Public SaaS tenant self-provisioning for the JWordenAI white-label
platform (thewordenstandard.com's SaaSPlatformPortal signup form).

Routes:
  POST /api/v1/factory/saas/provision  — public signup, creates a Tenant row
                                          + a Stripe subscription checkout session

Unlike /api/v1/tenants (master-key gated, for admin tenant management), this
endpoint is intentionally public — it's the backend for a self-serve signup
form — but it's rate-limited and only writes a narrow, safe field set.

Billing follows the same pattern already used by app/routers/payments.py for
lead deposits: STRIPE_SECRET_KEY absent → mock checkout URL so the flow is
still fully testable end-to-end; STRIPE_SECRET_KEY present → real Stripe
Checkout session in subscription mode, priced inline (no pre-created Stripe
Products/Prices required).
"""

import logging
import os
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..database import get_db
from ..services.tenant_service import get_tenant, create_tenant

TENANT_ROOT_DOMAIN = "thewordenstandard.com"

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
    success_url: str | None = None
    cancel_url: str | None = None


def _slugify(raw: str) -> str:
    slug = re.sub(r"[^a-z0-9-]+", "-", raw.strip().lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug[:63]


def _create_subscription_checkout(tenant, tier: str, contact_email: str, success_url: str, cancel_url: str) -> dict:
    """
    Returns {"checkout_url": str, "checkout_session_id": str, "mode": "live"|"mock"}.
    Mirrors payments.create_checkout_session's mock-when-unconfigured pattern.
    """
    stripe_secret = os.getenv("STRIPE_SECRET_KEY", "").strip()
    mock_id = f"mock_sub_{tenant.tenant_id}_{int(datetime.now(timezone.utc).timestamp())}"

    if not stripe_secret:
        return {
            "checkout_url": f"{success_url}&session_id={mock_id}",
            "checkout_session_id": mock_id,
            "mode": "mock",
        }

    try:
        import stripe  # noqa: PLC0415

        stripe.api_key = stripe_secret
        session = stripe.checkout.Session.create(
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            payment_method_types=["card"],
            customer_email=contact_email,
            metadata={"tenant_id": tenant.tenant_id, "subscription_tier": tier},
            subscription_data={"metadata": {"tenant_id": tenant.tenant_id, "subscription_tier": tier}},
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": f"JWordenAI {tier.capitalize()} — {tenant.company_name}"},
                        "unit_amount": TIER_MONTHLY_USD[tier] * 100,
                        "recurring": {"interval": "month"},
                    },
                }
            ],
        )
        return {"checkout_url": session.url, "checkout_session_id": session.id, "mode": "live"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("Stripe subscription checkout failed for tenant %s: %s", tenant.tenant_id, exc)
        raise HTTPException(status_code=502, detail=f"Unable to create checkout session: {exc}") from exc


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

        portal_url = f"https://{tenant.tenant_id}.thewordenstandard.com"
        success_url = body.success_url or f"{portal_url}/welcome?payment=success"
        cancel_url = body.cancel_url or f"{portal_url}/welcome?payment=cancel"

        checkout = _create_subscription_checkout(tenant, tier, str(body.contact_email), success_url, cancel_url)

        tenant.subscription_status = "mock" if checkout["mode"] == "mock" else "pending_payment"
        db.commit()
        db.refresh(tenant)

        logger.info(
            "SaaS tenant provisioned: %s (%s tier, checkout mode=%s)",
            tenant.tenant_id, tier, checkout["mode"],
        )

        return {
            "status": "provisioned",
            "tenant_id": tenant.tenant_id,
            "company_name": tenant.company_name,
            "subscription_tier": tenant.subscription_tier,
            "subscription_status": tenant.subscription_status,
            "monthly_price_usd": TIER_MONTHLY_USD[tier],
            "portal_url": portal_url,
            "checkout_url": checkout["checkout_url"],
            "checkout_session_id": checkout["checkout_session_id"],
            "next_step": "complete_checkout" if checkout["mode"] == "live" else "mock_checkout_no_stripe_key_configured",
        }
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("SaaS provisioning failed: %s", exc)
        raise HTTPException(status_code=500, detail="Provisioning failed. Please try again.") from exc


def _extract_tenant_slug(hostname: str) -> str | None:
    """
    'testpavingco.thewordenstandard.com' -> 'testpavingco'
    'thewordenstandard.com', 'www.thewordenstandard.com', anything else -> None
    """
    host = (hostname or "").strip().lower()
    suffix = f".{TENANT_ROOT_DOMAIN}"
    if not host.endswith(suffix):
        return None
    slug = host[: -len(suffix)]
    if not slug or slug == "www":
        return None
    return slug


@router.get("/resolve", summary="Resolve a hostname to its tenant config (public, unauthenticated)")
@limiter.limit("120/minute")
async def resolve_tenant(request: Request, hostname: str, db: Session = Depends(get_db)):
    """
    Backs TenantContext.jsx's client-side tenant resolution. Only provisioned
    SaaS tenant subdomains (<slug>.thewordenstandard.com) resolve here — every
    other hostname (the main site, the geo-marketing domains, bare
    thewordenstandard.com itself) 404s and the frontend falls back to its
    existing client-side handling for those, unchanged.
    """
    slug = _extract_tenant_slug(hostname)
    if not slug:
        raise HTTPException(status_code=404, detail="No tenant for this hostname")

    tenant = get_tenant(slug, db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "tenant_id": tenant.tenant_id,
        "name": tenant.company_name,
        "label": tenant.company_name,
        "domain": hostname,
        "canonicalUrl": f"https://{hostname}",
        "route_mode": "saas-client",
        "routeMode": "saas-client",
        "subscription_tier": tenant.subscription_tier,
        "subscription_status": tenant.subscription_status,
        "primary_color": tenant.primary_color,
        "logo_url": tenant.logo_url,
        "contact_email": tenant.contact_email,
        "contact_phone": tenant.contact_phone,
    }
