"""
Regression tests for the commercial bid hunter and PlanHub scraper.

These lock in one property: neither service may ever return an invented bid
that a caller could mistake for a real solicitation.

Both services previously did exactly that.

  * ``hunt_sam_gov_contracts`` returned a hand-written placeholder on every
    failure path — solicitation "RFP-2026-PAVE-{STATE}01", agency
    "{STATE} Department of Transportation / Commercial GC", a fixed deadline and
    a fixed dollar range — with nothing marking it as synthetic. Because the API
    key defaulted to "DEMO_KEY" and the timeout was 1.5s, that path was the
    normal one.

  * ``scrape_planhub_commercial_bids`` fell back to five hardcoded projects with
    invented GC names and budgets under ``ok: True``, including when a genuine
    scrape legitimately found nothing.

The string checks below use AST literal extraction rather than a raw source
scan, so the explanatory comments in the service files (which necessarily quote
the old fake values in order to explain them) do not trip their own tests.
"""

import ast
import asyncio
import inspect
from pathlib import Path

import pytest

SERVICES = Path(__file__).resolve().parents[2] / "app" / "services"


def _string_literals(path: Path) -> list[str]:
    """Every string literal in a module, ignoring comments and docstrings."""
    tree = ast.parse(path.read_text())

    docstrings: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            doc = ast.get_docstring(node, clean=False)
            if doc is not None and node.body:
                first = node.body[0]
                if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant):
                    docstrings.add(id(first.value))

    return [
        n.value
        for n in ast.walk(tree)
        if isinstance(n, ast.Constant)
        and isinstance(n.value, str)
        and id(n) not in docstrings
    ]


# ── The fabricated SAM.gov placeholder must be gone ──────────────────────────


def test_no_fabricated_solicitation_number():
    literals = _string_literals(SERVICES / "commercial_bid_hunter.py")
    for lit in literals:
        assert "RFP-2026-PAVE" not in lit, (
            f"Fabricated solicitation number template is back: {lit!r}"
        )


def test_no_fabricated_agency_or_value_strings():
    literals = _string_literals(SERVICES / "commercial_bid_hunter.py")
    banned = [
        "Department of Transportation / Commercial GC",
        "$250,000 - $750,000",
        "$100,000 - $1,500,000+",
        "2026-08-30",
    ]
    for lit in literals:
        for phrase in banned:
            assert phrase not in lit, f"Fabricated bid detail is back: {phrase!r}"


def test_demo_key_is_not_accepted_as_configuration():
    """DEMO_KEY must be treated as absent, not as a working credential."""
    from app.services.commercial_bid_hunter import hunt_sam_gov_contracts

    async def run():
        return await hunt_sam_gov_contracts("VA")

    result = asyncio.run(run())
    assert result["ok"] is False
    assert result["reason"] == "not_configured"
    assert result["bids"] == []


def test_unconfigured_hunt_returns_no_bids_and_admits_it(monkeypatch):
    """
    The whole point. With no API key the sweep must return zero bids and say it
    is degraded — not one plausible-looking contract per state.
    """
    from app.services import commercial_bid_hunter as hunter

    monkeypatch.setattr(hunter._cfg, "get", lambda key, default=None: default)

    result = asyncio.run(hunter.run_commercial_bid_hunt(states=["VA", "GA", "TX"]))

    assert result["bids"] == []
    assert result["total_discovered"] == 0
    assert result["ok"] is False, "ok must reflect whether any source was reached"
    assert result["degraded"] is True
    assert result["states_reached"] == 0
    assert result["states_failed"] == 3
    assert len(result["failures"]) == 3


def test_hunt_does_not_advertise_sources_it_never_calls():
    """
    The response used to list PlanHub, BuildingConnected, Dodge and "All 51
    State DOTs" as monitored platforms while calling only SAM.gov.
    """
    from app.services import commercial_bid_hunter as hunter

    result = asyncio.run(hunter.run_commercial_bid_hunt(states=["VA"]))

    assert result["sources_queried"] == ["SAM.gov"]
    assert "platforms_monitored" not in result, (
        "platforms_monitored overstated coverage; use sources_queried"
    )
    # The unimplemented ones must still be disclosed, just not as if they ran.
    assert "PlanHub" in result["sources_not_implemented"]


# ── PlanHub scraper must not substitute samples ──────────────────────────────


def test_planhub_has_no_automatic_simulated_fallback():
    """No failure path may reach for the sample fixture."""
    from app.services import planhub_scraper

    source = inspect.getsource(planhub_scraper.scrape_planhub_commercial_bids)
    tree = ast.parse(ast.unparse(ast.parse(source)))

    called = {
        node.func.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    assert "get_sample_planhub_bids" not in called, (
        "scrape_planhub_commercial_bids must never return sample data automatically"
    )
    assert "get_simulated_planhub_bids" not in called


def test_planhub_unconfigured_returns_empty_not_samples(monkeypatch):
    from app.services import planhub_scraper

    monkeypatch.delenv("PLANHUB_EMAIL", raising=False)
    monkeypatch.delenv("PLANHUB_PASSWORD", raising=False)

    result = asyncio.run(planhub_scraper.scrape_planhub_commercial_bids())

    assert result["ok"] is False
    assert result["reason"] == "not_configured"
    assert result["bids"] == []
    assert result["total_found"] == 0


def test_planhub_no_hardcoded_personal_email():
    literals = _string_literals(SERVICES / "planhub_scraper.py")
    for lit in literals:
        assert "@gmail.com" not in lit, f"Hardcoded personal credential is back: {lit!r}"


def test_sample_fixture_is_unmistakably_marked():
    """
    Sample data may exist for UI work, but every record must carry the marker —
    including if a bid is lifted out of its envelope and merged into a list.
    """
    from app.services.planhub_scraper import get_sample_planhub_bids

    payload = get_sample_planhub_bids()

    assert payload["ok"] is False, "sample payload must not claim ok"
    assert payload["simulated"] is True
    assert "SAMPLE DATA" in payload["warning"]
    assert "PlanHub" not in payload["source"] or "not PlanHub" in payload["source"]

    assert payload["bids"], "fixture should still provide records for UI work"
    for bid in payload["bids"]:
        assert bid["simulated"] is True
        assert bid["project_title"].startswith("[SAMPLE]")


def test_old_simulated_helper_name_is_gone():
    """The old name was documented as returning 'authentic' opportunities."""
    from app.services import planhub_scraper

    assert not hasattr(planhub_scraper, "get_simulated_planhub_bids")


# ── Lien calendar coverage disclosure ────────────────────────────────────────


@pytest.mark.anyio
async def test_lien_states_endpoint_reports_real_coverage(client):
    """
    The coverage list must come from the statute table, so it cannot drift from
    what the calculator actually knows.
    """
    from app.services.lien_calendar import _LIEN_LAWS

    resp = await client.get("/api/v1/liens/states")
    assert resp.status_code == 200

    body = resp.json()
    assert body["researched_states"] == sorted(_LIEN_LAWS.keys())
    assert body["researched_count"] == len(_LIEN_LAWS)
    assert body["researched_count"] < 51, (
        "If this ever reaches 51, delete the fallback warning path too"
    )


@pytest.mark.anyio
async def test_uncovered_state_is_flagged_as_default_rules(client, auth_headers):
    """A state with no researched statute must say so on the result."""
    resp = await client.post(
        "/api/v1/liens/calculate",
        json={
            "state_code": "WY",
            "project_start_date": "2026-03-01",
            "last_furnishing_date": "2026-06-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["used_default_rules"] is True
    assert body["disclaimer"]


@pytest.mark.anyio
async def test_covered_state_is_not_flagged(client, auth_headers):
    resp = await client.post(
        "/api/v1/liens/calculate",
        json={
            "state_code": "VA",
            "project_start_date": "2026-03-01",
            "last_furnishing_date": "2026-06-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["used_default_rules"] is False
