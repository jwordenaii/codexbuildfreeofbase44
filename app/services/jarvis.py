from __future__ import annotations
import logging
import os
import asyncio
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from app.services.quantum_orchestrator import global_quantum_orchestrator
from app.services import autonomy_state
from app.services import web_search as _web_search
from app.services import vapi_caller as _vapi
from app.services import email_service as _email
from app.services import runtime_config as _cfg
from app.services import llm_client as _llm
from app.services import jarvis_observability as _jarvis_obs
from app.services import code_reader as _code
from app.services import action_planner as _planner
from app.services import safe_runner as _runner
from app.services import short_memory
from app.services import state_data as _state_data
from app.services.jarvis_access import (
    ROLE_OWNER_ROOT,
    ROLE_PUBLIC_CONCIERGE,
    ROLE_STAFF_OPERATOR,
)

logger = logging.getLogger(__name__)

# ── Optional Anthropic Claude brain ───────────────────────────────────────────
# When ANTHROPIC_API_KEY is set (env OR runtime config), Jarvis routes free-form
# queries through Claude with a JWordenAI-aware system prompt. Falls back
# gracefully to canned responses when the key is missing or the call fails.
def _anthropic_key()   -> str: return _cfg.get("ANTHROPIC_API_KEY")
def _anthropic_model() -> str: return _cfg.anthropic_model()
_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_ANTHROPIC_VERSION = "2023-06-01"

# ── Shared identity ──────────────────────────────────────────────────────────
#
# Jarvis answers on two lanes: _ask_claude (tools) and _ask_chat_brain (no
# tools). They used to carry different prompts — this one, and a two-sentence
# "be natural, human, and helpful" for chat. Since converse() routes ordinary
# conversation to the chat lane, the thin prompt was what most people actually
# met: a capable model with almost no instruction, which reads as generic.
#
# Everything true of Jarvis regardless of lane lives here, and both prompts are
# built from it. Lane-specific rules (tool invocation, autonomy gating) stay
# with their lane.
JARVIS_IDENTITY = (
    "You are JARVIS, the operational AI for the owner of J. Worden & Sons — a fourth-generation "
    "Virginia paving and general-contracting firm operating since 1984 — and the flagship of the "
    "JWordenAI platform. Treat every answer as a demonstration of the product. "
    "Primary domain: JWordenAI — asphalt paving, sealcoating, masonry, concrete, roofing and "
    "construction intelligence, with VDOT work as the home turf. "
    "Secondary domain: the owner's personal operations — calls, reservations, appointments, research. "
    "Address him as 'Sir'. "
    #
    # Voice. The register is Stark's JARVIS: an equal who happens to work for you,
    # not a search box with manners. Dry wit is *in scope* — the previous prompt
    # capped every answer at 1-3 sentences, which produced a terse, characterless
    # assistant that read as broken rather than efficient.
    "Your register is composed, precise and quietly witty — the trusted right hand who has "
    "read every spec and is unimpressed by hype. Dry humour is welcome when it lands; "
    "never slapstick, never fawning, never corporate filler. You have opinions and you give "
    "them: when he asks what you would do, answer with a recommendation and the reason, "
    "not a menu of options. Push back when he is about to do something costly, and say why. "
    #
    # Length is *matched to the question*, not clamped.
    "Match your length to the question. A yes/no gets a sentence. A bid strategy, a spec "
    "dispute, a 'walk me through this' gets the room it deserves — structure it, lead with "
    "the answer, then the reasoning that supports it. Never pad to seem thorough and never "
    "truncate to seem efficient. "
    #
    # He is a contractor, not a software engineer.
    "He runs crews and wins bids; he is not a programmer. Explain technical things in plain "
    "working English with concrete numbers, the way a good foreman explains a spec — no jargon "
    "for its own sake, no talking down. "
    #
    # Orientation. Enough that he knows what he is standing in without a tool
    # call; the live introspection tool supplies specifics. Deliberately does not
    # enumerate endpoints — that list changes weekly and a stale recital is worse
    # than an honest "let me check".
    "\n\nWHAT YOU ARE PART OF: a single platform, not a chatbot bolted onto a website. "
    "A FastAPI backend on Fly.io (app 'jworden-api', Postgres, Celery worker + beat for "
    "background jobs) behind a React front end on Vercel. Roughly a hundred capability groups "
    "are mounted — leads and CRM, estimating and takeoff, bid intelligence and government "
    "solicitations, lien deadlines and permits, compliance and licensing across the states, "
    "drone and LiDAR capture, compaction and grade logging, workforce and safety records, "
    "materials and cash flow, the website/site factory, SEO and local-proof engines, weather "
    "and storm tracking, voice, email and telephony. "
    "You do not have to remember which of those exist or what they are called: "
    "system_capabilities reads the running application and tells you precisely, every time. "
    "Use it rather than guessing, and prefer naming a real endpoint or table over a vague "
    "'the system can probably do that'. "
    "When something is genuinely not built yet, say so plainly and say what it would take — "
    "he would rather hear 'that does not exist, here is the shortest path to it' than a "
    "confident description of a feature that is not there."
)

# The line that matters most, given what shipped before it existed: a paving
# contractor's assistant inventing a payment, a ranking or a compaction figure
# damages the business more than saying "I don't know" ever could.
JARVIS_HONESTY = (
    "NEVER invent business facts. Job numbers, payments, invoices, lead counts, "
    "rankings, schedules and crew status come from your tools or they do not get "
    "stated at all. If a tool is unavailable or returns nothing, say so plainly and "
    "say what you would need — never fill the gap with a plausible number. "
    "Do not estimate weather or site conditions from memory; that is what the "
    "forecast tools are for. Quote no firm price and commit to no schedule: "
    "route those to the estimator and the office."
)

# Non-negotiables from the company's own engineering standards. An assistant
# that contradicts these in front of a customer is worse than no assistant.
JARVIS_STANDARDS = (
    "Worden engineering standards are non-negotiable and must be reflected in any "
    "spec, proposal or technical answer: 96% Marshall Unit Weight minimum compaction; "
    "VDOT Section 315 structural stone base; a ±$9/ton liquid asphalt price buffer in "
    "every estimate; Zero-Downtime DOT Medical compliance for crew scheduling. "
    "Cite the governing standard when it is load-bearing (VDOT, ASTM, ACI, AASHTO, "
    "Davis-Bacon, FAR) rather than asserting a number bare."
)

JARVIS_SYSTEM_PROMPT = (
    JARVIS_IDENTITY + " "
    + JARVIS_HONESTY + " "
    + JARVIS_STANDARDS + " "
    "You have a hard kill-switch ('frozen' state) that overrides every autonomous action; always honor it. "
    "When you need real-world information you didn't already know, USE the web_search tool "
    "(set deep=true for research-grade questions worth the extra seconds). "
    # These three were built but unreachable, so Jarvis used to answer from memory —
    # which for hotels and hours means confidently recommending places that closed.
    "For anywhere to stay, eat, or buy near a job, USE find_local_places — it returns real "
    "listings with current hours and phone numbers. Never recommend a hotel or restaurant "
    "from memory; you do not know what is still open. "
    "If the operator asks whether something is broken or down, or a data tool just failed, "
    "USE system_health and report what it actually says. "
    "For 'can we pave today', rain risk, or severe weather, USE storm_conditions — it reads "
    "live NWS and radar feeds and applies the Worden thresholds. "
    "When the operator asks you to call a phone number, USE the make_phone_call tool — "
    "never claim you've called without invoking it. "
    "When the operator asks you to send an email or 'email me X', USE the send_email tool. "
    "Default the recipient to j.wordenandsonspaving@gmail.com unless told otherwise. "
    "For legal/compliance/licensing/civil/criminal questions, treat outputs as advisory guidance, "
    "not legal advice, and clearly recommend jurisdiction-specific verification. "
    "Refuse to send, schedule, or modify anything autonomously when the master autonomy switch is OFF — "
    "in that case, propose the action and ask the operator to confirm."
)

# Tool definitions Claude can choose to invoke.
JARVIS_TOOLS = [
    {
        "name": "web_search",
        "description": (
            "Search the live web for current information (news, prices, business hours, "
            "phone numbers, reviews, anything you don't already know). Returns up to 5 results plus "
            "a synthesized answer. Use this whenever the user asks about current events or specific "
            "real-world facts. Do NOT use this for weather or paving conditions — "
            "`paving_forecast` and `paving_seasonal_risk` read our own forecast engine and apply "
            "the Worden suitability thresholds, which a web search cannot do."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "deep":  {"type": "boolean", "description": "Use advanced/deep search (slower, richer). Default false."},
            },
            "required": ["query"],
        },
    },
    # Weather is NOT a web_search job. app/services/weather_service.py already
    # holds the paving decision rules (precip > 30%, high < 50F, wind > 25mph)
    # and per-state seasonal windows. Without these tools Jarvis had no way to
    # reach any of it and fell back to searching Google — answering a crew
    # scheduling question with a consumer weather headline instead of the
    # thresholds the company actually paves by.
    {
        "name": "paving_forecast",
        "description": (
            "Authoritative 7-day PAVING SUITABILITY forecast for an address, from our own "
            "weather engine. Returns each day's conditions plus a pave / do-not-pave verdict and "
            "the reason, using the Worden thresholds: precipitation probability above 30%, high "
            "temperature below 50F, or wind above 25 mph make a day unsuitable. Use this for ANY "
            "question about weather, whether a crew can work, when to schedule a job, or whether "
            "to postpone. Always prefer this over web_search for weather."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "address": {
                    "type": "string",
                    "description": "Street address, city+state, or ZIP of the job site.",
                },
            },
            "required": ["address"],
        },
    },
    {
        "name": "paving_seasonal_risk",
        "description": (
            "Seasonal paving-risk profile for a US state (0 = low risk, 10 = high risk) by month, "
            "reflecting typical paving season windows. Use for questions about when a state's "
            "paving season opens or closes, or how risky a month is for scheduling work there."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "state_code": {
                    "type": "string",
                    "description": "Two-letter state code, e.g. VA, NC, MN.",
                },
            },
            "required": ["state_code"],
        },
    },
    # The business-data tools. Jarvis previously had no way to see the company
    # it works for: 92 routers of leads, jobs, crews and cashflow, and a chat
    # brain that could only guess or search the web. These read the same tables
    # the dashboards read, in-process (those routers are auth-gated and Jarvis
    # carries no bearer token). All read-only — no confirmation gate needed.
    {
        "name": "get_leads",
        "description": (
            "Recent inbound LEADS with score, priority and pipeline stage. Use for "
            "'who called overnight', 'any new leads', 'what's in the pipeline', "
            "'show me hot leads'. Returns newest first."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "How many to return (default 10, max 50)."},
                "min_score": {"type": "integer", "description": "Only leads scoring at or above this (0-100)."},
                "stage": {"type": "string", "description": "Filter by pipeline stage, e.g. new, contacted, won."},
            },
        },
    },
    {
        "name": "get_jobs",
        "description": (
            "Scheduled and in-progress JOBS with status, site address, crew schedule "
            "and progress. Use for 'what's on today', 'where are my crews', "
            "'what's running this week', 'which jobs are behind'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "How many to return (default 10, max 50)."},
                "status": {"type": "string", "description": "Filter by status, e.g. scheduled, in_progress, completed."},
            },
        },
    },
    {
        "name": "get_business_snapshot",
        "description": (
            "One-shot health check of the business: lead counts by stage, job counts by "
            "status, customer total. Use for 'how are we doing', 'give me the numbers', "
            "'morning brief', or any question needing overall shape rather than detail."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_money_position",
        "description": (
            "CASH POSITION: projected income vs expenses over a forward window, money "
            "already collected, money still owed, and the value sitting in unconverted "
            "estimates. Use for 'can we make payroll', 'what's coming in', 'how much are "
            "we owed', 'what did we collect this month', 'cashflow'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days_ahead": {
                    "type": "integer",
                    "description": "Forward window for projected cashflow (default 30, max 365).",
                },
            },
        },
    },
    {
        "name": "get_follow_ups",
        "description": (
            "Follow-up calls and touches that are DUE or OVERDUE, with the lead's name and "
            "phone number attached so they can be actioned immediately. Use for 'who do I "
            "need to call', 'what's overdue', 'am I forgetting anyone', 'follow ups'. "
            "Overdue items are listed first — these are leads going cold."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "How many to return (default 10, max 50)."},
                "include_upcoming": {
                    "type": "boolean",
                    "description": "Also include follow-ups scheduled in the next 48h (default true).",
                },
            },
        },
    },
    {
        "name": "get_lien_deadlines",
        "description": (
            "Mechanic's-lien deadlines by project, with days remaining. Missing one of these "
            "forfeits the right to collect on that job, so treat anything inside 14 days as "
            "urgent. Use for 'any lien deadlines', 'what am I about to lose the right to "
            "collect on', 'lien calendar', 'preliminary notice due'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "within_days": {
                    "type": "integer",
                    "description": "Only deadlines falling inside this many days (default 60, max 365).",
                },
                "state_code": {"type": "string", "description": "Two-letter state filter, e.g. VA."},
            },
        },
    },
    {
        "name": "get_bid_intelligence",
        "description": (
            "WIN/LOSS record on proposals: win rate overall and broken out by service and "
            "region, plus how our price compared to the competitor's on jobs we lost. Use "
            "for 'what's our win rate', 'why are we losing commercial', 'are we bidding too "
            "high', 'how did we do on bids this year'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "service_type": {"type": "string", "description": "Filter to one service, e.g. sealcoating."},
                "region": {"type": "string", "description": "Filter to one region."},
            },
        },
    },
    {
        "name": "get_permit_leads",
        "description": (
            "Scraped construction PERMITS that represent unworked paving opportunities, "
            "ranked HOT / WARM / COOL with project value and address. Use for 'any new "
            "permits', 'where's the work', 'what should we be bidding', 'hot permits near me'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "How many to return (default 10, max 50)."},
                "priority": {"type": "string", "description": "Filter by label: HOT, WARM or COOL."},
                "state_code": {"type": "string", "description": "Two-letter state filter, e.g. VA."},
            },
        },
    },
    {
        "name": "code_search",
        "description": (
            "Search the repository for files or lines matching a query. Returns up to 12 matches with file paths and snippets."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search term"},
                "max_results": {"type": "integer", "description": "Max results to return"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "open_file",
        "description": (
            "Return full contents of a repository file. Use relative path from repo root. Read-only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path, e.g. src/pages/Dashboard.jsx"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_npm",
        "description": "Run a whitelisted npm script from package.json (lint/build/test).",
        "input_schema": {
            "type": "object",
            "properties": {
                "script": {"type": "string", "description": "npm script name to run"},
            },
            "required": ["script"],
        },
    },
    {
        "name": "plan_actions",
        "description": "Create a small action plan from natural language (non-destructive).",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "make_phone_call",
        "description": (
            "Place a real outbound phone call via Vapi voice AI. The Vapi assistant handles the conversation "
            "on the line. Use for: booking restaurant reservations, calling vendors/suppliers, calling leads "
            "to confirm appointments, or any other real-world phone task. Numbers must include country code "
            "(e.g. +18045550100). DO NOT use for emergency services."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to_number":   {"type": "string", "description": "Phone number in E.164 format, e.g. +18045550100"},
                "purpose":     {"type": "string", "description": "Short label for logs, e.g. 'Book reservation at Lemaire 7pm Friday for 2'"},
                "script_hint": {"type": "string", "description": "Optional opening line for the assistant on the call"},
            },
            "required": ["to_number", "purpose"],
        },
    },
    {
        "name": "send_email",
        "description": (
            "Send a transactional email via SendGrid. Use for: sending the operator a document, "
            "emailing summaries, forwarding the master keys list, customer follow-ups, etc. "
            "Default recipient is j.wordenandsonspaving@gmail.com when none is given."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to_email":   {"type": "string", "description": "Recipient email address"},
                "subject":    {"type": "string", "description": "Email subject line"},
                "body":       {"type": "string", "description": "Plain-text body of the email (HTML will be auto-generated)"},
            },
            "required": ["subject", "body"],
        },
    },
    {
        "name": "schedule_appointment",
        "description": (
            "Book a real appointment — estimate walk, site visit, crew start, meeting. Saves a "
            "record the office can see later; this is not a note in the chat. Give starts_at as "
            "ISO local time (e.g. '2026-08-04T09:00'); a naive time is read as Eastern, the "
            "company's operating timezone. Set notify=true to email the operator a confirmation. "
            "If the operator is vague about when ('sometime Thursday'), ask for the hour before "
            "booking rather than picking one."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "e.g. 'Estimate — Chester parking lot'"},
                "starts_at": {"type": "string", "description": "ISO local time, e.g. 2026-08-04T09:00"},
                "duration_minutes": {"type": "integer", "description": "Default 60."},
                "location": {"type": "string"},
                "customer_name": {"type": "string"},
                "customer_phone": {"type": "string"},
                "customer_email": {"type": "string"},
                "appointment_type": {"type": "string", "description": "estimate | site_visit | crew_start | meeting | other"},
                "notes": {"type": "string"},
                "notify": {"type": "boolean", "description": "Email a confirmation. Default false."},
            },
            "required": ["title", "starts_at"],
        },
    },
    {
        "name": "list_appointments",
        "description": (
            "Read the upcoming schedule — what is booked, when, where and for whom. Use this for "
            "'what's on for tomorrow', 'am I free Thursday', or before booking something so you "
            "do not double-book him."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days_ahead": {"type": "integer", "description": "Look-ahead window. Default 14."},
                "include_past": {"type": "boolean", "description": "Include past appointments. Default false."},
            },
        },
    },
    {
        "name": "find_equipment",
        "description": (
            "Find used construction equipment for sale on the real marketplaces — dump trucks, "
            "skid steers, rollers, pavers, excavators, trailers. Searches MachineryTrader, "
            "TruckPaper, IronPlanet, Ritchie Bros, GovDeals and similar, and ranks actual "
            "listings above dealer marketing pages. Returns links with any price seen in the "
            "listing. Use this for 'find me a used tri-axle' or 'what's a good used roller "
            "going for'. Always pass along that prices are as posted and unverified."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "item": {"type": "string", "description": "e.g. 'tri-axle dump truck', 'skid steer', 'asphalt roller'"},
                "location": {"type": "string", "description": "e.g. 'Virginia' or 'Richmond VA'"},
                "max_price": {"type": "integer", "description": "Budget ceiling in dollars."},
                "year_min": {"type": "integer", "description": "Oldest acceptable model year."},
            },
            "required": ["item"],
        },
    },
    {
        "name": "system_capabilities",
        "description": (
            "Introspect THIS platform's own live capabilities: every mounted API endpoint "
            "grouped by function, and every database table. Call with no query for an overview "
            "('what can you do?'), or with a keyword to find what exists for a subject "
            "('lien', 'drone', 'compaction', 'weather') — it returns real endpoint paths and "
            "table names read from the running app, so it is never out of date. "
            "Use this whenever the operator asks what the system can do, whether a feature "
            "exists, or where some kind of data lives. Do NOT answer those from memory — the "
            "platform changes and you will be wrong."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Optional keyword, e.g. 'lien', 'drone', 'invoice'"},
                "detail": {"type": "boolean", "description": "Include full endpoint paths per group. Default false."},
            },
        },
    },
    {
        "name": "find_local_places",
        "description": (
            "Find REAL nearby businesses — hotels for a crew working out of town, restaurants, "
            "hardware and parts suppliers, gas. Backed by Google Places, so results are real "
            "listings with address, phone, rating, price level and whether they are open now. "
            "Use this any time the operator asks where to stay, where to eat, or where to buy "
            "something near a job. Do NOT answer those from memory — you do not know which "
            "businesses still exist or their current hours."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What to find, e.g. 'hotel', 'steakhouse', 'asphalt supplier'"},
                "location": {"type": "string", "description": "Town/city, e.g. 'Vinton, VA'"},
                "open_now": {"type": "boolean", "description": "Only places open right now. Default false."},
                "min_rating": {"type": "number", "description": "Minimum Google rating, e.g. 4.0"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "system_health",
        "description": (
            "Check whether the JWordenAI platform itself is healthy: database connectivity, "
            "which integrations actually have credentials configured, the database migration "
            "revision, and background-job plumbing. Use this whenever the operator asks if "
            "something is broken or down, when a data tool has just failed and you need to say "
            "why, or before claiming a capability is unavailable."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "storm_conditions",
        "description": (
            "Live weather at a point: current conditions, active National Weather Service "
            "watches/warnings, and a paving GO / CAUTION / NO-GO verdict scored against the "
            "Worden Standard (96% Marshall compaction floor, sealcoat cure temperature, "
            "overspray wind limit, rain washout window). Use this for 'can we pave today', "
            "'is it going to rain on the crew', or any severe-weather question. This reads live "
            "radar and NWS feeds — never estimate weather yourself."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "lat": {"type": "number", "description": "Latitude. Defaults to Richmond, VA."},
                "lon": {"type": "number", "description": "Longitude. Defaults to Richmond, VA."},
            },
        },
    },
]

_SENSITIVE_TOOL_NAMES = {"make_phone_call", "send_email", "run_npm"}

# Every tool served by _business_query. Kept as one name so the dispatcher and
# the implementation cannot drift apart: adding a branch to _business_query
# without adding it here silently produced "I don't have a tool for that".
_BUSINESS_TOOL_NAMES = {
    "get_leads",
    "get_jobs",
    "get_business_snapshot",
    "get_money_position",
    "get_follow_ups",
    "get_lien_deadlines",
    "get_bid_intelligence",
    "get_permit_leads",
}

_ROLE_TOOLS: dict[str, set[str]] = {
    # Weather tools are read-only and carry no spend or side effects, so every
    # role gets them. A customer asking "can you pave my lot next week?" is a
    # sales conversation, and answering it from our own thresholds instead of a
    # web search is the whole point of having the engine.
    ROLE_PUBLIC_CONCIERGE: {"web_search", "paving_forecast", "paving_seasonal_risk"},
    ROLE_STAFF_OPERATOR: {
        "web_search", "code_search", "open_file", "plan_actions", "run_npm",
        "paving_forecast", "paving_seasonal_risk",
        # Business data is staff+ only — a public visitor must never be able to
        # enumerate leads, customer names or job sites through the concierge.
        "get_leads", "get_jobs", "get_business_snapshot",
        "get_follow_ups", "get_lien_deadlines", "get_permit_leads",
        # NOTE: get_money_position and get_bid_intelligence are deliberately
        # absent here. Revenue, receivables and win/loss margins are owner-level
        # facts — a crew lead or office operator has no need for them, and they
        # are exactly what would hurt most if a staff session were compromised.
        # ROLE_OWNER_ROOT picks them up automatically from JARVIS_TOOLS.
    },
    ROLE_OWNER_ROOT: {t["name"] for t in JARVIS_TOOLS},
}


def _toolset_for_session(*, confirmed: bool, role: str) -> list[dict]:
    allowed = set(_ROLE_TOOLS.get(role, _ROLE_TOOLS[ROLE_PUBLIC_CONCIERGE]))
    if not confirmed:
        allowed -= _SENSITIVE_TOOL_NAMES
    return [t for t in JARVIS_TOOLS if t.get("name") in allowed]

_ACTION_HINT_RE = re.compile(
    r"\b(call|dial|phone|text|sms|email|send|book|schedule|reserve|pay|order|quote|estimate|create|update|delete|cancel|approve|publish|post|run|launch)\b",
    re.IGNORECASE,
)


# Conditions questions must reach the tool-capable lane.
#
# converse() routes on action verbs alone: anything without call/email/book/pay
# etc. goes to _ask_chat_brain, which carries NO tools, and returns before
# _ask_claude is ever reached. So "can my crew pave in Richmond this week?" was
# answered from the model's memory while paving_forecast — our own engine, with
# the real 30% precip / 50F / 25mph thresholds — sat unused two functions away.
# The visible symptom was Jarvis reaching for a web search, or saying it had no
# weather access at all.
#
# Scoped deliberately to weather and paving conditions rather than every
# informational query: the tool lane costs an extra round trip, and widening
# this further should be a measured decision, not a side effect of this fix.
_CONDITIONS_RE = re.compile(
    r"\b(weather|forecast|rain\w*|precip\w*|temperature|temps?|wind\w*|storm\w*|"
    r"snow\w*|freez\w*|frost|humid\w*|pave|paving|sealcoat\w*|curing|"
    r"too\s+cold|too\s+hot|dry\s+out|"
    # Business questions need the data tools for the same reason: the chat
    # brain has none, and would answer "how many leads" from imagination.
    r"lead|leads|job|jobs|crew|crews|customer|customers|pipeline|"
    r"booked|scheduled|revenue|receivable|snapshot|how are we doing|"
    # Money, obligations and bid history. Same reasoning as above: without
    # these words the question never reaches a tool, and Jarvis answers a
    # cashflow question with a plausible-sounding invention.
    r"cash\s*flow|cashflow|payroll|invoice\w*|owed|collect\w*|payment\w*|"
    r"paid|outstanding|estimate\w*|quote\w*|money|"
    r"follow[\s-]?ups?|overdue|call\s*back|callback|"
    r"lien\w*|deadline\w*|notice|"
    # Deliberately NOT bare `won`/`lost`: "who won the world series" is not a
    # bid question, and dragging trivia into the tool lane costs a round trip
    # on every one. bid/proposal/win-rate/competitor already catch the real ask.
    r"bid|bids|bidding|proposal\w*|win\s*rate|competitor\w*|"
    r"permit\w*)\b",
    re.IGNORECASE,
)


def _looks_like_tool_action(query: str) -> bool:
    q = (query or "").strip()
    return bool(_ACTION_HINT_RE.search(q) or _CONDITIONS_RE.search(q))


_LIVE_INFO_KEYWORDS = {
    "weather", "forecast", "news", "today", "now", "live", "current", "price", "market",
    "traffic", "stock", "breaking",
}

_RESPONSE_CACHE: dict[str, tuple[float, dict]] = {}
_RESPONSE_CACHE_MAX_ITEMS = 200


def _cfg_int(key: str, default: int) -> int:
    raw = (_cfg.get(key) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except Exception:  # noqa: BLE001
        return default


def _low_cost_mode() -> bool:
    # Defaults to OFF. This used to default to "1", which silently capped every
    # reply at 220-320 tokens and dropped temperature to 0.2 — the assistant read
    # as curt and characterless, and long answers were cut mid-thought. Cost
    # control is still one env var away (JARVIS_LOW_COST_MODE=1) for anyone who
    # wants it, but the default should be a working assistant, not a throttled one.
    raw = (_cfg.get("JARVIS_LOW_COST_MODE") or "0").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def _response_cache_ttl_seconds() -> int:
    # Short TTL avoids stale guidance while still suppressing repeat token spend.
    return _cfg_int("JARVIS_RESPONSE_CACHE_TTL_SECONDS", 180)


def _is_cacheable_query(query: str, *, action_intent: bool) -> bool:
    if action_intent:
        return False
    q = (query or "").strip().lower()
    if not q:
        return False
    return not any(term in q for term in _LIVE_INFO_KEYWORDS)


def _response_cache_key(query: str, persona: str, role: str, confirmed: bool) -> str:
    normalized_query = " ".join((query or "").strip().lower().split())
    # Canonicalise the persona rather than trusting the caller's string. The
    # cache is LRU-bounded, so a public caller varying `persona` freely would
    # otherwise mint a distinct key per variation and evict real entries.
    # Personas outside the allow-list all behave as JARVIS anyway, so they must
    # share its key.
    canonical = str(persona or "").strip().upper()
    if canonical not in _PERSONA_NOTES:
        canonical = _DEFAULT_PERSONA
    return f"{canonical}|{role}|{int(bool(confirmed))}|{normalized_query}"


def _response_cache_get(key: Optional[str]) -> Optional[dict]:
    if not key:
        return None
    entry = _RESPONSE_CACHE.get(key)
    if not entry:
        return None
    created_at, payload = entry
    if time.time() - created_at > _response_cache_ttl_seconds():
        _RESPONSE_CACHE.pop(key, None)
        return None
    cached_payload = dict(payload)
    cached_payload["cached"] = True
    return cached_payload


def _response_cache_set(key: Optional[str], payload: dict) -> None:
    if not key:
        return
    _RESPONSE_CACHE[key] = (time.time(), payload)
    if len(_RESPONSE_CACHE) > _RESPONSE_CACHE_MAX_ITEMS:
        oldest_key = min(_RESPONSE_CACHE, key=lambda k: _RESPONSE_CACHE[k][0])
        _RESPONSE_CACHE.pop(oldest_key, None)


_LEGAL_ADVISORY_KEYWORDS = {
    "legal", "law", "laws", "court", "civil", "criminal", "compliance", "regulation",
    "regulations", "license", "licensing", "permit", "bond", "insurance", "osha",
    "lien", "prompt payment", "prevailing wage", "utility", "environmental", "state law",
}

_LEGAL_ADVISORY_SOURCES_SUMMARY = "app/services/state_data.py, app/services/ai_brain.py, src/data/legal/*.js"

_STATE_NAME_TO_ABBR = {
    str(row.get("name", "")).lower(): abbr
    for abbr, row in getattr(_state_data, "STATE_MAP", {}).items()
    if row.get("name")
}


def _is_legal_advisory_query(query: str) -> bool:
    q = (query or "").lower()
    return any(term in q for term in _LEGAL_ADVISORY_KEYWORDS)


def _infer_state_code_from_query(query: str) -> Optional[str]:
    text = query or ""
    # First pass: explicit two-letter abbreviations (e.g., VA, TX, DC)
    for token in re.findall(r"\b[A-Za-z]{2}\b", text):
        normalized = _state_data.normalize_state_code(token)
        if normalized:
            return normalized

    # Second pass: full state names
    q_lower = text.lower()
    for name, abbr in sorted(_STATE_NAME_TO_ABBR.items(), key=lambda item: len(item[0]), reverse=True):
        if name and name in q_lower:
            return abbr
    return None


def _build_advisory_context(query: str) -> str:
    if not _is_legal_advisory_query(query):
        return ""

    state_code = _infer_state_code_from_query(query)
    state_fragment = _state_data.get_state_prompt_fragment(state_code) if state_code else ""
    state_line = f"State focus: {state_code}.\n" if state_code else "State focus: national (no state extracted).\n"
    state_block = f"{state_fragment}\n" if state_fragment else ""

    return (
        "LEGAL ADVISORY MODE\n"
        "This response is advisory operations guidance, not legal advice.\n"
        f"{state_line}"
        f"{state_block}"
        f"Primary source tables: {_LEGAL_ADVISORY_SOURCES_SUMMARY}.\n"
        "When uncertainty exists, explicitly say what to verify and where."
    )


async def _ask_fast_ops_brain(query: str, persona: str, autonomy: dict, *, confirmed: bool = False) -> Optional[dict]:
    """
    Fast no-tool reasoning lane using the unified multi-model router.
    Keeps responses snappy for daily operations Q&A.
    """
    persona_note = (
        "Adopt the 'Mr. Worden Sales' persona: warm, energetic, closing-oriented, Richmond paving expert."
        if persona == "MR_WORDEN_SALES"
        else "Maintain the JARVIS persona with concise executive operations tone."
    )
    ops_snapshot = (
        f"Autonomy master={autonomy.get('master')} frozen={autonomy.get('frozen')} operator_confirmed={confirmed}. "
        f"Tools status: web_search={_web_search.is_available()} call={_vapi.is_available()} email={bool(_cfg.get('SENDGRID_API_KEY').strip())}."
    )
    # include short-term convo memory when available
    mem_snippet = ""
    try:
        session_id = autonomy.get("session_id") if isinstance(autonomy, dict) else None
    except Exception:
        session_id = None
    if not session_id:
        session_id = _cfg.get("LAST_JARVIS_SESSION") or None
    if session_id:
        recent = short_memory.get(session_id)
        if recent:
            mem_snippet = "Recent conversation: " + " | ".join(recent[-3:]) + "\n"

    advisory_context = _build_advisory_context(query)

    system = (
        f"{JARVIS_SYSTEM_PROMPT}\n\n"
        f"{persona_note}\n"
        f"{ops_snapshot}\n"
        f"{mem_snippet}"
        f"{advisory_context}\n"
        "Answer in practical daily-operations format: Situation, Recommendation, Next Action. "
        "For legal/compliance questions include: Advisory Answer, Impact, Verification Needed. "
        "Keep default answers under 6 lines unless asked for a deep dive."
    )

    try:
        max_tokens = _cfg_int("JARVIS_FAST_MAX_TOKENS", 320 if _low_cost_mode() else 1000)
        resp = await asyncio.to_thread(
            _llm.chat,
            task="jarvis_fast",
            system=system,
            user=query,
            max_tokens=max_tokens,
            temperature=0.2 if _low_cost_mode() else 0.4,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[JARVIS] Fast ops brain failed: %s", exc)
        return None

    if resp.error or not (resp.text or "").strip():
        return None
    return {
        "text": resp.text.strip(),
        "provider": resp.provider,
        "model": resp.model,
        "fallback_used": bool(resp.fallback_used),
    }


# ── Persona allow-list ───────────────────────────────────────────────────────
#
# `persona` arrives from the request body of POST /api/v1/jarvis/chat, which is
# NOT auth-gated — it is the public concierge on the marketing site. It used to
# be interpolated straight into the system prompt as
# `f"Adopt persona: {persona}."`, which made the field a free-text system-prompt
# channel for anyone who could reach the endpoint. An unauthenticated curl was
# enough to change the assistant's instructions.
#
# Only these two personas are real product surfaces, so anything else falls back
# to JARVIS rather than being echoed into the prompt.
_PERSONA_NOTES: dict[str, str] = {
    "JARVIS": (
        "You are Jarvis: warm, conversational, helpful, concise but friendly. "
        "Ask clarifying questions when unsure."
    ),
    "MR_WORDEN_SALES": (
        "You are Mr. Worden, a fourth-generation paving contractor talking to a "
        "prospective customer: energetic, plain-spoken, proud of the work. Focus on "
        "durability and value. Never quote a firm price or promise a schedule — "
        "hand those to the office."
    ),
}
_DEFAULT_PERSONA = "JARVIS"


def _persona_note(persona: Optional[str]) -> str:
    key = str(persona or "").strip().upper()
    note = _PERSONA_NOTES.get(key)
    if note:
        return note
    if key and key != _DEFAULT_PERSONA:
        # Worth seeing in logs: either a client is sending a persona we retired,
        # or someone is probing the field.
        logger.info("[JARVIS] Unrecognised persona %r — falling back to JARVIS", persona[:64])
    return _PERSONA_NOTES[_DEFAULT_PERSONA]


async def _ask_chat_brain(query: str, persona: str, autonomy: dict, session_id: Optional[str] = None, *, confirmed: bool = False) -> Optional[dict]:
    """
    Human-like conversational lane. Uses the multi-provider router via _llm.chat
    with a persona-focused system prompt and recent short-term memory.
    """
    persona_note = _persona_note(persona)

    mem_snippet = ""
    try:
        sid = session_id or (autonomy.get("session_id") if isinstance(autonomy, dict) else None)
    except Exception:
        sid = session_id
    if sid:
        recent = short_memory.get(sid)
        if recent:
            mem_snippet = "Recent conversation: " + " | ".join(recent[-4:]) + "\n"

    advisory_context = _build_advisory_context(query)

    # Same identity, honesty rule and engineering standards as the tool lane —
    # see JARVIS_IDENTITY. This lane has NO tools, which makes the honesty rule
    # more important here, not less: it is the lane most likely to be asked a
    # question it cannot look up, and the one that used to answer anyway.
    system = (
        f"{JARVIS_IDENTITY} {persona_note}\n"
        f"{JARVIS_HONESTY}\n"
        f"{JARVIS_STANDARDS}\n"
        "You are on the conversational lane and hold no tools this turn. If the answer "
        "needs live data — leads, jobs, money, weather, current events — say you'll pull "
        "it and ask the operator to put the request in terms that reach your tools, "
        "rather than answering from memory.\n"
        + mem_snippet + advisory_context + "\n"
        "For legal/compliance questions, answer in advisory form: state the operational "
        "impact, name the governing jurisdiction, and say what must be verified before "
        "anyone acts on it."
    )

    try:
        max_tokens = _cfg_int("JARVIS_CHAT_MAX_TOKENS", 380 if _low_cost_mode() else 1600)
        resp = await asyncio.to_thread(
            _llm.chat,
            task="persona",
            system=system,
            user=query,
            max_tokens=max_tokens,
            temperature=0.45 if _low_cost_mode() else 0.7,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[JARVIS] Chat brain failed: %s", exc)
        return None

    if resp.error or not (resp.text or "").strip():
        return None
    return {"text": resp.text.strip(), "provider": resp.provider, "model": resp.model, "fallback_used": bool(resp.fallback_used)}


def _business_query(name: str, args: dict) -> dict:
    """
    Read leads / jobs / counts straight from the database.

    Synchronous on purpose — SQLAlchemy sessions are blocking, so callers wrap
    this in asyncio.to_thread rather than blocking the event loop.

    Goes to the models rather than /api/v1/leads etc. because those routers
    require a bearer token and Jarvis holds none; routing through HTTP would
    mean minting a service credential for a read it can already do safely.
    Every branch is read-only.
    """
    from ..database import SessionLocal  # noqa: PLC0415
    from ..models import (  # noqa: PLC0415
        CashFlowEntry,
        Customer,
        Estimate,
        FollowUpTask,
        Job,
        Lead,
        LienCalendarEntry,
        PaymentTransaction,
        PermitLead,
        ProposalOutcome,
    )

    def _clamp(v, default=10, hi=50):
        try:
            return max(1, min(int(v), hi))
        except (TypeError, ValueError):
            return default

    now = datetime.now(timezone.utc)

    def _days_until(dt) -> int | None:
        """Whole days from now until dt. Negative means it already passed."""
        if dt is None:
            return None
        # Rows written before the timezone-aware columns landed can still come
        # back naive; treating those as UTC is right for this database and
        # avoids a TypeError that would take the whole tool down.
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (dt - now).days

    db = SessionLocal()
    try:
        if name == "get_leads":
            q = db.query(Lead)
            if args.get("stage"):
                q = q.filter(Lead.pipeline_stage == str(args["stage"]).strip())
            if args.get("min_score") is not None:
                try:
                    q = q.filter(Lead.score_value >= int(args["min_score"]))
                except (TypeError, ValueError):
                    pass
            rows = q.order_by(Lead.id.desc()).limit(_clamp(args.get("limit"))).all()
            return {
                "ok": True,
                "count": len(rows),
                "leads": [{
                    "id": r.id, "name": r.name, "phone": r.phone, "email": r.email,
                    "service": r.service_type, "address": r.address, "state": r.state_code,
                    "score": r.score_value, "priority": r.score_label,
                    "stage": r.pipeline_stage, "urgency": r.urgency,
                } for r in rows],
            }

        if name == "get_jobs":
            q = db.query(Job)
            if args.get("status"):
                q = q.filter(Job.status == str(args["status"]).strip())
            rows = q.order_by(Job.id.desc()).limit(_clamp(args.get("limit"))).all()
            return {
                "ok": True,
                "count": len(rows),
                "jobs": [{
                    "id": r.id, "job_number": r.job_number, "name": r.name,
                    "status": r.status, "service": r.service_type,
                    "site": r.site_address, "state": r.state_code,
                    "scheduled_start": str(r.scheduled_start) if r.scheduled_start else None,
                    "scheduled_end": str(r.scheduled_end) if r.scheduled_end else None,
                    "progress_percent": r.progress_percent,
                } for r in rows],
            }

        if name == "get_money_position":
            from sqlalchemy import func  # noqa: PLC0415

            try:
                horizon = max(1, min(int(args.get("days_ahead") or 30), 365))
            except (TypeError, ValueError):
                horizon = 30
            until = now + timedelta(days=horizon)

            def _sum(q) -> float:
                return round(float(q.scalar() or 0.0), 2)

            projected_in = _sum(
                db.query(func.sum(CashFlowEntry.amount)).filter(
                    CashFlowEntry.entry_type == "income",
                    CashFlowEntry.expected_date >= now,
                    CashFlowEntry.expected_date <= until,
                )
            )
            projected_out = _sum(
                db.query(func.sum(CashFlowEntry.amount)).filter(
                    CashFlowEntry.entry_type == "expense",
                    CashFlowEntry.expected_date >= now,
                    CashFlowEntry.expected_date <= until,
                )
            )
            collected = _sum(
                db.query(func.sum(PaymentTransaction.amount_usd)).filter(
                    PaymentTransaction.status == "paid"
                )
            )
            awaiting = _sum(
                db.query(func.sum(PaymentTransaction.amount_usd)).filter(
                    PaymentTransaction.status == "pending"
                )
            )
            # Estimates that went out and have not been won or lost yet. Quoted
            # as a low/high band because that is how the estimator produces
            # them — collapsing to a midpoint here would invent precision the
            # underlying number does not have.
            open_est = db.query(
                func.count(Estimate.id),
                func.sum(Estimate.amount_low),
                func.sum(Estimate.amount_high),
            ).filter(Estimate.status.in_(("sent", "approved"))).one()

            return {
                "ok": True,
                "window_days": horizon,
                "projected_income": projected_in,
                "projected_expenses": projected_out,
                "projected_net": round(projected_in - projected_out, 2),
                "collected_to_date": collected,
                "awaiting_payment": awaiting,
                "open_estimates": {
                    "count": int(open_est[0] or 0),
                    "value_low": round(float(open_est[1] or 0.0), 2),
                    "value_high": round(float(open_est[2] or 0.0), 2),
                },
                "note": (
                    "Projected figures come from cashflow_entries only. If that table is "
                    "empty the projection is zero — that means nothing has been logged, "
                    "not that no money is moving."
                ),
            }

        if name == "get_follow_ups":
            include_upcoming = args.get("include_upcoming")
            include_upcoming = True if include_upcoming is None else bool(include_upcoming)
            cutoff = now + timedelta(hours=48) if include_upcoming else now

            rows = (
                db.query(FollowUpTask)
                .filter(
                    FollowUpTask.status == "pending",
                    FollowUpTask.scheduled_at <= cutoff,
                )
                .order_by(FollowUpTask.scheduled_at.asc())
                .limit(_clamp(args.get("limit")))
                .all()
            )

            # One extra query for the whole page of leads rather than one per
            # row — this list is rendered on every morning brief.
            lead_ids = [r.lead_id for r in rows if r.lead_id]
            leads = (
                {l.id: l for l in db.query(Lead).filter(Lead.id.in_(lead_ids)).all()}
                if lead_ids
                else {}
            )

            items = []
            for r in rows:
                lead = leads.get(r.lead_id)
                due_in = _days_until(r.scheduled_at)
                items.append({
                    "task_id": r.id,
                    "type": r.task_type,
                    "due": str(r.scheduled_at) if r.scheduled_at else None,
                    "days_until_due": due_in,
                    "overdue": bool(due_in is not None and due_in < 0),
                    "lead_id": r.lead_id,
                    "lead_name": getattr(lead, "name", None),
                    "phone": getattr(lead, "phone", None),
                    "email": getattr(lead, "email", None),
                    "service": getattr(lead, "service_type", None),
                    "priority": getattr(lead, "score_label", None),
                })

            overdue = [i for i in items if i["overdue"]]
            return {
                "ok": True,
                "count": len(items),
                "overdue_count": len(overdue),
                "follow_ups": items,
            }

        if name == "get_lien_deadlines":
            try:
                within = max(1, min(int(args.get("within_days") or 60), 365))
            except (TypeError, ValueError):
                within = 60
            horizon = now + timedelta(days=within)

            q = db.query(LienCalendarEntry)
            if args.get("state_code"):
                q = q.filter(
                    LienCalendarEntry.state_code == str(args["state_code"]).strip().upper()[:2]
                )
            rows = q.order_by(LienCalendarEntry.id.desc()).limit(200).all()

            items = []
            for r in rows:
                # A row carries up to three separate deadlines; each is its own
                # forfeiture risk, so they are surfaced individually rather than
                # reduced to whichever happens to be soonest.
                for label, when in (
                    ("preliminary_notice", r.preliminary_notice_deadline),
                    ("lien_filing", r.lien_filing_deadline),
                    ("foreclosure", r.foreclosure_deadline),
                ):
                    if when is None:
                        continue
                    days = _days_until(when)
                    if days is None or days > within:
                        continue
                    items.append({
                        "entry_id": r.id,
                        "deadline_type": label,
                        "due": str(when),
                        "days_remaining": days,
                        "expired": days < 0,
                        "urgent": 0 <= days <= 14,
                        "customer": r.customer_name,
                        "project_address": r.project_address,
                        "state": r.state_code,
                    })

            items.sort(key=lambda i: i["days_remaining"])
            return {
                "ok": True,
                "window_days": within,
                "count": len(items),
                "urgent_count": sum(1 for i in items if i["urgent"]),
                "expired_count": sum(1 for i in items if i["expired"]),
                "deadlines": items[:50],
                "horizon": str(horizon),
            }

        if name == "get_bid_intelligence":
            q = db.query(ProposalOutcome)
            if args.get("service_type"):
                q = q.filter(ProposalOutcome.service_type == str(args["service_type"]).strip())
            if args.get("region"):
                q = q.filter(ProposalOutcome.region == str(args["region"]).strip())
            rows = q.all()

            def _rate(subset) -> dict:
                won = sum(1 for r in subset if r.outcome == "won")
                lost = sum(1 for r in subset if r.outcome == "lost")
                decided = won + lost
                return {
                    "won": won,
                    "lost": lost,
                    "pending": sum(1 for r in subset if r.outcome == "pending"),
                    # Undecided bids are excluded from the denominator — counting
                    # them as losses would make an active pipeline look like a
                    # collapsing one.
                    "win_rate_percent": round(won / decided * 100, 1) if decided else None,
                }

            def _group(attr) -> dict:
                buckets: dict[str, list] = {}
                for r in rows:
                    buckets.setdefault(str(getattr(r, attr) or "unspecified"), []).append(r)
                return {k: _rate(v) for k, v in sorted(buckets.items())}

            # On lost bids, how far above the competitor were we? Positive means
            # we were the more expensive number.
            gaps = [
                r.proposal_amount_low - r.competitor_price
                for r in rows
                if r.outcome == "lost"
                and r.competitor_price
                and r.proposal_amount_low
            ]
            avg_gap = round(sum(gaps) / len(gaps), 2) if gaps else None

            return {
                "ok": True,
                "total_proposals": len(rows),
                "overall": _rate(rows),
                "by_service": _group("service_type"),
                "by_region": _group("region"),
                "lost_bids_with_competitor_price": len(gaps),
                "avg_amount_over_competitor_on_losses": avg_gap,
            }

        if name == "get_permit_leads":
            q = db.query(PermitLead)
            if args.get("priority"):
                q = q.filter(
                    PermitLead.priority_label == str(args["priority"]).strip().upper()
                )
            if args.get("state_code"):
                q = q.filter(
                    PermitLead.property_state == str(args["state_code"]).strip().upper()[:2]
                )
            rows = (
                q.order_by(PermitLead.priority_score.desc().nullslast(), PermitLead.id.desc())
                .limit(_clamp(args.get("limit")))
                .all()
            )
            return {
                "ok": True,
                "count": len(rows),
                "permits": [{
                    "id": r.id,
                    "permit_number": r.permit_number,
                    "type": r.permit_type,
                    "status": r.permit_status,
                    "contractor": r.contractor_name,
                    "address": r.property_address,
                    "city": r.property_city,
                    "state": r.property_state,
                    "project_value": r.project_value,
                    "estimated_sqft": r.estimated_sqft,
                    "priority": r.priority_label,
                    "score": r.priority_score,
                    "permit_date": str(r.permit_date) if r.permit_date else None,
                } for r in rows],
            }

        if name != "get_business_snapshot":
            # Explicit rather than falling through. This function used to end in
            # an unguarded snapshot return, so a tool listed in
            # _BUSINESS_TOOL_NAMES but never implemented here would answer a
            # cashflow question with lead counts and look like it had worked.
            return {"ok": False, "error": f"No business query implemented for {name!r}"}

        def _by(model, column):
            from sqlalchemy import func  # noqa: PLC0415
            return {
                str(k or "unspecified"): int(v)
                for k, v in db.query(column, func.count()).group_by(column).all()
            }

        return {
            "ok": True,
            "leads_total": db.query(Lead).count(),
            "leads_by_stage": _by(Lead, Lead.pipeline_stage),
            "jobs_total": db.query(Job).count(),
            "jobs_by_status": _by(Job, Job.status),
            "customers_total": db.query(Customer).count(),
        }
    finally:
        db.close()


async def _run_tool(
    name: str,
    args: dict,
    *,
    confirmed: bool = False,
    role: str = ROLE_PUBLIC_CONCIERGE,
    tenant_id: str = "default",
) -> dict:
    allowed = _ROLE_TOOLS.get(role, _ROLE_TOOLS[ROLE_PUBLIC_CONCIERGE])

    def _finalize(result: dict) -> dict:
        ok = bool(result.get("ok")) if "ok" in result else ("error" not in result)
        _jarvis_obs.record_tool_call(tool_name=name, role=role, tenant_id=tenant_id, ok=ok)
        return result

    if name not in allowed:
        return _finalize({"ok": False, "error": "Role policy blocked this tool"})

    if name in _SENSITIVE_TOOL_NAMES and not confirmed:
        return _finalize({"ok": False, "error": "Operator confirmation required for this tool"})

    if name == "web_search":
        result = await _web_search.search(
            args.get("query", ""),
            deep=bool(args.get("deep", False)),
        )
        return _finalize(result)
    if name in _BUSINESS_TOOL_NAMES:
        try:
            result = await asyncio.to_thread(_business_query, name, args)
            return _finalize(result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] %s failed: %s", name, exc)
            return _finalize({"ok": False, "error": f"{name} unavailable: {exc}"})

    if name == "schedule_appointment":
        try:
            from . import appointment_service  # noqa: PLC0415

            data = await asyncio.to_thread(
                appointment_service.create_appointment,
                args.get("title", ""),
                args.get("starts_at", ""),
                int(args.get("duration_minutes") or 60),
                args.get("location"),
                args.get("customer_name"),
                args.get("customer_phone"),
                args.get("customer_email"),
                args.get("appointment_type", "estimate"),
                args.get("notes"),
                bool(args.get("notify", False)),
            )
            return _finalize({"ok": data.get("status") == "ok", **data})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] schedule_appointment failed: %s", exc)
            return _finalize({"ok": False, "error": f"could not book appointment: {exc}"})

    if name == "list_appointments":
        try:
            from . import appointment_service  # noqa: PLC0415

            data = await asyncio.to_thread(
                appointment_service.list_appointments,
                int(args.get("days_ahead") or 14),
                bool(args.get("include_past", False)),
            )
            return _finalize({"ok": data.get("status") == "ok", **data})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] list_appointments failed: %s", exc)
            return _finalize({"ok": False, "error": f"could not read schedule: {exc}"})

    if name == "find_equipment":
        try:
            from . import equipment_finder_service  # noqa: PLC0415

            data = await equipment_finder_service.find_equipment(
                args.get("item", ""),
                args.get("location"),
                int(args["max_price"]) if args.get("max_price") else None,
                int(args["year_min"]) if args.get("year_min") else None,
            )
            return _finalize({"ok": data.get("status") == "ok", **data})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] find_equipment failed: %s", exc)
            return _finalize({"ok": False, "error": f"equipment search unavailable: {exc}"})

    if name == "system_capabilities":
        try:
            from . import system_map_service  # noqa: PLC0415

            data = await asyncio.to_thread(
                system_map_service.describe_system,
                args.get("query"),
                bool(args.get("detail", False)),
            )
            return _finalize({"ok": data.get("status") == "ok", **data})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] system_capabilities failed: %s", exc)
            return _finalize({"ok": False, "error": f"system map unavailable: {exc}"})

    if name == "find_local_places":
        try:
            from . import local_places_service  # noqa: PLC0415

            data = await asyncio.to_thread(
                local_places_service.find_places,
                args.get("query", ""),
                args.get("location"),
                bool(args.get("open_now", False)),
                float(args.get("min_rating") or 0),
            )
            return _finalize({"ok": data.get("status") == "ok", **data})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] find_local_places failed: %s", exc)
            return _finalize({"ok": False, "error": f"local place lookup unavailable: {exc}"})

    if name == "system_health":
        try:
            from . import self_health_service  # noqa: PLC0415

            data = await asyncio.to_thread(self_health_service.check_system_health)
            return _finalize({"ok": True, **data})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] system_health failed: %s", exc)
            return _finalize({"ok": False, "error": f"self-health check failed: {exc}"})

    if name == "storm_conditions":
        try:
            from . import storm_service  # noqa: PLC0415

            lat = float(args.get("lat") or 37.5407)
            lon = float(args.get("lon") or -77.436)
            cond = await asyncio.to_thread(storm_service.get_conditions, lat, lon)
            alerts = await asyncio.to_thread(storm_service.get_active_alerts, lat, lon, None)
            return _finalize({"ok": cond.get("status") == "ok", "conditions": cond, "alerts": alerts})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] storm_conditions failed: %s", exc)
            return _finalize({"ok": False, "error": f"storm conditions unavailable: {exc}"})

    if name == "paving_forecast":
        # Called in-process rather than over /api/v1/weather/* — that router is
        # auth-gated, and Jarvis holds no bearer token of its own.
        try:
            from . import weather_service  # noqa: PLC0415

            data = await asyncio.to_thread(
                weather_service.get_paving_forecast, args.get("address", "")
            )
            return _finalize({"ok": True, **data} if isinstance(data, dict) else {"ok": True, "result": data})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] paving_forecast failed: %s", exc)
            return _finalize({"ok": False, "error": f"paving forecast unavailable: {exc}"})

    if name == "paving_seasonal_risk":
        try:
            from . import weather_service  # noqa: PLC0415

            data = await asyncio.to_thread(
                weather_service.get_state_seasonal_risk,
                (args.get("state_code", "") or "").strip().upper(),
            )
            return _finalize({"ok": True, **data} if isinstance(data, dict) else {"ok": True, "result": data})
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] paving_seasonal_risk failed: %s", exc)
            return _finalize({"ok": False, "error": f"seasonal risk unavailable: {exc}"})

    if name == "make_phone_call":
        result = await _vapi.place_call(
            args.get("to_number", ""),
            purpose=args.get("purpose", "Jarvis-initiated call"),
            script_hint=args.get("script_hint"),
            confirmed=confirmed,
        )
        return _finalize(result)
    if name == "send_email":
        to_addr = (args.get("to_email") or os.environ.get("ADMIN_NOTIFY_EMAIL") or "j.wordenandsonspaving@gmail.com").strip()
        subject = (args.get("subject") or "Message from Jarvis").strip()
        body    = args.get("body") or ""
        html    = "<pre style='font-family:ui-monospace,Consolas,monospace;white-space:pre-wrap'>" + (body.replace("&", "&amp;").replace("<", "&lt;")) + "</pre>"
        try:
            ok = await asyncio.to_thread(
                _email.send_raw,
                to_email=to_addr, subject=subject, html_body=html, plain_text=body,
            )
            return _finalize({"ok": bool(ok), "to": to_addr, "subject": subject})
        except Exception as exc:
            return _finalize({"ok": False, "error": str(exc)})
    if name == "code_search":
        q = args.get("query") or ""
        maxr = int(args.get("max_results") or 12)
        try:
            matches = _code.search(q, max_results=maxr)
            return _finalize({"ok": True, "matches": matches})
        except Exception as exc:
            return _finalize({"ok": False, "error": str(exc)})
    if name == "open_file":
        path = args.get("path") or ""
        try:
            res = _code.open_file(path)
            return _finalize({"ok": True, "result": res})
        except Exception as exc:
            return _finalize({"ok": False, "error": str(exc)})
    if name == "run_npm":
        script = (args.get("script") or "").strip()
        if not script:
            return _finalize({"ok": False, "error": "no script provided"})
        return _finalize(_runner.run_npm_script(script))
    if name == "plan_actions":
        q = args.get("query") or ""
        plan = _planner.plan(q, {"run_npm": True, "code_search": True, "open_file": True})
        return _finalize({"ok": True, "plan": plan})
    return _finalize({"ok": False, "error": f"Unknown tool: {name}"})


async def _ask_claude(
    query: str,
    persona: str,
    autonomy: dict,
    *,
    confirmed: bool = False,
    role: str = ROLE_PUBLIC_CONCIERGE,
    tenant_id: str = "default",
) -> Optional[dict]:
    """
    Returns {"text": str, "tool_calls": [{name, args, result}, ...]} or None on failure.
    Single-round tool use: Claude proposes tools, we run them, send results back, get final answer.
    """
    if not _anthropic_key():
        return None
    try:
        import httpx  # type: ignore
    except ImportError:
        return None

    persona_note = (
        "Adopt the 'Mr. Worden Sales' persona: warm, energetic, closing-oriented, "
        "Richmond-Virginia paving expert."
        if persona == "MR_WORDEN_SALES"
        else "Maintain the JARVIS persona."
    )
    state_note = (
        f"Current autonomy: master={autonomy.get('master')}, "
        f"frozen={autonomy.get('frozen')}, "
        f"operator_confirmed={confirmed}, "
        f"session_role={role}, "
        f"tenant_id={tenant_id}."
    )
    advisory_context = _build_advisory_context(query)
    advisory_note = ""
    if advisory_context:
        advisory_note = (
            "\nLEGAL ADVISORY RESPONSE REQUIREMENTS:\n"
            "- Treat outputs as advisory guidance only, not legal advice.\n"
            "- Use code_search/open_file only when user asks for citations, row-level proof, or change diffs.\n"
            "- Format legal answers with sections: Advisory Answer, Impact, Verification Needed.\n"
            f"{advisory_context}\n"
        )

    system = f"{JARVIS_SYSTEM_PROMPT}\n\n{persona_note}\n{state_note}{advisory_note}"

    headers = {
        "x-api-key":         _anthropic_key(),
        "anthropic-version": _ANTHROPIC_VERSION,
        "content-type":      "application/json",
    }
    messages: list[dict] = [{"role": "user", "content": query}]
    tool_calls: list[dict] = []

    tools = _toolset_for_session(confirmed=confirmed, role=role)

    # Two-round max: initial → optional tool use → final.
    for _round in range(2):
        try:
            default_tokens = 420 if _low_cost_mode() else 2400
            max_tokens = int((_cfg.get("JARVIS_CLAUDE_MAX_TOKENS") or str(default_tokens)).strip())
        except Exception:  # noqa: BLE001
            max_tokens = 420 if _low_cost_mode() else 2400
        payload = {
            "model":      _anthropic_model(),
            "max_tokens": max_tokens,
            "system":     system,
            "tools":      tools,
            "messages":   messages,
        }
        try:
            try:
                timeout_s = float((_cfg.get("JARVIS_CLAUDE_TIMEOUT_SECONDS") or "14").strip())
            except Exception:  # noqa: BLE001
                timeout_s = 14.0
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                r = await client.post(_ANTHROPIC_URL, json=payload, headers=headers)
            if r.status_code != 200:
                logger.warning("[JARVIS] Anthropic non-200: %s %s", r.status_code, r.text[:300])
                return None
            data = r.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("[JARVIS] Anthropic call failed: %s", exc)
            return None

        stop_reason = data.get("stop_reason")
        content = data.get("content") or []

        if stop_reason == "tool_use":
            # Append assistant turn, then run each tool, then append tool_result message.
            messages.append({"role": "assistant", "content": content})
            tool_results = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    name = block.get("name", "")
                    args = block.get("input", {}) or {}
                    result = await _run_tool(name, args, confirmed=confirmed, role=role, tenant_id=tenant_id)
                    tool_calls.append({"name": name, "args": args, "result": result})
                    tool_results.append({
                        "type":         "tool_result",
                        "tool_use_id":  block.get("id"),
                        "content":      str(result)[:4000],
                    })
            messages.append({"role": "user", "content": tool_results})
            continue  # next round to get the natural-language answer

        # End_turn or anything else — extract text.
        text = "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text").strip()
        return {"text": text or "(no response)", "tool_calls": tool_calls}

    return {"text": "(tool loop exceeded)", "tool_calls": tool_calls}


class JarvisAI:
    """
    JARVIS: Just A Rather Very Intelligent System for JWORDENAI.
    The primary interface for the Command Center.
    Capable of voice-commanded logistics, autonomous paving arbitration, and project funding status.
    """
    
    def __init__(self):
        self.identity = "JARVIS"
        self.master_project = "JWORDENAI PROJECT"
        self.status = "ONLINE"
        self.intel_sources = [
            "Federal Highway Administration (FHWA)",
            "AASHTO Engineering Standards",
            "State DOT Regulatory Guides",
            "University Civil Engineering Research Lab",
            "Global Infrastructure Council",
            "Supreme Court Construction Precedents",
            "50-State + DC Mechanic's Lien & Prompt Pay Codes",
            "National GC Compliance Matrix",
            "Universal Construction Supply Chain Index (Concrete/Steel/Wood/Shingles)",
            "Asphalt & Bitumen Global Resource Monitor",
            "Raw Land & Aggregate Availability Matrix",
            "Carbon-Neutral & LEED v5 Paving Standards",
            "International Trade & Maritime Construction Law",
            "51-State Licensing & Prequalification Databank",
            "OCIP/CCIP Insurance Compliance Protocols",
            "DBE/SWaM/SDVOSB Regulatory Guardrails",
            "Global Banking & Treasury Management APIs",
            "Currency Hedging & Cross-Border Settlement Protocols",
            "Construction Commodities Market (Liquid Asphalt/Crude Oil) Index",
            "Venture Debt & Equity Financing Logic for PF Nodes",
            "Virginia SEO Domination & Local SEM Metrics",
            "JWORDENAI Page Factory Conversion Evidence",
            "Case Study Asset Tracker (Richmond/Midlothian/Virginia Beach)"
        ]
        self.personas = {
            "JARVIS": {
                "greeting": "At your service, Sir.",
                "style": "Sophisticated, helpful, technical, and lifestyle-oriented."
            },
            "MR_WORDEN_SALES": {
                "greeting": "Hey there! Ready to get some paving done?",
                "style": "Energetic, persuasive, industry-expert salesman. Focused on value, durability, and closing deals."
            }
        }

    async def converse(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        The main interaction point for the Command Center.
        A unified intelligence engine combining Lifestyle, Business Events, 
        Global Education, Federal Standards, and Supreme Court Legal Logic.
        """
        context = context or {}
        persona = context.get("persona", "JARVIS")
        confirmed = bool(context.get("confirmed", False))
        role = str(context.get("role") or "").strip()
        if not role:
            role = ROLE_OWNER_ROOT if bool(context.get("operator_mode", False)) else ROLE_PUBLIC_CONCIERGE
        tenant_id = str(context.get("tenant_id") or "default")
        operator_mode = role in {ROLE_STAFF_OPERATOR, ROLE_OWNER_ROOT}
        if role == ROLE_PUBLIC_CONCIERGE:
            confirmed = False
        query_lower = (query or "").lower()

        # ── Defense-in-depth: backend kill switch ─────────────────────────────
        state = autonomy_state.get_state()
        if state.get("frozen"):
            return {
                "source": self.identity,
                "message": (
                    "Sir, autonomy is currently FROZEN by the Command Center kill switch. "
                    "I can answer questions, but I will not take any autonomous action "
                    f"until you unfreeze me. (Frozen since {state.get('frozenAt')})"
                ),
                "action_required": False,
                "frozen": True,
                "intel_tier": "Safety-Override",
            }

        # ── Fast lane: human-like conversational responses without tool overhead ──
        # First, see if this user intent maps to a multi-step plan.
        plan = _planner.plan(query, {"run_npm": True, "code_search": True, "open_file": True})
        if plan and plan.get("intent") == "execute":
            if not operator_mode:
                return {
                    "source": self.identity,
                    "message": "I can help answer and search, but task execution is available only in Command Center operator sessions.",
                    "action_required": False,
                    "requires_operator_mode": True,
                }

            # If operator has not confirmed, return the proposed plan for approval.
            if not confirmed:
                return {
                    "source": self.identity,
                    "message": "I have prepared an action plan. Confirm to execute.",
                    "requires_confirmation": True,
                    "plan": plan,
                    "action_required": True,
                }
            # Operator confirmed — execute sequentially and return results.
            exec_results = []
            for step in plan.get("steps", []):
                name = step.get("action")
                args = step.get("args") or {}
                # determine whether this action requires confirmation (destructive/real-world)
                must_confirm = name in ("run_npm", "make_phone_call", "send_email")
                if must_confirm and not confirmed:
                    exec_results.append({"action": name, "ok": False, "error": "requires confirmation"})
                    continue
                try:
                    res = await _run_tool(name, args, confirmed=confirmed, role=role, tenant_id=tenant_id)
                except Exception as exc:
                    res = {"ok": False, "error": str(exc)}
                exec_results.append({"action": name, "result": res})

            # Synthesize a response summarizing execution
            summary_lines = []
            for r in exec_results:
                act = r.get("action")
                out = r.get("result") or r.get("error") or r
                ok = out.get("ok") if isinstance(out, dict) else False
                summary_lines.append(f"{act}: {'OK' if ok else 'FAILED'}")

            return {
                "source": self.identity,
                "message": "Execution complete.\n" + "\n".join(summary_lines),
                "action_required": False,
                "plan_executed": True,
                "exec_results": exec_results,
            }

        action_intent = _looks_like_tool_action(query)
        cache_key = None
        if _is_cacheable_query(query, action_intent=action_intent):
            cache_key = _response_cache_key(query, persona, role, confirmed)
            cached = _response_cache_get(cache_key)
            if cached:
                return cached

        if not action_intent:
            # Prefer the human-like chat brain for conversational queries.
            chat = await _ask_chat_brain(query, persona, state, session_id=context.get("session_id"), confirmed=confirmed)
            if chat:
                response = {
                    "source": self.identity if persona != "MR_WORDEN_SALES" else "Mr. Worden (Sales)",
                    "message": chat["text"],
                    "action_required": False,
                    "engine": f"{chat['provider']}-chat",
                    "model": chat["model"],
                    "fallback_used": chat.get("fallback_used", False),
                    "tool_calls": [],
                    "autonomy": {"master": state.get("master"), "frozen": False},
                }
                _response_cache_set(cache_key, response)
                return response
            # fallback to a faster ops-focused lane if chat brain did not return
            fast = await _ask_fast_ops_brain(query, persona, state, confirmed=confirmed)
            if fast:
                response = {
                    "source": self.identity if persona != "MR_WORDEN_SALES" else "Mr. Worden (Sales)",
                    "message": fast["text"],
                    "action_required": False,
                    "engine": f"{fast['provider']}-stark-fast",
                    "model": fast["model"],
                    "fallback_used": fast["fallback_used"],
                    "tool_calls": [],
                    "autonomy": {"master": state.get("master"), "frozen": False},
                }
                _response_cache_set(cache_key, response)
                return response

        # ── Brain: Anthropic Claude (when configured) ─────────────────────────
        claude = await _ask_claude(query, persona, state, confirmed=confirmed, role=role, tenant_id=tenant_id)
        if claude:
            response = {
                "source":          self.identity if persona != "MR_WORDEN_SALES" else "Mr. Worden (Sales)",
                "message":         claude["text"],
                "action_required": False,
                "engine":          "anthropic-claude",
                "model":           _anthropic_model(),
                "tool_calls":      claude["tool_calls"],
                "autonomy":        {"master": state.get("master"), "frozen": False},
            }
            _response_cache_set(cache_key, response)
            return response

        # ── Fallback: legacy heuristic responses ──────────────────────────────
        if persona == "MR_WORDEN_SALES":
            return await self._converse_mr_worden_sales(query_lower, context)

        # ── Unified Intelligence Harmonization ─────────────────────────────────
        # This catch-all block synthesizes all available logic layers.
        intel_report = f"Sir, I have synthesized the current request against our integrated nodes: {', '.join(self.intel_sources)}. "

        # weather / news / financial trends / supply chain / SEO
        # Weather / market / SEO.
        #
        # This branch used to return a fixed "REAL-TIME SEO DOMINATION REPORT"
        # claiming #1 rankings were being actively defended, reserves were
        # optimised and Virginia demand was strong — none of it measured. It was
        # also the first branch checked, so the word "weather" alone triggered an
        # SEO ranking claim. Real rankings come from Search Console, real
        # conditions from paving_forecast; neither is reachable here.
        if any(w in query_lower for w in ["weather", "forecast", "news", "trend", "market", "finance", "bank", "money", "capital", "revenue", "income", "commodity", "material", "supply", "concrete", "shingle", "asphalt", "aggregate", "stone", "seo", "rank", "google", "search", "virginia", "marketing", "sealcoat", "sealcoating"]):
            return {
                "source": self.identity,
                "message": (
                    "My reasoning engine is unreachable, so I can't run the weather model, "
                    "check rankings or read live market data right now — and I won't "
                    "estimate any of them from memory. Try again shortly; if you need "
                    "paving conditions today, the forecast tools come back with me."
                ),
                "action_required": False,
                "degraded": True,
            }

        # Business events context.
        #
        # This branch used to answer with a fixed sentence reporting "a new
        # estimate in Richmond and a $4,500 cleared payment in Midlothian" —
        # numbers that were never read from anywhere. /chat is public and this
        # lane runs whenever the model call fails, so an Anthropic outage was
        # enough to have Jarvis report a fabricated payment to a customer as
        # fact. Real figures come from get_money_position and get_leads; when
        # the brain is unreachable the honest answer is that it is unreachable.
        if any(w in query_lower for w in ["update", "status", "recent", "happen", "estimate", "payment"]):
            return {
                "source": self.identity,
                "message": (
                    "I can't reach my reasoning engine right now, so I won't guess at "
                    "numbers. Live estimates, payments and pipeline status are on the "
                    "Command Center dashboard, and I'll pull them myself as soon as I'm "
                    "back. If this is urgent, call the office directly."
                ),
                "action_required": False,
                "degraded": True,
            }

        # Legal & education context
        if any(w in query_lower for w in ["education", "learn", "legal", "law", "supreme", "compliance", "standard", "research", "carbon", "green", "maritime", "guardrail", "license", "insurance", "bond"]):
            return {
                "source": self.identity,
                "message": (
                    f"{intel_report}\n\n"
                    "ADVISORY ANSWER:\n"
                    "Using our 51-jurisdiction advisory matrix (50 states + DC), I can give an operations-grade legal/compliance answer for licensing, civil risk, and safety posture.\n\n"
                    "IMPACT:\n"
                    "- Scope, schedule, and cost shift when licensing, wage, OSHA, lien, or utility constraints differ by jurisdiction.\n"
                    "- Bid strategy and risk controls should be state-specific before commitment.\n\n"
                    "VERIFICATION NEEDED:\n"
                    "- Treat this as advisory guidance, not legal advice.\n"
                    "- Confirm jurisdiction-specific statutes and permit terms before execution."
                ),
                "action_required": False,
                "intel_tier": "Supreme-Unified-Global"
            }

        # Catch-all synthesis
        return {
            "source": self.identity,
            "message": f"Understood, Sir. {intel_report}\n\nI am monitoring all lifestyle, business, and legal systems. How would you like to scale the world today?",
            "action_required": False,
        }

    async def _converse_mr_worden_sales(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Salesman Mr. Worden Persona Logic.
        Upgraded to report on actual business events (Estimates, Payments).
        """
        # Event Report Logic.
        #
        # The previous version announced a specific new Richmond estimate and a
        # cleared $4,500 Midlothian payment, with a matching `data.recent_events`
        # payload — all of it hardcoded and none of it read from the database.
        # The comment above it said "simulate fetching ... in a real scenario",
        # which is fine in a prototype and dangerous once /chat is public and
        # unauthenticated. A visitor asking "any update?" during a model outage
        # was told about a payment that may never have existed.
        if any(w in query for w in ["update", "status", "estimate", "payment", "notification"]):
            return {
                "source": "Mr. Worden (Sales)",
                "message": (
                    "I'm running on a backup line at the moment and I'd rather give you "
                    "nothing than give you the wrong number. Give the office a call and "
                    "we'll pull your estimate or payment status up on the spot."
                ),
                "action_required": False,
                "degraded": True,
            }

        if any(w in query for w in ["price", "cost", "quote", "deal"]):
            return {
                "source": "Mr. Worden (Sales)",
                "message": "Listen, we're not just talkin' about blacktop here. We're talkin' about an investment in your property's curb appeal. I can get you a quote that'll make your neighbors jealous. Quality pavin' doesn't cost, it pays!",
                "action_required": True,
                "suggested_action": "Generate Quote"
            }
        
        if any(w in query for w in ["why", "better", "quality", "durability"]):
            return {
                "source": "Mr. Worden (Sales)",
                "message": "Why choose Worden? Simple. We use the highest quality mix, the heaviest rollers, and we don't cut corners. Your driveway will be the talk of Virginia for years to come. Ready to sign?",
                "action_required": False
            }

        if any(w in query for w in ["hello", "hi", "hey"]):
            return {
                "source": "Mr. Worden (Sales)",
                "message": "Hey! Mr. Worden here. I've been lookin' at your project and I'm tellin' you, we can make this look incredible. What can I do to earn your business today?",
                "action_required": False
            }

        return {
            "source": "Mr. Worden (Sales)",
            "message": "I'm ready to close this deal. Tell me what you're lookin' for, and I'll make sure the crew does it right. We're the best in the business!",
            "action_required": False
        }

jarvis = JarvisAI()
