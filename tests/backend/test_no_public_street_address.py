"""
Guard: the business publishes a SERVICE AREA, never a street address.

Owner instruction, standing:
    "i only want to use it as a service area set up not my address listed
     online please"

Two separate addresses must never reach a customer:

  1. The VACATED Chester office (1601 Ware Bottom Springs Rd, Suite 214). It was
     stripped from the two website repos, but the backend kept it — and on
     2026-09-04 the live chat answered "Where are you located?" with the full
     street, suite and ZIP. The frontend guard could not catch that, because the
     text was coming from Python.

  2. The owner's HOME in Faber (Nelson County). It has never been published and
     must not be. It is guarded here as well so that "use the new address"
     cannot quietly become "publish the new address".

Deliberately NOT guarded, because each is legitimate:
  • app/services/weather_service.py — disambiguates Chester VA from Chester WV
    so forecasts do not come from the wrong state. A geocoding centroid, not a
    published address.
  • proof_pack SERVICE_AREA_DATA ZIP lists — service-area coverage, not an HQ.
  • po_automation "Martin Marietta (Chester Quarry)" — a real supplier's name.
  • scan_tasks _COMPANY_FROM_* — the Lob RETURN ADDRESS on physical mail, which
    must be a real deliverable address. It is a business decision, not a
    deletion, and is tracked separately.
"""
from __future__ import annotations

import re
from pathlib import Path

APP = Path(__file__).resolve().parents[2] / "app"

# Everything that can reach a customer: AI answers, proposals, proof packs,
# review replies, and generated SEO copy.
CUSTOMER_FACING = [
    "services/knowledge_base.py",
    "services/proposal_generator.py",
    "services/proof_pack.py",
    "services/tenant_service.py",
    "services/review_responder.py",
    "services/ai_engine.py",
    "services/ai_foreman.py",
    "routers/seo.py",
]

VACATED_OFFICE = re.compile(r"Ware\s*Bottom|1601\s+Ware", re.I)
OFFICE_ZIPS = re.compile(r"\b2383[16]\b")
HQ_CLAIM = re.compile(r"(Headquarters|HQ)\s*:", re.I)
HOME_ADDRESS = re.compile(r"Irish\s*Rd|Irish\s*Road|\b22938\b|37\.839|-78\.756", re.I)


def _read(rel: str) -> str:
    return (APP / rel).read_text(encoding="utf-8")


def test_vacated_office_street_address_is_gone():
    offenders = [rel for rel in CUSTOMER_FACING if VACATED_OFFICE.search(_read(rel))]
    assert not offenders, f"vacated Chester street address still present in: {offenders}"


def test_office_zip_codes_are_not_published_as_an_address():
    """23831/23836 may appear in service-area ZIP lists, never beside an HQ label."""
    offenders = []
    for rel in CUSTOMER_FACING:
        for line in _read(rel).splitlines():
            if OFFICE_ZIPS.search(line) and HQ_CLAIM.search(line):
                offenders.append(f"{rel}: {line.strip()[:80]}")
    assert not offenders, f"office ZIP published as an address in: {offenders}"


def test_no_headquarters_claim_in_customer_facing_copy():
    """A service-area business states a service area, not a headquarters."""
    offenders = []
    for rel in CUSTOMER_FACING:
        for line in _read(rel).splitlines():
            if HQ_CLAIM.search(line):
                offenders.append(f"{rel}: {line.strip()[:80]}")
    assert not offenders, f"headquarters claim still present in: {offenders}"


def test_owner_home_address_never_appears_anywhere_in_the_backend():
    """The Faber home address is not published, in any file, ever."""
    offenders = []
    for path in APP.rglob("*.py"):
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if HOME_ADDRESS.search(text):
            offenders.append(str(path.relative_to(APP)))
    assert not offenders, f"owner home address present in: {offenders}"
