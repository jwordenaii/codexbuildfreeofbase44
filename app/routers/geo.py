"""
Geospatial API router — Richmond Grid & site management.

Endpoints:
  GET  /api/v1/geo/sites                 — list all project sites
  POST /api/v1/geo/sites                 — create a new project site
  GET  /api/v1/geo/sites/{site_id}       — get site details (with GeoJSON polygon)
  PUT  /api/v1/geo/sites/{site_id}       — update site (e.g. after drawing a polygon)
  GET  /api/v1/geo/permit-leads          — list scraped permit leads (with optional filters)
  POST /api/v1/geo/permit-leads/scrape   — trigger an async Virginia LIS scrape via Celery
  GET  /api/v1/geo/radius-query          — find sites/leads within N miles of a coordinate
  GET  /api/v1/geo/trucks                — list live truck positions for the dashboard
  POST /api/v1/geo/trucks/{truck_id}     — upsert a truck position ping

PostGIS spatial queries:
  Radius queries use the Haversine formula on Float lat/lng columns.
  For sub-second performance on large datasets, run the PostGIS migration
  (db/migrations/001_add_postgis_geometry.sql) to add native GEOMETRY
  columns + GIST indexes to project_sites and permit_leads.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..database import get_db
from ..models import PermitLead, ProjectSite, TruckPosition
from ..schemas.permit_lead import PermitLeadOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/geo", tags=["geo"])

# ── Default service area (Richmond, VA) ───────────────────────────────────────
_RICHMOND_LAT = 37.5407
_RICHMOND_LNG = -77.4360
_DEFAULT_RADIUS_MILES = 20.0


# ── Pydantic request/response models ─────────────────────────────────────────

class ProjectSiteIn(BaseModel):
    model_config = {"str_strip_whitespace": True}

    name: str = Field(..., min_length=1, max_length=200)
    address: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default="VA", max_length=2)
    status: str = Field(default="active", max_length=30)
    service_type: Optional[str] = Field(default=None, max_length=60)
    project_size_sqft: Optional[float] = Field(default=None, ge=0)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    service_radius_miles: Optional[float] = Field(default=20.0, ge=0, le=200)
    geometry_json: Optional[str] = Field(default=None, description="GeoJSON FeatureCollection string from leaflet-draw")
    area_sqft: Optional[float] = Field(default=None, ge=0)
    perimeter_ft: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=5000)


class ProjectSiteOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    status: str
    service_type: Optional[str]
    project_size_sqft: Optional[float]
    lat: Optional[float]
    lng: Optional[float]
    service_radius_miles: Optional[float]
    geometry_json: Optional[str]
    area_sqft: Optional[float]
    perimeter_ft: Optional[float]
    notes: Optional[str]


class TruckPingIn(BaseModel):
    model_config = {"str_strip_whitespace": True}

    driver_name: Optional[str] = Field(default=None, max_length=120)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    speed_mph: Optional[float] = Field(default=None, ge=0, le=200)
    heading_deg: Optional[float] = Field(default=None, ge=0, le=360)
    asphalt_temp_f: Optional[float] = Field(default=None, ge=0, le=600)
    mix_type: Optional[str] = Field(default=None, max_length=60, description="HMA/WMA mix or job mix formula label")
    plant_departed_at: Optional[str] = Field(default=None, max_length=40, description="ISO timestamp when the load left the plant")
    target_delivery_temp_f: Optional[float] = Field(default=None, ge=0, le=600)
    estimated_arrival_minutes: Optional[float] = Field(default=None, ge=0, le=24 * 60)
    status: Optional[str] = Field(default="en_route", max_length=30)
    site_id: Optional[int] = None


class TruckOut(BaseModel):
    model_config = {"from_attributes": True}

    truck_id: str
    driver_name: Optional[str]
    lat: float
    lng: float
    speed_mph: Optional[float]
    heading_deg: Optional[float]
    asphalt_temp_f: Optional[float]
    mix_type: Optional[str]
    plant_departed_at: Optional[datetime]
    target_delivery_temp_f: Optional[float]
    estimated_arrival_minutes: Optional[float]
    status: Optional[str]
    site_id: Optional[int]
    updated_at: Optional[datetime] = None


# ── Helper: Haversine distance (miles) ───────────────────────────────────────

def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in miles between two WGS84 coordinates."""
    R = 3_958.8   # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _parse_optional_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid datetime: {value}. Use ISO 8601 format, e.g. 2026-04-28T21:30:00Z.",
        ) from exc


# ── Project Sites ─────────────────────────────────────────────────────────────

@router.get("/sites", response_model=List[ProjectSiteOut], summary="List all project sites")
def list_sites(
    status: Optional[str] = Query(default=None, description="Filter by status: active | completed | pending"),
    db: Session = Depends(get_db),
):
    q = db.query(ProjectSite)
    if status:
        q = q.filter(ProjectSite.status == status)
    return q.order_by(ProjectSite.created_at.desc()).all()


@router.post("/sites", response_model=ProjectSiteOut, status_code=201, summary="Create a new project site")
@limiter.limit("30/minute")
def create_site(
    request: Request,
    site_in: ProjectSiteIn,
    db: Session = Depends(get_db),
):
    # Validate geometry_json if provided
    if site_in.geometry_json:
        try:
            json.loads(site_in.geometry_json)
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail=f"geometry_json is not valid JSON: {exc}") from exc

    site = ProjectSite(**site_in.model_dump())
    db.add(site)
    db.commit()
    db.refresh(site)
    logger.info("Created project site id=%d name=%s", site.id, site.name)
    return site


@router.get("/sites/{site_id}", response_model=ProjectSiteOut, summary="Get project site by ID")
def get_site(site_id: int, db: Session = Depends(get_db)):
    site = db.query(ProjectSite).filter(ProjectSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Project site {site_id} not found")
    return site


@router.put("/sites/{site_id}", response_model=ProjectSiteOut, summary="Update project site (e.g. save drawn polygon)")
@limiter.limit("30/minute")
def update_site(
    site_id: int,
    request: Request,
    site_in: ProjectSiteIn,
    db: Session = Depends(get_db),
):
    site = db.query(ProjectSite).filter(ProjectSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Project site {site_id} not found")

    if site_in.geometry_json:
        try:
            json.loads(site_in.geometry_json)
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail=f"geometry_json is not valid JSON: {exc}") from exc

    for field, value in site_in.model_dump(exclude_unset=True).items():
        setattr(site, field, value)

    db.commit()
    db.refresh(site)
    logger.info("Updated project site id=%d", site.id)
    return site


# ── Permit Leads ──────────────────────────────────────────────────────────────

@router.get("/permit-leads", response_model=List[PermitLeadOut], summary="List scraped permit leads")
def list_permit_leads(
    label: Optional[str] = Query(default=None, description="Filter by priority label: HOT | WARM | COOL"),
    state: Optional[str] = Query(default=None, max_length=2, description="Filter by state code"),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(PermitLead)
    if label:
        q = q.filter(PermitLead.priority_label == label.upper())
    if state:
        q = q.filter(PermitLead.property_state == state.upper())
    return q.order_by(PermitLead.priority_score.desc()).limit(limit).all()


@router.post("/permit-leads/scrape", summary="Trigger async Virginia LIS scrape (Celery)")
@limiter.limit("5/minute")
def trigger_scrape(
    request: Request,
    background_tasks: BackgroundTasks,
    max_pages: int = Query(default=5, ge=1, le=50, description="Max pages to scrape per run"),
):
    """
    Enqueue a Virginia LIS permit scrape task.

    If Celery/Redis is available, the task runs asynchronously in a worker.
    Falls back to a synchronous background task if Celery is not configured.
    """
    try:
        from ..tasks.scraper import scrape_virginia_lis
        task = scrape_virginia_lis.delay(max_pages=max_pages)
        return {
            "status": "queued",
            "task_id": task.id,
            "message": f"Scraping up to {max_pages} pages of Virginia LIS permits in the background.",
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Celery not available, running scrape in background task: %s", exc)

        def _sync_scrape():
            from ..tasks.scraper import scrape_virginia_lis as fn
            fn(max_pages=max_pages)

        background_tasks.add_task(_sync_scrape)
        return {
            "status": "background",
            "message": f"Scraping {max_pages} pages of Virginia LIS permits in the background (sync fallback).",
        }


# ── Radius Query ──────────────────────────────────────────────────────────────

@router.get("/radius-query", summary="Find sites and permit leads within a radius")
def radius_query(
    lat: float = Query(default=_RICHMOND_LAT, ge=-90, le=90),
    lng: float = Query(default=_RICHMOND_LNG, ge=-180, le=180),
    radius_miles: float = Query(default=_DEFAULT_RADIUS_MILES, ge=0.1, le=500),
    db: Session = Depends(get_db),
):
    """
    Find all project sites and permit leads within ``radius_miles`` of (lat, lng).

    Uses Python-side Haversine filtering on Float columns.  In production
    with PostGIS enabled, replace with a ST_DWithin spatial query for
    index-accelerated sub-second performance at scale.
    """
    all_sites = db.query(ProjectSite).filter(
        ProjectSite.lat.isnot(None),
        ProjectSite.lng.isnot(None),
    ).all()

    nearby_sites = [
        {
            "id": s.id,
            "name": s.name,
            "lat": s.lat,
            "lng": s.lng,
            "status": s.status,
            "distance_miles": round(_haversine_miles(lat, lng, s.lat, s.lng), 2),
        }
        for s in all_sites
        if _haversine_miles(lat, lng, s.lat, s.lng) <= radius_miles
    ]

    all_leads = db.query(PermitLead).filter(
        PermitLead.lat.isnot(None),
        PermitLead.lng.isnot(None),
    ).all()

    nearby_leads = [
        {
            "id": pl.id,
            "address": pl.property_address,
            "permit_type": pl.permit_type,
            "priority_label": pl.priority_label,
            "lat": pl.lat,
            "lng": pl.lng,
            "distance_miles": round(_haversine_miles(lat, lng, pl.lat, pl.lng), 2),
        }
        for pl in all_leads
        if _haversine_miles(lat, lng, pl.lat, pl.lng) <= radius_miles
    ]

    nearby_sites.sort(key=lambda x: x["distance_miles"])
    nearby_leads.sort(key=lambda x: x["distance_miles"])

    return {
        "center": {"lat": lat, "lng": lng},
        "radius_miles": radius_miles,
        "sites": nearby_sites,
        "permit_leads": nearby_leads,
        "total_sites": len(nearby_sites),
        "total_leads": len(nearby_leads),
    }


# ── Truck Positions ───────────────────────────────────────────────────────────

@router.get("/trucks", response_model=List[TruckOut], summary="List live truck positions")
def list_trucks(db: Session = Depends(get_db)):
    return db.query(TruckPosition).order_by(TruckPosition.truck_id).all()


@router.post("/trucks/{truck_id}", response_model=TruckOut, summary="Upsert truck position ping")
@limiter.limit("120/minute")
def upsert_truck(
    truck_id: str,
    request: Request,
    ping: TruckPingIn,
    db: Session = Depends(get_db),
):
    truck = db.query(TruckPosition).filter(TruckPosition.truck_id == truck_id).first()
    data = ping.model_dump(exclude_unset=True)
    if "plant_departed_at" in data:
        data["plant_departed_at"] = _parse_optional_dt(data["plant_departed_at"])
    if truck:
        for field, value in data.items():
            setattr(truck, field, value)
    else:
        truck = TruckPosition(truck_id=truck_id, **data)
        db.add(truck)

    db.commit()
    db.refresh(truck)
    return truck
