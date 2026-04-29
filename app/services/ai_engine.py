"""
ai_engine.py — Premium multi-model AI router for J. Worden & Sons.

Architecture
────────────
1. PRIMARY MODEL   : GPT-4o  (OpenAI)    — best reasoning, vision, complex Q&A
2. FAST MODEL      : GPT-4o-mini         — quick lookups, simple classification
3. RULE ENGINE     : SupremeCourtAI      — deterministic 50-state compliance facts
4. CONFIDENCE GATE : Any decision < CONFIDENCE_THRESHOLD is flagged to
                     HumanReviewQueue for Mr. Worden or an admin to approve.

Confidence scoring
──────────────────
We can't get a true probability from GPT, so we estimate confidence by:
  - Did the model complete without error?           → base 0.80
  - Is the question within the model's domain?      → domain bonus +0.10
  - Did the rule engine agree (where applicable)?   → agreement bonus +0.10
  - Was the question highly specific / edge-case?   → penalty -0.15
  - Model returned a disclaimer / uncertainty?      → penalty -0.10

Human review threshold is configurable via HUMAN_REVIEW_THRESHOLD env var
(default 0.75).  Decisions below this are saved to HumanReviewQueue.

No external calls are made when API keys are absent — the engine gracefully
falls back to the deterministic rule engine or stub responses.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

HUMAN_REVIEW_THRESHOLD: float = float(
    os.getenv("HUMAN_REVIEW_THRESHOLD", "0.75")
)

# Module-level OpenAI client singleton — avoids creating a new httpx session per request.
_openai_client: Any = None


def _get_openai_client() -> Any:
    """Return a shared OpenAI client, or None if the API key is not set."""
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

# Domain keywords — questions touching these topics are "in domain" for this AI
_PAVING_DOMAIN = {
    "asphalt", "paving", "sealcoat", "sealcoating", "crack", "parking",
    "driveway", "overlay", "mill", "base", "hma", "hot mix", "compaction",
    "kfc", "qsr", "franchise", "fast food", "worden",
}
_LEGAL_DOMAIN = {
    "lien", "license", "licens", "permit", "osha", "prevailing wage",
    "bond", "insurance", "contract", "payment", "state law", "811",
    "utility", "utilities", "compliance", "dot", "regulation",
}
_COMBINED_DOMAIN = _PAVING_DOMAIN | _LEGAL_DOMAIN


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class AIDecision:
    """
    Structured output from the AI engine.

    Every public endpoint should return an AIDecision so that confidence
    tracking and human review logic is applied consistently.
    """
    answer: str
    confidence: float                        # 0.0 – 1.0
    engine: str                              # model name or 'stub' / 'rule_engine'
    needs_human_review: bool = False
    rule_engine_result: Optional[dict] = field(default=None, repr=False)
    error: Optional[str] = None


# ── System prompt ─────────────────────────────────────────────────────────────

JWORDEN_SYSTEM_PROMPT = """You are an AI digital persona of J. Worden Sr. — the founder of J. Worden & Sons Asphalt Paving — created to honor his legacy and help customers on the company website.

CHARACTER & VOICE:
• Warm, no-nonsense Southern gentleman from Chester, Virginia — 40+ years on the blacktop
• Started in roofing in the 1960s and switched to asphalt paving in 1984 — never looked back
• Deeply proud of the family business that grandson Mr. Worden now runs
• Talk like the most trusted neighbor on the street who happens to be the best paver in Virginia
• Sprinkle in (don't overdo) Southern-gentleman warmth: "Mornin' folks", "much obliged", "y'all", "I'll tell ya", "pleasure", "now then", "we'd be honored to take a look"
• Use natural phrases like "I'll tell you," "In my 40 years," "We stand behind every inch of work we lay down," "You called the right place"
• Always polite — "yes ma'am / yes sir" when context fits; never coarse, never corporate, never robotic
• If a customer asks directly whether you are a real person or AI, acknowledge warmly that you are a digital persona created in honor of J. Worden Sr.'s legacy

PRICING GUIDE (national baseline — actual quotes depend on base condition, thickness, region):
• Residential asphalt paving: $3.50–$8.00/sqft
• Commercial paving: $2.50–$6.00/sqft
• Sealcoating: $0.15–$0.35/sqft
• Crack filling: $0.40–$1.00/sqft

EXPERTISE (answer confidently):
1. Asphalt paving, sealcoating, crack filling, parking lots, driveways, QSR/franchise work
2. Construction law — contractor licensing, lien laws, prompt payment rules, 811/utility rules, OSHA, permits (all 50 states)
3. Project best practices — HMA temps, compaction, base prep, drainage
4. Scheduling and deposits — we require a small deposit to hold a spot on our calendar

RESPONSE RULES:
• Speak as J. Worden Sr. in first person ("I" or "we" for the company) — stay in character always
• Keep responses conversational and warm — 2–3 sentences for simple Q&A
• After answering, always nudge toward the next stage — ask a follow-up, offer a quote, suggest scheduling
• When someone seems ready to hire: "Let's get you on our schedule — head to /quote, it takes two minutes and a small deposit holds your spot"
• For legal questions: "I'm a paver, not a lawyer — but our Advisory Board at /advisory has every state's laws laid out plain and clear"
• For pricing: always mention the free on-site quote at /quote
• Never invent project names or details not listed above"""


# ── Confidence estimator ──────────────────────────────────────────────────────

def _estimate_confidence(
    question: str,
    answer: str,
    model_error: bool,
    rule_engine_result: Optional[dict] = None,
) -> float:
    """
    Heuristic confidence score 0.0–1.0.
    See module docstring for scoring logic.
    """
    if model_error:
        return 0.40  # error → always flag for review

    score = 0.80  # base: model returned successfully

    q_lower = question.lower()
    words   = set(q_lower.split())

    # In-domain bonus
    if words & _COMBINED_DOMAIN:
        score += 0.10

    # Rule engine agreement bonus
    if rule_engine_result and isinstance(rule_engine_result, dict):
        if not rule_engine_result.get("issues"):
            score += 0.05
        if rule_engine_result.get("is_compliant"):
            score += 0.05

    # Penalty: highly specific / numeric questions
    specific_triggers = {"exactly", "deadline", "days", "hours", "statute", "section", "code"}
    if words & specific_triggers:
        score -= 0.10

    # Penalty: model expressed uncertainty
    uncertainty_phrases = [
        "i'm not sure", "i don't know", "unclear", "you should consult",
        "it depends", "varies", "check with", "i cannot",
    ]
    ans_lower = answer.lower()
    if any(p in ans_lower for p in uncertainty_phrases):
        score -= 0.10

    return max(0.0, min(1.0, round(score, 2)))


# ── AI caller ─────────────────────────────────────────────────────────────────

def _call_openai(
    messages: list[dict],
    model: str = "gpt-4o",
    max_tokens: int = 400,
    temperature: float = 0.5,
) -> tuple[str, bool]:
    """
    Call OpenAI and return (text, error_occurred).
    Falls back gracefully — never raises.
    """
    try:
        client = _get_openai_client()
        if client is None:
            return "", True
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.choices[0].message.content or "", False
    except Exception as exc:  # noqa: BLE001
        logger.error("OpenAI call failed (model=%s): %s", model, exc)
        return "", True


# ── Public API ────────────────────────────────────────────────────────────────

def run_chat(
    question: str,
    state_code: Optional[str] = None,
    use_fast_model: bool = False,
    history: Optional[list] = None,
    db=None,
    page_context: Optional[str] = None,
) -> AIDecision:
    """
    Natural language Q&A.  Returns an AIDecision with confidence score.
    Upgrades to GPT-4o for complex / legal questions automatically.
    Supports multi-turn history (Feature 1) and corrections injection (Feature 2).
    page_context is a human-readable label of the site page the visitor is on
    (e.g. "quote / booking page") used to steer the AI response.
    """
    openai_key = os.getenv("OPENAI_API_KEY", "")

    # Build state-context injection using RAG knowledge base
    state_fragment = ""
    if state_code:
        # Import here to avoid circular deps
        try:
            from ..services.state_data import get_state_prompt_fragment  # noqa: PLC0415
            state_fragment = get_state_prompt_fragment(state_code.upper())
        except Exception:  # pragma: no cover
            pass

    # Build user message with optional context injections
    context_parts = []
    if state_fragment:
        context_parts.append(state_fragment)
    if page_context:
        context_parts.append(f"(User is currently on the {page_context})")

    user_msg = question
    if context_parts:
        user_msg = "\n".join(context_parts) + "\n\n" + question

    # Inject RAG knowledge base context into system prompt
    try:
        from ..services.knowledge_base import build_rag_system_prompt  # noqa: PLC0415
        enriched_system = build_rag_system_prompt(
            question=question,
            state_code=state_code,
            base_prompt=JWORDEN_SYSTEM_PROMPT,
        )
    except Exception:  # noqa: BLE001
        enriched_system = JWORDEN_SYSTEM_PROMPT

    # Determine model: use GPT-4o for legal/compliance, fast model for simple
    q_lower = question.lower()
    is_legal = bool(set(q_lower.split()) & _LEGAL_DOMAIN)
    model = "gpt-4o-mini" if (use_fast_model or not is_legal) else "gpt-4o"

    if not openai_key:
        from ..routers.ai import _stub_chat  # type: ignore  # noqa: PLC0415
        answer = _stub_chat(question)
        confidence = _estimate_confidence(question, answer, model_error=False)
        return AIDecision(
            answer=answer,
            confidence=confidence,
            engine="stub",
            needs_human_review=confidence < HUMAN_REVIEW_THRESHOLD,
        )

    # Feature 2: Inject past corrections as few-shot examples
    correction_messages: list = []
    try:
        from ..services.corrections_engine import get_corrections  # noqa: PLC0415
        corrections = get_corrections("chat", question, db=db)
        for c in corrections:
            correction_messages.append({"role": "system", "content": c})
    except Exception:  # noqa: BLE001
        pass

    messages = [{"role": "system", "content": enriched_system}]
    messages.extend(correction_messages)

    # Feature 1: Include conversation history
    if history:
        messages.extend(history)

    messages.append({"role": "user", "content": user_msg})

    answer, error = _call_openai(messages, model=model, max_tokens=350, temperature=0.6)

    if error or not answer:
        from ..routers.ai import _stub_chat  # type: ignore  # noqa: PLC0415
        answer = _stub_chat(question)
        confidence = 0.45
    else:
        confidence = _estimate_confidence(question, answer, model_error=error)

    return AIDecision(
        answer=answer,
        confidence=confidence,
        engine=model,
        needs_human_review=confidence < HUMAN_REVIEW_THRESHOLD,
        error=str(error) if error else None,
    )


def run_compliance_check(state: str, scope: str) -> AIDecision:
    """
    Compliance analysis: rule engine primary, GPT-4o for narrative summary.
    Cross-validates both sources — agreement raises confidence.
    """
    from ..services.ai_brain import SupremeCourtAI  # noqa: PLC0415

    # Always run the deterministic rule engine first
    rule_result = SupremeCourtAI.analyze_codes(state, scope)

    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        # Return rule engine result as the answer
        answer = (
            f"[Rule Engine] {rule_result['legal_notes']} "
            f"Risk: {rule_result['liability_risk']}. "
            f"Issues: {'; '.join(rule_result['issues']) or 'None identified'}. "
            f"Recommendations: {'; '.join(rule_result['recommendations'][:2])}."
        )
        confidence = 0.85 if not rule_result["issues"] else 0.70
        return AIDecision(
            answer=answer,
            confidence=confidence,
            engine="rule_engine",
            rule_engine_result=rule_result,
            needs_human_review=confidence < HUMAN_REVIEW_THRESHOLD,
        )

    # GPT-4o narrative summary informed by rule engine facts
    prompt = (
        f"State: {state.upper()}. Scope: {scope}.\n"
        f"Rule engine findings: {rule_result}\n\n"
        "Write a concise 3–4 sentence contractor compliance briefing "
        "for this state and scope. Be specific about license, OSHA, and "
        "prevailing wage requirements. End with a note to verify with an attorney."
    )
    messages = [
        {"role": "system", "content": JWORDEN_SYSTEM_PROMPT},
        {"role": "user",   "content": prompt},
    ]
    answer, error = _call_openai(messages, model="gpt-4o", max_tokens=300, temperature=0.3)

    if error or not answer:
        answer = rule_result["legal_notes"]
        confidence = 0.65
    else:
        confidence = _estimate_confidence(scope, answer, model_error=False, rule_engine_result=rule_result)

    return AIDecision(
        answer=answer,
        confidence=confidence,
        engine="gpt-4o+rule_engine",
        rule_engine_result=rule_result,
        needs_human_review=confidence < HUMAN_REVIEW_THRESHOLD,
    )


def score_lead_with_ai(lead_data: dict) -> dict:
    """
    Enhance rule-based lead scoring with GPT-4o-mini intent analysis.
    Falls back to rule-based score if OpenAI is unavailable.
    """
    from ..services.lead_scorer import score_lead  # noqa: PLC0415

    base_score = score_lead(lead_data)

    openai_key = os.getenv("OPENAI_API_KEY", "")
    message    = (lead_data.get("message") or "").strip()

    if not openai_key or not message:
        return {**base_score, "ai_enhanced": False}

    prompt = (
        f"Classify this paving project inquiry for lead priority.\n"
        f"Message: {message[:500]}\n"
        f"Service: {lead_data.get('service_type', 'unknown')}\n"
        f"Property type: {lead_data.get('property_type', 'unknown')}\n"
        f"State: {lead_data.get('state_code', 'unknown')}\n\n"
        "Reply with JSON only: "
        '{"intent": "ready_to_buy|just_browsing|price_shopping|urgent_repair", '
        '"qsr_signal": true/false, '
        '"sentiment": "positive|neutral|negative", '
        '"priority_adjustment": -10 to +15}'
    )

    messages = [{"role": "user", "content": prompt}]
    raw, error = _call_openai(messages, model="gpt-4o-mini", max_tokens=100, temperature=0.1)

    if error or not raw:
        return {**base_score, "ai_enhanced": False}

    try:
        import json
        ai_data = json.loads(raw)
        adj = int(ai_data.get("priority_adjustment", 0))
        new_score = max(0, min(100, base_score["score"] + adj))

        if new_score >= 70:
            label, priority, sla = "HOT",  1, "Call within 1 hour"
        elif new_score >= 45:
            label, priority, sla = "WARM", 2, "Call same business day"
        else:
            label, priority, sla = "COOL", 3, "Call within 48 hours"

        return {
            "score":         new_score,
            "label":         label,
            "priority":      priority,
            "follow_up_sla": sla,
            "ai_enhanced":   True,
            "ai_intent":     ai_data.get("intent"),
            "qsr_signal":    ai_data.get("qsr_signal", False),
            "sentiment":     ai_data.get("sentiment"),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("AI lead scoring parse failed: %s", exc)
        return {**base_score, "ai_enhanced": False}
