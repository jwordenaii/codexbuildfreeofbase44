"""
staff_router.py — Staff Portal API (Ship I).

Worker types: employee_ft | employee_pt | employee_temp | subcontractor | general_labor | cdl_driver

Staff endpoints (Bearer JWT):
    POST  /api/v1/staff/login
    GET   /api/v1/staff/me
    POST  /api/v1/staff/checkin        (multipart)
    GET   /api/v1/staff/checkins
    GET   /api/v1/staff/my-profile
    GET   /api/v1/staff/my-docs
    POST  /api/v1/staff/my-docs        (multipart)

Admin/Owner endpoints (HTTPBasic):
    GET   /api/v1/admin/staff/users
    POST  /api/v1/admin/staff/users
    GET   /api/v1/admin/staff/checkins
    GET   /api/v1/admin/staff/workers
    POST  /api/v1/admin/staff/workers
    GET   /api/v1/admin/staff/workers/{id}
    PATCH /api/v1/admin/staff/workers/{id}
    POST  /api/v1/admin/staff/workers/{id}/docs   (multipart)
    PATCH /api/v1/admin/staff/docs/{doc_id}
    GET   /api/v1/admin/staff/compliance
    GET   /api/v1/admin/staff/va-law
    GET   /api/v1/admin/staff/cdl-requirements
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPBasic, HTTPBasicCredentials, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import DailyCheckIn, StaffUser, WorkerDocument, WorkerProfile, STAFF_ROLES, WORKER_TYPES, WORKER_STATUS_VALUES
from ..services import staff_auth
from ..services.staff_compliance import (
    CDL_REQUIREMENTS,
    DOC_EXPIRY_REQUIRED,
    DOC_LABELS,
    REQUIRED_DOCS,
    VA_LABOR_LAW,
    WORKER_TYPE_LABELS,
    compliance_check,
)

from ..services import object_storage
from ..services.durable_storage import durable_data_dir

logger = logging.getLogger(__name__)

# ── storage ───────────────────────────────────────────────────────────────────
# These hold REAL uploaded files: staff check-in photos and signed worker
# compliance documents (I-9s, licences, certifications).
#
# They used to be written straight to disk. That looked durable but was not —
# jworden-api has no volume mounted, so the path resolved to /tmp and every
# redeploy destroyed them. Uploads now go to object storage, which is also the
# only correct answer for an app running two machines: both read and write the
# same bucket, whereas a volume attaches to one and diverges.
#
# object_storage falls back to local disk when no bucket is configured, so this
# behaves exactly as before until the bucket is attached — it just starts
# actually persisting once it is.
#
# Keys are derived from columns already on the row (user id / profile id /
# doc_type / filename), so nothing here needs a schema migration to find a
# file again later.
_PHOTO_PREFIX = "staff-photos"
_DOCS_PREFIX  = "staff-docs"

# Retained only so files written before the bucket existed can still be found
# and migrated up; nothing writes to these any more.
_PHOTO_PATH = Path(os.getenv("STAFF_PHOTO_PATH") or str(durable_data_dir() / "jworden_staff_photos"))
_DOCS_PATH  = Path(os.getenv("STAFF_DOCS_PATH")  or str(durable_data_dir() / "jworden_staff_docs"))


def photo_key(user_id: int, filename: str) -> str:
    return f"{_PHOTO_PREFIX}/{user_id}/{filename}"


def doc_key(profile_id: int, doc_type: str, filename: str) -> str:
    return f"{_DOCS_PREFIX}/{profile_id}/{doc_type}/{filename}"
_MAX_PHOTO  = int(os.getenv("STAFF_PHOTO_MAX_BYTES", str(25 * 1024 * 1024)))
_MAX_DOC    = int(os.getenv("STAFF_DOC_MAX_BYTES",   str(50 * 1024 * 1024)))
_PHOTO_CT   = {"image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"}
_DOC_CT     = {
    "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp",
    "application/pdf", "image/tiff",
}

_basic  = HTTPBasic()
_bearer = HTTPBearer(auto_error=False)


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _auth_disabled() -> bool:
    return os.getenv("AUTH_MODE", "required").strip().lower() in {"none", "off", "disabled", "0", "false"}


def _require_owner(credentials: HTTPBasicCredentials = Depends(_basic)) -> str:
    if _auth_disabled():
        return "auth_bypass"
    admin_user = os.getenv("ADMIN_USERNAME", "admin").encode()
    admin_pass = os.getenv("ADMIN_PASSWORD", "").encode()
    if not admin_pass:
        raise HTTPException(status_code=503, detail="Admin not configured.")
    u_ok = secrets.compare_digest(credentials.username.encode(), admin_user)
    p_ok = secrets.compare_digest(credentials.password.encode(), admin_pass)
    if not (u_ok and p_ok):
        raise HTTPException(status_code=401, detail="Bad credentials",
                            headers={"WWW-Authenticate": "Basic"})
    return credentials.username


def _require_staff(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
                   db: Session = Depends(_get_db)) -> StaffUser:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    payload = staff_auth.decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(StaffUser).filter(
        StaffUser.id == int(payload["sub"]), StaffUser.is_active == True
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def _safe_name(name: str) -> str:
    return "".join(c for c in Path(name or "file").name if c.isalnum() or c in "._-")[:200] or "file"


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _profile_dict(p: WorkerProfile) -> dict:
    return {
        "id": p.id,
        "staff_user_id": p.staff_user_id,
        "full_name": p.full_name,
        "worker_type": p.worker_type,
        "worker_type_label": WORKER_TYPE_LABELS.get(p.worker_type, p.worker_type),
        "pay_type": p.pay_type,
        "status": p.status,
        "hire_date": p.hire_date.isoformat() if p.hire_date else None,
        "phone": p.phone,
        "email": p.email,
        "address": p.address,
        "company_name": p.company_name,
        "ein": p.ein,
        "cdl_class": p.cdl_class,
        "cdl_number": p.cdl_number,
        "cdl_state": p.cdl_state,
        "cdl_expiry": p.cdl_expiry.isoformat() if p.cdl_expiry else None,
        "dot_medical_expiry": p.dot_medical_expiry.isoformat() if p.dot_medical_expiry else None,
        "fmcsa_clearinghouse_queried": p.fmcsa_clearinghouse_queried,
        "notes": p.notes,
        "created_at": p.created_at.isoformat(),
    }


def _doc_dict(d: WorkerDocument) -> dict:
    return {
        "id": d.id,
        "profile_id": d.profile_id,
        "doc_type": d.doc_type,
        "doc_label": DOC_LABELS.get(d.doc_type, d.doc_type),
        "filename": d.filename,
        "status": d.status,
        "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
        "needs_expiry": d.doc_type in DOC_EXPIRY_REQUIRED,
        "notes": d.notes,
        "uploaded_at": d.uploaded_at.isoformat(),
        "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
        "reviewed_by": d.reviewed_by,
    }


# ── routers ───────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/v1/staff", tags=["staff"])
admin_router = APIRouter(prefix="/api/v1/admin/staff", tags=["admin-staff"], include_in_schema=False)


# =============================================================================
# Staff-facing (Bearer JWT)
# =============================================================================

class LoginBody(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(_get_db)):
    user = db.query(StaffUser).filter(
        StaffUser.username == body.username, StaffUser.is_active == True
    ).first()
    if not user or not staff_auth.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="bad credentials")
    token = staff_auth.create_token(user.id, user.username, user.role)
    return {"token": token, "username": user.username, "role": user.role}


@router.get("/me")
def me(user: StaffUser = Depends(_require_staff)):
    return {"id": user.id, "username": user.username, "role": user.role}


@router.post("/checkin")
async def checkin(
    note: Optional[str] = Form(None),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None),
    photo: Optional[UploadFile] = File(None),
    user: StaffUser = Depends(_require_staff),
    db: Session = Depends(_get_db),
):
    photo_filename: Optional[str] = None
    if photo and photo.filename:
        ct = (photo.content_type or "").lower()
        if ct not in _PHOTO_CT:
            raise HTTPException(status_code=400, detail=f"photo type {ct} not allowed")
        body = await photo.read()
        if len(body) > _MAX_PHOTO:
            raise HTTPException(status_code=413, detail="photo too large")
        fname = f"{user.id}_{_safe_name(photo.filename)}"
        if not object_storage.put(photo_key(user.id, fname), body, ct):
            logger.warning(
                "staff check-in photo for user %s written to local disk — object "
                "storage is not configured, so it will be lost on redeploy",
                user.id,
            )
        photo_filename = fname
    ci = DailyCheckIn(user_id=user.id, note=note,
                      photo_filename=photo_filename, gps_lat=gps_lat, gps_lng=gps_lng)
    db.add(ci); db.commit(); db.refresh(ci)
    return {"ok": True, "id": ci.id, "checked_in_at": ci.checked_in_at.isoformat(),
            "photo": photo_filename}


@router.get("/checkins")
def my_checkins(user: StaffUser = Depends(_require_staff), db: Session = Depends(_get_db)):
    rows = db.query(DailyCheckIn).filter(DailyCheckIn.user_id == user.id)\
             .order_by(DailyCheckIn.checked_in_at.desc()).limit(50).all()
    return {"checkins": [
        {"id": r.id, "note": r.note, "gps_lat": r.gps_lat, "gps_lng": r.gps_lng,
         "photo": r.photo_filename, "checked_in_at": r.checked_in_at.isoformat()}
        for r in rows
    ]}


@router.get("/my-profile")
def my_profile(user: StaffUser = Depends(_require_staff), db: Session = Depends(_get_db)):
    p = db.query(WorkerProfile).filter(WorkerProfile.staff_user_id == user.id).first()
    if not p:
        return {"profile": None, "documents": [], "compliance": None, "required_docs": []}
    docs = db.query(WorkerDocument).filter(WorkerDocument.profile_id == p.id).all()
    doc_dicts = [_doc_dict(d) for d in docs]
    comp = compliance_check(p.worker_type, doc_dicts)
    return {
        "profile": _profile_dict(p),
        "documents": doc_dicts,
        "compliance": comp,
        "required_docs": [
            {"doc_type": dt, "label": DOC_LABELS.get(dt, dt), "needs_expiry": dt in DOC_EXPIRY_REQUIRED}
            for dt in REQUIRED_DOCS.get(p.worker_type, [])
        ],
    }


@router.get("/my-docs")
def my_docs(user: StaffUser = Depends(_require_staff), db: Session = Depends(_get_db)):
    p = db.query(WorkerProfile).filter(WorkerProfile.staff_user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="no worker profile linked — ask admin")
    docs = db.query(WorkerDocument).filter(WorkerDocument.profile_id == p.id).all()
    return {"documents": [_doc_dict(d) for d in docs]}


@router.post("/my-docs")
async def upload_my_doc(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    expiry_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    user: StaffUser = Depends(_require_staff),
    db: Session = Depends(_get_db),
):
    p = db.query(WorkerProfile).filter(WorkerProfile.staff_user_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="no worker profile — ask admin to create profile")
    if doc_type not in DOC_LABELS:
        raise HTTPException(status_code=400, detail=f"unknown doc_type: {doc_type!r}")
    ct = (file.content_type or "").lower()
    if ct not in _DOC_CT:
        raise HTTPException(status_code=400, detail=f"file type {ct!r} not accepted; use PDF or image")
    body = await file.read()
    if len(body) > _MAX_DOC:
        raise HTTPException(status_code=413, detail="file too large")
    fname = _safe_name(file.filename or doc_type)
    if not object_storage.put(doc_key(p.id, doc_type, fname), body, ct):
        logger.warning(
            "worker document %s/%s written to local disk — object storage is not "
            "configured, so this compliance file will be lost on redeploy",
            p.id, doc_type,
        )
    doc = WorkerDocument(profile_id=p.id, doc_type=doc_type, filename=fname,
                         status="pending", expiry_date=_parse_dt(expiry_date), notes=notes)
    db.add(doc); db.commit(); db.refresh(doc)
    return {"ok": True, "document": _doc_dict(doc)}


# =============================================================================
# Admin-facing (HTTPBasic)
# =============================================================================

# ── Staff user management ─────────────────────────────────────────────────────

class CreateUserBody(BaseModel):
    username: str
    password: str
    role: str = "field"


@admin_router.get("/users")
def list_users(_owner: str = Depends(_require_owner), db: Session = Depends(_get_db)):
    users = db.query(StaffUser).order_by(StaffUser.id).all()
    return {"users": [{"id": u.id, "username": u.username, "role": u.role,
                       "is_active": u.is_active, "created_at": u.created_at.isoformat()}
                      for u in users]}


@admin_router.post("/users")
def create_user(body: CreateUserBody, _owner: str = Depends(_require_owner),
                db: Session = Depends(_get_db)):
    if body.role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(STAFF_ROLES)}")
    if db.query(StaffUser).filter(StaffUser.username == body.username).first():
        raise HTTPException(status_code=409, detail="username already exists")
    user = StaffUser(username=body.username, role=body.role,
                     password_hash=staff_auth.hash_password(body.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"ok": True, "id": user.id, "username": user.username, "role": user.role}


@admin_router.get("/checkins")
def all_checkins(limit: int = 100, _owner: str = Depends(_require_owner),
                 db: Session = Depends(_get_db)):
    rows = db.query(DailyCheckIn).order_by(DailyCheckIn.checked_in_at.desc())\
             .limit(min(limit, 500)).all()
    return {"checkins": [
        {"id": r.id, "user_id": r.user_id, "note": r.note,
         "gps_lat": r.gps_lat, "gps_lng": r.gps_lng,
         "photo": r.photo_filename, "checked_in_at": r.checked_in_at.isoformat()}
        for r in rows
    ]}


# ── Worker profiles ───────────────────────────────────────────────────────────

class CreateWorkerBody(BaseModel):
    full_name: str
    worker_type: str
    pay_type: str = "w2"
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    ssn_last4: Optional[str] = None
    hire_date: Optional[str] = None
    company_name: Optional[str] = None
    ein: Optional[str] = None
    cdl_class: Optional[str] = None
    cdl_number: Optional[str] = None
    cdl_state: Optional[str] = None
    cdl_expiry: Optional[str] = None
    dot_medical_expiry: Optional[str] = None
    staff_user_id: Optional[int] = None
    notes: Optional[str] = None


class UpdateWorkerBody(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    hire_date: Optional[str] = None
    termination_date: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    cdl_expiry: Optional[str] = None
    dot_medical_expiry: Optional[str] = None
    fmcsa_clearinghouse_queried: Optional[bool] = None


@admin_router.get("/workers")
def list_workers(_owner: str = Depends(_require_owner), db: Session = Depends(_get_db)):
    workers = db.query(WorkerProfile).order_by(WorkerProfile.id).all()
    result = []
    for p in workers:
        docs = db.query(WorkerDocument).filter(WorkerDocument.profile_id == p.id).all()
        comp = compliance_check(p.worker_type, [_doc_dict(d) for d in docs])
        result.append({**_profile_dict(p), "compliance": comp})
    return {"workers": result}


@admin_router.post("/workers")
def create_worker(body: CreateWorkerBody, _owner: str = Depends(_require_owner),
                  db: Session = Depends(_get_db)):
    if body.worker_type not in WORKER_TYPES:
        raise HTTPException(status_code=400,
                            detail=f"worker_type must be one of {sorted(WORKER_TYPES)}")
    if body.pay_type not in {"w2", "1099"}:
        raise HTTPException(status_code=400, detail="pay_type must be w2 or 1099")
    if body.ssn_last4 and (len(body.ssn_last4) != 4 or not body.ssn_last4.isdigit()):
        raise HTTPException(status_code=400, detail="ssn_last4 must be exactly 4 digits")
    p = WorkerProfile(
        full_name=body.full_name, worker_type=body.worker_type,
        pay_type=body.pay_type, phone=body.phone, email=body.email,
        address=body.address, ssn_last4=body.ssn_last4,
        hire_date=_parse_dt(body.hire_date), company_name=body.company_name,
        ein=body.ein, cdl_class=body.cdl_class, cdl_number=body.cdl_number,
        cdl_state=body.cdl_state, cdl_expiry=_parse_dt(body.cdl_expiry),
        dot_medical_expiry=_parse_dt(body.dot_medical_expiry),
        staff_user_id=body.staff_user_id, notes=body.notes, status="pending_docs",
    )
    db.add(p); db.commit(); db.refresh(p)
    return {
        "ok": True,
        "profile": _profile_dict(p),
        "required_docs": [
            {"doc_type": dt, "label": DOC_LABELS.get(dt, dt), "needs_expiry": dt in DOC_EXPIRY_REQUIRED}
            for dt in REQUIRED_DOCS.get(p.worker_type, [])
        ],
    }


@admin_router.get("/workers/{profile_id}")
def get_worker(profile_id: int, _owner: str = Depends(_require_owner),
               db: Session = Depends(_get_db)):
    p = db.query(WorkerProfile).filter(WorkerProfile.id == profile_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="worker not found")
    docs = db.query(WorkerDocument).filter(WorkerDocument.profile_id == p.id).all()
    doc_dicts = [_doc_dict(d) for d in docs]
    comp = compliance_check(p.worker_type, doc_dicts)
    return {
        "profile": _profile_dict(p),
        "documents": doc_dicts,
        "compliance": comp,
        "required_docs": [
            {"doc_type": dt, "label": DOC_LABELS.get(dt, dt), "needs_expiry": dt in DOC_EXPIRY_REQUIRED}
            for dt in REQUIRED_DOCS.get(p.worker_type, [])
        ],
    }


@admin_router.patch("/workers/{profile_id}")
def update_worker(profile_id: int, body: UpdateWorkerBody,
                  _owner: str = Depends(_require_owner), db: Session = Depends(_get_db)):
    p = db.query(WorkerProfile).filter(WorkerProfile.id == profile_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="worker not found")
    if body.status is not None:
        if body.status not in WORKER_STATUS_VALUES:
            raise HTTPException(status_code=400, detail=f"invalid status: {body.status}")
        p.status = body.status
    if body.notes is not None: p.notes = body.notes
    if body.hire_date is not None: p.hire_date = _parse_dt(body.hire_date)
    if body.termination_date is not None: p.termination_date = _parse_dt(body.termination_date)
    if body.cdl_expiry is not None: p.cdl_expiry = _parse_dt(body.cdl_expiry)
    if body.dot_medical_expiry is not None: p.dot_medical_expiry = _parse_dt(body.dot_medical_expiry)
    if body.fmcsa_clearinghouse_queried is not None:
        p.fmcsa_clearinghouse_queried = body.fmcsa_clearinghouse_queried
    if body.phone is not None: p.phone = body.phone
    if body.email is not None: p.email = body.email
    if body.address is not None: p.address = body.address
    db.commit(); db.refresh(p)
    return {"ok": True, "profile": _profile_dict(p)}


@admin_router.post("/workers/{profile_id}/docs")
async def upload_worker_doc(
    profile_id: int,
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    expiry_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    _owner: str = Depends(_require_owner),
    db: Session = Depends(_get_db),
):
    p = db.query(WorkerProfile).filter(WorkerProfile.id == profile_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="worker not found")
    if doc_type not in DOC_LABELS:
        raise HTTPException(status_code=400, detail=f"unknown doc_type: {doc_type!r}")
    ct = (file.content_type or "").lower()
    if ct not in _DOC_CT:
        raise HTTPException(status_code=400, detail=f"file type {ct!r} not allowed; use PDF or image")
    body = await file.read()
    if len(body) > _MAX_DOC:
        raise HTTPException(status_code=413, detail="file too large")
    fname = _safe_name(file.filename or doc_type)
    if not object_storage.put(doc_key(profile_id, doc_type, fname), body, ct):
        logger.warning(
            "worker document %s/%s written to local disk — object storage is not "
            "configured, so this compliance file will be lost on redeploy",
            profile_id, doc_type,
        )
    doc = WorkerDocument(profile_id=profile_id, doc_type=doc_type, filename=fname,
                         status="pending", expiry_date=_parse_dt(expiry_date), notes=notes)
    db.add(doc); db.commit(); db.refresh(doc)
    return {"ok": True, "document": _doc_dict(doc)}


class ReviewDocBody(BaseModel):
    status: str   # approved | rejected | expired | pending
    notes: Optional[str] = None
    expiry_date: Optional[str] = None


@admin_router.patch("/docs/{doc_id}")
def review_doc(doc_id: int, body: ReviewDocBody,
               _owner: str = Depends(_require_owner), db: Session = Depends(_get_db)):
    doc = db.query(WorkerDocument).filter(WorkerDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="document not found")
    if body.status not in {"approved", "rejected", "expired", "pending"}:
        raise HTTPException(status_code=400, detail="status must be approved|rejected|expired|pending")
    doc.status = body.status
    doc.reviewed_at = datetime.now(timezone.utc)
    doc.reviewed_by = _owner
    if body.notes: doc.notes = body.notes
    if body.expiry_date: doc.expiry_date = _parse_dt(body.expiry_date)
    db.commit(); db.refresh(doc)
    return {"ok": True, "document": _doc_dict(doc)}


@admin_router.get("/compliance")
def compliance_dashboard(_owner: str = Depends(_require_owner), db: Session = Depends(_get_db)):
    workers = db.query(WorkerProfile).filter(
        WorkerProfile.status.in_(["active", "pending_docs"])
    ).all()
    flagged = []
    for p in workers:
        docs = db.query(WorkerDocument).filter(WorkerDocument.profile_id == p.id).all()
        comp = compliance_check(p.worker_type, [_doc_dict(d) for d in docs])
        if not comp["complete"]:
            flagged.append({"profile": _profile_dict(p), "compliance": comp})
    return {
        "total_active": len(workers),
        "flagged_count": len(flagged),
        "flagged": flagged,
    }


@admin_router.get("/va-law")
def va_law(_owner: str = Depends(_require_owner)):
    return {
        "va_labor_law": VA_LABOR_LAW,
        "worker_types": WORKER_TYPE_LABELS,
        "required_docs": REQUIRED_DOCS,
        "doc_labels": DOC_LABELS,
    }


@admin_router.get("/cdl-requirements")
def cdl_reqs(_owner: str = Depends(_require_owner)):
    return {"cdl_requirements": CDL_REQUIREMENTS}
