# AGENTS.md — codexbuildfreeofbase44 (jworden-api backend)

This is the live FastAPI backend for J. Worden & Sons' JWordenAI platform,
deployed at `jworden-api.fly.dev`. It is licensed out to other contractors
as a multi-tenant SaaS product ("JWordenAI"), so bugs and fabricated data
here have real customer and revenue impact, not just internal cost.

## The one rule that matters most: never fabricate data

This codebase has, across many past sessions, accumulated code that
returns invented data — fake dollar amounts, fake "compliance passed"
claims, fake review testimonials attributed to real client names, fake
"live" statuses with nothing behind them — presented indistinguishably
from real results. Several of these reached production before being
caught. If you are an AI agent working on this repo, the following is
not a style preference, it is a hard requirement:

1. **Every API response that isn't backed by a real DB query or a real
   external API call must say so.** Use `"source": "live"` only when the
   function actually performed a live call in that request. Otherwise use
   `"source": "stub"`, `"verified_static"`, or `"degraded"` — and make the
   returned data honestly reflect that (empty, or a clearly-real static
   dataset, never an invented one).
2. **Never write a fallback that invents a plausible-sounding fact** —
   a dollar amount, a ranking position, a compliance result, a customer
   name. When real data isn't available, the correct response is "no
   data" or "I don't know," not a guess dressed up as an answer. This
   applies to LLM system prompts too: instruct the model to say it
   doesn't know rather than fill gaps with invented specifics.
3. **Before adding a new capability, check whether it already exists.**
   Grep the routers/services for the feature first. Past sessions have
   repeatedly built duplicate, half-working versions of things that
   already worked, because nobody checked. `git log`, `grep -rn`, and
   actually reading the file beat assuming.
4. **Run `python scripts/guard_no_fabrication.py` before you're done.**
   It's also wired into CI (`.github/workflows/ci.yml`, backend job) and
   will fail the build on: `random.*()` calls fabricating a value outside
   an explicitly-labeled mock/demo context, a `"source": "live"` claim in
   a file with no real data call anywhere in it, and leftover
   `TODO`/`FIXME` in shipped router/service code. If it flags a genuine
   false positive, fix it with an inline `# guard: allow (reason)`
   comment explaining why — not by loosening the script's rules.
5. **When you find fabricated data already in the codebase, fix it, don't
   just flag it and move on** — especially anything customer-facing
   (reviews, SEO claims, business metrics shown to a tenant).

## Conventions specific to this file

- `app/models.py` uses flat columns only — no `ForeignKey`, no
  `relationship()`. Follow the existing style (see e.g. `Tenant`,
  `DrivewayCampaignPiece`) rather than introducing ORM relationships.
- Config keys the admin UI can manage live in
  `app/services/runtime_config.py`'s `MANAGED_KEYS` — a key not in that
  tuple can't be set from the UI at all. Register new ones there, and add
  real secrets to `SENSITIVE_KEYS` too.
- Premium/owner-tier auth uses `verify_premium_security` from
  `app.core.security` (bearer: master key or JWT). Owner-only admin
  endpoints use `_require_owner` from `app.routers.admin_integrations`.
  Match whichever pattern the surrounding router already uses.
- File storage should go through `durable_data_dir()` in
  `app/services/durable_storage.py`, not a hardcoded `/tmp` path — Fly's
  ephemeral filesystem loses `/tmp` on every redeploy.
