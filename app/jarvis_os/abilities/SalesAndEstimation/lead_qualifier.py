"""
lead_qualifier.py — Real-time AI lead qualification agent.

Classifies inbound leads as BUYER | RESEARCHER | TIRE_KICKER | BOT before they
hit the main pipeline, enabling:
  - Immediate callback trigger for serious buyers
  - Suppression of junk leads from campaign reporting
  - First-party signal quality improvement for Google Ads optimization

Two-stage evaluation:
  1. Rule-based (instant, zero API cost): uses lead_scorer signals + keyword
     analysis of the message field.
  2. LLM intent analysis via the shared multi-provider router (Claude first,
     then OpenAI/Gemini/xAI): structured JSON classification with confidence +
     reason + recommended action. Falls back to stage 1 if no provider answers.

Intent → Action mapping:
  BUYER      (score ≥ 65 or LLM high-intent) → CALL_NOW
  RESEARCHER (score 35-64)                   → NURTURE
  TIRE_KICKER (score < 35)                   → DEPRIORITIZE
  BOT        (spam pattern detected)         → DISCARD
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Literal

logger = logging.getLogger(__name__)

_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

BuyerIntent = Literal["BUYER", "RESEARCHER", "TIRE_KICKER", "BOT"]

# ── Bot / spam pattern detection ──────────────────────────────────────────────
_BOT_PATTERNS = re.compile(
    r"(seo\s*service|backlink|rank\s*your\s*site|buy\s*link|casino|viagra|crypto"
    r"|click\s*here|make\s*money|earn\s*\$|free\s*traffic|adult|loan\s*offer"
    r"|investment\s*opportunity|binary\s*option)",
    re.IGNORECASE,
)

# ── Keyword-based intent signals ──────────────────────────────────────────────
_HIGH_INTENT_WORDS = frozenset({
    "asap", "urgent", "immediately", "this week", "today", "need a quote",
    "ready to start", "get started", "how much", "price", "cost", "bid",
    "contract", "commercial", "lot", "property manager", "hoa", "contractor",
    "replace", "full replacement", "overlay", "resurfacing", "parking lot",
    "pothole repair", "seal coat", "striping",
})
_LOW_INTENT_WORDS = frozenset({
    "just curious", "someday", "maybe", "thinking about", "years from now",
    "rough idea", "ballpark", "not sure yet", "researching", "just looking",
    "no rush", "eventually",
})


@dataclass
class QualificationResult:
    buyer_intent: BuyerIntent
    confidence: float           # 0.0 – 1.0
    action: str                 # CALL_NOW | NURTURE | DEPRIORITIZE | DISCARD
    reason: str
    flags: list[str] = field(default_factory=list)
    engine: str = "rule-based"


# ── Rule-based fast path ──────────────────────────────────────────────────────

def _rule_qualify(lead_data: dict) -> QualificationResult:
    """Fast rule-based qualification — no external API calls."""
    message = (lead_data.get("message") or "").lower()

    # Bot detection first
    if _BOT_PATTERNS.search(message):
        return QualificationResult(
            buyer_intent="BOT",
            confidence=0.95,
            action="DISCARD",
            reason="Message contains spam or automated-bot patterns.",
            flags=["spam_detected"],
            engine="rule-based",
        )

    score = lead_data.get("_score_value", 0)
    urgency = (lead_data.get("urgency") or "flexible").lower()
    property_type = (lead_data.get("property_type") or "").lower()
    service = (lead_data.get("service_type") or "").lower()

    high_hits = sum(1 for w in _HIGH_INTENT_WORDS if w in message)
    low_hits  = sum(1 for w in _LOW_INTENT_WORDS  if w in message)
    message_boost = (high_hits * 8) - (low_hits * 10)
    adjusted = score + message_boost

    flags: list[str] = []
    if property_type == "commercial":
        flags.append("commercial_property")
    if urgency in ("asap", "within_1_week"):
        flags.append("high_urgency")
    if service in ("parking_lot", "commercial_paving", "paving"):
        flags.append("high_value_service")
    if not lead_data.get("phone"):
        flags.append("no_phone")
    if not lead_data.get("project_size_sqft"):
        flags.append("no_size_estimate")

    if adjusted >= 65:
        return QualificationResult(
            buyer_intent="BUYER",
            confidence=min(0.95, 0.70 + (adjusted - 65) * 0.005),
            action="CALL_NOW",
            reason=f"High intent score ({adjusted}): {', '.join(flags) or 'strong lead signals'}.",
            flags=flags,
            engine="rule-based",
        )
    if adjusted >= 35:
        return QualificationResult(
            buyer_intent="RESEARCHER",
            confidence=0.65,
            action="NURTURE",
            reason=f"Mid-range score ({adjusted}) — prospect is in the consideration phase.",
            flags=flags,
            engine="rule-based",
        )
    return QualificationResult(
        buyer_intent="TIRE_KICKER",
        confidence=0.70,
        action="DEPRIORITIZE",
        reason=f"Low score ({adjusted}) — low urgency or insufficient project detail provided.",
        flags=flags,
        engine="rule-based",
    )


# ── LLM-enhanced path ─────────────────────────────────────────────────────────

def _gpt_qualify(lead_data: dict, rule_result: QualificationResult) -> QualificationResult:
    """Upgrade rule result with LLM intent analysis. Falls back on any error."""
    import json

    try:
        from app.services.llm_client import chat as llm_chat  # noqa: PLC0415

        prompt = f"""You are a lead qualification specialist for J. Worden & Sons,
a commercial asphalt paving contractor. Classify this inbound lead.

Lead data:
- Service: {lead_data.get('service_type', 'unknown')}
- Property type: {lead_data.get('property_type', 'unknown')}
- Project size: {lead_data.get('project_size_sqft', 'unknown')} sqft
- Urgency: {lead_data.get('urgency', 'unknown')}
- State: {lead_data.get('state_code', 'unknown')}
- Message: {(lead_data.get('message') or '')[:400]}
- Rule-based pre-classification: {rule_result.buyer_intent} ({rule_result.confidence:.0%} confidence)

Respond with JSON only:
{{
  "buyer_intent": "BUYER" | "RESEARCHER" | "TIRE_KICKER" | "BOT",
  "confidence": 0.0-1.0,
  "action": "CALL_NOW" | "NURTURE" | "DEPRIORITIZE" | "DISCARD",
  "reason": "one sentence",
  "flags": ["flag1", "flag2"]
}}

Return ONLY the raw JSON object — no markdown fences, no commentary."""

        result = llm_chat(
            task="classification",
            user=prompt,
            temperature=0.1,
            max_tokens=200,
        )
        if result.error:
            return rule_result
        raw = (result.text or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        return QualificationResult(
            buyer_intent=data.get("buyer_intent", rule_result.buyer_intent),
            confidence=float(data.get("confidence", rule_result.confidence)),
            action=data.get("action", rule_result.action),
            reason=data.get("reason", rule_result.reason),
            flags=data.get("flags", rule_result.flags),
            engine=f"{result.provider}:{result.model}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM qualification failed, using rule result: %s", exc)
        return rule_result


# ── Public entry point ────────────────────────────────────────────────────────

def qualify_lead(lead_data: dict, use_ai: bool = True) -> dict:
    """
    Classify an inbound lead before it enters the pipeline.

    Args:
        lead_data: dict from the lead submission endpoint.  Include
                   ``_score_value`` if ``lead_scorer.score_lead()`` has
                   already been called.
        use_ai:    Whether to call the LLM router (default True, graceful fallback).

    Returns dict with: buyer_intent, confidence, action, reason, flags, engine.
    """
    rule_result = _rule_qualify(lead_data)

    if use_ai and rule_result.buyer_intent != "BOT":
        final = _gpt_qualify(lead_data, rule_result)
    else:
        final = rule_result

    return {
        "buyer_intent": final.buyer_intent,
        "confidence": round(final.confidence, 3),
        "action": final.action,
        "reason": final.reason,
        "flags": final.flags,
        "engine": final.engine,
    }


class LeadQualifierEngine:
    def execute(self, params: dict = None) -> dict:
        return qualify_lead(params or {})
