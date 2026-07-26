from __future__ import annotations
import logging
import os
import asyncio
import re
import time
from typing import Dict, Any, List, Optional
from app.services import autonomy_state
from app.services import web_search as _web_search
from app.services import vapi_caller as _vapi
from app.services import email_service as _email
from app.services import runtime_config as _cfg
from app.services import llm_client as _llm
from app.services import jarvis_observability as _jarvis_obs
from app.services import code_reader as _code
from app.services import action_planner as _planner
from app.services import safe_runner as _runner
from app.services import short_memory
from app.services import state_data as _state_data
from app.services.jarvis_access import (
    ROLE_OWNER_ROOT,
    ROLE_PUBLIC_CONCIERGE,
    ROLE_STAFF_OPERATOR,
)

logger = logging.getLogger(__name__)

# ── Optional Anthropic Claude brain ───────────────────────────────────────────
# When ANTHROPIC_API_KEY is set (env OR runtime config), Jarvis routes free-form
# queries through Claude with a JWordenAI-aware system prompt. Falls back
# gracefully to canned responses when the key is missing or the call fails.
def _anthropic_key()   -> str: return _cfg.get("ANTHROPIC_API_KEY")
def _effort() -> str:
    """low | medium | high | xhigh | max — depth vs latency for a chat turn."""
    raw = (_cfg.get("JARVIS_EFFORT") or "medium").strip().lower()
    return raw if raw in {"low", "medium", "high", "xhigh", "max"} else "medium"


def _anthropic_model() -> str:
    """Model for the direct tool-calling path (raw HTTP, not via llm_client).

    This is the lane the operator actually converses with, so it runs the
    flagship. Note this payload never sends `temperature` — sampling params
    return a 400 on the current generation, which is why the swap is safe
    here but required stripping the parameter in llm_client first."""
    return _cfg.get("ANTHROPIC_MODEL") or "claude-opus-5"
_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_ANTHROPIC_VERSION = "2023-06-01"

JARVIS_SYSTEM_PROMPT = (
    "You are JARVIS, the AI that runs operations for Jeremy Worden at "
    "J. Worden & Sons — a 4th-generation Virginia asphalt paving, sealcoating "
    "and general contracting company operating since 1984.\n\n"

    "HOW YOU TALK\n"
    "Talk like a sharp, unflappable chief of staff who knows this business "
    "cold. Warm, direct, and human — not a form letter and not a chatbot. "
    "Answer the question that was actually asked, in as many words as it "
    "genuinely needs: a sentence for a quick one, real detail when the "
    "question deserves it. Never pad, never open with filler like 'Certainly!' "
    "or 'Great question', and never repeat the question back before answering. "
    "You can be a normal conversation partner — if he's thinking out loud, "
    "think with him.\n\n"

    "WHAT YOU KNOW\n"
    "The Worden engineering standards are non-negotiable and belong in every "
    "spec, bid and estimate: 96% Marshall unit weight compaction minimum, "
    "VDOT Section 315 structural stone base, a +/-$9/ton liquid asphalt oil "
    "shield in all pricing, and zero-downtime DOT medical compliance for crew "
    "scheduling. Reference standards: VDOT Sec 315, ASTM C90/C270, FM Global "
    "RoofNav, ACI 318, AASHTO T99/T180, FAR 48 CFR and Davis-Bacon on federal "
    "work.\n\n"

    "USING YOUR TOOLS\n"
    "You have real tools and they perform real actions. Use web_search "
    "whenever the answer depends on something current — prices, weather, "
    "bid postings, a company, a phone number, anything after your training "
    "data — rather than answering from memory or telling him to look it up "
    "himself. Use make_phone_call to actually place a call and send_email to "
    "actually send mail (default recipient j.wordenandsonspaving@gmail.com). "
    "Never claim you called, sent, or scheduled anything unless you invoked "
    "the tool and it succeeded.\n\n"

    "SAFETY\n"
    "A hard kill switch ('frozen') overrides every autonomous action — honor "
    "it absolutely. When the master autonomy switch is off, propose the action "
    "and ask him to confirm instead of doing it. Legal, licensing, and "
    "compliance answers are advisory guidance rather than legal advice; give "
    "him the practical operational impact and say what needs "
    "jurisdiction-specific verification.\n\n"

    "Be honest about what you do not know or could not verify. He would rather "
    "hear 'I could not confirm that' than a confident guess."
)

# Tool definitions Claude can choose to invoke.
JARVIS_TOOLS = [
    {
        "name": "web_search",
        "description": (
            "Search the live web for current information (news, weather, prices, business hours, "
            "phone numbers, reviews, anything you don't already know). Returns up to 5 results plus "
            "a synthesized answer. Use this whenever the user asks about current events or specific "
            "real-world facts."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "deep":  {"type": "boolean", "description": "Use advanced/deep search (slower, richer). Default false."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "code_search",
        "description": (
            "Search the repository for files or lines matching a query. Returns up to 12 matches with file paths and snippets."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search term"},
                "max_results": {"type": "integer", "description": "Max results to return"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "open_file",
        "description": (
            "Return full contents of a repository file. Use relative path from repo root. Read-only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path, e.g. src/pages/Dashboard.jsx"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_npm",
        "description": "Run a whitelisted npm script from package.json (lint/build/test).",
        "input_schema": {
            "type": "object",
            "properties": {
                "script": {"type": "string", "description": "npm script name to run"},
            },
            "required": ["script"],
        },
    },
    {
        "name": "plan_actions",
        "description": "Create a small action plan from natural language (non-destructive).",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "make_phone_call",
        "description": (
            "Place a real outbound phone call via Vapi voice AI. The Vapi assistant handles the conversation "
            "on the line. Use for: booking restaurant reservations, calling vendors/suppliers, calling leads "
            "to confirm appointments, or any other real-world phone task. Numbers must include country code "
            "(e.g. +18045550100). DO NOT use for emergency services."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to_number":   {"type": "string", "description": "Phone number in E.164 format, e.g. +18045550100"},
                "purpose":     {"type": "string", "description": "Short label for logs, e.g. 'Book reservation at Lemaire 7pm Friday for 2'"},
                "script_hint": {"type": "string", "description": "Optional opening line for the assistant on the call"},
            },
            "required": ["to_number", "purpose"],
        },
    },
    {
        "name": "send_email",
        "description": (
            "Send a transactional email via SendGrid. Use for: sending the operator a document, "
            "emailing summaries, forwarding the master keys list, customer follow-ups, etc. "
            "Default recipient is j.wordenandsonspaving@gmail.com when none is given."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to_email":   {"type": "string", "description": "Recipient email address"},
                "subject":    {"type": "string", "description": "Email subject line"},
                "body":       {"type": "string", "description": "Plain-text body of the email (HTML will be auto-generated)"},
            },
            "required": ["subject", "body"],
        },
    },
]

_SENSITIVE_TOOL_NAMES = {"make_phone_call", "send_email", "run_npm"}
_ROLE_TOOLS: dict[str, set[str]] = {
    ROLE_PUBLIC_CONCIERGE: {"web_search"},
    ROLE_STAFF_OPERATOR: {"web_search", "code_search", "open_file", "plan_actions", "run_npm"},
    ROLE_OWNER_ROOT: {t["name"] for t in JARVIS_TOOLS},
}


def _toolset_for_session(*, confirmed: bool, role: str) -> list[dict]:
    allowed = set(_ROLE_TOOLS.get(role, _ROLE_TOOLS[ROLE_PUBLIC_CONCIERGE]))
    if not confirmed:
        allowed -= _SENSITIVE_TOOL_NAMES
    return [t for t in JARVIS_TOOLS if t.get("name") in allowed]

_ACTION_HINT_RE = re.compile(
    r"\b(call|dial|phone|text|sms|email|send|book|schedule|reserve|pay|order|quote|estimate|create|update|delete|cancel|approve|publish|post|run|launch)\b",
    re.IGNORECASE,
)


def _looks_like_tool_action(query: str) -> bool:
    q = (query or "").strip()
    return bool(_ACTION_HINT_RE.search(q))


_LIVE_INFO_KEYWORDS = {
    "weather", "forecast", "news", "today", "now", "live", "current", "price", "market",
    "traffic", "stock", "breaking",
}

_RESPONSE_CACHE: dict[str, tuple[float, dict]] = {}
_RESPONSE_CACHE_MAX_ITEMS = 200


def _cfg_int(key: str, default: int) -> int:
    raw = (_cfg.get(key) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except Exception:  # noqa: BLE001
        return default


def _low_cost_mode() -> bool:
    raw = (_cfg.get("JARVIS_LOW_COST_MODE") or "0").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def _response_cache_ttl_seconds() -> int:
    # Short TTL avoids stale guidance while still suppressing repeat token spend.
    return _cfg_int("JARVIS_RESPONSE_CACHE_TTL_SECONDS", 180)


def _is_cacheable_query(query: str, *, action_intent: bool) -> bool:
    if action_intent:
        return False
    q = (query or "").strip().lower()
    if not q:
        return False
    return not any(term in q for term in _LIVE_INFO_KEYWORDS)


def _response_cache_key(query: str, persona: str, role: str, confirmed: bool) -> str:
    normalized_query = " ".join((query or "").strip().lower().split())
    return f"{persona}|{role}|{int(bool(confirmed))}|{normalized_query}"


def _response_cache_get(key: Optional[str]) -> Optional[dict]:
    if not key:
        return None
    entry = _RESPONSE_CACHE.get(key)
    if not entry:
        return None
    created_at, payload = entry
    if time.time() - created_at > _response_cache_ttl_seconds():
        _RESPONSE_CACHE.pop(key, None)
        return None
    cached_payload = dict(payload)
    cached_payload["cached"] = True
    return cached_payload


def _response_cache_set(key: Optional[str], payload: dict) -> None:
    if not key:
        return
    _RESPONSE_CACHE[key] = (time.time(), payload)
    if len(_RESPONSE_CACHE) > _RESPONSE_CACHE_MAX_ITEMS:
        oldest_key = min(_RESPONSE_CACHE, key=lambda k: _RESPONSE_CACHE[k][0])
        _RESPONSE_CACHE.pop(oldest_key, None)


_LEGAL_ADVISORY_KEYWORDS = {
    "legal", "law", "laws", "court", "civil", "criminal", "compliance", "regulation",
    "regulations", "license", "licensing", "permit", "bond", "insurance", "osha",
    "lien", "prompt payment", "prevailing wage", "utility", "environmental", "state law",
}

_LEGAL_ADVISORY_SOURCES_SUMMARY = "app/services/state_data.py, app/services/ai_brain.py, src/data/legal/*.js"

_STATE_NAME_TO_ABBR = {
    str(row.get("name", "")).lower(): abbr
    for abbr, row in getattr(_state_data, "STATE_MAP", {}).items()
    if row.get("name")
}


def _is_legal_advisory_query(query: str) -> bool:
    q = (query or "").lower()
    return any(term in q for term in _LEGAL_ADVISORY_KEYWORDS)


def _infer_state_code_from_query(query: str) -> Optional[str]:
    text = query or ""
    # First pass: explicit two-letter abbreviations (e.g., VA, TX, DC)
    for token in re.findall(r"\b[A-Za-z]{2}\b", text):
        normalized = _state_data.normalize_state_code(token)
        if normalized:
            return normalized

    # Second pass: full state names
    q_lower = text.lower()
    for name, abbr in sorted(_STATE_NAME_TO_ABBR.items(), key=lambda item: len(item[0]), reverse=True):
        if name and name in q_lower:
            return abbr
    return None


def _build_advisory_context(query: str) -> str:
    if not _is_legal_advisory_query(query):
        return ""

    state_code = _infer_state_code_from_query(query)
    state_fragment = _state_data.get_state_prompt_fragment(state_code) if state_code else ""
    state_line = f"State focus: {state_code}.\n" if state_code else "State focus: national (no state extracted).\n"
    state_block = f"{state_fragment}\n" if state_fragment else ""

    return (
        "LEGAL ADVISORY MODE\n"
        "This response is advisory operations guidance, not legal advice.\n"
        f"{state_line}"
        f"{state_block}"
        f"Primary source tables: {_LEGAL_ADVISORY_SOURCES_SUMMARY}.\n"
        "When uncertainty exists, explicitly say what to verify and where."
    )


async def _ask_fast_ops_brain(query: str, persona: str, autonomy: dict, *, confirmed: bool = False) -> Optional[dict]:
    """
    Fast no-tool reasoning lane using the unified multi-model router.
    Keeps responses snappy for daily operations Q&A.
    """
    persona_note = (
        "Adopt the 'Mr. Worden Sales' persona: warm, energetic, closing-oriented, Richmond paving expert."
        if persona == "MR_WORDEN_SALES"
        else "Maintain the JARVIS persona with concise executive operations tone."
    )
    ops_snapshot = (
        f"Autonomy master={autonomy.get('master')} frozen={autonomy.get('frozen')} operator_confirmed={confirmed}. "
        f"Tools status: web_search={_web_search.is_available()} call={_vapi.is_available()} email={bool(_cfg.get('SENDGRID_API_KEY').strip())}."
    )
    # include short-term convo memory when available
    mem_snippet = ""
    try:
        session_id = autonomy.get("session_id") if isinstance(autonomy, dict) else None
    except Exception:
        session_id = None
    if not session_id:
        session_id = _cfg.get("LAST_JARVIS_SESSION") or None
    if session_id:
        recent = short_memory.get(session_id)
        if recent:
            mem_snippet = "Recent conversation: " + " | ".join(recent[-3:]) + "\n"

    advisory_context = _build_advisory_context(query)

    system = (
        f"{JARVIS_SYSTEM_PROMPT}\n\n"
        f"{persona_note}\n"
        f"{ops_snapshot}\n"
        f"{mem_snippet}"
        f"{advisory_context}\n"
        "Answer in practical daily-operations format: Situation, Recommendation, Next Action. "
        "For legal/compliance questions include: Advisory Answer, Impact, Verification Needed. "
        "Keep default answers under 6 lines unless asked for a deep dive."
    )

    try:
        max_tokens = _cfg_int("JARVIS_FAST_MAX_TOKENS", 2000 if _low_cost_mode() else 4000)
        resp = await asyncio.to_thread(
            _llm.chat,
            task="jarvis_fast",
            system=system,
            user=query,
            max_tokens=max_tokens,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[JARVIS] Fast ops brain failed: %s", exc)
        return None

    if resp.error or not (resp.text or "").strip():
        return None
    return {
        "text": resp.text.strip(),
        "provider": resp.provider,
        "model": resp.model,
        "fallback_used": bool(resp.fallback_used),
    }


async def _ask_chat_brain(query: str, persona: str, autonomy: dict, session_id: Optional[str] = None, *, confirmed: bool = False) -> Optional[dict]:
    """
    Human-like conversational lane. Uses the multi-provider router via _llm.chat
    with a persona-focused system prompt and recent short-term memory.
    """
    persona_note = (
        "You are Jarvis: warm, conversational, helpful, concise but friendly. Ask clarifying questions when unsure."
        if persona == "JARVIS"
        else f"Adopt persona: {persona}. Be helpful and conversational."
    )

    mem_snippet = ""
    try:
        sid = session_id or (autonomy.get("session_id") if isinstance(autonomy, dict) else None)
    except Exception:
        sid = session_id
    if sid:
        recent = short_memory.get(sid)
        if recent:
            mem_snippet = "Recent conversation: " + " | ".join(recent[-4:]) + "\n"

    advisory_context = _build_advisory_context(query)

    system = (
        f"You are JARVIS, a conversational AI assistant for Jeremy Worden. {persona_note}\n"
        "Be natural, human, and helpful. Keep answers clear and friendly. If the user asks for facts that may be out-of-date, offer to search the web."
        "\n" + mem_snippet + advisory_context + "\n"
        "For legal/compliance questions, answer in advisory form and include likely operational impact and verification steps."
    )

    try:
        max_tokens = _cfg_int("JARVIS_CHAT_MAX_TOKENS", 4000 if _low_cost_mode() else 8000)
        resp = await asyncio.to_thread(
            _llm.chat,
            task="persona",
            system=system,
            user=query,
            max_tokens=max_tokens,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[JARVIS] Chat brain failed: %s", exc)
        return None

    if resp.error or not (resp.text or "").strip():
        return None
    return {"text": resp.text.strip(), "provider": resp.provider, "model": resp.model, "fallback_used": bool(resp.fallback_used)}


async def _run_tool(
    name: str,
    args: dict,
    *,
    confirmed: bool = False,
    role: str = ROLE_PUBLIC_CONCIERGE,
    tenant_id: str = "default",
) -> dict:
    allowed = _ROLE_TOOLS.get(role, _ROLE_TOOLS[ROLE_PUBLIC_CONCIERGE])

    def _finalize(result: dict) -> dict:
        ok = bool(result.get("ok")) if "ok" in result else ("error" not in result)
        _jarvis_obs.record_tool_call(tool_name=name, role=role, tenant_id=tenant_id, ok=ok)
        return result

    if name not in allowed:
        return _finalize({"ok": False, "error": "Role policy blocked this tool"})

    if name in _SENSITIVE_TOOL_NAMES and not confirmed:
        return _finalize({"ok": False, "error": "Operator confirmation required for this tool"})

    if name == "web_search":
        result = await _web_search.search(
            args.get("query", ""),
            deep=bool(args.get("deep", False)),
        )
        return _finalize(result)
    if name == "make_phone_call":
        result = await _vapi.place_call(
            args.get("to_number", ""),
            purpose=args.get("purpose", "Jarvis-initiated call"),
            script_hint=args.get("script_hint"),
            confirmed=confirmed,
        )
        return _finalize(result)
    if name == "send_email":
        to_addr = (args.get("to_email") or os.environ.get("ADMIN_NOTIFY_EMAIL") or "j.wordenandsonspaving@gmail.com").strip()
        subject = (args.get("subject") or "Message from Jarvis").strip()
        body    = args.get("body") or ""
        html    = "<pre style='font-family:ui-monospace,Consolas,monospace;white-space:pre-wrap'>" + (body.replace("&", "&amp;").replace("<", "&lt;")) + "</pre>"
        try:
            ok = await asyncio.to_thread(
                _email.send_raw,
                to_email=to_addr, subject=subject, html_body=html, plain_text=body,
            )
            return _finalize({"ok": bool(ok), "to": to_addr, "subject": subject})
        except Exception as exc:
            return _finalize({"ok": False, "error": str(exc)})
    if name == "code_search":
        q = args.get("query") or ""
        maxr = int(args.get("max_results") or 12)
        try:
            matches = _code.search(q, max_results=maxr)
            return _finalize({"ok": True, "matches": matches})
        except Exception as exc:
            return _finalize({"ok": False, "error": str(exc)})
    if name == "open_file":
        path = args.get("path") or ""
        try:
            res = _code.open_file(path)
            return _finalize({"ok": True, "result": res})
        except Exception as exc:
            return _finalize({"ok": False, "error": str(exc)})
    if name == "run_npm":
        script = (args.get("script") or "").strip()
        if not script:
            return _finalize({"ok": False, "error": "no script provided"})
        return _finalize(_runner.run_npm_script(script))
    if name == "plan_actions":
        q = args.get("query") or ""
        plan = _planner.plan(q, {"run_npm": True, "code_search": True, "open_file": True})
        return _finalize({"ok": True, "plan": plan})
    return _finalize({"ok": False, "error": f"Unknown tool: {name}"})


async def _ask_claude(
    query: str,
    persona: str,
    autonomy: dict,
    *,
    confirmed: bool = False,
    role: str = ROLE_PUBLIC_CONCIERGE,
    tenant_id: str = "default",
) -> Optional[dict]:
    """
    Returns {"text": str, "tool_calls": [{name, args, result}, ...]} or None on failure.
    Single-round tool use: Claude proposes tools, we run them, send results back, get final answer.
    """
    if not _anthropic_key():
        return None
    try:
        import httpx  # type: ignore
    except ImportError:
        return None

    persona_note = (
        "Adopt the 'Mr. Worden Sales' persona: warm, energetic, closing-oriented, "
        "Richmond-Virginia paving expert."
        if persona == "MR_WORDEN_SALES"
        else "Maintain the JARVIS persona."
    )
    state_note = (
        f"Current autonomy: master={autonomy.get('master')}, "
        f"frozen={autonomy.get('frozen')}, "
        f"operator_confirmed={confirmed}, "
        f"session_role={role}, "
        f"tenant_id={tenant_id}."
    )
    advisory_context = _build_advisory_context(query)
    advisory_note = ""
    if advisory_context:
        advisory_note = (
            "\nLEGAL ADVISORY RESPONSE REQUIREMENTS:\n"
            "- Treat outputs as advisory guidance only, not legal advice.\n"
            "- Use code_search/open_file only when user asks for citations, row-level proof, or change diffs.\n"
            "- Format legal answers with sections: Advisory Answer, Impact, Verification Needed.\n"
            f"{advisory_context}\n"
        )

    system = f"{JARVIS_SYSTEM_PROMPT}\n\n{persona_note}\n{state_note}{advisory_note}"

    headers = {
        "x-api-key":         _anthropic_key(),
        "anthropic-version": _ANTHROPIC_VERSION,
        "content-type":      "application/json",
    }
    messages: list[dict] = [{"role": "user", "content": query}]
    tool_calls: list[dict] = []

    tools = _toolset_for_session(confirmed=confirmed, role=role)

    # Two-round max: initial → optional tool use → final.
    for _round in range(2):
        try:
            # Thinking + answer share this budget on the current generation;
            # 320 left nothing for the reply once reasoning ran.
            default_tokens = 4000 if _low_cost_mode() else 8000
            max_tokens = int((_cfg.get("JARVIS_CLAUDE_MAX_TOKENS") or str(default_tokens)).strip())
        except Exception:  # noqa: BLE001
            max_tokens = 4000 if _low_cost_mode() else 8000
        payload = {
            "model":      _anthropic_model(),
            "max_tokens": max_tokens,
            "system":     system,
            "tools":      tools,
            "messages":   messages,
            "output_config": {"effort": _effort()},
        }
        try:
            try:
                timeout_s = float((_cfg.get("JARVIS_CLAUDE_TIMEOUT_SECONDS") or "90").strip())
            except Exception:  # noqa: BLE001
                timeout_s = 90.0
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                r = await client.post(_ANTHROPIC_URL, json=payload, headers=headers)
            if r.status_code != 200:
                logger.warning("[JARVIS] Anthropic non-200: %s %s", r.status_code, r.text[:300])
                return None
            data = r.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] Anthropic call failed: %s", exc)
            return None

        stop_reason = data.get("stop_reason")
        content = data.get("content") or []

        if stop_reason == "tool_use":
            # Append assistant turn, then run each tool, then append tool_result message.
            messages.append({"role": "assistant", "content": content})
            tool_results = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    name = block.get("name", "")
                    args = block.get("input", {}) or {}
                    result = await _run_tool(name, args, confirmed=confirmed, role=role, tenant_id=tenant_id)
                    tool_calls.append({"name": name, "args": args, "result": result})
                    tool_results.append({
                        "type":         "tool_result",
                        "tool_use_id":  block.get("id"),
                        "content":      str(result)[:4000],
                    })
            messages.append({"role": "user", "content": tool_results})
            continue  # next round to get the natural-language answer

        # End_turn or anything else — extract text.
        text = "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text").strip()
        return {"text": text or "(no response)", "tool_calls": tool_calls}

    return {"text": "(tool loop exceeded)", "tool_calls": tool_calls}


class JarvisAI:
    """
    JARVIS: Just A Rather Very Intelligent System for JWORDENAI.
    The primary interface for the Command Center.
    Capable of voice-commanded logistics, autonomous paving arbitration, and project funding status.
    """
    
    def __init__(self):
        self.identity = "JARVIS"
        self.master_project = "JWORDENAI PROJECT"
        self.status = "ONLINE"
        self.intel_sources = [
            "Federal Highway Administration (FHWA)",
            "AASHTO Engineering Standards",
            "State DOT Regulatory Guides",
            "University Civil Engineering Research Lab",
            "Global Infrastructure Council",
            "Supreme Court Construction Precedents",
            "50-State + DC Mechanic's Lien & Prompt Pay Codes",
            "National GC Compliance Matrix",
            "Universal Construction Supply Chain Index (Concrete/Steel/Wood/Shingles)",
            "Asphalt & Bitumen Global Resource Monitor",
            "Raw Land & Aggregate Availability Matrix",
            "Carbon-Neutral & LEED v5 Paving Standards",
            "International Trade & Maritime Construction Law",
            "51-State Licensing & Prequalification Databank",
            "OCIP/CCIP Insurance Compliance Protocols",
            "DBE/SWaM/SDVOSB Regulatory Guardrails",
            "Global Banking & Treasury Management APIs",
            "Currency Hedging & Cross-Border Settlement Protocols",
            "Construction Commodities Market (Liquid Asphalt/Crude Oil) Index",
            "Venture Debt & Equity Financing Logic for PF Nodes",
            "Virginia SEO Domination & Local SEM Metrics",
            "JWORDENAI Page Factory Conversion Evidence",
            "Case Study Asset Tracker (Richmond/Midlothian/Virginia Beach)"
        ]
        self.personas = {
            "JARVIS": {
                "greeting": "At your service, Sir.",
                "style": "Sophisticated, helpful, technical, and lifestyle-oriented."
            },
            "MR_WORDEN_SALES": {
                "greeting": "Hey there! Ready to get some paving done?",
                "style": "Energetic, persuasive, industry-expert salesman. Focused on value, durability, and closing deals."
            }
        }

    async def converse(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        The main interaction point for the Command Center.
        A unified intelligence engine combining Lifestyle, Business Events, 
        Global Education, Federal Standards, and Supreme Court Legal Logic.
        """
        context = context or {}
        persona = context.get("persona", "JARVIS")
        confirmed = bool(context.get("confirmed", False))
        role = str(context.get("role") or "").strip()
        if not role:
            role = ROLE_OWNER_ROOT if bool(context.get("operator_mode", False)) else ROLE_PUBLIC_CONCIERGE
        tenant_id = str(context.get("tenant_id") or "default")
        operator_mode = role in {ROLE_STAFF_OPERATOR, ROLE_OWNER_ROOT}
        if role == ROLE_PUBLIC_CONCIERGE:
            confirmed = False
        query_lower = (query or "").lower()

        # ── Defense-in-depth: backend kill switch ─────────────────────────────
        state = autonomy_state.get_state()
        if state.get("frozen"):
            return {
                "source": self.identity,
                "message": (
                    "Sir, autonomy is currently FROZEN by the Command Center kill switch. "
                    "I can answer questions, but I will not take any autonomous action "
                    f"until you unfreeze me. (Frozen since {state.get('frozenAt')})"
                ),
                "action_required": False,
                "frozen": True,
                "intel_tier": "Safety-Override",
            }

        # ── Fast lane: human-like conversational responses without tool overhead ──
        # First, see if this user intent maps to a multi-step plan.
        plan = _planner.plan(query, {"run_npm": True, "code_search": True, "open_file": True})
        if plan and plan.get("intent") == "execute":
            if not operator_mode:
                return {
                    "source": self.identity,
                    "message": "I can help answer and search, but task execution is available only in Command Center operator sessions.",
                    "action_required": False,
                    "requires_operator_mode": True,
                }

            # If operator has not confirmed, return the proposed plan for approval.
            if not confirmed:
                return {
                    "source": self.identity,
                    "message": "I have prepared an action plan. Confirm to execute.",
                    "requires_confirmation": True,
                    "plan": plan,
                    "action_required": True,
                }
            # Operator confirmed — execute sequentially and return results.
            exec_results = []
            for step in plan.get("steps", []):
                name = step.get("action")
                args = step.get("args") or {}
                # determine whether this action requires confirmation (destructive/real-world)
                must_confirm = name in ("run_npm", "make_phone_call", "send_email")
                if must_confirm and not confirmed:
                    exec_results.append({"action": name, "ok": False, "error": "requires confirmation"})
                    continue
                try:
                    res = await _run_tool(name, args, confirmed=confirmed, role=role, tenant_id=tenant_id)
                except Exception as exc:
                    res = {"ok": False, "error": str(exc)}
                exec_results.append({"action": name, "result": res})

            # Synthesize a response summarizing execution
            summary_lines = []
            for r in exec_results:
                act = r.get("action")
                out = r.get("result") or r.get("error") or r
                ok = out.get("ok") if isinstance(out, dict) else False
                summary_lines.append(f"{act}: {'OK' if ok else 'FAILED'}")

            return {
                "source": self.identity,
                "message": "Execution complete.\n" + "\n".join(summary_lines),
                "action_required": False,
                "plan_executed": True,
                "exec_results": exec_results,
            }

        action_intent = _looks_like_tool_action(query)
        cache_key = None
        if _is_cacheable_query(query, action_intent=action_intent):
            cache_key = _response_cache_key(query, persona, role, confirmed)
            cached = _response_cache_get(cache_key)
            if cached:
                return cached

        if not action_intent:
            # Prefer the human-like chat brain for conversational queries.
            chat = await _ask_chat_brain(query, persona, state, session_id=context.get("session_id"), confirmed=confirmed)
            if chat:
                response = {
                    "source": self.identity if persona != "MR_WORDEN_SALES" else "Mr. Worden (Sales)",
                    "message": chat["text"],
                    "action_required": False,
                    "engine": f"{chat['provider']}-chat",
                    "model": chat["model"],
                    "fallback_used": chat.get("fallback_used", False),
                    "tool_calls": [],
                    "autonomy": {"master": state.get("master"), "frozen": False},
                }
                _response_cache_set(cache_key, response)
                return response
            # fallback to a faster ops-focused lane if chat brain did not return
            fast = await _ask_fast_ops_brain(query, persona, state, confirmed=confirmed)
            if fast:
                response = {
                    "source": self.identity if persona != "MR_WORDEN_SALES" else "Mr. Worden (Sales)",
                    "message": fast["text"],
                    "action_required": False,
                    "engine": f"{fast['provider']}-stark-fast",
                    "model": fast["model"],
                    "fallback_used": fast["fallback_used"],
                    "tool_calls": [],
                    "autonomy": {"master": state.get("master"), "frozen": False},
                }
                _response_cache_set(cache_key, response)
                return response

        # ── Brain: Anthropic Claude (when configured) ─────────────────────────
        claude = await _ask_claude(query, persona, state, confirmed=confirmed, role=role, tenant_id=tenant_id)
        if claude:
            response = {
                "source":          self.identity if persona != "MR_WORDEN_SALES" else "Mr. Worden (Sales)",
                "message":         claude["text"],
                "action_required": False,
                "engine":          "anthropic-claude",
                "model":           _anthropic_model(),
                "tool_calls":      claude["tool_calls"],
                "autonomy":        {"master": state.get("master"), "frozen": False},
            }
            _response_cache_set(cache_key, response)
            return response

        # ── Fallback: legacy heuristic responses ──────────────────────────────
        if persona == "MR_WORDEN_SALES":
            return await self._converse_mr_worden_sales(query_lower, context)

        # ── Degraded-mode fallback ───────────────────────────────────────────
        # Reached only when no LLM brain (Claude / chat / fast-ops) answered —
        # e.g. no API key configured or every provider call failed. This path
        # must NEVER assert specific business facts (dollar amounts, ranking
        # positions, compliance-check results) it has no data behind — say so
        # plainly instead and point at the real source of truth.
        degraded_notice = (
            "Sir, my language-model brain is unavailable right now (no configured "
            "provider responded), so I'm running in degraded mode. I won't fabricate "
            "specific figures or statuses here — please check the Command Center "
            "dashboards directly for live data. "
        )

        if any(w in query_lower for w in ["weather", "forecast", "news", "trend", "market", "finance", "bank", "money", "capital", "revenue", "income", "commodity", "material", "supply", "concrete", "shingle", "asphalt", "aggregate", "stone", "seo", "rank", "google", "search", "virginia", "marketing", "sealcoat", "sealcoating"]):
            return {
                "source": self.identity,
                "message": (
                    f"{degraded_notice}\n\n"
                    "For real SEO/ranking status, check Google Search Console and the "
                    "site's own analytics — I don't have a live ranking feed in this "
                    "degraded mode and won't guess at position numbers."
                ),
                "action_required": False,
                "degraded": True,
            }

        # Business events context
        if any(w in query_lower for w in ["update", "status", "recent", "happen", "estimate", "payment"]):
            return {
                "source": self.identity,
                "message": f"{degraded_notice}\n\nFor real estimate/payment status, check the CRM/billing dashboard directly.",
                "action_required": False,
                "degraded": True,
            }

        # Legal & education context
        if any(w in query_lower for w in ["education", "learn", "legal", "law", "supreme", "compliance", "standard", "research", "carbon", "green", "maritime", "guardrail", "license", "insurance", "bond"]):
            return {
                "source": self.identity,
                "message": (
                    f"{degraded_notice}\n\n"
                    "For licensing/compliance questions, use the /api/v1/compliance endpoints "
                    "directly (real 50-state + DC license matrix) rather than relying on this "
                    "degraded chat fallback — that data is real; this response path is not."
                ),
                "action_required": False,
                "degraded": True,
            }

        # Catch-all
        return {
            "source": self.identity,
            "message": degraded_notice,
            "action_required": False,
            "degraded": True,
        }

    async def _converse_mr_worden_sales(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Salesman Mr. Worden Persona Logic.
        Upgraded to report on actual business events (Estimates, Payments).
        """
        # Event Report Logic
        if any(w in query for w in ["update", "status", "estimate", "payment", "notification"]):
            return {
                "source": "Mr. Worden (Sales)",
                "message": "I don't have my AI brain online right now, so I can't pull real numbers for you — check the CRM/billing dashboard directly for the latest estimates and payments.",
                "action_required": False,
                "degraded": True,
            }

        if any(w in query for w in ["price", "cost", "quote", "deal"]):
            return {
                "source": "Mr. Worden (Sales)",
                "message": "Listen, we're not just talkin' about blacktop here. We're talkin' about an investment in your property's curb appeal. I can get you a quote that'll make your neighbors jealous. Quality pavin' doesn't cost, it pays!",
                "action_required": True,
                "suggested_action": "Generate Quote"
            }
        
        if any(w in query for w in ["why", "better", "quality", "durability"]):
            return {
                "source": "Mr. Worden (Sales)",
                "message": "Why choose Worden? Simple. We use the highest quality mix, the heaviest rollers, and we don't cut corners. Your driveway will be the talk of Virginia for years to come. Ready to sign?",
                "action_required": False
            }

        if any(w in query for w in ["hello", "hi", "hey"]):
            return {
                "source": "Mr. Worden (Sales)",
                "message": "Hey! Mr. Worden here. I've been lookin' at your project and I'm tellin' you, we can make this look incredible. What can I do to earn your business today?",
                "action_required": False
            }

        return {
            "source": "Mr. Worden (Sales)",
            "message": "I'm ready to close this deal. Tell me what you're lookin' for, and I'll make sure the crew does it right. We're the best in the business!",
            "action_required": False
        }

jarvis = JarvisAI()
