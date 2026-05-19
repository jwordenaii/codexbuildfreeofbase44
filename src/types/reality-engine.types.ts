// reality-engine.types.ts
// src/types/reality-engine.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared types for RealityEngineNode.tsx + reality-engine.ts Netlify Function
// ─────────────────────────────────────────────────────────────────────────────

export type ScenarioKey =
  | 'cold_asphalt'
  | 'wet_earthwork'
  | 'schedule_crash'
  | 'wind_crane'
  | 'frost_concrete'
  | 'custom';

export type DecisionVerb = 'EXECUTE_NOW' | 'WAIT' | 'CRASH_SCHEDULE' | 'ABORT';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CounterMeasureType = 'MANDATORY' | 'RECOMMENDED' | 'CRITICAL';

// ─── Scenario input ────────────────────────────────────────────────────────────

export interface ScenarioInput {
  key: ScenarioKey;
  label: string;
  trade: string;
  waitCostPerDay: number;      // $ per day of delay (LD exposure, crew standby, etc.)
  executeCost: number;         // total cost if executed in bad conditions (rework, mat failure, etc.)
  daysToIdeal: number;         // expected days until weather window opens
  deadlinePressure: number;    // 0–100 slider: 0 = no deadline, 100 = LD clock running NOW
  crewSize: number;            // number of crew members on standby
  crewDailyRate: number;       // $ per day (crew standby + equipment)
  contractValue: number;       // total contract value for context
}

// ─── Weather snapshot (from NOAA) ────────────────────────────────────────────

export interface WeatherSnapshot {
  tempHigh: number;
  tempLow: number;
  groundTemp: number;
  windSpeed: number;
  precipMM: number;
  precipProbability: number;
  humidity: number;
  shortForecast: string;
  source: 'noaa' | 'synthetic';
  forecastWindowDays: number;    // how many days of clear weather ahead
  nextRainDays: number;          // days until next precip event
}

// ─── Countermeasure ───────────────────────────────────────────────────────────

export interface CounterMeasure {
  type: CounterMeasureType;
  action: string;
  spec?: string;
  cost?: number;
  timeRequired?: string;        // e.g. "4 hrs pre-treatment"
}

// ─── Arbitration verdict ──────────────────────────────────────────────────────

export interface ArbitrationVerdict {
  decision: DecisionVerb;
  headline: string;
  rationale: string;
  netSavings: number;           // positive = savings vs bad alternative
  riskLevel: RiskLevel;
  confidenceScore: number;      // 0–100 %
  countermeasures: CounterMeasure[];
  waitCostTotal: number;        // total cost of waiting daysToIdeal
  executeCostAdjusted: number;  // execute cost with countermeasures applied
  breakEvenDay: number;         // day at which waiting becomes more expensive than executing
  aiNarrative?: string;         // Anthropic-generated field narrative (optional)
  auditTimestamp: string;
  auditSignature: string;       // deterministic hash for audit trail
  weatherInfluence: string;     // plain-English weather impact statement
}

// ─── API request/response ─────────────────────────────────────────────────────

export interface RealityEngineRequest {
  scenario: ScenarioInput;
  lat?: number;
  lon?: number;
  useAI?: boolean;              // whether to call Anthropic for narrative
}

export interface RealityEngineResponse {
  verdict: ArbitrationVerdict;
  weather: WeatherSnapshot;
  generatedAt: string;
  error?: string;
}
