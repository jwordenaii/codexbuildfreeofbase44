"""
ai_foreman.py — J. Worden | Authority content engine.

Generates hyper-local, equipment-specific "Verified Proof" content for city
pages. Designed to win the May 2026 Google Core Update by producing
structurally sound, technically credible per-city copy instead of generic
marketing fluff.

Architecture:
  Caller (router / build script) → generate_city_proof()
                                   → llm_client.chat(task='city_authority', ...)
                                   → Gemini 2.5 Flash (primary)
                                       or GPT-4o (fallback)

Tenant-aware from day 1: every call carries a `tenant` key so the same
engine serves J. Worden's own city grid AND any enterprise customer sites
spun up via the Website Factory. The brand descriptor and home base
strings change per tenant; the prompt structure and temperature do not.

Direct provider SDK imports are NOT allowed here — all LLM traffic flows
through app/services/llm_client.py per the project-wide rule.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from app.core.tenant_contract import infer_default_state, profiles_by_key
from app.services import llm_client

logger = logging.getLogger(__name__)


# ── Tenant brand presets ─────────────────────────────────────────────────────
# Defaults preserved verbatim from Gemini Pro's original spec for the
# `jworden` tenant. New tenants register here when they're onboarded via
# scripts/add-site-to-factory.mjs (future automation can sync this from
# siteFactoryManifest.json).

_TENANT_BRANDS: dict[str, dict[str, str]] = {
    "jworden": {
        "brand_descriptor": (
            "J. Worden | Authority, the digital foreman for a 4th-generation "
            "Virginia Class A asphalt paving contractor serving Richmond & Central Virginia"
        ),
        "default_state": "VA",
    },
}

_DEFAULT_TENANT = "jworden"


def _load_manifest_brands() -> dict[str, dict[str, str]]:
    try:
        brands: dict[str, dict[str, str]] = {}
        for key, profile in profiles_by_key().items():
            if not key:
                continue
            label = (profile.label or key).strip()
            brands[key] = {
                "brand_descriptor": (
                    f"{label}, an enterprise asphalt and operations platform "
                    "focused on technically credible project documentation"
                ),
                "default_state": infer_default_state(profile),
            }
        return brands
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Could not load siteFactoryManifest.json for tenant branding (%s)", exc
        )
        return {}


_TENANT_BRANDS = {**_TENANT_BRANDS, **_load_manifest_brands()}


def _brand_for(tenant: str) -> dict[str, str]:
    return _TENANT_BRANDS.get(tenant) or _TENANT_BRANDS[_DEFAULT_TENANT]


# ── Response dataclass ──────────────────────────────────────────────────────


@dataclass
class AuthorityProof:
    """Result of one Authority-engine generation call."""

    text: str
    tenant: str
    city: str
    model: str  # actual model used (resolved by llm_client)
    provider: str  # "google" | "openai" | ...
    fallback_used: bool  # true if primary failed and a fallback succeeded
    latency_ms: int  # round-trip time including provider fallthrough


# ── Public API ──────────────────────────────────────────────────────────────


def generate_city_proof(
    city_name: str,
    equipment_used: list[str],
    project_type: str = "commercial parking lot repaving",
    *,
    tenant: str = _DEFAULT_TENANT,
    state: str | None = None,
) -> AuthorityProof:
    """
    Generate a 3-sentence technical proof statement for one city.

    The output emphasizes equipment specs, structural durability, and local
    geographic relevance — no marketing fluff. Suitable for prerendering
    into city-page HTML for SEO.

    Args:
      city_name:      e.g. "Richmond"
      equipment_used: e.g. ["Mauldin 690", "LeeBoy"]
      project_type:   e.g. "commercial parking lot repaving"
      tenant:         site-factory profile key (default "jworden")
      state:          override the tenant's default state (e.g. "NC" for OBX)

    Returns:
      AuthorityProof with the generated text and call metadata.

    Raises:
      RuntimeError: if all providers in the city_authority chain fail.
    """
    brand = _brand_for(tenant)
    state_code = state or brand.get("default_state", "VA")
    equipment_str = (
        ", ".join(equipment_used) if equipment_used else "standard paving equipment"
    )

    system_prompt = (
        f"You are {brand['brand_descriptor']}. "
        "Write highly technical, strictly factual project descriptions emphasizing heavy machinery, "
        "structural durability, and local zoning compliance. Do not use generic marketing fluff."
    )

    user_prompt = (
        f"Write a 3-sentence technical summary for a {project_type} completed in {city_name}, {state_code}. "
        f"You must specifically mention the deployment of the following equipment: {equipment_str}. "
        "Emphasize the operational efficiency and minimal disruption to the client."
    )

    start = time.monotonic()
    response = llm_client.chat(
        task="city_authority",
        system=system_prompt,
        user=user_prompt,
        max_tokens=200,
        temperature=0.2,
    )
    latency_ms = int((time.monotonic() - start) * 1000)

    if response.error or not response.text:
        logger.error(
            "Authority engine failed for tenant=%s city=%s: %s",
            tenant,
            city_name,
            response.error_detail,
        )
        raise RuntimeError(
            f"Authority Engine unavailable: {response.error_detail or 'no providers responded'}"
        )

    return AuthorityProof(
        text=response.text.strip(),
        tenant=tenant,
        city=city_name,
        model=response.model,
        provider=response.provider,
        fallback_used=response.fallback_used,
        latency_ms=latency_ms,
    )
