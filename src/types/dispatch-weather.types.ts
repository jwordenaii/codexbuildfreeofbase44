// dispatch-weather.types.ts
// src/types/dispatch-weather.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared types for DispatchWeatherStation.tsx + dispatch.ts Netlify Function
// ─────────────────────────────────────────────────────────────────────────────

export type Trade = 'asphalt' | 'concrete' | 'earthwork' | 'crane' | 'roofing';
export type DayStatus = 'optimal' | 'marginal' | 'nogo';
export type ViewMode = '14day' | '90day';

// ─── Core weather data model ──────────────────────────────────────────────────

export interface WeatherDay {
  dayIndex: number;         // 1-based sequence
  date: string;             // ISO 8601 e.g. "2026-05-14"
  month: string;            // "May"
  dayOfMonth: number;       // 14
  dayOfWeek: string;        // "Thu"
  tempHigh: number;         // °F
  tempLow: number;          // °F
  groundTemp: number;       // °F estimated soil temp
  windSpeed: number;        // mph sustained
  windGust?: number;        // mph gust
  precipMM: number;         // mm expected
  precipProbability: number; // 0–100 %
  humidity: number;         // %
  dewPoint: number;         // °F
  shortForecast?: string;   // "Partly Cloudy"
  detailedForecast?: string;
  isWeekend: boolean;
  source: 'noaa' | 'synthetic'; // data provenance
}

// ─── Trade-specific risk analysis ─────────────────────────────────────────────

export interface DayAnalysis {
  day: WeatherDay;
  status: DayStatus;
  riskLabel: string;
  financialRisk: number;     // $ at risk (negative = potential loss)
  profitProtection: number;  // % of margin protected (0–100)
  warnings: string[];
  seasonalAlert?: string;
}

// ─── Crew / Dispatch types ────────────────────────────────────────────────────

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  certifications: string[];
  available: boolean;
}

export interface Job {
  id: string;
  name: string;
  trade: Trade;
  address: string;
  startDate: string;   // ISO date
  endDate: string;     // ISO date
  crewIds: string[];
  estimatedRevenue: number;
  status: 'scheduled' | 'active' | 'paused' | 'complete';
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface NoaaForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: 'F' | 'C';
  windSpeed: string;       // "10 mph"
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
  relativeHumidity?: { value: number | null };
  dewpoint?: { value: number | null };
}

export interface DispatchApiResponse {
  forecast: WeatherDay[];
  station?: string;
  gridId?: string;
  gridX?: number;
  gridY?: number;
  generatedAt?: string;
  error?: string;
}
