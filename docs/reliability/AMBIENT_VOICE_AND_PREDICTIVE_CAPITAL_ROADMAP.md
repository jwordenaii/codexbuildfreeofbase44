# Ambient Voice and Predictive Capital Roadmap

## Decision

Primary architecture focus for the next build cycle should be Ambient Voice Capture.

Reason:

1. It is the highest-leverage data foundation for the Predictive Capital Dashboard.
2. The repository already has voice ingestion primitives (`app/routers/voice.py`, `app/services/voice_intake.py`), so delivery risk is lower and speed is higher.
3. Better operational ground truth improves all downstream forecasting quality (schedule, labor, risk, and cost).

Build strategy:

- Lead with Ambient Voice Capture as Phase A.
- Run Predictive Capital in parallel shadow mode as Phase B using existing and newly captured signals.
- Promote Predictive Capital to decision-grade after calibration thresholds are met.

## Track A - Ambient Voice Capture Architecture

### Voice Objective

Continuously convert field speech into structured, time-linked operational facts that can be fused into the 5D twin and forecasting models.

### Core Pipeline

1. Capture:
   - Foreman app push-to-talk clips
   - Crew standup recordings
   - Call center and Vapi/Twilio call streams
2. Speech processing:
   - Streaming ASR where possible; batch fallback for poor connectivity
   - Speaker diarization (who said what)
   - Domain lexicon expansion (trade terms, equipment IDs, location codes)
3. Semantic extraction:
   - Entity extraction (crew, trade, zone, task, material, blocker)
   - Event classification (safety, schedule slip, procurement risk, quality issue)
   - Confidence and contradiction scoring
4. Event materialization:
   - Write canonical events to lane-prioritized event bus
   - Link events to project, BIM element, and schedule activity IDs
5. Human loop:
   - Supervisor review queue for low-confidence or high-impact events
   - One-click correction and feedback capture for model tuning

### Event Contracts

Required event families:

- `voice.capture.received`
- `voice.transcript.completed`
- `voice.event.extracted`
- `voice.event.verified`
- `voice.risk.signal.raised`

Required fields:

- `project_id`, `site_id`, `zone_id`, `trade_id`
- `speaker_id`, `role`, `timestamp_utc`
- `transcript_text`, `event_type`, `event_confidence`
- `source_audio_uri`, `model_version`, `policy_version`

### Reliability and Privacy Controls

- On-device buffering with encrypted spool for offline periods.
- Automatic PII redaction for non-essential payload paths.
- Retention tiers:
  - Raw audio short-lived by policy
  - Structured events retained for analytics and audit
- Role-based transcript visibility with legal hold support.

### Immediate Build Slice (30-45 days)

1. Add a dedicated ambient ingestion endpoint family under `app/routers/voice.py`.
2. Introduce typed voice event schemas in `app/schemas/`.
3. Add background extraction tasks in `app/tasks/` using existing worker architecture.
4. Publish an internal "Voice Ops" queue endpoint for Command Center to review unresolved events.
5. Add metrics:
   - transcription latency p95
   - extraction precision proxy
   - supervisor correction rate

## Track B - Predictive Capital Intelligence Model

### Capital Objective

Forecast true cost and schedule outcomes before mobilization and during execution, then propose mitigations with quantified confidence.

### Model Layers

1. Baseline estimator:
   - Regional labor and material rates
   - State and county constraint multipliers
   - Project class and complexity priors
2. Dynamic risk engine:
   - Labor availability pressure
   - Weather and severe-event exposure
   - Supply chain route volatility
   - Permitting and regulatory friction
3. Scenario simulator:
   - Monte Carlo schedule and cost propagation
   - Counterfactual plans (crew mix, supplier reroute, sequence shifts)
4. Prescriptive planner:
   - Ranked mitigation package
   - Delta cost, delta schedule, and confidence interval per option

### Data Inputs (Minimum Viable)

- Existing `math-ai` cost estimation features from `app/services/math_ai_service.py`.
- Historical project outcomes (planned vs actual cost/schedule).
- Voice-derived risk signals from Track A.
- Drone/BIM deviation metrics from the living digital twin track.
- Public weather and commodity indices.

### Outputs

- `capital_forecast_base`
- `capital_forecast_risk_adjusted`
- `delay_probability_30_60_90d`
- `cost_overrun_probability`
- `recommended_plan` with ranked interventions

### Governance Gate for Decision-Grade Use

Promote from shadow mode only when all thresholds are met:

1. Mean absolute percentage error for budget forecast under 10%.
2. Critical-path delay classification precision above 85%.
3. Drift monitoring and retraining policy active.
4. Model card and feature provenance audit approved.

## 90-Day Sequencing

### Days 0-30

- Deliver ambient voice ingestion, extraction, and supervisor review loop.
- Start writing structured voice risk events to the event stream.
- Stand up initial feature store tables for capital forecasting.

### Days 31-60

- Launch predictive capital shadow forecasts for selected projects.
- Compare forecasts with planner baseline weekly.
- Add variance decomposition dashboard in Command Center.

### Days 61-90

- Introduce prescriptive mitigation recommendations.
- Enable policy-gated automated draft packages (change order, procurement reroute).
- Execute calibration review for decision-grade promotion.

## Recommended Next Engineering Sprint

Sprint goal: "Ambient Voice Foundation + Capital Shadow v1"

Required backlog items:

1. Voice event schema and ingestion API.
2. Queue consumer and extraction worker.
3. Supervisor review UI/API contract.
4. Capital feature store and baseline model service endpoint.
5. Command Center panel for shadow forecast vs plan.

This sequence creates the fastest path to the infrastructure oracle outcome while keeping technical and adoption risk controlled.

Related growth architecture:

- `docs/reliability/DRIVEWAY_CV_LEGAL_GROWTH_BLUEPRINT.md`
