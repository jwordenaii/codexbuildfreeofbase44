// =====================================================================
// ForecastStation contracts
// =====================================================================

import type { Horizon, EvaluatedSignal } from './fusion.types';

export interface ForecastApiResponse {
  model: string;
  geo: string;
  horizon: Horizon;
  score: number;
  components: EvaluatedSignal[];
  generatedAt: string;
  persisted: boolean;
  coldStart: boolean;
}

export interface NarrativeApiResponse {
  narrative: string;
  source: 'anthropic' | 'deterministic';
  tokensIn?: number;
  tokensOut?: number;
  generatedAt: string;
  persisted?: boolean;
}

/** A drill-down target on the heatmap. */
export interface ForecastGeoCell {
  fips: string;
  label: string;
  /** State or region for grouping. */
  region: string;
}

export interface ForecastStationProps {
  /** Default geography to load on first render. */
  defaultGeo?: string;
  /** Default horizon. */
  defaultHorizon?: Horizon;
  /** Default fusion model id. */
  defaultModel?: string;
  /** Override the geo list in the heatmap (defaults to VA primary footprint). */
  geos?: ForecastGeoCell[];
  /** Override the forecast endpoint base (defaults to /.netlify/functions). */
  apiBase?: string;
}
