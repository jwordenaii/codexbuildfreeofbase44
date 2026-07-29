"""
market_orchestration.py — Property scan + direct-mail engine (Regrid + Lob).

This replaces an earlier version that fabricated everything: it derived a
"pavement condition index" from `85 - (len(address) % 40)` — the number of
characters in the address string, dressed up as a "USGS NAIP 60cm aerial scan" —
and its "direct-mail trigger" printed and mailed nothing, it counted the
addresses, multiplied by $0.68, and returned "QUEUED_FOR_PRINT_AND_DELIVERY".

Nothing here invents data now. Two real providers do the work:

    REGRID_API_KEY   parcel data — enumerate the properties in a ZIP, look up
                     lot size for one address (regrid.com)
    LOB_API_KEY      print + mail — actually prints and ships the postcards,
                     at real per-piece cost (lob.com)

When a key is missing, reads return {configured: false, missing: [...]} and the
send refuses outright with 501 — it never reports a mail campaign that did not
happen. Pavement *condition* is deliberately not scored: it cannot be known from
parcel data, and guessing it is what the old version did. Square footage is a
labelled estimate derived from the parcel's real lot size, not a measurement.
"""

import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..services import runtime_config

router = APIRouter(prefix="/api/v1/market-orchestration", tags=["market-orchestration"])
logger = logging.getLogger(__name__)

REGRID_BASE = "https://app.regrid.com/api/v2"
LOB_BASE = "https://api.lob.com/v1"
TIMEOUT = httpx.Timeout(30.0, connect=8.0)

# Safety rail: a whole-ZIP mailer spends real money, one postcard at a time.
# The trigger refuses more than this many recipients unless the caller passes
# confirm_large=True, so a fat-fingered ZIP can't quietly bill hundreds of
# dollars. It is a guard, not a licensing limit.
MAX_RECIPIENTS_WITHOUT_OVERRIDE = 250

# A postcard's real cost depends on size and mail class; this is Lob's standard
# 4x6 rate and is used ONLY to show an estimate before the user confirms. The
# figure returned after a send reflects how many Lob actually accepted.
LOB_UNIT_ESTIMATE_USD = 0.63


def _num(v: Any) -> Optional[float]:
    try:
        if v in (None, ""):
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _regrid_key() -> tuple[str, list[str]]:
    key = runtime_config.get("REGRID_API_KEY")
    return key, ([] if key else ["REGRID_API_KEY"])


def _lob_key() -> tuple[str, list[str]]:
    key = runtime_config.get("LOB_API_KEY")
    return key, ([] if key else ["LOB_API_KEY"])


def _not_configured(missing: list[str], service: str) -> dict[str, Any]:
    return {
        "configured": False,
        "reason": "not_configured",
        "missing": missing,
        "detail": (
            f"{service} is not connected. Set {' and '.join(missing)} in the "
            "Command Center API keys panel."
        ),
    }


def _regrid_error(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        return body.get("error") or body.get("message") or f"HTTP {resp.status_code}"
    except Exception:
        return f"HTTP {resp.status_code}"


# Estimating paved/parking area from a parcel's lot size. This is an ESTIMATE and
# is labelled as one everywhere it surfaces — the real number needs a site visit
# or measured imagery. Commercial lots are mostly pavement; a conservative
# coverage fraction of the lot, minus the building footprint when known.
def _estimate_paving_sqft(lot_sqft: Optional[float], building_sqft: Optional[float]) -> Optional[int]:
    if not lot_sqft or lot_sqft <= 0:
        return None
    paved = lot_sqft * 0.55  # conservative lot coverage for parking/drive
    if building_sqft and building_sqft > 0:
        paved = max(paved - building_sqft, lot_sqft * 0.20)
    return int(round(paved))


# ── Single-address scan ──────────────────────────────────────────────────────
@router.post("/satellite-scan", dependencies=[Depends(verify_premium_security)])
@limiter.limit("30/minute")
async def scan_property(request: Request, payload: dict = Body(...)):
    """
    Look one address up in the parcel record and return a labelled paving-area
    estimate. No condition score: that is not knowable from parcel data.
    """
    address = (payload.get("address") or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="An address is required.")

    key, missing = _regrid_key()
    if missing:
        return _not_configured(missing, "Regrid parcel data")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{REGRID_BASE}/parcels/address",
                params={"query": address, "token": key, "limit": 1},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Regrid: {exc}")

    if resp.status_code != 200:
        return {"configured": True, "ok": False, "detail": _regrid_error(resp)}

    parcels = (resp.json() or {}).get("parcels", {}).get("features", [])
    if not parcels:
        return {"configured": True, "ok": True, "found": False,
                "detail": "No parcel record matched that address."}

    props = parcels[0].get("properties", {}).get("fields", {})
    lot_sqft = _num(props.get("ll_gissqft") or props.get("sqft"))
    building_sqft = _num(props.get("buildingsqft") or props.get("ll_bldg_footprint_sqft"))
    paving = _estimate_paving_sqft(lot_sqft, building_sqft)

    return {
        "configured": True,
        "ok": True,
        "found": True,
        "address": props.get("address") or address,
        "owner": props.get("owner"),
        "land_use": props.get("usedesc") or props.get("lbcs_activity_desc"),
        "parcel": {
            "lot_sqft": lot_sqft,
            "building_sqft": building_sqft,
        },
        "estimate": {
            "paving_sqft_estimate": paving,
            "basis": "0.55 of parcel lot size, less building footprint where known",
            "is_estimate": True,
            "condition_assessed": False,
            "condition_note": "Pavement condition requires a site visit or measured imagery; it is not scored here.",
        },
        "source": {"provider": "Regrid parcel API", "for": "lot size only"},
    }


# ── Whole-ZIP scan ───────────────────────────────────────────────────────────
@router.post("/zip-scan", dependencies=[Depends(verify_premium_security)])
@limiter.limit("10/minute")
async def scan_zip(request: Request, payload: dict = Body(...)):
    """
    Enumerate mailable properties in a ZIP and return the count, a sample, the
    aggregate paving-area estimate, and the estimated mail cost. This is a read:
    it spends nothing. `commercial_only` filters to commercial land use, the
    usual target for a parking-lot mailer.
    """
    zip_code = str(payload.get("zip") or "").strip()
    if not zip_code.isdigit() or len(zip_code) != 5:
        raise HTTPException(status_code=400, detail="A 5-digit ZIP code is required.")
    commercial_only = bool(payload.get("commercial_only", True))
    limit = max(1, min(int(payload.get("limit", 500)), 2000))

    key, missing = _regrid_key()
    if missing:
        return _not_configured(missing, "Regrid parcel data")

    params: dict[str, Any] = {"query": zip_code, "token": key, "limit": limit}
    if commercial_only:
        # Regrid land-use activity code for commercial. Kept as a parameter so
        # the filter can be tuned without touching the request plumbing.
        params["sfa[lbcs_activity]"] = "2000"

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{REGRID_BASE}/parcels/query", params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Regrid: {exc}")

    if resp.status_code != 200:
        return {"configured": True, "ok": False, "detail": _regrid_error(resp)}

    features = (resp.json() or {}).get("parcels", {}).get("features", [])
    recipients: list[dict[str, Any]] = []
    total_paving = 0
    for feat in features:
        f = feat.get("properties", {}).get("fields", {})
        addr = f.get("address")
        if not addr:
            continue
        lot = _num(f.get("ll_gissqft") or f.get("sqft"))
        paving = _estimate_paving_sqft(lot, _num(f.get("buildingsqft")))
        if paving:
            total_paving += paving
        recipients.append({
            "address": addr,
            "owner": f.get("owner"),
            "city": f.get("scity") or f.get("city"),
            "state": f.get("state2") or f.get("state"),
            "zip": f.get("szip") or zip_code,
            "land_use": f.get("usedesc"),
            "paving_sqft_estimate": paving,
        })

    count = len(recipients)
    return {
        "configured": True,
        "ok": True,
        "zip": zip_code,
        "commercial_only": commercial_only,
        "property_count": count,
        "aggregate_paving_sqft_estimate": total_paving,
        "estimated_mail_cost_usd": round(count * LOB_UNIT_ESTIMATE_USD, 2),
        "unit_cost_estimate_usd": LOB_UNIT_ESTIMATE_USD,
        "sample": recipients[:25],
        "recipients": recipients,
        "note": "Counts and costs are estimates from parcel data. Nothing is mailed until you confirm.",
    }


# ── Send the mail (real money) ───────────────────────────────────────────────
class MailRecipient(BaseModel):
    name: Optional[str] = None
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None


class MailTriggerRequest(BaseModel):
    recipients: list[MailRecipient] = Field(min_length=1)
    campaign_name: str = Field(min_length=1, max_length=200)
    offer_discount_pct: int = Field(default=10, ge=0, le=90)
    confirm_spend: bool = False
    confirm_large: bool = False


@router.post("/direct-mail/trigger", dependencies=[Depends(verify_premium_security)])
@limiter.limit("3/minute")
async def trigger_direct_mail(request: Request, payload: MailTriggerRequest):
    """
    Actually print and mail postcards through Lob. Refuses rather than pretend:
    no key -> 501; unconfirmed spend -> 400; oversized batch -> 400 until the
    caller acknowledges it. Returns what Lob really did, including per-recipient
    failures.
    """
    key, missing = _lob_key()
    if missing:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=_not_configured(missing, "Lob mailing")["detail"],
        )

    count = len(payload.recipients)
    if not payload.confirm_spend:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This will print and mail {count} postcard(s) at roughly "
                f"${round(count * LOB_UNIT_ESTIMATE_USD, 2)}. Re-send with "
                "confirm_spend=true to proceed."
            ),
        )
    if count > MAX_RECIPIENTS_WITHOUT_OVERRIDE and not payload.confirm_large:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{count} recipients exceeds the {MAX_RECIPIENTS_WITHOUT_OVERRIDE} "
                "safety cap. Re-send with confirm_large=true to mail the full list."
            ),
        )

    qr = f"https://thewordenstandard.com/quote?ref=mail_{abs(hash(payload.campaign_name)) % 100000:05d}"
    front = (
        "<html><body style='font-family:sans-serif;text-align:center;padding:40px'>"
        "<h1>Your Pavement, Handled.</h1>"
        f"<p>{payload.offer_discount_pct}% off your asphalt estimate</p>"
        "<p>J. Worden &amp; Sons — since 1984</p></body></html>"
    )
    back = (
        "<html><body style='font-family:sans-serif;text-align:center;padding:40px'>"
        f"<p>Scan or visit</p><p><b>{qr}</b></p><p>804-446-1296</p></body></html>"
    )

    sent: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    auth = (key, "")
    async with httpx.AsyncClient(timeout=TIMEOUT, auth=auth) as client:
        for r in payload.recipients:
            data = {
                "description": payload.campaign_name[:255],
                "to[name]": (r.name or "Current Resident")[:40],
                "to[address_line1]": r.address,
                "to[address_city]": r.city or "",
                "to[address_state]": r.state or "",
                "to[address_zip]": r.zip or "",
                "from[name]": "J. Worden & Sons",
                "from[address_line1]": "1601 Ware Bottom Spring Rd",
                "from[address_city]": "Chester",
                "from[address_state]": "VA",
                "from[address_zip]": "23836",
                "front": front,
                "back": back,
                "size": "4x6",
            }
            try:
                resp = await client.post(f"{LOB_BASE}/postcards", data=data)
            except httpx.HTTPError as exc:
                failures.append({"address": r.address, "error": str(exc)})
                continue
            if resp.status_code in (200, 201):
                body = resp.json()
                sent.append({"address": r.address, "lob_id": body.get("id"),
                             "expected_delivery": body.get("expected_delivery_date")})
            else:
                try:
                    err = resp.json().get("error", {}).get("message", f"HTTP {resp.status_code}")
                except Exception:
                    err = f"HTTP {resp.status_code}"
                failures.append({"address": r.address, "error": err})

    logger.info(
        "direct-mail: campaign=%s sent=%d failed=%d",
        payload.campaign_name, len(sent), len(failures),
    )
    return {
        "ok": len(failures) == 0,
        "campaign_name": payload.campaign_name,
        "requested": count,
        "sent_count": len(sent),
        "failed_count": len(failures),
        "estimated_cost_usd": round(len(sent) * LOB_UNIT_ESTIMATE_USD, 2),
        "offer_discount_pct": payload.offer_discount_pct,
        "qr_tracking_url": qr,
        "sent": sent[:100],
        "failures": failures[:100],
        "provider": "Lob",
    }
