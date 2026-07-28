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
