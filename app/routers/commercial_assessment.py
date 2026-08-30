"""
commercial_assessment.py — Commercial Asset Assessment endpoints.

For corporate clients with one or many pavement assets. Returns, per lot, a
treatment-option × timing decision matrix priced with the Worden oil-shield
band, plus a phased capital plan across a portfolio.

Routes:
  POST /api/v1/commercial/assess     — one lot → option × timing matrix
  POST /api/v1/commercial/portfolio  — many lots → roll-up + phased plan

Condition inputs (PCI, traffic, drainage, cracking) come from a field survey,
a drone scan, or imagery-derived analysis. Live aerial/satellite imagery and
Google historical "timeline" imagery are a separate billing-gated data source;
this endpoint scores whatever inputs it is given and never fabricates them.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..core.limiter import limiter
from ..services.commercial_assessment import Lot, assess_property, assess_portfolio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/commercial", tags=["commercial-assessment"])

_PAVEMENT_TYPES = {"residential_driveway", "commercial_parking_lot", "road"}
_TRAFFIC = {"low", "medium", "high", "heavy_truck"}
_DRAINAGE = {"good", "fair", "poor"}
_CRACK = {"none", "low", "medium", "high"}


class LotIn(BaseModel):
    label: str = Field(..., max_length=200)
    area_sqft: float = Field(..., gt=0, le=20_000_000)
    pavement_type: str = Field(default="commercial_parking_lot", max_length=40)
    age_years: float = Field(default=10.0, ge=0, le=80)
    current_pci: Optional[float] = Field(default=None, ge=0, le=100)
    traffic_level: str = Field(default="medium", max_length=30)
    drainage_quality: str = Field(default="fair", max_length=30)
    crack_severity: str = Field(default="low", max_length=30)
    site_id: Optional[str] = Field(default=None, max_length=100)

    def to_lot(self) -> Lot:
        return Lot(
            label=self.label,
            area_sqft=self.area_sqft,
            pavement_type=self.pavement_type if self.pavement_type in _PAVEMENT_TYPES else "commercial_parking_lot",
            age_years=self.age_years,
            current_pci=self.current_pci,
            traffic_level=self.traffic_level if self.traffic_level in _TRAFFIC else "medium",
            drainage_quality=self.drainage_quality if self.drainage_quality in _DRAINAGE else "fair",
            crack_severity=self.crack_severity if self.crack_severity in _CRACK else "low",
            site_id=self.site_id,
        )


class PortfolioIn(BaseModel):
    client_name: Optional[str] = Field(default=None, max_length=200)
    lots: list[LotIn] = Field(..., min_length=1, max_length=500)
    annual_budget: Optional[float] = Field(default=None, ge=0, le=1_000_000_000)


@router.post("/assess")
@limiter.limit("30/minute")
def assess_one(payload: LotIn, request: Request):
    """Assess a single commercial lot into an option × timing matrix."""
    result = assess_property(payload.to_lot())
    return {"status": "ok", **result}


@router.post("/portfolio")
@limiter.limit("10/minute")
def assess_many(payload: PortfolioIn, request: Request):
    """Assess a corporate client's whole portfolio and phase the capital plan."""
    result = assess_portfolio(
        [lot.to_lot() for lot in payload.lots],
        annual_budget=payload.annual_budget,
    )
    return {"status": "ok", "client_name": payload.client_name, **result}
