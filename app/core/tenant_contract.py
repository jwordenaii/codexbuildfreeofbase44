"""tenant_contract.py — shared tenant manifest contract + loaders.

This module centralizes validation and reading of
src/config/siteFactoryManifest.json so backend services do not duplicate
tenant/hostname parsing logic.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_MANIFEST_PATH = (
    Path(__file__).resolve().parents[2] / "src" / "config" / "siteFactoryManifest.json"
)


class MarketGeo(BaseModel):
    region: str | None = None
    placename: str | None = None
    position: str | None = None
    icbm: str | None = None


class MarketConfig(BaseModel):
    marketName: str | None = None
    primaryRegion: str | None = None
    primaryMetro: str | None = None
    heroKicker: str | None = None
    heroHeadline: str | None = None
    heroBody: str | None = None
    ctaLabel: str | None = None
    phoneDisplay: str | None = None
    proofHeadline: str | None = None
    geo: MarketGeo | None = None


class TenantProfile(BaseModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    canonicalUrl: str = Field(min_length=1)
    primaryColor: str | None = None
    accentColor: str | None = None
    routeMode: str | None = None
    enableChatWidget: bool | None = None
    market: MarketConfig | None = None


class SiteFactoryManifest(BaseModel):
    profiles: list[TenantProfile] = Field(default_factory=list)
    hostnames: dict[str, str] = Field(default_factory=dict)


def infer_default_state(profile: TenantProfile) -> str:
    key = (profile.key or "").lower()
    if key == "jworden":
        return "VA"
    if key == "minnesota":
        return "MN"

    region = ((profile.market.primaryRegion if profile.market else "") or "").lower()
    if "minnesota" in region:
        return "MN"
    return "VA"


@lru_cache(maxsize=1)
def load_site_factory_manifest() -> SiteFactoryManifest:
    try:
        with _MANIFEST_PATH.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        return SiteFactoryManifest.model_validate(raw)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Failed to load tenant manifest (%s). Falling back to jworden only.", exc
        )
        return SiteFactoryManifest(
            profiles=[
                TenantProfile(
                    key="jworden",
                    label="J. Worden Asphalt Paving",
                    canonicalUrl="https://www.jwordenasphaltpaving.com",
                    routeMode="full-site",
                    enableChatWidget=True,
                )
            ],
            hostnames={
                "www.jwordenasphaltpaving.com": "jworden",
                "jwordenasphaltpaving.com": "jworden",
            },
        )


def profiles_by_key() -> dict[str, TenantProfile]:
    manifest = load_site_factory_manifest()
    return {p.key: p for p in manifest.profiles}
