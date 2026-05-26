# 5D Living Digital Twin Engine Blueprint

## Objective

Transform the platform from a retrospective dashboard into a forward-looking execution engine that predicts schedule and cost impacts, proposes mitigations, and drives field action.

The target state is a living 5D model where each project continuously reconciles:

- 3D geometry (BIM + as-built scans)
- 4D sequence (planned vs actual construction timeline)
- 5D economics (live budget burn, change-order exposure, and confidence bands)

## North Star Capabilities

1. Reality-to-BIM AI overlay that ingests nightly point clouds and 360 imagery across all active projects.
2. Automated deviation and clash detection against design intent and approved tolerances.
3. Generative rework prevention that simulates downstream effects and drafts mitigations before trade mobilization.
4. XR field vision that renders model truth directly on-site at full scale with through-wall utility visibility.
5. Supply chain butterfly-effect simulation that predicts cross-project delays and auto-triggers contingency procurement.

## System Architecture

### Layer 1 - Data Capture and Ingestion

- Inputs:
  - Drone photogrammetry and LiDAR captures
  - 360 hardhat camera streams
  - Survey control points and georeferenced site anchors
  - ERP procurement events and logistics telemetry
  - Weather, traffic, and supplier risk signals
- Ingestion model:
  - Edge upload with resumable chunks and integrity hashes
  - Metadata normalization into project, zone, trade, and time slices
  - Event fan-out onto lane-prioritized queues (aligned with offline resilience architecture)

### Layer 2 - Twin Core

- Canonical graph:
  - Nodes: elements, assemblies, tasks, crews, suppliers, shipments, and cost codes
  - Edges: dependency, proximity, sequence, and financial impact relationships
- State stores:
  - Geometry state store (current model + as-built delta)
  - Schedule state store (baseline, updates, forecast)
  - Cost state store (commitments, actuals, risk-adjusted estimate-at-complete)
- Time semantics:
  - Every state mutation is event-sourced with deterministic replay and audit identity.

### Layer 3 - Physics and Constraint Simulation

- Constraint classes:
  - Spatial clearance and clash constraints
  - Sequencing constraints (trade handoff, cure windows, access windows)
  - Safety constraints (exclusion zones, equipment envelopes)
  - Procurement constraints (lead times, alternates, logistics corridors)
- Simulation outputs:
  - Predicted conflict windows
  - Critical-path deltas
  - Incremental cost burn and variance bands
  - Ranked mitigation plans with confidence scores

### Layer 4 - Action and Orchestration

- Workflow outputs:
  - Suggested field directives
  - Auto-drafted RFIs and change orders
  - Re-sequenced task plans
  - Procurement reroute recommendations
- Guardrails:
  - Human approval required for financial commitments above policy thresholds
  - Full rationale trace for every generated recommendation

## Core Use Cases

### 1. Automated Deviation and Clash Detection

- Detect geometric variance against tolerance envelopes (for example column drift).
- Score severity by downstream dependency exposure, not geometric distance alone.
- Open incident with linked affected assemblies and expected impact window.

### 2. Generative Rework Prevention

- When a deviation is found, run future-sequence simulation over impacted trades.
- Generate alternative routings, sequencing changes, and material substitutions.
- Emit draft change-order package with:
  - Scope delta
  - Labor and material impact
  - Schedule impact and confidence band
  - Risk notes and approval workflow route

### 3. XR Field Vision

- Device support profile:
  - Trimble XR10 / HoloLens class industrial wearables
  - Ruggedized Apple Vision-class devices where policy allows
- Field experience:
  - 1:1 spatial overlay on slab and structure
  - Through-wall utility rendering before cut/drill operations
  - Conflict heatmap anchored to physical coordinates
- Trust requirements:
  - Continuous calibration with control points
  - Confidence indicator displayed in-visor

### 4. Supply Chain Butterfly-Effect Simulator

- Ingest weather and corridor risk feeds continuously.
- Simulate impact of route disruptions on all dependent sites.
- Trigger contingency actions:
  - Supplier reroute recommendation
  - Alternate material strategy
  - Automatic procurement draft package
  - 5D budget and schedule rebalance proposal

## Data Contracts and Events

Define these event families for consistent replay and analytics:

- `twin.capture.ingested`
- `twin.geometry.delta.detected`
- `twin.clash.predicted`
- `twin.sequence.forecast.updated`
- `twin.cost.burn.reforecasted`
- `twin.mitigation.plan.generated`
- `twin.procurement.reroute.recommended`
- `twin.xr.alignment.verified`

Minimum fields:

- `event_id`, `event_time`, `project_id`, `site_id`
- `model_version`, `as_built_revision`, `schedule_revision`, `cost_revision`
- `trace_id`, `actor_type`, `policy_version`
- `confidence_score`, `impact_class`, `approval_required`

## KPI and SLO Targets

- Mean time to detect geometric deviation: less than 12 hours from capture.
- Forecast precision (30-day lookahead): within 10 percent schedule error on critical path tasks.
- Change-order lead time reduction: at least 40 percent versus baseline process.
- Rework cost avoidance: tracked monthly by prevented conflict class.
- XR alignment accuracy: sub-inch tolerance at validated control points.

## Security, Audit, and Governance

- All recommendations must be explainable with source evidence links.
- Financial actions above policy thresholds require dual approval.
- Safety-critical detections are immutable and retained for incident review.
- Model and policy versions are pinned in every recommendation payload.

## Rollout Plan

### Phase 1 - Twin Foundations (0-90 days)

- Establish canonical twin graph schema and event contracts.
- Integrate nightly reality-capture ingestion for pilot projects.
- Launch deviation detection and basic 4D variance dashboard.

### Phase 2 - 5D Forecast Engine (90-180 days)

- Add live cost burn forecasting and change-order draft generation.
- Enable downstream impact simulation for top conflict classes.
- Start confidence scoring and decision rationale capture.

### Phase 3 - XR and Field Execution (180-270 days)

- Deploy XR overlay workflows on selected projects.
- Add through-wall utility rendering with calibration QA.
- Instrument adoption and safety outcome metrics.

### Phase 4 - Networked Supply Chain Twin (270-365 days)

- Connect supplier and logistics signals into global simulation.
- Activate cross-project reroute recommendations.
- Add autonomous procurement drafts with policy gating.

## Integration Points in This Repository

- Reliability and outage behavior align with `docs/reliability/OFFLINE_RESILIENCE_BLUEPRINT.md`.
- Operational SLO governance anchors in `docs/RELIABILITY_SLO.md`.
- Ambient capture and capital forecasting sequencing is defined in `docs/reliability/AMBIENT_VOICE_AND_PREDICTIVE_CAPITAL_ROADMAP.md`.
- Technology watchlist and signal harvesting can extend from `scripts/ai-tech-radar.mjs` and `docs/AI_TECH_RADAR.md`.
- Backend orchestration should route through existing FastAPI and worker layers under `app/` and Celery task flows.

## Executive Positioning

This architecture shifts the platform from reporting to anticipation.

- Yesterday: what happened.
- Today: what is at risk.
- Tomorrow: what will fail, what it will cost, and which action prevents it.

That is the difference between a dashboard and a construction operating system.
