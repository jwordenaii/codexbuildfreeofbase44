"""
Admin dashboard router — served entirely from the backend (FastAPI + Jinja2).

All routes under /admin require HTTP Basic Authentication.
Credentials are supplied via environment variables:
  ADMIN_USERNAME  (default: "admin")
  ADMIN_PASSWORD  (required — no default; routes return 401 if unset)

The dashboard exposes:
  GET  /admin                      → redirect to /admin/dashboard
  GET  /admin/dashboard            → overview stats + top-ranked leads
  GET  /admin/leads                → full ranked lead list (with filters)
  GET  /admin/content              → webpage-maker content blocks list
  GET  /admin/content/new          → new block form
  POST /admin/content/new          → create block
  GET  /admin/content/{key}/edit   → edit form
  POST /admin/content/{key}/edit   → save changes
  POST /admin/content/{key}/delete → delete block
  GET  /admin/analytics            → SEO analytics dashboard (GSC + GA4)
  GET  /admin/analytics/gsc        → GSC data JSON (top queries, CTR, position)
  GET  /admin/analytics/ga4        → GA4 data JSON (traffic, conversions, pages)
  POST /admin/chat                 → AI chatbot for GSC + GA4 analysis

None of these routes are included in the customer-facing OpenAPI spec
(include_in_schema=False) and they are excluded from CORS so browser
clients on other origins cannot reach them.
"""

from __future__ import annotations

import json
import logging
import os
import re
import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ContactMessage, Lead, PageContent, TwoFactorSecret
from ..services.ranking import rank_leads
from ..services.gsc_client import get_gsc_data, get_top_keywords, get_keywords_by_position
from ..services.ga4_client import get_ga4_data, get_top_pages, get_conversion_funnel, get_conversion_rate_by_page
from ..services.analytics_ai import answer_analytics_question, analyze_gsc_data, analyze_ga4_data
from ..services.totp_service import TOTPService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", include_in_schema=False)
security = HTTPBasic()

# ── Template engine ────────────────────────────────────────────────────────────

_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
templates = Jinja2Templates(directory=_TEMPLATES_DIR)


# ── Auth ──────────────────────────────────────────────────────────────────────

def _require_admin(
    request: Request,
    credentials: HTTPBasicCredentials = Depends(security),
    x_totp_token: str | None = Header(default=None, alias="X-TOTP-Token"),
) -> str:
    """
    Verify HTTP Basic credentials against ADMIN_USERNAME / ADMIN_PASSWORD env vars.
    Uses secrets.compare_digest to prevent timing attacks.

    When 2FA is enabled for the admin user, a valid TOTP token (or backup code)
    must also be supplied via the ``X-TOTP-Token`` request header.  Clients that
    do not yet support the header will receive a 401 with a descriptive message
    so they can prompt the user for the code.
    """
    admin_user = os.getenv("ADMIN_USERNAME", "admin").encode()
    admin_pass = os.getenv("ADMIN_PASSWORD", "").encode()

    if not admin_pass:
        raise HTTPException(
            status_code=503,
            detail="Admin dashboard is not configured. Set ADMIN_PASSWORD.",
        )

    user_ok = secrets.compare_digest(credentials.username.encode(), admin_user)
    pass_ok = secrets.compare_digest(credentials.password.encode(), admin_pass)

    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic realm=\"JWordenAI Admin\""},
        )

    username = credentials.username

    # ── 2FA check ─────────────────────────────────────────────────────────────
    # Import here to avoid a circular import at module load time.
    from ..database import SessionLocal  # noqa: PLC0415

    db = SessionLocal()
    try:
        record: TwoFactorSecret | None = (
            db.query(TwoFactorSecret)
            .filter(TwoFactorSecret.user_id == username)
            .first()
        )
    finally:
        db.close()

    if record and record.enabled:
        if not x_totp_token:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Two-factor authentication is enabled. "
                    "Supply your 6-digit TOTP code in the X-TOTP-Token header."
                ),
                headers={"WWW-Authenticate": "Basic realm=\"JWordenAI Admin\""},
            )

        # Accept a live TOTP token first
        token_valid = TOTPService.verify_token(record.secret, x_totp_token)
        if not token_valid:
            # Fall back to backup codes (consumes the code on success)
            ok, updated_json = TOTPService.verify_backup_code(
                record.backup_codes or "[]", x_totp_token
            )
            if ok:
                # Persist the consumed backup code
                db2 = SessionLocal()
                try:
                    rec2 = (
                        db2.query(TwoFactorSecret)
                        .filter(TwoFactorSecret.user_id == username)
                        .first()
                    )
                    if rec2:
                        rec2.backup_codes = updated_json
                        db2.commit()
                finally:
                    db2.close()
                logger.info("Admin login via backup code for user=%s", username)
            else:
                logger.warning("Admin 2FA token rejected for user=%s", username)
                raise HTTPException(
                    status_code=401,
                    detail="Invalid TOTP token or backup code.",
                    headers={"WWW-Authenticate": "Basic realm=\"JWordenAI Admin\""},
                )

    return username


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hot_count(db: Session) -> int:
    return db.query(Lead).filter(Lead.score_label == "HOT").count()


def _render(request: Request, template: str, db: Session, **ctx) -> HTMLResponse:
    ctx.setdefault("active", "")
    ctx.setdefault("flash", None)
    ctx["hot_count"] = _hot_count(db)
    ctx["request"] = request
    return templates.TemplateResponse(template, ctx)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_class=RedirectResponse)
def admin_root(_: str = Depends(_require_admin)):
    return RedirectResponse(url="/admin/dashboard", status_code=302)


@router.get("/dashboard", response_class=HTMLResponse)
def admin_dashboard(
    request: Request,
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    all_leads = db.query(Lead).order_by(Lead.created_at.desc()).all()
    ranked = rank_leads(all_leads)

    hot  = sum(1 for r in ranked if r["rank_label"] == "HOT")
    warm = sum(1 for r in ranked if r["rank_label"] == "WARM")
    cool = sum(1 for r in ranked if r["rank_label"] == "COOL")
    overdue = sum(1 for r in ranked if r["sla_status"] != "within_sla" and r["sla_status"] != "unknown")

    recent_contacts = (
        db.query(ContactMessage)
        .order_by(ContactMessage.created_at.desc())
        .limit(10)
        .all()
    )
    content_blocks = db.query(PageContent).count()

    return _render(
        request,
        "admin/dashboard.html",
        db,
        active="dashboard",
        stats={
            "total_leads": len(all_leads),
            "hot": hot,
            "warm": warm,
            "cool": cool,
            "overdue": overdue,
            "total_contacts": db.query(ContactMessage).count(),
            "content_blocks": content_blocks,
        },
        top_leads=ranked[:10],
        recent_contacts=recent_contacts,
    )


@router.get("/leads", response_class=HTMLResponse)
def admin_leads(
    request: Request,
    label: str = "",
    sla: str = "",
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    query = db.query(Lead)
    all_leads = query.order_by(Lead.created_at.desc()).all()
    ranked = rank_leads(all_leads)

    # Apply filters
    if label:
        ranked = [r for r in ranked if r["rank_label"] == label.upper()]
    if sla == "overdue":
        ranked = [r for r in ranked if r["sla_status"] not in ("within_sla", "unknown")]

    return _render(
        request,
        "admin/leads.html",
        db,
        active="leads",
        ranked_leads=ranked,
        total=len(ranked),
        filter_label=label.upper() if label else "",
        filter_sla=sla,
    )


# ── Content (Webpage Maker) ───────────────────────────────────────────────────

@router.get("/content", response_class=HTMLResponse)
def admin_content(
    request: Request,
    flash_msg: str = "",
    flash_type: str = "success",
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    blocks = db.query(PageContent).order_by(PageContent.key).all()
    flash = {"type": flash_type, "message": flash_msg} if flash_msg else None
    return _render(request, "admin/content.html", db, active="content", blocks=blocks, flash=flash)


@router.get("/content/new", response_class=HTMLResponse)
def admin_content_new(
    request: Request,
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    return _render(request, "admin/content_edit.html", db, active="content", block=None)


@router.post("/content/new", response_class=RedirectResponse)
def admin_content_create(
    request: Request,
    key: str = Form(...),
    title: str = Form(...),
    body: str = Form(""),
    meta_json: str = Form(""),
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    key = key.strip().lower()

    # Validate key format
    if not re.fullmatch(r"[a-z0-9_\-]+", key):
        return _render(
            request,
            "admin/content_edit.html",
            db,
            active="content",
            block=None,
            flash={"type": "error", "message": "Key must contain only lowercase letters, numbers, underscores, and hyphens."},
        )

    # Validate JSON if provided
    if meta_json.strip():
        try:
            json.loads(meta_json)
        except json.JSONDecodeError:
            return _render(
                request,
                "admin/content_edit.html",
                db,
                active="content",
                block=None,
                flash={"type": "error", "message": "Meta JSON is not valid JSON."},
            )

    existing = db.query(PageContent).filter(PageContent.key == key).first()
    if existing:
        return _render(
            request,
            "admin/content_edit.html",
            db,
            active="content",
            block=None,
            flash={"type": "error", "message": f"A block with key '{key}' already exists."},
        )

    block = PageContent(
        key=key,
        title=title.strip(),
        body=body,
        meta_json=meta_json.strip() or None,
    )
    db.add(block)
    db.commit()
    logger.info("Admin created content block key=%s", key)
    safe_key = quote(key, safe="")
    return RedirectResponse(
        url=f"/admin/content?flash_msg=Block+%27{safe_key}%27+created.&flash_type=success",
        status_code=303,
    )


@router.get("/content/{key}/edit", response_class=HTMLResponse)
def admin_content_edit(
    key: str,
    request: Request,
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    block = db.query(PageContent).filter(PageContent.key == key).first()
    if not block:
        raise HTTPException(status_code=404, detail=f"Content block '{key}' not found")
    return _render(request, "admin/content_edit.html", db, active="content", block=block)


@router.post("/content/{key}/edit", response_class=RedirectResponse)
def admin_content_update(
    key: str,
    title: str = Form(...),
    body: str = Form(""),
    meta_json: str = Form(""),
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    block = db.query(PageContent).filter(PageContent.key == key).first()
    if not block:
        raise HTTPException(status_code=404, detail=f"Content block '{key}' not found")

    if meta_json.strip():
        try:
            json.loads(meta_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="Meta JSON is not valid JSON")

    block.title = title.strip()
    block.body = body
    block.meta_json = meta_json.strip() or None
    db.commit()
    logger.info("Admin updated content block key=%s", key)
    safe_key = quote(key, safe="")
    return RedirectResponse(
        url=f"/admin/content?flash_msg=Block+%27{safe_key}%27+saved.&flash_type=success",
        status_code=303,
    )


@router.post("/content/{key}/delete", response_class=RedirectResponse)
def admin_content_delete(
    key: str,
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    block = db.query(PageContent).filter(PageContent.key == key).first()
    if not block:
        raise HTTPException(status_code=404, detail=f"Content block '{key}' not found")
    db.delete(block)
    db.commit()
    logger.info("Admin deleted content block key=%s", key)
    safe_key = quote(key, safe="")
    return RedirectResponse(
        url=f"/admin/content?flash_msg=Block+%27{safe_key}%27+deleted.&flash_type=success",
        status_code=303,
    )




# ── SEO Analytics (GSC + GA4) ─────────────────────────────────────────────────

@router.get("/analytics", response_class=HTMLResponse)
def admin_analytics(
    request: Request,
    db: Session = Depends(get_db),
    _: str = Depends(_require_admin),
):
    """Main SEO analytics dashboard — renders the analytics.html template."""
    return _render(
        request,
        "admin/analytics.html",
        db,
        active="analytics",
    )


@router.get("/analytics/gsc", response_class=JSONResponse)
def admin_analytics_gsc(
    days: int = 28,
    _: str = Depends(_require_admin),
):
    """
    Return live Google Search Console data as JSON.

    Query params:
      days (int, default 28) — lookback window in days

    Requires GSC_SERVICE_ACCOUNT_JSON + GSC_SITE_URL env vars.
    Returns {"not_configured": true} gracefully when credentials are absent.
    """
    try:
        data = get_gsc_data(days=days)
        easy_wins = get_keywords_by_position(2.0, 5.0, limit=20)
        data["easy_win_keywords"] = easy_wins
        return data
    except Exception as exc:  # noqa: BLE001
        logger.error("GSC data fetch error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch GSC data: {exc}"},
        )


@router.get("/analytics/ga4", response_class=JSONResponse)
def admin_analytics_ga4(
    days: int = 28,
    _: str = Depends(_require_admin),
):
    """
    Return live Google Analytics 4 data as JSON.

    Query params:
      days (int, default 28) — lookback window in days

    Requires GA4_SERVICE_ACCOUNT_JSON + GA4_PROPERTY_ID env vars.
    Returns {"not_configured": true} gracefully when credentials are absent.
    """
    try:
        data = get_ga4_data(days=days)
        funnel = get_conversion_funnel()
        conv_by_page = get_conversion_rate_by_page(limit=10)
        data["conversion_funnel"] = funnel
        data["best_converting_pages"] = conv_by_page
        return data
    except Exception as exc:  # noqa: BLE001
        logger.error("GA4 data fetch error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch GA4 data: {exc}"},
        )


@router.post("/chat", response_class=JSONResponse)
async def admin_analytics_chat(
    request: Request,
    days: int = 28,
    _: str = Depends(_require_admin),
):
    """
    AI chatbot endpoint — answers natural-language questions about GSC + GA4 data.

    Request body (JSON):
      {"question": "Which keywords are closest to ranking #1?"}

    Fetches live GSC + GA4 data, then passes both datasets + the question to
    GPT-4o for analysis.  Requires OPENAI_API_KEY for AI responses; returns
    a helpful message if credentials are absent.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    question = (body.get("question") or "").strip()
    if not question:
        return JSONResponse(
            status_code=422,
            content={"error": "Provide a 'question' field in the request body."},
        )

    try:
        gsc_data = get_gsc_data(days=days)
        ga4_data = get_ga4_data(days=days)
        answer = answer_analytics_question(gsc_data, ga4_data, question)
        return {
            "question": question,
            "answer": answer,
            "data_sources": {
                "gsc_configured": not gsc_data.get("not_configured", False),
                "ga4_configured": not ga4_data.get("not_configured", False),
            },
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("Analytics chat error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"error": f"Chat failed: {exc}"},
        )
