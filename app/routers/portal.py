from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
import stripe
import os

from app.database import get_db
from app.models import Estimate

router = APIRouter(prefix="/portal", tags=["Customer Portal"])

# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class EstimatePortalOut(BaseModel):
    public_token: str
    estimate_number: str
    status: str
    service_type: Optional[str]
    scope_summary: Optional[str]
    total_amount: Optional[float]
    deposit_amount: Optional[float]
    currency: str
    signature_data_url: Optional[str]
    signed_at_utc: Optional[datetime]
    terms_accepted: bool
    payment_method: Optional[str]
    payment_status: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class SignEstimateRequest(BaseModel):
    signature_data_url: str
    terms_accepted: bool

class CheckoutRequest(BaseModel):
    success_url: str
    cancel_url: str

class CreateEstimateInternal(BaseModel):
    customer_name: Optional[str]
    customer_email: Optional[str]
    service_type: str
    scope_summary: str
    total_amount: float
    deposit_amount: float

class ManualPaymentRequest(BaseModel):
    payment_method: str # zelle, check, wire

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/estimates/{public_token}", response_model=EstimatePortalOut)
def get_estimate_public(public_token: str, db: Session = Depends(get_db)):
    """Fetch an estimate by its public secure token for the customer portal."""
    estimate = db.query(Estimate).filter(Estimate.public_token == public_token).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found or link expired.")
    return estimate

import uuid

@router.post("/estimates/internal", response_model=EstimatePortalOut)
def create_estimate_internal(req: CreateEstimateInternal, tenant_id: str = "default", db: Session = Depends(get_db)):
    """Create an estimate from the internal Cockpit."""
    new_est = Estimate(
        tenant_id=tenant_id,
        estimate_number=f"EST-{str(uuid.uuid4())[:8].upper()}",
        public_token=uuid.uuid4().hex,
        service_type=req.service_type,
        scope_summary=req.scope_summary,
        total_amount=req.total_amount,
        deposit_amount=req.deposit_amount,
        status="sent"
    )
    db.add(new_est)
    db.commit()
    db.refresh(new_est)
    return new_est

@router.post("/estimates/{public_token}/sign", response_model=EstimatePortalOut)
def sign_estimate(public_token: str, req: SignEstimateRequest, db: Session = Depends(get_db)):
    """Capture the digital signature from the HTML5 canvas."""
    estimate = db.query(Estimate).filter(Estimate.public_token == public_token).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found.")
        
    if not req.terms_accepted:
        raise HTTPException(status_code=400, detail="You must accept the terms and conditions.")
        
    estimate.signature_data_url = req.signature_data_url
    estimate.terms_accepted = req.terms_accepted
    estimate.signed_at_utc = datetime.now(timezone.utc)
    
    # If there is no deposit required, mark it approved immediately
    if estimate.deposit_amount is None or estimate.deposit_amount <= 0:
        estimate.status = "approved"
        
    db.commit()
    db.refresh(estimate)
    return estimate

@router.post("/estimates/{public_token}/checkout")
def create_stripe_checkout(public_token: str, req: CheckoutRequest, db: Session = Depends(get_db)):
    """Generate a Stripe Checkout Session for the deposit."""
    estimate = db.query(Estimate).filter(Estimate.public_token == public_token).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found.")
        
    if not estimate.signed_at_utc:
        raise HTTPException(status_code=400, detail="Estimate must be signed before paying deposit.")
        
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_mock")
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': estimate.currency or 'usd',
                    'product_data': {
                        'name': f'Deposit for {estimate.service_type or "Paving Services"}',
                        'description': f'Estimate #{estimate.estimate_number}',
                    },
                    'unit_amount': int((estimate.deposit_amount or 0) * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=req.success_url,
            cancel_url=req.cancel_url,
            metadata={
                'estimate_id': estimate.id,
                'public_token': estimate.public_token
            }
        )
        return {"checkout_url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/estimates/{public_token}/manual_payment", response_model=EstimatePortalOut)
def select_manual_payment(public_token: str, req: ManualPaymentRequest, db: Session = Depends(get_db)):
    """Record that the customer opted for Zelle, Check, or Wire."""
    estimate = db.query(Estimate).filter(Estimate.public_token == public_token).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found.")
        
    if not estimate.signed_at_utc:
        raise HTTPException(status_code=400, detail="Estimate must be signed before paying deposit.")
        
    valid_methods = ["zelle", "check", "wire"]
    if req.payment_method not in valid_methods:
        raise HTTPException(status_code=400, detail="Invalid payment method.")
        
    estimate.payment_method = req.payment_method
    estimate.payment_status = "pending"
    db.commit()
    db.refresh(estimate)
    
    return estimate
