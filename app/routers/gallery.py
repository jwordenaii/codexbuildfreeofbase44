"""
gallery.py — Job photo gallery for J. Worden & Sons.

Endpoints:
  POST   /api/v1/gallery/upload           → upload a job photo (public)
  GET    /api/v1/gallery/images           → list all gallery images (public)
  DELETE /api/v1/gallery/images/{image_id} → delete an image (admin only)

Images are stored as base64 data URIs in the database so no external
storage service is required.  Uploads are limited to 10 MB per file.
"""

from __future__ import annotations

import base64
import logging
import uuid
from datetime import timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..core.security import verify_premium_security
from ..database import get_db
from ..models import GalleryImage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/gallery", tags=["gallery"])

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
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


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", summary="Upload a job photo")
async def upload_image(
    file: UploadFile = File(...),
    job_name: str = Form(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Accept a multipart image upload and store it as a base64 data URI.
    No authentication required — J can upload from the site directly.
    """
    # Validate MIME type
    mime = (file.content_type or "").lower()
    if mime not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{mime}'. Allowed: JPEG, PNG, WebP, GIF.",
        )

    # Read and size-check
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum upload size is 10 MB.",
        )

    # Encode to base64 data URI
    b64 = base64.b64encode(data).decode("utf-8")
    data_uri = f"data:{mime};base64,{b64}"

    image = GalleryImage(
        id=str(uuid.uuid4()),
        filename=file.filename or "upload.jpg",
        job_name=job_name.strip(),
        description=description.strip() if description else None,
        mime_type=mime,
        data_uri=data_uri,
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    logger.info("Gallery upload: id=%s job=%r filename=%r", image.id, image.job_name, image.filename)
    return {"status": "uploaded", "image": _serialize_image(image)}


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/images", summary="List all gallery images")
def list_images(db: Session = Depends(get_db)):
    """Return all gallery images ordered newest-first."""
    images = (
        db.query(GalleryImage)
        .order_by(GalleryImage.uploaded_at.desc())
        .all()
    )
    return {"images": [_serialize_image(img) for img in images]}


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/images/{image_id}", summary="Delete a gallery image (admin only)")
def delete_image(
    image_id: str,
    db: Session = Depends(get_db),
    security: dict = Depends(verify_premium_security),
):
    """Delete a gallery image by ID. Requires a valid bearer token."""
    image = db.query(GalleryImage).filter(GalleryImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found.")
    db.delete(image)
    db.commit()
    logger.info("Gallery delete: id=%s by user=%s", image_id, security.get("user"))
    return {"status": "deleted", "id": image_id}
