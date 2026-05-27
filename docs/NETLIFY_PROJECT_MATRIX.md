# Netlify Project Matrix

Purpose: maintain one operational map of Netlify projects, domain roles, and guard expectations so cross-repo work does not drift.

Snapshot source: owner-shared Netlify dashboard inventory (May 2026).

## Projects

| Netlify Project | Domain / URL | Role | Deploy Model | Repository Source | Last Published (owner snapshot) | Required Guardrails Before Cross-Repo Changes |
| --- | --- | --- | --- | --- | --- | --- |
| jwordenuniversity.com | jwordenuniversity.com | Training academy / LMS | Deploys from GitHub | jwordenaii/wordenuniversity | 8:56 PM (most recent in list) | Contract check: `npm run guard:wordenuniversity-contract` in main ops repo |
| app.jwordenasphaltpaving.com | app.jwordenasphaltpaving.com | App surface (operational) | Deploys from GitHub | TBD (confirm exact repo) | 5:34 PM | Domain + tenant safety checks before routing or auth changes |
| [www.jwordenasphaltpaving.com](https://www.jwordenasphaltpaving.com) | [www.jwordenasphaltpaving.com](https://www.jwordenasphaltpaving.com) | Public primary paving site | Deploys from GitHub | This repo: codexbuildfreeofbase44 (working assumption; verify in Netlify UI when critical) | 11:59 AM | `npm run gate:deploy-premium` |
| jwordenlaunch1 | Netlify subsite (custom domain TBD) | Launch/staging/funnel project | Deploys from GitHub | TBD | May 22 | Confirm domain + source repo before shared asset or env var changes |
| atlantaasphaltpavingpros.com | atlantaasphaltpavingpros.com | Market site | Deploys from GitHub | TBD | May 22 | Site-isolation + sitemap safety checks when shared templates change |
| minnesotaasphaltpaving.com | minnesotaasphaltpaving.com | Market site | Deploys from GitHub | This repo site-factory profile and/or standalone repo (confirm in Netlify UI) | May 20 | Tenant contract drift + tenant authority checks |
| thewordenstandard.com | thewordenstandard.com | Internal operations hub | Deploys from GitHub | This repo (operations routes) | May 16 | Operations route isolation + advisory/internal auth boundaries |
| carolinablacktop.com | carolinablacktop.com | Market site | Deploys from GitHub | TBD | May 22 | Site-isolation + sitemap safety checks |
| obxpaving | OBX property (domain alias TBD) | Market site | Deploys from GitHub | This repo profile and/or standalone repo (confirm in Netlify UI) | May 20 | Tenant contract drift + site-isolation checks |

## Operating Rules

1. Treat this file as deploy topology truth for planning and incident response.
2. Mark unknowns as `TBD`; do not infer repo ownership from domain name.
3. Before changing env vars, auth, redirects, or shared content templates:
   - Verify Netlify project -> GitHub repo link in dashboard.
   - Run the relevant guard chain in the owning repo.
4. For Worden University integration, enforce the published contract:
   - `.well-known/worden-contract.json` in the University repo.
   - `guard:wordenuniversity-contract` in this repo.

## Deployment Ownership Policy

To prevent source drift and stale-route incidents, each Netlify project must use one explicit deployment owner:

- `git-integration`: Netlify deploys from linked GitHub repo/branch.
- `cli`: GitHub Actions deploys via Netlify CLI using site/token secrets.

Never run both models implicitly for the same production domain. The owning mode must be documented and reviewed whenever deploy behavior changes.

## Update Trigger

Update this matrix whenever one of these changes:

- Netlify project added/removed/renamed.
- Domain attached/detached.
- GitHub repo source changes.
- Guardrail command chain changes.
