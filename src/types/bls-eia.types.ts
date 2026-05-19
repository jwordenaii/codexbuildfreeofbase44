// bls-eia.types.ts
// src/types/bls-eia.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Types for BLS (JOLTS + ECI) and EIA (diesel + asphalt prices) fetchers
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedFact, SourceFetchResult } from './signals.types';
export type { NormalizedFact, SourceFetchResult };

// ─── BLS series IDs ───────────────────────────────────────────────────────────

// JOLTS (Job Openings and Labor Turnover Survey) — Construction sector
export const BLS_SERIES = {
  // JOLTS: Construction (NAICS 23)
  JOLTS_OPENINGS_CONST:  'JTS23000000JOL',  // Job openings, construction
  JOLTS_HIRES_CONST:     'JTS23000000HIL',  // Hires, construction
  JOLTS_QUITS_CONST:     'JTS23000000QUL',  // Quits, construction (voluntary, leading indicator)
  JOLTS_LAYOFFS_CONST:   'JTS23000000LDL',  // Layoffs & discharges, construction

  // ECI (Employment Cost Index) — Construction wages
  ECI_WAGES_CONST:       'CIU2010000000000A', // ECI: wages, construction (quarterly, 2001Q4=100)

  // PPI (Producer Price Index) — Construction materials
  PPI_LUMBER:            'WPU0811',           // Softwood lumber
  PPI_STEEL:             'WPU101',            // Iron & steel products
  PPI_READY_MIX:         'WPU1321',           // Ready-mix concrete
  PPI_GYPSUM:            'WPU133',            // Gypsum products
} as const;

export type BlsSeriesId = typeof BLS_SERIES[keyof typeof BLS_SERIES];

// ─── BLS API response types ───────────────────────────────────────────────────

export interface BlsObservation {
  year: string;
  period: string;          // "M01"–"M12" for monthly, "Q01"–"Q04" for quarterly
  periodName: string;      // "January", "1st Quarter"
  value: string;
  footnotes: Array<{ code?: string; text?: string }>;
}

export interface BlsSeriesResult {
  seriesID: string;
  data: BlsObservation[];
}

export interface BlsApiResponse {
  status: string;
  responseDetails: string;
  message: string[];
  Results: { series: BlsSeriesResult[] };
}

// ─── EIA series IDs ───────────────────────────────────────────────────────────

// EIA Open Data API v2 — no key required for public datasets
export const EIA_SERIES = {
  DIESEL_RETAIL_US:     'petroleum.pri.gnd.W_EPMRR_PTE_NUS_DPG.w',  // Weekly US diesel retail ($/gal)
  DIESEL_RETAIL_EAST:   'petroleum.pri.gnd.W_EPMRR_PTE_R1X_DPG.w',  // East Coast diesel ($/gal)
  CRUDE_WTI:            'petroleum.pri.spt.W_EPC0_P_YYYYNUUS_DPB.w', // WTI spot ($/bbl)
  ASPHALT_PRICE:        'petroleum.pri.refoth.W_EPD2F_PRS_NUS_DPG.m', // Asphalt & road oil $/gal (monthly)
} as const;

export type EiaSeriesId = typeof EIA_SERIES[keyof typeof EIA_SERIES];

// ─── EIA API response types ───────────────────────────────────────────────────

export interface EiaDataPoint {
  period: string;          // "2024-01-01" or "2024-W01"
  value: number | null;
  'series-description'?: string;
  units?: string;
}

export interface EiaSeriesResponse {
  response: {
    total: number;
    dateFormat: string;
    frequency: string;
    data: EiaDataPoint[];
    description: string;
    units: string;
  };
}

// ─── Fetch params ─────────────────────────────────────────────────────────────

export interface BlsFetchParams {
  seriesIds?: BlsSeriesId[];
  startYear?: number;     // default: current year - 5
  endYear?: number;       // default: current year
}

export interface EiaFetchParams {
  seriesIds?: EiaSeriesId[];
  startDate?: string;     // "2020-01-01"
  endDate?: string;
}
