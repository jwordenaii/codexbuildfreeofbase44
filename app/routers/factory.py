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
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..database import get_db
from ..models import Tenant, TenantBillingEvent
from ..routers.admin_integrations import _require_owner
from ..services.tenant_service import get_tenant, create_tenant

TENANT_ROOT_DOMAIN = "thewordenstandard.com"
TRIAL_PERIOD_DAYS = 14

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/factory", tags=["factory"])

VALID_TIERS = {"starter", "pro", "enterprise"}
TIER_MONTHLY_USD = {"starter": 299, "pro": 599, "enterprise": 1299}
TIER_FEATURES = {
    "starter": ["Jarvis AI", "Estimates", "CRM", "Weather", "5 crew"],
    "pro": ["Everything in Starter", "Dispatch", "Crew wearables", "White-label subdomain", "25 crew"],
    "enterprise": ["Everything in Pro", "Custom domain", "Drone/lidar capture", "SLA support", "Unlimited crew"],
}


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
        tenant.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=TRIAL_PERIOD_DAYS)
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


# ── Owner-only admin endpoints — thewordenstandard.com dashboard, not the ─────
# public JWordenAI product surface. Gated behind the same HTTP Basic owner
# auth as admin_integrations.py. Ported from NewRepo's saas_billing.py, which
# had this admin visibility (tenant list + MRR, per-tenant upgrade/cancel,
# platform analytics) but was never deployed anywhere; the live factory.py
# had provisioning and hostname resolution but no way for the owner to see
# who'd signed up or manage them after the fact.


def _tenant_out(t: Tenant) -> dict:
    return {
        "id": t.id,
        "tenant_id": t.tenant_id,
        "company_name": t.company_name,
        "contact_email": t.contact_email,
        "contact_phone": t.contact_phone,
        "subscription_tier": t.subscription_tier,
        "subscription_status": t.subscription_status,
        "monthly_price_usd": TIER_MONTHLY_USD.get(t.subscription_tier, 0),
        "trial_ends_at": t.trial_ends_at.isoformat() if t.trial_ends_at else None,
        "current_period_end": t.current_period_end.isoformat() if t.current_period_end else None,
        "stripe_customer_id": t.stripe_customer_id,
        "custom_domain": t.custom_domain,
        "features": TIER_FEATURES.get(t.subscription_tier, []),
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/saas/tenants", summary="[owner] List provisioned SaaS tenants + MRR")
async def list_saas_tenants(
    subscription_status: str | None = Query(None),
    subscription_tier: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    _: str = Depends(_require_owner),
):
    qs = db.query(Tenant).filter(Tenant.is_active == 1)
    if subscription_status:
        qs = qs.filter(Tenant.subscription_status == subscription_status)
    if subscription_tier:
        qs = qs.filter(Tenant.subscription_tier == subscription_tier)
    tenants = qs.order_by(Tenant.id.desc()).limit(limit).all()
    active_mrr = sum(
        TIER_MONTHLY_USD.get(t.subscription_tier, 0)
        for t in tenants
        if t.subscription_status == "active"
    )
    return {
        "tenants": [_tenant_out(t) for t in tenants],
        "total": len(tenants),
        "active_mrr_usd": active_mrr,
    }


@router.get("/saas/tenants/{tenant_id_str}", summary="[owner] Get one tenant's full billing detail")
async def get_saas_tenant(tenant_id_str: str, db: Session = Depends(get_db), _: str = Depends(_require_owner)):
    tenant = get_tenant(tenant_id_str, db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _tenant_out(tenant)


@router.post("/saas/tenants/{tenant_id_str}/upgrade", summary="[owner] Change a tenant's plan")
async def upgrade_saas_tenant(
    tenant_id_str: str,
    tier: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    _: str = Depends(_require_owner),
):
    tenant = get_tenant(tenant_id_str, db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tier = tier.strip().lower()
    if tier not in VALID_TIERS:
        raise HTTPException(status_code=400, detail=f"tier must be one of {sorted(VALID_TIERS)}")

    stripe_secret = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if stripe_secret and tenant.stripe_subscription_id:
        try:
            import stripe  # noqa: PLC0415

            stripe.api_key = stripe_secret
            sub = stripe.Subscription.retrieve(tenant.stripe_subscription_id)
            stripe.Subscription.modify(
                tenant.stripe_subscription_id,
                items=[
                    {
                        "id": sub["items"]["data"][0]["id"],
                        "price_data": {
                            "currency": "usd",
                            "product": sub["items"]["data"][0]["price"]["product"],
                            "unit_amount": TIER_MONTHLY_USD[tier] * 100,
                            "recurring": {"interval": "month"},
                        },
                    }
                ],
                proration_behavior="always_invoice",
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Stripe plan-change failed for tenant %s: %s", tenant_id_str, exc)
            raise HTTPException(status_code=502, detail=f"Stripe plan change failed: {exc}") from exc

    tenant.subscription_tier = tier
    db.commit()
    db.refresh(tenant)
    return _tenant_out(tenant)


@router.post("/saas/tenants/{tenant_id_str}/cancel", summary="[owner] Cancel a tenant's subscription")
async def cancel_saas_tenant(tenant_id_str: str, db: Session = Depends(get_db), _: str = Depends(_require_owner)):
    tenant = get_tenant(tenant_id_str, db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    stripe_secret = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if stripe_secret and tenant.stripe_subscription_id:
        try:
            import stripe  # noqa: PLC0415

            stripe.api_key = stripe_secret
            stripe.Subscription.cancel(tenant.stripe_subscription_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Stripe cancel failed for tenant %s: %s", tenant_id_str, exc)
            # Still mark canceled locally — the owner explicitly asked to cancel;
            # a Stripe-side failure shouldn't leave the tenant looking active.

    tenant.subscription_status = "canceled"
    db.commit()
    db.refresh(tenant)
    return _tenant_out(tenant)


@router.get("/saas/analytics", summary="[owner] Platform-level SaaS metrics")
async def saas_analytics(db: Session = Depends(get_db), _: str = Depends(_require_owner)):
    tenants = db.query(Tenant).filter(Tenant.is_active == 1).all()
    by_tier: dict[str, int] = {}
    by_status: dict[str, int] = {}
    mrr = 0
    for t in tenants:
        by_tier[t.subscription_tier] = by_tier.get(t.subscription_tier, 0) + 1
        by_status[t.subscription_status] = by_status.get(t.subscription_status, 0) + 1
        if t.subscription_status == "active":
            mrr += TIER_MONTHLY_USD.get(t.subscription_tier, 0)

    return {
        "total_tenants": len(tenants),
        "by_tier": by_tier,
        "by_status": by_status,
        "mrr_usd": mrr,
        "arr_usd": mrr * 12,
    }
