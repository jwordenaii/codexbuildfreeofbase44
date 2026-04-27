"""
igrade.py — iGrade Engine REST router for JWordenAI.

Routes
──────
  GET    /api/v1/igrade/stats          — grade distribution, avg confidence, correction rates
  GET    /api/v1/igrade/logs           — recent GradeLog entries
  POST   /api/v1/igrade/sweep          — trigger self-correction analysis sweep
  GET    /api/v1/igrade/media          — list stored media files
  POST   /api/v1/igrade/media          — register a new media file
  DELETE /api/v1/igrade/media/{id}     — remove a media file record
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import GradeLog, MediaFile
from ..services.igrade_engine import get_grade_stats, run_self_correction_sweep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/igrade", tags=["igrade"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class MediaFileCreate(BaseModel):
    filename: str
    file_type: Optional[str] = None        # photo | blueprint | permit | contract | report | other
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    storage_url: Optional[str] = None
    storage_provider: Optional[str] = "local"
    linked_to_type: Optional[str] = None   # lead | project | customer | document
    linked_to_id: Optional[int] = None
    project_name: Optional[str] = None
    tags: Optional[str] = None
    ai_description: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _grade_log_dict(g: GradeLog) -> dict:
    return {
        "id": g.id,
        "decision_type": g.decision_type,
        "grade": g.grade,
        "input_summary": g.input_summary,
        "ai_engine": g.ai_engine,
        "confidence": round(g.confidence, 3),
        "was_corrected": bool(g.was_corrected),
        "correction_applied": bool(g.correction_applied),
        "processing_ms": g.processing_ms,
        "created_at": g.created_at.isoformat(),
    }


def _media_dict(m: MediaFile) -> dict:
    return {
        "id": m.id,
        "filename": m.filename,
        "file_type": m.file_type,
        "mime_type": m.mime_type,
        "file_size_bytes": m.file_size_bytes,
        "storage_url": m.storage_url,
        "storage_provider": m.storage_provider,
        "linked_to_type": m.linked_to_type,
        "linked_to_id": m.linked_to_id,
        "project_name": m.project_name,
        "tags": m.tags,
        "ai_description": m.ai_description,
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    }


# ── iGrade Stats ──────────────────────────────────────────────────────────────

@router.get("/stats", summary="iGrade performance statistics")
@limiter.limit("60/minute")
async def igrade_stats(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return grade distribution, average confidence, and correction rates."""
    stats = get_grade_stats(db=db)
    return {"status": "ok", **stats}


# ── Grade Logs ────────────────────────────────────────────────────────────────

@router.get("/logs", summary="List recent iGrade processing logs")
@limiter.limit("60/minute")
async def list_grade_logs(
    request: Request,
    grade: Optional[str] = Query(default=None, description="Filter by grade: A | B | C | D"),
    decision_type: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(GradeLog)
    if grade:
        q = q.filter(GradeLog.grade == grade.upper())
    if decision_type:
        q = q.filter(GradeLog.decision_type == decision_type)
    total = q.count()
    rows = q.order_by(GradeLog.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "logs": [_grade_log_dict(r) for r in rows]}


# ── Self-Correction Sweep ─────────────────────────────────────────────────────

@router.post("/sweep", summary="Run iGrade self-correction analysis sweep")
@limiter.limit("10/minute")
async def self_correction_sweep(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """
    Analyze recent corrections and GradeLog to surface knowledge improvement
    suggestions.  Does NOT automatically modify the knowledge base.
    """
    result = run_self_correction_sweep(db=db)
    return {"status": "complete", **result}


# ── Media File Registry ───────────────────────────────────────────────────────

@router.get("/media", summary="List registered media files")
@limiter.limit("60/minute")
async def list_media_files(
    request: Request,
    file_type: Optional[str] = Query(default=None),
    project_name: Optional[str] = Query(default=None),
    linked_to_type: Optional[str] = Query(default=None),
    linked_to_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    q = db.query(MediaFile)
    if file_type:
        q = q.filter(MediaFile.file_type == file_type)
    if project_name:
        q = q.filter(MediaFile.project_name.ilike(f"%{project_name}%"))
    if linked_to_type:
        q = q.filter(MediaFile.linked_to_type == linked_to_type)
    if linked_to_id is not None:
        q = q.filter(MediaFile.linked_to_id == linked_to_id)
    total = q.count()
    rows = q.order_by(MediaFile.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "files": [_media_dict(m) for m in rows]}


@router.post("/media", summary="Register a new media file")
@limiter.limit("60/minute")
async def create_media_file(
    request: Request,
    req: MediaFileCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = MediaFile(
        filename=req.filename,
        file_type=req.file_type,
        mime_type=req.mime_type,
        file_size_bytes=req.file_size_bytes,
        storage_url=req.storage_url,
        storage_provider=req.storage_provider or "local",
        linked_to_type=req.linked_to_type,
        linked_to_id=req.linked_to_id,
        project_name=req.project_name,
        tags=req.tags,
        ai_description=req.ai_description,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"status": "created", **_media_dict(m)}


@router.delete("/media/{file_id}", summary="Delete a media file record")
@limiter.limit("30/minute")
async def delete_media_file(
    request: Request,
    file_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    m = db.get(MediaFile, file_id)
    if not m:
        raise HTTPException(status_code=404, detail="Media file not found")
    db.delete(m)
    db.commit()
    return {"status": "deleted", "id": file_id}
