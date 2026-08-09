"""Aerial imagery provider — pluggable interface with Google Maps Static + mock fallback.

⚠ ToS notice (Google Maps Static API):
  Google Maps Platform Terms of Service §3.2.3 prohibit caching or storing map content,
  and §10.5 prohibits using map imagery for non-map display purposes.  Using the Maps
  Static API to power automated property prospecting at commercial scale likely violates
  these terms.  This implementation is provided for prototyping / demo purposes only.

  For production commercial use, replace GoogleMapsProvider with a provider whose
  license explicitly permits this use case (e.g., Nearmap Commercial License, EagleView).
  Swap via the `ImageryProvider` protocol — no other code changes needed.

Mock mode: GOOGLE_MAPS_API_KEY='' → MockImageryProvider (1×1 placeholder JPEG).

Ported verbatim from NewRepo's Worden Standard prototype
(apps/api/app/services/imagery_service.py). GOOGLE_MAPS_API_KEY is already
a managed key in app/services/runtime_config.py.
"""
from __future__ import annotations

import base64
import logging
from typing import Optional, Protocol, runtime_checkable

import httpx

log = logging.getLogger(__name__)

# 1×1 white JPEG — valid base64 placeholder for demo/test
_MOCK_IMAGE_B64 = (
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U'
    'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIA'
    'AhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAU'
    'AQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A'
    'JQAB/9k='
)


@runtime_checkable
class ImageryProvider(Protocol):
    """Aerial imagery provider protocol. Implement to swap to Nearmap/EagleView."""

    def get_image_b64(self, lat: float, lon: float) -> Optional[str]:
        """Return base64-encoded JPEG of the property at (lat, lon), or None on failure."""
        ...

    @property
    def provider_name(self) -> str: ...


class GoogleMapsProvider:
    """Google Maps Static API — 640×640 satellite image at zoom 19.

    ⚠ Review ToS before commercial deployment. See module docstring.
    """

    _BASE = 'https://maps.googleapis.com/maps/api/staticmap'
    provider_name = 'google_maps_static'

    def __init__(self, api_key: str) -> None:
        self._key = api_key

    def get_image_b64(self, lat: float, lon: float) -> Optional[str]:
        params = {
            'center': f'{lat},{lon}',
            'zoom': '19',
            'size': '640x640',
            'maptype': 'satellite',
            'key': self._key,
        }
        try:
            resp = httpx.get(self._BASE, params=params, timeout=15)
            resp.raise_for_status()
            if not resp.content:
                return None
            return base64.b64encode(resp.content).decode()
        except Exception as exc:
            log.warning('Google Maps Static API error at (%s, %s): %s', lat, lon, exc)
            return None


class MockImageryProvider:
    """Returns a 1×1 JPEG placeholder — for demo and CI use."""

    provider_name = 'mock'

    def get_image_b64(self, lat: float, lon: float) -> Optional[str]:
        return _MOCK_IMAGE_B64


def get_imagery_provider(api_key: str = '') -> ImageryProvider:
    """Factory: returns real Google provider if key present, else mock."""
    if api_key:
        return GoogleMapsProvider(api_key)
    return MockImageryProvider()
