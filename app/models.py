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
    mix_type        = Column(String(60), nullable=True)
    plant_departed_at = Column(DateTime(timezone=True), nullable=True)
    target_delivery_temp_f = Column(Float, nullable=True)
    estimated_arrival_minutes = Column(Float, nullable=True)
    status          = Column(String(30), nullable=True, default="en_route")  # en_route | on_site | idle
    site_id         = Column(Integer, nullable=True)   # FK to project_sites (soft ref)
    updated_at      = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

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

    id                 = Column(Integer, primary_key=True, index=True)
    project_site_id    = Column(Integer, nullable=True, index=True)
    address            = Column(String(300), nullable=True)
    scan_area_sqft     = Column(Float, nullable=True)
    ticket_811         = Column(String(100), nullable=True)
    ticket_status      = Column(String(40), nullable=True)
    technologies_json  = Column(Text, nullable=True)
    utilities_json     = Column(Text, nullable=True)
    risk_level         = Column(String(20), nullable=False, default="UNKNOWN")
    confidence         = Column(Float, nullable=True)
    recommendation     = Column(Text, nullable=True)
    notes              = Column(Text, nullable=True)
    tenant_id          = Column(String(60), nullable=True, index=True, default="default")
    created_at         = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


# ── Multi-turn chat session ───────────────────────────────────────────────────

class ChatSession(Base):
    """Stores serialised conversation history for multi-turn AI chat."""

    __tablename__ = "chat_sessions"

    id              = Column(Integer, primary_key=True, index=True)
    session_id      = Column(String(100), nullable=False, index=True, unique=True)
    messages_json   = Column(Text, nullable=False, default="[]")
    customer_name   = Column(String(120), nullable=True)
    customer_email  = Column(String(254), nullable=True)
    state_code      = Column(String(2),   nullable=True)
    last_service    = Column(String(60),  nullable=True)
    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at      = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ChatSession session_id={self.session_id!r}>"


# ── Human review queue ────────────────────────────────────────────────────────

class HumanReviewQueue(Base):
    """Holds low-confidence AI decisions flagged for manual review."""

    __tablename__ = "human_review_queue"

    id              = Column(Integer, primary_key=True, index=True)
    decision_type   = Column(String(60),  nullable=False)     # chat | compliance | lead_score …
    input_summary   = Column(String(500), nullable=False)
    ai_answer       = Column(Text,        nullable=False)
    ai_engine       = Column(String(60),  nullable=True)      # gpt-4o-mini | gpt-4o | stub
    confidence      = Column(Float,       nullable=True)
    status          = Column(String(20),  nullable=False, default="pending")  # pending | approved | rejected
    reviewer_note   = Column(Text,        nullable=True)
    tenant_id       = Column(String(60),  nullable=True, index=True, default="default")
    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    resolved_at     = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<HumanReviewQueue id={self.id} decision={self.decision_type!r} status={self.status!r}>"


# ── Mechanics lien calendar ───────────────────────────────────────────────────

class LienCalendarEntry(Base):
    """Tracks lien filing deadlines for active construction projects."""

    __tablename__ = "lien_calendar_entries"

    id                          = Column(Integer, primary_key=True, index=True)
    customer_name               = Column(String(120), nullable=False)
    project_address             = Column(String(300), nullable=False)
    state_code                  = Column(String(2),   nullable=False, index=True)
    project_start_date          = Column(DateTime(timezone=True), nullable=True)
    last_furnishing_date        = Column(DateTime(timezone=True), nullable=True)
    preliminary_notice_deadline = Column(DateTime(timezone=True), nullable=True)
    lien_filing_deadline        = Column(DateTime(timezone=True), nullable=True)
    foreclosure_deadline        = Column(DateTime(timezone=True), nullable=True)
    notes                       = Column(Text, nullable=True)
    tenant_id                   = Column(String(60), nullable=True, index=True, default="default")
    created_at                  = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<LienCalendarEntry id={self.id} state={self.state_code!r} customer={self.customer_name!r}>"


# ── Blog ──────────────────────────────────────────────────────────────────────

class BlogPost(Base):
    """CMS blog post for the JWordenAI content hub."""

    __tablename__ = "blog_posts"
    __table_args__ = (UniqueConstraint("slug", name="uq_blog_posts_slug"),)

    id               = Column(Integer, primary_key=True, index=True)
    slug             = Column(String(200), nullable=False, index=True)
    title            = Column(String(300), nullable=False)
    excerpt          = Column(String(500), nullable=False, default="")
    body             = Column(Text,        nullable=False, default="")
    category         = Column(String(60),  nullable=True)
    tags             = Column(String(500), nullable=True)
    meta_title       = Column(String(300), nullable=True)
    meta_description = Column(String(320), nullable=True)
    focus_keyword    = Column(String(120), nullable=True)
    author_name      = Column(String(120), nullable=True, default="J. Worden & Sons")
    image_url        = Column(String(500), nullable=True)
    featured         = Column(Integer, nullable=False, default=0)        # 0 | 1
    status           = Column(String(20),  nullable=False, default="draft")  # draft | published | archived
    read_time_minutes= Column(Integer, nullable=True)
    published_at     = Column(DateTime(timezone=True), nullable=True)
    tenant_id        = Column(String(60),  nullable=True, index=True, default="default")
    created_at       = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at       = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<BlogPost slug={self.slug!r} status={self.status!r}>"


# ── Cash-flow ─────────────────────────────────────────────────────────────────

class CashFlowEntry(Base):
    """Income or expense entry for the cash-flow projection board."""

    __tablename__ = "cashflow_entries"

    id              = Column(Integer, primary_key=True, index=True)
    entry_type      = Column(String(20),  nullable=False)        # income | expense
    amount          = Column(Float,       nullable=False)
    expected_date   = Column(DateTime(timezone=True), nullable=False)
    category        = Column(String(60),  nullable=True)
    description     = Column(String(500), nullable=True)
    source          = Column(String(60),  nullable=True, default="manual")
    source_id       = Column(Integer,     nullable=True)         # FK to leads or payment_transactions
    tenant_id       = Column(String(60),  nullable=True, index=True, default="default")
    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<CashFlowEntry type={self.entry_type!r} amount={self.amount}>"


class CashFlowAlert(Base):
    """Per-tenant threshold alert for low projected cash balance."""

    __tablename__ = "cashflow_alerts"

    id               = Column(Integer, primary_key=True, index=True)
    threshold_amount = Column(Float,       nullable=False)
    alert_email      = Column(String(254), nullable=False)
    tenant_id        = Column(String(60),  nullable=True, index=True, default="default")
    updated_at       = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<CashFlowAlert threshold={self.threshold_amount} email={self.alert_email!r}>"


# ── Customer CRM ──────────────────────────────────────────────────────────────

class Customer(Base):
    """CRM customer record — residential, commercial, or franchise client."""

    __tablename__ = "customers"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(120), nullable=False)
    email           = Column(String(254), nullable=True, index=True)
    phone           = Column(String(30),  nullable=True)
    company         = Column(String(120), nullable=True)
    address         = Column(String(300), nullable=True)
    city            = Column(String(100), nullable=True)
    state_code      = Column(String(2),   nullable=True, index=True)
    zip_code        = Column(String(10),  nullable=True)
    customer_type   = Column(String(30),  nullable=True)    # residential | commercial | franchise
    is_franchise    = Column(Integer, nullable=False, default=0)
    brand           = Column(String(60),  nullable=True)    # KFC | Taco Bell | etc.
    notes           = Column(Text,        nullable=True)
    tags            = Column(String(500), nullable=True)
    external_id     = Column(String(100), nullable=True)
    source          = Column(String(60),  nullable=True, default="manual")
    total_jobs      = Column(Integer, nullable=False, default=0)
    total_revenue   = Column(Float,   nullable=False, default=0.0)
    last_job_date   = Column(DateTime(timezone=True), nullable=True)
    tenant_id       = Column(String(60), nullable=True, index=True, default="default")
    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at      = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Customer id={self.id} name={self.name!r}>"


class ServiceHistory(Base):
    """A completed service job linked to a Customer."""

    __tablename__ = "service_history"

    id               = Column(Integer, primary_key=True, index=True)
    customer_id      = Column(Integer, nullable=False, index=True)    # FK to customers.id
    job_date         = Column(DateTime(timezone=True), nullable=True)
    service_type     = Column(String(60),  nullable=True)
    scope_summary    = Column(Text,        nullable=True)
    location         = Column(String(300), nullable=True)
    state_code       = Column(String(2),   nullable=True)
    sqft             = Column(Float,       nullable=True)
    revenue          = Column(Float,       nullable=True)
    is_qsr           = Column(Integer, nullable=False, default=0)
    brand            = Column(String(60),  nullable=True)
    warranty_callback= Column(Integer, nullable=False, default=0)
    gc_score         = Column(Float,       nullable=True)
    has_photos       = Column(Integer, nullable=False, default=0)
    dropbox_url      = Column(String(500), nullable=True)
    photos_url       = Column(String(500), nullable=True)
    notes            = Column(Text,        nullable=True)
    tenant_id        = Column(String(60),  nullable=True, index=True, default="default")
    created_at       = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ServiceHistory id={self.id} customer_id={self.customer_id}>"


# ── iGrade & media files ──────────────────────────────────────────────────────

class GradeLog(Base):
    """iGrade engine decision log — records grade + model + confidence per AI call."""

    __tablename__ = "grade_logs"

    id                 = Column(Integer, primary_key=True, index=True)
    decision_type      = Column(String(60),  nullable=False, index=True)
    grade              = Column(String(1),   nullable=False)    # A | B | C | D
    input_summary      = Column(String(500), nullable=True)
    ai_engine          = Column(String(60),  nullable=True)
    confidence         = Column(Float,       nullable=True)
    processing_ms      = Column(Integer,     nullable=True)
    was_corrected      = Column(Integer, nullable=False, default=0)
    correction_applied = Column(Integer, nullable=False, default=0)
    tenant_id          = Column(String(60),  nullable=True, index=True, default="default")
    created_at         = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<GradeLog id={self.id} grade={self.grade!r} type={self.decision_type!r}>"


class MediaFile(Base):
    """Project media file record (photos, PDFs, videos)."""

    __tablename__ = "media_files"

    id                = Column(Integer, primary_key=True, index=True)
    filename          = Column(String(300), nullable=False)
    file_type         = Column(String(20),  nullable=True)    # image | pdf | video
    mime_type         = Column(String(100), nullable=True)
    file_size_bytes   = Column(Integer,     nullable=True)
    storage_url       = Column(String(1000),nullable=False)
    storage_provider  = Column(String(60),  nullable=True, default="local")
    linked_to_type    = Column(String(60),  nullable=True)    # lead | project_site | customer
    linked_to_id      = Column(Integer,     nullable=True)
    project_name      = Column(String(200), nullable=True)
    tags              = Column(String(500), nullable=True)
    ai_description    = Column(Text,        nullable=True)
    tenant_id         = Column(String(60),  nullable=True, index=True, default="default")
    created_at        = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<MediaFile id={self.id} filename={self.filename!r}>"


# ── Innovations tracker ───────────────────────────────────────────────────────

class Innovation(Base):
    """Tracks experimental paving methods, tools, and QSR innovations."""

    __tablename__ = "innovations"

    id              = Column(Integer, primary_key=True, index=True)
    method_name     = Column(String(200), nullable=False)
    job_site        = Column(String(300), nullable=True)
    date_tested     = Column(DateTime(timezone=True), nullable=True)
    cost_to_test    = Column(Float,       nullable=True)
    result          = Column(String(30),  nullable=False, default="pending")  # pass | fail | adopted | pending
    category        = Column(String(60),  nullable=True)   # drone | materials | robotics | process
    notes           = Column(Text,        nullable=True)
    tenant_id       = Column(String(60),  nullable=True, index=True, default="default")
    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at      = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Innovation id={self.id} name={self.method_name!r} result={self.result!r}>"


# ── Payments ──────────────────────────────────────────────────────────────────

class PaymentTransaction(Base):
    """Stripe checkout session / payment record linked to a lead."""

    __tablename__ = "payment_transactions"

    id                          = Column(Integer, primary_key=True, index=True)
    lead_id                     = Column(Integer, nullable=False, index=True)
    stripe_checkout_session_id  = Column(String(200), nullable=True, index=True)
    stripe_payment_intent_id    = Column(String(200), nullable=True)
    amount_usd                  = Column(Float,       nullable=False)
    currency                    = Column(String(10),  nullable=False, default="usd")
    status                      = Column(String(30),  nullable=False, default="pending")  # pending | paid | failed | refunded
    paid_at                     = Column(DateTime(timezone=True), nullable=True)
    tenant_id                   = Column(String(60),  nullable=True, index=True, default="default")
    created_at                  = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<PaymentTransaction id={self.id} lead_id={self.lead_id} status={self.status!r}>"


# ── Project metrics ───────────────────────────────────────────────────────────

class ProjectMetric(Base):
    """Post-completion project KPIs for benchmarking and retro analysis."""

    __tablename__ = "project_metrics"

    id                 = Column(Integer, primary_key=True, index=True)
    project_name       = Column(String(200), nullable=False)
    lead_id            = Column(Integer,     nullable=True, index=True)
    actual_cost        = Column(Float,       nullable=True)
    estimated_cost     = Column(Float,       nullable=True)
    scheduled_days     = Column(Integer,     nullable=True)
    actual_days        = Column(Integer,     nullable=True)
    client_nps         = Column(Integer,     nullable=True)    # 0-10
    punch_list_items   = Column(Integer, nullable=False, default=0)
    punch_list_closed  = Column(Integer, nullable=False, default=0)
    completion_date    = Column(DateTime(timezone=True), nullable=True)
    ai_summary         = Column(Text,        nullable=True)
    tenant_id          = Column(String(60),  nullable=True, index=True, default="default")
    created_at         = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at         = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ProjectMetric id={self.id} project={self.project_name!r}>"


# ── Project retrospectives ────────────────────────────────────────────────────

class ProjectRetrospective(Base):
    """AI-assisted lessons-learned record after project close-out."""

    __tablename__ = "project_retrospectives"

    id                     = Column(Integer, primary_key=True, index=True)
    project_name           = Column(String(200), nullable=False)
    project_type           = Column(String(60),  nullable=True)
    region                 = Column(String(100), nullable=True)
    closed_date            = Column(DateTime(timezone=True), nullable=True)
    schedule_variance_days = Column(Integer, nullable=True)
    cost_variance_pct      = Column(Float,   nullable=True)
    supply_chain_issues    = Column(Text,    nullable=True)
    soil_conditions        = Column(Text,    nullable=True)
    design_conflicts       = Column(Text,    nullable=True)
    lessons_learned        = Column(Text,    nullable=True)
    ai_summary             = Column(Text,    nullable=True)
    tenant_id              = Column(String(60), nullable=True, index=True, default="default")
    created_at             = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at             = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ProjectRetrospective id={self.id} project={self.project_name!r}>"


# ── Safety ────────────────────────────────────────────────────────────────────

class SafetyToolboxTalk(Base):
    """Daily toolbox safety talk — documented pre-shift safety briefing."""

    __tablename__ = "safety_toolbox_talks"

    id          = Column(Integer, primary_key=True, index=True)
    job_site    = Column(String(300), nullable=False)
    talk_date   = Column(DateTime(timezone=True), nullable=False)
    topic       = Column(String(200), nullable=True)
    foreman     = Column(String(120), nullable=True)
    crew_count  = Column(Integer,     nullable=True)
    signed_off  = Column(Integer, nullable=False, default=0)
    notes       = Column(Text,    nullable=True)
    tenant_id   = Column(String(60), nullable=True, index=True, default="default")
    created_at  = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SafetyToolboxTalk id={self.id} site={self.job_site!r}>"


class SafetyIncident(Base):
    """OSHA recordable / near-miss incident log."""

    __tablename__ = "safety_incidents"

    id                = Column(Integer, primary_key=True, index=True)
    job_site          = Column(String(300), nullable=False)
    incident_date     = Column(DateTime(timezone=True), nullable=False)
    incident_type     = Column(String(100), nullable=True)   # near_miss | first_aid | recordable | fatality
    root_cause        = Column(String(200), nullable=True)
    description       = Column(Text,        nullable=True)
    corrective_action = Column(Text,        nullable=True)
    osha_recordable   = Column(Integer, nullable=False, default=0)
    days_away         = Column(Integer,     nullable=True)
    tenant_id         = Column(String(60),  nullable=True, index=True, default="default")
    created_at        = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SafetyIncident id={self.id} site={self.job_site!r}>"


# ── Subcontractors ────────────────────────────────────────────────────────────

class SubcontractorRoster(Base):
    """Directory of subcontractors with license / insurance tracking."""

    __tablename__ = "subcontractor_roster"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(120), nullable=False)
    company           = Column(String(120), nullable=True)
    email             = Column(String(254), nullable=True)
    phone             = Column(String(30),  nullable=True)
    state_code        = Column(String(2),   nullable=False, index=True)
    license_number    = Column(String(100), nullable=True)
    license_expiry    = Column(DateTime(timezone=True), nullable=True)
    insurance_expiry  = Column(DateTime(timezone=True), nullable=True)
    bond_expiry       = Column(DateTime(timezone=True), nullable=True)
    bond_amount       = Column(Float,       nullable=True)
    insurance_carrier = Column(String(120), nullable=True)
    notes             = Column(Text,        nullable=True)
    tenant_id         = Column(String(60),  nullable=True, index=True, default="default")
    created_at        = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at        = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SubcontractorRoster id={self.id} name={self.name!r}>"


class SubcontractorPerformance(Base):
    """Per-project performance review for a subcontractor."""

    __tablename__ = "subcontractor_performance"

    id                  = Column(Integer, primary_key=True, index=True)
    subcontractor_id    = Column(Integer, nullable=True, index=True)    # FK to subcontractor_roster.id
    project_name        = Column(String(200), nullable=False)
    scope               = Column(String(200), nullable=True)
    on_time             = Column(Integer, nullable=False, default=1)
    quality_rating      = Column(Integer, nullable=True)                # 1-5
    payment_dispute     = Column(Integer, nullable=False, default=0)
    rehire_recommended  = Column(Integer, nullable=False, default=1)
    notes               = Column(Text,    nullable=True)
    project_date        = Column(DateTime(timezone=True), nullable=True)
    tenant_id           = Column(String(60), nullable=True, index=True, default="default")
    created_at          = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SubcontractorPerformance id={self.id} project={self.project_name!r}>"


# ── Workforce ─────────────────────────────────────────────────────────────────

class WorkforceMember(Base):
    """Employee or subcontractor crew member with skills and availability."""

    __tablename__ = "workforce_members"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(120), nullable=False)
    member_type       = Column(String(30),  nullable=False, default="employee")  # employee | sub
    trade             = Column(String(60),  nullable=True)
    certifications    = Column(Text,        nullable=True)    # JSON list
    skill_ratings     = Column(Text,        nullable=True)    # JSON dict {trade: 1-5}
    available         = Column(Integer, nullable=False, default=1)
    subcontractor_id  = Column(Integer, nullable=True)
    phone             = Column(String(30),  nullable=True)
    email             = Column(String(254), nullable=True)
    notes             = Column(Text,        nullable=True)
    tenant_id         = Column(String(60),  nullable=True, index=True, default="default")
    created_at        = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at        = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<WorkforceMember id={self.id} name={self.name!r}>"



# ── Bid intelligence / proposal outcomes ─────────────────────────────────────

class ProposalOutcome(Base):
    """Win/loss outcome record for competitive bid intelligence."""

    __tablename__ = "proposal_outcomes"

    id                   = Column(Integer, primary_key=True, index=True)
    lead_id              = Column(Integer,     nullable=True, index=True)
    lead_name            = Column(String(200), nullable=True)
    service_type         = Column(String(60),  nullable=True)
    region               = Column(String(100), nullable=True)
    proposal_amount_low  = Column(Float,       nullable=True)
    proposal_amount_high = Column(Float,       nullable=True)
    outcome              = Column(String(30),  nullable=False, default="pending")  # won | lost | pending
    competitor_name      = Column(String(120), nullable=True)
    competitor_price     = Column(Float,       nullable=True)
    notes                = Column(Text,        nullable=True)
    tenant_id            = Column(String(60),  nullable=True, index=True, default="default")
    created_at           = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at           = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ProposalOutcome id={self.id} outcome={self.outcome!r}>"


# ── AI Corrections ────────────────────────────────────────────────────────────

class AICorrection(Base):
    """Human-approved correction pattern injected into future AI prompts."""

    __tablename__ = "ai_corrections"

    id               = Column(Integer, primary_key=True, index=True)
    decision_type    = Column(String(60),  nullable=False, index=True)
    input_pattern    = Column(String(500), nullable=False)
    corrected_answer = Column(Text,        nullable=False)
    reviewer_notes   = Column(Text,        nullable=True)
    usage_count      = Column(Integer, nullable=False, default=0)
    tenant_id        = Column(String(60),  nullable=True, index=True, default="default")
    created_at       = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at       = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<AICorrection id={self.id} type={self.decision_type!r}>"


# ── Gallery ───────────────────────────────────────────────────────────────────

class GalleryImage(Base):
    """Job photo uploaded via the public gallery — stored as a base64 data URI."""

    __tablename__ = "gallery_images"

    id          = Column(String(36),  primary_key=True, index=True)   # UUID
    filename    = Column(String(300), nullable=False)
    job_name    = Column(String(200), nullable=False)
    description = Column(Text,        nullable=True)
    mime_type   = Column(String(100), nullable=False, default="image/jpeg")
    data_uri    = Column(Text,        nullable=False)
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

    id                      = Column(Integer, primary_key=True, index=True)
    tenant_id               = Column(String(60),   nullable=False, index=True)
    company_name            = Column(String(200),  nullable=False)
    system_prompt_override  = Column(Text,         nullable=True)
    primary_color           = Column(String(20),   nullable=True, default="#f5a623")
    logo_url                = Column(String(500),  nullable=True)
    contact_email           = Column(String(254),  nullable=True)
    contact_phone           = Column(String(30),   nullable=True)
    is_active               = Column(Integer, nullable=False, default=1)
    created_at              = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at              = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

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

    id           = Column(Integer, primary_key=True, index=True)
    session_id   = Column(String(100), nullable=False, index=True)   # FK to chat_sessions.session_id
    role         = Column(String(20),  nullable=False)               # customer | admin
    sender_name  = Column(String(120), nullable=True)
    content      = Column(Text,        nullable=False)
    created_at   = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ChatMessage id={self.id} session={self.session_id!r} role={self.role!r}>"
