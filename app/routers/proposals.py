"""
proposals.py — proposal generator endpoints.

Routes:
  POST /api/v1/proposals/generate       — generate text + PDF proposal
  POST /api/v1/proposals/{lead_id}/send — generate and email proposal to lead
"""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import Lead
from ..services.notifications import send_transactional_email
from ..services.pricing import estimate_price
from ..services.proposal_generator import generate_proposal_pdf, generate_proposal_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/v1/proposals', tags=['proposals'])


class ProposalRequest(BaseModel):
    lead_id: int
    include_pdf: bool = True


def _build_lead_dict(lead: Lead) -> dict:
    pricing = estimate_price(lead.service_type, lead.property_type, lead.project_size_sqft or 1000)
    return {
        'id': lead.id,
        'name': lead.name,
        'email': lead.email,
        'phone': lead.phone,
        'service_type': lead.service_type,
        'property_type': lead.property_type,
        'urgency': lead.urgency,
        'project_size_sqft': lead.project_size_sqft,
        'address': lead.address,
        'message': lead.message,
        'price_low': pricing['low_usd'] if pricing else 'Contact for pricing',
        'price_high': pricing['high_usd'] if pricing else '',
    }


@router.post('/generate', summary='Generate a professional proposal for a lead')
@limiter.limit('10/minute')
async def generate_proposal(
    request: Request,
    req: ProposalRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    lead = db.get(Lead, req.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail='Lead not found')

    lead_dict = _build_lead_dict(lead)
    proposal_text = generate_proposal_text(lead_dict)

    result: dict = {
        'proposal_id': lead.id,
        'lead_id': lead.id,
        'lead_name': lead.name,
        'proposal_text': proposal_text,
    }

    if req.include_pdf:
        pdf_bytes = generate_proposal_pdf(lead_dict)
        b64 = base64.b64encode(pdf_bytes).decode()
        # Keep both names for backward compatibility
        result['pdf_b64'] = b64
        result['pdf_base64'] = b64
        result['pdf_size_bytes'] = len(pdf_bytes)

    try:
        if lead.pipeline_stage in ('new', 'contacted'):
            lead.pipeline_stage = 'proposal_sent'
            lead.proposal_sent_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning('Could not update pipeline stage: %s', exc)

    return result


def _send_proposal_email(lead_dict: dict, proposal_text: str, pdf_bytes: bytes | None) -> None:
    recipient = lead_dict.get('email', '')
    if not recipient or '@' not in recipient:
        logger.warning('Invalid recipient email for proposal: %s', recipient)
        return

    subject = 'Your Project Proposal from J. Worden & Sons Asphalt Paving'
    html_body = f"""
    <html><body style="font-family: sans-serif; color: #1a1a2e; max-width: 700px;">
      <div style="background: #f5a623; padding: 20px; text-align: center;">
        <h1 style="color: #1a1a2e; margin: 0;">J. Worden & Sons Asphalt Paving</h1>
        <p style="color: #1a1a2e; margin: 4px 0;">Project Proposal</p>
      </div>
      <div style="padding: 24px;">
        <p>Dear {lead_dict.get('name', 'Valued Customer')},</p>
        <p>Thank you for your interest in our services. Please find your project proposal attached.</p>
        <pre style="background: #f9f9f9; padding: 16px; border-radius: 4px; white-space: pre-wrap; font-size: 13px;">
{proposal_text[:3000]}
        </pre>
        <p>Please don't hesitate to contact us with any questions.</p>
      </div>
    </body></html>
    """

    filename = f"proposal_{lead_dict.get('name', 'client').replace(' ', '_')}.pdf"
    ok = send_transactional_email(
        subject=subject,
        html_body=html_body,
        to_addresses=[recipient],
        attachment_bytes=pdf_bytes,
        attachment_name=filename,
    )

    if ok:
        logger.info('Proposal emailed to %s', recipient)
    else:
        logger.error('Proposal email send failed for %s', recipient)


@router.post('/{lead_id}/send', summary='Generate and email proposal to lead')
@limiter.limit('5/minute')
async def send_proposal(
    request: Request,
    lead_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail='Lead not found')
    if not lead.email or '@' not in lead.email:
        raise HTTPException(status_code=422, detail='Lead has no valid email address')

    lead_dict = _build_lead_dict(lead)
    proposal_text = generate_proposal_text(lead_dict)
    pdf_bytes = generate_proposal_pdf(lead_dict)

    background_tasks.add_task(_send_proposal_email, lead_dict, proposal_text, pdf_bytes)

    return {
        'status': 'queued',
        'message': f'Proposal will be emailed to {lead.email}',
        'lead_id': lead_id,
        'lead_name': lead.name,
    }
