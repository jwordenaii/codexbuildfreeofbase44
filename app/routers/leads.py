import logging
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from typing import Optional

from ..core.limiter import limiter
from ..database import get_db
from ..models import Lead, ContactMessage
from ..services.lead_scorer import score_lead
from ..services.notifications import send_lead_notification
from ..services.pricing import estimate_price
from ..services.email_service import send_quote_confirmation, send_admin_notification, send_contact_response

router = APIRouter(prefix="/api/v1/leads", tags=["leads"])

logger = logging.getLogger(__name__)


class QuoteRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=30)
    service_type: str = Field(..., max_length=60)   # paving | sealcoating | crackfill | parking_lot | driveway
    property_type: str = Field(..., max_length=30)  # residential | commercial
    urgency: str = Field(..., max_length=30)         # asap | within_1_week | within_1_month | flexible
    project_size_sqft: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    address: Optional[str] = Field(default=None, max_length=300)
    message: Optional[str] = Field(default=None, max_length=2000)


class ContactRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    message: str = Field(..., min_length=1, max_length=2000)


class EstimateRequest(BaseModel):
    service_type: str = Field(..., max_length=60)
    property_type: str = Field(default="residential", max_length=30)
    project_size_sqft: float = Field(..., gt=0, le=10_000_000)


@router.post("/quote", summary="Submit a quote request")
@limiter.limit("10/minute")
async def submit_quote(
    request: Request,
    req: QuoteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    lead_data = req.model_dump()
    scoring = score_lead(lead_data)
    lead_data["score"] = scoring

    # Persist to database
    db_lead = Lead(
        name=req.name,
        email=req.email,
        phone=req.phone,
        service_type=req.service_type,
        property_type=req.property_type,
        urgency=req.urgency,
        project_size_sqft=req.project_size_sqft,
        address=req.address,
        message=req.message,
        score_value=scoring["score"],
        score_label=scoring["label"],
        score_priority=scoring["priority"],
    )
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    lead_data["db_id"] = db_lead.id

    background_tasks.add_task(send_lead_notification, lead_data)

    # SendGrid: send confirmation to customer + admin notification
    background_tasks.add_task(send_quote_confirmation, db_lead)
    background_tasks.add_task(send_admin_notification, db_lead)

    # Feature 4: Schedule follow-up based on lead score
    label = scoring.get("label", "COOL")
    try:
        from ..services.follow_up_tasks import schedule_follow_up  # noqa: PLC0415
        if label == "HOT":
            schedule_follow_up(db_lead.id, "hot_1h", delay_seconds=3600, db=db)
        elif label == "WARM":
            schedule_follow_up(db_lead.id, "warm_3d", delay_seconds=3 * 86400, db=db)
        else:
            schedule_follow_up(db_lead.id, "cool_7d", delay_seconds=7 * 86400, db=db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not schedule follow-up: %s", exc)

    # Celery: dispatch scheduled follow-up email task
    try:
        from ..tasks.email_tasks import send_follow_up_email  # noqa: PLC0415
        task_type_map = {"HOT": "hot_1h", "WARM": "warm_3d", "COOL": "cool_7d"}
        task_type = task_type_map.get(label, "cool_7d")
        delay_map = {"hot_1h": 3600, "warm_3d": 3 * 86400, "cool_7d": 7 * 86400}
        countdown = delay_map[task_type]
        if hasattr(send_follow_up_email, "apply_async"):
            send_follow_up_email.apply_async(
                kwargs={"lead_id": db_lead.id, "task_type": task_type},
                countdown=countdown,
            )
            logger.info(
                "Scheduled %s follow-up email for lead #%d (countdown=%ds)",
                task_type,
                db_lead.id,
                countdown,
            )
        else:
            logger.info("Celery unavailable — follow-up email will not be scheduled")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not dispatch follow-up email task: %s", exc)

    return {
        "status": "received",
        "message": "Thank you! We will contact you within 24 hours.",
        "lead_score": scoring["label"],
        "priority": scoring["priority"],
        "follow_up_sla": scoring["follow_up_sla"],
    }


@router.post("/contact", summary="Submit a contact form message")
@limiter.limit("10/minute")
async def submit_contact(
    request: Request,
    req: ContactRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Persist to database
    db_msg = ContactMessage(
        name=req.name,
        email=req.email,
        phone=req.phone,
        message=req.message,
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)

    lead_data = {**req.model_dump(), "type": "contact"}
    background_tasks.add_task(send_lead_notification, lead_data)

    # SendGrid: send auto-reply to customer
    background_tasks.add_task(send_contact_response, db_msg)

    return {
        "status": "received",
        "message": "Thank you for reaching out! We will get back to you soon.",
    }


@router.post("/estimate", summary="Get a ballpark price estimate")
@limiter.limit("30/minute")
async def get_estimate(request: Request, req: EstimateRequest):
    """
    Returns a ballpark cost range for the requested service and project size.
    No authentication required — helps prospects self-qualify before submitting a quote.
    """
    result = estimate_price(req.service_type, req.property_type, req.project_size_sqft)
    if result is None:
        return {"estimate_available": False, "reason": "Service type not recognized"}
    return {"estimate_available": True, **result}
