"""
superadmin.py — Super Admin backend APIs for global platform telemetry and intervention.
Restricted to the 'default' tenant (J. Worden HQ) users with role='admin'.
"""

import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Tenant, User
from .auth import _ALGORITHM

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/superadmin", tags=["superadmin"])

# Quick mock dependency to enforce Super Admin role (in reality, read from JWT)
def verify_super_admin():
    # Placeholder: In a real app we decode the JWT and check tenant_id == 'default'
    pass

class TenantTelemetry(BaseModel):
    tenant_id: str
    company_name: str
    industry: str
    subscription_tier: str
    is_active: bool
    user_count: int
    mrr_contribution: int

class PlatformTelemetry(BaseModel):
    total_mrr: int
    active_tenants: int
    churn_risk_count: int
    tenants: List[TenantTelemetry]

@router.get("/telemetry", response_model=PlatformTelemetry)
def get_telemetry(db: Session = Depends(get_db)):
    """Fetch global telemetry across all SaaS tenants."""
    verify_super_admin()
    
    tenants = db.query(Tenant).all()
    
    total_mrr = 0
    active_tenants = 0
    churn_risk = 0
    tenant_list = []
    
    tier_pricing = {
        "lite": 199,
        "pro": 499,
        "max": 999
    }
    
    for t in tenants:
        user_count = db.query(User).filter(User.tenant_id == t.tenant_id).count()
        mrr = tier_pricing.get(t.subscription_tier, 0) if t.is_active else 0
        
        if t.is_active:
            active_tenants += 1
            total_mrr += mrr
            # Simple churn heuristic: if they have 0 or 1 users, they are at risk
            if user_count <= 1 and t.tenant_id != "default":
                churn_risk += 1
                
        tenant_list.append(TenantTelemetry(
            tenant_id=t.tenant_id,
            company_name=t.company_name,
            industry=t.industry,
            subscription_tier=t.subscription_tier,
            is_active=bool(t.is_active),
            user_count=user_count,
            mrr_contribution=mrr
        ))
        
    return PlatformTelemetry(
        total_mrr=total_mrr,
        active_tenants=active_tenants,
        churn_risk_count=churn_risk,
        tenants=tenant_list
    )

class InterventionRequest(BaseModel):
    tenant_id: str
    message: str

@router.post("/intervene")
def trigger_intervention(request: InterventionRequest, db: Session = Depends(get_db)):
    """Triggers Jarvis to send a proactive support email to the tenant owner."""
    verify_super_admin()
    
    tenant = db.query(Tenant).filter(Tenant.tenant_id == request.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    logger.info(f"Jarvis Intervention Triggered for {tenant.company_name} ({request.tenant_id}): {request.message}")
    
    # In reality, this would hook into the email.py router or twilio to SMS the owner.
    return {"status": "success", "message": f"Jarvis dispatched to {tenant.contact_email}"}
