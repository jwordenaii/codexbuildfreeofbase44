"""GPT-4o Vision property condition assessor.

Real mode: GPT-4o receives the satellite image as base64 and returns structured JSON.
Mock mode: deterministic hash-based assessment — same address always gets same result.

Ported verbatim from NewRepo's Worden Standard prototype
(apps/api/app/services/property_vision.py). Uses the `openai` package, which
is already a dependency here (see requirements.txt). OPENAI_API_KEY is
already a managed key in app/services/runtime_config.py.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger(__name__)

CONDITION_LEVELS = ('good', 'fair', 'poor')


@dataclass
class PropertyCondition:
    roof: str                        # good | fair | poor
    driveway: str
    drainage: str
    overall_score: int               # 0–100 (higher = worse condition = higher opportunity)
    narrative: str
    services_recommended: list[str] = field(default_factory=list)


_VISION_PROMPT = """You are a property condition assessor for a paving and general contracting company.
Analyze this aerial satellite image and assess the visible condition of:
1. Roof — look for discoloration, missing sections, sagging, moss/staining
2. Driveway — look for cracks, potholes, fading, surface separation, potholing
3. Drainage — look for erosion near edges, pooling areas, improper slope indicators

For each, classify as: good, fair, or poor.
Then give an overall opportunity score 0–100 (100 = property clearly needs paving/roofing work immediately).
Then list 1–3 specific services that appear needed, using terms like:
  "driveway resurfacing", "crack filling", "sealcoating", "parking lot paving",
  "concrete repair", "drainage correction", "milling and overlay"
Then write a 1-sentence condition narrative for use in a property owner mailer.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{
  "roof": "fair",
  "driveway": "poor",
  "drainage": "good",
  "overall_score": 75,
  "services_recommended": ["driveway resurfacing", "crack filling"],
  "narrative": "The driveway shows significant surface cracking and edge deterioration consistent with 10-15 years of deferred maintenance."
}"""


def assess_property_condition(
    image_b64: Optional[str],
    address: str,
    openai_api_key: str,
) -> PropertyCondition:
    """Assess property condition via GPT-4o Vision.

    Falls back to deterministic mock if key is absent or API call fails.
    """
    if not openai_api_key or not image_b64:
        return _mock_assess(address)

    try:
        import openai
        client = openai.OpenAI(api_key=openai_api_key)
        resp = client.chat.completions.create(
            model='gpt-4o',
            max_tokens=500,
            temperature=0.2,
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': _VISION_PROMPT},
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:image/jpeg;base64,{image_b64}',
                                'detail': 'high',
                            },
                        },
                    ],
                }
            ],
        )
        raw = (resp.choices[0].message.content or '{}').strip()
        # Strip any accidental markdown fences
        if raw.startswith('```'):
            raw = raw.split('```')[1]
            if raw.startswith('json'):
                raw = raw[4:]
        data = json.loads(raw)
        return PropertyCondition(
            roof=_valid_level(data.get('roof', 'fair')),
            driveway=_valid_level(data.get('driveway', 'fair')),
            drainage=_valid_level(data.get('drainage', 'good')),
            overall_score=max(0, min(100, int(data.get('overall_score', 50)))),
            narrative=str(data.get('narrative', '')),
            services_recommended=list(data.get('services_recommended', [])),
        )
    except Exception as exc:
        log.warning('GPT-4o vision error for %s: %s — using mock', address, exc)
        return _mock_assess(address)


def _valid_level(val: str) -> str:
    return val if val in CONDITION_LEVELS else 'fair'


def _mock_assess(address: str) -> PropertyCondition:
    """Deterministic mock — same address always returns same assessment."""
    seed = int(hashlib.md5(address.encode()).hexdigest()[:6], 16)
    roof = CONDITION_LEVELS[seed % 3]
    drv = CONDITION_LEVELS[(seed + 1) % 3]
    drain = CONDITION_LEVELS[(seed + 2) % 3]
    score = 25 + (seed % 65)

    services: list[str] = []
    if drv == 'poor':
        services.extend(['driveway resurfacing', 'crack filling'])
    elif drv == 'fair':
        services.append('sealcoating')
    if drain in ('fair', 'poor'):
        services.append('drainage correction')
    if not services:
        services.append('maintenance inspection')

    condition_desc = (
        'critical surface deterioration requiring immediate attention'
        if drv == 'poor' else
        'moderate surface wear consistent with 7-10 years of normal aging'
        if drv == 'fair' else
        'generally good condition with minor cosmetic wear'
    )
    narrative = (
        f'Aerial scan of {address}: driveway {condition_desc}; '
        f'roof appears {roof}; drainage indicators are {drain}.'
    )

    return PropertyCondition(
        roof=roof,
        driveway=drv,
        drainage=drain,
        overall_score=score,
        narrative=narrative,
        services_recommended=services[:3],
    )
