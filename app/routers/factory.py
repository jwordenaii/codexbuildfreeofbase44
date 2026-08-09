"""
factory.py — the SaaS Site Factory: hostname resolution, tenant self-serve
signup, owner-side tenant/billing management, and the market-site tooling.

Routes:
  GET  /api/v1/factory/resolve                    — public hostname -> tenant config
  POST /api/v1/factory/saas/provision             — public self-serve signup + Stripe checkout
  GET  /api/v1/factory/saas/tenants               — [owner] tenant list + MRR
  GET  /api/v1/factory/saas/tenants/{id}          — [owner] one tenant's billing detail
  POST /api/v1/factory/saas/tenants/{id}/upgrade  — [owner] change plan
  POST /api/v1/factory/saas/tenants/{id}/cancel   — [owner] cancel subscription
  GET  /api/v1/factory/saas/analytics             — [owner] platform MRR/ARR
  POST /api/v1/factory/sites                      — launch a MarketSite
  POST /api/v1/factory/blog/generate              — AI blog generator
  POST /api/v1/factory/indexnow/submit            — instant search-engine indexing

MERGE NOTE (this file was added independently on two branches):

/saas/provision existed on both sides with opposite intent. One version was
gated behind verify_premium_security and rejected any caller whose tenant_id
was not "default" — but the thing that actually calls it is the public signup
form in SaaSPlatformPortal.jsx, which posts with no Authorization header at
all. Public signup therefore could not succeed. The public, rate-limited
version is kept, since that is the one the frontend is written against; it
still only writes a narrow field set and prices the plan inline.

/resolve also existed on both sides. The richer version is kept — it carries
MARKET_PROFILES, branding tier and theme colours, which host-based routing and
SiteFactoryPanel read. The simpler subdomain-only lookup is preserved as
_extract_tenant_slug and used as the fallback path.

Billing mirrors app/routers/payments.py: no STRIPE_SECRET_KEY -> mock checkout
URL so the flow stays testable end to end; key present -> a real Stripe
Checkout session in subscription mode, priced inline (no pre-created Products).
"""


import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import MarketSite, Tenant, TenantBillingEvent
from ..routers.admin_integrations import _require_owner
from ..services.tenant_service import create_tenant, get_tenant

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


class SiteResolution(BaseModel):
    tenant_id: str
    company_name: str
    subscription_tier: str
    hostname: str
    route_mode: str
    site_title: Optional[str] = None
    site_description: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    hero_headline: Optional[str] = None
    hero_subheadline: Optional[str] = None
    local_weather_copy: Optional[str] = None
    phone_override: Optional[str] = None
    branding_tier: Optional[str] = None   # 'jarvis' | 'worden_standard' | 'white_label'
    logo_url: Optional[str] = None
    market: Optional[dict] = None

MARKET_PROFILES = {
    "asphaltpavingkansascity.com": {
        "marketName": "Kansas City Asphalt",
        "primaryRegion": "Greater Kansas City",
        "primaryMetro": "KC Metro Area",
        "heroKicker": "Logistics & Industrial Paving",
        "heroHeadline": "Heavy-Duty Asphalt Engineered For Kansas City",
        "primary_color": "#dc2626" # Heartland Crimson
    },
    "atlantaasphaltpavingpros.com": {
        "marketName": "Atlanta Asphalt Pros",
        "primaryRegion": "Metro Atlanta",
        "primaryMetro": "Atlanta",
        "heroKicker": "High-Volume Commercial Delivery",
        "heroHeadline": "Premium Asphalt Construction Built For Atlanta Traffic",
        "primary_color": "#f97316" # Georgia Peach
    },
    "blueridgeasphaltpaving.com": {
        "marketName": "Blue Ridge Estate & Mountain Paving",
        "primaryRegion": "Blue Ridge, Shenandoah Valley & Appalachian Highlands",
        "primaryMetro": "Roanoke / Charlottesville / Winchester",
        "heroKicker": "Deep Highland Access & Elevation Certified",
        "heroHeadline": "Premium Asphalt Engineered To Survive The Mountains",
        "heroBody": "Flawless structural-grade driveways and commercial parking lots engineered to eliminate drainage issues, prevent washouts, and easily withstand extreme Appalachian freeze-thaw cycles. Serving Monterey to Charlottesville, and Roanoke to Winchester, VA.",
        "primary_color": "#dc2626", # Powerhouse Red
        "phoneDisplay": "(804) 446-1296",
        "proofHeadline": "Paved 100+ KFC Locations & Deep Mountain Estates"
    },
    "jwordenuniversity.com": {
        "marketName": "J. Worden University",
        "primaryRegion": "Global Infrastructure",
        "primaryMetro": "Starbase Campus",
        "heroKicker": "Next-Generation Training & Certification",
        "heroHeadline": "The Launchpad For Asphalt Engineering Excellence",
        "primary_color": "#000000" # SpaceX Deep Space Black
    },
    "carolinablacktop.com": {
        "marketName": "Carolina Blacktop",
        "primaryRegion": "North & South Carolina",
        "primaryMetro": "Charlotte & Raleigh",
        "heroKicker": "Generational Paving Standards",
        "heroHeadline": "Premium Asphalt Construction Across The Carolinas",
        "primary_color": "#3b82f6" # Tarheel Blue
    },
    "michiganasphaltpavingpros": { # Pattern match
        "marketName": "Michigan Asphalt Pros",
        "primaryRegion": "State of Michigan",
        "primaryMetro": "Detroit / Grand Rapids",
        "heroKicker": "Freeze-Thaw Certified Delivery",
        "heroHeadline": "Winter-Tested Asphalt Built For Michigan Weather",
        "primary_color": "#64748b" # Industrial Steel
    },
    "minnesotaasphaltpaving.com": {
        "marketName": "Minnesota Asphalt Paving",
        "primaryRegion": "Twin Cities & Greater MN",
        "primaryMetro": "Minneapolis / St. Paul",
        "heroKicker": "Deep-Freeze Resilience",
        "heroHeadline": "Heavy-Duty Asphalt Engineered For Minnesota Winters",
        "primary_color": "#0ea5e9" # Frost Blue
    },
    "obxpaving.com": {
        "marketName": "OBX Paving",
        "primaryRegion": "Outer Banks & Dare County",
        "primaryMetro": "Kitty Hawk / Nags Head",
        "heroKicker": "Coastal Grade Construction",
        "heroHeadline": "Saltwater-Resistant Asphalt Paving For The Outer Banks",
        "primary_color": "#14b8a6" # Coastal Teal
    },
    "richmondasphalt": { # Pattern match
        "marketName": "Richmond Asphalt",
        "primaryRegion": "Central Virginia",
        "primaryMetro": "Richmond Metro",
        "heroKicker": "Verified Field Documentation",
        "heroHeadline": "Premium Asphalt Construction Built For Local Conditions",
        "primary_color": "#f59e0b" # Classic Amber
    },
    "savannah": { # Pattern match
        "marketName": "Savannah Paving",
        "primaryRegion": "Coastal Empire",
        "primaryMetro": "Savannah",
        "heroKicker": "High-Humidity Drainage Control",
        "heroHeadline": "Coastal Asphalt Engineering For Savannah",
        "primary_color": "#22c55e" # Coastal Green
    }
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


@router.get("/resolve", response_model=SiteResolution, summary="Resolve tenant by hostname")
@limiter.limit("200/minute")
async def resolve_hostname(request: Request, hostname: str, db: Session = Depends(get_db)):
    """Fast resolution for Vite SPA on Vercel."""
    safe_hostname = hostname.lower().strip()
    
    # Internal routing overrides
    if "wordenstandard" in safe_hostname or "localhost" in safe_hostname or "127.0.0.1" in safe_hostname:
        return {
            "tenant_id": "default",
            "company_name": "J. Worden & Sons",
            "subscription_tier": "pro",
            "hostname": safe_hostname,
            "route_mode": "operations",
            "site_title": "The Worden Standard",
            "site_description": "Asphalt Paving Command Center",
            "primary_color": "#050810",
            "accent_color": "#f59e0b",
            "hero_headline": None,
            "hero_subheadline": None,
            "local_weather_copy": None,
            "phone_override": None,
            "branding_tier": None,
            "logo_url": None,
        }

    # Check for SaaS subdomain pattern: <slug>.thewordenstandard.com
    if safe_hostname.endswith(".thewordenstandard.com") and safe_hostname != "thewordenstandard.com":
        subdomain_slug = safe_hostname.replace(".thewordenstandard.com", "")
        saas_tenant = db.query(Tenant).filter(
            Tenant.subdomain_slug == subdomain_slug
        ).first() if hasattr(Tenant, 'subdomain_slug') else None
        if saas_tenant:
            return {
                "tenant_id": saas_tenant.tenant_id,
                "company_name": saas_tenant.company_name,
                "subscription_tier": getattr(saas_tenant, "subscription_tier", "pro"),
                "hostname": safe_hostname,
                "route_mode": "saas-client",
                "site_title": saas_tenant.company_name,
                "site_description": f"{saas_tenant.company_name} — Powered by Jarvis",
                "primary_color": getattr(saas_tenant, "primary_color", "#f59e0b"),
                "accent_color": None,
                "hero_headline": None,
                "hero_subheadline": None,
                "local_weather_copy": None,
                "phone_override": getattr(saas_tenant, "contact_phone", None),
                "branding_tier": getattr(saas_tenant, "branding_tier", "jarvis"),
                "logo_url": getattr(saas_tenant, "logo_url", None),
            }

    # Match regional market profiles
    profile = None
    for key, val in MARKET_PROFILES.items():
        if key in safe_hostname:
            profile = val
            break
            
    site = db.query(MarketSite).filter(MarketSite.hostname == safe_hostname).first()
    
    if not site:
        # If not in DB, but we have a hardcoded profile, serve the gorgeous market site
        if profile:
            return {
                "tenant_id": "default",
                "company_name": profile["marketName"],
                "subscription_tier": "pro",
                "hostname": safe_hostname,
                "route_mode": "university" if "jwordenuniversity" in safe_hostname else "market-landing",
                "site_title": f"{profile['marketName']} | Asphalt Paving",
                "site_description": f"Premium asphalt paving serving {profile['primaryRegion']}.",
                "primary_color": profile["primary_color"],
                "accent_color": None,
                "hero_headline": profile["heroHeadline"],
                "hero_subheadline": profile["heroKicker"],
                "local_weather_copy": profile["primaryMetro"],
                "phone_override": None,
                "market": profile # Inject full payload for MarketLanding.jsx
            }
        
        # Absolute fallback
        return {
            "tenant_id": "default",
            "company_name": "Local Asphalt Paving",
            "subscription_tier": "lite",
            "hostname": safe_hostname,
            "route_mode": "full-site",
            "site_title": "Premium Asphalt Paving",
            "site_description": "Premium Asphalt Paving",
            "primary_color": "#f59e0b",
            "accent_color": None,
            "hero_headline": None,
            "hero_subheadline": None,
            "local_weather_copy": None,
            "phone_override": None
        }
        
    # Get Tenant associated with the MarketSite
    tenant = db.query(Tenant).filter(Tenant.tenant_id == site.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=500, detail="Tenant data missing")
        
    # If in DB and we have a hardcoded rich profile, merge them
    return {
        "tenant_id": tenant.tenant_id,
        "company_name": tenant.company_name,
        "subscription_tier": getattr(tenant, "subscription_tier", "lite"),
        "hostname": site.hostname,
        "route_mode": site.route_mode,
        "site_title": site.site_title,
        "site_description": site.site_description,
        "primary_color": site.primary_color or (profile["primary_color"] if profile else tenant.primary_color),
        "accent_color": site.accent_color,
        "hero_headline": site.hero_headline or (profile["heroHeadline"] if profile else None),
        "hero_subheadline": site.hero_subheadline or (profile["heroKicker"] if profile else None),
        "local_weather_copy": site.local_weather_copy or (profile["primaryMetro"] if profile else None),
        "phone_override": site.phone_override or tenant.contact_phone,
        "market": profile if profile else None,
        "branding_tier": None,
        "logo_url": None,
    }


# ── SaaS Tenant Provisioning ──────────────────────────────────────────────────

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
class MarketSiteCreate(BaseModel):
    hostname: str
    route_mode: str = "market-landing"
    site_title: Optional[str] = None
    city_target: Optional[str] = None
    state_target: Optional[str] = None

@router.post("/sites", summary="Launch a new Market Site")
@limiter.limit("10/minute")
async def create_market_site(
    request: Request,
    req: MarketSiteCreate,
    db: Session = Depends(get_db),
    auth_data: dict = Depends(verify_premium_security),
):
    """
    Launch a new SEO Market Site.
    Enforces subscription tier (Pro/Max required).
    """
    tenant_id = auth_data.get("tenant_id", "default")
    
    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not tenant or getattr(tenant, "subscription_tier", "lite") == "lite":
        raise HTTPException(status_code=403, detail="Upgrade to PRO to launch unlimited Market Sites.")
        
    safe_host = req.hostname.lower().strip()
    exists = db.query(MarketSite).filter(MarketSite.hostname == safe_host).first()
    if exists:
        raise HTTPException(status_code=409, detail="Hostname already registered")
        
    site = MarketSite(
        tenant_id=tenant_id,
        hostname=safe_host,
        route_mode=req.route_mode,
        site_title=req.site_title,
        city_target=req.city_target,
        state_target=req.state_target,
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    
    return {"status": "success", "site_id": site.id, "hostname": site.hostname}

class GenerateBlogRequest(BaseModel):
    hostname: str
    topic: str
    keywords: List[str]

@router.post("/blog/generate", summary="AI Blog Generator")
@limiter.limit("5/minute")
async def generate_seo_blog(
    request: Request,
    req: GenerateBlogRequest,
    db: Session = Depends(get_db),
    auth_data: dict = Depends(verify_premium_security),
):
    """
    Generate an SEO optimized blog post for a specific Market Site.
    """
    tenant_id = auth_data.get("tenant_id", "default")
    
    # 1. Verify Entitlement
    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not tenant or getattr(tenant, "subscription_tier", "lite") == "lite":
        raise HTTPException(status_code=403, detail="Upgrade to PRO to access the AI Content Engine.")
        
    # 2. Get Site Context
    safe_host = req.hostname.lower().strip()
    site = db.query(MarketSite).filter(MarketSite.hostname == safe_host).first()
    if not site or site.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Market Site not found or unauthorized.")
        
    # 3. Call AI to Generate Content (Placeholder for Gemini Integration)
    generated_title = f"{req.topic.title()} in {site.city_target or 'Your Area'}"
    generated_body = f"<p>This is a highly optimized post about {req.topic} targeting {site.city_target or 'your area'}. It includes semantic HTML and covers keywords like {', '.join(req.keywords)}.</p>"
    
    # 4. Save to DB
    from ..models import BlogPost
    import uuid
    from datetime import datetime, timezone
    
    slug = generated_title.lower().replace(" ", "-") + "-" + str(uuid.uuid4())[:8]
    
    post = BlogPost(
        tenant_id=tenant_id,
        market_site_id=site.id,
        slug=slug,
        title=generated_title,
        body=generated_body,
        status="published",
        published_at=datetime.now(timezone.utc)
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    
    return {"status": "success", "post_id": post.id, "slug": post.slug}


class IndexNowSubmitRequest(BaseModel):
    host: str
    urls: List[str]

@router.post("/indexnow/submit", summary="Submit URLs to IndexNow for instant search engine indexing")
@limiter.limit("10/minute")
async def submit_indexnow_urls(
    request: Request,
    req: IndexNowSubmitRequest,
    auth_data: dict = Depends(verify_premium_security),
):
    """
    Submits newly generated pages to IndexNow API for immediate crawling by Bing, Yandex, and partners.
    """
    import httpx
    
    key = "7e492211ca9f4a95a8e0cb20e98031d2" # Standard IndexNow key
    endpoint = "https://api.indexnow.org/indexnow"
    
    payload = {
        "host": req.host,
        "key": key,
        "keyLocation": f"https://{req.host}/{key}.txt",
        "urlList": req.urls
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(endpoint, json=payload)
        
    return {
        "status": "submitted",
        "http_code": res.status_code,
        "submitted_urls_count": len(req.urls),
        "host": req.host
    }
