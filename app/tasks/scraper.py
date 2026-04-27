"""
Virginia LIS permit scraper Celery task.

Scrapes the Virginia Legislative Information System (LIS) and related
state permit APIs for construction/paving permit leads, validates each
row through ``PermitLeadIn``, and persists HOT/WARM/COOL-scored records
to the ``permit_leads`` table.

Replace the stub scrape implementation with a real HTTP client targeting
https://lis.virginia.gov or the relevant permit API endpoint.
"""

import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)


def _stub_scrape(max_pages: int) -> list[dict]:
    """
    Return synthetic permit lead rows for dev/offline mode.

    Replace with real HTTP scraping in production.
    """
    stubs = [
        {
            "permit_type": "Commercial Paving",
            "permit_status": "Approved",
            "property_address": "1001 Commerce Rd, Richmond, VA 23234",
            "property_city": "Richmond",
            "property_state": "VA",
            "property_zip": "23234",
            "project_value": 250000.0,
            "estimated_sqft": 15000.0,
            "lat": 37.4823,
            "lng": -77.4698,
        },
        {
            "permit_type": "Asphalt Parking Lot",
            "permit_status": "Under Review",
            "property_address": "500 Hull St, Richmond, VA 23224",
            "property_city": "Richmond",
            "property_state": "VA",
            "property_zip": "23224",
            "project_value": 85000.0,
            "estimated_sqft": 6000.0,
            "lat": 37.5234,
            "lng": -77.4651,
        },
    ]
    return stubs[:max_pages]


def scrape_and_persist(max_pages: int = 5) -> dict:
    """
    Run the Virginia LIS scrape, validate each row, and upsert to the DB.
    Returns a summary dict with counts of persisted / skipped records.
    """
    from ..database import SessionLocal
    from ..models import PermitLead
    from ..schemas.permit_lead import PermitLeadIn
    from pydantic import ValidationError

    rows = _stub_scrape(max_pages)
    persisted = 0
    skipped = 0

    db = SessionLocal()
    try:
        for raw_row in rows:
            try:
                validated = PermitLeadIn(**raw_row)
            except ValidationError as exc:
                logger.warning("Skipping invalid permit lead row: %s", exc)
                skipped += 1
                continue

            score, label = validated.compute_priority()

            # Upsert by (source, property_address) to avoid duplicates
            existing = (
                db.query(PermitLead)
                .filter(
                    PermitLead.source == validated.source,
                    PermitLead.property_address == validated.property_address,
                )
                .first()
            )

            if existing:
                for field, value in validated.model_dump(exclude={"raw_json"}).items():
                    setattr(existing, field, value)
                existing.priority_score = score
                existing.priority_label = label
            else:
                lead = PermitLead(
                    **validated.model_dump(exclude={"raw_json"}),
                    priority_score=score,
                    priority_label=label,
                )
                db.add(lead)

            persisted += 1

        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error("Scraper DB error: %s", exc)
        raise
    finally:
        db.close()

    logger.info("Scrape complete: persisted=%d skipped=%d", persisted, skipped)
    return {"persisted": persisted, "skipped": skipped}


try:
    from ..celery_app import celery_app

    @celery_app.task(name="app.tasks.scraper.scrape_virginia_lis", bind=True, max_retries=3)
    def scrape_virginia_lis(self, max_pages: int = 10):
        """Celery task wrapper for the Virginia LIS permit scraper."""
        try:
            return scrape_and_persist(max_pages=max_pages)
        except Exception as exc:  # noqa: BLE001
            logger.error("scrape_virginia_lis task failed: %s", exc)
            raise self.retry(exc=exc, countdown=300) from exc

except ImportError:
    # Celery not installed — task is unavailable in this environment
    def scrape_virginia_lis(max_pages: int = 10):  # type: ignore[misc]
        return scrape_and_persist(max_pages=max_pages)
