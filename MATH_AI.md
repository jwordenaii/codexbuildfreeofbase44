# Mathematical AI — JWordenAI

Data-driven decision support for pavement assessment, cost estimation, and lead prioritisation using NumPy, SciPy, Scikit-learn, and Pandas.

---

## Overview

The Mathematical AI module (`app/services/math_ai_service.py`) provides four deterministic, physics-informed models that run entirely in-process — no external API calls, no database reads, no training required at runtime.

| Capability | Model | Auth |
|---|---|---|
| Pavement condition scoring | Weighted decay (ASTM D6433-inspired) | Public |
| Project cost estimation | Rate table + SciPy confidence interval | Public |
| Lead quality prediction | Gradient Boosting Classifier (scikit-learn) | Admin only |
| Maintenance schedule forecasting | Exponential decay curve (SciPy) | Public |

---

## Dependencies

Added to `requirements.txt`:

```
numpy==1.26.4
scipy==1.14.0
scikit-learn==1.5.0
pandas==2.2.0
```

---

## API Reference

Base path: `/api/v1/math-ai`

---

### POST `/api/v1/math-ai/pavement-score`

Score pavement condition on a 0-100 PCI scale.

**Auth:** None required.

**Request body:**

```json
{
  "age": 8,
  "cracks": 15.0,
  "potholes": 2,
  "traffic": "medium"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `age` | float | ✅ | Pavement age in years (0-100) |
| `cracks` | float | ✅ | % of surface area showing cracking (0-100) |
| `potholes` | int | ✅ | Potholes per 1,000 sq ft (0-500) |
| `traffic` | string | — | `low` \| `medium` \| `high` \| `very_high` (default: `medium`) |

**Example response:**

```json
{
  "status": "ok",
  "score": 67,
  "condition": "Fair",
  "deductions": {
    "age_deduction": 18.42,
    "crack_deduction": 7.79,
    "pothole_deduction": 5.60,
    "traffic_factor": 1.4
  },
  "recommended_action": "Crack filling and sealcoating required within 6 months",
  "urgency": "within_6_months",
  "confidence": 0.838
}
```

**PCI condition bands:**

| Score | Condition | Urgency |
|---|---|---|
| 85-100 | Excellent | routine |
| 70-84 | Good | within_1_year |
| 55-69 | Fair | within_6_months |
| 40-54 | Poor | immediate |
| 25-39 | Very Poor | immediate |
| 0-24 | Failed | immediate |

---

### POST `/api/v1/math-ai/cost-estimate`

Estimate project cost with a 95% confidence interval.

**Auth:** None required.

**Request body:**

```json
{
  "sqft": 5000,
  "service_type": "paving",
  "state": "VA"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `sqft` | float | ✅ | Project area in square feet |
| `service_type` | string | ✅ | See supported types below |
| `state` | string | — | 2-letter state code (default: `US`) |

**Supported service types:**

`paving`, `sealcoating`, `crackfill`, `parking_lot`, `driveway`, `maintenance`, `overlay`, `reconstruction`, `striping`, `patching`

**Example response:**

```json
{
  "status": "ok",
  "low_usd": 17900,
  "mid_usd": 29350,
  "high_usd": 40800,
  "low_fmt": "$17,900",
  "mid_fmt": "$29,350",
  "high_fmt": "$40,800",
  "state_multiplier": 1.02,
  "confidence_interval": {
    "lower_95": 12950,
    "upper_95": 45750
  },
  "service_type": "paving",
  "sqft": 5000.0,
  "disclaimer": "Estimate based on regional rate data and project size. Final price depends on site conditions, material costs, and access. A free on-site quote is always included."
}
```

**State multipliers** are derived from regional labour index and material premium data for all 50 US states. States with higher labour costs (NY, CA, HI, MA, CT) carry multipliers above 1.3; lower-cost states (MS, AR, AL) carry multipliers around 0.85.

---

### POST `/api/v1/math-ai/lead-quality`

Predict lead quality using a pre-trained Gradient Boosting Classifier.

**Auth:** Bearer token required (`verify_premium_security`).

**Request body:**

```json
{
  "project_size_sqft": 8500,
  "property_type": "commercial",
  "urgency": "within_1_week",
  "service_type": "parking_lot",
  "state_code": "TX"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `project_size_sqft` | float | — | Project area in sq ft |
| `property_type` | string | — | `residential` \| `commercial` |
| `urgency` | string | — | `asap` \| `within_1_week` \| `within_1_month` \| `flexible` |
| `service_type` | string | — | Requested service |
| `state_code` | string | — | 2-letter state abbreviation |

**Example response:**

```json
{
  "status": "ok",
  "label": "HOT",
  "priority": 1,
  "probabilities": {
    "HOT": 0.8312,
    "WARM": 0.1421,
    "COOL": 0.0267
  },
  "follow_up_sla": "Call within 1 hour",
  "score": 91.4,
  "features_used": {
    "sqft_bucket": 30,
    "is_commercial": true,
    "urgency_score": 20,
    "is_high_value": true,
    "is_qsr_state": true,
    "is_high_labor": false
  }
}
```

**Label definitions:**

| Label | Priority | Follow-up SLA |
|---|---|---|
| HOT | 1 | Call within 1 hour |
| WARM | 2 | Call same business day |
| COOL | 3 | Call within 48 hours |

---

### POST `/api/v1/math-ai/maintenance-forecast`

Forecast the next maintenance milestones using exponential decay modelling.

**Auth:** None required.

**Request body:**

```json
{
  "pavement_age": 6,
  "condition": 72
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `pavement_age` | float | ✅ | Current pavement age in years (0-80) |
| `condition` | float | ✅ | Current PCI score (0-100) |

Tip: use `/pavement-score` first to compute the current PCI, then pass it here as `condition`.

**Example response:**

```json
{
  "status": "ok",
  "current_pci": 72.0,
  "projected_pci_1yr": 68.3,
  "projected_pci_3yr": 61.2,
  "projected_pci_5yr": 54.8,
  "next_sealcoat_date": "2025-11-14",
  "next_crackfill_date": "2027-03-22",
  "next_overlay_date": "2029-08-05",
  "next_reconstruct_date": "2033-01-19",
  "decay_rate": 0.05268,
  "service_schedule": [
    {
      "service": "Sealcoating",
      "years_from_now": 0.42,
      "target_date": "2025-11-14",
      "pci_at_trigger": 70,
      "status": "upcoming"
    },
    {
      "service": "Crack Filling",
      "years_from_now": 1.81,
      "target_date": "2027-03-22",
      "pci_at_trigger": 55,
      "status": "upcoming"
    },
    {
      "service": "Mill & Overlay",
      "years_from_now": 4.10,
      "target_date": "2029-08-05",
      "pci_at_trigger": 40,
      "status": "upcoming"
    },
    {
      "service": "Reconstruction",
      "years_from_now": 8.59,
      "target_date": "2033-01-19",
      "pci_at_trigger": 25,
      "status": "upcoming"
    }
  ],
  "model_notes": "Deterioration modelled as PCI(t) = 100 × e^(−k·t). Fitted decay constant k=0.05268 yr⁻¹ from current age (6.0 yr) and PCI (72). Actual deterioration depends on climate, traffic, and drainage."
}
```

---

## Model Notes

### Pavement Condition Scoring

The scoring model is calibrated against ASTM D6433 (Standard Practice for Roads and Parking Lots Pavement Condition Index Surveys). Three distress types are modelled:

- **Age deduction** — logistic decay curve: slow early deterioration accelerating after ~12 years.
- **Crack deduction** — square-root model: small crack percentages have disproportionate impact.
- **Pothole deduction** — linear model: each pothole per 1k sqft deducts ~6 PCI points.

All deductions are scaled by a traffic load factor (1.0 for low, 2.6 for very high). A compound interaction penalty applies when both cracking > 30% and potholes > 2 are present simultaneously.

### Cost Estimation

Base rates ($/sqft) are maintained in `_BASE_RATES` as low/mid/high triplets. Regional multipliers for all 50 states are derived from labour index and material premium data. The 95% confidence interval is computed using `scipy.stats.norm.ppf` with the standard deviation estimated as `(high - low) / 4`.

### Lead Quality Prediction

A `GradientBoostingClassifier` (120 estimators, max depth 4, learning rate 0.08) is trained at import time on 2,000 synthetic samples generated to reproduce the heuristic scoring logic in `lead_scorer.py`. Features:

| Feature | Description |
|---|---|
| `sqft_bucket` | Bucketed project size (10/20/30/40) |
| `is_commercial` | Binary: commercial property |
| `urgency_score` | Mapped urgency (5/10/20/30) |
| `is_high_value` | Binary: high-value service type |
| `is_qsr_state` | Binary: QSR-dense state |
| `is_high_labor` | Binary: high-labour-cost state |

The model outputs a three-class probability vector (COOL / WARM / HOT). Training takes < 1 second and the fitted model is cached on the class for the lifetime of the process.

### Maintenance Forecasting

Deterioration is modelled as an exponential decay: `PCI(t) = 100 × e^(−k·t)`. The decay constant *k* is fitted from the current pavement age and PCI score. Service thresholds:

| Service | PCI trigger |
|---|---|
| Sealcoating | < 70 |
| Crack Filling | < 55 |
| Mill & Overlay | < 40 |
| Reconstruction | < 25 |

---

## Testing

### Pavement scoring

```bash
curl -X POST https://your-api/api/v1/math-ai/pavement-score \
  -H "Content-Type: application/json" \
  -d '{"age": 8, "cracks": 15, "potholes": 2, "traffic": "medium"}'
```

### Cost estimation across states

```bash
# Virginia
curl -X POST https://your-api/api/v1/math-ai/cost-estimate \
  -H "Content-Type: application/json" \
  -d '{"sqft": 5000, "service_type": "paving", "state": "VA"}'

# New York (higher multiplier)
curl -X POST https://your-api/api/v1/math-ai/cost-estimate \
  -H "Content-Type: application/json" \
  -d '{"sqft": 5000, "service_type": "paving", "state": "NY"}'
```

### Lead quality prediction

```bash
curl -X POST https://your-api/api/v1/math-ai/lead-quality \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "project_size_sqft": 8500,
    "property_type": "commercial",
    "urgency": "within_1_week",
    "service_type": "parking_lot",
    "state_code": "TX"
  }'
```

### Maintenance forecasting

```bash
curl -X POST https://your-api/api/v1/math-ai/maintenance-forecast \
  -H "Content-Type: application/json" \
  -d '{"pavement_age": 6, "condition": 72}'
```

---

## Deployment

No environment variables, database migrations, or external services required. The scikit-learn model trains in-process at first import (< 1 second). All four endpoints are available immediately after deploy.
