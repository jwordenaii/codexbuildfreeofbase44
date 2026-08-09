"""Stripe checkout + webhook endpoints for deposit collection."""

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import Lead, PaymentTransaction, Tenant, TenantBillingEvent
from ..services.pricing import estimate_price

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/v1/payments', tags=['payments'])


class CheckoutRequest(BaseModel):
    lead_id: int
    success_url: str | None = None
    cancel_url: str | None = None


@router.post('/checkout-session', summary='Create Stripe checkout session for lead deposit')
@limiter.limit('20/minute')
async def create_checkout_session(
    request: Request,
    body: CheckoutRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    lead = db.get(Lead, body.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail='Lead not found')

    price = estimate_price(lead.service_type, lead.property_type, lead.project_size_sqft or 1000)
    low_estimate = float(price['low_usd']) if price else 500.0
    deposit_amount = max(100.0, round(low_estimate * 0.2, 2))

    success_url = body.success_url or os.getenv('STRIPE_SUCCESS_URL', 'http://localhost:5173/quote?payment=success')
    cancel_url = body.cancel_url or os.getenv('STRIPE_CANCEL_URL', 'http://localhost:5173/quote?payment=cancel')

    stripe_secret = os.getenv('STRIPE_SECRET_KEY', '').strip()
    checkout_id = f'mock_cs_{lead.id}_{int(datetime.now(timezone.utc).timestamp())}'
    checkout_url = f'{success_url}&session_id={checkout_id}'

    if stripe_secret:
        try:
            import stripe  # noqa: PLC0415

            stripe.api_key = stripe_secret
            session = stripe.checkout.Session.create(
                mode='payment',
                success_url=success_url,
                cancel_url=cancel_url,
                payment_method_types=['card'],
                metadata={'lead_id': str(lead.id)},
                line_items=[
                    {
                        'quantity': 1,
                        'price_data': {
                            'currency': 'usd',
                            'product_data': {'name': f'Project Deposit — Lead #{lead.id}'},
                            'unit_amount': int(deposit_amount * 100),
                        },
                    }
                ],
            )
            checkout_id = session.id
            checkout_url = session.url
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f'Unable to create checkout session: {exc}') from exc

    tx = PaymentTransaction(
        lead_id=lead.id,
        stripe_checkout_session_id=checkout_id,
        amount_usd=deposit_amount,
        currency='usd',
        status='pending',
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return {
        'payment_id': tx.id,
        'lead_id': lead.id,
        'amount_usd': deposit_amount,
        'checkout_session_id': checkout_id,
        'checkout_url': checkout_url,
        'status': tx.status,
    }


@router.post('/webhook', summary='Stripe webhook receiver')
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    stripe_secret = os.getenv('STRIPE_SECRET_KEY', '').strip()
    webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET', '').strip()

    event = None
    if stripe_secret and webhook_secret:
        try:
            import stripe  # noqa: PLC0415

            stripe.api_key = stripe_secret
            signature = request.headers.get('stripe-signature', '')
            event = stripe.Webhook.construct_event(payload, signature, webhook_secret)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f'Invalid Stripe webhook: {exc}') from exc
    else:
        try:
            event = await request.json()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f'Invalid webhook payload: {exc}') from exc

    event_type = event.get('type', '')
    data_obj = ((event.get('data') or {}).get('object') or {})
    stripe_event_id = event.get('id') or f'demo_{event_type}_{int(datetime.now(timezone.utc).timestamp())}'

    def _log_tenant_billing_event(tenant, amount_cents=None, status=None):
        # Idempotent: stripe_event_id is unique, so a retried webhook delivery
        # (Stripe retries on any non-2xx) just no-ops here instead of duplicating.
        if db.query(TenantBillingEvent).filter(TenantBillingEvent.stripe_event_id == stripe_event_id).first():
            return
        db.add(TenantBillingEvent(
            tenant_id=tenant.id,
            stripe_event_id=stripe_event_id,
            event_type=event_type,
            amount_cents=amount_cents,
            status=status,
        ))

    # SaaS tenant subscription checkout (see routers/factory.py) — distinguished
    # from a lead-deposit checkout by the tenant_id metadata key set at session
    # creation time.
    metadata = data_obj.get('metadata') or {}
    tenant_id = metadata.get('tenant_id')

    if event_type == 'checkout.session.completed' and data_obj.get('mode') == 'subscription' and tenant_id:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if tenant:
            tenant.stripe_customer_id = data_obj.get('customer')
            tenant.stripe_subscription_id = data_obj.get('subscription')
            tenant.subscription_status = 'active'
            _log_tenant_billing_event(tenant, amount_cents=data_obj.get('amount_total'), status='active')
            db.commit()
            logger.info('Tenant %s subscription activated (customer=%s)', tenant_id, tenant.stripe_customer_id)

    elif event_type in {'customer.subscription.updated', 'customer.subscription.deleted'}:
        sub_id = data_obj.get('id')
        tenant = db.query(Tenant).filter(Tenant.stripe_subscription_id == sub_id).first()
        if tenant:
            if event_type == 'customer.subscription.deleted':
                tenant.subscription_status = 'canceled'
            else:
                stripe_status = data_obj.get('status', '')
                tenant.subscription_status = 'active' if stripe_status == 'active' else (stripe_status or 'past_due')
                period_end = data_obj.get('current_period_end')
                if period_end:
                    tenant.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
            _log_tenant_billing_event(tenant, status=tenant.subscription_status)
            db.commit()
            logger.info('Tenant %s subscription status -> %s', tenant.tenant_id, tenant.subscription_status)

    elif event_type == 'invoice.paid' and tenant_id:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if tenant:
            tenant.subscription_status = 'active'
            period_end = (data_obj.get('lines', {}).get('data') or [{}])[0].get('period', {}).get('end')
            if period_end:
                tenant.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
            _log_tenant_billing_event(tenant, amount_cents=data_obj.get('amount_paid'), status='active')
            db.commit()
            logger.info('Tenant %s invoice paid, period extended', tenant_id)

    elif event_type in {'checkout.session.completed', 'payment_intent.succeeded'}:
        checkout_id = data_obj.get('id') or data_obj.get('checkout_session')
        tx = db.query(PaymentTransaction).filter(PaymentTransaction.stripe_checkout_session_id == checkout_id).first()
        if tx:
            tx.status = 'paid'
            tx.stripe_payment_intent_id = data_obj.get('payment_intent') or data_obj.get('id')
            tx.paid_at = datetime.now(timezone.utc)
            lead = db.get(Lead, tx.lead_id)
            if lead and lead.pipeline_stage in {'new', 'contacted'}:
                lead.pipeline_stage = 'proposal_sent'
            db.commit()

    # SaaS subscription activation. billing.py creates Stripe *subscription*
    # checkouts (mode='subscription') carrying metadata {tenant_id, plan} for
    # thewordenstandard.com signups. Nothing was flipping the tenant on when
    # that payment completed, so a paying subscriber's account never activated.
    # This closes that gap using only the existing Tenant.is_active column — no
    # schema change, so it is safe to deploy before/without a migration.
    #
    # Full lifecycle (persist stripe_customer_id / stripe_subscription_id to
    # match cancellations, and store subscription_tier) needs three new Tenant
    # columns; that is a deliberate follow-up migration, intentionally NOT bundled
    # into this deploy because fly.toml has no release_command (migrations run by
    # hand) and a code/DB mismatch on a live billing endpoint must be avoided.
    if event_type == 'checkout.session.completed':
        metadata = data_obj.get('metadata') or {}
        tenant_id = metadata.get('tenant_id')
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if tenant and not tenant.is_active:
                tenant.is_active = 1
                db.commit()
                logger.info('Tenant %s activated via Stripe subscription checkout.', tenant_id)

    return {'received': True, 'type': event_type}


@router.get('/status/{lead_id}', summary='Get latest payment status for a lead')
@limiter.limit('60/minute')
async def payment_status(
    request: Request,
    lead_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    tx = (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.lead_id == lead_id)
        .order_by(PaymentTransaction.created_at.desc())
        .first()
    )

    return {
        'lead_id': lead_id,
        'has_payment': bool(tx),
        'status': tx.status if tx else 'none',
        'amount_usd': tx.amount_usd if tx else None,
        'paid_at': tx.paid_at.isoformat() if tx and tx.paid_at else None,
    }
