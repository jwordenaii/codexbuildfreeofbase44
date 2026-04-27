"""
follow_ups.py — Follow-up task management endpoints for JWordenAI.

Routes:
  GET  /api/v1/followups                   — list all follow-up tasks
  POST /api/v1/followups/{task_id}/cancel  — cancel a pending follow-up

Requires premium security.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..core.limiter import limiter
from ..core.security import verify_premium_security
from ..database import get_db
from ..models import FollowUpTask
from ..services.follow_up_tasks import cancel_follow_up

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/followups", tags=["follow-ups"])


@router.get("", summary="List all follow-up tasks")
@limiter.limit("60/minute")
async def list_follow_ups(
    request: Request,
    status: Optional[str] = Query(default=None, max_length=20),
    lead_id: Optional[int] = Query(default=None),
    task_type: Optional[str] = Query(default=None, max_length=20),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Return paginated follow-up tasks with optional filters."""
    q = db.query(FollowUpTask)
    if status:
        q = q.filter(FollowUpTask.status == status)
    if lead_id:
        q = q.filter(FollowUpTask.lead_id == lead_id)
    if task_type:
        q = q.filter(FollowUpTask.task_type == task_type)

    total = q.count()
    tasks = q.order_by(FollowUpTask.scheduled_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "tasks": [
            {
                "id": t.id,
                "lead_id": t.lead_id,
                "task_type": t.task_type,
                "scheduled_at": t.scheduled_at.isoformat(),
                "sent_at": t.sent_at.isoformat() if t.sent_at else None,
                "status": t.status,
                "created_at": t.created_at.isoformat(),
            }
            for t in tasks
        ],
    }


@router.post("/{task_id}/cancel", summary="Cancel a pending follow-up task")
@limiter.limit("30/minute")
async def cancel_task(
    request: Request,
    task_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_premium_security),
):
    """Cancel a pending follow-up. Returns 404 if not found or already sent/cancelled."""
    task = db.get(FollowUpTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Follow-up task not found")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot cancel task with status '{task.status}'")

    success = cancel_follow_up(task_id, db=db)
    if not success:
        raise HTTPException(status_code=400, detail="Could not cancel follow-up")

    return {"id": task_id, "status": "cancelled"}
