"""
document_intelligence.py — AI-powered document parsing for JWordenAI.

Supports:
  - Contract PDF/image parsing (key terms, deadlines, payment milestones)
  - Blueprint image analysis (sqft estimation, dimensions)
  - Permit PDF parsing (permit number, address, expiry, contractor)

Uses GPT-4o Vision for images and GPT-4o text mode for extracted text.

Public API
──────────
  parse_contract(file_bytes, mime_type) → dict
  parse_blueprint(image_bytes) → dict
  parse_permit_pdf(file_bytes) → dict
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")


def _get_openai_client():
    if not _OPENAI_KEY:
        return None
    try:
        from openai import OpenAI  # type: ignore
        return OpenAI(api_key=_OPENAI_KEY)
    except ImportError:
        logger.warning("openai package not installed")
        return None


def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text from a PDF using PyPDF2 or pdfplumber if available."""
    try:
        import io
        try:
            import pdfplumber  # type: ignore
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                return "\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )[:10000]
        except ImportError:
            pass

        try:
            import PyPDF2  # type: ignore
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text[:10000]
        except ImportError:
            pass

        return "[PDF text extraction requires pdfplumber or PyPDF2]"
    except Exception as exc:  # noqa: BLE001
        logger.error("PDF text extraction error: %s", exc)
        return ""


def _gpt_json_call(client, system_prompt: str, user_content) -> dict:
    """Make a GPT call and parse JSON response."""
    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1000,
            temperature=0.2,
        )
        text = response.choices[0].message.content or "{}"
        if "```" in text:
            text = text.split("```")[1].lstrip("json").strip()
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("GPT JSON parse error: %s", exc)
        raw_snippet = ""
        try:
            raw_snippet = text[:500]
        except Exception:  # noqa: BLE001
            pass
        return {"error": "Could not parse GPT response as JSON", "raw": raw_snippet}
    except Exception as exc:  # noqa: BLE001
        logger.error("GPT call error: %s", exc)
        return {"error": "AI service temporarily unavailable"}


def parse_contract(file_bytes: bytes, mime_type: str) -> dict:
    """
    Parse a contract PDF or image using GPT-4o.

    Returns:
      {key_terms, deadlines, payment_milestones, scope_of_work, parties, risk_flags}
    """
    client = _get_openai_client()
    if not client:
        return _stub_contract()

    system_prompt = (
        "You are a construction contract analyst. Extract the following from the document "
        "and return as JSON with these exact keys: "
        "key_terms (list of important contractual terms), "
        "deadlines (list of {description, date}), "
        "payment_milestones (list of {description, amount, due_date}), "
        "scope_of_work (str summary), "
        "parties (list of party names and roles), "
        "risk_flags (list of concerning clauses or missing protections). "
        "Return only valid JSON, no markdown."
    )

    try:
        if mime_type in ("image/jpeg", "image/png", "image/webp"):
            b64 = base64.b64encode(file_bytes).decode()
            user_content = [
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
                {"type": "text", "text": "Extract contract information from this document."},
            ]
        else:
            # PDF — extract text first
            text = _extract_pdf_text(file_bytes)
            user_content = f"Extract contract information from this text:\n\n{text}"

        result = _gpt_json_call(client, system_prompt, user_content)
        result.setdefault("engine", "gpt-4o")
        return result
    except Exception as exc:  # noqa: BLE001
        logger.error("parse_contract error: %s", exc)
        return {**_stub_contract(), "error": str(exc)}


def parse_blueprint(image_bytes: bytes) -> dict:
    """
    Analyze a blueprint image using GPT-4o Vision.

    Returns:
      {estimated_sqft, dimensions, notes, service_keywords}
    """
    client = _get_openai_client()
    if not client:
        return _stub_blueprint()

    system_prompt = (
        "You are an expert construction estimator. Analyze this blueprint/site plan and return JSON with: "
        "estimated_sqft (float — your best estimate of the paving area), "
        "dimensions (list of {label, value} measurements you can identify), "
        "notes (str — key observations about the layout), "
        "service_keywords (list of relevant services: paving, sealcoating, parking_lot, driveway, etc.). "
        "Return only valid JSON, no markdown."
    )

    try:
        b64 = base64.b64encode(image_bytes).decode()
        # Try to detect mime type
        if image_bytes[:4] == b'\x89PNG':
            mime = "image/png"
        elif image_bytes[:2] == b'\xff\xd8':
            mime = "image/jpeg"
        else:
            mime = "image/png"

        user_content = [
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
            {"type": "text", "text": "Analyze this blueprint for paving/construction scope estimation."},
        ]
        result = _gpt_json_call(client, system_prompt, user_content)
        result.setdefault("engine", "gpt-4o-vision")
        return result
    except Exception as exc:  # noqa: BLE001
        logger.error("parse_blueprint error: %s", exc)
        return {**_stub_blueprint(), "error": str(exc)}


def parse_permit_pdf(file_bytes: bytes) -> dict:
    """
    Extract permit details from a PDF.

    Returns:
      {permit_number, address, permit_type, expiry_date, contractor, scope}
    """
    client = _get_openai_client()
    if not client:
        return _stub_permit()

    system_prompt = (
        "You are a building permit analyst. Extract the following from this permit document "
        "and return as JSON with exactly these keys: "
        "permit_number (str), address (str), permit_type (str), "
        "expiry_date (str, ISO format if possible), "
        "contractor (str), scope (str — description of approved work). "
        "Return only valid JSON, no markdown."
    )

    try:
        text = _extract_pdf_text(file_bytes)
        if not text.strip():
            return {**_stub_permit(), "error": "Could not extract text from PDF"}

        result = _gpt_json_call(client, system_prompt, f"Parse this permit:\n\n{text}")
        result.setdefault("engine", "gpt-4o")
        return result
    except Exception as exc:  # noqa: BLE001
        logger.error("parse_permit_pdf error: %s", exc)
        return {**_stub_permit(), "error": str(exc)}


# ── Stubs ─────────────────────────────────────────────────────────────────────

def _stub_contract() -> dict:
    return {
        "engine": "stub",
        "key_terms": ["Configure OPENAI_API_KEY for real contract parsing"],
        "deadlines": [],
        "payment_milestones": [],
        "scope_of_work": "Upload a contract document and configure OpenAI API key",
        "parties": [],
        "risk_flags": ["OpenAI not configured — manual review required"],
    }


def _stub_blueprint() -> dict:
    return {
        "engine": "stub",
        "estimated_sqft": 0,
        "dimensions": [],
        "notes": "Configure OPENAI_API_KEY for AI blueprint analysis",
        "service_keywords": [],
    }


def _stub_permit() -> dict:
    return {
        "engine": "stub",
        "permit_number": "N/A",
        "address": "N/A",
        "permit_type": "N/A",
        "expiry_date": "N/A",
        "contractor": "N/A",
        "scope": "Configure OPENAI_API_KEY for permit parsing",
    }
