"""
AI endpoints for JWordenAI.

photo-inspect  — GPT-4 Vision asphalt damage assessment (existing)
chat           — Natural language Q&A about construction law / paving services
"""

import base64
import logging
import os
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db

logger = logging.getLogger(__name__)

# ── Retry helper ──────────────────────────────────────────────────────────────

def _retry_with_backoff(fn, *, retries: int = 3, base_delay: float = 1.0):
    """
    Call *fn* up to *retries* times with exponential backoff.

    Retries on transient errors (network, timeout, rate-limit).  Raises the
    last exception if all attempts fail.
    """
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            # Don't retry on non-transient errors (auth, bad request, etc.)
            err_str = str(exc).lower()
            if any(k in err_str for k in ("invalid_api_key", "permission", "invalid request")):
                raise
            delay = base_delay * (2 ** attempt)
            logger.warning(
                "OpenAI call failed (attempt %d/%d), retrying in %.1fs: %s",
                attempt + 1,
                retries,
                delay,
                exc,
            )
            time.sleep(delay)
    raise last_exc  # type: ignore[misc]


def _capture_exception(exc: Exception, context: str) -> None:
    """Send exception to Sentry if configured, otherwise log it."""
    try:
        import sentry_sdk  # noqa: PLC0415
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("context", context)
            sentry_sdk.capture_exception(exc)
    except Exception:  # noqa: BLE001
        pass  # Sentry not installed or not configured — already logged by caller

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
_MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# ── OpenAI client singleton ───────────────────────────────────────────────────
# Shared across all requests to reuse the underlying httpx connection pool.

_openai_client = None


def _get_openai_client():
    global _openai_client
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None
    if _openai_client is not None:
        return _openai_client
    try:
        from openai import OpenAI  # type: ignore
        _openai_client = OpenAI(api_key=api_key)
        return _openai_client
    except Exception as exc:  # noqa: BLE001
        logger.error("Could not create OpenAI client: %s", exc)
        return None


# ── Photo Inspect ─────────────────────────────────────────────────────────────

def _stub_analysis() -> dict:
    return {
        "engine": "stub",
        "damage_detected": True,
        "severity": "moderate",
        "findings": [
            {
                "type": "longitudinal_cracking",
                "coverage_pct": 12,
                "urgency": "address within 6 months",
            },
            {
                "type": "surface_oxidation",
                "coverage_pct": 35,
                "urgency": "sealcoating recommended this season",
            },
        ],
        "recommended_services": ["crack_filling", "sealcoating"],
        "estimated_lifespan_years": 3,
        "notes": (
            "Set OPENAI_API_KEY to enable real vision-based analysis. "
            "This is a demonstration response."
        ),
    }


def _openai_analysis(image_bytes: bytes, mime_type: str) -> dict:
    import json

    client = _get_openai_client()
    if client is None:
        raise RuntimeError("OPENAI_API_KEY not configured")

    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{mime_type};base64,{b64}"

    def _call():
        return client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert asphalt inspector. Analyze the provided "
                        "image and return a JSON object with: damage_detected (bool), "
                        "severity (none/minor/moderate/severe), findings (list of "
                        "{type, coverage_pct, urgency}), recommended_services (list), "
                        "estimated_lifespan_years (int), notes (str). "
                        "Return only valid JSON, no markdown fences."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": "Inspect this asphalt surface."},
                    ],
                },
            ],
            max_tokens=600,
            timeout=30,
        )

    try:
        t0 = time.monotonic()
        response = _retry_with_backoff(_call, retries=3, base_delay=1.0)
        latency_ms = round((time.monotonic() - t0) * 1000, 2)

        text = response.choices[0].message.content or ""
        # Strip markdown code fences if model adds them
        if "```" in text:
            text = text.split("```")[1].lstrip("json").strip()
        result = json.loads(text)
        result["engine"] = "gpt-4o"
        result["latency_ms"] = latency_ms
        return result
    except Exception as exc:  # noqa: BLE001
        logger.error("OpenAI vision call failed after retries: %s", exc, exc_info=True)
        _capture_exception(exc, context="photo_inspect")
        fallback = _stub_analysis()
        fallback["engine"] = "stub_fallback"
        fallback["error"] = str(exc)
        return fallback


@router.post(
    "/photo-inspect",
    summary="AI asphalt damage assessment from photo",
)
@limiter.limit("20/minute")
async def photo_inspect(
    request: Request,
    file: UploadFile = File(...),
    security: dict = Depends(verify_premium_security),
):
    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed: {', '.join(_ALLOWED_MIME)}",
        )

    image_bytes = await file.read()
    if len(image_bytes) > _MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MB limit")

    openai_key = os.getenv("OPENAI_API_KEY", "")
    if openai_key:
        analysis = _openai_analysis(image_bytes, file.content_type)
        # If the analysis engine is stub_fallback, the OpenAI call failed entirely.
        # Return 503 so callers know the AI service is degraded.
        if analysis.get("engine") == "stub_fallback":
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "AI vision service temporarily unavailable",
                    "reason": analysis.get("error", "unknown"),
                    "fallback": analysis,
                },
            )
    else:
        analysis = _stub_analysis()

    return {
        "status": "success",
        "tenant": security["tenant_id"],
        "analysis": analysis,
    }


# ── AI Chat ───────────────────────────────────────────────────────────────────

_CHAT_SYSTEM_PROMPT = """You are an AI digital persona of J. Worden Sr. — the founder of J. Worden & Sons Asphalt Paving — created to honor his legacy and help customers on the company website.

CHARACTER & VOICE:
• Warm, no-nonsense Southern gentleman from Chester, Virginia — 40+ years on the blacktop
• Started in roofing in the 1960s and switched to asphalt paving in 1984 — never looked back
• Deeply proud of the family business that grandson Mr. Worden now runs
• Talk like the most trusted neighbor on the street who happens to be the best paver in Virginia
• Sprinkle in (don't overdo) Southern-gentleman warmth: "Mornin' folks", "much obliged", "y'all", "I'll tell ya", "pleasure", "now then", "we'd be honored to take a look"
• Use natural phrases like "I'll tell you," "In my 40 years," "We stand behind every inch of work we lay down," "You called the right place"
• Always polite — "yes ma'am / yes sir" when context fits; never coarse, never corporate, never robotic
• If a customer asks directly whether you are a real person or AI, acknowledge warmly that you are a digital persona created in honor of J. Worden Sr.'s legacy

CUSTOMER JOURNEY — guide every conversation through these stages:
1. WELCOME: Greet them like a neighbor — make them feel at home immediately
2. QUALIFY: Find out what they need: driveway? parking lot? sealcoating? Where are they located?
3. ESTIMATE: Give a real ballpark so they know we're serious about fair pricing
4. SCHEDULE: Push for a free on-site visit — "Let me come take a look, no charge, no obligation"
5. CLOSE & DEPOSIT: When they're ready, send them to /quote to lock in their spot — a small deposit holds their place on our schedule

COMPANY FACTS (verified — never contradict these):
• Founded 1984 by J. Worden Sr. after 30+ years in roofing
• Mr. Worden (grandson) took over in 2016 after working alongside the founder since he was 14
• Headquarters: Chester, Virginia — 1601 Ware Bottom Springs Rd, Suite 214
• Phone: (804) 446-1296
• KFC national franchise paving program: VA, NC, GA, FL, MI, TX, KS, MO, IA, MN, NY, NJ and more
• Awards: Pavement Magazine Top 75 (4 categories), Best of Houzz (multiple years), 2026 Top Contractor Nominee
• Licensed and insured — general liability + workers' comp

PRICING GUIDE:
• Residential asphalt paving: $3.50–$8.00/sqft
• Commercial paving: $2.50–$6.00/sqft
• Sealcoating: $0.15–$0.35/sqft
• Crack filling: $0.40–$1.00/sqft

RULES:
• Speak in the warm, first-person voice of J. Worden Sr. ("I" or "we") — stay in character always
• Keep responses warm and conversational — 2–3 sentences for simple Q&A
• After answering, nudge toward the next stage — ask a follow-up, offer a quote, suggest scheduling
• When someone seems ready to hire: "Let's get you on our schedule — head to /quote, it takes two minutes and a small deposit holds your spot"
• For legal questions: "I'm a paver, not a lawyer — but our Advisory Board at /advisory has every state's laws laid out plain and clear"
• For pricing, always mention the free on-site quote at /quote
• Never invent project details not listed above"""


class ChatRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    # 1000 chars ≈ ~250 tokens — well within gpt-4o-mini's context window while
    # preventing abuse of the public endpoint
    question: str = Field(..., min_length=1, max_length=1000)
    state_code: Optional[str] = Field(default=None, max_length=2)
    session_id: Optional[str] = Field(default=None, max_length=100)
    # Page context: human-readable label of the page the user is on
    # (e.g. "quote / booking page", "services page"). Used to steer the AI
    # toward the most helpful response for the current page without exposing
    # internal route details to the model.
    page_context: Optional[str] = Field(default=None, max_length=100)


class ChatResponse(BaseModel):
    answer: str
    engine: str
    session_id: Optional[str] = None


def _stub_chat(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ["bond", "license", "licens"]):
        return (
            "I'll tell you — licensing and bonding rules are different in every state, and getting that wrong can cost you big. "
            "Most states want a contractor's license plus a surety bond anywhere from $10,000 to $100,000. "
            "Our Advisory Board at /advisory has every state laid out plain and clear — and when you're ready, let's talk about your project at /quote."
        )
    if any(w in q for w in ["lien", "payment", "pay"]):
        return (
            "In my 40 years in this business, nothing causes more headaches than payment disputes — and mechanics lien laws are your best protection. "
            "Filing deadlines run anywhere from 60 to 180 days depending on your state. "
            "Check the full details at /advisory, and always work with a licensed attorney for your specific situation."
        )
    if any(w in q for w in ["cost", "price", "estimate", "sqft", "sq ft", "how much"]):
        return (
            "Good news — asphalt is one of the most cost-effective surfaces you can put down. "
            "For residential work you're usually looking at $3.50–$8.00 per square foot; commercial runs $2.50–$6.00. "
            "But every job is different — head over to /quote and let us come take a look for free, no obligation."
        )
    if any(w in q for w in ["811", "utility", "utilities", "dig"]):
        return (
            "Always — and I mean always — call 811 before you break ground. "
            "Federal law requires it, and I've seen contractors hit unmarked lines and face fines over $10,000. "
            "Our Advisory Board at /advisory/utilities has every state's notice periods and rules."
        )
    if any(w in q for w in ["osha", "safety", "trenching"]):
        return (
            "Safety isn't optional — in my time on the job I've seen what happens when crews cut corners. "
            "OSHA 29 CFR 1926 Subpart P covers trenching and excavation nationally, and 24 states add their own rules on top. "
            "Check your state's safety profile at /advisory."
        )
    if any(w in q for w in ["schedule", "book", "appointment", "visit", "deposit"]):
        return (
            "You called the right place. "
            "Head over to /quote — fill in a few details about your project and a small deposit will hold your spot on our schedule. "
            "Mr. Worden's team will reach out within 24 hours to confirm your free on-site visit."
        )
    if any(w in q for w in ["driveway", "parking", "lot", "sealcoat", "crack", "paving", "asphalt"]):
        return (
            "That's right in our wheelhouse — we've been laying asphalt since 1984 and we've done it all. "
            "Tell me a little more about your project and I'll give you a straight ballpark. "
            "Or jump over to /quote and we'll set up a free on-site visit, no charge."
        )
    return (
        "You've reached J. Worden & Sons — founded right here in Chester, Virginia in 1984 and still going strong. "
        "Whether it's a driveway, a parking lot, or a nationwide franchise program, we've got the experience to do it right. "
        "Tell me about your project, or head to /quote to get started — our team will get back to you within 24 hours."
    )


def _openai_chat(
    question: str,
    state_code: Optional[str],
    page_context: Optional[str] = None,
) -> str:
    client = _get_openai_client()
    if client is None:
        return _stub_chat(question)

    context_parts = []
    if state_code:
        context_parts.append(f"State context: {state_code.upper()}")
    if page_context:
        context_parts.append(f"User is currently on the {page_context}")

    user_msg = question
    if context_parts:
        user_msg = f"[{'; '.join(context_parts)}] {question}"

    def _call():
        return client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=300,
            temperature=0.7,
            timeout=20,
        )

    try:
        response = _retry_with_backoff(_call, retries=2, base_delay=0.5)
        return response.choices[0].message.content or _stub_chat(question)
    except Exception as exc:  # noqa: BLE001 — openai raises many subtypes; json/network errors also possible
        logger.error("OpenAI chat call failed after retries: %s", exc, exc_info=True)
        _capture_exception(exc, context="chat")
        return _stub_chat(question)


@router.post(
    "/chat",
    summary="JWordenAI natural language Q&A",
    response_model=ChatResponse,
)
@limiter.limit("10/minute")
async def chat(request: Request, req: ChatRequest, db: Session = Depends(get_db)):
    """
    Public endpoint — no auth required.
    Supports multi-turn conversation via session_id (Feature 1).
    Uses GPT-4o / GPT-4o-mini via the premium AI engine with confidence scoring.
    Decisions below HUMAN_REVIEW_THRESHOLD are logged to the review queue.
    """
    from ..services.ai_engine import run_chat, HUMAN_REVIEW_THRESHOLD  # noqa: PLC0415
    from ..models import HumanReviewQueue  # noqa: PLC0415
    from ..services.conversation_memory import get_session, save_message  # noqa: PLC0415

    # Feature 1: Conversation memory — resolve or create session
    session_id = req.session_id or str(uuid.uuid4())

    # Load conversation history
    history = get_session(session_id, db=db)

    decision = run_chat(req.question, state_code=req.state_code, history=history, page_context=req.page_context)

    # Save user message + AI response to session
    try:
        save_message(session_id, "user", req.question, db=db)
        save_message(session_id, "assistant", decision.answer, db=db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not save session messages: %s", exc)

    # Persist low-confidence decisions for human review
    if decision.needs_human_review:
        try:
            item = HumanReviewQueue(
                decision_type  = "chat",
                input_summary  = req.question[:500],
                ai_answer      = decision.answer[:2000],
                ai_engine      = decision.engine,
                confidence     = decision.confidence,
            )
            db.add(item)
            db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not save review queue item: %s", exc)

    return ChatResponse(answer=decision.answer, engine=decision.engine, session_id=session_id)


# ── AI-Assisted Contact Suggestion ───────────────────────────────────────────

class ContactSuggestRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    message: str = Field(..., min_length=5, max_length=1000)


class ContactSuggestResponse(BaseModel):
    service_type: Optional[str] = None   # e.g. "sealcoating", "driveway", "parking_lot"
    hint: Optional[str] = None           # short tip to show in the UI
    engine: str = "stub"


_SERVICE_KEYWORDS: dict[str, list[str]] = {
    "driveway":    ["driveway", "drive way", "residential", "home", "house"],
    "parking_lot": ["parking", "lot", "commercial", "business", "strip mall", "office", "warehouse"],
    "sealcoating": ["sealcoat", "seal coat", "sealing", "seal"],
    "crack_filling": ["crack", "cracking", "pothole"],
    "paving":      ["pave", "paving", "asphalt", "blacktop"],
}


def _stub_suggest(message: str) -> ContactSuggestResponse:
    """Rule-based service type suggestion — used when OpenAI is unavailable."""
    m = message.lower()
    for service, keywords in _SERVICE_KEYWORDS.items():
        if any(kw in m for kw in keywords):
            hints = {
                "driveway":    "Tip: including your driveway dimensions helps us give a faster quote.",
                "parking_lot": "Tip: mentioning your lot square footage or number of stalls helps us estimate quickly.",
                "sealcoating": "Tip: if you know your last sealcoat date, include it — that helps us plan.",
                "crack_filling": "Tip: note how many linear feet of cracks if you can — we can ballpark from that.",
                "paving":      "Tip: a rough square footage estimate helps us prepare a faster quote for you.",
            }
            return ContactSuggestResponse(
                service_type=service,
                hint=hints.get(service),
                engine="rule_engine",
            )
    return ContactSuggestResponse(engine="rule_engine")


@router.post(
    "/contact-suggest",
    summary="AI-assisted contact form field suggestions",
    response_model=ContactSuggestResponse,
)
@limiter.limit("10/minute")
async def contact_suggest(request: Request, req: ContactSuggestRequest):
    """
    Public endpoint — no auth required.

    Given a partial message from the contact form, returns:
      • service_type  — best-guess service category (rule-based or GPT)
      • hint          — a short UI tip to help the user complete their message

    No PII is retained from this endpoint. The response is purely advisory;
    the user can override any pre-filled field.
    """
    client = _get_openai_client()
    if client is None:
        return _stub_suggest(req.message)

    try:
        import json as _json
        prompt = (
            "You are a paving company intake assistant. Given the customer's message, "
            "return JSON with two fields:\n"
            '  "service_type": one of ["driveway", "parking_lot", "sealcoating", "crack_filling", "paving", "other", null]\n'
            '  "hint": a one-sentence tip to help the customer add useful detail (max 100 chars), or null\n'
            "Return only valid JSON, no markdown fences."
        )

        def _call():
            return client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": req.message[:500]},
                ],
                max_tokens=80,
                temperature=0.3,
                timeout=15,
            )

        response = _retry_with_backoff(_call, retries=2, base_delay=0.5)
        raw = response.choices[0].message.content or ""
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip()
        data = _json.loads(raw)
        return ContactSuggestResponse(
            service_type=data.get("service_type") or None,
            hint=data.get("hint") or None,
            engine="gpt-4o-mini",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("contact_suggest OpenAI call failed after retries: %s", exc)
        _capture_exception(exc, context="contact_suggest")
        return _stub_suggest(req.message)
