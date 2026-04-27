"""
tenants.py — White-label / multi-tenant management endpoints for JWordenAI.

Routes:
  GET  /api/v1/tenants/{tenant_id}  — get tenant config
  POST /api/v1/tenants              — create tenant (master key required)
  PUT  /api/v1/tenants/{tenant_id}  — update tenant config

Requires master key (JWORDEN_MASTER_KEY) for all endpoints.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..services.tenant_service import get_tenant, create_tenant, update_tenant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tenants", tags=["tenants"])


class TenantCreate(BaseModel):
    tenant_id: str
    company_name: str
    system_prompt_override: Optional[str] = None
    primary_color: str = "#f5a623"
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class TenantUpdate(BaseModel):
    company_name: Optional[str] = None
    system_prompt_override: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: Optional[int] = None


@router.get("/{tenant_id}", summary="Get tenant configuration")
@limiter.limit("60/minute")
async def get_tenant_config(
    request: Request,
    tenant_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return tenant configuration including branding and prompt overrides."""
    tenant = get_tenant(tenant_id, db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "tenant_id": tenant.tenant_id,
        "company_name": tenant.company_name,
        "system_prompt_override": tenant.system_prompt_override,
        "primary_color": tenant.primary_color,
        "logo_url": tenant.logo_url,
        "contact_email": tenant.contact_email,
        "contact_phone": tenant.contact_phone,
        "is_active": tenant.is_active,
        "created_at": tenant.created_at.isoformat(),
    }


@router.post("", summary="Create a new tenant (master key required)")
@limiter.limit("10/minute")
async def create_tenant_endpoint(
    request: Request,
    req: TenantCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Create a new white-label tenant. Requires JWORDEN_MASTER_KEY."""
    existing = get_tenant(req.tenant_id, db)
    if existing:
        raise HTTPException(status_code=409, detail=f"Tenant '{req.tenant_id}' already exists")

    tenant = create_tenant(req.model_dump(), db)
    logger.info("Tenant created: %s", tenant.tenant_id)

    return {
        "status": "created",
        "tenant_id": tenant.tenant_id,
        "company_name": tenant.company_name,
    }


@router.put("/{tenant_id}", summary="Update tenant configuration")
@limiter.limit("30/minute")
async def update_tenant_endpoint(
    request: Request,
    tenant_id: str,
    req: TenantUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Update an existing tenant's configuration."""
    tenant = update_tenant(tenant_id, req.model_dump(exclude_none=True), db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {"status": "updated", "tenant_id": tenant.tenant_id}
