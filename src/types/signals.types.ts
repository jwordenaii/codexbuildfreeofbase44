// =====================================================================
// The Worden Standard — Signal Store contracts
// Every src/lib/<source>.ts fetcher returns SourceFetchResult<T>.
// The persistence layer ingests these without source-specific knowledge.
// =====================================================================

export type SignalSource =
  | 'noaa'
  | 'fred'
  | 'sam'
  | 'census'
  | 'bls'
  | 'eia'
  | 'attom';

export type MetricUnit = 'count' | 'pct' | 'usd' | 'index' | 'days';

/**
 * One atomic, normalized fact ready for the signal store.
 * Every fetcher emits these alongside the raw payload.
 */
export interface NormalizedFact {
  metric: string;          // canonical: 'permits_total', 'sofr', 'jolts_construction_quits'
  geo: string;             // FIPS: 'US' | state ('51') | county ('51760')
  observedAt: string;      // ISO date YYYY-MM-DD — the date the metric is FOR
  value: number;
  unit: MetricUnit;
}

/**
 * The contract every src/lib/<source>.ts fetcher satisfies.
 * Generic T = the source's raw response shape.
 */
export interface SourceFetchResult<T = unknown> {
  source: SignalSource;
  endpoint: string;
  geo?: string;            // FIPS where applicable
  fetchedAt: string;       // ISO timestamp
  status: number;
  payload: T;
  normalized: NormalizedFact[];
  cacheKey: string;        // dedup hash
}

/**
 * Result of one scheduled ingest run — written to ingest_runs table.
 */
export interface IngestRunSummary {
  startedAt: string;
  finishedAt: string;
  sourcesAttempted: SignalSource[];
  sourcesSucceeded: SignalSource[];
  rowsRaw: number;
  rowsNormalized: number;
  error?: string;
}

/**
 * Prediction model output — written to predictions table.
 */
export interface PredictionRow {
  model: string;           // 'boom_probability_v1'
  geoFips: string;
  horizonDays: 30 | 90 | 180 | 365;
  score: number;           // 0-100
  components: PredictionComponent[];
  narrative?: string;
}

export interface PredictionComponent {
  signal: string;
  z: number;               // standardized score (-3 to +3, capped)
  contrib: number;         // contribution to final score
}
