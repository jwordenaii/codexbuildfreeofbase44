"""
Strict Pydantic v2 schemas for Virginia LIS / state permit lead ingestion.

Every permit record scraped from external APIs must be validated through
``PermitLeadIn`` before it is ranked or persisted.  This guarantees that
the lead ranking logic (app/services/ranking.py) always receives clean,
schema-consistent data.

Schema design notes:
  - All string fields are stripped of leading/trailing whitespace.
  - Numeric fields are coerced to float/int and validated for sensible ranges.
  - Date fields accept ISO-8601 strings and are converted to datetime.
  - The ``raw_json`` field preserves the original source payload for auditing.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Input schema — used when ingesting records from the scraper
# ---------------------------------------------------------------------------

class PermitLeadIn(BaseModel):
    """
    Validated permit lead record from a state permit API (e.g. Virginia LIS).

    All fields match the corresponding ``PermitLead`` ORM model columns
    (app/models.py) so a validated instance can be unpacked directly into
    the ORM constructor::

        validated = PermitLeadIn(**raw_row)
        db_lead = PermitLead(**validated.model_dump(exclude={"raw_json"}))
    """

    model_config = {"str_strip_whitespace": True, "validate_default": True}

    # ── Source metadata ───────────────────────────────────────────────────────
    source: str = Field(
        default="virginia_lis",
        max_length=60,
        description="Origin system identifier, e.g. 'virginia_lis', 'richmond_city'.",
    )
    permit_number: Optional[str] = Field(default=None, max_length=100)
    permit_type: str = Field(..., min_length=1, max_length=100, description="Type of permit, e.g. 'Commercial Paving'.")
    permit_status: Optional[str] = Field(default=None, max_length=50)

    # ── Contractor ────────────────────────────────────────────────────────────
    contractor_name: Optional[str] = Field(default=None, max_length=200)
    contractor_license: Optional[str] = Field(default=None, max_length=100)

    # ── Property / project ────────────────────────────────────────────────────
    property_address: str = Field(..., min_length=5, max_length=300, description="Full street address of the permitted property.")
    property_city: Optional[str] = Field(default=None, max_length=100)
    property_state: str = Field(default="VA", max_length=2, description="Two-letter US state code.")
    property_zip: Optional[str] = Field(default=None, max_length=10)

    # ── Coordinates ───────────────────────────────────────────────────────────
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Latitude (WGS84).")
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="Longitude (WGS84).")

    # ── Financials ────────────────────────────────────────────────────────────
    project_value: Optional[float] = Field(default=None, ge=0.0, le=1_000_000_000.0, description="Estimated permit value in USD.")
    estimated_sqft: Optional[float] = Field(default=None, ge=0.0, le=50_000_000.0, description="Estimated project area in square feet.")

    # ── Dates ─────────────────────────────────────────────────────────────────
    permit_date: Optional[datetime] = Field(default=None, description="Date the permit was issued (ISO-8601).")
    expiry_date: Optional[datetime] = Field(default=None, description="Date the permit expires (ISO-8601).")

    # ── Raw payload (audit trail) ─────────────────────────────────────────────
    raw_json: Optional[str] = Field(default=None, description="Original JSON string from the source API for audit purposes.")

    # ── Validators ────────────────────────────────────────────────────────────

    @field_validator("property_state")
    @classmethod
    def uppercase_state(cls, v: str) -> str:
        return v.upper()

    @field_validator("permit_type", "permit_status", "contractor_name", mode="before")
    @classmethod
    def normalize_strings(cls, v):
        if isinstance(v, str):
            return v.strip().title()
        return v

    @field_validator("property_zip")
    @classmethod
    def validate_zip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        digits = "".join(c for c in v if c.isdigit() or c == "-")
        if not digits:
            return None
        return digits[:10]

    @model_validator(mode="after")
    def expiry_after_issue(self) -> "PermitLeadIn":
        if self.permit_date and self.expiry_date:
            if self.expiry_date < self.permit_date:
                raise ValueError("expiry_date must be on or after permit_date.")
        return self

    # ── Computed lead priority ────────────────────────────────────────────────

    def compute_priority(self) -> tuple[int, Literal["HOT", "WARM", "COOL"]]:
        """
        Score and classify this permit lead based on project value and size.

        Returns:
            (score: int, label: "HOT" | "WARM" | "COOL")
        """
        score = 0

        # Project value tier
        pv = self.project_value or 0.0
        if pv >= 500_000:
            score += 40
        elif pv >= 100_000:
            score += 30
        elif pv >= 25_000:
            score += 20
        else:
            score += 10

        # Area tier
        sqft = self.estimated_sqft or 0.0
        if sqft >= 10_000:
            score += 40
        elif sqft >= 5_000:
            score += 30
        elif sqft >= 1_000:
            score += 20
        else:
            score += 10

        # Paving-relevant permit type bonus
        paving_keywords = {"paving", "asphalt", "parking", "roadway", "driveway", "pavement"}
        if any(kw in (self.permit_type or "").lower() for kw in paving_keywords):
            score += 20

        # Virginia bonus (primary service area)
        if self.property_state == "VA":
            score += 10

        label: Literal["HOT", "WARM", "COOL"]
        if score >= 80:
            label = "HOT"
        elif score >= 50:
            label = "WARM"
        else:
            label = "COOL"

        return score, label


# ---------------------------------------------------------------------------
# Output schema — used when returning permit lead records to the frontend
# ---------------------------------------------------------------------------

class PermitLeadOut(BaseModel):
    """Read-only view of a permit lead returned by the API."""

    model_config = {"from_attributes": True}

    id: int
    source: str
    permit_number: Optional[str]
    permit_type: str
    permit_status: Optional[str]
    contractor_name: Optional[str]
    property_address: str
    property_city: Optional[str]
    property_state: str
    property_zip: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    project_value: Optional[float]
    estimated_sqft: Optional[float]
    permit_date: Optional[datetime]
    priority_score: Optional[int]
    priority_label: Optional[str]
    scraped_at: datetime


# ---------------------------------------------------------------------------
# Batch input schema — for bulk ingest from the Celery scraper task
# ---------------------------------------------------------------------------

class PermitLeadBatch(BaseModel):
    """Wrapper for bulk permit lead ingestion (used by the scraper Celery task)."""

    source: str = Field(..., max_length=60)
    leads: list[PermitLeadIn] = Field(..., min_length=1, max_length=1_000)
    scrape_run_id: Optional[str] = Field(default=None, max_length=100, description="Unique scrape run identifier for deduplication.")
