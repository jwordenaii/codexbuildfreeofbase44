"""Property Scan -> Direct Mail pipeline task.

Runs the full pipeline for a ScanCampaign:
  1. Fetch parcels from Regrid (or mock)
  2. Fetch aerial imagery per property (Google Maps Static or mock)
  3. Assess condition via GPT-4o Vision (or mock)
  4. Generate estimate via math_ai_service pricing engine
  5. Generate mailer HTML
  6. (If auto_mail) Send via Lob (or mock)
  7. Persist ScanProperty + ScanResult records

Ported from NewRepo's Worden Standard prototype
(apps/api/app/tasks/scan_tasks.py). Adapted to this codebase's Celery
registration convention (see app/tasks/vector_tasks.py): the task is
wrapped in `try/except ImportError` around `celery_app.task`, and
`_run_pipeline()` is a plain function usable directly as a synchronous
fallback (called by app/routers/scan_campaign.py's run_campaign endpoint
when Celery/Redis is unavailable, and registered as a Celery task here
when it is).

Company info (used in the generated mailer HTML) is read from
app/services/runtime_config.py's managed COMPANY_* keys, falling back to
the same real defaults used elsewhere in this codebase (see
app/services/proposal_generator.py).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from ..database import SessionLocal
from ..models import ScanCampaign, ScanProperty, ScanResult
from ..services import runtime_config
from ..services.parcel_service import get_parcels_by_zip
from ..services.imagery_service import get_imagery_provider
from ..services.property_vision import assess_property_condition
from ..services.scan_estimator import estimate_for_property
from ..services.mailer_service import generate_mailer_html, send_via_lob, mock_send

log = logging.getLogger(__name__)

# Real company defaults (matches app/services/proposal_generator.py).
# Overridable from the admin UI via the managed COMPANY_* runtime_config keys.
_DEFAULT_COMPANY_NAME = 'J. Worden & Sons Asphalt Paving'
_DEFAULT_COMPANY_PHONE = '(804) 446-1296'
_DEFAULT_COMPANY_WEBSITE = 'https://jwordenasphaltpaving.com'
_DEFAULT_COMPANY_ADDRESS = '1601 Ware Bottom Springs Rd Suite 214, Chester, VA 23836'
_ESTABLISHED_YEAR = '1984'

# Lob "from" address must be split into line1/city/state/zip. There is no
# managed key for a structured from-address, so this uses the same real
# address as the default COMPANY_ADDRESS above, split into its parts.
_COMPANY_FROM_ADDRESS = '1601 Ware Bottom Springs Rd Suite 214'
_COMPANY_FROM_CITY = 'Chester'
_COMPANY_FROM_STATE = 'VA'
_COMPANY_FROM_ZIP = '23836'


def _company_info() -> dict:
    # COMPANY_NAME is not a managed runtime_config key (see MANAGED_KEYS in
    # app/services/runtime_config.py — only PHONE/EMAIL/WEBSITE/ADDRESS are),
    # so it stays a hardcoded constant here, matching app/services/proposal_generator.py.
    return {
        'name': _DEFAULT_COMPANY_NAME,
        'phone': runtime_config.get('COMPANY_PHONE') or _DEFAULT_COMPANY_PHONE,
        'website': runtime_config.get('COMPANY_WEBSITE') or _DEFAULT_COMPANY_WEBSITE,
        'address': runtime_config.get('COMPANY_ADDRESS') or _DEFAULT_COMPANY_ADDRESS,
    }


def _run_pipeline(campaign_id: int) -> dict:
    """Synchronous pipeline — called directly when Celery is unavailable, and
    from inside the Celery task wrapper below when it is."""
    db = SessionLocal()
    try:
        campaign = db.query(ScanCampaign).filter(ScanCampaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f'Campaign {campaign_id} not found')

        campaign.status = 'running'
        db.commit()

        regrid_api_key = runtime_config.get('REGRID_API_KEY')
        google_maps_api_key = runtime_config.get('GOOGLE_MAPS_API_KEY')
        openai_api_key = runtime_config.get('OPENAI_API_KEY')
        lob_api_key = runtime_config.get('LOB_API_KEY')
        company = _company_info()

        # ── 1. Fetch parcels ─────────────────────────────────────────────────
        parcels = get_parcels_by_zip(
            zip_code=campaign.zip_code,
            api_key=regrid_api_key,
            max_results=campaign.max_properties,
        )

        campaign.total_properties = len(parcels)
        campaign.scanned = 0
        campaign.mailed = 0
        db.commit()

        # ── 2. Set up providers ──────────────────────────────────────────────
        imagery_provider = get_imagery_provider(google_maps_api_key)
        log.info(
            'Campaign %s: %d parcels from ZIP %s, imagery=%s',
            campaign_id, len(parcels), campaign.zip_code, imagery_provider.provider_name,
        )

        # ── 3. Process each property ─────────────────────────────────────────
        for parcel in parcels:
            try:
                prop = ScanProperty(
                    campaign_id=campaign_id,
                    parcel_id=parcel.parcel_id,
                    address=parcel.address,
                    city=parcel.city,
                    state=parcel.state,
                    zip_code=parcel.zip_code,
                    owner_name=parcel.owner_name,
                    owner_type=parcel.owner_type,
                    land_use_code=parcel.land_use_code,
                    lot_size_sqft=parcel.lot_size_sqft,
                    year_built=parcel.year_built,
                    latitude=parcel.latitude,
                    longitude=parcel.longitude,
                    status='scanning',
                )
                db.add(prop)
                db.commit()
                db.refresh(prop)

                # Imagery (skip if no coords)
                image_b64 = None
                if parcel.latitude and parcel.longitude:
                    image_b64 = imagery_provider.get_image_b64(parcel.latitude, parcel.longitude)

                # Condition assessment
                condition = assess_property_condition(
                    image_b64=image_b64,
                    address=parcel.address,
                    openai_api_key=openai_api_key,
                )

                # Estimate
                estimate = estimate_for_property(
                    services_recommended=condition.services_recommended,
                    lot_size_sqft=parcel.lot_size_sqft or 8000.0,
                    state_code=parcel.state,
                )

                # Mailer HTML
                html = generate_mailer_html(
                    address=parcel.address,
                    city=parcel.city,
                    state=parcel.state,
                    zip_code=parcel.zip_code,
                    owner_name=parcel.owner_name,
                    roof=condition.roof,
                    driveway=condition.driveway,
                    drainage=condition.drainage,
                    narrative=condition.narrative,
                    service_label=estimate.service_label,
                    sqft=estimate.sqft,
                    estimate_low=estimate.estimate_low,
                    estimate_high=estimate.estimate_high,
                    company_name=company['name'],
                    company_phone=company['phone'],
                    company_website=company['website'],
                    company_address=company['address'],
                    established_year=_ESTABLISHED_YEAR,
                )

                # Lob send (if auto_mail is enabled)
                lob_id = None
                lob_status = None
                mailed_at = None

                if campaign.auto_mail:
                    if lob_api_key:
                        try:
                            lob_resp = send_via_lob(
                                to_name=parcel.owner_name,
                                to_address=parcel.address,
                                to_city=parcel.city,
                                to_state=parcel.state,
                                to_zip=parcel.zip_code,
                                html_content=html,
                                api_key=lob_api_key,
                                from_name=company['name'],
                                from_address=_COMPANY_FROM_ADDRESS,
                                from_city=_COMPANY_FROM_CITY,
                                from_state=_COMPANY_FROM_STATE,
                                from_zip=_COMPANY_FROM_ZIP,
                            )
                            lob_id = lob_resp.get('id')
                            lob_status = lob_resp.get('status', 'queued')
                            mailed_at = datetime.now(timezone.utc)
                            campaign.mailed += 1
                        except Exception as lob_exc:
                            log.warning('Lob send failed for %s: %s', parcel.address, lob_exc)
                            lob_status = 'send_failed'
                    else:
                        mock = mock_send(parcel.parcel_id)
                        lob_id = mock['id']
                        lob_status = mock['status']
                        mailed_at = datetime.now(timezone.utc)
                        campaign.mailed += 1

                result = ScanResult(
                    property_id=prop.id,
                    roof_condition=condition.roof,
                    driveway_condition=condition.driveway,
                    drainage_condition=condition.drainage,
                    overall_score=condition.overall_score,
                    condition_narrative=condition.narrative,
                    services_recommended=json.dumps(condition.services_recommended),
                    service_type=estimate.service_label,
                    estimated_sqft=estimate.sqft,
                    estimate_low=estimate.estimate_low,
                    estimate_high=estimate.estimate_high,
                    mailer_html=html,
                    lob_letter_id=lob_id,
                    lob_status=lob_status,
                    mailed_at=mailed_at,
                )
                db.add(result)
                prop.status = 'scanned' if not lob_id else 'mailed'
                campaign.scanned += 1
                db.commit()

            except Exception as prop_exc:
                log.warning('Error processing parcel %s: %s', parcel.parcel_id, prop_exc)
                db.rollback()
                # Continue with next property

        campaign.status = 'done'
        campaign.completed_at = datetime.now(timezone.utc)
        db.commit()

        return {
            'campaign_id': campaign_id,
            'total': campaign.total_properties,
            'scanned': campaign.scanned,
            'mailed': campaign.mailed,
            'status': 'done',
        }

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _mark_failed(campaign_id: int, error: str) -> None:
    db = SessionLocal()
    try:
        c = db.query(ScanCampaign).filter(ScanCampaign.id == campaign_id).first()
        if c:
            c.status = 'failed'
            db.commit()
    except Exception:
        pass
    finally:
        db.close()


# ── Celery task registration ───────────────────────────────────────────────────
# Mirrors app/tasks/vector_tasks.py: register the real Celery task when the
# celery package is importable, else expose a plain synchronous function of
# the same name so callers that do `from .scan_tasks import run_scan_campaign_task`
# still work (no `.delay()` — callers must invoke it directly).

try:
    from ..celery_app import celery_app  # noqa: PLC0415

    @celery_app.task(
        name='app.tasks.scan_tasks.run_scan_campaign_task',
        bind=True,
        max_retries=1,
        soft_time_limit=1800,
        time_limit=2100,
        queue='ai',
    )
    def run_scan_campaign_task(self, campaign_id: int) -> dict:
        """Celery entry point — delegates to _run_pipeline()."""
        try:
            return _run_pipeline(campaign_id)
        except Exception as exc:
            log.exception('Scan campaign %s failed: %s', campaign_id, exc)
            _mark_failed(campaign_id, str(exc))
            raise

except ImportError:
    # Celery not installed — provide a synchronous fallback for local dev / tests
    log.warning('Celery not available — run_scan_campaign_task will run synchronously.')

    def run_scan_campaign_task(campaign_id: int) -> dict:  # type: ignore[misc]
        """Synchronous fallback when Celery is not installed."""
        try:
            return _run_pipeline(campaign_id)
        except Exception as exc:
            log.exception('Scan campaign %s failed: %s', campaign_id, exc)
            _mark_failed(campaign_id, str(exc))
            raise
