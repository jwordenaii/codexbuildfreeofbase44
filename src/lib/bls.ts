// bls.lib.ts
// src/lib/bls.ts
// ─────────────────────────────────────────────────────────────────────────────
// BLS signal fetcher — JOLTS construction + ECI wages + PPI materials
// Produces SourceFetchResult<T> for WBP-v1 signal store ingestion
//
// RATE LIMITS:
//   Without key : 25 req/day, max 10 series/request, 20 years max
//   With key    : 500 req/day, max 50 series/request, 20 years max
//   Key signup  : https://data.bls.gov/registrationEngine/
//   Env var     : BLS_API_KEY
//   Strategy    : Always use key — free registration, 500/day is plenty
//
// BLS API v2:
//   Base: https://api.bls.gov/publicAPI/v2/timeseries/data/
//   Docs: https://www.bls.gov/developers/api_signature_v2.htm
//   Format: JSON POST body { seriesid[], startyear, endyear, registrationkey }
//   JOLTS release lag: ~5 weeks after reference month
//   ECI release lag:   ~1 month after reference quarter
//
// WBP-v1 metric namespace:
//   bls.jolts.const.openings       — construction job openings (thousands)
//   bls.jolts.const.hires          — construction hires (thousands)
//   bls.jolts.const.quits          — construction quits (thousands, leading)
//   bls.jolts.const.layoffs        — construction layoffs (thousands)
//   bls.eci.const.wages            — ECI construction wages index (2001Q4=100)
//   bls.ppi.lumber                 — PPI softwood lumber
//   bls.ppi.steel                  — PPI iron & steel
//   bls.ppi.ready_mix              — PPI ready-mix concrete
//   bls.ppi.gypsum                 — PPI gypsum products
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SourceFetchResult, NormalizedFact,
  BlsObservation, BlsApiResponse,
  BlsFetchParams, BlsSeriesId,
} from '../types/bls-eia.types';
import { BLS_SERIES } from '../types/bls-eia.types';

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const CURRENT_YEAR = new Date().getFullYear();

// Metric mappings for normalization
const SERIES_META: Record<string, { metric: string; unit: NormalizedFact['unit'] }> = {
  [BLS_SERIES.JOLTS_OPENINGS_CONST]: { metric: 'bls.jolts.const.openings', unit: 'count' },
  [BLS_SERIES.JOLTS_HIRES_CONST]:    { metric: 'bls.jolts.const.hires',    unit: 'count' },
  [BLS_SERIES.JOLTS_QUITS_CONST]:    { metric: 'bls.jolts.const.quits',    unit: 'count' },
  [BLS_SERIES.JOLTS_LAYOFFS_CONST]:  { metric: 'bls.jolts.const.layoffs',  unit: 'count' },
  [BLS_SERIES.ECI_WAGES_CONST]:      { metric: 'bls.eci.const.wages',      unit: 'index' },
  [BLS_SERIES.PPI_LUMBER]:           { metric: 'bls.ppi.lumber',           unit: 'index' },
  [BLS_SERIES.PPI_STEEL]:            { metric: 'bls.ppi.steel',            unit: 'index' },
  [BLS_SERIES.PPI_READY_MIX]:       { metric: 'bls.ppi.ready_mix',        unit: 'index' },
  [BLS_SERIES.PPI_GYPSUM]:           { metric: 'bls.ppi.gypsum',           unit: 'index' },
};

function periodToDate(obs: BlsObservation): string | null {
  const year = parseInt(obs.year, 10);
  if (isNaN(year)) return null;
  if (obs.period.startsWith('M')) {
    const month = parseInt(obs.period.substring(1), 10);
    if (isNaN(month)) return null;
    return `${year}-${String(month).padStart(2,'0')}-01`;
  }
  if (obs.period.startsWith('Q')) {
    const q = parseInt(obs.period.substring(1), 10);
    const startMonth = (q - 1) * 3 + 1;
    return `${year}-${String(startMonth).padStart(2,'0')}-01`;
  }
  if (obs.period === 'A01') return `${year}-01-01`; // annual
  return null;
}

/**
 * Fetch BLS JOLTS + ECI + PPI construction signals.
 * Batches all series into a single POST request (BLS allows up to 50 with key).
 */
export async function fetchBls(
  params: BlsFetchParams = {}
): Promise<SourceFetchResult<BlsApiResponse>> {
  const {
    seriesIds = Object.values(BLS_SERIES) as BlsSeriesId[],
    startYear = CURRENT_YEAR - 5,
    endYear = CURRENT_YEAR,
  } = params;

  const fetchedAt = new Date().toISOString();
  const url = BLS_BASE;

  const body: Record<string, unknown> = {
    seriesid: seriesIds,
    startyear: String(startYear),
    endyear: String(endYear),
    calculations: false,
    annualaverage: false,
  };
  if (process.env.BLS_API_KEY) {
    body.registrationkey = process.env.BLS_API_KEY;
  }

  let rawResponse: BlsApiResponse | null = null;
  let status = 200;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WordenStandard/1.0 signal-library',
      },
      body: JSON.stringify(body),
    });
    status = res.status;
    if (!res.ok) throw new Error(`BLS ${res.status}`);
    rawResponse = await res.json() as BlsApiResponse;
  } catch (e) {
    // Return empty on error — component renders '—'
    rawResponse = { status: 'REQUEST_FAILED', responseDetails: String(e), message: [], Results: { series: [] } };
    status = 500;
  }

  const normalized: NormalizedFact[] = [];

  for (const series of rawResponse.Results?.series ?? []) {
    const meta = SERIES_META[series.seriesID];
    if (!meta) continue;
    for (const obs of series.data ?? []) {
      const date = periodToDate(obs);
      const value = parseFloat(obs.value);
      if (!date || isNaN(value)) continue;
      normalized.push({
        metric: meta.metric,
        geo: 'US',        // BLS national series — no FIPS
        observedAt: date,
        value,
        unit: meta.unit,
      });
    }
  }

  return {
    source: 'bls',
    endpoint: url,
    geo: 'US',
    fetchedAt,
    status,
    payload: rawResponse,
    normalized,
    cacheKey: `bls:${seriesIds.join(',')}${startYear}:${endYear}`,
  };
}
