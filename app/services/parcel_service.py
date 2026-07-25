"""Regrid parcel data client — ZIP → parcel list with government/public exclusion.

Mock mode: set REGRID_API_KEY='' (default) to run with 8 synthetic VA parcels.
Real mode: Regrid v1 REST API; returns GeoJSON FeatureCollection.

Ported verbatim from NewRepo's Worden Standard prototype
(apps/api/app/services/parcel_service.py) — no target-codebase-specific
adaptation needed; self-contained (stdlib + httpx, already a dependency here).
REGRID_API_KEY is registered in app/services/runtime_config.py MANAGED_KEYS.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Optional

import httpx

_ZIP_RE = re.compile(r'^\d{5}(-\d{4})?$')

log = logging.getLogger(__name__)

# Land-use codes to exclude (government, education, religious, utility, parks)
EXCLUDED_LAND_USE: set[str] = {
    'GOV', 'GOVT', 'GOVERNMENT', 'EDU', 'EDUCATION', 'MUN', 'MUNICIPAL',
    'FED', 'FEDERAL', 'UTIL', 'UTILITY', 'UTILITIES', 'PARK', 'PARKS',
    'TRANS', 'TRANSPORTATION', 'REL', 'RELIGIOUS', 'CHURCH', 'HOSP',
    'HOSPITAL', 'EXEMPT', 'PUBLIC', 'CEMETERY', 'COMMON',
    # Numeric exclusion codes (county assessor systems)
    '91', '92', '93', '94', '95', '96', '97', '98', '99',
    '900', '910', '920', '930', '940', '950', '960',
}

EXCLUDED_OWNER_KEYWORDS: tuple[str, ...] = (
    'CITY OF', 'COUNTY OF', 'STATE OF', 'COMMONWEALTH OF',
    'DEPT OF', 'DEPARTMENT OF', 'DISTRICT', 'AUTHORITY',
    'SCHOOL BOARD', 'UNIVERSITY', 'COLLEGE', 'CHURCH',
    'TEMPLE', 'MOSQUE', 'MINISTRY', 'HOSPITAL', 'CEMETERY',
    'USA ', 'US GOVT', 'U.S. GOVT',
)


@dataclass
class ParcelRecord:
    parcel_id: str
    address: str
    city: str
    state: str
    zip_code: str
    owner_name: str
    owner_type: str      # individual | corporate | trust | government | unknown
    land_use_code: str
    lot_size_sqft: float
    year_built: Optional[int]
    latitude: Optional[float]
    longitude: Optional[float]


# ── Mock data (8 realistic Virginia parcels — 5 residential, 2 commercial, 1 gov excluded) ──

_MOCK_PARCELS: list[dict] = [
    {
        'parcel_id': 'MOCK-23220-001', 'address': '415 Oak Ridge Rd', 'city': 'Richmond',
        'state': 'VA', 'zip_code': '23220', 'owner_name': 'Patricia Holloway',
        'owner_type': 'individual', 'land_use_code': 'RES', 'lot_size_sqft': 9200,
        'year_built': 1968, 'latitude': 37.5407, 'longitude': -77.4360,
    },
    {
        'parcel_id': 'MOCK-23220-002', 'address': '8823 Maplewood Dr', 'city': 'Richmond',
        'state': 'VA', 'zip_code': '23220', 'owner_name': 'Thomas & Linda Greer',
        'owner_type': 'individual', 'land_use_code': 'RES', 'lot_size_sqft': 11400,
        'year_built': 1952, 'latitude': 37.5421, 'longitude': -77.4382,
    },
    {
        'parcel_id': 'MOCK-23220-003', 'address': '204 Chestnut Hill Ln', 'city': 'Richmond',
        'state': 'VA', 'zip_code': '23220', 'owner_name': 'Sunrise Properties LLC',
        'owner_type': 'corporate', 'land_use_code': 'COM', 'lot_size_sqft': 28000,
        'year_built': 1985, 'latitude': 37.5390, 'longitude': -77.4401,
    },
    {
        'parcel_id': 'MOCK-23220-004', 'address': '319 Birch Valley Ct', 'city': 'Richmond',
        'state': 'VA', 'zip_code': '23220', 'owner_name': 'Robert Ashby',
        'owner_type': 'individual', 'land_use_code': 'RES', 'lot_size_sqft': 8100,
        'year_built': 1978, 'latitude': 37.5418, 'longitude': -77.4355,
    },
    {
        # Excluded: government parcel
        'parcel_id': 'MOCK-23220-005', 'address': '1140 Stonegate Blvd', 'city': 'Richmond',
        'state': 'VA', 'zip_code': '23220', 'owner_name': 'CITY OF RICHMOND',
        'owner_type': 'government', 'land_use_code': 'GOV', 'lot_size_sqft': 43000,
        'year_built': 1965, 'latitude': 37.5365, 'longitude': -77.4429,
    },
    {
        'parcel_id': 'MOCK-23220-006', 'address': '722 Farmington Ave', 'city': 'Richmond',
        'state': 'VA', 'zip_code': '23220', 'owner_name': 'Maria Santos',
        'owner_type': 'individual', 'land_use_code': 'RES', 'lot_size_sqft': 7600,
        'year_built': 1991, 'latitude': 37.5402, 'longitude': -77.4370,
    },
    {
        'parcel_id': 'MOCK-23220-007', 'address': '5500 Commerce Center Dr', 'city': 'Richmond',
        'state': 'VA', 'zip_code': '23220', 'owner_name': 'Meridian Holdings Group LLC',
        'owner_type': 'corporate', 'land_use_code': 'COM', 'lot_size_sqft': 32000,
        'year_built': 1999, 'latitude': 37.5345, 'longitude': -77.4415,
    },
    {
        'parcel_id': 'MOCK-23220-008', 'address': '287 Elm Forest Rd', 'city': 'Richmond',
        'state': 'VA', 'zip_code': '23220', 'owner_name': 'David & Carol Watkins',
        'owner_type': 'individual', 'land_use_code': 'RES', 'lot_size_sqft': 10800,
        'year_built': 1963, 'latitude': 37.5435, 'longitude': -77.4340,
    },
]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _should_exclude(land_use_code: str, owner_name: str, owner_type: str) -> bool:
    if land_use_code.upper().strip() in EXCLUDED_LAND_USE:
        return True
    if owner_type.lower() == 'government':
        return True
    owner_upper = owner_name.upper()
    return any(kw in owner_upper for kw in EXCLUDED_OWNER_KEYWORDS)


def _infer_owner_type(owner: str) -> str:
    o = owner.upper()
    gov_keywords = ('CITY OF', 'COUNTY OF', 'STATE OF', 'DEPT', 'AUTHORITY', 'DISTRICT', 'SCHOOL')
    corp_keywords = ('LLC', ' INC', ' CORP', ' CO ', 'HOLDINGS', 'PROPERTIES', 'REALTY', 'VENTURES', 'GROUP')
    trust_keywords = ('TRUST', 'ESTATE OF', 'REVOCABLE')
    if any(k in o for k in gov_keywords):
        return 'government'
    if any(k in o for k in trust_keywords):
        return 'trust'
    if any(k in o for k in corp_keywords):
        return 'corporate'
    return 'individual'


def _parse_regrid_feature(feature: dict) -> Optional[ParcelRecord]:
    props = feature.get('properties') or {}
    address = (
        props.get('ll_address') or props.get('situs_full') or
        props.get('address') or ''
    ).title()
    city = (props.get('situs_city') or props.get('mail_city') or '').title()
    state = (props.get('situs_state2') or props.get('mail_state2') or '').upper()
    zip_code = props.get('situs_zip') or props.get('mail_zip') or ''
    owner = (props.get('owner') or props.get('owner_name') or 'Unknown Owner').title()
    land_use = (props.get('usedesc') or props.get('usecode') or 'RES').upper()
    owner_type = _infer_owner_type(owner)

    # Coordinates: try direct lat/lon first, then parse from geometry centroid
    lat = props.get('lat') or props.get('ll_lat')
    lon = props.get('lon') or props.get('ll_lon')

    acres = float(props.get('ll_gisacre') or props.get('ll_acres') or 0)
    sqft = acres * 43560 if acres > 0 else 0.0

    year_raw = props.get('yearbuilt') or props.get('year_built')
    try:
        year_built = int(year_raw) if year_raw else None
    except (ValueError, TypeError):
        year_built = None

    if not address:
        return None

    return ParcelRecord(
        parcel_id=str(props.get('ogc_fid') or props.get('parcelnumb') or props.get('apn') or ''),
        address=address,
        city=city,
        state=state,
        zip_code=zip_code,
        owner_name=owner,
        owner_type=owner_type,
        land_use_code=land_use,
        lot_size_sqft=sqft,
        year_built=year_built,
        latitude=float(lat) if lat is not None else None,
        longitude=float(lon) if lon is not None else None,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def get_parcels_by_zip(
    zip_code: str,
    api_key: str = '',
    max_results: int = 200,
) -> list[ParcelRecord]:
    """Return filtered parcel records for a ZIP code.

    With no api_key: returns mock VA parcels (gov parcel excluded automatically).
    With api_key: calls Regrid v1 API, falls back to mock on error.
    """
    # Validate ZIP format before interpolating into external URL (SSRF prevention)
    zip_clean = zip_code.strip()
    if not _ZIP_RE.match(zip_clean):
        raise ValueError(f'Invalid ZIP code: {zip_clean!r}. Expected 5-digit or ZIP+4 format.')
    zip_clean = zip_clean[:5]  # normalise to 5-digit for API call

    if not api_key:
        raw = [p for p in _MOCK_PARCELS if not _should_exclude(p['land_use_code'], p['owner_name'], p['owner_type'])]
        return [ParcelRecord(**p) for p in raw[:max_results]]

    url = f'https://app.regrid.com/api/v1/parcels/zip/{zip_clean}.json'
    try:
        resp = httpx.get(url, params={'token': api_key, 'limit': min(max_results, 500)}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        results: list[ParcelRecord] = []
        for feature in data.get('parcels', {}).get('features', []) or data.get('features', []):
            rec = _parse_regrid_feature(feature)
            if rec and not _should_exclude(rec.land_use_code, rec.owner_name, rec.owner_type):
                results.append(rec)
            if len(results) >= max_results:
                break
        return results
    except Exception as exc:
        log.warning('Regrid API error for ZIP %s: %s — falling back to mock', zip_code, exc)
        return get_parcels_by_zip(zip_code, api_key='', max_results=max_results)
