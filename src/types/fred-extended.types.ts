// fred-extended.types.ts
// src/types/fred-extended.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Types for FRED extended signal fetcher → WBP-v1 signal store
// Extends investor.ts FRED usage — adds macro leading indicators
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedFact, SourceFetchResult } from './signals.types';
export type { NormalizedFact, SourceFetchResult };

// ─── FRED series IDs (canonical) ─────────────────────────────────────────────

export const FRED_SERIES = {
  // Yield curve
  DGS10:   'DGS10',         // 10-Year Treasury Constant Maturity Rate (daily)
  DGS3MO:  'DGS3MO',        // 3-Month Treasury Constant Maturity Rate (daily)
  T10Y3M:  'T10Y3M',        // 10Y−3Mo spread (pre-computed by FRED, daily)

  // Macro
  INDPRO:   'INDPRO',       // Industrial Production Index (monthly, 2017=100)
  TOTALCONS:'TTLCONS',      // Total Construction Spending, SAAR $M (monthly)
  PRRESCONS:'PRRESCONS',    // Private Residential Construction Spending
  PNRESCONS:'PNRESCONS',    // Private Nonresidential Construction Spending

  // Labor / capacity (complements BLS)
  UNEMPLOYMENT: 'UNRATE',   // Civilian unemployment rate (monthly)
  JTSJOL:  'JTSJOL',        // JOLTS: Construction job openings (monthly)

  // Prices
  DPCREAM: 'DCOILWTICO',    // WTI crude oil (daily) — diesel proxy
  PPI_ASPHALT: 'PCU23731123731101', // PPI: Asphalt paving/roofing (monthly)
} as const;

export type FredSeriesId = typeof FRED_SERIES[keyof typeof FRED_SERIES];

// ─── FRED API raw response ────────────────────────────────────────────────────

export interface FredObservation {
  date: string;           // "2024-01-01"
  value: string;          // numeric string or "." for missing
}

export interface FredSeriesResponse {
  observations: FredObservation[];
  seriesToId: string;
  title?: string;
  units?: string;
  frequency?: string;
  seasonalAdjustment?: string;
  lastUpdated?: string;
}

export interface FredMultiSeriesPayload {
  series: Record<FredSeriesId, FredObservation[]>;
  yieldCurveSlope: FredObservation[]; // T10Y3M or derived 10y−3mo
}

// ─── Fetch params ─────────────────────────────────────────────────────────────

export interface FredExtendedParams {
  observationStart?: string;   // "2020-01-01" default: 5 years ago
  observationEnd?: string;     // default: today
  frequency?: 'm' | 'q' | 'a' | 'd'; // m=monthly default
}
