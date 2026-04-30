# SEO — Next Steps

This file tracks the SEO/Google work agreed in the Phase 1 plan. Items in
**this PR** are checked. Everything below is queued for follow-up PRs and
intentionally not bundled here because each one is either a multi-day
refactor, depends on external API keys, or is an ongoing content cadence.

## ✅ Phase 1 — done in this PR

- [x] **Centralized NAP** in `src/lib/businessInfo.js`. Footer + all schema
      now read from this one module. Added missing `streetAddress` and
      `postalCode` to `LocalBusiness` schema.
- [x] **Reconciled social URL drift.** `SOCIAL_PROFILES` defaults updated
      to the live URLs the Footer was hardcoding. Footer now sources from
      `SOCIAL_PROFILES` so JSON-LD `sameAs` matches the visible profile
      links Google crawls.
- [x] **Sitemap is now data-driven.** `vite.config.js` imports city slugs
      from `src/data/serviceAreas.js` and blog slugs from
      `src/data/blogPosts.js` — no more parallel hand-maintained arrays.
      Added missing `/visualizer`, `/gallery`, `/jwordenai` routes.
      Stale `public/sitemap.xml` removed (it was overwritten by
      `vite-plugin-sitemap` at build anyway and was misleading at dev time).
- [x] **`Organization` schema** with explicit `@id` (brand-level entity
      URI) injected on Home so Google has a single, stable brand node to
      bind a Knowledge Panel to.
- [x] **`WebSite` + `SearchAction`** injected on Home — qualifies the
      homepage for Google's Sitelinks Search Box.
- [x] **`Person` (founder) schema** injected on `/about` for E-E-A-T,
      `worksFor` → LocalBusiness `@id`.
- [x] **`@id` cross-references** added to LocalBusiness, Organization,
      WebSite, and Person so Google merges the entities correctly.
- [x] **`public/llms.txt`** — curated brand summary so ChatGPT,
      Perplexity, Claude, and Gemini cite the business consistently.

## ⬜ Phase 1 — deferred (recommended next PR: SSG migration)

The plan called for adopting prerendering / SSG so every route ships as
static HTML. **Not done in this PR — deserves its own PR.** Reasoning:

- The site is a `react-router-dom` v6 SPA with 30+ routes, lazy-loaded
  pages, dynamic city/state/blog routes, and `react-helmet-async` for meta.
- Migrating to a prerender pipeline touches `index.html`, `main.jsx`,
  `vite.config.js`, every route, and the deploy config.
- It needs a focused PR with route-by-route HTML diff verification and
  Lighthouse before/after. Bundling it with the schema work would make
  this PR untestable.

### Recommended approach when we tackle it

1. **First choice:** [`vite-ssg`](https://github.com/antfu-collective/vite-ssg)
   — stays in Vite, minimal changes to `main.jsx`, can crawl routes and
   emit per-route HTML at build. Works with `react-router-dom` and
   `react-helmet-async`.
2. **Alternative:** migrate to Next.js App Router. Bigger lift, but
   unlocks ISR, server-side image optimization, edge caching, and proper
   server-rendered meta. Recommended only if we also want server-rendered
   admin/CC routes or are otherwise ready to leave Vite.
3. **Quick win without migration:** add
   [`vite-plugin-prerender`](https://github.com/Tsyklop/vite-plugin-prerender)
   or `react-snap` and prerender just the top-priority public routes
   (`/`, `/services`, `/service-areas/*`, `/about`, `/contact`,
   `/blog/*`). Doesn't touch dynamic pages but covers 80% of the SEO win.

We should pick (1) as the default unless the user wants Next.js.

## ⬜ Phase 2 — Local Pack & content depth

Requires Google Business Profile API key + content cadence.

- [ ] Audit every `CityPage` for ≥600 words of unique copy, embedded map,
      geo-tagged photos, named neighborhoods.
- [ ] Wire GBP Reviews API → backend cache → Home review carousel.
- [ ] Post-job review-request automation (backend + SMS/email).
- [ ] GBP Posts cadence script (Gemini-grounded weekly draft → human
      approve → GBP API push).

## ⬜ Phase 3 — Performance pass

- [ ] Code-split Three.js / Visualizer behind the `/visualizer` route.
- [ ] Split the 1.5 MB vendor chunk by route (already partially done in
      `vite.config.js` `manualChunks` — verify and tighten).
- [ ] Convert hero images to AVIF/WebP with `<picture>` + `srcset`.
- [ ] Verify `FloatingCTA` is on every commercial-intent page; add a
      sticky mobile call bar on city pages.

## ⬜ Phase 4 — Telemetry

- [ ] GA4 events for the full quote funnel + phone / directions / CTA clicks.
- [ ] Search Console + GA4 linked.
- [ ] Weekly automated SERP rank report (DataForSEO or SerpApi).

## ⬜ Phase 5 — Multi-provider AI layer (backend only)

- [ ] `backend/providers/` with OpenAI + Gemini + (optional) Claude / Grok
      adapters behind one interface. Frontend never sees provider keys.
- [ ] Move existing `/api/v1/ai/*` endpoints onto the abstraction.
- [ ] Content pipeline: Gemini-grounded brief → Claude long-form draft →
      GPT-4o schema/QA pass → human review → publish.
- [ ] GBP automation: weekly Gemini-grounded Posts/Q&A draft → human
      approve → GBP API push.
- [ ] Surface all of this inside `/command-center`.

## Provider strategy summary

- **OpenAI** — internal ops, JWORDENAI™ backend, build-time content QA.
- **Google Gemini** — SEO content (Search-grounded), GBP Posts, schema
  validation. Note: using Gemini does **not** boost Google rankings;
  it's useful because of its Search grounding, not brand affinity.
- **Anthropic Claude** — long-form blog writing, careful legal advisory
  drafting, large-context coding assistance.
- **xAI Grok** — only if we commit to active X/Twitter presence.
- **Perplexity** — competitive intelligence and AI-overview-style briefs.

Never inject provider keys into the frontend bundle. Always go through a
backend abstraction.
