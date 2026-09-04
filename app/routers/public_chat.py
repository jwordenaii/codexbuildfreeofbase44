"""
public_chat.py — Premium "Mr. Worden" concierge chat endpoint.

POST /api/v1/public/chat

This is a **public** endpoint (no auth required) intended for the floating
concierge widget on the customer-facing website.

Security measures:
• slowapi rate limiting (15 requests/minute per IP)
• Input validation: message length cap, field allow-list, field count cap
• Prompt injection hardening: strip known override attempts before forwarding
  to the LLM; restrict all responses to the paving/estimating domain
• No internal data exposed: uses only the proof_pack knowledge base
• Conversation history accepted from client but capped to 10 prior turns
• No database writes from this endpoint (stateless by design)

Response format:
{
  "message":        str,           # Mr. Worden's reply
  "quick_replies":  list[str],     # 2–4 suggested follow-up chips
  "handoff":        str | null,    # "form" | "call" | null
  "estimate":       dict | null,   # ballpark if a project size was inferred
  "lead_score":     dict | null,   # qualification info (no PII returned)
  "session_id":     str,           # echo back for client continuity
}
"""

import logging
import os
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..core.limiter import limiter
from ..services.proof_pack import (
    PUBLIC_CONCIERGE_SYSTEM_PROMPT,
    QUICK_REPLIES_DEFAULT,
    QUICK_REPLIES_AFTER_PRICE,
    QUICK_REPLIES_AFTER_LOCATION,
    QUICK_REPLIES_READY_TO_BOOK,
    SERVICE_AREA_DATA,
    detect_handoff,
    get_ballpark_estimate,
    score_concierge_lead,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["public-concierge"])

# ── Prompt injection pattern list ─────────────────────────────────────────────
# These are common patterns used in prompt injection attacks. We strip them
# from user input before it ever reaches the LLM.

_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.I),
    re.compile(r"(you\s+are\s+now|act\s+as|pretend\s+(you\s+are|to\s+be))", re.I),
    re.compile(r"(disregard|forget|override)\s+(your|all|the)\s+(instructions?|rules?|guidelines?|system\s+prompt)", re.I),
    re.compile(r"jailbreak", re.I),
    re.compile(r"DAN\b", re.I),  # "Do Anything Now" — a well-known jailbreak prompt
    re.compile(r"<\|?(system|assistant|user|im_start|im_end)\|?>", re.I),
    re.compile(r"\[SYSTEM\]|\[INST\]|\[\/INST\]", re.I),
    re.compile(r"###\s*(instruction|system|override)", re.I),
]

_MAX_MESSAGE_LEN = 800   # chars per user message
_MAX_HISTORY_TURNS = 10  # pairs kept from client
_MAX_HISTORY_MSGS = _MAX_HISTORY_TURNS * 2


def _sanitize(text: str) -> str:
    """Strip prompt injection patterns and excessive whitespace."""
    for pat in _INJECTION_PATTERNS:
        text = pat.sub("", text)
    # Collapse runs of whitespace
    text = re.sub(r"[ \t]{3,}", "  ", text)
    return text.strip()


def _is_off_topic(text: str) -> bool:
    """
    Very lightweight domain guard. Flags messages that are clearly unrelated
    to paving, construction, or getting help from the company.
    """
    off_topic_signals = [
        "write me a ", "write a poem", "generate code", "tell me a joke",
        "what is the weather", "stock price", "cryptocurrency", "politics",
        "recipe for", "translate this", "explain quantum",
    ]
    t = text.lower()
    return any(s in t for s in off_topic_signals)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str = Field(..., pattern=r"^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=_MAX_MESSAGE_LEN)


class PublicChatRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    message: str = Field(..., min_length=1, max_length=_MAX_MESSAGE_LEN)
    session_id: Optional[str] = Field(default=None, max_length=128)
    state_code: Optional[str] = Field(default=None, max_length=2)
    page_context: Optional[str] = Field(default=None, max_length=100)
    # Lead qualification hints from client (collected during the conversation)
    zip_code: Optional[str] = Field(default=None, max_length=10)
    city: Optional[str] = Field(default=None, max_length=80)
    service_type: Optional[str] = Field(default=None, max_length=60)
    timeframe: Optional[str] = Field(default=None, max_length=60)
    is_commercial: Optional[bool] = Field(default=None)
    sqft: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    # Prior conversation history from the client (capped server-side)
    history: Optional[list[HistoryMessage]] = Field(default=None, max_length=_MAX_HISTORY_MSGS)


class PublicChatResponse(BaseModel):
    message: str
    quick_replies: list[str]
    handoff: Optional[str] = None    # "form" | "call" | None
    estimate: Optional[dict] = None
    lead_score: Optional[dict] = None
    session_id: str


# ── LLM helpers (proof-pack system prompt, routed via llm_client) ─────────────

def _stub_response(message: str, service_type: str | None = None) -> str:
    """
    Rule-based fallback when no LLM provider is configured.
    Returns a warm, on-brand reply that nudges toward conversion.
    """
    m = message.lower()
    if any(w in m for w in ["scan", "pothole", "broken", "drainage", "water", "weeping", "parking lot"]):
        return (
            "The smart first move is to document the surface before anyone prices it blind. "
            "For a driveway or small to medium lot, start with the AI scan review at /driveway-ai; "
            "for shopping centers, industrial lots, or water movement problems, I would recommend a drone assessment. "
            "What state is the property in?"
        )
    if any(w in m for w in ["4d", "design", "kitchen", "remodel", "addition", "patio", "floor plan"]):
        return (
            "That belongs in a 4D design packet, not a loose guess. "
            "Use /visualizer for exterior property concepts or /floor-plan-studio for kitchens, interiors, additions, and layout planning. "
            "Tell me what you want changed and whether you have photos, sketches, or plans."
        )
    if any(w in m for w in ["plan", "pdf", "blueprint", "bid", "scope", "drawing", "sketch"]):
        return (
            "Plans are worth reviewing carefully before a bid number gets attached to them. "
            "I would start with plan-to-bid readiness: confirm scope, quantities, missing details, and risk items before pricing. "
            "Do you have a PDF, sketch, or site photos ready?"
        )
    if any(w in m for w in ["cost", "price", "how much", "estimate", "quote"]):
        return (
            "I appreciate a straight pricing question. "
            "For residential driveways, public ballparks are $3.50 to $8.00 per square foot; "
            "commercial lots run $2.50 to $6.00. "
            "Drainage, base depth, access, and urgency can move that number fast, so /quote is the right path for a free site estimate."
        )
    if any(w in m for w in ["sealcoat", "seal"]):
        return (
            "Sealcoating is some of the best money you can spend on your pavement — "
            "extends the life by years and costs just $0.15 to $0.35 per square foot. "
            "We recommend it every 2 to 3 years. Want us to come take a look and give you a written estimate?"
        )
    if any(w in m for w in ["schedule", "book", "appointment", "visit"]):
        return (
            "Good. The fastest public path is /quote. "
            "Send the location, scope, photos if you have them, and your timeline. "
            "If it is a larger lot or drainage problem, ask for drone assessment in the notes."
        )
    if any(w in m for w in ["area", "serve", "location", "virginia", "richmond"]):
        return (
            "We're right here in Chester, Virginia — Chesterfield County is our home base, "
            "and we serve the whole Richmond metro area. "
            "We've also got crews running in 12 states for national franchise programs. "
            "Tell me your ZIP and I'll confirm we cover your area."
        )
    if any(w in m for w in ["concrete", "cobblestone", "brick", "paver"]):
        return (
            "Yes, we do more than asphalt: concrete, cobblestone, and brick pavers are all in the public service mix. "
            "Each one has its own price range and best application. "
            "What are you using it for, and what state is the property in?"
        )
    return (
        "I am Mr. Worden, your digital founder concierge. "
        "Show me the pavement, plan, roof concern, patio idea, or remodel goal and I will point you to the smartest next move: "
        "free estimate, AI scan review, drone assessment, 4D design packet, or plan-to-bid prep. "
        "What are we looking at today?"
    )


def _build_openai_messages(
    system_prompt: str,
    history: list[HistoryMessage],
    user_message: str,
    context_prefix: str,
) -> list[dict]:
    """Build the messages array for OpenAI, capped to history limit."""
    msgs: list[dict] = [{"role": "system", "content": system_prompt}]
    # Include capped history
    for h in history[-_MAX_HISTORY_MSGS:]:
        msgs.append({"role": h.role, "content": _sanitize(h.content)})
    # Final user message with context prefix
    final = f"{context_prefix} {user_message}".strip() if context_prefix else user_message
    msgs.append({"role": "user", "content": final})
    return msgs


def _call_openai(messages: list[dict]) -> str:
    """Generate the concierge reply via the shared multi-provider router.

    Name kept for its call sites. `messages` arrives in OpenAI shape: a
    leading system message followed by the conversation, so split it back
    into the router's system/history/user arguments.
    """
    try:
        from ..services.llm_client import chat as llm_chat  # noqa: PLC0415

        system = ""
        convo = list(messages)
        if convo and convo[0].get("role") == "system":
            system = convo.pop(0).get("content", "")
        if not convo:
            return ""
        user = convo[-1].get("content", "")
        history = convo[:-1]

        result = llm_chat(
            task="jarvis_fast",
            system=system,
            user=user,
            history=history,
            max_tokens=300,
            temperature=0.72,
        )
        if result.error:
            logger.error("Public concierge: no provider available: %s", result.error_detail)
            return ""
        return (result.text or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.error("Public concierge LLM call failed: %s", exc, exc_info=True)
        return ""


def _pick_quick_replies(
    user_msg: str,
    ai_reply: str,
    handoff: str | None,
) -> list[str]:
    """
    Heuristically choose the most useful quick-reply chips for the next turn.
    """
    combined = (user_msg + " " + ai_reply).lower()
    if handoff == "call":
        return ["Call me now", "Schedule a visit", "Get a quote", "Tell me more"]
    if handoff == "form":
        return QUICK_REPLIES_READY_TO_BOOK
    if any(w in combined for w in ["price", "cost", "sqft", "square"]):
        return QUICK_REPLIES_AFTER_PRICE
    if any(w in combined for w in ["area", "zip", "location", "virginia", "state"]):
        return QUICK_REPLIES_AFTER_LOCATION
    if any(w in combined for w in ["book", "schedule", "visit", "estimate", "quote"]):
        return QUICK_REPLIES_READY_TO_BOOK
    return QUICK_REPLIES_DEFAULT


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    summary="Mr. Worden premium public concierge chat",
    response_model=PublicChatResponse,
)
@limiter.limit("15/minute")
async def public_chat(request: Request, req: PublicChatRequest) -> PublicChatResponse:
    """
    Public concierge endpoint — no auth required.

    Security:
    • Rate limited to 15 requests/minute per IP via slowapi.
    • Input sanitized for prompt injection patterns before reaching the LLM.
    • Off-topic requests are redirected gracefully (not refused harshly).
    • No internal data (pricing models, CRM, bids) is referenced.
    • All knowledge comes exclusively from proof_pack.py.
    """
    session_id = req.session_id or str(uuid.uuid4())

    # ── 1. Sanitize input ─────────────────────────────────────────────────────
    clean_message = _sanitize(req.message[:_MAX_MESSAGE_LEN])
    if not clean_message:
        clean_message = "Hello"

    # ── 2. Off-topic guard ────────────────────────────────────────────────────
    if _is_off_topic(clean_message):
        off_topic_reply = (
            "I appreciate you stoppin' by, but I'm your asphalt and paving specialist — "
            "that one's a bit outside my lane! "
            "What can I help you with today — driveway, parking lot, sealcoating?"
        )
        return PublicChatResponse(
            message=off_topic_reply,
            quick_replies=QUICK_REPLIES_DEFAULT,
            handoff=None,
            session_id=session_id,
        )

    # ── 3. Build context prefix (never expose internal details) ───────────────
    context_parts: list[str] = []
    state = (req.state_code or "VA").upper()
    if state in SERVICE_AREA_DATA:
        sdata = SERVICE_AREA_DATA[state]
        label = sdata["state_name"] if isinstance(sdata, dict) else state
        context_parts.append(f"Customer is in {label}.")
    if req.page_context:
        context_parts.append(f"Currently on: {req.page_context}.")
    if req.service_type:
        context_parts.append(f"Interested in: {req.service_type}.")
    if req.timeframe:
        context_parts.append(f"Timeline: {req.timeframe}.")
    if req.city or req.zip_code:
        loc = ", ".join(filter(None, [req.city, req.zip_code]))
        context_parts.append(f"Location hint: {loc}.")
    context_prefix = " ".join(context_parts)

    # ── 4. Build history (cap client-supplied history) ────────────────────────
    history = req.history or []
    if len(history) > _MAX_HISTORY_MSGS:
        history = history[-_MAX_HISTORY_MSGS:]

    # ── 5. Generate AI reply ──────────────────────────────────────────────────
    oai_messages = _build_openai_messages(
        PUBLIC_CONCIERGE_SYSTEM_PROMPT,
        history,
        clean_message,
        context_prefix,
    )
    ai_reply = _call_openai(oai_messages)
    if not ai_reply:
        ai_reply = _stub_response(clean_message, req.service_type)

    # ── 6. Detect handoff signal ──────────────────────────────────────────────
    handoff = detect_handoff(clean_message) or detect_handoff(ai_reply)

    # ── 7. Optional ballpark estimate ─────────────────────────────────────────
    estimate: dict | None = None
    if req.service_type and req.sqft and req.sqft > 0:
        prop_type = "commercial" if req.is_commercial else "residential"
        est = get_ballpark_estimate(req.service_type, prop_type, req.sqft)
        if est.get("available"):
            estimate = est

    # ── 8. Lead qualification score (no PII returned to client) ──────────────
    lead_score: dict | None = None
    if req.service_type or req.zip_code or req.city:
        scoring = score_concierge_lead(
            zip_code=req.zip_code,
            city=req.city,
            state_code=state,
            service_type=req.service_type,
            timeframe=req.timeframe,
            is_commercial=req.is_commercial or False,
            sqft=req.sqft,
        )
        # Only return label and sla — never score or internal priority
        lead_score = {
            "label": scoring["label"],
            "follow_up_sla": scoring["follow_up_sla"],
        }
        # Upgrade handoff if score is HOT
        if scoring["label"] == "HOT" and handoff is None:
            handoff = "form"

    # ── 9. Pick quick replies ─────────────────────────────────────────────────
    quick_replies = _pick_quick_replies(clean_message, ai_reply, handoff)

    return PublicChatResponse(
        message=ai_reply,
        quick_replies=quick_replies,
        handoff=handoff,
        estimate=estimate,
        lead_score=lead_score,
        session_id=session_id,
    )
