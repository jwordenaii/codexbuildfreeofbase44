// census.types.ts
// src/types/census.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Types for Census BPS + ACS fetchers → WBP-v1 signal store
// ─────────────────────────────────────────────────────────────────────────────

// ─── Shared signal contract — re-exported from canonical signals.types.ts ────
// (avoid duplicate declarations; single source of truth for SourceFetchResult)

export type { NormalizedFact, SourceFetchResult } from './signals.types';

// ─── BPS (Building Permits Survey) raw response ───────────────────────────────
// Census BPS API returns arrays of arrays. First row is header.
// e.g. https://api.census.gov/data/timeseries/bps/county?get=BLDGS,UNITS,FIPS&...

export type BpsRow = [
  string,  // BLDGS — number of structures
  string,  // UNITS — number of housing units
  string,  // FIPS  — county FIPS code
  string,  // time  — YYYY-MM
];

export interface BpsRawResponse {
  header: string[];
  rows: BpsRow[];
}

// ─── BPS series types ─────────────────────────────────────────────────────────

export type BpsUnitType = '1'   // Single-family
                        | '2'   // 2-unit
                        | '34'  // 3–4 unit
                        | '5+'; // 5+ (multifamily)

export interface BpsObservation {
  fips: string;
  period: string;      // "2024-01"
  unitType: BpsUnitType;
  buildings: number;
  units: number;
}

// ─── ACS (American Community Survey) raw response ────────────────────────────
// ACS 5-year estimates: population, median income, housing units, vacancy rate

export type AcsRow = string[];  // column values, header row first

export interface AcsRawResponse {
  header: string[];
  rows: AcsRow[];
}

export interface AcsObservation {
  fips: string;
  year: number;
  totalPop: number;           // B01001_001E
  medianHHIncome: number;     // B19013_001E
  totalHousingUnits: number;  // B25001_001E
  vacantUnits: number;        // B25002_003E
  ownerOccupied: number;      // B25003_002E
  renterOccupied: number;     // B25003_003E
  medianHomeValue: number;    // B25077_001E
  medianGrossRent: number;    // B25064_001E
  constructionWorkers: number;// B24121_004E (construction occupations)
}

// ─── Fetch params ─────────────────────────────────────────────────────────────

export interface BpsFetchParams {
  fips?: string;           // county FIPS (default: all VA counties)
  years?: number[];        // e.g. [2020,2021,2022,2023,2024] — 5-year default
  unitTypes?: BpsUnitType[];
}

export interface AcsFetchParams {
  fips?: string;           // county FIPS or state FIPS
  years?: number[];        // ACS survey years
}
