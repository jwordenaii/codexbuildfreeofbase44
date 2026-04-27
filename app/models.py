"""
SQLAlchemy ORM models for J. Worden & Sons lead persistence.

Schema managed by Alembic migrations; optional AUTO_CREATE_TABLES bootstrap for local dev.
All timestamps are stored in UTC.

New models added for enterprise features:
  - ChatSession          : multi-turn conversation memory
  - AICorrection         : human-review learning loop
  - FollowUpTask         : automated follow-up sequences
  - LienCalendarEntry    : mechanics lien deadline tracker
  - SubcontractorRoster  : insurance/bond compliance monitor
  - Tenant               : white-label multi-tenant support
  - ProjectSite          : geospatial construction site with polygon geometry
  - PermitLead           : scraped Virginia LIS permit leads with priority scoring
  - TruckPosition        : real-time fleet telemetry (latest position per truck)
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, UniqueConstraint

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


# ══════════════════════════════════════════════════════════════════════════════
# Customer Intelligence Platform
# Ready to receive imported data from Mr. Worden's existing customer databases.
# ══════════════════════════════════════════════════════════════════════════════

class Customer(Base):
    """
    Unified customer record.  Supports manual entry and bulk import
    (CSV / JSON) from existing customer databases.

    All fields are nullable where data may not exist in legacy imports.
    The ``external_id`` field links back to any source system record.
    """
    __tablename__ = "customers"

    id              = Column(Integer, primary_key=True, index=True)
    external_id     = Column(String(100), nullable=True, index=True)   # source DB key
    source          = Column(String(60),  nullable=True)               # 'import_csv' | 'manual' | 'quote_form'

    # Core identity
    name            = Column(String(120), nullable=False)
    email           = Column(String(254), nullable=True, index=True)
    phone           = Column(String(30),  nullable=True)
    company         = Column(String(120), nullable=True)               # for commercial/franchise clients

    # Location
    address         = Column(String(300), nullable=True)
    city            = Column(String(100), nullable=True)
    state_code      = Column(String(2),   nullable=True, index=True)   # 2-letter abbr
    zip_code        = Column(String(10),  nullable=True)

    # Segment
    customer_type   = Column(String(30),  nullable=True)               # 'residential' | 'commercial' | 'franchise' | 'qsr'
    is_franchise    = Column(Integer, default=0, nullable=False)       # 1 = franchise/QSR account
    brand           = Column(String(60),  nullable=True)               # e.g. 'KFC', 'Taco Bell'

    # Lifetime value tracking
    total_jobs      = Column(Integer, default=0, nullable=False)
    total_revenue   = Column(Float,   default=0.0, nullable=False)
    last_job_date   = Column(DateTime(timezone=True), nullable=True)

    # AI-assisted fields
    predicted_next_service_date = Column(DateTime(timezone=True), nullable=True)
    ltv_score       = Column(Float, nullable=True)                     # lifetime value score 0-100
    churn_risk      = Column(String(10), nullable=True)                # LOW | MEDIUM | HIGH

    # Notes
    notes           = Column(Text, nullable=True)
    tags            = Column(String(500), nullable=True)               # comma-separated tags

    # Multi-tenant (Feature 15)
    tenant_id       = Column(String(60), nullable=True, index=True, default='default')

    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at      = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Customer id={self.id} name={self.name!r} type={self.customer_type!r}>"


class ServiceHistory(Base):
    """
    Individual service job linked to a Customer.
    Supports import from existing records or creation from new leads.
    """
    __tablename__ = "service_history"

    id              = Column(Integer, primary_key=True, index=True)
    customer_id     = Column(Integer, nullable=True, index=True)       # FK to Customer.id
    lead_id         = Column(Integer, nullable=True, index=True)       # FK to Lead.id

    # Job details
    job_date        = Column(DateTime(timezone=True), nullable=True)
    service_type    = Column(String(60),  nullable=True)               # paving | sealcoating | etc.
    scope_summary   = Column(Text,        nullable=True)
    location        = Column(String(300), nullable=True)
    state_code      = Column(String(2),   nullable=True, index=True)
    sqft            = Column(Float,       nullable=True)
    revenue         = Column(Float,       nullable=True)
    is_qsr          = Column(Integer, default=0, nullable=False)       # 1 = QSR / franchise job
    brand           = Column(String(60),  nullable=True)               # KFC, Taco Bell, etc.

    # Quality / outcome
    warranty_callback = Column(Integer, default=0, nullable=False)     # 1 = had warranty callback
    gc_score        = Column(Float,   nullable=True)                   # GC / client satisfaction 0-5
    notes           = Column(Text,    nullable=True)

    # Documentation
    has_photos      = Column(Integer, default=0, nullable=False)       # 1 = photos on file
    dropbox_url     = Column(String(500), nullable=True)
    photos_url      = Column(String(500), nullable=True)

    # Multi-tenant (Feature 15)
    tenant_id         = Column(String(60), nullable=True, index=True, default='default')

    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ServiceHistory id={self.id} customer_id={self.customer_id} date={self.job_date}>"


class HumanReviewQueue(Base):
    """
    AI decisions flagged for human review when confidence < threshold.

    When an AI response has confidence below HUMAN_REVIEW_THRESHOLD
    (default 0.75), it is saved here for Mr. Worden or an admin to
    approve, reject, or correct before the answer is finalized.

    Status lifecycle: pending → approved | rejected
    """
    __tablename__ = "human_review_queue"

    id              = Column(Integer, primary_key=True, index=True)
    decision_type   = Column(String(60),  nullable=False)              # 'chat' | 'photo_inspect' | 'compliance' | 'lead_score'
    input_summary   = Column(Text,        nullable=False)              # truncated input for context
    ai_answer       = Column(Text,        nullable=False)              # the AI's proposed answer
    ai_engine       = Column(String(60),  nullable=True)               # 'gpt-4o' | 'gpt-4o-mini' | 'stub'
    confidence      = Column(Float,       nullable=False)              # 0.0 – 1.0
    status          = Column(String(20),  default='pending', nullable=False)  # pending | approved | rejected
    reviewer_notes  = Column(Text,        nullable=True)               # human reviewer's notes
    corrected_answer= Column(Text,        nullable=True)               # optional corrected response

    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    reviewed_at     = Column(DateTime(timezone=True), nullable=True)

    # Multi-tenant (Feature 15)
    tenant_id       = Column(String(60), nullable=True, index=True, default='default')

    def __repr__(self) -> str:
        return f"<HumanReviewQueue id={self.id} type={self.decision_type!r} confidence={self.confidence:.2f} status={self.status!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Feature 1: Conversation Memory (Multi-Turn Context)
# ══════════════════════════════════════════════════════════════════════════════

class ChatSession(Base):
    """
    Persistent multi-turn chat session.  Stores conversation history as JSON.
    Used when Redis is unavailable (fallback to DB).
    """
    __tablename__ = "chat_sessions"

    id             = Column(Integer, primary_key=True, index=True)
    session_id     = Column(String(100), nullable=False, index=True, unique=True)
    messages_json  = Column(Text, nullable=False, default="[]")
    customer_name  = Column(String(120), nullable=True)
    customer_email = Column(String(254), nullable=True)
    state_code     = Column(String(2), nullable=True)
    last_service   = Column(String(60), nullable=True)
    # Multi-tenant (Feature 15)
    tenant_id      = Column(String(60), nullable=True, index=True, default='default')
    created_at     = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at     = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ChatSession session_id={self.session_id!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Feature 2: Human Review → Learning Loop
# ══════════════════════════════════════════════════════════════════════════════

class AICorrection(Base):
    """
    Stores human corrections to AI decisions as few-shot examples.
    Used by the AI engine to improve responses over time.
    """
    __tablename__ = "ai_corrections"

    id               = Column(Integer, primary_key=True, index=True)
    decision_type    = Column(String(60), nullable=False, index=True)
    input_pattern    = Column(Text, nullable=False)
    corrected_answer = Column(Text, nullable=False)
    reviewer_notes   = Column(Text, nullable=True)
    usage_count      = Column(Integer, default=0, nullable=False)
    created_at       = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at       = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<AICorrection id={self.id} type={self.decision_type!r} uses={self.usage_count}>"


# ══════════════════════════════════════════════════════════════════════════════
# Feature 4: Automated Follow-Up Sequences
# ══════════════════════════════════════════════════════════════════════════════

class FollowUpTask(Base):
    """
    Tracks scheduled follow-up messages for leads.
    Celery beat tasks read from this table to send timed follow-ups.
    """
    __tablename__ = "follow_up_tasks"

    id           = Column(Integer, primary_key=True, index=True)
    lead_id      = Column(Integer, nullable=False, index=True)
    task_type    = Column(String(20), nullable=False)   # hot_1h | warm_3d | cool_7d
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    sent_at      = Column(DateTime(timezone=True), nullable=True)
    status       = Column(String(20), default='pending', nullable=False)  # pending | sent | cancelled
    created_at   = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<FollowUpTask lead_id={self.lead_id} type={self.task_type!r} status={self.status!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Feature 12: Mechanics Lien Deadline Tracker
# ══════════════════════════════════════════════════════════════════════════════

class LienCalendarEntry(Base):
    """
    Tracks mechanics lien deadlines for active construction projects.
    Sends automated reminders before deadlines expire.
    """
    __tablename__ = "lien_calendar_entries"

    id                          = Column(Integer, primary_key=True, index=True)
    customer_name               = Column(String(120), nullable=False)
    project_address             = Column(String(300), nullable=False)
    state_code                  = Column(String(2), nullable=False, index=True)
    project_start_date          = Column(DateTime(timezone=True), nullable=False)
    last_furnishing_date        = Column(DateTime(timezone=True), nullable=False)
    preliminary_notice_deadline = Column(DateTime(timezone=True), nullable=True)
    lien_filing_deadline        = Column(DateTime(timezone=True), nullable=True)
    foreclosure_deadline        = Column(DateTime(timezone=True), nullable=True)
    reminder_sent_at            = Column(DateTime(timezone=True), nullable=True)
    notes                       = Column(Text, nullable=True)
    created_at                  = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<LienCalendarEntry id={self.id} state={self.state_code!r} customer={self.customer_name!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Feature 14: Subcontractor Insurance/Bond Monitor
# ══════════════════════════════════════════════════════════════════════════════

class SubcontractorRoster(Base):
    """
    Roster of subcontractors with license, insurance, and bond expiry tracking.
    Alerts are sent when certificates are about to expire.
    """
    __tablename__ = "subcontractor_roster"

    id                 = Column(Integer, primary_key=True, index=True)
    name               = Column(String(120), nullable=False)
    company            = Column(String(120), nullable=False)
    email              = Column(String(254), nullable=True)
    phone              = Column(String(30), nullable=True)
    state_code         = Column(String(2), nullable=False)
    license_number     = Column(String(60), nullable=True)
    license_expiry     = Column(DateTime(timezone=True), nullable=True)
    insurance_expiry   = Column(DateTime(timezone=True), nullable=True)
    bond_expiry        = Column(DateTime(timezone=True), nullable=True)
    bond_amount        = Column(Float, nullable=True)
    insurance_carrier  = Column(String(120), nullable=True)
    notes              = Column(Text, nullable=True)
    is_active          = Column(Integer, default=1, nullable=False)
    created_at         = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at         = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SubcontractorRoster id={self.id} name={self.name!r} company={self.company!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Feature 15: White-Label / Multi-Tenant Mode
# ══════════════════════════════════════════════════════════════════════════════

class Tenant(Base):
    """
    Tenant configuration for white-label / multi-tenant SaaS mode.
    Each tenant can override the AI system prompt, branding, and contact info.
    """
    __tablename__ = "tenants"

    id                     = Column(Integer, primary_key=True, index=True)
    tenant_id              = Column(String(60), nullable=False, unique=True, index=True)
    company_name           = Column(String(120), nullable=False)
    system_prompt_override = Column(Text, nullable=True)
    primary_color          = Column(String(20), default='#f5a623', nullable=False)
    logo_url               = Column(String(500), nullable=True)
    contact_email          = Column(String(254), nullable=True)
    contact_phone          = Column(String(30), nullable=True)
    is_active              = Column(Integer, default=1, nullable=False)
    created_at             = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Tenant tenant_id={self.tenant_id!r} company={self.company_name!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Blog Post — AI-generated and manually authored content for SEO
# ══════════════════════════════════════════════════════════════════════════════

class BlogPost(Base):
    """
    Blog / knowledge-base article.  Can be authored manually via the admin
    dashboard or AI-drafted via the /api/v1/blog/draft endpoint and then
    reviewed + published.

    status lifecycle: draft → review → published | archived
    """
    __tablename__ = "blog_posts"

    id              = Column(Integer, primary_key=True, index=True)
    slug            = Column(String(200), nullable=False, unique=True, index=True)
    title           = Column(String(300), nullable=False)
    excerpt         = Column(Text, nullable=False, default="")
    body            = Column(Text, nullable=False, default="")

    # Classification
    category        = Column(String(60),  nullable=True)   # tips | how-to | industry | local | commercial
    tags            = Column(String(500), nullable=True)   # comma-separated

    # SEO fields
    meta_title      = Column(String(300), nullable=True)
    meta_description= Column(String(320), nullable=True)
    focus_keyword   = Column(String(120), nullable=True)
    canonical_url   = Column(String(500), nullable=True)

    # Publish state
    status          = Column(String(20), default='draft', nullable=False)   # draft | review | published | archived
    published_at    = Column(DateTime(timezone=True), nullable=True)
    featured        = Column(Integer, default=0, nullable=False)            # 1 = pinned/featured

    # Authorship
    author_name     = Column(String(120), default='J. Worden & Sons', nullable=False)
    ai_generated    = Column(Integer, default=0, nullable=False)            # 1 = AI-drafted

    # Read metrics
    read_time_minutes = Column(Integer, nullable=True)
    view_count      = Column(Integer, default=0, nullable=False)

    # Multi-tenant
    tenant_id       = Column(String(60), nullable=True, index=True, default='default')

    created_at      = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at      = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<BlogPost slug={self.slug!r} status={self.status!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Module 1: Post-Project Lessons Learned Engine
# ══════════════════════════════════════════════════════════════════════════════

class ProjectRetrospective(Base):
    """Structured project closeout capturing lessons learned per build."""

    __tablename__ = "project_retrospectives"

    id                    = Column(Integer, primary_key=True, index=True)
    project_name          = Column(String(200), nullable=False)
    project_type          = Column(String(60),  nullable=True)   # paving | sealcoating | etc.
    region                = Column(String(100), nullable=True)
    closed_date           = Column(DateTime(timezone=True), nullable=True)
    schedule_variance_days = Column(Integer, nullable=True)      # positive = late
    cost_variance_pct     = Column(Float,   nullable=True)       # positive = over budget
    supply_chain_issues   = Column(Text,    nullable=True)
    soil_conditions       = Column(Text,    nullable=True)
    design_conflicts      = Column(Text,    nullable=True)
    lessons_learned       = Column(Text,    nullable=True)
    ai_tags               = Column(Text,    nullable=True)       # JSON-encoded list
    tenant_id             = Column(String(60), nullable=True, index=True, default='default')
    created_at            = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at            = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ProjectRetrospective id={self.id} project={self.project_name!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Module 2: Safety Culture Dashboard
# ══════════════════════════════════════════════════════════════════════════════

class SafetyToolboxTalk(Base):
    """Daily toolbox talk record per job site."""

    __tablename__ = "safety_toolbox_talks"

    id          = Column(Integer, primary_key=True, index=True)
    job_site    = Column(String(200), nullable=False, index=True)
    talk_date   = Column(DateTime(timezone=True), nullable=False)
    topic       = Column(String(300), nullable=False)
    foreman     = Column(String(120), nullable=True)
    crew_count  = Column(Integer, default=0, nullable=False)
    signed_off  = Column(Integer, default=0, nullable=False)  # 1 = crew signed off
    notes       = Column(Text, nullable=True)
    tenant_id   = Column(String(60), nullable=True, index=True, default='default')
    created_at  = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SafetyToolboxTalk id={self.id} site={self.job_site!r} date={self.talk_date}>"


class SafetyIncident(Base):
    """Near-miss, first-aid, or recordable incident log."""

    __tablename__ = "safety_incidents"

    id                = Column(Integer, primary_key=True, index=True)
    job_site          = Column(String(200), nullable=False, index=True)
    incident_date     = Column(DateTime(timezone=True), nullable=False)
    incident_type     = Column(String(30),  nullable=False)   # near-miss | first-aid | recordable
    root_cause        = Column(String(200), nullable=True)
    description       = Column(Text, nullable=True)
    corrective_action = Column(Text, nullable=True)
    osha_recordable   = Column(Integer, default=0, nullable=False)  # 1 = OSHA 300 recordable
    days_away         = Column(Integer, default=0, nullable=False)
    tenant_id         = Column(String(60), nullable=True, index=True, default='default')
    created_at        = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SafetyIncident id={self.id} site={self.job_site!r} type={self.incident_type!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Module 3: Cash Flow Projection
# ══════════════════════════════════════════════════════════════════════════════

class CashFlowEntry(Base):
    """Manual or system-generated cash flow entry for 13-week rolling forecast."""

    __tablename__ = "cashflow_entries"

    id            = Column(Integer, primary_key=True, index=True)
    entry_type    = Column(String(10),  nullable=False)   # income | expense
    amount        = Column(Float,       nullable=False)
    expected_date = Column(DateTime(timezone=True), nullable=False)
    category      = Column(String(60),  nullable=True)    # payroll | materials | contract | equipment | other
    description   = Column(String(300), nullable=True)
    source        = Column(String(60),  nullable=True)    # manual | proposal | job_costing
    source_id     = Column(Integer,     nullable=True)    # FK to source record
    tenant_id     = Column(String(60),  nullable=True, index=True, default='default')
    created_at    = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<CashFlowEntry id={self.id} type={self.entry_type!r} amount={self.amount}>"


class CashFlowAlert(Base):
    """Configurable alert threshold for cash position warning."""

    __tablename__ = "cashflow_alerts"

    id               = Column(Integer, primary_key=True, index=True)
    threshold_amount = Column(Float, default=10000.0, nullable=False)
    alert_email      = Column(String(254), nullable=True)
    is_active        = Column(Integer, default=1, nullable=False)
    tenant_id        = Column(String(60), nullable=True, index=True, default='default')
    created_at       = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at       = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<CashFlowAlert threshold={self.threshold_amount}>"


# ══════════════════════════════════════════════════════════════════════════════
# Module 4: Project Performance Scorecard
# ══════════════════════════════════════════════════════════════════════════════

class ProjectMetric(Base):
    """Per-project performance scorecard linking actuals to estimates."""

    __tablename__ = "project_metrics"

    id                  = Column(Integer, primary_key=True, index=True)
    project_name        = Column(String(200), nullable=False)
    lead_id             = Column(Integer, nullable=True, index=True)  # FK to leads.id
    actual_cost         = Column(Float,   nullable=True)
    estimated_cost      = Column(Float,   nullable=True)
    scheduled_days      = Column(Integer, nullable=True)
    actual_days         = Column(Integer, nullable=True)
    client_nps          = Column(Integer, nullable=True)  # 0-10
    punch_list_items    = Column(Integer, default=0, nullable=False)
    punch_list_closed   = Column(Integer, default=0, nullable=False)
    case_study_published = Column(Integer, default=0, nullable=False)
    case_study_text     = Column(Text,    nullable=True)
    completion_date     = Column(DateTime(timezone=True), nullable=True)
    tenant_id           = Column(String(60), nullable=True, index=True, default='default')
    created_at          = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at          = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ProjectMetric id={self.id} project={self.project_name!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Module 5: Crew & Skills Matrix
# ══════════════════════════════════════════════════════════════════════════════

class WorkforceMember(Base):
    """Employee or subcontractor with certifications and skill ratings."""

    __tablename__ = "workforce"

    id                = Column(Integer, primary_key=True, index=True)
    name              = Column(String(120), nullable=False)
    member_type       = Column(String(20),  nullable=False)  # employee | sub
    trade             = Column(String(60),  nullable=True)   # operator | laborer | paving | milling | etc.
    certifications    = Column(Text,        nullable=True)   # JSON: [{cert, expiry_date}]
    skill_ratings     = Column(Text,        nullable=True)   # JSON: {trade: 1-5}
    available         = Column(Integer, default=1, nullable=False)
    subcontractor_id  = Column(Integer, nullable=True, index=True)  # FK to subcontractor_roster
    phone             = Column(String(30),  nullable=True)
    email             = Column(String(254), nullable=True)
    notes             = Column(Text,        nullable=True)
    tenant_id         = Column(String(60),  nullable=True, index=True, default='default')
    created_at        = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at        = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<WorkforceMember id={self.id} name={self.name!r} trade={self.trade!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Module 6: Subcontractor Performance History
# ══════════════════════════════════════════════════════════════════════════════

class SubcontractorPerformance(Base):
    """Per-project performance record for a subcontractor."""

    __tablename__ = "subcontractor_performance"

    id                   = Column(Integer, primary_key=True, index=True)
    subcontractor_id     = Column(Integer, nullable=False, index=True)  # FK to subcontractor_roster
    project_name         = Column(String(200), nullable=False)
    scope                = Column(String(100), nullable=True)
    on_time              = Column(Integer, default=1, nullable=False)    # 1 = on time
    quality_rating       = Column(Integer, nullable=True)               # 1-5
    payment_dispute      = Column(Integer, default=0, nullable=False)   # 1 = dispute occurred
    rehire_recommended   = Column(Integer, default=1, nullable=False)   # 1 = yes
    notes                = Column(Text, nullable=True)
    project_date         = Column(DateTime(timezone=True), nullable=True)
    tenant_id            = Column(String(60), nullable=True, index=True, default='default')
    created_at           = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SubcontractorPerformance sub={self.subcontractor_id} project={self.project_name!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Module 7: AI Bid Win-Rate Optimizer — proposal outcome columns added via
#           extend on proposals table at router level (Alembic not used;
#           new columns added here via a companion ProposalOutcome table)
# ══════════════════════════════════════════════════════════════════════════════

class ProposalOutcome(Base):
    """Records win/loss outcomes for proposals to power bid intelligence."""

    __tablename__ = "proposal_outcomes"

    id                  = Column(Integer, primary_key=True, index=True)
    lead_id             = Column(Integer, nullable=False, index=True)  # FK to leads.id
    lead_name           = Column(String(120), nullable=True)
    service_type        = Column(String(60),  nullable=True)
    region              = Column(String(100), nullable=True)
    proposal_amount_low = Column(Float,       nullable=True)
    proposal_amount_high= Column(Float,       nullable=True)
    outcome             = Column(String(20),  nullable=False)  # won | lost | no-decision
    competitor_name     = Column(String(120), nullable=True)
    competitor_price    = Column(Float,       nullable=True)
    notes               = Column(Text,        nullable=True)
    outcome_recorded_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    tenant_id           = Column(String(60),  nullable=True, index=True, default='default')
    created_at          = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ProposalOutcome lead={self.lead_id} outcome={self.outcome!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# Module 10: Innovation Lab Tracker
# ══════════════════════════════════════════════════════════════════════════════

class Innovation(Base):
    """Log of new methods and tools tested on job sites."""

    __tablename__ = "innovations"

    id            = Column(Integer, primary_key=True, index=True)
    method_name   = Column(String(200), nullable=False)
    job_site      = Column(String(200), nullable=True)
    date_tested   = Column(DateTime(timezone=True), nullable=True)
    cost_to_test  = Column(Float,       nullable=True)
    result        = Column(String(20),  nullable=False)  # pass | fail | adopted
    category      = Column(String(40),  nullable=True)   # drone | materials | robotics | process
    notes         = Column(Text,        nullable=True)
    tenant_id     = Column(String(60),  nullable=True, index=True, default='default')
    created_at    = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at    = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Innovation id={self.id} method={self.method_name!r} result={self.result!r}>"



class PaymentTransaction(Base):
    """Stripe checkout/payment tracking linked to leads."""

    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, nullable=False, index=True)
    stripe_checkout_session_id = Column(String(120), nullable=True, index=True)
    stripe_payment_intent_id = Column(String(120), nullable=True, index=True)
    amount_usd = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), nullable=False, default='usd')
    status = Column(String(30), nullable=False, default='pending')
    paid_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(String(60), nullable=True, index=True, default='default')
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<PaymentTransaction id={self.id} lead_id={self.lead_id} status={self.status!r}>"
# ══════════════════════════════════════════════════════════════════════════════
# Geospatial / Fleet — Virtual Foreman Command Center
# ══════════════════════════════════════════════════════════════════════════════

class ProjectSite(Base):
    """
    A mapped construction/paving site within the JWordenAI service area.

    Geometry is stored as GeoJSON text so the model works with both SQLite
    (development) and PostgreSQL (production).  For PostGIS spatial queries,
    run db/migrations/001_add_postgis_geometry.sql to add native geometry
    columns and GIST indexes alongside these float columns.
    """

    __tablename__ = "project_sites"

    id                   = Column(Integer, primary_key=True, index=True)
    name                 = Column(String(200), nullable=False)
    address              = Column(String(300), nullable=True)
    city                 = Column(String(100), nullable=True)
    state                = Column(String(2), nullable=True, default="VA")
    status               = Column(String(30), nullable=False, default="active")   # active | completed | pending
    service_type         = Column(String(60), nullable=True)
    project_size_sqft    = Column(Float, nullable=True)

    # Centroid coordinates (WGS84)
    lat                  = Column(Float, nullable=True)
    lng                  = Column(Float, nullable=True)

    # Service radius in miles (default: 20-mile Richmond grid)
    service_radius_miles = Column(Float, nullable=True, default=20.0)

    # Full polygon stored as GeoJSON FeatureCollection text
    geometry_json        = Column(Text, nullable=True)

    # Calculated area/perimeter from leaflet-draw polygon
    area_sqft            = Column(Float, nullable=True)
    perimeter_ft         = Column(Float, nullable=True)

    notes                = Column(Text, nullable=True)
    created_at           = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at           = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ProjectSite id={self.id} name={self.name!r} status={self.status!r}>"


class PermitLead(Base):
    """
    A contractor permit lead scraped from Virginia's LIS or other state permit APIs.

    Every record is validated through app/schemas/permit_lead.py before insertion
    to guarantee schema-consistent data for the lead ranking logic.
    """

    __tablename__ = "permit_leads"

    id                 = Column(Integer, primary_key=True, index=True)
    source             = Column(String(60), nullable=False, default="virginia_lis")
    permit_number      = Column(String(100), nullable=True, index=True)
    permit_type        = Column(String(100), nullable=False)
    permit_status      = Column(String(50), nullable=True)

    # Contractor info
    contractor_name    = Column(String(200), nullable=True)
    contractor_license = Column(String(100), nullable=True)

    # Property / project
    property_address   = Column(String(300), nullable=False)
    property_city      = Column(String(100), nullable=True)
    property_state     = Column(String(2), nullable=True, default="VA")
    property_zip       = Column(String(10), nullable=True)

    # Coordinates (WGS84)
    lat                = Column(Float, nullable=True)
    lng                = Column(Float, nullable=True)

    # Financial
    project_value      = Column(Float, nullable=True)
    estimated_sqft     = Column(Float, nullable=True)

    # Dates
    permit_date        = Column(DateTime(timezone=True), nullable=True)
    expiry_date        = Column(DateTime(timezone=True), nullable=True)

    # Scoring / ranking
    priority_score     = Column(Integer, nullable=True)
    priority_label     = Column(String(10), nullable=True)   # HOT | WARM | COOL

    # Raw JSON blob from the source API (for auditing)
    raw_json           = Column(Text, nullable=True)

    scraped_at         = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    created_at         = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<PermitLead id={self.id} address={self.property_address!r} label={self.priority_label!r}>"


class TruckPosition(Base):
    """
    Real-time truck telemetry ping stored for zero-delay routing dashboard.

    Positions are upserted by truck_id so the table always holds the latest
    position per truck (old history is not retained — use a time-series store
    like InfluxDB for historical analytics).
    """

    __tablename__ = "truck_positions"

    id             = Column(Integer, primary_key=True, index=True)
    truck_id       = Column(String(30), nullable=False, index=True, unique=True)
    driver_name    = Column(String(120), nullable=True)
    lat            = Column(Float, nullable=False)
    lng            = Column(Float, nullable=False)
    speed_mph      = Column(Float, nullable=True)
    heading_deg    = Column(Float, nullable=True)
    asphalt_temp_f = Column(Float, nullable=True)
    status         = Column(String(30), nullable=True, default="en_route")  # en_route | on_site | idle
    site_id        = Column(Integer, nullable=True)   # FK to project_sites (soft ref)
    updated_at     = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<TruckPosition truck={self.truck_id!r} status={self.status!r}>"


# ══════════════════════════════════════════════════════════════════════════════
# iGrade Engine — Graded AI Processing Log
# Records grade tier, confidence, and self-correction status for every AI call.
# ══════════════════════════════════════════════════════════════════════════════

class GradeLog(Base):
    """
    Graded AI processing record.

    Every AI decision (chat, compliance, lead score, takeoff) is graded
    A–D by the iGradeEngine before routing to the appropriate model tier.
    Grades are stored here for performance analytics, self-correction sweeps,
    and continuous improvement reporting.

    Grade scale:
      A — Complex / high-value (legal, compliance, QSR, multi-state) → GPT-4o
      B — Standard paving Q&A or pricing estimate                     → GPT-4o-mini
      C — Simple info / quick lookup                                  → GPT-4o-mini fast
      D — Bulk / batch / repeat query                                 → Rule engine / cache
    """

    __tablename__ = "grade_logs"

    id                 = Column(Integer, primary_key=True, index=True)
    decision_type      = Column(String(60), nullable=False, index=True)   # chat | compliance | lead_score | takeoff
    grade              = Column(String(2),  nullable=False, index=True)   # A | B | C | D
    input_summary      = Column(Text, nullable=False)
    ai_engine          = Column(String(60), nullable=True)                # gpt-4o | gpt-4o-mini | rule_engine | stub
    confidence         = Column(Float, nullable=False, default=0.0)
    was_corrected      = Column(Integer, default=0, nullable=False)       # 1 = human flagged/corrected this
    correction_applied = Column(Integer, default=0, nullable=False)       # 1 = auto-correction injected
    processing_ms      = Column(Integer, nullable=True)                   # wall-clock response time
    tenant_id          = Column(String(60), nullable=True, index=True, default='default')
    created_at         = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<GradeLog id={self.id} type={self.decision_type!r} grade={self.grade!r} conf={self.confidence:.2f}>"


# ══════════════════════════════════════════════════════════════════════════════
# Extended Storage — Media File Registry
# Tracks every project photo, blueprint, permit, contract, and report.
# Mirrors the existing Dropbox / Google Photos archive in a queryable DB.
# ══════════════════════════════════════════════════════════════════════════════

class MediaFile(Base):
    """
    Registry of uploaded or externally-linked media files.

    Provides fast, queryable metadata for all project documentation —
    photos, blueprints, permits, contracts, and AI-generated reports —
    without duplicating file content.  Actual files live in the configured
    storage provider (local filesystem, Dropbox, GCS, or S3).
    """

    __tablename__ = "media_files"

    id                = Column(Integer, primary_key=True, index=True)
    filename          = Column(String(500), nullable=False)
    file_type         = Column(String(30),  nullable=True)    # photo | blueprint | permit | contract | report | other
    mime_type         = Column(String(100), nullable=True)
    file_size_bytes   = Column(Integer,     nullable=True)
    storage_url       = Column(String(1000), nullable=True)   # external URL (Dropbox share / GCS signed URL)
    storage_provider  = Column(String(30),  nullable=True, default='local')  # local | dropbox | gcs | s3

    # Soft link to parent record
    linked_to_type    = Column(String(60),  nullable=True)    # lead | project | customer | document
    linked_to_id      = Column(Integer,     nullable=True, index=True)

    # Descriptive metadata
    project_name      = Column(String(200), nullable=True, index=True)
    tags              = Column(String(500), nullable=True)    # comma-separated
    ai_description    = Column(Text,        nullable=True)    # AI Vision caption

    # Multi-tenant
    tenant_id         = Column(String(60),  nullable=True, index=True, default='default')

    created_at        = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at        = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<MediaFile id={self.id} name={self.filename!r} type={self.file_type!r}>"
