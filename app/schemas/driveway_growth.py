"""
Schemas for driveway estimation growth pipeline.

Legal-first funnel:
- No scraped emails/phones
- Direct mail outreach
- Explicit owner opt-in before digital contact
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class DrivewayEstimatePreviewRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=128)
    address: str = Field(..., min_length=3, max_length=256)
    state: str = Field(default="US", min_length=2, max_length=2)
    service_type: Literal[
        "sealcoating", "paving", "crackfill", "maintenance", "driveway"
    ] = "sealcoating"
    imagery_source: Literal[
        "google_static_satellite", "nearmap", "eagleview", "other"
    ] = "google_static_satellite"
    sqft: float = Field(..., gt=50, le=200000)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)

    @field_validator("state")
    @classmethod
    def _upper_state(cls, value: str) -> str:
        return value.upper().strip()


class DrivewayCvMaskEstimateRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=128)
    address: str = Field(..., min_length=3, max_length=256)
    state: str = Field(default="US", min_length=2, max_length=2)
    service_type: Literal[
        "sealcoating", "paving", "crackfill", "maintenance", "driveway"
    ] = "sealcoating"
    model_name: str = Field(default="yolo11-seg", min_length=2, max_length=80)
    model_version: str = Field(default="v1", min_length=1, max_length=40)
    imagery_source: Literal["nearmap", "eagleview", "hexagon", "other"] = "other"
    mask_pixel_count: int = Field(..., ge=1, le=200_000_000)
    gsd_sqft_per_pixel: float = Field(..., gt=0.0, le=25.0)
    segmentation_confidence: float = Field(default=0.8, ge=0.0, le=1.0)

    @field_validator("state")
    @classmethod
    def _upper_state(cls, value: str) -> str:
        return value.upper().strip()


class DirectMailTarget(BaseModel):
    property_id: str = Field(..., min_length=1, max_length=128)
    address: str = Field(..., min_length=3, max_length=256)
    owner_name: str = Field(..., min_length=1, max_length=128)
    mailing_address: str = Field(..., min_length=3, max_length=256)
    state: str = Field(default="US", min_length=2, max_length=2)
    estimated_total_usd: int = Field(..., ge=50, le=500000)
    satellite_image_url: str | None = Field(default=None, max_length=1024)
    polygon_overlay_geojson: dict | None = None

    @field_validator("state")
    @classmethod
    def _upper_state(cls, value: str) -> str:
        return value.upper().strip()


class DirectMailCampaignDraftRequest(BaseModel):
    campaign_name: str = Field(..., min_length=3, max_length=120)
    source: Literal["county_assessor", "regrid", "datatree", "manual"] = "manual"
    targets: list[DirectMailTarget] = Field(
        default_factory=list, min_length=1, max_length=5000
    )


class OptInSubmissionRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=128)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=32)
    consent_email: bool = Field(default=False)
    consent_sms: bool = Field(default=False)
    consent_tcpa: bool = Field(default=False)
    consent_timestamp_utc: datetime | None = None


class OptInRecord(BaseModel):
    token: str
    property_id: str
    full_name: str
    email: EmailStr
    phone: str
    consent_email: bool
    consent_sms: bool
    consent_tcpa: bool
    consent_timestamp_utc: datetime
    source: str = "direct_mail_qr"
