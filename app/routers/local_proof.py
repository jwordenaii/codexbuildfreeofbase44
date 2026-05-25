import datetime
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/v1/projects", tags=["local-proof"])

class ProjectProof(BaseModel):
    id: str
    city: str
    description: str
    equipment_used: List[str]
    completionDate: str

@router.get("/local", response_model=List[ProjectProof])
async def get_local_proof(city: str = Query(..., description="Target city for SEO injection")):
    this_month = datetime.date.today().strftime("%B %Y")
    return [
        ProjectProof(
            id="PROJ-001",
            city=city,
            description=f"Complete commercial lot overhaul for local medical facility in {city}",
            equipment_used=["Mauldin 690", "Ford F-750", "Wacker Neuson Compactor"],
            completionDate=this_month,
        ),
        ProjectProof(
            id="PROJ-002",
            city=city,
            description="High-traffic drive-thru repaving executed under Sunday Paving protocol",
            equipment_used=["LeeBoy Paver"],
            completionDate="April 2026",
        ),
    ]
