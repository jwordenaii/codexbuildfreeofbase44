"""
Jarvis business-data tools — the read-only lane that lets Jarvis answer
questions about the company instead of guessing or searching the web.

Three things are worth testing here and each has bitten already:

1. The SQL. A cashflow answer that quietly sums the wrong rows is worse than
   no answer, because it looks authoritative. Every aggregate below is seeded
   with rows that MUST be excluded (a draft estimate, a refunded payment, an
   income entry outside the window) so a filter regression fails loudly.

2. The gating. Revenue and bid margins are owner-only; leads and job sites are
   staff+; the public concierge gets none of it. A widened role set is a data
   leak that no runtime error would announce.

3. The routing. converse() sends anything without an action verb to a chat
   brain that carries NO tools, so a question that does not match the routing
   vocabulary is answered from the model's imagination with full confidence.
   That is the exact failure this whole lane exists to fix.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.services.jarvis_access import (
    ROLE_OWNER_ROOT,
    ROLE_PUBLIC_CONCIERGE,
    ROLE_STAFF_OPERATOR,
)


@pytest.fixture()
def seeded(app_modules):
    """A database with one lead and a spread of financial/obligation rows."""
    _, dbmod = app_modules
    import app.models as models

    now = datetime.now(timezone.utc)
    db = dbmod.SessionLocal()

    lead = models.Lead(
        name="Fairfax County DPW",
        phone="555-0101",
        email="dpw@fairfax.gov",
        service_type="paving",
        property_type="commercial",
        address="12000 Government Center Pkwy",
        state_code="VA",
        score_value=86,
        score_label="HOT",
        pipeline_stage="contacted",
        urgency="high",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    db.add_all([
        # overdue, due-soon, far-future, and one already sent
        models.FollowUpTask(lead_id=lead.id, task_type="hot_1h",
                            scheduled_at=now - timedelta(days=3), status="pending"),
        models.FollowUpTask(lead_id=lead.id, task_type="warm_3d",
                            scheduled_at=now + timedelta(hours=12), status="pending"),
        models.FollowUpTask(lead_id=lead.id, task_type="cool_7d",
                            scheduled_at=now + timedelta(days=20), status="pending"),
        models.FollowUpTask(lead_id=lead.id, task_type="hot_1h",
                            scheduled_at=now - timedelta(days=9), status="sent"),

        models.CashFlowEntry(entry_type="income", amount=42000.0,
                             expected_date=now + timedelta(days=10)),
        models.CashFlowEntry(entry_type="income", amount=8000.0,
                             expected_date=now + timedelta(days=200)),
        models.CashFlowEntry(entry_type="expense", amount=17500.0,
                             expected_date=now + timedelta(days=5)),

        models.PaymentTransaction(lead_id=lead.id, amount_usd=25000.0, status="paid",
                                  paid_at=now - timedelta(days=2)),
        models.PaymentTransaction(lead_id=lead.id, amount_usd=9500.0, status="pending"),
        models.PaymentTransaction(lead_id=lead.id, amount_usd=1000.0, status="refunded"),

        models.Estimate(estimate_number="EST-1001", status="sent", service_type="paving",
                        amount_low=180000.0, amount_high=210000.0, state_code="VA"),
        models.Estimate(estimate_number="EST-1002", status="draft", service_type="paving",
                        amount_low=5000.0, amount_high=6000.0),

        models.LienCalendarEntry(customer_name="KBP Foods", project_address="8 KFC sites",
                                 state_code="VA",
                                 preliminary_notice_deadline=now + timedelta(days=9),
                                 lien_filing_deadline=now + timedelta(days=45)),
        models.LienCalendarEntry(customer_name="Old Job LLC", project_address="120 Main St",
                                 state_code="VA",
                                 lien_filing_deadline=now - timedelta(days=4)),
        models.LienCalendarEntry(customer_name="Far Future Inc", project_address="9 Elm",
                                 state_code="MD",
                                 lien_filing_deadline=now + timedelta(days=300)),

        models.ProposalOutcome(lead_name="A", service_type="paving", region="Richmond",
                               outcome="won", proposal_amount_low=100000.0),
        models.ProposalOutcome(lead_name="B", service_type="paving", region="Richmond",
                               outcome="lost", proposal_amount_low=120000.0,
                               competitor_price=98000.0),
        models.ProposalOutcome(lead_name="C", service_type="sealcoating", region="Atlanta",
                               outcome="lost", proposal_amount_low=40000.0,
                               competitor_price=36000.0),
        models.ProposalOutcome(lead_name="D", service_type="sealcoating", region="Atlanta",
                               outcome="pending", proposal_amount_low=50000.0),

        models.PermitLead(permit_type="commercial lot", property_address="500 Broad St",
                          property_city="Richmond", property_state="VA",
                          project_value=310000.0, priority_score=91, priority_label="HOT"),
        models.PermitLead(permit_type="driveway", property_address="9 Oak Ln",
                          property_city="Chester", property_state="VA",
                          project_value=8000.0, priority_score=30, priority_label="COOL"),
    ])
    db.commit()
    db.close()

    import app.services.jarvis as jarvis
    return jarvis


# ── money ─────────────────────────────────────────────────────────────────────

def test_money_position_excludes_rows_that_are_not_money_in_the_window(seeded):
    r = seeded._business_query("get_money_position", {})

    assert r["ok"] is True
    # The 200-day-out income and the draft estimate must not be counted.
    assert r["projected_income"] == 42000.0
    assert r["projected_expenses"] == 17500.0
    assert r["projected_net"] == 24500.0
    # Refunded is neither collected nor awaited.
    assert r["collected_to_date"] == 25000.0
    assert r["awaiting_payment"] == 9500.0
    assert r["open_estimates"]["count"] == 1
    assert r["open_estimates"]["value_low"] == 180000.0
    assert r["open_estimates"]["value_high"] == 210000.0


def test_money_position_window_is_honoured(seeded):
    assert seeded._business_query(
        "get_money_position", {"days_ahead": 365}
    )["projected_income"] == 50000.0


def test_money_position_clamps_a_nonsense_window(seeded):
    for bad in ("banana", None, -5, 99999):
        r = seeded._business_query("get_money_position", {"days_ahead": bad})
        assert r["ok"] is True
        assert 1 <= r["window_days"] <= 365


# ── follow-ups ────────────────────────────────────────────────────────────────

def test_follow_ups_surface_overdue_first_with_contact_details(seeded):
    r = seeded._business_query("get_follow_ups", {})

    # far-future and already-sent are both excluded
    assert r["count"] == 2
    assert r["overdue_count"] == 1

    first = r["follow_ups"][0]
    assert first["overdue"] is True
    # The phone number is the point — a follow-up list you have to go look
    # people up from is not actionable.
    assert first["lead_name"] == "Fairfax County DPW"
    assert first["phone"] == "555-0101"


def test_follow_ups_can_exclude_upcoming(seeded):
    assert seeded._business_query(
        "get_follow_ups", {"include_upcoming": False}
    )["count"] == 1


# ── liens ─────────────────────────────────────────────────────────────────────

def test_lien_deadlines_report_each_deadline_separately(seeded):
    r = seeded._business_query("get_lien_deadlines", {})

    # KBP contributes two (notice + filing), Old Job one expired. The MD row
    # is 300 days out and falls outside the default 60-day window.
    assert r["count"] == 3
    assert r["urgent_count"] == 1     # the 9-day preliminary notice
    assert r["expired_count"] == 1
    assert r["deadlines"][0]["expired"] is True   # soonest (most negative) first
    assert all(d["state"] != "MD" for d in r["deadlines"])


def test_lien_deadlines_state_filter_is_case_insensitive(seeded):
    r = seeded._business_query(
        "get_lien_deadlines", {"within_days": 365, "state_code": "md"}
    )
    assert r["count"] == 1
    assert r["deadlines"][0]["customer"] == "Far Future Inc"


# ── bids ──────────────────────────────────────────────────────────────────────

def test_bid_intelligence_excludes_pending_from_the_win_rate(seeded):
    r = seeded._business_query("get_bid_intelligence", {})

    assert r["total_proposals"] == 4
    # 1 won / 3 decided. Counting the pending bid as a loss would read as 25%
    # and make a live pipeline look like a collapsing one.
    assert r["overall"]["win_rate_percent"] == 33.3
    assert r["overall"]["pending"] == 1
    assert r["by_service"]["paving"]["win_rate_percent"] == 50.0
    assert r["by_service"]["sealcoating"]["win_rate_percent"] == 0.0
    assert r["by_region"]["Richmond"]["win_rate_percent"] == 50.0


def test_bid_intelligence_measures_how_far_over_the_competitor_we_bid(seeded):
    r = seeded._business_query("get_bid_intelligence", {})
    # (120000-98000) and (40000-36000) → 13000 average, i.e. we lose when we
    # are ~$13k high. That number is the whole reason this tool exists.
    assert r["lost_bids_with_competitor_price"] == 2
    assert r["avg_amount_over_competitor_on_losses"] == 13000.0


def test_bid_intelligence_reports_no_rate_rather_than_zero_when_undecided(seeded):
    r = seeded._business_query("get_bid_intelligence", {"region": "Nowhere"})
    assert r["total_proposals"] == 0
    # None, not 0.0 — "no data" and "we lose everything" must not look alike.
    assert r["overall"]["win_rate_percent"] is None


# ── permits ───────────────────────────────────────────────────────────────────

def test_permit_leads_rank_by_score(seeded):
    r = seeded._business_query("get_permit_leads", {})
    assert r["count"] == 2
    assert r["permits"][0]["priority"] == "HOT"
    assert r["permits"][0]["project_value"] == 310000.0


def test_permit_leads_priority_filter_is_case_insensitive(seeded):
    assert seeded._business_query("get_permit_leads", {"priority": "hot"})["count"] == 1


# ── guards ────────────────────────────────────────────────────────────────────

def test_unknown_business_query_errors_instead_of_returning_a_snapshot(seeded):
    # This function used to end in an unguarded snapshot return, so a tool that
    # was declared but never implemented would answer a cashflow question with
    # lead counts and look like it had worked.
    r = seeded._business_query("get_nonexistent", {})
    assert r["ok"] is False


def test_every_business_tool_is_declared_to_the_model(seeded):
    declared = {t["name"] for t in seeded.JARVIS_TOOLS}
    assert seeded._BUSINESS_TOOL_NAMES <= declared


def test_every_declared_business_tool_actually_answers(seeded):
    # Catches the reverse drift: a tool advertised to the model with no branch
    # behind it, which surfaces to the user as a confident non-answer.
    for name in sorted(seeded._BUSINESS_TOOL_NAMES):
        assert seeded._business_query(name, {})["ok"] is True, name


# ── role gating ───────────────────────────────────────────────────────────────

def test_public_concierge_gets_no_business_data_at_all(seeded):
    public = seeded._ROLE_TOOLS[ROLE_PUBLIC_CONCIERGE]
    assert not (seeded._BUSINESS_TOOL_NAMES & public)


def test_staff_get_operations_but_not_the_books(seeded):
    staff = seeded._ROLE_TOOLS[ROLE_STAFF_OPERATOR]
    assert {"get_leads", "get_jobs", "get_follow_ups",
            "get_lien_deadlines", "get_permit_leads"} <= staff
    # Revenue, receivables and bid margins are owner-level facts.
    assert "get_money_position" not in staff
    assert "get_bid_intelligence" not in staff


def test_owner_gets_everything(seeded):
    assert seeded._BUSINESS_TOOL_NAMES <= seeded._ROLE_TOOLS[ROLE_OWNER_ROOT]


@pytest.mark.anyio
async def test_role_policy_is_enforced_at_call_time_not_just_in_the_toolset(seeded):
    # The toolset is what the model is shown; this is what actually runs. A
    # public session must be refused even if it names the tool directly.
    r = await seeded._run_tool(
        "get_money_position", {}, role=ROLE_PUBLIC_CONCIERGE
    )
    assert r["ok"] is False
    assert "policy" in r["error"].lower()


# ── routing ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("question", [
    "can we make payroll this month?",
    "how much are we owed?",
    "what did we collect this month",
    "who do i need to call back today",
    "anything overdue?",
    "any lien deadlines coming up",
    "what's our win rate on bids",
    "are we bidding too high",
    "any new permits in richmond",
    "what's my cashflow look like",
])
def test_business_questions_reach_the_tool_lane(seeded, question):
    # Without this, converse() sends the question to a chat brain with no tools
    # and the answer is invented.
    assert seeded._looks_like_tool_action(question) is True


@pytest.mark.parametrize("question", [
    "tell me a joke",
    "who won the world series in 1998",
    "what's the capital of Maine",
])
def test_ordinary_conversation_stays_out_of_the_tool_lane(seeded, question):
    # The tool lane costs an extra round trip. "won" is deliberately not in the
    # routing vocabulary for exactly this reason.
    assert seeded._looks_like_tool_action(question) is False
