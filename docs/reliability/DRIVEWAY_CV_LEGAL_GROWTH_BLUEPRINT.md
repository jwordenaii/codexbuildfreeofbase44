# Driveway CV Legal Growth Blueprint

## Objective

Build a hyper-scalable driveway estimation and lead pipeline that is accurate, automated, and legally compliant across all states.

## Strategic Position

This is a high-value PropTech module, but the moat depends on legal architecture as much as AI accuracy.

Core constraints:

1. No ToS-violating scraping of imagery providers.
2. No unsolicited SMS/email outreach from third-party PII enrichment.
3. Explicit consent capture before digital follow-up.

## Recommended Execution Path

Use a hybrid rollout:

1. Start with custom segmentation model as strategic primary for long-run unit economics.
2. Keep off-the-shelf extraction APIs as bootstrap and fallback path.
3. Promote region by region where custom model area error and latency meet release gates.

This gives fastest time-to-market with a controlled path to proprietary accuracy.

## Architecture

### 1. Computer Vision Estimation Pipeline

Inputs:

- High-resolution ortho imagery from approved APIs (Google Static Satellite API, Nearmap, EagleView).
- Parcel boundaries from GIS parcel providers.

Flow:

1. Retrieve top-down imagery by parcel centroid and validated bounds.
2. Detect driveway surface via semantic segmentation.
3. Produce driveway polygon and confidence score.
4. Compute area using map scale metadata.
5. Run pricing engine using local labor/material multipliers.

Outputs:

- `driveway_sqft`
- `surface_type`
- `estimate_low_mid_high`
- `confidence`
- `quality_flags`

### 2. Identity and Property Data Pipeline

Allowed data:

- Parcel boundaries and assessor ownership records.
- Mailing address for physical outreach.

Guardrails:

- Treat email/phone enrichment as restricted unless explicit policy and counsel approval.
- Do not auto-contact enriched digital identities without opt-in.

### 3. Physical-to-Digital Funnel

Step A - Programmatic direct mail:

- Generate personalized postcard with parcel/driveway visual and estimate summary.
- Include unique QR/custom URL token to private landing page.

Step B - Opt-in gateway:

- Landing page shows estimate details and disclosure language.
- Owner submits email/phone with explicit consent checkboxes.
- SMS channel requires separate TCPA consent capture.

Step C - Conversion workflow:

- On opt-in, create CRM lead and trigger follow-up sequence.
- Route to local contractor queue with SLA.

## Compliance Requirements

### API Terms and Licensing

- Use paid/licensed imagery APIs only.
- Keep attribution and retention policy aligned with provider contracts.
- Track imagery source and timestamp per estimate.

### CAN-SPAM and TCPA

- No unsolicited marketing text or robocall outreach.
- Email/SMS campaigns require explicit, recorded consent.
- Store consent metadata: timestamp, source token, channel, policy version.

### Privacy and Audit

- Minimize stored PII before opt-in.
- Encrypt contact data at rest where available.
- Maintain immutable outreach and consent audit log.

## Build Modules Added in This Repository

- Backend router: `app/routers/driveway_growth.py`
- Schema contracts: `app/schemas/driveway_growth.py`
- Client API methods: `src/api/client.js`

Implemented endpoints:

1. `POST /api/v1/driveway-growth/estimate-preview`
2. `POST /api/v1/driveway-growth/cv/mask-estimate`
3. `POST /api/v1/driveway-growth/direct-mail/campaign-draft`
4. `GET /api/v1/driveway-growth/opt-in/{token}`
5. `POST /api/v1/driveway-growth/opt-in/{token}/submit`

Custom model training reference:

- `docs/reliability/DRIVEWAY_CUSTOM_CV_MODEL_PIPELINE.md`

## KPIs

- Cost per mailed lead.
- QR/URL scan rate.
- Opt-in conversion rate.
- Estimate-to-site-visit conversion.
- Job close rate by geography and provider source.

## Recommendation Answer

For national scale economics, train and operate your custom segmentation model as the long-run primary.

Why:

1. Marginal estimate cost trends toward infrastructure cost, not per-call API fees.
2. Model output and release cadence become your proprietary moat.
3. You can optimize for sqft error directly, instead of generic feature extraction.
4. Third-party APIs remain useful as fallback during rollout and low-confidence cases.
