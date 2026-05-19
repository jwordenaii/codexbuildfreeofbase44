// sam.types.ts
// src/types/sam.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Types for SAM.gov federal awards signal fetcher → WBP-v1 signal store
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedFact, SourceFetchResult } from './signals.types';
export type { NormalizedFact, SourceFetchResult };

// ─── SAM.gov USASpending API types ────────────────────────────────────────────
// Using api.usaspending.gov (public, no key) and api.sam.gov (key required)
// Primary: USASpending /api/v2/search/spending_by_geography/ (free, no key)
// Secondary: SAM.gov /opportunities/v2/search (key required for private awards)

export type SamNaicsCode = '236' | '237' | '238'; // Construction divisions

// NAICS construction hierarchy:
//   236 = Construction of Buildings
//     2361 = Residential Building Construction
//     2362 = Nonresidential Building Construction
//   237 = Heavy and Civil Engineering Construction
//     2371 = Utility System Construction
//     2373 = Highway, Street, and Bridge Construction
//   238 = Specialty Trade Contractors
//     2381 = Foundation, Structure, and Building Exterior Contractors
//     2382 = Building Equipment Contractors
//     2383 = Building Finishing Contractors

export const NAICS_CONSTRUCTION: Record<string, string> = {
  '236': 'Construction of Buildings',
  '2361': 'Residential Building Construction',
  '2362': 'Nonresidential Building Construction',
  '237': 'Heavy & Civil Engineering',
  '2371': 'Utility System Construction',
  '2373': 'Highway, Street & Bridge',
  '238': 'Specialty Trade Contractors',
  '2381': 'Foundation & Exterior Contractors',
  '2382': 'Building Equipment Contractors',
  '2383': 'Building Finishing Contractors',
};

// ─── USASpending API response types ───────────────────────────────────────────

export interface UsaSpendingGeoResult {
  shape_code: string;            // FIPS state or county code
  display_name: string;
  aggregated_amount: number;     // $ total awards in period
  per_capita: number | null;
  award_count: number;
}

export interface UsaSpendingGeoResponse {
  scope: string;
  geo_layer: string;
  results: UsaSpendingGeoResult[];
}

export interface UsaSpendingTimeseriesResult {
  time_period: { fiscal_year: string; quarter?: string };
  aggregated_amount: number;
  award_count: number;
}

export interface UsaSpendingTimeseriesResponse {
  results: UsaSpendingTimeseriesResult[];
  messages: string[];
}

// ─── Normalized award observation ────────────────────────────────────────────

export interface SamAwardObservation {
  fips: string;                  // state or county FIPS
  naics: string;                 // NAICS code (3-6 digit)
  fiscalYear: number;
  totalAwards: number;           // $ USD
  awardCount: number;
}

// ─── Fetch params ─────────────────────────────────────────────────────────────

export interface SamFetchParams {
  naicsCodes?: string[];         // default: ['236','237','238']
  stateFips?: string;            // default: '51' (Virginia)
  fiscalYears?: number[];        // default: last 5 fiscal years
  geoLayer?: 'state' | 'county'; // default: 'state' (county is slower)
}
