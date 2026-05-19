// =====================================================================
// The Worden Standard — Narrative layer contracts
// Converts (PredictionRow + per-signal contributions) into a 2-3
// sentence executive narrative. Reasoner lives in src/lib/reasoner.ts.
// =====================================================================

import type { PredictionRow, EvaluatedSignal } from './fusion.types';

/** Tone variants the reasoner supports. */
export type NarrativeStyle =
  | 'executive'   // 2-3 sentences, punchy, decision-grade
  | 'analyst'     // 4-6 sentences, includes confidence + drivers
  | 'one_liner';  // single sentence

export interface NarrativeRequest {
  /** The fusion model id (e.g. 'boom_probability_v1'). */
  model: string;
  /** Geography FIPS the score is for. */
  geo: string;
  /** Horizon in days. */
  horizon: number;
  /** Score 0-100 produced by runFusion(). */
  score: number;
  /** Per-signal evaluation (z, contrib, isSynthetic). */
  components: EvaluatedSignal[];
  /** Optional human label for the geography ("Chesterfield County, VA"). */
  geoLabel?: string;
  style?: NarrativeStyle;
}

export interface NarrativeResponse {
  narrative: string;
  /** 'anthropic' when API key present + call succeeded, else 'deterministic'. */
  source: 'anthropic' | 'deterministic';
  /** Tokens consumed when source = 'anthropic'. */
  tokensIn?: number;
  tokensOut?: number;
  generatedAt: string;
}

/** What gets written back to predictions.narrative. */
export interface NarrativeWriteback {
  prediction: PredictionRow;
  narrative: string;
}
