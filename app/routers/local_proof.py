from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import ProjectSite

router = APIRouter(prefix="/api/v1/projects", tags=["local-proof"])


class ProjectProof(BaseModel):
    id: str
    city: str
    description: str
    equipment_used: List[str]
    completionDate: str


@router.get("/local", response_model=List[ProjectProof])
async def get_local_proof(
    city: str = Query(..., description="City to look up real completed projects for"),
    db: Session = Depends(get_db),
):
    """
    Real completed projects in the given city, most recent first. Returns an
    empty list when no completed ProjectSite rows exist for that city — never
    fabricates project history to fill a landing page.
    """
    sites = (
        db.query(ProjectSite)
        .filter(ProjectSite.city.ilike(city), ProjectSite.status == "completed")
        .order_by(ProjectSite.updated_at.desc())
        .limit(5)
        .all()
    )
    return [
        ProjectProof(
            id=f"PROJ-{s.id}",
            city=s.city or city,
            description=(
                s.notes.strip()
                if s.notes and s.notes.strip()
                else f"{s.service_type or 'Paving'} project completed in {s.city or city}"
            ),
            equipment_used=[],
            completionDate=s.updated_at.strftime("%B %Y") if s.updated_at else "",
        )
        for s in sites
    ]
