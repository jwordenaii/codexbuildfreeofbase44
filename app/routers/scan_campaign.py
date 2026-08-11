"""Scan campaign router — Property Scan -> Direct Mail pipeline management.

Ported from NewRepo's Worden Standard prototype
(apps/api/app/routers/scan_campaign.py). Adapted for this codebase's
conventions: `verify_premium_security` (bearer master-key/JWT, not
NewRepo's auth pattern) and the SlowAPI limiter already used across every
other premium router here (see app/routers/driveway_growth.py).

NOTE: no `from __future__ import annotations` here — this router uses
slowapi's @limiter.limit, and postponed annotations make FastAPI resolve
body/UploadFile type hints against the limiter wrapper's globals, breaking
request binding (same caveat NewRepo's own router documented).
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter, SCAN_LIMIT, SCAN_RUN_LIMIT
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import ScanCampaign, ScanProperty, ScanResult
from ..services.mailer_service import export_campaign_zip

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/scan-campaigns', tags=['scan-campaigns'])


class CampaignCreate(BaseModel):
    zip_code: str = Field(..., min_length=5, max_length=10)
    label: str = Field(default='', max_length=200)
    max_properties: int = Field(default=50, ge=1, le=500)
    auto_mail: bool = Field(default=False)  # if True, triggers Lob send after scan


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.post('/', dependencies=[Depends(verify_premium_security)], status_code=201)
@limiter.limit(SCAN_LIMIT)
async def create_campaign(request: Request, body: CampaignCreate, db: Session = Depends(get_db)):
    campaign = ScanCampaign(
        zip_code=body.zip_code.strip(),
        label=body.label or f'Campaign {body.zip_code}',
        max_properties=body.max_properties,
        auto_mail=body.auto_mail,
        status='pending',
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return {'campaign': _serialize_campaign(campaign)}


@router.get('/', dependencies=[Depends(verify_premium_security)])
@limiter.limit(SCAN_LIMIT)
async def list_campaigns(request: Request, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    campaigns = (
        db.query(ScanCampaign)
        .order_by(ScanCampaign.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return {'campaigns': [_serialize_campaign(c) for c in campaigns], 'total': db.query(ScanCampaign).count()}


@router.get('/{campaign_id}', dependencies=[Depends(verify_premium_security)])
@limiter.limit(SCAN_LIMIT)
async def get_campaign(request: Request, campaign_id: int, db: Session = Depends(get_db)):
    campaign = _get_or_404(campaign_id, db)
    properties = (
        db.query(ScanProperty)
        .filter(ScanProperty.campaign_id == campaign_id)
        .order_by(ScanProperty.id)
        .all()
    )
    prop_data = []
    for p in properties:
        result = db.query(ScanResult).filter(ScanResult.property_id == p.id).first()
        prop_data.append(_serialize_property(p, result))
    return {'campaign': _serialize_campaign(campaign), 'properties': prop_data}


@router.delete('/{campaign_id}', dependencies=[Depends(verify_premium_security)], status_code=204)
@limiter.limit(SCAN_LIMIT)
async def delete_campaign(request: Request, campaign_id: int, db: Session = Depends(get_db)):
    campaign = _get_or_404(campaign_id, db)
    if campaign.status == 'running':
        raise HTTPException(status.HTTP_409_CONFLICT, detail='Cannot delete a running campaign.')
    db.query(ScanResult).filter(
        ScanResult.property_id.in_(
            db.query(ScanProperty.id).filter(ScanProperty.campaign_id == campaign_id)
        )
    ).delete(synchronize_session=False)
    db.query(ScanProperty).filter(ScanProperty.campaign_id == campaign_id).delete()
    db.delete(campaign)
    db.commit()


# ── Run ───────────────────────────────────────────────────────────────────────

@router.post('/{campaign_id}/run', dependencies=[Depends(verify_premium_security)])
@limiter.limit(SCAN_RUN_LIMIT)
async def run_campaign(request: Request, campaign_id: int, db: Session = Depends(get_db)):
    campaign = _get_or_404(campaign_id, db)
    if campaign.status == 'running':
        raise HTTPException(status.HTTP_409_CONFLICT, detail='Campaign is already running.')
    if campaign.status == 'done':
        raise HTTPException(status.HTTP_409_CONFLICT, detail='Campaign is already complete. Delete and recreate to re-run.')

    # Dispatch Celery task (import here to avoid circular at module level)
    try:
        from ..tasks.scan_tasks import run_scan_campaign_task
        task = run_scan_campaign_task.delay(campaign_id)
        campaign.status = 'queued'
        db.commit()
        return {'status': 'queued', 'campaign_id': campaign_id, 'task_id': task.id}
    except Exception as exc:
        # Celery not running (dev) — run synchronously
        logger.warning('Celery unavailable, running scan synchronously: %s', exc)
        from ..tasks.scan_tasks import _run_pipeline
        summary = _run_pipeline(campaign_id)
        return {'status': 'done', 'campaign_id': campaign_id, 'summary': summary}


# ── Export ────────────────────────────────────────────────────────────────────

@router.get('/{campaign_id}/export', dependencies=[Depends(verify_premium_security)])
@limiter.limit(SCAN_LIMIT)
async def export_campaign(request: Request, campaign_id: int, db: Session = Depends(get_db)):
    campaign = _get_or_404(campaign_id, db)
    properties = db.query(ScanProperty).filter(ScanProperty.campaign_id == campaign_id).all()

    rows = []
    for p in properties:
        result = db.query(ScanResult).filter(ScanResult.property_id == p.id).first()
        row: dict = {
            'parcel_id': p.parcel_id or '',
            'address': p.address,
            'city': p.city or '',
            'state': p.state or '',
            'zip_code': p.zip_code or '',
            'owner_name': p.owner_name or '',
            'roof': result.roof_condition if result else '',
            'driveway': result.driveway_condition if result else '',
            'drainage': result.drainage_condition if result else '',
            'overall_score': result.overall_score if result else '',
            'service_recommended': result.service_type if result else '',
            'sqft': result.estimated_sqft if result else '',
            'estimate_low': result.estimate_low if result else '',
            'estimate_high': result.estimate_high if result else '',
            'mailer_sent': bool(result and result.lob_letter_id),
            'lob_id': (result.lob_letter_id if result else '') or '',
            'mailer_html': (result.mailer_html if result else '') or '',
        }
        rows.append(row)

    zip_bytes = export_campaign_zip(rows)
    return Response(
        content=zip_bytes,
        media_type='application/zip',
        headers={'Content-Disposition': f'attachment; filename=campaign_{campaign_id}_{campaign.zip_code}.zip'},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(campaign_id: int, db: Session) -> ScanCampaign:
    c = db.query(ScanCampaign).filter(ScanCampaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail='Campaign not found.')
    return c


def _serialize_campaign(c: ScanCampaign) -> dict:
    return {
        'id': c.id,
        'zip_code': c.zip_code,
        'label': c.label,
        'status': c.status,
        'max_properties': c.max_properties,
        'auto_mail': c.auto_mail,
        'total_properties': c.total_properties,
        'scanned': c.scanned,
        'mailed': c.mailed,
        'created_at': c.created_at.isoformat() if c.created_at else None,
        'completed_at': c.completed_at.isoformat() if c.completed_at else None,
    }


def _serialize_property(p: ScanProperty, r: ScanResult | None) -> dict:
    return {
        'id': p.id,
        'parcel_id': p.parcel_id,
        'address': p.address,
        'city': p.city,
        'state': p.state,
        'zip_code': p.zip_code,
        'owner_name': p.owner_name,
        'owner_type': p.owner_type,
        'land_use_code': p.land_use_code,
        'lot_size_sqft': p.lot_size_sqft,
        'year_built': p.year_built,
        'status': p.status,
        'result': {
            'roof': r.roof_condition,
            'driveway': r.driveway_condition,
            'drainage': r.drainage_condition,
            'overall_score': r.overall_score,
            'narrative': r.condition_narrative,
            'services_recommended': json.loads(r.services_recommended or '[]'),
            'service_type': r.service_type,
            'estimated_sqft': r.estimated_sqft,
            'estimate_low': r.estimate_low,
            'estimate_high': r.estimate_high,
            'mailer_sent': bool(r.lob_letter_id),
            'lob_id': r.lob_letter_id,
            'mailed_at': r.mailed_at.isoformat() if r.mailed_at else None,
        } if r else None,
    }
