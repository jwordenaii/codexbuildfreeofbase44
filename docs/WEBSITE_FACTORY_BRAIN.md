# Website Factory Brain

This repo is now structured as a central brain plus market satellites.

## Core Model

1. Brain layer (shared intelligence):
- auth, analytics, ops dashboards, AI workflows, media pipeline, pricing logic
- reusable UI system and build/deploy pipeline
- shared quality guards in CI

2. Site factory layer (market/category sites):
- profile and domain mapping in src/config/siteFactoryManifest.json
- route behavior selected by profile route mode
- market landing template for fast launch sites

3. Isolation layer (safety):
- guard:public-core (public routes stay public, internal stay gated)
- guard:site-isolation (factory route isolation patterns remain intact)
- guard:seo-readiness (title, description, canonical, robots tags in dist output)

## Route Modes

- full-site: complete site experience (primary domain)
- market-landing: isolated single-market route tree
- operations: internal operations and onboarding domain behavior

## Add A New Market Or Category Site

1. Add the profile and domain map:

node scripts/add-site-to-factory.mjs --key=texas --label="Texas Asphalt Paving" --domain=texasasphaltpaving.com --mode=market-landing --region="Texas" --metro="Dallas-Fort Worth"

2. Build and validate isolation:

npm run guard:public-core
npm run guard:site-isolation
npm run build
npm run guard:seo-readiness

3. Generate local SEO operations kit:

node scripts/create-seo-growth-kit.mjs --domain=texasasphaltpaving.com --brand="Texas Asphalt Paving" --city="Dallas" --region="Texas"

## One-Command Launch Pack

Use one command to create a site profile, generate SEO ops assets, and write keyword blogs:

npm run factory:launch-pack -- --site-key=texas --domain=texasasphaltpaving.com --label="Texas Asphalt Paving" --brand="Texas Asphalt Paving" --city="Dallas" --region="Texas"

Dry-run preview (no file writes):

npm run factory:launch-pack -- --site-key=texas --domain=texasasphaltpaving.com --label="Texas Asphalt Paving" --brand="Texas Asphalt Paving" --city="Dallas" --region="Texas" --dry-run=true

This command can include blog keywords:

npm run factory:launch-pack -- --site-key=texas --domain=texasasphaltpaving.com --label="Texas Asphalt Paving" --brand="Texas Asphalt Paving" --city="Dallas" --region="Texas" --keywords="dallas asphalt paving|dallas parking lot paving|texas sealcoating"

Or reuse keyword tracker CSV from the SEO growth kit:

npm run content:blog-writer -- --site-key=texas --keywords-csv=docs/seo-growth-kits/texasasphaltpaving-com/keyword-rank-tracker.csv

Dry-run keyword plan:

npm run content:blog-writer -- --site-key=texas --dry-run=true

## Standalone Repo Mode

Each created site can live in this monorepo *or* be scaffolded as its own independent git
repository — useful when a market site needs its own deployment pipeline, separate Netlify
project, or distinct GitHub team access.

### Create a site as its own repo

```bash
npm run factory:create-standalone-repo -- \
  --site-key=texas \
  --domain=texasasphaltpaving.com \
  --label="Texas Asphalt Paving" \
  --brand="Texas Asphalt Paving" \
  --city=Dallas \
  --region=Texas \
  --metro="Dallas-Fort Worth"
```

This outputs a complete React + Vite project to `../texas-market-site/` (sibling of this repo)
with:

- Its own `package.json`, `vite.config.js`, `tailwind.config.js`, `netlify.toml`
- `src/config/siteConfig.js` — all branding/copy baked in from CLI args
- `src/pages/MarketLanding.jsx` — standalone, no monorepo imports
- `src/components/SEO.jsx` — standalone SEO head manager
- `README.md` with Netlify deploy instructions
- `git init` + initial commit already applied

Optional flags:

```
--primary-color=#13283a   hex primary brand color
--accent-color=#f0b429    hex accent/CTA color
--phone=8044461296        contact phone number
--api-base-url=https://…  shared backend URL for lead capture
--ga-id=G-XXXXXXXXXX      Google Analytics 4 measurement ID
--out-dir=../my-dir       custom output directory (default: ../sitekey-market-site)
--dry-run=true            preview without writing files
```

After generation, push to a new GitHub repo and connect to Netlify:

```bash
cd ../texas-market-site
npm install
git remote add origin https://github.com/YOUR_ORG/texas-market-site.git
git push -u origin main
```

### One-command launch pack with standalone repo

Pass `--standalone-repo=true` to `factory:launch-pack` to combine site profile creation, SEO
kit generation, blog writing, *and* standalone repo scaffolding in one command:

```bash
npm run factory:launch-pack -- \
  --site-key=texas \
  --domain=texasasphaltpaving.com \
  --label="Texas Asphalt Paving" \
  --brand="Texas Asphalt Paving" \
  --city=Dallas \
  --region=Texas \
  --standalone-repo=true
```

Note: when `--standalone-repo=true`, the site profile is still added to the monorepo manifest
(for the shared backend and ops tooling). The standalone repo is an *additional* output —
a deployable, independent copy of the market-landing page.

## SEO + GBP + Backlink Operating System

For each launched domain, generate a growth kit under docs/seo-growth-kits/<domain> containing:

- GBP launch checklist
- citation submission tracker
- backlink outreach tracker
- keyword rank tracker
- review request templates

## Premium Add-On Revenue Stack

Catalog file:

site-blueprints/premium-addons-catalog.json

Pricing calculator:

npm run ops:pricing -- --addons=gbp-automation|keyword-blog-engine|backlink-authority-engine

List available premium add-ons:

npm run ops:pricing -- --list=true

## Production Discipline

1. Keep one canonical domain per market at launch.
2. Avoid splitting authority across thin microsites.
3. Add new domains only when content and operations capacity are ready.
4. Enforce CI guards before every release.
