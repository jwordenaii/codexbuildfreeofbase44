// =====================================================================
// The Worden Standard — Signal Fusion contracts (WBP-v1 + companions)
//
// WBP-v1 ("Worden Boom Probability v1") fuses 8 weighted economic
// signals into a 0-100 score per (geography, horizon).
//
//   WBP(g, h) = 100 · σ( Σ w_i^adj(h) · z_i(g) )
//
// where:
//   z_i(g)       = clamp((latest - mean_5yr) / std_5yr, -3, 3)
//   w_i^adj(h)   = w_i · exp(-(h - L_i)² / 2τ²)   τ = 90 days
//   σ(x)         = 1 / (1 + e^(-x))                logistic
//
// Companion models share the same machinery with different weight maps:
//   trade_demand_v1     — pavement/road trade pull
//   margin_erosion_v1   — input-cost squeeze (signs flipped)
//   capital_cycle_v1    — long-cycle capital deployment
// =====================================================================

import type { PredictionRow, PredictionComponent } from './signals.types';

/** Horizons WBP-v1 produces per geography. */
export type Horizon = 30 | 90 | 180 | 365;

/** A single weighted signal in a fusion model. */
export interface SignalSpec {
  /** Stable id used in PredictionComponent.signal. */
  id: string;
  /** Canonical metric in signals_normalized.metric. */
  metric: string;
  /** Base weight w_i (sum of all base weights ≈ 1.0). */
  weight: number;
  /** Lead time L_i in days — when this signal is most informative. */
  leadDays: number;
  /** If true, invert sign before z (e.g. costs going UP is negative for boom). */
  invert?: boolean;
  /** If true and series is too short, fall back to z=0 with isSynthetic flag. */
  allowColdStart?: boolean;
}

/** A complete fusion model spec. */
export interface FusionModel {
  /** Stable id used in predictions.model. */
  id: string;
  /** Human label for narrative/UI. */
  label: string;
  /** τ (tau) in days for horizon Gaussian. Default 90. */
  tau: number;
  /** Signals contributing to the score. */
  signals: SignalSpec[];
}

/** Inputs to the WBP fusion step. */
export interface WbpInputs {
  geoFips: string;
  horizon: Horizon;
  /** Latest observation per metric — typically from readMetricSeries(metric, geo, 1825). */
  series: Record<string, Array<{ observedAt: string; value: number }>>;
}

/** Internal: one fully-evaluated signal for the diagnostic record. */
export interface EvaluatedSignal extends PredictionComponent {
  isSynthetic?: boolean;
  weightAdj: number;
  leadDays: number;
  metric: string;
}

/** Forecast endpoint request. */
export interface ForecastRequest {
  geo: string;
  horizon?: Horizon;
  model?: string;
}

/** Forecast endpoint response. */
export interface ForecastResponse {
  model: string;
  geo: string;
  horizon: Horizon;
  score: number;
  components: EvaluatedSignal[];
  generatedAt: string;
  persisted: boolean;
  coldStart: boolean;
}

/** Re-export so consumers only need fusion.types. */
export type { PredictionRow, PredictionComponent };
