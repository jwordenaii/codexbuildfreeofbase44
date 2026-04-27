"""
documents.py — Document intelligence upload and parsing endpoints for JWordenAI.

Routes:
  POST /api/v1/documents/parse-contract  — parse a contract PDF/image
  POST /api/v1/documents/parse-blueprint — parse a blueprint image
  POST /api/v1/documents/parse-permit    — parse a permit PDF

Max file size: 20 MB. Requires premium security.
"""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services.document_intelligence import parse_contract, parse_blueprint, parse_permit_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

_MAX_BYTES = 20 * 1024 * 1024  # 20 MB

_ALLOWED_CONTRACT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_ALLOWED_PDF_TYPES = {"application/pdf"}


@router.post("/parse-contract", summary="Parse a contract PDF or image")
@limiter.limit("10/minute")
async def parse_contract_endpoint(
    request: Request,
    file: UploadFile = File(...),
    _: dict = Depends(verify_premium_security),
):
    """
    Upload a contract PDF or image. Returns extracted key terms, deadlines,
    payment milestones, parties, scope of work, and risk flags.
    """
    if file.content_type not in _ALLOWED_CONTRACT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported type. Allowed: {', '.join(sorted(_ALLOWED_CONTRACT_TYPES))}",
        )

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")

    result = parse_contract(data, file.content_type)
    return {"status": "ok", "filename": file.filename, **result}


@router.post("/parse-blueprint", summary="Parse a blueprint image for sqft estimation")
@limiter.limit("10/minute")
async def parse_blueprint_endpoint(
    request: Request,
    file: UploadFile = File(...),
    _: dict = Depends(verify_premium_security),
):
    """
    Upload a blueprint or site plan image. Returns estimated square footage,
    dimensions, and relevant service keywords.
    """
    if file.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported type. Allowed: {', '.join(sorted(_ALLOWED_IMAGE_TYPES))}",
        )

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")

    result = parse_blueprint(data)
    return {"status": "ok", "filename": file.filename, **result}


@router.post("/parse-permit", summary="Parse a permit PDF for key details")
@limiter.limit("10/minute")
async def parse_permit_endpoint(
    request: Request,
    file: UploadFile = File(...),
    _: dict = Depends(verify_premium_security),
):
    """
    Upload a permit PDF. Returns permit number, address, expiry date,
    contractor info, and scope of approved work.
    """
    if file.content_type not in _ALLOWED_PDF_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported type. Only PDF files are accepted.",
        )

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")

    result = parse_permit_pdf(data)
    return {"status": "ok", "filename": file.filename, **result}
