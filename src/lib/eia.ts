// eia.lib.ts
// src/lib/eia.ts
// ─────────────────────────────────────────────────────────────────────────────
// EIA signal fetcher — diesel, crude oil, and asphalt cement prices
// Produces SourceFetchResult<T> for WBP-v1 signal store ingestion
//
// RATE LIMITS:
//   Without key : 5,000 req/hr per IP (very generous)
//   With key    : 5,000 req/hr per key (same)
//   Key signup  : https://www.eia.gov/opendata/register.php (instant)
//   Env var     : EIA_API_KEY
//   Note        : Key recommended — ensures continuity if IP limits tighten
//
// EIA Open Data API v2:
//   Base: https://api.eia.gov/v2/
//   Docs: https://www.eia.gov/opendata/
//   Format: GET with query params, JSON response
//   Frequency: weekly (diesel), monthly (asphalt)
//   Data lag: diesel ~1 week, asphalt ~2 months
//
// KEY SERIES:
//   Diesel (weekly): On-highway diesel retail — direct input to job cost
//   Crude WTI (weekly): Leading indicator for diesel in 2–3 weeks
//   Asphalt & Road Oil (monthly): Matches VDOT price adjustment clauses
//
// WBP-v1 metric namespace:
//   eia.fuel.diesel_us            — US avg on-highway diesel $/gal (weekly)
//   eia.fuel.diesel_east          — East Coast diesel $/gal (regional)
//   eia.fuel.crude_wti            — WTI crude spot $/bbl (weekly)
//   eia.materials.asphalt         — Asphalt & road oil $/gal (monthly)
//
// CONTRACTOR USE:
//   Diesel direct-costs asphalt haul trucks, paving equipment, rollers.
//   Rule of thumb: +$0.10/gal diesel = +$0.25/ton delivered asphalt cost.
//   Asphalt price feeds VDOT price adjustment factor (PAF) claims.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SourceFetchResult, NormalizedFact,
  EiaDataPoint, EiaSeriesResponse,
  EiaFetchParams,
} from '../types/bls-eia.types';
import { EIA_SERIES } from '../types/bls-eia.types';

const EIA_BASE = 'https://api.eia.gov/v2';

// Map series route fragments to WBP-v1 metrics
const SERIES_META: Array<{
  id: string;
  route: string;           // EIA API v2 route
  valueField: string;      // which field in response has the value
  metric: string;
  unit: NormalizedFact['unit'];
}> = [
  {
    id: 'diesel_us',
    route: 'petroleum/pri/gnd/data',
    valueField: 'value',
    metric: 'eia.fuel.diesel_us',
    unit: 'usd',
  },
  {
    id: 'crude_wti',
    route: 'petroleum/pri/spt/data',
    valueField: 'value',
    metric: 'eia.fuel.crude_wti',
    unit: 'usd',
  },
  {
    id: 'asphalt',
    route: 'petroleum/pri/refoth/data',
    valueField: 'value',
    metric: 'eia.materials.asphalt',
    unit: 'usd',
  },
];

function eiaKey(): string {
  return process.env.EIA_API_KEY ? `&api_key=${process.env.EIA_API_KEY}` : '';
}

function fiveYearsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().split('T')[0];
}

/**
 * Fetch a single EIA v2 series with date range.
 * EIA v2 uses facet filters rather than series IDs directly.
 */
async function fetchEiaSeries(
  route: string,
  facets: Record<string, string>,
  startDate: string,
  endDate: string,
  frequency: 'weekly' | 'monthly',
): Promise<{ data: EiaDataPoint[]; url: string; status: number }> {
  const facetStr = Object.entries(facets)
    .map(([k, v]) => `&facets[${k}][]=${v}`)
    .join('');

  const url = `${EIA_BASE}/${route}?frequency=${frequency}&data[0]=value` +
    `&start=${startDate}&end=${endDate}&sort[0][column]=period&sort[0][direction]=desc` +
    `&length=5000${facetStr}${eiaKey()}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'WordenStandard/1.0 signal-library' },
  });
  if (!res.ok) return { data: [], url, status: res.status };
  const json = await res.json() as EiaSeriesResponse;
  return { data: json.response?.data ?? [], url, status: res.status };
}

/**
 * Fetch EIA fuel and material price signals.
 * All signals fetched in parallel; each returns {} on failure.
 */
export async function fetchEia(
  params: EiaFetchParams = {}
): Promise<SourceFetchResult<{ series: Record<string, EiaDataPoint[]> }>> {
  const {
    startDate = fiveYearsAgo(),
    endDate = new Date().toISOString().split('T')[0],
  } = params;

  const fetchedAt = new Date().toISOString();
  const seriesData: Record<string, EiaDataPoint[]> = {};
  const normalized: NormalizedFact[] = [];
  let lastUrl = '';
  let lastStatus = 200;
  let errorCount = 0;

  // EIA v2 uses product codes as facets
  // Diesel: product=EPD2DXL0 (on-highway diesel, all grades), areaCode=NUS (national)
  // Crude: product=EPC0 (crude oil), series=RWTC (WTI Cushing)
  // Asphalt: product=EPD2F (asphalt), process=PRS (resale)
  const seriesFetches = [
    {
      id: 'diesel_us',
      route: 'petroleum/pri/gnd/data',
      facets: { product: 'EPD2DXL0', areacode: 'NUS' },
      freq: 'weekly' as const,
      metric: 'eia.fuel.diesel_us',
      unit: 'usd' as NormalizedFact['unit'],
    },
    {
      id: 'crude_wti',
      route: 'petroleum/pri/spt/data',
      facets: { series: 'RWTC' },
      freq: 'weekly' as const,
      metric: 'eia.fuel.crude_wti',
      unit: 'usd' as NormalizedFact['unit'],
    },
    {
      id: 'asphalt',
      route: 'petroleum/pri/refoth/data',
      facets: { product: 'EPD2F', process: 'PRS', areacode: 'NUS' },
      freq: 'monthly' as const,
      metric: 'eia.materials.asphalt',
      unit: 'usd' as NormalizedFact['unit'],
    },
  ];

  const results = await Promise.allSettled(
    seriesFetches.map(async (s) => {
      const { data, url, status } = await fetchEiaSeries(s.route, s.facets, startDate, endDate, s.freq);
      lastUrl = url;
      lastStatus = status;
      seriesData[s.id] = data;

      for (const point of data) {
        if (point.value == null) continue;
        // Period is "2024-01-01" for monthly, "2024-W01" for weekly
        const obsDate = point.period.includes('W')
          ? (() => {
              // Convert "2024-W05" → Monday of that week
              const [yr, wk] = point.period.split('-W').map(Number);
              const jan1 = new Date(yr, 0, 1);
              const days = (wk - 1) * 7 - jan1.getDay() + 1;
              const d = new Date(jan1);
              d.setDate(d.getDate() + days);
              return d.toISOString().split('T')[0];
            })()
          : point.period;

        normalized.push({
          metric: s.metric,
          geo: 'US',
          observedAt: obsDate,
          value: point.value,
          unit: s.unit,
        });
      }
    })
  );

  results.forEach(r => { if (r.status === 'rejected') errorCount++; });

  return {
    source: 'eia',
    endpoint: lastUrl,
    geo: 'US',
    fetchedAt,
    status: errorCount === seriesFetches.length ? 500 : lastStatus,
    payload: { series: seriesData },
    normalized,
    cacheKey: `eia:${startDate}:${endDate}`,
  };
}
