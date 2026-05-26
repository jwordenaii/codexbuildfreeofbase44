# Offline Resilience Blueprint

## Objective

Ensure every site can operate safely and productively during extended WAN outages (for example, a 6-hour cellular loss) and then reconcile to cloud systems without critical data loss.

## Operating Model

- Local-first site autonomy: each project site runs a Local Operations Node for safety, dispatch, check-ins, permits, and incident workflows.
- Cloud connectivity is treated as eventual consistency, not a runtime requirement for critical site actions.
- Cloud-backed global coordination provides aggregation, analytics, and cross-site visibility.
- Sites remain authoritative for immediate operational actions while offline.

## Edge Architecture

- Local message bus ingests telemetry, CV detections, user actions, and machine state changes.
- Priority-based queues allow controlled degradation under constrained links.
- Durable local storage includes an append-only event log with per-lane sequence numbers.
- Local storage also includes a time-series cache for high-frequency telemetry and a media spool for deferred upload.
- Local policy runtime uses signed policy bundles and cached identity claims with bounded offline privileges.

## Data Priority Lanes

- Lane A - Safety critical:
  Examples include emergency stop, PPE violation, and geofence breach.
  Requirements are lossless delivery, immutable audit, and highest replay priority.

- Lane B - Operational state:
  Examples include equipment status transitions, crew assignment transitions, and permit state changes.
  Requirements are lossless replay and deterministic ordering.

- Lane C - High-frequency telemetry:
  Examples include position updates, vibration, and temperature streams.
  Requirements are adaptive decimation during outage while preserving state transitions.

- Lane D - Media and blobs:
  Raw video and image uploads are deferred by default, with metadata and keyframes prioritized.

## Outage Mode Behavior

- Trigger OFFLINE_OPERATIONAL mode when WAN heartbeat and broker acknowledgements exceed failure threshold.
- Show explicit offline status, queue depth, local clock source, and last cloud sync timestamp.
- Keep safety and local operations active.
- Disable cloud-dependent features with clear messaging.
- Route urgent alerts through local channels (radio, local SMS gateway, on-site alarms), not cloud-only channels.

## Reconnect and Reconciliation

- Handshake with per-lane cursor and integrity digest from site to cloud.
- Cloud responds with accepted cursor and policy/version deltas.
- Recovery order is snapshot first, then strict lane replay A -> B -> C -> D.
- Safety events are never dropped.
- Operational state uses deterministic precedence with full audit metadata.
- Stale transitional telemetry is dropped in favor of current valid state.
- Idempotency keys prevent duplicate writes.
- Completion gates require queue drain, cursor parity, digest validation, and reconciliation report persistence.

## Reliability Topology

- Active-active regional ingestion across at least two regions (for example US-East and US-West) with latency-aware routing and failover.
- Multi-region durability with stronger guarantees for lanes A and B than lane C.
- Dependency circuit breakers so AI and external services degrade gracefully on latency or error thresholds.
- Dashboard must continue rendering raw operational data if enrichment services are unavailable.

## Performance and UX Protections

- Edge filtering first: run heavy CV at edge and transmit compact event payloads.
- Dynamic decimation: national zoom shows aggregate site health; high-frequency machine telemetry streams only at local/site zoom.
- Main-thread protection: parse and merge high-volume telemetry off the UI thread.

## Security and Compliance

- Offline auth boundaries use time-bounded local claims and limited offline privilege scope.
- Tamper-evident audit uses hash-chained critical event logs with immutable retention for incident review.
- Policy integrity requires signed policy bundles and explicit version pinning during disconnected operation.

## SLOs and Drill Program

- Lane A data loss: zero tolerance.
- Lane B data loss: zero tolerance.
- Local action latency during outage must remain bounded.
- Reconciliation time after reconnect must remain bounded.
- Drill cadence includes quarterly 6-12 hour WAN blackout drills, regional failover game days, and post-drill integrity audits.

## Phased Rollout

- Phase 1: local event log, outage mode UX, cursor-based replay.
- Phase 2: priority lanes, snapshot-first recovery, decimation policy.
- Phase 3: active-active regional ingestion and stronger durability for safety lanes.
- Phase 4: automated reliability drills, compliance automation, and SLO enforcement dashboards.
