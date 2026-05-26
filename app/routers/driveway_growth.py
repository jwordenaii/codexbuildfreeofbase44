"""
driveway_growth.py — Legal-first driveway growth engine.

Implements a compliance-first Physical-to-Digital funnel:
- Property estimate preview
- Direct-mail campaign drafting
- Public opt-in gateway for explicit consent capture
"""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import DrivewayCampaignPiece, DrivewayOptIn
from ..schemas.driveway_growth import (
    DirectMailCampaignDraftRequest,
    DrivewayCvMaskEstimateRequest,
    DrivewayEstimatePreviewRequest,
    OptInRecord,
    OptInSubmissionRequest,
)
from ..services.math_ai_service import math_ai

router = APIRouter(prefix="/api/v1/driveway-growth", tags=["driveway-growth"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_opt_in_token(property_id: str, address: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.sha256(
        f"{property_id}|{address}|{salt}".encode("utf-8")
    ).hexdigest()
    return digest[:24]


def _sqft_from_mask(mask_pixel_count: int, gsd_sqft_per_pixel: float) -> float:
    return float(mask_pixel_count) * float(gsd_sqft_per_pixel)


def _next_unique_token(db: Session, property_id: str, address: str) -> str:
    for _ in range(8):
        token = _build_opt_in_token(property_id, address)
        exists = (
            db.query(DrivewayCampaignPiece.id)
            .filter(DrivewayCampaignPiece.token == token)
            .first()
        )
        if not exists:
            return token
    raise HTTPException(status_code=500, detail="Could not generate unique opt-in token")


@router.post(
    "/estimate-preview", summary="Compute driveway estimate preview from square footage"
)
@limiter.limit("60/minute")
async def estimate_preview(
    request: Request,
    payload: DrivewayEstimatePreviewRequest,
    _: dict = Depends(verify_premium_security),
):
    estimate = math_ai.estimate_project_cost(
        sqft=payload.sqft,
        service_type=payload.service_type,
        state=payload.state,
    )

    confidence = float(payload.confidence)
    calibrated_mid = int(
        round(float(estimate.get("mid_usd") or 0) * (0.9 + 0.2 * confidence))
    )

    return {
        "status": "ok",
        "project_id": payload.project_id,
        "address": payload.address,
        "imagery_source": payload.imagery_source,
        "sqft": payload.sqft,
        "confidence": confidence,
        "estimate": {
            "low_usd": int(estimate.get("low_usd") or calibrated_mid),
            "mid_usd": calibrated_mid,
            "high_usd": int(estimate.get("high_usd") or calibrated_mid),
            "service_type": payload.service_type,
            "state": payload.state,
        },
        "compliance": {
            "tos_mode": "api_only_no_scrape",
            "pii_mode": "no_unsolicited_email_or_sms",
            "required_opt_in": True,
        },
    }


@router.post(
    "/cv/mask-estimate",
    summary="Compute estimate from custom CV mask output and imagery GSD",
)
@limiter.limit("60/minute")
async def estimate_from_cv_mask(
    request: Request,
    payload: DrivewayCvMaskEstimateRequest,
    _: dict = Depends(verify_premium_security),
):
    driveway_sqft = _sqft_from_mask(
        payload.mask_pixel_count, payload.gsd_sqft_per_pixel
    )

    estimate = math_ai.estimate_project_cost(
        sqft=driveway_sqft,
        service_type=payload.service_type,
        state=payload.state,
    )

    confidence = float(payload.segmentation_confidence)
    calibrated_mid = int(
        round(float(estimate.get("mid_usd") or 0) * (0.9 + 0.2 * confidence))
    )

    return {
        "status": "ok",
        "project_id": payload.project_id,
        "address": payload.address,
        "model": {
            "name": payload.model_name,
            "version": payload.model_version,
            "imagery_source": payload.imagery_source,
        },
        "geometry": {
            "mask_pixel_count": payload.mask_pixel_count,
            "gsd_sqft_per_pixel": payload.gsd_sqft_per_pixel,
            "driveway_sqft": round(driveway_sqft, 2),
        },
        "confidence": confidence,
        "estimate": {
            "low_usd": int(estimate.get("low_usd") or calibrated_mid),
            "mid_usd": calibrated_mid,
            "high_usd": int(estimate.get("high_usd") or calibrated_mid),
            "service_type": payload.service_type,
            "state": payload.state,
        },
        "compliance": {
            "tos_mode": "api_only_no_scrape",
            "pii_mode": "no_unsolicited_email_or_sms",
            "required_opt_in": True,
        },
    }


@router.post(
    "/direct-mail/campaign-draft",
    summary="Create a direct-mail campaign draft with personalized opt-in URLs",
)
@limiter.limit("20/minute")
async def draft_direct_mail_campaign(
    request: Request,
    payload: DirectMailCampaignDraftRequest,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    _: dict = Depends(verify_premium_security),
):
    if idempotency_key:
        existing_piece = (
            db.query(DrivewayCampaignPiece)
            .filter(DrivewayCampaignPiece.idempotency_key == idempotency_key)
            .order_by(DrivewayCampaignPiece.created_at_utc.desc())
            .first()
        )
        if existing_piece is not None:
            piece_count = (
                db.query(DrivewayCampaignPiece)
                .filter(DrivewayCampaignPiece.campaign_id == existing_piece.campaign_id)
                .count()
            )
            return {
                "status": "ok",
                "campaign_id": existing_piece.campaign_id,
                "piece_count": piece_count,
                "sample_landing_url": existing_piece.landing_url,
                "created_at_utc": existing_piece.created_at_utc.isoformat(),
                "idempotent_replay": True,
            }

    campaign_id = f"dmail_{secrets.token_hex(6)}"
    created_at = _now_iso()

    pieces: list[DrivewayCampaignPiece] = []
    for target in payload.targets:
        token = _next_unique_token(db, target.property_id, target.address)
        landing_url = f"/driveway-estimate/{token}"
        pieces.append(
            DrivewayCampaignPiece(
                campaign_id=campaign_id,
                campaign_name=payload.campaign_name,
                source=payload.source,
                property_id=target.property_id,
                owner_name=target.owner_name,
                mailing_address=target.mailing_address,
                address=target.address,
                state=target.state,
                estimated_total_usd=target.estimated_total_usd,
                satellite_image_url=target.satellite_image_url,
                polygon_overlay_geojson=(
                    json.dumps(target.polygon_overlay_geojson)
                    if target.polygon_overlay_geojson is not None
                    else None
                ),
                token=token,
                landing_url=landing_url,
                qr_payload=landing_url,
                status="draft",
                idempotency_key=idempotency_key,
            )
        )
    for piece in pieces:
        db.add(piece)
    db.commit()

    return {
        "status": "ok",
        "campaign_id": campaign_id,
        "piece_count": len(pieces),
        "sample_landing_url": pieces[0].landing_url if pieces else None,
        "created_at_utc": created_at,
    }


@router.get("/opt-in/{token}", summary="Public landing payload for mailed estimate")
@limiter.limit("120/minute")
async def get_opt_in_landing(
    request: Request,
    token: str,
    db: Session = Depends(get_db),
):
    piece = (
        db.query(DrivewayCampaignPiece)
        .filter(DrivewayCampaignPiece.token == token)
        .first()
    )
    if piece is not None:
        return {
            "status": "ok",
            "token": token,
            "campaign_id": piece.campaign_id,
            "address": piece.address,
            "state": piece.state,
            "estimated_total_usd": piece.estimated_total_usd,
            "satellite_image_url": piece.satellite_image_url,
            "disclosure": "Estimate is automated and subject to on-site verification.",
        }

    raise HTTPException(status_code=404, detail="Estimate link not found")


@router.post(
    "/opt-in/{token}/submit",
    summary="Submit explicit consent and contact info from mailed landing page",
)
@limiter.limit("60/minute")
async def submit_opt_in(
    request: Request,
    token: str,
    payload: OptInSubmissionRequest,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    matched_piece = (
        db.query(DrivewayCampaignPiece)
        .filter(DrivewayCampaignPiece.token == token)
        .first()
    )

    if matched_piece is None:
        raise HTTPException(status_code=404, detail="Estimate link not found")

    if not payload.consent_email and not payload.consent_sms:
        raise HTTPException(
            status_code=400, detail="At least one contact consent channel is required"
        )

    if payload.consent_sms and not payload.consent_tcpa:
        raise HTTPException(
            status_code=400, detail="TCPA consent is required for SMS follow-up"
        )

    existing_opt_in = (
        db.query(DrivewayOptIn).filter(DrivewayOptIn.token == token).first()
    )
    if existing_opt_in is not None:
        same_payload = (
            existing_opt_in.full_name == payload.full_name
            and existing_opt_in.email == str(payload.email)
            and existing_opt_in.phone == payload.phone
            and existing_opt_in.consent_email == payload.consent_email
            and existing_opt_in.consent_sms == payload.consent_sms
            and existing_opt_in.consent_tcpa == payload.consent_tcpa
        )
        same_idempotency = bool(idempotency_key) and (
            existing_opt_in.idempotency_key == idempotency_key
        )
        if same_payload or same_idempotency:
            return {
                "status": "ok",
                "token": token,
                "property_id": existing_opt_in.property_id,
                "consent_email": existing_opt_in.consent_email,
                "consent_sms": existing_opt_in.consent_sms,
                "next_step": "schedule_site_verification",
                "idempotent_replay": True,
            }
        raise HTTPException(
            status_code=409,
            detail="Opt-in already submitted for this estimate link",
        )

    record = OptInRecord(
        token=token,
        property_id=matched_piece.property_id or "unknown",
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        consent_email=payload.consent_email,
        consent_sms=payload.consent_sms,
        consent_tcpa=payload.consent_tcpa,
        consent_timestamp_utc=payload.consent_timestamp_utc
        or datetime.now(timezone.utc),
    )
    db_record = DrivewayOptIn(
        token=record.token,
        property_id=record.property_id,
        full_name=record.full_name,
        email=str(record.email),
        phone=record.phone,
        consent_email=record.consent_email,
        consent_sms=record.consent_sms,
        consent_tcpa=record.consent_tcpa,
        consent_timestamp_utc=record.consent_timestamp_utc,
        source=record.source,
        idempotency_key=idempotency_key,
    )
    db.add(db_record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        duplicate_opt_in = (
            db.query(DrivewayOptIn).filter(DrivewayOptIn.token == token).first()
        )
        if duplicate_opt_in is not None:
            return {
                "status": "ok",
                "token": token,
                "property_id": duplicate_opt_in.property_id,
                "consent_email": duplicate_opt_in.consent_email,
                "consent_sms": duplicate_opt_in.consent_sms,
                "next_step": "schedule_site_verification",
                "idempotent_replay": True,
            }
        raise

    return {
        "status": "ok",
        "token": token,
        "property_id": record.property_id,
        "consent_email": record.consent_email,
        "consent_sms": record.consent_sms,
        "next_step": "schedule_site_verification",
    }
