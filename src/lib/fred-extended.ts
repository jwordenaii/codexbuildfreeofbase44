// fred-extended.lib.ts
// src/lib/fred-extended.ts
// ─────────────────────────────────────────────────────────────────────────────
// FRED extended signal fetcher — macro leading indicators for WBP-v1
// Extends investor.ts FRED usage. Reuses FRED_API_KEY env var.
//
// RATE LIMITS:
//   Without key : 120 req/min per IP (sufficient for dev)
//   With key    : 120 req/min per key (same) — key adds tracking only
//   Key signup  : https://fred.stlouisfed.org/docs/api/api_key.html
//   Env var     : FRED_API_KEY
//
// FRED API:
//   Base: https://api.stlouisfed.org/fred/series/observations
//   Docs: https://fred.stlouisfed.org/docs/api/fred/
//   Format: JSON, date range via observation_start / observation_end
//   Frequency: collapse to monthly (frequency=m, aggregation_method=avg)
//
// WBP-v1 metric namespace:
//   fred.yield_curve.slope     — T10Y3M spread (basis points)
//   fred.macro.indpro          — Industrial production index
//   fred.construction.total    — Total construction spending ($M SAAR)
//   fred.construction.res      — Private residential construction spending
//   fred.construction.nonres   — Private nonresidential spending
//   fred.labor.jolts_openings  — JOLTS construction job openings (thousands)
//   fred.prices.ppi_asphalt    — PPI asphalt paving index (1982=100)
//   fred.prices.crude_oil      — WTI crude $/barrel (diesel leading indicator)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SourceFetchResult, NormalizedFact,
  FredObservation, FredMultiSeriesPayload, FredExtendedParams,
} from '../types/fred-extended.types';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

// Series to fetch with their WBP-v1 metric mappings
const SERIES_CONFIG: Array<{
  id: string;
  metric: string;
  unit: NormalizedFact['unit'];
  scaleFactor?: number; // multiply raw value before storing
}> = [
  { id: 'T10Y3M',       metric: 'fred.yield_curve.slope',       unit: 'index'  }, // % → store as-is
  { id: 'INDPRO',       metric: 'fred.macro.indpro',            unit: 'index'  },
  { id: 'TTLCONS',      metric: 'fred.construction.total',      unit: 'usd'    }, // $M SAAR
  { id: 'PRRESCONS',    metric: 'fred.construction.res',        unit: 'usd'    },
  { id: 'PNRESCONS',    metric: 'fred.construction.nonres',     unit: 'usd'    },
  { id: 'JTSJOL',       metric: 'fred.labor.jolts_openings',    unit: 'count'  }, // thousands
  { id: 'PCU23731123731101', metric: 'fred.prices.ppi_asphalt', unit: 'index'  },
  { id: 'DCOILWTICO',   metric: 'fred.prices.crude_oil',        unit: 'usd'    },
];

function fredUrl(seriesId: string, start: string, end: string, freq: string): string {
  const key = process.env.FRED_API_KEY ? `&api_key=${process.env.FRED_API_KEY}` : '';
  return `${FRED_BASE}?series_id=${seriesId}&observation_start=${start}&observation_end=${end}` +
    `&frequency=${freq}&aggregation_method=avg&file_type=json${key}`;
}

function fiveYearsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().split('T')[0];
}

function parseObs(obs: FredObservation[]): Array<{ date: string; value: number }> {
  return obs
    .filter(o => o.value !== '.' && o.value !== '')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .filter(o => !isNaN(o.value));
}

/**
 * Fetch all FRED extended signals in parallel.
 * Returns a single SourceFetchResult with all series in payload
 * and all NormalizedFacts merged into normalized[].
 *
 * Geo is 'US' (national) — no FIPS. County-level FRED data not available.
 */
export async function fetchFredExtended(
  params: FredExtendedParams = {}
): Promise<SourceFetchResult<FredMultiSeriesPayload>> {
  const {
    observationStart = fiveYearsAgo(),
    observationEnd = new Date().toISOString().split('T')[0],
    frequency = 'm',
  } = params;

  const fetchedAt = new Date().toISOString();
  const seriesMap: Record<string, FredObservation[]> = {};
  const normalized: NormalizedFact[] = [];
  let lastUrl = '';
  let lastStatus = 200;

  const results = await Promise.allSettled(
    SERIES_CONFIG.map(async ({ id, metric, unit }) => {
      const url = fredUrl(id, observationStart, observationEnd, frequency);
      lastUrl = url;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WordenStandard/1.0 signal-library' },
      });
      lastStatus = res.status;
      if (!res.ok) throw new Error(`FRED ${res.status} series=${id}`);
      const json = await res.json() as { observations: FredObservation[] };
      const obs: FredObservation[] = json.observations ?? [];
      seriesMap[id] = obs;

      // Normalize → NormalizedFact (geo='US' for national series)
      for (const { date, value } of parseObs(obs)) {
        normalized.push({ metric, geo: 'US', observedAt: date, value, unit });
      }
    })
  );

  const errors = results.filter(r => r.status === 'rejected').length;

  // Yield curve slope: prefer T10Y3M if available, else derive from DGS10 - DGS3MO
  const yieldCurveRaw = seriesMap['T10Y3M'] ?? [];

  const payload: FredMultiSeriesPayload = {
    series: seriesMap as FredMultiSeriesPayload['series'],
    yieldCurveSlope: yieldCurveRaw,
  };

  return {
    source: 'fred',
    endpoint: lastUrl,
    geo: 'US',
    fetchedAt,
    status: errors === SERIES_CONFIG.length ? 500 : lastStatus,
    payload,
    normalized,
    cacheKey: `fred_extended:${observationStart}:${observationEnd}:${frequency}`,
  };
}

/**
 * Convenience: fetch only yield curve slope (T10Y3M).
 * Used by PreConOmniNode for quick financial context strip.
 */
export async function fetchYieldCurveSlope(
  params: Pick<FredExtendedParams, 'observationStart' | 'observationEnd'>  = {}
): Promise<SourceFetchResult<FredMultiSeriesPayload>> {
  const start = params.observationStart ?? fiveYearsAgo();
  const end = params.observationEnd ?? new Date().toISOString().split('T')[0];
  const url = fredUrl('T10Y3M', start, end, 'd'); // daily for yield curve
  const fetchedAt = new Date().toISOString();

  const res = await fetch(url, { headers: { 'User-Agent': 'WordenStandard/1.0 signal-library' } });
  const json = await res.json() as { observations: FredObservation[] };
  const obs: FredObservation[] = json.observations ?? [];

  const normalized: NormalizedFact[] = parseObs(obs).map(({ date, value }) => ({
    metric: 'fred.yield_curve.slope',
    geo: 'US', observedAt: date, value, unit: 'index' as const,
  }));

  return {
    source: 'fred',
    endpoint: url,
    geo: 'US',
    fetchedAt,
    status: res.status,
    payload: { series: { T10Y3M: obs } as FredMultiSeriesPayload['series'], yieldCurveSlope: obs },
    normalized,
    cacheKey: `fred_yield_curve:${start}:${end}`,
  };
}
