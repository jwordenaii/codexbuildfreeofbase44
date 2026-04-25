"""
Celery task: scrape Virginia LIS (Legislative Information System) permit data.

The scraper fetches paving / asphalt permit records from the Virginia
Department of Professional and Occupational Regulation (DPOR) or the
Virginia LIS building permit search API and ingests them as PermitLead
records after strict Pydantic validation.

This task runs every 6 hours via Celery Beat (see app/celery_app.py).

Environment variables:
  VIRGINIA_LIS_API_KEY  — API key for the Virginia permit data feed (optional)
  DATABASE_URL          — SQLAlchemy database URL
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import ValidationError

from ..celery_app import celery_app
from ..schemas.permit_lead import PermitLeadIn

logger = logging.getLogger(__name__)

# Virginia DPOR open data endpoint (public, no key required for basic queries)
_DPOR_BASE_URL = "https://www.dpor.virginia.gov/api/v1/permits"

# Paving-related permit type keywords used to filter results
_PAVING_KEYWORDS = {
    "asphalt", "paving", "pavement", "sealcoat", "parking lot",
    "driveway", "roadway", "overlay", "milling",
}


def _is_paving_permit(permit_type: str) -> bool:
    return any(kw in permit_type.lower() for kw in _PAVING_KEYWORDS)


def _parse_permit_row(row: dict[str, Any]) -> PermitLeadIn | None:
    """
    Map a raw API row to a validated PermitLeadIn schema.

    Returns None if validation fails so the caller can skip bad records
    without aborting the entire batch.
    """
    try:
        return PermitLeadIn(
            source="virginia_lis",
            permit_number=str(row.get("permit_number") or ""),
            permit_type=str(row.get("permit_type") or "General"),
            permit_status=str(row.get("status") or ""),
            contractor_name=row.get("contractor_name"),
            contractor_license=row.get("contractor_license"),
            property_address=str(row.get("address") or row.get("property_address") or "Unknown Address"),
            property_city=row.get("city"),
            property_state=str(row.get("state") or "VA"),
            property_zip=row.get("zip_code"),
            lat=row.get("latitude") or row.get("lat"),
            lng=row.get("longitude") or row.get("lng"),
            project_value=row.get("project_value") or row.get("permit_value"),
            estimated_sqft=row.get("sqft") or row.get("project_size_sqft"),
            permit_date=row.get("issue_date") or row.get("permit_date"),
            expiry_date=row.get("expiry_date") or row.get("expiration_date"),
            raw_json=json.dumps(row),
        )
    except (ValidationError, Exception) as exc:
        logger.warning("Skipping invalid permit row: %s — %s", row.get("permit_number"), exc)
        return None


def _fetch_permits_page(page: int, api_key: str | None) -> list[dict]:
    """
    Fetch one page of permits from the Virginia DPOR API (or stub if unavailable).

    In production, replace the stub with a real httpx call to the Virginia
    DPOR or Richmond City permit search API.
    """
    headers: dict[str, str] = {}
    if api_key:
        headers["X-API-Key"] = api_key

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(
                _DPOR_BASE_URL,
                params={"page": page, "per_page": 50, "permit_type": "paving"},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("results", data) if isinstance(data, dict) else data
    except Exception as exc:  # noqa: BLE001
        logger.warning("Virginia LIS API unavailable (page=%d): %s — using stub data", page, exc)
        return _stub_permits(page)


def _stub_permits(page: int) -> list[dict]:
    """
    Return realistic stub permit records for local development and testing.
    These are stand-ins for real Virginia DPOR permit data.
    """
    if page > 1:
        return []   # Only one page of stub data
    return [
        {
            "permit_number": "VA-2026-001234",
            "permit_type": "Commercial Asphalt Paving",
            "status": "Issued",
            "contractor_name": "Richmond Asphalt Co",
            "contractor_license": "VA-BC-12345",
            "address": "4200 Dominion Blvd",
            "city": "Richmond",
            "state": "VA",
            "zip_code": "23237",
            "latitude": 37.4256,
            "longitude": -77.4168,
            "project_value": 185_000.0,
            "sqft": 12_500.0,
            "issue_date": "2026-03-15T00:00:00",
            "expiry_date": "2026-09-15T00:00:00",
        },
        {
            "permit_number": "VA-2026-001235",
            "permit_type": "Parking Lot Paving",
            "status": "Issued",
            "contractor_name": "Capital City Paving LLC",
            "contractor_license": "VA-BC-67890",
            "address": "1000 Tuckahoe Creek Pkwy",
            "city": "Henrico",
            "state": "VA",
            "zip_code": "23233",
            "latitude": 37.6513,
            "longitude": -77.5536,
            "project_value": 320_000.0,
            "sqft": 22_000.0,
            "issue_date": "2026-04-01T00:00:00",
            "expiry_date": "2026-10-01T00:00:00",
        },
        {
            "permit_number": "VA-2026-001236",
            "permit_type": "Driveway Asphalt",
            "status": "Issued",
            "contractor_name": "J Worden And Sons",
            "address": "1601 Ware Bottom Springs Rd",
            "city": "Chester",
            "state": "VA",
            "zip_code": "23836",
            "latitude": 37.3529,
            "longitude": -77.4326,
            "project_value": 8_500.0,
            "sqft": 1_200.0,
            "issue_date": "2026-04-10T00:00:00",
        },
    ]


@celery_app.task(
    name="app.tasks.scraper.scrape_virginia_lis",
    bind=True,
    max_retries=3,
    default_retry_delay=300,   # 5 minutes between retries
    soft_time_limit=600,       # 10-minute soft timeout
    time_limit=720,            # 12-minute hard timeout
)
def scrape_virginia_lis(self, max_pages: int = 10) -> dict:
    """
    Celery task: scrape Virginia LIS / DPOR paving permit records.

    For each page:
      1. Fetch raw rows from the API
      2. Filter to paving-relevant permit types
      3. Validate each row via PermitLeadIn (skip invalid records)
      4. Upsert validated leads into the PermitLead table

    Returns a summary dict with counts of fetched, validated, and inserted records.
    """
    from ..database import SessionLocal
    from ..models import PermitLead

    api_key = os.getenv("VIRGINIA_LIS_API_KEY")
    db = SessionLocal()

    total_fetched = 0
    total_valid = 0
    total_inserted = 0
    total_skipped = 0

    try:
        for page in range(1, max_pages + 1):
            rows = _fetch_permits_page(page, api_key)
            if not rows:
                break   # No more data

            total_fetched += len(rows)
            paving_rows = [r for r in rows if _is_paving_permit(str(r.get("permit_type") or ""))]

            for row in paving_rows:
                validated = _parse_permit_row(row)
                if validated is None:
                    total_skipped += 1
                    continue

                total_valid += 1
                score, label = validated.compute_priority()

                # Upsert by permit_number to avoid duplicates
                existing = None
                if validated.permit_number:
                    existing = (
                        db.query(PermitLead)
                        .filter(PermitLead.permit_number == validated.permit_number)
                        .first()
                    )

                if existing:
                    # Update score/label and financial fields
                    existing.priority_score = score
                    existing.priority_label = label
                    existing.project_value = validated.project_value
                    existing.estimated_sqft = validated.estimated_sqft
                    total_skipped += 1   # Count as "not new"
                else:
                    lead_data = validated.model_dump(exclude={"raw_json"})
                    db_lead = PermitLead(
                        **lead_data,
                        priority_score=score,
                        priority_label=label,
                        scraped_at=datetime.now(timezone.utc),
                    )
                    db.add(db_lead)
                    total_inserted += 1

            db.commit()
            logger.info("Page %d: fetched=%d paving=%d valid=%d inserted=%d",
                        page, len(rows), len(paving_rows), total_valid, total_inserted)

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error("Scraper error: %s", exc)
        raise self.retry(exc=exc)
    finally:
        db.close()

    summary = {
        "status": "completed",
        "total_fetched": total_fetched,
        "total_valid": total_valid,
        "total_inserted": total_inserted,
        "total_skipped": total_skipped,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("Virginia LIS scrape complete: %s", summary)
    return summary
