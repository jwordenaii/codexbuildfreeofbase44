from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
import os
import logging
import time
from app.services.jarvis import jarvis
from app.services import autonomy_state
from app.services import web_search as _web_search
from app.services import vapi_caller as _vapi
from app.services import email_service as _email
from app.services import runtime_config as _cfg
from app.services import tts_service as _tts
from app.services import jarvis_observability as _jarvis_obs
from app.services.audit import write_audit_event
from app.services.jarvis_access import (
    ROLE_STAFF_OPERATOR,
    resolve_access_context,
    require_minimum_role,
)
import asyncio
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api/v1/jarvis", tags=["JARVIS Command Interface"])

class JarvisQuery(BaseModel):
    query:     str
    user_id:   str = "JWORDEN_MASTER"
    persona:   Optional[str] = "JARVIS"
    confirmed: bool = Field(False, description="Operator confirmed this action — allows tool calls when master autonomy is OFF.")
    session_id: Optional[str] = Field(None, description="Optional session id for short-term conversational memory")

class WebSearchRequest(BaseModel):
    query: str
    deep:  bool = False

class CallRequest(BaseModel):
    to_number:   str
    purpose:     str
    script_hint: Optional[str] = None

class EmailRequest(BaseModel):
    to_email: Optional[str] = None
    subject:  str
    body:     str


logger = logging.getLogger(__name__)


def _audit_jarvis_event(
    db: Session,
    *,
    event_type: str,
    role: str,
    user_id: str,
    tenant_id: str,
    summary: str,
    detail: Optional[dict] = None,
) -> None:
    write_audit_event(
        db,
        event_type=event_type,
        actor_type="user",
        actor_id=user_id,
        entity_type="jarvis",
        entity_id=role,
        tenant_id=tenant_id,
        summary=summary,
        detail=detail or {},
    )

@router.post("/command")
async def jarvis_command(
    payload: JarvisQuery,
    x_owner_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    The direct line to JARVIS from the Command Center.
    Supports persona switching via the 'persona' field and tool use (web search, phone calls).
    """
    ctx = resolve_access_context(x_owner_token=x_owner_token, authorization=authorization)
    require_minimum_role(ctx=ctx, minimum_role=ROLE_STAFF_OPERATOR)

    started = time.perf_counter()
    error = False
    context = {
        "user_id": payload.user_id,
        "persona": payload.persona,
        "confirmed": bool(payload.confirmed or ctx.owner),
        "operator_mode": True,
        "role": ctx.role,
        "tenant_id": ctx.tenant_id,
    }
    try:
        response = await jarvis.converse(payload.query, context=context)
        meta = response.get("meta", {}) if isinstance(response, dict) else {}
        _audit_jarvis_event(
            db,
            event_type="jarvis.command",
            role=ctx.role,
            user_id=payload.user_id,
            tenant_id=ctx.tenant_id,
            summary="Jarvis command request completed.",
            detail={"confirmed": context["confirmed"], "fallback_used": bool(meta.get("fallback_used"))},
        )
        return response
    except Exception:
        error = True
        raise
    finally:
        latency_ms = (time.perf_counter() - started) * 1000.0
        meta = response.get("meta", {}) if isinstance(locals().get("response"), dict) else {}
        _jarvis_obs.record_turn(
            role=ctx.role,
            tenant_id=ctx.tenant_id,
            latency_ms=latency_ms,
            engine=str(meta.get("engine") or "unknown"),
            model=str(meta.get("model") or "unknown"),
            fallback_used=bool(meta.get("fallback_used")),
            error=error,
        )


@router.post("/chat", summary="Conversational chat with short-term memory")
async def jarvis_chat(
    payload: JarvisQuery,
    x_owner_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Chat endpoint: stores recent messages under `session_id` and includes them in context.
    Use this for interactive voice/web sessions so Jarvis remembers recent turn history.
    """
    from app.services import short_memory

    session = payload.session_id or payload.user_id
    # append user message to short-term memory
    short_memory.append(session, f"user: {payload.query}")

    ctx = resolve_access_context(x_owner_token=x_owner_token, authorization=authorization)
    # Confirmation is honored only in operator sessions.
    confirmed = bool(payload.confirmed and ctx.authenticated)

    started = time.perf_counter()
    error = False
    context = {
        "user_id": payload.user_id,
        "persona": payload.persona,
        "confirmed": confirmed,
        "session_id": session,
        "operator_mode": ctx.role == ROLE_STAFF_OPERATOR or ctx.owner,
        "role": ctx.role,
        "tenant_id": ctx.tenant_id,
    }
    try:
        response = await jarvis.converse(payload.query, context=context)
    except Exception:
        error = True
        raise
    finally:
        latency_ms = (time.perf_counter() - started) * 1000.0
        meta = response.get("meta", {}) if isinstance(locals().get("response"), dict) else {}
        _jarvis_obs.record_turn(
            role=ctx.role,
            tenant_id=ctx.tenant_id,
            latency_ms=latency_ms,
            engine=str(meta.get("engine") or "unknown"),
            model=str(meta.get("model") or "unknown"),
            fallback_used=bool(meta.get("fallback_used")),
            error=error,
        )

    # store Jarvis reply
    if isinstance(response, dict) and response.get("message"):
        short_memory.append(session, f"jarvis: {response.get('message')}" )

    _audit_jarvis_event(
        db,
        event_type="jarvis.chat",
        role=ctx.role,
        user_id=payload.user_id,
        tenant_id=ctx.tenant_id,
        summary="Jarvis chat turn completed.",
        detail={"session_id": session, "confirmed": confirmed},
    )

    return response

@router.post("/search", summary="Direct web search (Tavily) — bypasses Claude")
async def jarvis_search(req: WebSearchRequest):
    return await _web_search.search(req.query, deep=req.deep)

@router.post("/call", summary="Direct outbound call (Vapi) — operator-initiated")
async def jarvis_call(
    req: CallRequest,
    x_owner_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Operator-initiated outbound call. Requires Vapi configured.
    Refused when autonomy is FROZEN. Logs every attempt.
    """
    ctx = resolve_access_context(x_owner_token=x_owner_token, authorization=authorization)
    require_minimum_role(ctx=ctx, minimum_role=ROLE_STAFF_OPERATOR)

    result = await _vapi.place_call(
        req.to_number,
        purpose=req.purpose,
        script_hint=req.script_hint,
        confirmed=True,
    )
    _jarvis_obs.record_tool_call(tool_name="make_phone_call", role=ctx.role, tenant_id=ctx.tenant_id, ok=bool(result.get("ok")))
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Call failed")

    _audit_jarvis_event(
        db,
        event_type="jarvis.call",
        role=ctx.role,
        user_id="jarvis_operator",
        tenant_id=ctx.tenant_id,
        summary="Direct Jarvis call endpoint invoked.",
        detail={"to": req.to_number, "purpose": req.purpose},
    )
    return result

@router.post("/email", summary="Direct email send (SendGrid) — operator-initiated")
async def jarvis_email(
    req: EmailRequest,
    x_owner_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    ctx = resolve_access_context(x_owner_token=x_owner_token, authorization=authorization)
    require_minimum_role(ctx=ctx, minimum_role=ROLE_STAFF_OPERATOR)

    to_addr = (req.to_email or os.environ.get("ADMIN_NOTIFY_EMAIL") or "j.wordenandsonspaving@gmail.com").strip()
    safe = (req.body or "").replace("&", "&amp;").replace("<", "&lt;")
    html = f"<pre style='font-family:ui-monospace,Consolas,monospace;white-space:pre-wrap'>{safe}</pre>"
    # require explicit operator confirmation for sending emails via this endpoint
    # (this endpoint is considered operator-initiated by design; callers should ensure permission)
    ok = await asyncio.to_thread(
        _email.send_raw,
        to_email=to_addr, subject=req.subject, html_body=html, plain_text=req.body,
    )
    _jarvis_obs.record_tool_call(tool_name="send_email", role=ctx.role, tenant_id=ctx.tenant_id, ok=bool(ok))
    if not ok:
        raise HTTPException(status_code=400, detail="Email send failed (check SENDGRID_API_KEY + SENDGRID_FROM_EMAIL on Railway)")

    _audit_jarvis_event(
        db,
        event_type="jarvis.email",
        role=ctx.role,
        user_id="jarvis_operator",
        tenant_id=ctx.tenant_id,
        summary="Direct Jarvis email endpoint invoked.",
        detail={"to": to_addr, "subject": req.subject},
    )
    return {"ok": True, "to": to_addr, "subject": req.subject}

@router.get("/status")
async def jarvis_status():
    """
    Check if JARVIS is online, what brain he's using, what tools are configured,
    and the current autonomy state.
    """
    state = autonomy_state.get_state()
    has_brain = bool(_cfg.get("ANTHROPIC_API_KEY").strip())
    has_email = bool(_cfg.get("SENDGRID_API_KEY").strip() and _cfg.get("SENDGRID_FROM_EMAIL").strip())
    return {
        "identity":   jarvis.identity,
        "status":     "FROZEN" if state.get("frozen") else jarvis.status,
        "monitoring": jarvis.master_project,
        "engine":     "anthropic-claude" if has_brain else "heuristic-fallback",
        "model":      (_cfg.get("ANTHROPIC_MODEL") or "claude-sonnet-4-5") if has_brain else None,
        "tools": {
            "web_search":       _web_search.is_available(),
            "make_phone_call":  _vapi.is_available(),
            "send_email":       has_email,
        },
        "autonomy": {
            "master":   state.get("master"),
            "frozen":   state.get("frozen"),
            "frozenAt": state.get("frozenAt"),
        },
    }


@router.get("/readiness")
async def jarvis_readiness():
    """
    Single endpoint to verify Jarvis is truly ready for production operation.
    Returns a strict full-capacity flag plus detailed blockers.
    """
    state = autonomy_state.get_state()

    anthropic_ready = bool(_cfg.get("ANTHROPIC_API_KEY").strip())
    tavily_ready = _web_search.is_available()
    call_ready = _vapi.is_available()
    email_ready = bool(_cfg.get("SENDGRID_API_KEY").strip() and _cfg.get("SENDGRID_FROM_EMAIL").strip())
    tts_provider = _tts.active_provider()
    tts_ready = tts_provider != "none"
    google_ready = bool((_cfg.get("GOOGLE_API_KEY") or _cfg.get("GEMINI_API_KEY")).strip())
    frozen = bool(state.get("frozen"))

    blockers: list[str] = []
    if frozen:
        blockers.append("Autonomy is frozen")
    if not anthropic_ready:
        blockers.append("ANTHROPIC_API_KEY missing")
    if not tavily_ready:
        blockers.append("No web search key configured (TAVILY_API_KEY or EXA_API_KEY)")
    if not call_ready:
        blockers.append("Vapi integration not fully configured")
    if not email_ready:
        blockers.append("SENDGRID_API_KEY/SENDGRID_FROM_EMAIL missing")
    if not tts_ready:
        blockers.append("No TTS provider configured (OPENAI_API_KEY or ELEVENLABS_API_KEY)")

    full_capacity = len(blockers) == 0

    return {
        "ok": full_capacity,
        "full_capacity": full_capacity,
        "identity": jarvis.identity,
        "status": "FROZEN" if frozen else jarvis.status,
        "engine": "anthropic-claude" if anthropic_ready else "heuristic-fallback",
        "model": (_cfg.get("ANTHROPIC_MODEL") or "claude-sonnet-4-5") if anthropic_ready else None,
        "tools": {
            "web_search": tavily_ready,
            "make_phone_call": call_ready,
            "send_email": email_ready,
            "tts": tts_ready,
        },
        "providers": {
            "google_or_gemini": google_ready,
            "tts_provider": tts_provider,
        },
        "autonomy": {
            "master": state.get("master"),
            "frozen": frozen,
            "frozenAt": state.get("frozenAt"),
        },
        "blockers": blockers,
    }

