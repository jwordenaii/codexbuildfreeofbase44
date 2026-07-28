"""
llm_client.py — Unified multi-provider LLM router for J. Worden & Sons.

This is the single source of truth for every AI call in the backend.
Every other service (ai_engine, analytics_ai, proposal_generator,
review_responder, vision_takeoff, math_ai_service, national_permits,
material_prices, the Jarvis command-center assistant, etc.) MUST go
through `chat()` here — never instantiate a provider SDK directly.

────────────────────────────────────────────────────────────────────────────
Routing philosophy
────────────────────────────────────────────────────────────────────────────
Every model has ONE job it does better than the others. No redundancy.

  TASK                    → PRIMARY                          → FALLBACK
  ──────────────────────────────────────────────────────────────────────
    jarvis                  → claude-sonnet-4-6                → gpt-4o → grok-4 → gemini-2.5-pro → claude-opus-4-6
  reasoning / persona     → claude-sonnet-4-6                → gpt-4o
  proposals / contracts   → claude-sonnet-4-6                → gpt-4o
  review_reply            → claude-sonnet-4-6                → gpt-4o
  legal / compliance      → claude-opus-4-6                  → claude-sonnet-4-6
  vision                  → gpt-4o                           → gemini-2.5-pro
  math / long_context     → gemini-2.5-pro                   → claude-sonnet-4-6
  web_research            → perplexity-sonar-pro             → gpt-4o
  social_signal (X)       → grok-4                           → (none)
    fast / classification   → gpt-4o-mini                      → claude-sonnet-4-6
  analytics               → claude-sonnet-4-6                → gpt-4o

Note on Opus 4.6 vs 4.7: 4.6 is the default because 4.7's updated tokenizer
can produce up to ~35% more tokens for the same input → higher effective
cost. Set JARVIS_MODEL_OVERRIDE=claude-opus-4-7 to upgrade Jarvis only.

────────────────────────────────────────────────────────────────────────────
Environment variables (set in Railway → Variables)
────────────────────────────────────────────────────────────────────────────
  OPENAI_API_KEY        — OpenAI (GPT-4o, GPT-4o-mini, embeddings)
  ANTHROPIC_API_KEY     — Anthropic (Claude Opus 4, Sonnet 4.5, Haiku 4)
  GOOGLE_API_KEY        — Google AI Studio (Gemini 2.5 Pro)
  PERPLEXITY_API_KEY    — Perplexity (Sonar Pro — live web + citations)
  XAI_API_KEY           — xAI (Grok 4 — X firehose)
  LLM_FALLBACK_SILENT   — "1" (default): silently fall through on error.
                           "0": raise on primary failure.
  JARVIS_MAX_TIER       — "opus" (default) | "sonnet". Caps Jarvis spend.
    JARVIS_MODEL_OVERRIDE — Optional model name for jarvis/persona/jarvis_fast,
                                                     e.g. "claude-opus-4-7" or "gpt-4o".
    JARVIS_DISABLE_GEMINI — "1" disables Google/Gemini in jarvis lanes only.
    LLM_DISABLED_PROVIDERS — Comma-separated global provider denylist,
                                                     e.g. "google,xai".

Missing keys are tolerated — the router falls through to the next
configured provider, then finally returns ("", error=True). Callers MUST
check `error` and degrade gracefully (most already do via stub paths).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

from app.services import runtime_config as _cfg

logger = logging.getLogger(__name__)

# ── Task routing table ───────────────────────────────────────────────────────
# Order = preference. Router tries left-to-right until one succeeds.

_ROUTES: dict[str, list[tuple[str, str]]] = {
    # task             provider_chain (provider, model)
    # Jarvis and the conversational persona run on the flagship. This is the
    # lane the owner actually talks to: it was pinned to claude-sonnet-4-6, a
    # full generation behind, while /jarvis/readiness advertised the tool
    # lane's claude-opus-5 — so the reported model and the answering model
    # were different things.
    "jarvis":          [("anthropic", "claude-opus-5"),       ("anthropic", "claude-sonnet-5"),   ("openai", "gpt-4o"),               ("xai", "grok-4"),                   ("google", "gemini-2.5-pro")],
    "jarvis_fast":     [("anthropic", "claude-sonnet-5"),     ("openai", "gpt-4o-mini"),          ("xai", "grok-4"),                  ("google", "gemini-2.5-pro"),        ("openai", "gpt-4o")],
    "reasoning":       [("anthropic", "claude-opus-5"),       ("anthropic", "claude-sonnet-5"),   ("openai", "gpt-4o")],
    "persona":         [("anthropic", "claude-opus-5"),       ("anthropic", "claude-sonnet-5"),   ("openai", "gpt-4o")],
    "proposal":        [("anthropic", "claude-opus-5"),       ("anthropic", "claude-sonnet-5"),   ("openai", "gpt-4o")],
    "review_reply":    [("anthropic", "claude-sonnet-5"),     ("openai", "gpt-4o")],
    "legal":           [("anthropic", "claude-opus-5"),       ("anthropic", "claude-sonnet-5"),   ("openai", "gpt-4o")],
    "vision":          [("anthropic", "claude-opus-5"),       ("openai", "gpt-4o"),               ("google", "gemini-2.5-pro")],
    "math":            [("anthropic", "claude-opus-5"),       ("google", "gemini-2.5-pro"),       ("openai", "gpt-4o")],
    "long_context":    [("anthropic", "claude-opus-5"),       ("google", "gemini-2.5-pro"),       ("anthropic", "claude-sonnet-5")],
    "web_research":    [("perplexity", "sonar-pro"),          ("openai", "gpt-4o")],
    "social_signal":   [("xai", "grok-4")],
    "fast":            [("anthropic", "claude-haiku-4-5-20251001"), ("openai", "gpt-4o-mini")],
    "classification":  [("anthropic", "claude-haiku-4-5-20251001"), ("openai", "gpt-4o-mini")],
    "analytics":       [("anthropic", "claude-sonnet-5"),     ("openai", "gpt-4o")],
    "city_authority":  [("google", "gemini-2.5-flash"),       ("openai", "gpt-4o")],
}

_DEFAULT_TASK = "reasoning"


def _silent_fallback() -> bool:
    raw = _cfg.get("LLM_FALLBACK_SILENT")
    return (raw or "1") != "0"


def _jarvis_cap() -> str:
    return (_cfg.get("JARVIS_MAX_TIER") or "opus").lower()


def _env_flag(name: str, *, default: bool = False) -> bool:
    raw = (_cfg.get(name) or "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _disabled_providers() -> set[str]:
    raw = (_cfg.get("LLM_DISABLED_PROVIDERS") or "").strip().lower()
    if not raw:
        return set()
    return {p.strip() for p in raw.split(",") if p.strip()}


def _jarvis_model_override() -> str:
    return (_cfg.get("JARVIS_MODEL_OVERRIDE") or "").strip()


def _jarvis_disable_gemini() -> bool:
    # Keep backward compatibility in case older deployments used GOOGLE wording.
    return _env_flag("JARVIS_DISABLE_GEMINI") or _env_flag("JARVIS_DISABLE_GOOGLE")


def _provider_for_model(model: str) -> Optional[str]:
    m = (model or "").strip().lower()
    if not m:
        return None
    if m.startswith("claude"):
        return "anthropic"
    if m.startswith("gpt") or m.startswith("o1") or m.startswith("o3"):
        return "openai"
    if m.startswith("gemini"):
        return "google"
    if m.startswith("grok"):
        return "xai"
    if m.startswith("sonar"):
        return "perplexity"
    return None


def _resolved_chain(task: str) -> list[tuple[str, str]]:
    chain = list(_ROUTES.get(task) or _ROUTES[_DEFAULT_TASK])

    # Jarvis spend cap: optionally downgrade Opus → Sonnet.
    #
    # This substitution is keyed to the exact model names in _ROUTES. When the
    # table moved to the Claude 5 family the old pair stopped matching anything,
    # which made JARVIS_MAX_TIER=sonnet a silent no-op — the cap looked set and
    # spend carried on at Opus rates. Keeping the historic pair as well means an
    # older pinned route still downgrades correctly.
    if task == "jarvis" and _jarvis_cap() == "sonnet":
        downgrades = {
            "claude-opus-5": "claude-sonnet-5",
            "claude-opus-4-6": "claude-sonnet-4-6",
        }
        chain = [(p, downgrades.get(m, m)) for p, m in chain]

    if task in {"jarvis", "jarvis_fast", "persona"}:
        if _jarvis_disable_gemini():
            chain = [(p, m) for p, m in chain if p != "google"]

        model = _jarvis_model_override()
        if model:
            provider = _provider_for_model(model)
            if provider:
                chain = [(provider, model)] + chain
            else:
                logger.warning("Ignoring JARVIS_MODEL_OVERRIDE with unknown provider: %s", model)

    disabled = _disabled_providers()
    if disabled:
        chain = [(p, m) for p, m in chain if p not in disabled]

    # Deduplicate exact entries while preserving order.
    deduped: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for pair in chain:
        if pair in seen:
            continue
        seen.add(pair)
        deduped.append(pair)
    return deduped


# ── Public dataclass ─────────────────────────────────────────────────────────

@dataclass
class LLMResponse:
    text: str
    provider: str       # "openai" | "anthropic" | "google" | "perplexity" | "xai" | "none"
    model: str          # actual model name used
    error: bool = False
    fallback_used: bool = False
    error_detail: Optional[str] = None


# ── Provider client singletons ───────────────────────────────────────────────

_openai_client: Any = None
_anthropic_client: Any = None
_google_client: Any = None
_perplexity_client: Any = None
_xai_client: Any = None


def _get_openai() -> Any:
    global _openai_client
    if _openai_client is not None:
        return _openai_client
    key = _cfg.get("OPENAI_API_KEY")
    if not key:
        return None
    try:
        from openai import OpenAI  # type: ignore
        _openai_client = OpenAI(api_key=key)
        return _openai_client
    except Exception as exc:  # noqa: BLE001
        logger.error("OpenAI client init failed: %s", exc)
        return None


def _get_anthropic() -> Any:
    global _anthropic_client
    if _anthropic_client is not None:
        return _anthropic_client
    key = _cfg.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    try:
        from anthropic import Anthropic  # type: ignore
        _anthropic_client = Anthropic(api_key=key)
        return _anthropic_client
    except Exception as exc:  # noqa: BLE001
        logger.error("Anthropic client init failed: %s", exc)
        return None


def _google_key() -> str:
    # Backward-compatible key resolution: support both naming conventions.
    return _cfg.get("GOOGLE_API_KEY").strip() or _cfg.get("GEMINI_API_KEY").strip()


def _get_google() -> Any:
    global _google_client
    if _google_client is not None:
        return _google_client
    key = _google_key()
    if not key:
        return None
    try:
        from google import genai  # type: ignore
        _google_client = genai.Client(api_key=key)
        return _google_client
    except Exception as exc:  # noqa: BLE001
        logger.error("Google GenAI client init failed: %s", exc)
        return None


def _get_perplexity() -> Any:
    """Perplexity uses an OpenAI-compatible endpoint."""
    global _perplexity_client
    if _perplexity_client is not None:
        return _perplexity_client
    key = _cfg.get("PERPLEXITY_API_KEY")
    if not key:
        return None
    try:
        from openai import OpenAI  # type: ignore
        _perplexity_client = OpenAI(api_key=key, base_url="https://api.perplexity.ai")
        return _perplexity_client
    except Exception as exc:  # noqa: BLE001
        logger.error("Perplexity client init failed: %s", exc)
        return None


def _get_xai() -> Any:
    """xAI (Grok) uses an OpenAI-compatible endpoint."""
    global _xai_client
    if _xai_client is not None:
        return _xai_client
    key = _cfg.get("XAI_API_KEY")
    if not key:
        return None
    try:
        from openai import OpenAI  # type: ignore
        _xai_client = OpenAI(api_key=key, base_url="https://api.x.ai/v1")
        return _xai_client
    except Exception as exc:  # noqa: BLE001
        logger.error("xAI client init failed: %s", exc)
        return None


# ── Per-provider call shims ──────────────────────────────────────────────────

def _call_openai_compatible(
    client: Any,
    model: str,
    system: str,
    user: str,
    history: Optional[list[dict]],
    max_tokens: int,
    temperature: float,
) -> str:
    msgs: list[dict] = []
    if system:
        msgs.append({"role": "system", "content": system})
    if history:
        msgs.extend(history)
    msgs.append({"role": "user", "content": user})
    resp = client.chat.completions.create(
        model=model,
        messages=msgs,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""


# Models that reject temperature / top_p / top_k outright. Matched by prefix so
# a future claude-opus-5-something is covered without another edit here.
_SAMPLING_FREE_PREFIXES = ("claude-opus-5", "claude-sonnet-5", "claude-fable-5", "claude-mythos-5")


def _is_sampling_free(model: str) -> bool:
    return str(model or "").startswith(_SAMPLING_FREE_PREFIXES)


def _call_anthropic(
    client: Any,
    model: str,
    system: str,
    user: str,
    history: Optional[list[dict]],
    max_tokens: int,
    temperature: float,
) -> str:
    msgs: list[dict] = []
    if history:
        # Anthropic accepts the same role/content shape, but only user/assistant.
        for m in history:
            role = m.get("role")
            if role in ("user", "assistant"):
                msgs.append({"role": role, "content": m.get("content", "")})
    msgs.append({"role": "user", "content": user})

    kwargs: dict[str, Any] = {
        "model": model,
        "system": system or "",
        "messages": msgs,
        "max_tokens": max_tokens,
    }
    # Claude 5 removed the sampling parameters: sending temperature to
    # claude-opus-5 / claude-sonnet-5 is a 400, not a warning. The router
    # catches that and silently moves to the next provider in the chain, so
    # the visible symptom would be Jarvis quietly answering from GPT-4o while
    # readiness still reported an Anthropic model. Older Claude models and
    # every other provider still take it.
    if not _is_sampling_free(model):
        kwargs["temperature"] = temperature

    resp = client.messages.create(**kwargs)
    # Anthropic returns a list of content blocks
    parts = []
    for block in getattr(resp, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


def _call_google(
    client: Any,
    model: str,
    system: str,
    user: str,
    history: Optional[list[dict]],
    max_tokens: int,
    temperature: float,
) -> str:
    # google-genai SDK — pack system into the prompt prefix; history flattened.
    prefix = f"{system}\n\n" if system else ""
    convo = ""
    if history:
        for m in history:
            r = m.get("role", "user").upper()
            convo += f"{r}: {m.get('content','')}\n"
    full = f"{prefix}{convo}USER: {user}".strip()
    resp = client.models.generate_content(
        model=model,
        contents=full,
        config={
            "max_output_tokens": max_tokens,
            "temperature": temperature,
        },
    )
    return (getattr(resp, "text", "") or "").strip()


# ── Provider dispatch ────────────────────────────────────────────────────────

def _try_provider(
    provider: str,
    model: str,
    system: str,
    user: str,
    history: Optional[list[dict]],
    max_tokens: int,
    temperature: float,
) -> tuple[str, Optional[str]]:
    """Returns (text, error_detail). text == '' indicates failure."""
    try:
        if provider == "openai":
            client = _get_openai()
            if client is None:
                return "", "OPENAI_API_KEY missing"
            return _call_openai_compatible(client, model, system, user, history, max_tokens, temperature), None
        if provider == "anthropic":
            client = _get_anthropic()
            if client is None:
                return "", "ANTHROPIC_API_KEY missing"
            return _call_anthropic(client, model, system, user, history, max_tokens, temperature), None
        if provider == "google":
            client = _get_google()
            if client is None:
                return "", "GOOGLE_API_KEY or GEMINI_API_KEY missing"
            return _call_google(client, model, system, user, history, max_tokens, temperature), None
        if provider == "perplexity":
            client = _get_perplexity()
            if client is None:
                return "", "PERPLEXITY_API_KEY missing"
            return _call_openai_compatible(client, model, system, user, history, max_tokens, temperature), None
        if provider == "xai":
            client = _get_xai()
            if client is None:
                return "", "XAI_API_KEY missing"
            return _call_openai_compatible(client, model, system, user, history, max_tokens, temperature), None
        return "", f"unknown provider: {provider}"
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM provider %s/%s failed: %s", provider, model, exc)
        return "", str(exc)


# ── Public API ───────────────────────────────────────────────────────────────

def chat(
    *,
    task: str = _DEFAULT_TASK,
    system: str = "",
    user: str,
    history: Optional[list[dict]] = None,
    max_tokens: int = 600,
    temperature: float = 0.5,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
) -> LLMResponse:
    """
    Route an LLM call through the best provider for `task`, with silent
    fallback through the rest of the provider chain.

    Args:
      task:             routing key — see _ROUTES at top of file.
      system:           system prompt.
      user:             user message.
      history:          optional [{"role": "user"|"assistant", "content": str}, ...]
      max_tokens:       output cap.
      temperature:      sampling temperature.
      provider_override: skip routing table; force this provider.
      model_override:   pair with provider_override to force a specific model.
    """
    # Direct override path (e.g. for one-off experiments or admin tools)
    if provider_override:
        text, err = _try_provider(
            provider_override,
            model_override or "",
            system, user, history, max_tokens, temperature,
        )
        return LLMResponse(
            text=text,
            provider=provider_override if text else "none",
            model=model_override or "",
            error=not text,
            error_detail=err,
        )

    chain = _resolved_chain(task)

    if not chain:
        return LLMResponse(
            text="",
            provider="none",
            model="",
            error=True,
            fallback_used=False,
            error_detail=f"No providers enabled for task '{task}'",
        )

    last_err: Optional[str] = None
    for idx, (provider, model) in enumerate(chain):
        text, err = _try_provider(
            provider, model, system, user, history, max_tokens, temperature,
        )
        if text:
            return LLMResponse(
                text=text,
                provider=provider,
                model=model,
                error=False,
                fallback_used=idx > 0,
            )
        last_err = err
        if not _silent_fallback() and idx == 0:
            break

    return LLMResponse(
        text="",
        provider="none",
        model="",
        error=True,
        fallback_used=len(chain) > 1,
        error_detail=last_err,
    )


def provider_status() -> dict[str, bool]:
    """Lightweight health check — which providers have an API key configured."""
    return {
        "openai":     bool(_cfg.get("OPENAI_API_KEY")),
        "anthropic":  bool(_cfg.get("ANTHROPIC_API_KEY")),
        "google":     bool(_google_key()),
        "perplexity": bool(_cfg.get("PERPLEXITY_API_KEY")),
        "xai":        bool(_cfg.get("XAI_API_KEY")),
    }
