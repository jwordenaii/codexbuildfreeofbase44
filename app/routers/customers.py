"""
customers.py — Customer Intelligence Platform router.

Endpoints
─────────
POST   /api/v1/customers/               Create a single customer record
GET    /api/v1/customers/               List customers (filterable by state, type)
GET    /api/v1/customers/{id}           Get a single customer
PATCH  /api/v1/customers/{id}           Update a customer
POST   /api/v1/customers/import         Bulk import from JSON or CSV
GET    /api/v1/customers/{id}/history   Get service history for a customer
POST   /api/v1/customers/{id}/history   Add a service history entry
GET    /api/v1/customers/stats/overview Overall CRM stats

All write endpoints require the premium security header.
List/GET endpoints require auth to protect customer PII.

When Mr. Worden is ready to integrate existing customer databases,
use the /import endpoint with CSV or JSON — field mapping is flexible.
"""

import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import Customer, ServiceHistory
from ..services.state_data import STATE_MAP

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/customers", tags=["customers"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name:          str            = Field(..., min_length=1, max_length=120)
    email:         Optional[str]  = Field(default=None, max_length=254)
    phone:         Optional[str]  = Field(default=None, max_length=30)
    company:       Optional[str]  = Field(default=None, max_length=120)
    address:       Optional[str]  = Field(default=None, max_length=300)
    city:          Optional[str]  = Field(default=None, max_length=100)
    state_code:    Optional[str]  = Field(default=None, max_length=2)
    zip_code:      Optional[str]  = Field(default=None, max_length=10)
    customer_type: Optional[str]  = Field(default=None, max_length=30)
    is_franchise:  int            = Field(default=0, ge=0, le=1)
    brand:         Optional[str]  = Field(default=None, max_length=60)
    notes:         Optional[str]  = Field(default=None, max_length=2000)
    tags:          Optional[str]  = Field(default=None, max_length=500)
    external_id:   Optional[str]  = Field(default=None, max_length=100)
    source:        Optional[str]  = Field(default="manual", max_length=60)


class CustomerOut(BaseModel):
    id:            int
    name:          str
    email:         Optional[str]
    phone:         Optional[str]
    company:       Optional[str]
    state_code:    Optional[str]
    city:          Optional[str]
    customer_type: Optional[str]
    is_franchise:  int
    brand:         Optional[str]
    total_jobs:    int
    total_revenue: float
    ltv_score:     Optional[float]
    churn_risk:    Optional[str]
    created_at:    datetime

    class Config:
        from_attributes = True


class ServiceHistoryCreate(BaseModel):
    job_date:        Optional[datetime] = None
    service_type:    Optional[str]      = Field(default=None, max_length=60)
    scope_summary:   Optional[str]      = None
    location:        Optional[str]      = Field(default=None, max_length=300)
    state_code:      Optional[str]      = Field(default=None, max_length=2)
    sqft:            Optional[float]    = Field(default=None, ge=0)
    revenue:         Optional[float]    = Field(default=None, ge=0)
    is_qsr:          int                = Field(default=0, ge=0, le=1)
    brand:           Optional[str]      = Field(default=None, max_length=60)
    warranty_callback: int              = Field(default=0, ge=0, le=1)
    gc_score:        Optional[float]    = Field(default=None, ge=0, le=5)
    has_photos:      int                = Field(default=0, ge=0, le=1)
    dropbox_url:     Optional[str]      = Field(default=None, max_length=500)
    photos_url:      Optional[str]      = Field(default=None, max_length=500)
    notes:           Optional[str]      = None


class ImportResult(BaseModel):
    imported:  int
    skipped:   int
    errors:    List[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_state(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    upper = code.strip().upper()
    return upper if upper in STATE_MAP else None


# ── CRUD endpoints ────────────────────────────────────────────────────────────

@router.post("", summary="Create a customer record", response_model=CustomerOut)
@limiter.limit("30/minute")
async def create_customer(
    request: Request,
    body: CustomerCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    c = Customer(
        **body.model_dump(exclude={"state_code"}),
        state_code=_validate_state(body.state_code),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("", summary="List customers")
@limiter.limit("60/minute")
async def list_customers(
    request:       Request,
    state_code:    Optional[str] = Query(default=None),
    customer_type: Optional[str] = Query(default=None),
    is_franchise:  Optional[int] = Query(default=None),
    search:        Optional[str] = Query(default=None, max_length=100),
    limit:         int           = Query(default=50, ge=1, le=200),
    offset:        int           = Query(default=0,  ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(Customer)
    if state_code:
        q = q.filter(Customer.state_code == state_code.upper())
    if customer_type:
        q = q.filter(Customer.customer_type == customer_type)
    if is_franchise is not None:
        q = q.filter(Customer.is_franchise == is_franchise)
    if search:
        like = f"%{search}%"
        q = q.filter(
            Customer.name.ilike(like)
            | Customer.email.ilike(like)
            | Customer.company.ilike(like)
        )
    total = q.count()
    items = q.order_by(Customer.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "offset": offset, "limit": limit, "items": items}


@router.get("/stats/overview", summary="CRM statistics overview")
async def customer_stats(
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    total      = db.query(Customer).count()
    franchise  = db.query(Customer).filter(Customer.is_franchise == 1).count()
    states     = db.query(Customer.state_code).distinct().count()
    jobs_total = db.query(ServiceHistory).count()
    rev_total  = db.query(Customer).with_entities(
        __import__("sqlalchemy", fromlist=["func"]).func.sum(Customer.total_revenue)
    ).scalar() or 0.0
    return {
        "total_customers": total,
        "franchise_accounts": franchise,
        "states_represented": states,
        "total_jobs_on_record": jobs_total,
        "total_revenue_on_record": round(float(rev_total), 2),
    }


@router.get("/{customer_id}", summary="Get a customer", response_model=CustomerOut)
async def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    return c


@router.patch("/{customer_id}", summary="Update a customer")
async def update_customer(
    customer_id: int,
    body: CustomerCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "state_code":
            v = _validate_state(v)
        setattr(c, k, v)
    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return c


# ── Service history ────────────────────────────────────────────────────────────

@router.get("/{customer_id}/history", summary="Get service history for a customer")
async def get_service_history(
    customer_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    items = (
        db.query(ServiceHistory)
        .filter(ServiceHistory.customer_id == customer_id)
        .order_by(ServiceHistory.job_date.desc())
        .all()
    )
    return {"customer_id": customer_id, "jobs": len(items), "history": items}


@router.post("/{customer_id}/history", summary="Add a service history entry")
async def add_service_history(
    customer_id: int,
    body: ServiceHistoryCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")

    entry = ServiceHistory(
        customer_id=customer_id,
        **body.model_dump(exclude={"state_code"}),
        state_code=_validate_state(body.state_code),
    )
    db.add(entry)

    # Update customer aggregates
    c.total_jobs += 1
    if body.revenue:
        c.total_revenue += body.revenue
    c.last_job_date = body.job_date or datetime.now(timezone.utc)
    c.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(entry)
    return entry


# ── Bulk import ────────────────────────────────────────────────────────────────

@router.post("/import", summary="Bulk import customers from JSON or CSV", response_model=ImportResult)
@limiter.limit("5/minute")
async def import_customers(
    request: Request,
    file: UploadFile = File(...),
    source: str = Query(default="import_csv", max_length=60),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Import customers from:
      - JSON array: [{name, email, phone, state_code, ...}, ...]
      - CSV with header row matching CustomerCreate fields

    Existing customers matched on email are skipped (no duplicates).
    The ``source`` query param is recorded on every imported record.
    """
    content = await file.read()
    errors: list[str] = []
    imported = 0
    skipped  = 0

    # Determine format
    filename = (file.filename or "").lower()
    is_csv   = filename.endswith(".csv") or file.content_type == "text/csv"

    try:
        if is_csv:
            rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
        else:
            rows = json.loads(content.decode("utf-8"))
            if not isinstance(rows, list):
                raise ValueError("JSON must be an array of customer objects")
    except Exception as exc:
        raise HTTPException(422, f"Could not parse file: {exc}") from exc

    existing_emails: set[str] = {
        e for (e,) in db.query(Customer.email).filter(Customer.email.isnot(None)).all()
    }

    for i, row in enumerate(rows):
        try:
            name = (row.get("name") or row.get("Name") or "").strip()
            if not name:
                skipped += 1
                continue

            email = (row.get("email") or row.get("Email") or "").strip().lower() or None
            if email and email in existing_emails:
                skipped += 1
                continue

            c = Customer(
                name          = name,
                email         = email,
                phone         = (row.get("phone") or row.get("Phone") or "").strip() or None,
                company       = (row.get("company") or "").strip() or None,
                address       = (row.get("address") or "").strip() or None,
                city          = (row.get("city") or "").strip() or None,
                state_code    = _validate_state(row.get("state_code") or row.get("state")),
                zip_code      = (row.get("zip_code") or row.get("zip") or "").strip() or None,
                customer_type = (row.get("customer_type") or "").strip() or None,
                is_franchise  = int(row.get("is_franchise") or 0),
                brand         = (row.get("brand") or "").strip() or None,
                notes         = (row.get("notes") or "").strip() or None,
                external_id   = (row.get("external_id") or row.get("id") or "").strip() or None,
                source        = source,
            )
            db.add(c)
            if email:
                existing_emails.add(email)
            imported += 1

            if imported % 100 == 0:
                db.flush()  # periodic flush for large imports

        except Exception as exc:  # noqa: BLE001
            errors.append(f"Row {i+1}: {exc}")
            skipped += 1

    db.commit()
    logger.info("Customer import: %d imported, %d skipped, %d errors", imported, skipped, len(errors))
    return ImportResult(imported=imported, skipped=skipped, errors=errors[:20])
