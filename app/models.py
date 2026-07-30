"""
SQLAlchemy ORM models for J. Worden & Sons — full platform persistence layer.

Schema managed by Alembic migrations; optional AUTO_CREATE_TABLES bootstrap for local dev.
All timestamps are stored in UTC.

Geospatial notes:
  ProjectSite and PermitLead store coordinates as Float columns for SQLite
  compatibility in development.  In production with PostgreSQL + PostGIS,
  run the migration in db/migrations/001_add_postgis_geometry.sql to add
  native GEOMETRY columns and spatial indexes.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    # ForeignKey and JSON arrived with the eight tables ported from
    # jworden-production on 2026-07-28 — the User/LMS models use both.
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Lead(Base):
    """A quote request submitted via the multi-step quote form."""

    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(254), nullable=False, index=True)
    phone = Column(String(30), nullable=False)
    service_type = Column(String(60), nullable=False)
    property_type = Column(String(30), nullable=False)
    urgency = Column(String(30), nullable=False)
    project_size_sqft = Column(Float, nullable=True)
    address = Column(String(300), nullable=True)
    state_code = Column(String(2), nullable=True, index=True)
    message = Column(Text, nullable=True)

    # Lead scoring
    score_value = Column(Integer, nullable=True)
    score_label = Column(String(10), nullable=True)  # HOT | WARM | COOL
    score_priority = Column(Integer, nullable=True)

    # Pipeline CRM stage tracking (Feature 3)
    pipeline_stage = Column(String(30), default="new", nullable=False)
    contacted_at = Column(DateTime(timezone=True), nullable=True)
    proposal_sent_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_reason = Column(String(100), nullable=True)

    # Multi-tenant (Feature 15)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")

    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Lead id={self.id} name={self.name!r} label={self.score_label!r}>"


class ContactMessage(Base):
    """A general contact form submission."""

    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(254), nullable=False, index=True)
    phone = Column(String(30), nullable=True)
    message = Column(Text, nullable=False)
    # Multi-tenant (Feature 15)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")

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

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False, default="")
    meta_json = Column(Text, nullable=True)  # optional JSON for extra fields
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )
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

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(String(300), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(2), nullable=True, default="VA")
    status = Column(
        String(30), nullable=False, default="active"
    )  # active | completed | pending
    service_type = Column(String(60), nullable=True)
    project_size_sqft = Column(Float, nullable=True)

    # Centroid coordinates (WGS84)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    # Service radius in miles (default: 20-mile Richmond grid)
    service_radius_miles = Column(Float, nullable=True, default=20.0)

    # Full polygon stored as GeoJSON FeatureCollection text
    geometry_json = Column(Text, nullable=True)

    # Calculated area/perimeter from leaflet-draw polygon
    area_sqft = Column(Float, nullable=True)
    perimeter_ft = Column(Float, nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProjectSite id={self.id} name={self.name!r} status={self.status!r}>"


class PermitLead(Base):
    """
    A contractor permit lead scraped from Virginia's LIS or other state permit APIs.

    Every record is validated through app/schemas/permit_lead.py before insertion
    to guarantee schema-consistent data for the lead ranking logic.
    """

    __tablename__ = "permit_leads"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(60), nullable=False, default="virginia_lis")
    permit_number = Column(String(100), nullable=True, index=True)
    permit_type = Column(String(100), nullable=False)
    permit_status = Column(String(50), nullable=True)

    # Contractor info
    contractor_name = Column(String(200), nullable=True)
    contractor_license = Column(String(100), nullable=True)

    # Property / project
    property_address = Column(String(300), nullable=False)
    property_city = Column(String(100), nullable=True)
    property_state = Column(String(2), nullable=True, default="VA")
    property_zip = Column(String(10), nullable=True)

    # Coordinates (WGS84)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    # Financial
    project_value = Column(Float, nullable=True)
    estimated_sqft = Column(Float, nullable=True)

    # Dates
    permit_date = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)

    # Scoring / ranking
    priority_score = Column(Integer, nullable=True)
    priority_label = Column(String(10), nullable=True)  # HOT | WARM | COOL

    # Raw JSON blob from the source API (for auditing)
    raw_json = Column(Text, nullable=True)

    scraped_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<PermitLead id={self.id} address={self.property_address!r} label={self.priority_label!r}>"


class Appointment(Base):
    """
    A scheduled commitment — site visit, estimate walk, crew start, meeting.

    Kept separate from FollowUpTask (which is an automated nudge tied to a lead)
    because an appointment is a thing a human agreed to be at, may have no lead
    behind it, and needs a place and an attendee. Jarvis creates and reads these
    on the operator's behalf.
    """

    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(60), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=False, default=60)
    location = Column(String(300), nullable=True)
    customer_name = Column(String(150), nullable=True)
    customer_phone = Column(String(40), nullable=True)
    customer_email = Column(String(200), nullable=True)
    # 'estimate' | 'site_visit' | 'crew_start' | 'meeting' | 'other'
    appointment_type = Column(String(30), nullable=False, default="estimate")
    notes = Column(Text, nullable=True)
    # 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
    status = Column(String(20), nullable=False, default="scheduled")
    lead_id = Column(Integer, nullable=True, index=True)
    created_by = Column(String(80), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)


class FollowUpTask(Base):
    """
    Tracks automated follow-up notifications sent (or scheduled) for a lead.

    task_type values: hot_1h | warm_3d | cool_7d
    status values:    pending | sent | cancelled
    """

    __tablename__ = "follow_up_tasks"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, nullable=False, index=True)
    task_type = Column(String(30), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

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

    id = Column(Integer, primary_key=True, index=True)
    truck_id = Column(String(30), nullable=False, index=True, unique=True)
    driver_name = Column(String(120), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    speed_mph = Column(Float, nullable=True)
    heading_deg = Column(Float, nullable=True)
    asphalt_temp_f = Column(Float, nullable=True)
    mix_type = Column(String(60), nullable=True)
    plant_departed_at = Column(DateTime(timezone=True), nullable=True)
    target_delivery_temp_f = Column(Float, nullable=True)
    estimated_arrival_minutes = Column(Float, nullable=True)
    status = Column(
        String(30), nullable=True, default="en_route"
    )  # en_route | on_site | idle
    site_id = Column(Integer, nullable=True)  # FK to project_sites (soft ref)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<TruckPosition truck={self.truck_id!r} status={self.status!r}>"


class GroundScanReport(Base):
    """
    Civil-tech utility locating and subsurface scan record before digging.

    Supports modern locate workflows: 811 ticket tracking, electromagnetic
    locating, GPR, potholing/vacuum excavation, LiDAR/as-built overlays,
    thermal/moisture flags, soil/base concerns, and AI risk summarisation.
    """

    __tablename__ = "ground_scan_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_site_id = Column(Integer, nullable=True, index=True)
    address = Column(String(300), nullable=True)
    scan_area_sqft = Column(Float, nullable=True)
    ticket_811 = Column(String(100), nullable=True)
    ticket_status = Column(String(40), nullable=True)
    technologies_json = Column(Text, nullable=True)
    utilities_json = Column(Text, nullable=True)
    risk_level = Column(String(20), nullable=False, default="UNKNOWN")
    confidence = Column(Float, nullable=True)
    recommendation = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


# ── Multi-turn chat session ───────────────────────────────────────────────────


class ChatSession(Base):
    """Stores serialised conversation history for multi-turn AI chat."""

    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True, unique=True)
    messages_json = Column(Text, nullable=False, default="[]")
    customer_name = Column(String(120), nullable=True)
    customer_email = Column(String(254), nullable=True)
    state_code = Column(String(2), nullable=True)
    last_service = Column(String(60), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ChatSession session_id={self.session_id!r}>"


# ── Human review queue ────────────────────────────────────────────────────────


class HumanReviewQueue(Base):
    """Holds low-confidence AI decisions flagged for manual review."""

    __tablename__ = "human_review_queue"

    id = Column(Integer, primary_key=True, index=True)
    decision_type = Column(
        String(60), nullable=False
    )  # chat | compliance | lead_score …
    input_summary = Column(String(500), nullable=False)
    ai_answer = Column(Text, nullable=False)
    ai_engine = Column(String(60), nullable=True)  # gpt-4o-mini | gpt-4o | stub
    confidence = Column(Float, nullable=True)
    status = Column(
        String(20), nullable=False, default="pending"
    )  # pending | approved | rejected
    reviewer_note = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<HumanReviewQueue id={self.id} decision={self.decision_type!r} status={self.status!r}>"


# ── Mechanics lien calendar ───────────────────────────────────────────────────


class LienCalendarEntry(Base):
    """Tracks lien filing deadlines for active construction projects."""

    __tablename__ = "lien_calendar_entries"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(120), nullable=False)
    project_address = Column(String(300), nullable=False)
    state_code = Column(String(2), nullable=False, index=True)
    project_start_date = Column(DateTime(timezone=True), nullable=True)
    last_furnishing_date = Column(DateTime(timezone=True), nullable=True)
    preliminary_notice_deadline = Column(DateTime(timezone=True), nullable=True)
    lien_filing_deadline = Column(DateTime(timezone=True), nullable=True)
    foreclosure_deadline = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<LienCalendarEntry id={self.id} state={self.state_code!r} customer={self.customer_name!r}>"


# ── Blog ──────────────────────────────────────────────────────────────────────


class BlogPost(Base):
    """CMS blog post for the JWordenAI content hub."""

    __tablename__ = "blog_posts"
    __table_args__ = (UniqueConstraint("slug", name="uq_blog_posts_slug"),)

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(200), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    excerpt = Column(String(500), nullable=False, default="")
    body = Column(Text, nullable=False, default="")
    category = Column(String(60), nullable=True)
    tags = Column(String(500), nullable=True)
    meta_title = Column(String(300), nullable=True)
    meta_description = Column(String(320), nullable=True)
    focus_keyword = Column(String(120), nullable=True)
    author_name = Column(String(120), nullable=True, default="J. Worden & Sons")
    image_url = Column(String(500), nullable=True)
    featured = Column(Integer, nullable=False, default=0)  # 0 | 1
    status = Column(
        String(20), nullable=False, default="draft"
    )  # draft | published | archived
    read_time_minutes = Column(Integer, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<BlogPost slug={self.slug!r} status={self.status!r}>"


# ── Cash-flow ─────────────────────────────────────────────────────────────────


class CashFlowEntry(Base):
    """Income or expense entry for the cash-flow projection board."""

    __tablename__ = "cashflow_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_type = Column(String(20), nullable=False)  # income | expense
    amount = Column(Float, nullable=False)
    expected_date = Column(DateTime(timezone=True), nullable=False)
    category = Column(String(60), nullable=True)
    description = Column(String(500), nullable=True)
    source = Column(String(60), nullable=True, default="manual")
    source_id = Column(Integer, nullable=True)  # FK to leads or payment_transactions
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<CashFlowEntry type={self.entry_type!r} amount={self.amount}>"


class CashFlowAlert(Base):
    """Per-tenant threshold alert for low projected cash balance."""

    __tablename__ = "cashflow_alerts"

    id = Column(Integer, primary_key=True, index=True)
    threshold_amount = Column(Float, nullable=False)
    alert_email = Column(String(254), nullable=False)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<CashFlowAlert threshold={self.threshold_amount} email={self.alert_email!r}>"


# ── Customer CRM ──────────────────────────────────────────────────────────────


class Customer(Base):
    """CRM customer record — residential, commercial, or franchise client."""

    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(254), nullable=True, index=True)
    phone = Column(String(30), nullable=True)
    company = Column(String(120), nullable=True)
    address = Column(String(300), nullable=True)
    city = Column(String(100), nullable=True)
    state_code = Column(String(2), nullable=True, index=True)
    zip_code = Column(String(10), nullable=True)
    customer_type = Column(
        String(30), nullable=True
    )  # residential | commercial | franchise
    is_franchise = Column(Integer, nullable=False, default=0)
    brand = Column(String(60), nullable=True)  # KFC | Taco Bell | etc.
    notes = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)
    services = Column(Text, nullable=True)  # services this customer buys (e.g. Paving, Sealcoating)
    maintenance_agreement = Column(Text, nullable=True)  # plan/cadence/renewal/terms
    external_id = Column(String(100), nullable=True)
    source = Column(String(60), nullable=True, default="manual")
    total_jobs = Column(Integer, nullable=False, default=0)
    total_revenue = Column(Float, nullable=False, default=0.0)
    last_job_date = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Customer id={self.id} name={self.name!r}>"


class ServiceHistory(Base):
    """A completed service job linked to a Customer."""

    __tablename__ = "service_history"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, nullable=False, index=True)  # FK to customers.id
    job_date = Column(DateTime(timezone=True), nullable=True)
    service_type = Column(String(60), nullable=True)
    scope_summary = Column(Text, nullable=True)
    location = Column(String(300), nullable=True)
    state_code = Column(String(2), nullable=True)
    sqft = Column(Float, nullable=True)
    revenue = Column(Float, nullable=True)
    is_qsr = Column(Integer, nullable=False, default=0)
    brand = Column(String(60), nullable=True)
    warranty_callback = Column(Integer, nullable=False, default=0)
    gc_score = Column(Float, nullable=True)
    has_photos = Column(Integer, nullable=False, default=0)
    dropbox_url = Column(String(500), nullable=True)
    photos_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ServiceHistory id={self.id} customer_id={self.customer_id}>"


class Estimate(Base):
    """Commercial estimate record derived from a lead and used to start a job."""

    __tablename__ = "estimates"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, nullable=True, index=True)
    customer_id = Column(Integer, nullable=True, index=True)
    estimate_number = Column(String(80), nullable=False, unique=True, index=True)
    status = Column(
        String(30), nullable=False, default="draft"
    )  # draft | sent | approved | rejected | converted
    service_type = Column(String(60), nullable=True)
    scope_summary = Column(Text, nullable=True)
    amount_low = Column(Float, nullable=True)
    amount_high = Column(Float, nullable=True)
    currency = Column(String(10), nullable=False, default="usd")
    state_code = Column(String(2), nullable=True, index=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Estimate id={self.id} number={self.estimate_number!r} status={self.status!r}>"


class Job(Base):
    """Primary operational job record created from an approved estimate."""

    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, nullable=True, index=True)
    lead_id = Column(Integer, nullable=True, index=True)
    customer_id = Column(Integer, nullable=True, index=True)
    job_number = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    status = Column(
        String(30), nullable=False, default="scheduled"
    )  # scheduled | active | blocked | completed | cancelled
    service_type = Column(String(60), nullable=True)
    site_address = Column(String(300), nullable=True)
    state_code = Column(String(2), nullable=True, index=True)
    scheduled_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)
    progress_percent = Column(Integer, nullable=False, default=0)
    progress_notes = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Job id={self.id} number={self.job_number!r} status={self.status!r}>"


class ProjectDocument(Base):
    """Customer-facing job document persisted for admin and portal workflows."""

    __tablename__ = "project_documents"

    id = Column(String(36), primary_key=True, index=True)
    job_id = Column(Integer, nullable=False, index=True)
    client_email = Column(String(254), nullable=True, index=True)
    document_type = Column(String(40), nullable=False, default="other")
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String(300), nullable=False)
    mime_type = Column(String(120), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    file_url = Column(Text, nullable=False)
    visible_to_client = Column(Boolean, nullable=False, default=True)
    uploaded_by = Column(String(120), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProjectDocument id={self.id!r} job_id={self.job_id} type={self.document_type!r}>"


class WorkOrder(Base):
    """Field-execution unit of work under a job for crews and dispatch."""

    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, nullable=False, index=True)
    work_order_number = Column(String(80), nullable=False, unique=True, index=True)
    title = Column(String(200), nullable=False)
    status = Column(
        String(30), nullable=False, default="scheduled"
    )  # scheduled | dispatched | in_progress | completed | blocked
    assigned_crew = Column(String(120), nullable=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<WorkOrder id={self.id} number={self.work_order_number!r} status={self.status!r}>"


# ── iGrade & media files ──────────────────────────────────────────────────────


class GradeLog(Base):
    """iGrade engine decision log — records grade + model + confidence per AI call."""

    __tablename__ = "grade_logs"

    id = Column(Integer, primary_key=True, index=True)
    decision_type = Column(String(60), nullable=False, index=True)
    grade = Column(String(1), nullable=False)  # A | B | C | D
    input_summary = Column(String(500), nullable=True)
    ai_engine = Column(String(60), nullable=True)
    confidence = Column(Float, nullable=True)
    processing_ms = Column(Integer, nullable=True)
    was_corrected = Column(Integer, nullable=False, default=0)
    correction_applied = Column(Integer, nullable=False, default=0)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<GradeLog id={self.id} grade={self.grade!r} type={self.decision_type!r}>"
        )


class MediaFile(Base):
    """Project media file record (photos, PDFs, videos)."""

    __tablename__ = "media_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(300), nullable=False)
    file_type = Column(String(20), nullable=True)  # image | pdf | video
    mime_type = Column(String(100), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    storage_url = Column(String(1000), nullable=False)
    storage_provider = Column(String(60), nullable=True, default="local")
    linked_to_type = Column(String(60), nullable=True)  # lead | project_site | customer
    linked_to_id = Column(Integer, nullable=True)
    project_name = Column(String(200), nullable=True)
    tags = Column(String(500), nullable=True)
    ai_description = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<MediaFile id={self.id} filename={self.filename!r}>"


# ── Innovations tracker ───────────────────────────────────────────────────────


class Innovation(Base):
    """Tracks experimental paving methods, tools, and QSR innovations."""

    __tablename__ = "innovations"

    id = Column(Integer, primary_key=True, index=True)
    method_name = Column(String(200), nullable=False)
    job_site = Column(String(300), nullable=True)
    date_tested = Column(DateTime(timezone=True), nullable=True)
    cost_to_test = Column(Float, nullable=True)
    result = Column(
        String(30), nullable=False, default="pending"
    )  # pass | fail | adopted | pending
    category = Column(
        String(60), nullable=True
    )  # drone | materials | robotics | process
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Innovation id={self.id} name={self.method_name!r} result={self.result!r}>"


# ── Payments ──────────────────────────────────────────────────────────────────


class PaymentTransaction(Base):
    """Stripe checkout session / payment record linked to a lead."""

    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, nullable=False, index=True)
    stripe_checkout_session_id = Column(String(200), nullable=True, index=True)
    stripe_payment_intent_id = Column(String(200), nullable=True)
    amount_usd = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="usd")
    status = Column(
        String(30), nullable=False, default="pending"
    )  # pending | paid | failed | refunded
    paid_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<PaymentTransaction id={self.id} lead_id={self.lead_id} status={self.status!r}>"


# ── Project metrics ───────────────────────────────────────────────────────────


class ProjectMetric(Base):
    """Post-completion project KPIs for benchmarking and retro analysis."""

    __tablename__ = "project_metrics"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(200), nullable=False)
    lead_id = Column(Integer, nullable=True, index=True)
    actual_cost = Column(Float, nullable=True)
    estimated_cost = Column(Float, nullable=True)
    scheduled_days = Column(Integer, nullable=True)
    actual_days = Column(Integer, nullable=True)
    client_nps = Column(Integer, nullable=True)  # 0-10
    punch_list_items = Column(Integer, nullable=False, default=0)
    punch_list_closed = Column(Integer, nullable=False, default=0)
    completion_date = Column(DateTime(timezone=True), nullable=True)
    ai_summary = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProjectMetric id={self.id} project={self.project_name!r}>"


# ── Project retrospectives ────────────────────────────────────────────────────


class ProjectRetrospective(Base):
    """AI-assisted lessons-learned record after project close-out."""

    __tablename__ = "project_retrospectives"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(200), nullable=False)
    project_type = Column(String(60), nullable=True)
    region = Column(String(100), nullable=True)
    closed_date = Column(DateTime(timezone=True), nullable=True)
    schedule_variance_days = Column(Integer, nullable=True)
    cost_variance_pct = Column(Float, nullable=True)
    supply_chain_issues = Column(Text, nullable=True)
    soil_conditions = Column(Text, nullable=True)
    design_conflicts = Column(Text, nullable=True)
    lessons_learned = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProjectRetrospective id={self.id} project={self.project_name!r}>"


# ── Site metrics / dashboard ──────────────────────────────────────────────────


class SiteEvaluation(Base):
    """
    Monthly compliance + ad-ROI snapshot used by the Command Center dashboard.

    Records are inserted once per month (or on demand via admin tooling).
    The ``compliance_score`` is a 0-100 percentage; ``ad_roi`` is a multiplier
    (e.g. 3.1 means $3.10 returned per $1 spent).
    """

    __tablename__ = "site_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    compliance_score = Column(Float, nullable=False)  # 0-100
    ad_roi = Column(Float, nullable=False)  # e.g. 3.1
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    last_checked = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SiteEvaluation id={self.id} compliance={self.compliance_score} roi={self.ad_roi}>"


# ── Regional Base Evaluator ───────────────────────────────────────────────────


class RegionalBaseEvaluation(Base):
    """
    Per-site regional base evaluation driven by local DOT specs, soil data,
    and environmental conditions.  Replaces the flat 6-inch base assumption
    with a calculated depth for each site location.

    Fields:
      site_location       — Human-readable address / area (e.g. "Tuckahoe, VA")
      dot_standard        — VDOT or state DOT spec applied (e.g. "VDOT SM-9.5A")
      soil_type           — 0.0 (very soft/clay) to 1.0 (hard/rock) bearing index
      required_base_depth — Calculated minimum aggregate base depth in inches
      compliance_status   — Pending | Compliant | NonCompliant | Waived
      evaluated_by        — Who/what engine ran the evaluation (e.g. "SupremeCourtAI")
      notes               — Free-text evaluation notes / recommendations
      tenant_id           — Multi-tenant isolation key
    """

    __tablename__ = "regional_base_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    site_location = Column(String(300), nullable=False)
    dot_standard = Column(String(120), nullable=True)
    soil_type = Column(Float, nullable=True)  # 0.0–1.0
    required_base_depth = Column(Float, nullable=True)  # inches
    compliance_status = Column(String(30), nullable=False, default="Pending")
    evaluated_by = Column(String(80), nullable=True, default="SupremeCourtAI")
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<RegionalBaseEvaluation id={self.id} "
            f"location={self.site_location!r} depth={self.required_base_depth}in "
            f"status={self.compliance_status!r}>"
        )


# ── Compaction telemetry ──────────────────────────────────────────────────────


class CompactionLog(Base):
    """
    GPS-tagged compaction pass record from intelligent rollers.

    Each ping represents one compaction pass at a specific lat/lng.
    Aggregate these records by project_site_id to render a heat map of
    pass count and mat density across the paving surface.

    Fields:
      roller_id         — Equipment ID or tail number
      pass_number       — Sequential pass count at this location
      mat_temp_f        — Asphalt mat temperature at time of pass (°F)
      mat_thickness_in  — Measured mat thickness (inches)
      density_pct       — Achieved density as % of target (e.g. 96.5)
      speed_mph         — Roller ground speed during pass
      gps_accuracy_ft   — GPS fix accuracy (feet)
    """

    __tablename__ = "compaction_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_site_id = Column(Integer, nullable=True, index=True)
    roller_id = Column(String(60), nullable=False, index=True)
    operator_name = Column(String(120), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    pass_number = Column(Integer, nullable=True)
    mat_temp_f = Column(Float, nullable=True)
    mat_thickness_in = Column(Float, nullable=True)
    density_pct = Column(Float, nullable=True)  # % of target density
    speed_mph = Column(Float, nullable=True)
    gps_accuracy_ft = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    logged_at = Column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<CompactionLog id={self.id} roller={self.roller_id!r} "
            f"site={self.project_site_id} density={self.density_pct}%>"
        )


# ── Drone scan records ────────────────────────────────────────────────────────


class DroneScan(Base):
    """
    Drone-based site capture record (photogrammetry, LiDAR, or thermal).

    Stores the scan metadata, AI-detected findings, and a GeoJSON summary
    of detected deviations or missing elements against the design model.

    Fields:
      scan_type         — photogrammetry | lidar | thermal | rgb
      resolution_cm     — Ground sample distance (cm); lower = more precise
      coverage_sqft     — Area covered by the flight
      geojson_summary   — FeatureCollection JSON of detected anomalies
      findings_json     — Structured list of AI-flagged issues
      deviation_count   — Number of deviations vs design model
      risk_level        — LOW | MEDIUM | HIGH | CRITICAL
    """

    __tablename__ = "drone_scans"

    id = Column(Integer, primary_key=True, index=True)
    project_site_id = Column(Integer, nullable=False, index=True)
    scan_type = Column(String(60), nullable=False, default="photogrammetry")
    operator_name = Column(String(120), nullable=True)
    drone_model = Column(String(120), nullable=True)
    flight_altitude_ft = Column(Float, nullable=True)
    coverage_sqft = Column(Float, nullable=True)
    resolution_cm = Column(Float, nullable=True)  # ground sample distance
    geojson_url = Column(String(500), nullable=True)  # remote storage URL
    geojson_summary = Column(Text, nullable=True)  # FeatureCollection JSON
    findings_json = Column(Text, nullable=True)  # [{issue, severity, lat, lng}]
    ai_summary = Column(Text, nullable=True)
    deviation_count = Column(Integer, nullable=True, default=0)
    risk_level = Column(String(20), nullable=False, default="UNKNOWN")
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    scanned_at = Column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<DroneScan id={self.id} site={self.project_site_id} "
            f"type={self.scan_type!r} risk={self.risk_level!r}>"
        )


# ── 50-State License Compliance ───────────────────────────────────────────────


class LicenseVerificationLog(Base):
    """
    Immutable audit record for every contractor/subcontractor license check.

    Each time the compliance engine verifies a license (scheduled daily or
    on-demand), a new row is inserted.  Never updated — query by
    ``license_number + state_code`` ordered by ``checked_at`` desc for the
    latest status.

    Fields:
      entity_name     — Business name on the license (as returned by the API)
      state_code      — Two-letter state code (e.g. "VA", "CA")
      license_number  — License ID from the state board
      license_type    — e.g. "Class A Contractor", "C-32 Asphalt"
      status          — Active | Expired | Suspended | Cancelled | Unknown
      expiration_date — Parsed expiration date (nullable)
      days_until_exp  — Computed days remaining at time of check
      is_compliant    — True when status == Active and not within 7-day window
      api_source      — Which provider returned the result (Apify | Shovels | stub)
      raw_json        — Full API response blob for audit
      subcontractor_id — FK to subcontractor roster (soft ref, nullable)
      tenant_id       — Multi-tenant isolation key
    """

    __tablename__ = "license_verification_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_name = Column(String(200), nullable=True)
    state_code = Column(String(2), nullable=False, index=True)
    license_number = Column(String(100), nullable=False, index=True)
    license_type = Column(String(120), nullable=True)
    status = Column(String(40), nullable=False, default="Unknown")
    expiration_date = Column(DateTime(timezone=True), nullable=True)
    days_until_exp = Column(Integer, nullable=True)
    is_compliant = Column(Boolean, nullable=False, default=False)
    api_source = Column(String(60), nullable=True)
    raw_json = Column(Text, nullable=True)
    subcontractor_id = Column(Integer, nullable=True, index=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    checked_at = Column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<LicenseVerificationLog id={self.id} "
            f"state={self.state_code} lic={self.license_number!r} "
            f"status={self.status!r} compliant={self.is_compliant}>"
        )


# ── Advertising Intelligence ──────────────────────────────────────────────────


class AdUrlExclusion(Base):
    """
    URL path patterns excluded from Google Ads AI Max URL expansion.

    Prevents the AI Max system from routing paid traffic to non-converting
    pages (blog, careers, FAQ, legal, admin).  Default patterns are hardcoded
    in ad_signals.py; this table stores operator-added custom exclusions.
    """

    __tablename__ = "ad_url_exclusions"

    id = Column(Integer, primary_key=True, index=True)
    path_pattern = Column(String(300), nullable=False, unique=True)
    reason = Column(String(200), nullable=True)
    created_by = Column(String(120), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<AdUrlExclusion id={self.id} pattern={self.path_pattern!r} active={self.is_active}>"


class AnomalyAlert(Base):
    """
    Persistent anomaly detection alerts for key business metrics.

    Generated by anomaly_detector.run_all_checks() and persisted by
    persist_anomalies().  The Celery beat task runs every 30 minutes.
    Alerts are resolved manually via the /api/v1/ads/anomalies/{id}/resolve
    endpoint, or automatically when the underlying condition clears.

    Metrics: lead_volume_24h | hot_lead_rate | cool_lead_surge | zero_lead_gap
    Severity: LOW | MEDIUM | HIGH | CRITICAL
    """

    __tablename__ = "anomaly_alerts"

    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(80), nullable=False, index=True)
    current_value = Column(Float, nullable=False)
    baseline_value = Column(Float, nullable=False)
    z_score = Column(Float, nullable=True)
    severity = Column(String(10), nullable=False, index=True)
    message = Column(String(500), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    detected_at = Column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    def __repr__(self) -> str:
        return f"<AnomalyAlert id={self.id} metric={self.metric_name!r} severity={self.severity!r}>"


# ── Safety ────────────────────────────────────────────────────────────────────


class SafetyToolboxTalk(Base):
    """Daily toolbox safety talk — documented pre-shift safety briefing."""

    __tablename__ = "safety_toolbox_talks"

    id = Column(Integer, primary_key=True, index=True)
    job_site = Column(String(300), nullable=False)
    talk_date = Column(DateTime(timezone=True), nullable=False)
    topic = Column(String(200), nullable=True)
    foreman = Column(String(120), nullable=True)
    crew_count = Column(Integer, nullable=True)
    signed_off = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SafetyToolboxTalk id={self.id} site={self.job_site!r}>"


class SafetyIncident(Base):
    """OSHA recordable / near-miss incident log."""

    __tablename__ = "safety_incidents"

    id = Column(Integer, primary_key=True, index=True)
    job_site = Column(String(300), nullable=False)
    incident_date = Column(DateTime(timezone=True), nullable=False)
    incident_type = Column(
        String(100), nullable=True
    )  # near_miss | first_aid | recordable | fatality
    root_cause = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    corrective_action = Column(Text, nullable=True)
    osha_recordable = Column(Integer, nullable=False, default=0)
    days_away = Column(Integer, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SafetyIncident id={self.id} site={self.job_site!r}>"


# ── Subcontractors ────────────────────────────────────────────────────────────


class SubcontractorRoster(Base):
    """Directory of subcontractors with license / insurance tracking."""

    __tablename__ = "subcontractor_roster"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    company = Column(String(120), nullable=True)
    email = Column(String(254), nullable=True)
    phone = Column(String(30), nullable=True)
    state_code = Column(String(2), nullable=False, index=True)
    license_number = Column(String(100), nullable=True)
    license_expiry = Column(DateTime(timezone=True), nullable=True)
    insurance_expiry = Column(DateTime(timezone=True), nullable=True)
    bond_expiry = Column(DateTime(timezone=True), nullable=True)
    bond_amount = Column(Float, nullable=True)
    insurance_carrier = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<SubcontractorRoster id={self.id} name={self.name!r}>"


class SubcontractorPerformance(Base):
    """Per-project performance review for a subcontractor."""

    __tablename__ = "subcontractor_performance"

    id = Column(Integer, primary_key=True, index=True)
    subcontractor_id = Column(
        Integer, nullable=True, index=True
    )  # FK to subcontractor_roster.id
    project_name = Column(String(200), nullable=False)
    scope = Column(String(200), nullable=True)
    on_time = Column(Integer, nullable=False, default=1)
    quality_rating = Column(Integer, nullable=True)  # 1-5
    payment_dispute = Column(Integer, nullable=False, default=0)
    rehire_recommended = Column(Integer, nullable=False, default=1)
    notes = Column(Text, nullable=True)
    project_date = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SubcontractorPerformance id={self.id} project={self.project_name!r}>"


# ── Workforce ─────────────────────────────────────────────────────────────────


class WorkforceMember(Base):
    """Employee or subcontractor crew member with skills and availability."""

    __tablename__ = "workforce_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    member_type = Column(
        String(30), nullable=False, default="employee"
    )  # employee | sub
    trade = Column(String(60), nullable=True)
    certifications = Column(Text, nullable=True)  # JSON list
    skill_ratings = Column(Text, nullable=True)  # JSON dict {trade: 1-5}
    available = Column(Integer, nullable=False, default=1)
    subcontractor_id = Column(Integer, nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(254), nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<WorkforceMember id={self.id} name={self.name!r}>"


# ── Bid intelligence / proposal outcomes ─────────────────────────────────────


class ProposalOutcome(Base):
    """Win/loss outcome record for competitive bid intelligence."""

    __tablename__ = "proposal_outcomes"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, nullable=True, index=True)
    lead_name = Column(String(200), nullable=True)
    service_type = Column(String(60), nullable=True)
    region = Column(String(100), nullable=True)
    proposal_amount_low = Column(Float, nullable=True)
    proposal_amount_high = Column(Float, nullable=True)
    outcome = Column(
        String(30), nullable=False, default="pending"
    )  # won | lost | pending
    competitor_name = Column(String(120), nullable=True)
    competitor_price = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProposalOutcome id={self.id} outcome={self.outcome!r}>"


# ── AI Corrections ────────────────────────────────────────────────────────────


class AICorrection(Base):
    """Human-approved correction pattern injected into future AI prompts."""

    __tablename__ = "ai_corrections"

    id = Column(Integer, primary_key=True, index=True)
    decision_type = Column(String(60), nullable=False, index=True)
    input_pattern = Column(String(500), nullable=False)
    corrected_answer = Column(Text, nullable=False)
    reviewer_notes = Column(Text, nullable=True)
    usage_count = Column(Integer, nullable=False, default=0)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<AICorrection id={self.id} type={self.decision_type!r}>"


# ── Gallery ───────────────────────────────────────────────────────────────────


class GalleryImage(Base):
    """Job photo uploaded via the public gallery — stored as a base64 data URI."""

    __tablename__ = "gallery_images"

    id = Column(String(36), primary_key=True, index=True)  # UUID
    filename = Column(String(300), nullable=False)
    job_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    mime_type = Column(String(100), nullable=False, default="image/jpeg")
    data_uri = Column(Text, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<GalleryImage id={self.id} job={self.job_name!r}>"


# ── Tenants (multi-tenant SaaS) ───────────────────────────────────────────────


class Tenant(Base):
    """
    White-label tenant configuration for multi-tenant SaaS deployments.

    Each Tenant has a unique tenant_id used as a partition key across all
    other tables.  The default tenant ('default') represents the J. Worden
    & Sons first-party deployment.
    """

    __tablename__ = "tenants"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_tenants_tenant_id"),)

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(60), nullable=False, index=True)
    company_name = Column(String(200), nullable=False)
    system_prompt_override = Column(Text, nullable=True)
    primary_color = Column(String(20), nullable=True, default="#f5a623")
    logo_url = Column(String(500), nullable=True)
    contact_email = Column(String(254), nullable=True)
    contact_phone = Column(String(30), nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Tenant tenant_id={self.tenant_id!r} company={self.company_name!r}>"


# ── Real-time chat messages ───────────────────────────────────────────────────


class ChatMessage(Base):
    """
    Individual message record for the real-time WebSocket chat system.

    Messages are also stored in serialised form inside ChatSession.messages_json
    for fast retrieval.  This table provides a normalised, queryable view of
    every message — useful for admin dashboards, analytics, and audit trails.

    role values: "customer" | "admin"
    """

    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        String(100), nullable=False, index=True
    )  # FK to chat_sessions.session_id
    role = Column(String(20), nullable=False)  # customer | admin
    sender_name = Column(String(120), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<ChatMessage id={self.id} session={self.session_id!r} role={self.role!r}>"
        )


# ── Email log ─────────────────────────────────────────────────────────────────


class EmailLog(Base):
    """
    Audit log for every outgoing transactional email sent via SendGrid.

    status values: "sent" | "failed"
    """

    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    recipient_email = Column(String(254), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="sent")  # sent | failed
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<EmailLog id={self.id} to={self.recipient_email!r} status={self.status!r}>"


class AuditEvent(Base):
    """
    Generic immutable audit record for privileged actions and workflow changes.

    Stores a compact summary plus optional JSON detail so operational events can
    be reconstructed without coupling audit history to a single business model.
    """

    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(80), nullable=False, index=True)
    actor_type = Column(String(40), nullable=False, default="system")
    actor_id = Column(String(120), nullable=True, index=True)
    entity_type = Column(String(80), nullable=True, index=True)
    entity_id = Column(String(120), nullable=True, index=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    summary = Column(String(500), nullable=False)
    detail_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<AuditEvent id={self.id} type={self.event_type!r} entity={self.entity_type!r}:{self.entity_id!r}>"


# ── Two-Factor Authentication ─────────────────────────────────────────────────


class TwoFactorSecret(Base):
    """
    TOTP secret and backup codes for admin two-factor authentication.

    One record per admin user_id.  The secret is a base32-encoded TOTP seed
    compatible with RFC 6238 authenticator apps (Google Authenticator, Authy,
    1Password, etc.).  backup_codes stores a JSON array of one-time recovery
    codes; each code is removed from the array after use.

    enabled=False means setup has been initiated but the first TOTP token has
    not yet been verified — the secret is not enforced at login until enabled=True.
    """

    __tablename__ = "two_factor_secrets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(60), nullable=False, unique=True, index=True)
    secret = Column(String(64), nullable=False)
    backup_codes = Column(Text, nullable=True)  # JSON array of remaining one-time codes
    enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<TwoFactorSecret user_id={self.user_id!r} enabled={self.enabled}>"


# ── GC Cost Catalog + Project Estimates ───────────────────────────────────────


class ProductItem(Base):
    """
    Material/labor price catalog for the General Contracting cost estimator.

    Each item defines a unit cost (base_rate) and optional separate labor_rate.
    The estimator multiplies quantity × (base_rate + labor_rate) × (1 + markup_pct)
    to produce a line-item total.

    Common units: sq_ft | linear_ft | ea | ton | cubic_yd | hour
    Categories:   flooring | framing | roofing | concrete | asphalt |
                  electrical | plumbing | mechanical | finishes | other
    """

    __tablename__ = "product_catalog"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(60), nullable=False, index=True, default="other")
    name = Column(String(200), nullable=False)
    unit = Column(String(30), nullable=False)  # sq_ft | linear_ft | ea | ton …
    base_rate = Column(Float, nullable=False, default=0.0)  # $/unit material
    labor_rate = Column(Float, nullable=False, default=0.0)  # $/unit labor
    description = Column(String(300), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProductItem id={self.id} name={self.name!r} unit={self.unit!r}>"


class ProjectEstimate(Base):
    """
    Line-item cost estimate for a GC project.

    Each row ties one ProductItem to a project site with a calculated quantity,
    producing a total_cost.  A project can have many estimate lines.
    Totaling all active lines for a project_site_id gives the project estimate.

    The markup_pct column supports per-line profit margin control
    (e.g. 0.20 = 20% markup over base+labor cost).
    """

    __tablename__ = "project_estimates"

    id = Column(Integer, primary_key=True, index=True)
    project_site_id = Column(
        Integer, nullable=True, index=True
    )  # FK to project_sites (soft ref)
    item_id = Column(
        Integer, nullable=True, index=True
    )  # FK to product_catalog (soft ref)
    item_name = Column(String(200), nullable=True)  # Snapshot of name at estimate time
    unit = Column(String(30), nullable=True)
    quantity = Column(Float, nullable=False, default=0.0)
    base_rate = Column(Float, nullable=False, default=0.0)  # Snapshot at estimate time
    labor_rate = Column(Float, nullable=False, default=0.0)
    markup_pct = Column(Float, nullable=False, default=0.15)  # Default 15% GC markup
    total_cost = Column(
        Float, nullable=False, default=0.0
    )  # Computed: qty×(base+labor)×(1+markup)
    notes = Column(String(300), nullable=True)
    created_by = Column(String(120), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProjectEstimate id={self.id} site_id={self.project_site_id} item={self.item_name!r} total=${self.total_cost:.2f}>"


# ── Statewide Intelligence: SCC + VDOT ───────────────────────────────────────


class SccVerificationLog(Base):
    """
    Immutable audit record for every Virginia SCC business entity check.

    Fields:
      entity_id        — SCC entity ID (e.g. "S1234567")
      entity_name      — Registered legal name
      entity_type      — LLC / Corporation / LP / etc.
      status           — Active | Delinquent | Dissolved | Suspended | Unknown
      is_good_standing — True when status == Active
      registered_agent — Registered agent name (nullable)
      principal_office — Principal office address (nullable)
      date_formed      — Formation/registration date (nullable)
      source           — "scc_api" | "stub"
      requested_by     — User email or system that triggered the check
      tenant_id        — Multi-tenant isolation key
    """

    __tablename__ = "scc_verification_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(String(60), nullable=True, index=True)
    entity_name = Column(String(200), nullable=True)
    entity_type = Column(String(80), nullable=True)
    status = Column(String(40), nullable=False, default="Unknown")
    is_good_standing = Column(Boolean, nullable=False, default=False)
    registered_agent = Column(String(200), nullable=True)
    principal_office = Column(String(300), nullable=True)
    date_formed = Column(String(20), nullable=True)
    source = Column(String(30), nullable=True)
    requested_by = Column(String(120), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    checked_at = Column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<SccVerificationLog id={self.id} entity={self.entity_id!r} "
            f"status={self.status!r} standing={self.is_good_standing}>"
        )


class VdotBid(Base):
    """
    VDOT bid board opportunity scraped daily from the Virginia DOT bid board.

    Fields:
      contract_id     — VDOT contract ID (e.g. "C000123456"), unique
      title           — Project description / title
      district        — VDOT district name (Bristol, Richmond, etc.)
      county          — Primary county
      category        — Bid category (Asphalt Surface Treatment, etc.)
      contract_type   — Maintenance | Construction | Emergency | Minor
      estimated_value — Engineer's estimate in USD (nullable)
      open_date       — Date bid was advertised
      close_date      — Bid letting/close date (nullable)
      location_desc   — Freeform location description
      prime_eligible  — True if open to prime contractors
      is_active       — False when bid is closed/awarded
      source          — "vdot_api" | "stub"
      tenant_id       — Multi-tenant isolation key
    """

    __tablename__ = "vdot_bids"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(String(30), nullable=False, unique=True, index=True)
    title = Column(String(300), nullable=False)
    district = Column(String(60), nullable=True, index=True)
    county = Column(String(80), nullable=True, index=True)
    category = Column(String(100), nullable=True)
    contract_type = Column(String(30), nullable=True)
    estimated_value = Column(Float, nullable=True)
    open_date = Column(DateTime(timezone=True), nullable=True)
    close_date = Column(DateTime(timezone=True), nullable=True, index=True)
    location_desc = Column(String(300), nullable=True)
    prime_eligible = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    source = Column(String(30), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    scraped_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<VdotBid id={self.id} contract={self.contract_id!r} "
            f"district={self.district!r} value=${self.estimated_value}>"
        )


# ── Paving Site Evaluation ───────────────────────────────────────────────────


class PavingEvaluation(Base):
    """
    Physical site assessment captured during the quoting workflow.

    Records are created by field staff or via vision-AI photo inspection.
    The ``damage_type`` drives quote pricing (alligator cracking triggers
    the 1.4× base-rehab multiplier per VDOT 6-inch base standards).

    Fields:
      region          — Human-readable service area (e.g. "Richmond, VA")
      calculated_sqft — Measured paving area in square feet
      damage_type     — Condition code: alligator_cracking | surface_cracking
                        | pothole | rutting | raveling | good
      notes           — Free-text inspector / AI notes
      tenant_id       — Multi-tenant isolation key
    """

    __tablename__ = "paving_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    region = Column(String(200), nullable=False)
    calculated_sqft = Column(Float, nullable=False)
    damage_type = Column(String(60), nullable=False, default="good")
    notes = Column(Text, nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<PavingEvaluation id={self.id} region={self.region!r} "
            f"sqft={self.calculated_sqft} damage={self.damage_type!r}>"
        )


# ── Staff Portal (Ship I) ───────────────────────────────────────────────────

STAFF_ROLES = {"field", "foreman", "admin"}


class StaffUser(Base):
    """Field / foreman / admin staff account for the staff portal."""

    __tablename__ = "staff_users"
    __table_args__ = (UniqueConstraint("username", name="uq_staff_username"),)

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(60), nullable=False, unique=True, index=True)
    role = Column(String(20), nullable=False, default="field")  # field|foreman|admin
    password_hash = Column(String(256), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<StaffUser id={self.id} username={self.username!r} role={self.role!r}>"


class DailyCheckIn(Base):
    """Staff daily check-in with optional GPS and photo."""

    __tablename__ = "daily_checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    note = Column(Text, nullable=True)
    photo_filename = Column(String(300), nullable=True)  # stored under STAFF_PHOTO_PATH
    gps_lat = Column(Float, nullable=True)
    gps_lng = Column(Float, nullable=True)
    checked_in_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<DailyCheckIn id={self.id} user_id={self.user_id} at={self.checked_in_at!r}>"


# ── Worker Profiles & Compliance Documents (Ship I) ─────────────────────────

WORKER_TYPES = {
    "employee_ft",
    "employee_pt",
    "employee_temp",
    "subcontractor",
    "general_labor",
    "cdl_driver",
}
WORKER_STATUS_VALUES = {"active", "inactive", "pending_docs", "terminated", "suspended"}
CDL_CLASSES = {"A", "B", "C"}


class WorkerProfile(Base):
    """
    Onboarding profile for any worker type (employee, sub, CDL driver, day labor).
    Linked optionally to StaffUser if the worker has portal login access.
    """

    __tablename__ = "worker_profiles"
    __table_args__ = (UniqueConstraint("staff_user_id", name="uq_worker_staff_user"),)

    id = Column(Integer, primary_key=True, index=True)
    # Optional link to StaffUser (portal login)
    staff_user_id = Column(Integer, nullable=True, index=True)
    full_name = Column(String(200), nullable=False)
    worker_type = Column(String(30), nullable=False)  # WORKER_TYPES
    pay_type = Column(String(10), nullable=False, default="w2")  # w2 | 1099
    status = Column(String(20), nullable=False, default="pending_docs")
    hire_date = Column(DateTime(timezone=True), nullable=True)
    termination_date = Column(DateTime(timezone=True), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(254), nullable=True)
    address = Column(String(400), nullable=True)
    ssn_last4 = Column(String(4), nullable=True)  # LAST 4 ONLY — never store full SSN
    # CDL-specific fields
    cdl_number = Column(String(30), nullable=True)
    cdl_state = Column(String(2), nullable=True)
    cdl_class = Column(String(5), nullable=True)  # A | B | C
    cdl_expiry = Column(DateTime(timezone=True), nullable=True)
    dot_medical_expiry = Column(DateTime(timezone=True), nullable=True)
    fmcsa_clearinghouse_queried = Column(Boolean, default=False, nullable=False)
    # Subcontractor-specific
    company_name = Column(String(200), nullable=True)
    ein = Column(String(20), nullable=True)
    # Admin
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<WorkerProfile id={self.id} name={self.full_name!r} type={self.worker_type!r}>"


class WorkerDocument(Base):
    """
    Compliance document uploaded for a WorkerProfile.
    doc_type values defined in app/services/staff_compliance.DOC_LABELS.
    status: pending | approved | rejected | expired
    """

    __tablename__ = "worker_documents"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, nullable=False, index=True)
    doc_type = Column(String(60), nullable=False, index=True)
    filename = Column(String(300), nullable=True)  # stored under STAFF_DOCS_PATH
    status = Column(
        String(20), nullable=False, default="pending"
    )  # pending|approved|rejected|expired
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String(500), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String(60), nullable=True)

    def __repr__(self) -> str:
        return f"<WorkerDocument id={self.id} profile={self.profile_id} type={self.doc_type!r} status={self.status!r}>"


class VoiceReviewEvent(Base):
    """Durable supervisor review queue item for ambient voice extraction."""

    __tablename__ = "voice_review_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(80), nullable=False, unique=True, index=True)
    project_id = Column(String(128), nullable=False, index=True)
    site_id = Column(String(128), nullable=False, index=True)
    zone_id = Column(String(128), nullable=True)
    trade_id = Column(String(128), nullable=True)
    speaker_id = Column(String(128), nullable=True)
    speaker_role = Column(String(40), nullable=False, default="unknown")
    transcript_text = Column(Text, nullable=False)
    event_type = Column(String(40), nullable=False, default="general")
    event_confidence = Column(Float, nullable=False, default=0.42)
    risk_signal = Column(Boolean, nullable=False, default=False)
    status = Column(String(30), nullable=False, default="pending_review", index=True)
    reviewed_by = Column(String(128), nullable=True)
    review_note = Column(String(1024), nullable=True)
    reviewed_at_utc = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(40), nullable=False, default="other")
    source_audio_uri = Column(String(1024), nullable=True)
    captured_at_utc = Column(DateTime(timezone=True), nullable=False)
    created_at_utc = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<VoiceReviewEvent event_id={self.event_id!r} status={self.status!r}>"


class DrivewayCampaignPiece(Base):
    """Persisted direct-mail campaign pieces keyed by opt-in token."""

    __tablename__ = "driveway_campaign_pieces"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(String(40), nullable=False, index=True)
    campaign_name = Column(String(120), nullable=False)
    source = Column(String(40), nullable=False)
    property_id = Column(String(128), nullable=False, index=True)
    owner_name = Column(String(128), nullable=False)
    mailing_address = Column(String(256), nullable=False)
    address = Column(String(256), nullable=False)
    state = Column(String(2), nullable=False, default="US")
    estimated_total_usd = Column(Integer, nullable=False)
    satellite_image_url = Column(String(1024), nullable=True)
    polygon_overlay_geojson = Column(Text, nullable=True)
    token = Column(String(64), nullable=False, unique=True, index=True)
    landing_url = Column(String(256), nullable=False)
    qr_payload = Column(String(256), nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    idempotency_key = Column(String(128), nullable=True, index=True)
    created_at_utc = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<DrivewayCampaignPiece token={self.token!r} campaign={self.campaign_id!r}>"


class DrivewayOptIn(Base):
    """Explicit contact consent captured from mailed opt-in landing pages."""

    __tablename__ = "driveway_opt_ins"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(64), nullable=False, unique=True, index=True)
    property_id = Column(String(128), nullable=False, index=True)
    full_name = Column(String(128), nullable=False)
    email = Column(String(254), nullable=False, index=True)
    phone = Column(String(32), nullable=False)
    consent_email = Column(Boolean, nullable=False, default=False)
    consent_sms = Column(Boolean, nullable=False, default=False)
    consent_tcpa = Column(Boolean, nullable=False, default=False)
    consent_timestamp_utc = Column(DateTime(timezone=True), nullable=False)
    source = Column(String(40), nullable=False, default="direct_mail_qr")
    idempotency_key = Column(String(128), nullable=True, index=True)
    created_at_utc = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<DrivewayOptIn token={self.token!r} property={self.property_id!r}>"


# ── Ported from jworden-production 2026-07-28 ────────────────────────────────
#
# These eight tables existed only in that repo's models.py. The two schemas
# nested cleanly — 66 tables there, 58 here, zero unique to this side — so this
# is purely additive: nothing is dropped or altered. LMS is six of the eight.

class InboxMessage(Base):
    """
    Every email synced from IMAP is logged here, triaged, and ranked by AI.
    """
    __tablename__ = "inbox_messages"

    id = Column(Integer, primary_key=True, index=True)
    email_account = Column(String(254), nullable=False, index=True)
    sender_name = Column(String(120), nullable=True)
    sender_email = Column(String(254), nullable=False)
    subject = Column(String(500), nullable=True)
    body_summary = Column(Text, nullable=True)
    category = Column(String(60), nullable=False, default="General") # Lead, Urgent, Vendor, General, Junk
    importance_score = Column(Integer, nullable=False, default=1) # 1-10
    is_lead = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<InboxMessage subject={self.subject!r} category={self.category!r}>"



class User(Base):
    """
    Team members (Seats) associated with a Tenant. Supports Role-Based Access Control (RBAC).
    """

    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(60), ForeignKey("tenants.tenant_id"), nullable=False, index=True)
    email = Column(String(254), nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    full_name = Column(String(150), nullable=True)
    role = Column(String(30), nullable=False, default="admin")  # admin | dispatcher | foreman | pilot
    is_active = Column(Integer, nullable=False, default=1)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<User email={self.email!r} role={self.role!r} tenant={self.tenant_id!r}>"



class MarketSite(Base):
    """
    Dynamically generated SEO market sites for a given Tenant.
    Replacing the hardcoded siteFactoryManifest.json.
    """

    __tablename__ = "market_sites"
    __table_args__ = (UniqueConstraint("hostname", name="uq_market_sites_hostname"),)

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(60), nullable=False, index=True)
    hostname = Column(String(200), nullable=False, index=True)
    route_mode = Column(String(50), nullable=False, default="market-landing")
    site_title = Column(String(200), nullable=True)
    site_description = Column(Text, nullable=True)
    primary_color = Column(String(20), nullable=True)
    accent_color = Column(String(20), nullable=True)
    hero_headline = Column(String(300), nullable=True)
    hero_subheadline = Column(Text, nullable=True)
    local_weather_copy = Column(Text, nullable=True)  # e.g. "Built for Florida heat"
    city_target = Column(String(100), nullable=True)
    state_target = Column(String(2), nullable=True)
    phone_override = Column(String(30), nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<MarketSite hostname={self.hostname!r} tenant={self.tenant_id!r}>"


# ── Real-time chat messages ───────────────────────────────────────────────────



class Course(Base):
    """High-level training track in the Starbase LMS."""
    __tablename__ = "lms_courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False)  # e.g., 'Safety', 'Engineering', 'Software'
    difficulty = Column(String(50), nullable=False, default="beginner")
    estimated_hours = Column(Float, nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    is_published = Column(Boolean, default=False)
    tenant_id = Column(String(60), nullable=True, index=True, default="default")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Course slug={self.slug!r} title={self.title!r}>"



class CourseModule(Base):
    """Grouping of lessons within a course."""
    __tablename__ = "lms_course_modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("lms_courses.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)



class Lesson(Base):
    """Individual lesson content (video/markdown)."""
    __tablename__ = "lms_lessons"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("lms_course_modules.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    video_url = Column(String(500), nullable=True)
    body_markdown = Column(Text, nullable=True)
    quiz_json = Column(Text, nullable=True)  # JSON array of questions/answers
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)



class Enrollment(Base):
    """Tracks which user (employee/subcontractor) is taking which course."""
    __tablename__ = "lms_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("lms_courses.id"), nullable=False, index=True)
    user_email = Column(String(254), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="active")  # active | completed
    enrolled_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    certificate_url = Column(String(500), nullable=True)
    
    __table_args__ = (UniqueConstraint("course_id", "user_email", name="uq_enrollment"),)



class Progress(Base):
    """Tracks individual lesson completion for an enrollment."""
    __tablename__ = "lms_progress"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("lms_enrollments.id"), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey("lms_lessons.id"), nullable=False, index=True)
    is_completed = Column(Boolean, default=False)
    score = Column(Float, nullable=True)  # If it had a quiz
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (UniqueConstraint("enrollment_id", "lesson_id", name="uq_progress"),)
