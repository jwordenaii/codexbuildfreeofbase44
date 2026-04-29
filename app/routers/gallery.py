"""
gallery.py — Job photo gallery for J. Worden & Sons Asphalt Paving.

Public endpoints:
  GET  /api/v1/gallery/images          — list all uploaded job photos
  POST /api/v1/gallery/upload          — upload a new job photo (multipart)

Admin endpoints (require bearer token):
  DELETE /api/v1/gallery/images/{image_id} — delete a photo

Images are stored as base64 data URIs in the database so no external
object-storage dependency is required for the initial deployment.
"""

from __future__ import annotations

import base64
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import GalleryImage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/gallery", tags=["gallery"])

# Maximum upload size: 10 MB
_MAX_FILE_BYTES = 10 * 1024 * 1024

_ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
}


def _serialize_image(img: GalleryImage) -> dict:
    return {
        "id":          img.id,
        "filename":    img.filename,
        "job_name":    img.job_name,
        "description": img.description,
        "mime_type":   img.mime_type,
        "url":         img.data_uri,
        "uploaded_at": img.uploaded_at.isoformat() if img.uploaded_at else None,
    }


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/images", summary="List all gallery images")
@limiter.limit("60/minute")
def list_images(request: Request, db: Session = Depends(get_db)):
    """Return all uploaded job photos, newest first."""
    images = (
        db.query(GalleryImage)
        .order_by(GalleryImage.uploaded_at.desc())
        .all()
    )
    return {
        "total":  len(images),
        "images": [_serialize_image(img) for img in images],
    }


@router.post("/upload", summary="Upload a job photo")
@limiter.limit("20/minute")
async def upload_image(
    request: Request,
    file: UploadFile = File(..., description="Image file (JPEG, PNG, WebP, GIF, HEIC)"),
    job_name: str = Form(..., min_length=1, max_length=200, description="Job name, e.g. 'KFC Parking Lot'"),
    description: Optional[str] = Form(default=None, max_length=1000, description="Optional description"),
    db: Session = Depends(get_db),
):
    """
    Upload a job photo.  Accepts multipart/form-data with:
      - file        — image file
      - job_name    — human-readable job name
      - description — optional description (max 1000 chars)
    """
    # Validate MIME type
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{content_type}'. Allowed: JPEG, PNG, WebP, GIF, HEIC.",
        )

    # Read and size-check
    raw = await file.read()
    if len(raw) > _MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(raw) // 1024} KB). Maximum is {_MAX_FILE_BYTES // 1024 // 1024} MB.",
        )

    # Encode as base64 data URI
    b64 = base64.b64encode(raw).decode("ascii")
    data_uri = f"data:{content_type};base64,{b64}"

    image = GalleryImage(
        id          = str(uuid.uuid4()),
        filename    = file.filename or "upload.jpg",
        job_name    = job_name.strip(),
        description = description.strip() if description else None,
        mime_type   = content_type,
        data_uri    = data_uri,
        uploaded_at = datetime.now(timezone.utc),
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    logger.info("Gallery image uploaded: id=%s job=%r filename=%r", image.id, image.job_name, image.filename)
    return {"status": "uploaded", "image": _serialize_image(image)}


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.delete("/images/{image_id}", summary="Delete a gallery image (admin)")
@limiter.limit("30/minute")
def delete_image(
    image_id: str,
    request: Request,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """Delete a gallery image by ID. Requires bearer token authentication."""
    image = db.query(GalleryImage).filter(GalleryImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    db.delete(image)
    db.commit()
    logger.info("Gallery image deleted: id=%s by user=%s", image_id, security.get("user"))
    return {"status": "deleted", "id": image_id}
