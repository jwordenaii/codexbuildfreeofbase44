# Repository Index — J. Worden & Sons / JWordenAI

Generated 2026-07-28 by inspecting every repository in the working set. This
file exists because the same inventory had been requested several times and
re-derived from scratch each time. If it goes stale, regenerate it rather than
guessing.

## The headline finding: three copies of the backend

`app/services/jarvis.py` exists in three repositories, all different:

| repo | jarvis.py | routers | services | deploy target (verified) |
|---|---|---|---|---|
| `codexbuildfreeofbase44` | **1,675 lines** | 92 | 87 | Fly.io — `jworden-api` |
| `jworden-production` | **1,165 lines** | 104 | 93 | Vercel — frontend only; backend unused |
| `wordenstandard` | **903 lines** | — | — | Netlify — `thewordenstandardcom` |

Different MD5s, different line counts, different behaviour. `jworden-production`
carries *more* routers (104) but an *older* Jarvis. A fix applied to one is
absent from the other two.

**Canonical backend: `codexbuildfreeofbase44`.** It is the one Fly serves at
`https://jworden-api.fly.dev`, confirmed by deploying to it and reading
`/api/v1/jarvis/readiness` back. The other two are forks that diverged.

**Canonical frontend: `jworden-production`.** It is the one Vercel serves at
`https://www.jwordenasphaltpaving.com`, confirmed by `server: Vercel` response
headers and by watching sitemap changes from this repo appear live.

## The frontend twin

`gemini2` and `spacexgeminijworden` share **296 files** and carry identical
`CLAUDE.md` and `AGENTS.md`. Both describe themselves as the live marketing
site, on TanStack Router with Netlify Functions. Neither is live —
`jworden-production` (React Router, Vercel) is. `gemini2`'s package name is
`react-example`.

Those two stale docs are the reason agent sessions kept being told the stack
was Netlify + TanStack when production is Vercel + React Router.

## Netlify projects (5, all on a paid `nf_team_pro` team)

Verified by reading each project's current deploy record:

| Netlify project | source repo | branch | last published | notes |
|---|---|---|---|---|
| `wordenproduction` | `genewgeorge76/jworden-production` | main | **2026-06-09** | Holds `www.jwordenasphaltpaving.com` as primary URL and serves `main.jwordenandsonspaving.com`. 6 functions live incl. `chat-lead-capture`, `estimate-request` — a seven-week-old build that can still take customer leads. |
| `thewordenstandardcom` | `jwordenaii/wordenstandard` | main | 2026-05-16 | 12 functions, 2 cron schedules (`health-monitor` every 30 min, `scheduled-ingest` daily). |
| `gorgeous-tarsier-417c66` | `jwordenaii/codexbuildfreeofbase44` | — | — | Posts deploy previews on that repo's PRs. Primary URL `app.jwordenasphaltpaving.com` (does not resolve). |
| `jwordenuniveristy` *(sic)* | — | — | — | Primary URL `jwordenuniversity.com`. |
| `jwordenlaunch1` | — | — | — | `jwordenlaunch1.netlify.app`. |

Live traffic for `www.jwordenasphaltpaving.com`, `thewordenstandard.com` and
`jwordenuniversity.com` is served by **Vercel**, not Netlify — checked via
response headers. The Netlify copies are dormant but still published, still
holding domains, and still running scheduled functions.

## Full inventory

| repo | origin | files | last commit | stack | router | deploy cfg | backend .py | src files |
|---|---|---|---|---|---|---|---|---|
| `NewRepo` | genewgeorge76/NewRepo | 202 | 2026-07-25 | node | none | vercel | 0 | 0 |
| `atlantapavingandsealing` | jwordenaii/atlantapavingandsealing | 29 | 2026-05-11 | ? | none | netlify | 0 | 0 |
| `blueridgeasphaltpaving` | genewgeorge76/blueridgeasphaltpaving | 72 | 2026-06-17 | node | none | none | 0 | 26 |
| `carolinablacktop` | jwordenaii/carolinablacktop | 0 |  | ? | none | none | 0 | 0 |
| `codexbuildfreeofbase44` | jwordenaii/codexbuildfreeofbase44 | 1448 | 2026-07-28 | node+python | react-router-dom | netlify | 207 | 314 |
| `doooone` | genewgeorge76/doooone | 729 | 2026-05-27 | ? | none | netlify | 0 | 0 |
| `gemini2` | genewgeorge76/gemini2 | 301 | 2026-07-25 | node | none | netlify | 0 | 196 |
| `googlebuiltoperatingsystem-` | genewgeorge76/googlebuiltoperatingsystem- | 26 | 2026-06-22 | node | none | none | 0 | 12 |
| `jworden-jarvis-os` | genewgeorge76/jworden-jarvis-os | 359 | 2026-07-25 | ?+python | none | vercel | 0 | 0 |
| `jworden-production` | genewgeorge76/jworden-production | 3371 | 2026-07-28 | node | react-router-dom | vercel | 395 | 360 |
| `jwordenasphaltantigravity` | genewgeorge76/jwordenasphaltantigravity | 607 | 2026-07-24 | node | none | none | 0 | 50 |
| `jwordenasphaltpaving2` | genewgeorge76/jwordenasphaltpaving2 | 80 | 2026-07-25 | node | none | netlify | 0 | 0 |
| `next-platform-starter` | genewgeorge76/next-platform-starter | 54 | 2026-02-23 | node/next | none | netlify | 0 | 0 |
| `obxpaving-` | jwordenaii/obxpaving- | 49 | 2026-07-25 | node | react-router-dom | netlify | 0 | 33 |
| `spacexgeminijworden` | genewgeorge76/spacexgeminijworden | 310 | 2026-07-25 | node | react-router | netlify | 0 | 206 |
| `wordenstandard` | jwordenaii/wordenstandard | 1391 | 2026-07-25 | node+python | react-router-dom | netlify | 198 | 337 |
| `wordenuniversity` | jwordenaii/wordenuniversity | 16 | 2026-05-25 | node | none | netlify | 0 | 5 |
## Reading the table

- **deploy cfg** is which config file is present, not where it actually
  deploys. Eleven of seventeen repos carry a `netlify.toml`; two are actually
  served by Netlify today.
- **backend .py** counts files under `app/`. Only three repos have one.
- `carolinablacktop` has 0 tracked files — an empty repository.

## What is NOT resolved

- Which repo `jwordenuniveristy` and `jwordenlaunch1` build from. The Netlify
  API exposes it per-deploy; those two were not queried.
- Whether Netlify hosts the **DNS zone** for `jwordenasphaltpaving.com` as well
  as the site. This decides whether deleting `wordenproduction` is safe.
  Check Netlify → Domains before deleting anything.
- `jwordenandsonspaving.com` was unreachable from the audit environment.
  It is served by the June 9 `wordenproduction` build; confirm in a browser.

---

# Complete inventory — all 17 repositories

Added after inventorying every repo individually. The headline finding changed
twice while doing this, which is the argument for having done it.

## Tier 1 — harvest before archiving (unique capability)

### `jworden-production` — the superset backend
104 routers (23,146 lines), 93 services (22,673), 66 tables, plus `jarvis_os`
(179 abilities, 10,024 lines). Frontend 90,286 lines across 360 files.
**Does not currently boot** — 3 missing modules (`geocoding`, `google_photos`,
`google_sheets`) referenced by 5 files. Four of those five are already fixed in
`codexbuildfreeofbase44`.
Also contains 10 embedded sub-sites and `scavenged-assets/` (584 files, 14
copied projects, including backend copy #5).

### `NewRepo` — 15 routers + 10 services that exist nowhere else
~4,945 lines, all real (no stubs), and disproportionately the licensable ones:

| module | lines / endpoints |
|---|---|
| `catalog.py` | 389 / 10 |
| `gantt.py` | 370 / 8 |
| `bim.py` | 318 / 8 |
| `saas_billing.py` | 316 / 8 |
| `quickbooks.py` | 216 / 5 |
| `client_portal.py` | 210 / 5 |
| `pavement_intel.py` | 526 |
| `parcel_service.py` | 217 |
| `property_vision.py` | 149 |

### `jworden-jarvis-os` — `client-dashboard/`
Standalone Next.js app, 9,289 lines, unique. Routes include `/real-estate`,
`/roofing`, `/saas-client`, `/fsm`, `/fleet`, `/legal`, `/spatial`,
`/visualizer`, `/jarvis-omni`. This is the multi-trade licensable shell,
already scaffolded.
Its 164 abilities are an identical set to production's copy, and production's
is equal-or-larger in all 64 that differ — nothing to harvest there.

### `doooone` — 533 job-site photographs
`work/imported/` carries real project photography (brick paver patio, KFC,
etc.) with Google Photos metadata, plus a compiled build. No source. This is
portfolio/catalog material, not a codebase.

### `jwordenasphaltantigravity` — dormant local SEO
Next.js, 25 Virginia city routes, `/insights` with 6 written articles, 540
image assets, 5,897 lines of src. No deploy config. The copy embedded in
`jworden-production/jworden-antigravity/` is a different, smaller build (53
files vs 607).

### `wordenstandard` — two files worth keeping
Backend copy #3 (88 routers, 86 services, 55 tables) — all subsets of
production. Unique: `app/routers/forecast.py` and
`src_wordenstandard/components/TheWordenStandard.tsx`. Everything else in its
13,944-line `src_wordenstandard/` already exists in `jworden-production`.

## Tier 2 — subsets, archive after Phase 1

| repo | verdict |
|---|---|
| `codexbuildfreeofbase44` | Currently deployed to Fly. 0 unique routers, 0 unique services, 0 unique tables. Its value is 6 files improved 2026-07-28: `jarvis`, `weather_service`, `short_memory`, `llm_client`, `tts_service`, `runtime_config`. |
| `gemini2` | Twin A. 296 files shared with spacexgeminijworden. Package name `react-example`. Source of the stale CLAUDE.md. |
| `spacexgeminijworden` | Twin B. TanStack Router, Netlify. |

## Tier 3 — small, single-purpose, or empty

| repo | files | code files | note |
|---|---|---|---|
| `blueridgeasphaltpaving` | 72 | 29 | Separate live Next.js site |
| `jwordenasphaltpaving2` | 80 | 3 | Assets and config only |
| `obxpaving-` | 49 | 35 | Also embedded in production as `obx-paving/` |
| `next-platform-starter` | 54 | 35 | Netlify's own boilerplate |
| `atlantapavingandsealing` | 29 | 0 | Static assets only; embedded in production too |
| `googlebuiltoperatingsystem-` | 26 | 14 | package name `dashboard` |
| `wordenuniversity` | 16 | 4 | Serves jwordenuniversity.com |
| `carolinablacktop` | **0** | 0 | **Empty repository** — but a domain and deploy project point at it |

## Backend copies — final count: five

| location | routers | models.py | jarvis.py |
|---|---|---|---|
| `jworden-production/app/` | 104 | 2,033 | 1,165 |
| `codexbuildfreeofbase44/app/` | 92 | 1,847 | **1,675** |
| `wordenstandard/app/` | 88 | 1,617 | 903 |
| `NewRepo/apps/api/app/` | 44 | 799 | — |
| `jworden-production/scavenged-assets/NewRepo/apps/api/app/` | 44 | 799 | — |

Schema is a clean nesting: production's 66 tables ⊃ codexbuild's 58 ⊃
wordenstandard's 55. Zero tables unique to codexbuild. Merging is additive.

Of 87 services shared between production and codexbuild, **78 are
byte-identical**. Only 9 differ. The divergence is small and fully understood.

## The plan this produces

1. **One backend.** Base on `jworden-production/app/`. Fix 3 imports, port the
   6 improved files from codexbuild, +8 tables, deploy to Fly. The SAM.gov bid
   hunter goes live.
2. **Harvest.** NewRepo's 25 unique modules, wordenstandard's 2 files.
   Then archive both, plus the twins and the duplicate backends.
3. **Product.** `client-dashboard` becomes the licensable frontend — it already
   has the trade routes. Wire to the one backend, finish `tenant_id`.
4. **Reclaim.** `doooone`'s 533 job photos into the catalog;
   `jwordenasphaltantigravity`'s 25 city pages + 6 articles into the SEO estate.

The conclusion worth stating plainly: **very little needs to be written.** What
is missing is one deployed backend and one wired frontend. Nearly everything
described as the product already exists in one of these repositories.
