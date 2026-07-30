# Truck routing — findings and the real build path

Saved 2026-07-30. Not built; recorded so the work is not re-discovered from scratch.

## What exists today is simulated, not real

Two modules look like heavy-haul routing and are not:

**`app/jarvis_os/abilities/OperationalAndDispatch/dynamic_routing_engine.py`** (55 lines)

```python
hazards_detected   = random.random() < 0.3        # coin flip
standard_route_mins = random.randint(35, 90)      # invented ETA
hazard_msg = "Low Bridge (13ft 6in) detected on Primary Route."   # fixed string
```

The bridge warning is a hardcoded string emitted on a 30% random roll. It reads
no bridge database, knows no truck position, and the "51-State DOT Compliance
Matrix: ACTIVE" banner is decoration. `heavy_fleet_router.py` is the same shape:
eight imaginary trucks with `random.randint(5, 45)` ETAs.

**Neither is wired to Jarvis or to any router, and neither should be.** An
80,000 lb truck routed under a bridge on a coin flip is a safety incident, not a
bug. If these are ever exposed, they must first be replaced, not relabelled.

Related: **86 of 164 files under `app/jarvis_os/abilities/` import `random`.**
A large share of that catalogue is demo output rather than capability. It
deserves its own audit — separating the real abilities from the theatre — before
any of it is surfaced to an operator.

## Why this cannot be fixed with the keys we already hold

Google Maps **does not do truck routing**. The Directions API carries no bridge
clearance, no weight or axle limits, no hazmat restrictions. This is a product
gap, not a wiring gap — no amount of integration work gets truck restrictions
out of it.

## The real build path

| Provider | Provides | Cost |
|---|---|---|
| **HERE Routing API** (recommended) | Truck profile: bridge heights, weight/axle limits, hazmat, truck-legal roads, live traffic | Free tier ≈1,000 req/day — ample for this fleet |
| PTV / Trimble MAPS | Same, carrier-industry standard | Paid, materially more expensive |

Implementation sketch once a `HERE_API_KEY` exists:

1. `app/services/truck_routing_service.py` — HERE `/routes` with
   `transportMode=truck` plus the vehicle profile (height, gross weight, axle
   count, length) taken from the truck record in `dispatch_engine`.
2. A `route_truck` Jarvis tool: origin, destination, truck id → legal route,
   live-traffic ETA, and the specific restrictions avoided.
3. Surface hazards explicitly in the reply ("avoided 13'6\" clearance on US-360")
   so the driver sees *why* the route differs from the car route.
4. Honest degradation, as everywhere else: if HERE is unreachable, say so. Never
   fall back to car routing while implying truck-legality.

## Interim option (no new key)

Google Directions with live traffic gives genuine routes and ETAs, explicitly
labelled *"car routing — does not check bridges, weight limits or hazmat."*
Useful for a pickup; must never be presented as truck-legal.
