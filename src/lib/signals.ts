// =====================================================================
// The Worden Standard — Signal Fusion engine (WBP-v1 + companions)
//
// Pure math layer. No DB / network dependencies — receives series via
// WbpInputs.series so it stays unit-testable. Consumers (forecast.ts)
// hydrate series via readMetricSeries() before calling runFusion().
//
// Cold-start posture: when a series has < MIN_SAMPLES points, the
// signal contributes z=0 but is flagged isSynthetic=true so the UI
// can show "calibrating" state. The model still produces a 50-baseline
// score on day-1 instead of throwing.
// =====================================================================

import type {
  FusionModel,
  SignalSpec,
  WbpInputs,
  EvaluatedSignal,
  Horizon,
  PredictionRow,
} from '../types/fusion.types';

// ---------------------------------------------------------------------
// Math primitives
// ---------------------------------------------------------------------

/** Logistic squash to [0, 1]. */
export function sigmoid(x: number): number {
  if (x > 30) return 1;
  if (x < -30) return 0;
  return 1 / (1 + Math.exp(-x));
}

/** Clamp value to [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Sample mean. */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample standard deviation (n-1). Returns 0 if degenerate. */
export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / (xs.length - 1));
}

/**
 * Horizon-adjusted weight:
 *   w_i^adj(h) = w_i · exp(-(h - L_i)² / 2τ²)
 * Signals are most informative near their lead time L_i, fading off
 * with a Gaussian of width τ (default 90 days).
 */
export function horizonWeight(
  baseWeight: number,
  leadDays: number,
  horizon: number,
  tau: number,
): number {
  const dh = horizon - leadDays;
  return baseWeight * Math.exp(-(dh * dh) / (2 * tau * tau));
}

/**
 * Standardized score against rolling baseline, capped at |3|.
 * Returns null when the series is too short to standardize.
 */
const MIN_SAMPLES = 8;
export function zScore(series: Array<{ value: number }>): number | null {
  if (series.length < MIN_SAMPLES) return null;
  const values = series.map((s) => s.value).filter((v) => Number.isFinite(v));
  if (values.length < MIN_SAMPLES) return null;
  const latest = values[0]; // readMetricSeries returns DESC
  const baseline = values.slice(1); // exclude latest from baseline
  const mu = mean(baseline);
  const sd = stddev(baseline);
  if (sd === 0) return 0;
  return clamp((latest - mu) / sd, -3, 3);
}

// ---------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------

/**
 * WBP-v1 — primary "boom probability" model.
 * 8 signals, weights sum to 1.00.
 *
 * Note: a few metric ids are placeholders today — they map to the
 * closest already-ingested series until the dedicated source lands:
 *   aia_abi          -> fred PRRESCONS (private residential construction)
 *   pavement_cond    -> acs housing.median_value (proxy for real-estate
 *                       infrastructure quality until PCI lands)
 */
export const WBP_V1: FusionModel = {
  id: 'boom_probability_v1',
  label: 'Worden Boom Probability v1',
  tau: 90,
  signals: [
    { id: 'permits',         metric: 'bps.permits.total_units',         weight: 0.22, leadDays: 90,  allowColdStart: true },
    { id: 'sam_spending',    metric: 'sam.usaspending.naics_236_237_238', weight: 0.18, leadDays: 180, allowColdStart: true },
    { id: 'yield_curve',     metric: 'fred.yield_curve.t10y3m',         weight: 0.15, leadDays: 365, allowColdStart: true },
    { id: 'jolts_openings',  metric: 'bls.jolts.construction.openings', weight: 0.12, leadDays: 60,  allowColdStart: true },
    { id: 'aia_abi',         metric: 'fred.construction.private_res',   weight: 0.12, leadDays: 90,  allowColdStart: true },
    { id: 'material_cost',   metric: 'eia.fuel.diesel_us',              weight: 0.08, leadDays: 30,  invert: true, allowColdStart: true },
    { id: 'pavement_cond',   metric: 'acs.housing.median_value',        weight: 0.08, leadDays: 90,  allowColdStart: true },
    { id: 'demographics',    metric: 'acs.pop.total',                   weight: 0.05, leadDays: 365, allowColdStart: true },
  ],
};

/** Trade demand — pulls signals biased to short-cycle work. */
export const TRADE_DEMAND_V1: FusionModel = {
  id: 'trade_demand_v1',
  label: 'Trade Demand v1',
  tau: 60,
  signals: [
    { id: 'permits',        metric: 'bps.permits.total_units',         weight: 0.30, leadDays: 60,  allowColdStart: true },
    { id: 'jolts_hires',    metric: 'bls.jolts.construction.hires',    weight: 0.25, leadDays: 45,  allowColdStart: true },
    { id: 'sam_spending',   metric: 'sam.usaspending.naics_236_237_238', weight: 0.20, leadDays: 90,  allowColdStart: true },
    { id: 'aia_abi',        metric: 'fred.construction.private_res',   weight: 0.15, leadDays: 60,  allowColdStart: true },
    { id: 'material_cost',  metric: 'eia.fuel.diesel_us',              weight: 0.10, leadDays: 30,  invert: true, allowColdStart: true },
  ],
};

/** Margin erosion — input-cost squeeze, signs flipped. Higher = more erosion. */
export const MARGIN_EROSION_V1: FusionModel = {
  id: 'margin_erosion_v1',
  label: 'Margin Erosion v1',
  tau: 60,
  signals: [
    { id: 'diesel',         metric: 'eia.fuel.diesel_us',              weight: 0.30, leadDays: 30,  allowColdStart: true },
    { id: 'asphalt_ppi',    metric: 'bls.ppi.ready_mix',               weight: 0.25, leadDays: 30,  allowColdStart: true },
    { id: 'wages_eci',      metric: 'bls.eci.wages',                   weight: 0.20, leadDays: 90,  allowColdStart: true },
    { id: 'crude_wti',      metric: 'eia.fuel.crude_wti',              weight: 0.15, leadDays: 30,  allowColdStart: true },
    { id: 'lumber_ppi',     metric: 'bls.ppi.lumber',                  weight: 0.10, leadDays: 60,  allowColdStart: true },
  ],
};

/** Capital cycle — long-cycle investment posture. */
export const CAPITAL_CYCLE_V1: FusionModel = {
  id: 'capital_cycle_v1',
  label: 'Capital Cycle v1',
  tau: 180,
  signals: [
    { id: 'yield_curve',    metric: 'fred.yield_curve.t10y3m',         weight: 0.30, leadDays: 365, allowColdStart: true },
    { id: 'sam_spending',   metric: 'sam.usaspending.naics_236_237_238', weight: 0.25, leadDays: 270, allowColdStart: true },
    { id: 'private_nonres', metric: 'fred.construction.private_nonres',weight: 0.20, leadDays: 180, allowColdStart: true },
    { id: 'total_construction', metric: 'fred.construction.total',     weight: 0.15, leadDays: 180, allowColdStart: true },
    { id: 'demographics',   metric: 'acs.pop.total',                   weight: 0.10, leadDays: 365, allowColdStart: true },
  ],
};

export const FUSION_MODELS: Record<string, FusionModel> = {
  [WBP_V1.id]: WBP_V1,
  [TRADE_DEMAND_V1.id]: TRADE_DEMAND_V1,
  [MARGIN_EROSION_V1.id]: MARGIN_EROSION_V1,
  [CAPITAL_CYCLE_V1.id]: CAPITAL_CYCLE_V1,
};

// ---------------------------------------------------------------------
// Fusion runner
// ---------------------------------------------------------------------

/**
 * Evaluate one signal against its series at a given horizon.
 * Returns null when the series is missing AND coldStart is disallowed.
 */
function evaluateSignal(
  spec: SignalSpec,
  series: Array<{ observedAt: string; value: number }> | undefined,
  horizon: Horizon,
  tau: number,
): EvaluatedSignal | null {
  const wAdj = horizonWeight(spec.weight, spec.leadDays, horizon, tau);
  let z = series ? zScore(series) : null;
  let isSynthetic = false;

  if (z === null) {
    if (!spec.allowColdStart) return null;
    z = 0;
    isSynthetic = true;
  }

  const signed = spec.invert ? -z : z;
  const contrib = wAdj * signed;

  return {
    signal: spec.id,
    metric: spec.metric,
    z: signed,
    contrib,
    weightAdj: wAdj,
    leadDays: spec.leadDays,
    isSynthetic,
  };
}

/**
 * Run a fusion model against the supplied series cache.
 * Pure function — no I/O — returns score + per-signal diagnostics.
 */
export function runFusion(
  model: FusionModel,
  inputs: WbpInputs,
): { score: number; components: EvaluatedSignal[]; coldStart: boolean } {
  const components: EvaluatedSignal[] = [];
  let xSum = 0;
  let coldCount = 0;

  for (const spec of model.signals) {
    const series = inputs.series[spec.metric];
    const evald = evaluateSignal(spec, series, inputs.horizon, model.tau);
    if (!evald) continue;
    if (evald.isSynthetic) coldCount += 1;
    components.push(evald);
    xSum += evald.contrib;
  }

  // Score lives on [0, 100] via logistic
  const score = Math.round(100 * sigmoid(xSum) * 100) / 100;
  const coldStart = coldCount === components.length || coldCount > components.length / 2;

  return { score, components, coldStart };
}

/**
 * Convert a fusion result into a PredictionRow ready for writePrediction().
 * Components are stripped to the canonical PredictionComponent shape so the
 * extra diagnostic fields (weightAdj, isSynthetic) don't bloat the table.
 */
export function toPredictionRow(
  model: FusionModel,
  geoFips: string,
  horizon: Horizon,
  result: { score: number; components: EvaluatedSignal[] },
  narrative?: string,
): PredictionRow {
  return {
    model: model.id,
    geoFips,
    horizonDays: horizon,
    score: result.score,
    components: result.components.map((c) => ({
      signal: c.signal,
      z: Number(c.z.toFixed(4)),
      contrib: Number(c.contrib.toFixed(4)),
    })),
    narrative,
  };
}

/**
 * Cold-start synthetic backfill helper.
 * Generates a minimal flat baseline (value=0) for any metric that
 * has no observations yet, so dev/test environments without ingested
 * data can still exercise the fusion pipeline. Production runs read
 * real series via readMetricSeries() — this is for tests + first-boot.
 */
export function syntheticSeries(days = 30): Array<{ observedAt: string; value: number }> {
  const out: Array<{ observedAt: string; value: number }> = [];
  const today = Date.now();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(today - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ observedAt: d, value: 0 });
  }
  return out;
}
