"""
analytics_ai.py — AI-powered analysis of GSC + GA4 data for JWordenAI.

Uses OpenAI GPT-4o to answer natural-language questions about search and
analytics data.  Falls back to a structured stub when OPENAI_API_KEY is absent.

Public API
──────────
  analyze_gsc_data(gsc_data, question)           → str answer
  analyze_ga4_data(ga4_data, question)           → str answer
  answer_analytics_question(gsc, ga4, question)  → str answer (combined)
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# ── System prompt ─────────────────────────────────────────────────────────────

_ANALYTICS_SYSTEM_PROMPT = """\
You are an expert SEO and digital marketing analyst for J. Worden & Sons Asphalt Paving.
You have access to real Google Search Console (GSC) and Google Analytics 4 (GA4) data.

Your job is to:
1. Identify actionable SEO opportunities — especially keywords ranking #2–5 that can be pushed to #1.
2. Spot pages with high traffic but low conversion rates (optimization targets).
3. Identify the best traffic sources sending high-quality leads.
4. Recommend content gaps based on keyword data.
5. Explain data trends in plain English that a business owner can act on.

Always be specific — cite actual keyword names, page paths, numbers, and percentages from the data.
Keep answers concise (3–6 sentences) unless a detailed breakdown is requested.
End with one clear, prioritized action item.
"""

# ── OpenAI helper ─────────────────────────────────────────────────────────────

def _call_openai(system: str, user: str, max_tokens: int = 600) -> str:
    """Call GPT-4o and return the text response, or a fallback string on error."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return (
            "OpenAI API key not configured. Set OPENAI_API_KEY to enable AI analysis. "
            "The raw data above is still available for manual review."
        )
    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=0.4,
        )
        return resp.choices[0].message.content or ""
    except Exception as exc:  # noqa: BLE001
        logger.error("Analytics AI call failed: %s", exc)
        return f"AI analysis temporarily unavailable: {exc}"


def _truncate_data(data: Any, max_chars: int = 6000) -> str:
    """Serialise data to JSON and truncate to avoid token limits."""
    raw = json.dumps(data, indent=2, default=str)
    if len(raw) > max_chars:
        raw = raw[:max_chars] + "\n... [truncated for length]"
    return raw


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_gsc_data(gsc_data: dict, question: str) -> str:
    """
    Answer `question` using the provided GSC data dict.

    Returns a plain-text AI analysis string.
    """
    if gsc_data.get("not_configured"):
        return (
            "Google Search Console is not yet configured. "
            "Add GSC_SERVICE_ACCOUNT_JSON and GSC_SITE_URL environment variables "
            "in Railway to enable live GSC data."
        )

    data_str = _truncate_data(gsc_data)
    user_msg = (
        f"Here is the Google Search Console data:\n\n{data_str}\n\n"
        f"Question: {question}"
    )
    return _call_openai(_ANALYTICS_SYSTEM_PROMPT, user_msg)


def analyze_ga4_data(ga4_data: dict, question: str) -> str:
    """
    Answer `question` using the provided GA4 data dict.

    Returns a plain-text AI analysis string.
    """
    if ga4_data.get("not_configured"):
        return (
            "Google Analytics 4 is not yet configured. "
            "Add GA4_SERVICE_ACCOUNT_JSON and GA4_PROPERTY_ID environment variables "
            "in Railway to enable live GA4 data."
        )

    data_str = _truncate_data(ga4_data)
    user_msg = (
        f"Here is the Google Analytics 4 data:\n\n{data_str}\n\n"
        f"Question: {question}"
    )
    return _call_openai(_ANALYTICS_SYSTEM_PROMPT, user_msg)


def answer_analytics_question(
    gsc_data: dict,
    ga4_data: dict,
    question: str,
) -> str:
    """
    Answer `question` using both GSC and GA4 data combined.

    This is the primary entry point for the admin chat interface.
    Returns a plain-text AI analysis string.
    """
    gsc_configured = not gsc_data.get("not_configured")
    ga4_configured = not ga4_data.get("not_configured")

    if not gsc_configured and not ga4_configured:
        return (
            "Neither Google Search Console nor Google Analytics 4 is configured yet. "
            "Add the following environment variables in Railway to get started:\n"
            "• GSC_SERVICE_ACCOUNT_JSON — base64-encoded GSC service account JSON\n"
            "• GSC_SITE_URL — your site URL in GSC (e.g. sc-domain:jwordenasphaltpaving.com)\n"
            "• GA4_SERVICE_ACCOUNT_JSON — base64-encoded GA4 service account JSON\n"
            "• GA4_PROPERTY_ID — your GA4 property ID (digits only)"
        )

    parts = []
    if gsc_configured:
        parts.append(f"=== GOOGLE SEARCH CONSOLE DATA ===\n{_truncate_data(gsc_data, 3000)}")
    else:
        parts.append("=== GOOGLE SEARCH CONSOLE DATA ===\n[Not configured]")

    if ga4_configured:
        parts.append(f"=== GOOGLE ANALYTICS 4 DATA ===\n{_truncate_data(ga4_data, 3000)}")
    else:
        parts.append("=== GOOGLE ANALYTICS 4 DATA ===\n[Not configured]")

    combined = "\n\n".join(parts)
    user_msg = f"{combined}\n\nQuestion: {question}"

    return _call_openai(_ANALYTICS_SYSTEM_PROMPT, user_msg, max_tokens=800)
