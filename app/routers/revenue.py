"""
revenue.py — Financial ecosystem reporting.

This endpoint previously returned hardcoded figures: $1,250,000 of "ecosystem
revenue" and a $450,000 reserve, with invented per-page conversion rates. None
of it came from the database. It also never actually returned them — the
handler passed `paving_operations_reserve` while the schema requires
`jwordenai_project_reserve`, so every call raised a ValidationError and the
route has answered 500 since the field was renamed.

Fixing only the field name would have been worse than leaving it broken: a
dashboard reporting a million dollars of revenue that does not exist is the
kind of number someone makes decisions on.

Figures now come from the same tables Jarvis already reports against —
PaymentTransaction and CashFlowEntry. When there is no data the totals are
zero and `has_data` is false. Zero revenue is a fact; $1.25M was not.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CashFlowEntry, PaymentTransaction
from app.schemas.revenue_loop import GlobalRevenueLoop

router = APIRouter(prefix="/api/v1/revenue", tags=["Financial Ecosystem"])

# Share of collected revenue held back for the project reserve. A reporting
# convention, not a measurement — named so nobody mistakes it for observed data.
RESERVE_FRACTION = 0.36
REINVESTMENT_RATE = 0.15


def _sum(query) -> float:
    return round(float(query.scalar() or 0.0), 2)


@router.get("/loop-status", response_model=GlobalRevenueLoop)
async def get_revenue_loop(db: Session = Depends(get_db)):
    """
    Revenue actually recorded in the system.

    `nodes` is intentionally empty: per-page revenue attribution requires a
    source that links payments to the page that produced them, and no such
    link exists in the schema today. Returning invented conversion rates per
    page would put fabricated numbers back into the response.
    """
    collected = _sum(
        db.query(func.sum(PaymentTransaction.amount_usd)).filter(
            PaymentTransaction.status == "paid"
        )
    )
    booked_income = _sum(
        db.query(func.sum(CashFlowEntry.amount)).filter(
            CashFlowEntry.entry_type == "income"
        )
    )

    total = round(collected + booked_income, 2)

    return GlobalRevenueLoop(
        total_ecosystem_revenue=total,
        jwordenai_project_reserve=round(total * RESERVE_FRACTION, 2),
        reinvestment_rate=REINVESTMENT_RATE,
        nodes=[],
    )


@router.post("/allocate")
async def allocate_funds(source_page: str, amount: float):
    """
    Not implemented.

    This previously returned `{"status": "success", "transferred": <amount>}`
    for any input, while writing nothing to any table and moving no money. A
    caller had no way to tell the difference between a completed transfer and
    a no-op, which is the worst possible failure mode for a financial
    operation.

    Implementing it properly needs a ledger, a destination account model and
    an audit trail — none of which exist yet. Until then this refuses clearly
    rather than reporting a success that did not happen.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Fund allocation is not implemented. No ledger or destination account "
            "model exists, so no transfer can be recorded. This endpoint previously "
            "reported success without moving anything."
        ),
    )
