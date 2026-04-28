"""
SQLAlchemy ORM models for J. Worden & Sons lead persistence.

Schema managed by Alembic migrations; optional AUTO_CREATE_TABLES bootstrap for local dev.
All timestamps are stored in UTC.

Geospatial notes:
  ProjectSite and PermitLead store coordinates as Float columns for SQLite
  compatibility in development.  In production with PostgreSQL + PostGIS,
  run the migration in db/migrations/001_add_postgis_geometry.sql to add
  native GEOMETRY columns and spatial indexes.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, UniqueConstraint

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Lead(Base):
    """A quote request submitted via the multi-step quote form."""

    __tablename__ = "leads"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(120), nullable=False)
    email           = Column(String(254), nullable=False, index=True)
    phone           = Column(String(30), nullable=False)
    service_type    = Column(String(60), nullable=False)
    property_type   = Column(String(30), nullable=False)
    urgency         = Column(String(30), nullable=False)
    project_size_sqft = Column(Float, nullable=True)
    address         = Column(String(300), nullable=True)
    message         = Column(Text, nullable=True)

    # Lead scoring
    score_value     = Column(Integer, nullable=True)
    score_label     = Column(String(10), nullable=True)   # HOT | WARM | COOL
    score_priority  = Column(Integer, nullable=True)

    # Pipeline CRM stage tracking (Feature 3)
    pipeline_stage    = Column(String(30), default='new', nullable=False)
    contacted_at      = Column(DateTime(timezone=True), nullable=True)
    proposal_sent_at  = Column(DateTime(timezone=True), nullable=True)
    closed_at         = Column(DateTime(timezone=True), nullable=True)
    closed_reason     = Column(String(100), nullable=True)

    # Multi-tenant (Feature 15)
    tenant_id       = Column(String(60), nullable=True, index=True, default='default')

    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Lead id={self.id} name={self.name!r} label={self.score_label!r}>"


class ContactMessage(Base):
    """A general contact form submission."""

    __tablename__ = "contact_messages"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(120), nullable=False)
    email      = Column(String(254), nullable=False, index=True)
    phone      = Column(String(30), nullable=True)
    message    = Column(Text, nullable=False)
    # Multi-tenant (Feature 15)
    tenant_id       = Column(String(60), nullable=True, index=True, default='default')

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ContactMessage id={self.id} name={self.name!r}>"


class PageContent(Base):
    """
    CMS content blocks managed through the admin dashboard (webpage maker).

    Each block has a unique ``key`` (e.g. "hero", "services_intro") and stores
    a ``title``, a rich ``body`` (HTML or Markdown), and an optional JSON blob
    in ``meta_json`` for extra structured data (colours, CTAs, etc.).
    The frontend fetches blocks via the public /api/v1/content endpoints.
    """

    __tablename__ = "page_contents"
    __table_args__ = (UniqueConstraint("key", name="uq_page_contents_key"),)

    id         = Column(Integer, primary_key=True, index=True)
    key        = Column(String(100), nullable=False, index=True)
    title      = Column(String(200), nullable=False)
    body       = Column(Text, nullable=False, default="")
    meta_json  = Column(Text, nullable=True)   # optional JSON for extra fields
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<PageContent key={self.key!r} title={self.title!r}>"


# ── Geospatial models ─────────────────────────────────────────────────────────

class ProjectSite(Base):
    """
    A mapped construction/paving site within the JWordenAI service area.

    Geometry is stored as GeoJSON text so the model works with both SQLite
    (development) and PostgreSQL (production).  For PostGIS spatial queries,
    run db/migrations/001_add_postgis_geometry.sql to add native geometry
    columns and GIST indexes alongside these float columns.
    """

    __tablename__ = "project_sites"

    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String(200), nullable=False)
    address          = Column(String(300), nullable=True)
    city             = Column(String(100), nullable=True)
    state            = Column(String(2), nullable=True, default="VA")
    status           = Column(String(30), nullable=False, default="active")   # active | completed | pending
    service_type     = Column(String(60), nullable=True)
    project_size_sqft = Column(Float, nullable=True)

    # Centroid coordinates (WGS84)
    lat              = Column(Float, nullable=True)
    lng              = Column(Float, nullable=True)

    # Service radius in miles (default: 20-mile Richmond grid)
    service_radius_miles = Column(Float, nullable=True, default=20.0)

    # Full polygon stored as GeoJSON FeatureCollection text
    geometry_json    = Column(Text, nullable=True)

    # Calculated area/perimeter from leaflet-draw polygon
    area_sqft        = Column(Float, nullable=True)
    perimeter_ft     = Column(Float, nullable=True)

    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at       = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ProjectSite id={self.id} name={self.name!r} status={self.status!r}>"


class PermitLead(Base):
    """
    A contractor permit lead scraped from Virginia's LIS or other state permit APIs.

    Every record is validated through app/schemas/permit_lead.py before insertion
    to guarantee schema-consistent data for the lead ranking logic.
    """

    __tablename__ = "permit_leads"

    id               = Column(Integer, primary_key=True, index=True)
    source           = Column(String(60), nullable=False, default="virginia_lis")
    permit_number    = Column(String(100), nullable=True, index=True)
    permit_type      = Column(String(100), nullable=False)
    permit_status    = Column(String(50), nullable=True)

    # Contractor info
    contractor_name  = Column(String(200), nullable=True)
    contractor_license = Column(String(100), nullable=True)

    # Property / project
    property_address = Column(String(300), nullable=False)
    property_city    = Column(String(100), nullable=True)
    property_state   = Column(String(2), nullable=True, default="VA")
    property_zip     = Column(String(10), nullable=True)

    # Coordinates (WGS84)
    lat              = Column(Float, nullable=True)
    lng              = Column(Float, nullable=True)

    # Financial
    project_value    = Column(Float, nullable=True)
    estimated_sqft   = Column(Float, nullable=True)

    # Dates
    permit_date      = Column(DateTime(timezone=True), nullable=True)
    expiry_date      = Column(DateTime(timezone=True), nullable=True)

    # Scoring / ranking
    priority_score   = Column(Integer, nullable=True)
    priority_label   = Column(String(10), nullable=True)   # HOT | WARM | COOL

    # Raw JSON blob from the source API (for auditing)
    raw_json         = Column(Text, nullable=True)

    scraped_at       = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    created_at       = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<PermitLead id={self.id} address={self.property_address!r} label={self.priority_label!r}>"


class FollowUpTask(Base):
    """
    Tracks automated follow-up notifications sent (or scheduled) for a lead.

    task_type values: hot_1h | warm_3d | cool_7d
    status values:    pending | sent | cancelled
    """

    __tablename__ = "follow_up_tasks"

    id           = Column(Integer, primary_key=True, index=True)
    lead_id      = Column(Integer, nullable=False, index=True)
    task_type    = Column(String(30), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    sent_at      = Column(DateTime(timezone=True), nullable=True)
    status       = Column(String(20), nullable=False, default="pending")
    created_at   = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<FollowUpTask id={self.id} lead_id={self.lead_id} type={self.task_type!r} status={self.status!r}>"


class TruckPosition(Base):
    """
    Real-time truck telemetry ping stored for zero-delay routing dashboard.

    Positions are upserted by truck_id so the table always holds the latest
    position per truck (old history is not retained — use a time-series store
    like InfluxDB for historical analytics).
    """

    __tablename__ = "truck_positions"

    id              = Column(Integer, primary_key=True, index=True)
    truck_id        = Column(String(30), nullable=False, index=True, unique=True)
    driver_name     = Column(String(120), nullable=True)
    lat             = Column(Float, nullable=False)
    lng             = Column(Float, nullable=False)
    speed_mph       = Column(Float, nullable=True)
    heading_deg     = Column(Float, nullable=True)
    asphalt_temp_f  = Column(Float, nullable=True)
    status          = Column(String(30), nullable=True, default="en_route")  # en_route | on_site | idle
    site_id         = Column(Integer, nullable=True)   # FK to project_sites (soft ref)
    updated_at      = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<TruckPosition truck={self.truck_id!r} status={self.status!r}>"
