# Driveway Custom CV Model Pipeline

## Objective

Build a proprietary driveway segmentation model that reduces marginal estimate cost and improves geometric accuracy versus third-party extraction APIs.

## Why This Matters

At national outreach scale, per-call API pricing compounds quickly.

Owning the model shifts cost economics from per-estimate API fees to predictable training/inference infrastructure cost.

## Production Principle

The critical dependency is not just model accuracy. It is scale fidelity.

No estimate should be produced without valid imagery scale metadata.

Required invariant:

- `driveway_sqft = mask_pixel_count * gsd_sqft_per_pixel`

If GSD metadata is missing or uncertain, mark output as non-billable estimate preview only.

## Data Engine

### Imagery Requirements

Use overhead imagery with known Ground Sample Distance (GSD), including metadata by tile/frame:

- Nearmap
- EagleView
- Hexagon

Do not use random aerial captures that lack deterministic scale metadata.

### Labeling Strategy

Use SAM-assisted bootstrapping to accelerate annotation:

1. Auto-generate draft masks with foundation segmentation tooling.
2. Human QA adjusts edges and difficult boundaries.
3. Promote corrected masks into training set.

### Required Edge Cases

The training set must include:

- Tree canopy occlusion
- House and fence shadows
- Mixed materials (asphalt, concrete, gravel, pavers)
- Narrow strips and curved edges
- Snow, wet surfaces, and seasonal color shifts

## Model Architecture Plan

### Phase 1

Train/fine-tune YOLO-Seg as the production baseline.

- Fast inference
- Strong documentation and tooling
- Good robustness for suburban overhead imagery

### Phase 2

Run HRNet-class challenger for precision-sensitive boundaries.

Promote challenger only if it improves area error and keeps inference cost within target.

## Training Workflow

1. Ingest imagery + metadata into dataset store.
2. Build train/val/test splits by geography and season.
3. Train segmentation model with augmentation tuned for shadows and occlusion.
4. Evaluate polygon IoU and area error.
5. Calibrate confidence thresholds for production acceptance.
6. Register versioned model artifact and release notes.

## Evaluation Metrics

### Core Metrics

- Mask IoU / Dice score
- Boundary F1
- Mean absolute area error in sqft
- p95 area error in sqft

### Release Gate

Ship model only if:

1. Area MAPE under 8% on holdout set.
2. p95 area error under 120 sqft for standard residential driveways.
3. Inference latency and cost fit service SLO.

## Inference-to-Pricing Contract

The model output must include:

- `mask_pixel_count`
- `segmentation_confidence`
- `imagery_source`
- `model_name`
- `model_version`

Pricing service requires:

- `gsd_sqft_per_pixel`
- `state`
- `service_type`

Implemented repository endpoint:

- `POST /api/v1/driveway-growth/cv/mask-estimate`

This endpoint computes area from pixels and GSD, then maps area to cost estimate using existing pricing logic.

## Compliance and Audit

- Store imagery source and timestamp for each estimate.
- Preserve model version and confidence for every generated quote.
- Keep outreach consent workflow separate from estimation generation.

## Rollout

### Phase A (Now)

- Use custom model in shadow mode beside current estimate preview flow.
- Compare output against sampled manual measurements.

### Phase B

- Route low-risk geographies to custom model primary.
- Keep fallback path for low-confidence segmentation.

### Phase C

- Full national rollout with per-region calibration and drift monitoring.
