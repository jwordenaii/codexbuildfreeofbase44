// ═══════════════════════════════════════════════════════════════════════
// precon.types.ts  ·  Shared types for PreConOmniNode
// Import in component:  import type { ... } from '../types/precon.types';
// Import in function:   import type { ... } from '../src/types/precon.types';
// ═══════════════════════════════════════════════════════════════════════

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

export type SoilRisk    = 'low' | 'medium' | 'high';
export type WeatherRisk = 'green' | 'yellow' | 'red';
export type ActiveTab   = 'godmode' | 'heavy-civil';

// ─── WEATHER DAY ──────────────────────────────────────────────────────────────
// One entry per day in the 30-day NOAA forecast grid.

export interface WeatherDay {
  day:     number;    // 1–30
  tempF:   number;    // °F daytime high
  wind:    number;    // mph sustained
  rain:    number;    // % precipitation probability
  optimal: boolean;   // true = part of the identified optimal paving window
}

// ─── SITE ANALYSIS ────────────────────────────────────────────────────────────
// The canonical object returned by precon.api.ts and consumed by all sub-components.
// Every field that comes from an external API is nullable with a graceful — fallback.

export interface SiteAnalysis {
  // ── Identity ─────────────────────────────────────────────────────────────
  address:              string;
  lat:                  number;           // Mapbox geocode result
  lng:                  number;

  // ── Parcel (Mapbox Tilequery) ─────────────────────────────────────────────
  sqft:                 number;           // parcel area in square feet

  // ── Soil (USDA NRCS SDMDataAccess) ───────────────────────────────────────
  soilType:             string;           // e.g. "A-7-6 Expansive Clay"
  soilClass:            string;           // e.g. "High Plasticity Clay — AASHTO A-7-6"
  soilRisk:             SoilRisk;

  // ── Schedule & Profit ────────────────────────────────────────────────────
  optimalStartDay:      number;           // day offset from today (1-based)
  projectDays:          number;           // estimated calendar days
  baseProfit:           number;           // USD before soil/weather adjustments
  adjustedProfit:       number;           // USD after risk adjustments

  // ── Weather (NOAA api.weather.gov) ───────────────────────────────────────
  weatherRisk:          WeatherRisk;
  weatherDays:          WeatherDay[];     // 30-entry array

  // ── Earthwork (USGS 3DEP DEM) ────────────────────────────────────────────
  cutVolumeCY:          number;           // cubic yards to cut
  fillVolumeCY:         number;           // cubic yards of fill needed
  swellFactor:          number;           // decimal (0.15 = 15%)
  fillImportCost:       number;           // USD
  avgSlope:             number;           // percent (e.g. 2.5 = 2.5%)

  // ── Stormwater ────────────────────────────────────────────────────────────
  catchBasinsRequired:  number;           // Type-C catch basin count

  // ── Utilities ────────────────────────────────────────────────────────────
  utilityDepthFt:       number;           // water main depth in feet
  hasMunicipalMain:     boolean;          // municipal water main present

  // ── Traffic / MOT (OSM Overpass + MUTCD table) ───────────────────────────
  arterialRoad:         boolean;          // true = arterial class road within 50ft
  flaggersRequired:     number;           // 1 or 2
  motCostPerDay:        number;           // USD/day

  // ── Alerts ───────────────────────────────────────────────────────────────
  alerts:               string[];         // human-readable alert strings

  // ── Contract (Anthropic Claude) ───────────────────────────────────────────
  contractText:         string;           // multi-line contract proposal text
}

// ─── API REQUEST ──────────────────────────────────────────────────────────────

export interface PreConApiRequest {
  address:       string;     // full street address
  contractOnly?: boolean;    // if true, skip geo/soil/wx — only run contract gen
}

// ─── API RESPONSE ─────────────────────────────────────────────────────────────

export interface PreConApiResponse {
  analysis: SiteAnalysis | null;
  error?:   string;
}

// ─── SOIL OPTIONS REFERENCE ───────────────────────────────────────────────────
// For documentation / fallback seed logic only.

export const SOIL_OPTIONS: Array<{type: string; class: string; risk: SoilRisk}> = [
  { type: 'A-7-6 Expansive Clay',  class: 'High Plasticity Clay — AASHTO A-7-6', risk: 'high'   },
  { type: 'A-4 Silty Loam',        class: 'Silty Loam — AASHTO A-4',             risk: 'medium' },
  { type: 'A-1-a Granular',        class: 'Well-Graded Gravel — AASHTO A-1-a',   risk: 'low'    },
  { type: 'A-6 Clay Loam',         class: 'Clay Loam — AASHTO A-6',              risk: 'medium' },
  { type: 'A-2-4 Silty Gravel',    class: 'Silty Gravel/Sand — AASHTO A-2-4',    risk: 'low'    },
];

// ─── MUTCD MOT LOOKUP TABLE ───────────────────────────────────────────────────

export const MOT_TABLE: Record<string, { flaggers: number; costPerDay: number; type: string }> = {
  arterial:    { flaggers: 2, costPerDay: 1800, type: 'MUTCD Type-3' },
  collector:   { flaggers: 1, costPerDay: 1100, type: 'MUTCD Type-2' },
  local:       { flaggers: 1, costPerDay: 950,  type: 'MUTCD Type-1' },
};

// ─── VDOT SPEC LOOKUP ─────────────────────────────────────────────────────────

export const VDOT_SPEC: Record<SoilRisk, { surface: string; base: string; compaction: string; geogrid: boolean }> = {
  high:   { surface: '3" VDOT HD-12.5A', base: '8" Crushed Stone VDOT Sec 315', compaction: '96% Marshall Unit Weight', geogrid: true  },
  medium: { surface: '2.5" VDOT SM-12.5A', base: '6" Crushed Stone VDOT Sec 315', compaction: '96% Proctor T99', geogrid: false },
  low:    { surface: '2.5" VDOT SM-12.5A', base: '6" Crushed Stone VDOT Sec 315', compaction: '96% Proctor T99', geogrid: false },
};
