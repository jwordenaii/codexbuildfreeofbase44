// sam.lib.ts
// src/lib/sam.ts
// ─────────────────────────────────────────────────────────────────────────────
// SAM.gov / USASpending federal construction awards signal fetcher
// Produces SourceFetchResult<T> for WBP-v1 signal store ingestion
//
// RATE LIMITS:
//   USASpending (api.usaspending.gov) — PRIMARY, NO KEY REQUIRED:
//     No stated per-minute limit. Practically: ~30 req/min safe.
//     Docs: https://api.usaspending.gov/
//     Use for: geographic award totals, fiscal year timeseries
//
//   SAM.gov (api.sam.gov) — SECONDARY, KEY REQUIRED for private data:
//     Without key: 10 req/min, federal opportunities only (public)
//     With key   : 450 req/min
//     Key signup : https://open.gsa.gov/apis/sam/
//     Env var    : SAM_API_KEY
//
// STRATEGY: Use USASpending as primary (free, keyless, rich data).
//   SAM.gov used only if SAM_API_KEY present (adds solicitation pipeline data).
//
// WBP-v1 metric namespace:
//   sam.awards.total_usd          — total federal award $ by state/county
//   sam.awards.count              — number of awards
//   sam.awards.naics_{code}_usd   — award $ by NAICS division
//   sam.pipeline.solicitations    — open SAM solicitations (key required)
//
// FISCAL YEAR NOTE: USASpending uses US fiscal year (Oct–Sep).
//   FY2024 = Oct 2023 – Sep 2024.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SourceFetchResult, NormalizedFact,
  SamFetchParams, SamAwardObservation,
  UsaSpendingGeoResponse, UsaSpendingTimeseriesResponse,
} from '../types/sam.types';

const USA_SPENDING_BASE = 'https://api.usaspending.gov/api/v2';
const SAM_BASE = 'https://api.sam.gov/opportunities/v2';

const CURRENT_FY = new Date().getMonth() >= 9
  ? new Date().getFullYear() + 1  // Oct onwards = new fiscal year
  : new Date().getFullYear();

const DEFAULT_NAICS = ['236', '237', '238'];
const DEFAULT_FYS = [CURRENT_FY - 5, CURRENT_FY - 4, CURRENT_FY - 3, CURRENT_FY - 2, CURRENT_FY - 1];

// ─── USASpending: geographic award totals ────────────────────────────────────

async function fetchUsaSpendingGeo(
  naics: string,
  fiscalYear: number,
  geoLayer: 'state' | 'county',
  stateFips: string,
): Promise<{ results: SamAwardObservation[]; endpoint: string; status: number }> {
  const body = {
    filters: {
      naics_codes: [naics],
      time_period: [{ start_date: `${fiscalYear - 1}-10-01`, end_date: `${fiscalYear}-09-30` }],
      place_of_performance_locations: [{ country: 'USA', state: stateFips }],
    },
    geo_layer: geoLayer,
    geo_layer_filters: geoLayer === 'county' ? [stateFips] : undefined,
    scope: 'place_of_performance',
  };

  const url = `${USA_SPENDING_BASE}/search/spending_by_geography/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'WordenStandard/1.0 signal-library' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return { results: [], endpoint: url, status: res.status };
  const json = await res.json() as UsaSpendingGeoResponse;

  const results: SamAwardObservation[] = (json.results ?? []).map(r => ({
    fips: r.shape_code ?? stateFips,
    naics,
    fiscalYear,
    totalAwards: r.aggregated_amount ?? 0,
    awardCount: r.award_count ?? 0,
  }));

  return { results, endpoint: url, status: res.status };
}

// ─── SAM.gov: open solicitations count (key required) ────────────────────────

async function fetchSamSolicitations(
  naics: string,
  stateFips: string,
): Promise<{ count: number; endpoint: string; status: number }> {
  const key = process.env.SAM_API_KEY;
  if (!key) return { count: 0, endpoint: '', status: 0 };

  const url = `${SAM_BASE}/search?api_key=${key}` +
    `&naicsCode=${naics}&placeOfPerformanceState=${stateFips}` +
    `&active=true&postedFrom=${new Date(Date.now() - 90*86400000).toISOString().split('T')[0]}` +
    `&limit=1`; // we only need the total count from response metadata

  const res = await fetch(url, { headers: { 'User-Agent': 'WordenStandard/1.0 signal-library' } });
  if (!res.ok) return { count: 0, endpoint: url, status: res.status };
  const json = await res.json() as { totalRecords?: number };
  return { count: json.totalRecords ?? 0, endpoint: url, status: res.status };
}

// ─── Main fetcher ─────────────────────────────────────────────────────────────

/**
 * Fetch federal construction award totals from USASpending by NAICS + geography.
 * Returns 5 years of history by default.
 *
 * No API key required for primary data source (USASpending).
 * SAM_API_KEY adds solicitation pipeline count as bonus signal.
 */
export async function fetchSam(
  params: SamFetchParams = {}
): Promise<SourceFetchResult<{ awards: SamAwardObservation[]; solicitations: Record<string, number> }>> {
  const {
    naicsCodes = DEFAULT_NAICS,
    stateFips = '51',
    fiscalYears = DEFAULT_FYS,
    geoLayer = 'state',
  } = params;

  const fetchedAt = new Date().toISOString();
  const allObs: SamAwardObservation[] = [];
  let lastUrl = '';
  let lastStatus = 200;
  let errorCount = 0;
  const total = naicsCodes.length * fiscalYears.length;

  // Fetch all (naics × year) combinations in parallel
  const results = await Promise.allSettled(
    naicsCodes.flatMap(naics =>
      fiscalYears.map(fy =>
        fetchUsaSpendingGeo(naics, fy, geoLayer, stateFips).then(r => {
          lastUrl = r.endpoint;
          lastStatus = r.status;
          allObs.push(...r.results);
        })
      )
    )
  );

  results.forEach(r => { if (r.status === 'rejected') errorCount++; });

  // Optional SAM solicitations (bonus signal)
  const solicitations: Record<string, number> = {};
  const samResults = await Promise.allSettled(
    naicsCodes.map(async naics => {
      const { count } = await fetchSamSolicitations(naics, stateFips);
      if (count > 0) solicitations[naics] = count;
    })
  );
  void samResults; // non-critical, consume promise

  // Normalize → NormalizedFact[]
  const normalized: NormalizedFact[] = allObs.flatMap((obs): NormalizedFact[] => [
    {
      metric: `sam.awards.naics_${obs.naics}_usd`,
      geo: obs.fips,
      observedAt: `${obs.fiscalYear - 1}-10-01`, // FY start date
      value: obs.totalAwards,
      unit: 'usd',
    },
    {
      metric: `sam.awards.naics_${obs.naics}_count`,
      geo: obs.fips,
      observedAt: `${obs.fiscalYear - 1}-10-01`,
      value: obs.awardCount,
      unit: 'count',
    },
  ]);

  // Add solicitation pipeline signals
  for (const [naics, count] of Object.entries(solicitations)) {
    normalized.push({
      metric: `sam.pipeline.solicitations_${naics}`,
      geo: stateFips,
      observedAt: new Date().toISOString().split('T')[0],
      value: count,
      unit: 'count',
    });
  }

  return {
    source: 'sam',
    endpoint: lastUrl,
    geo: stateFips,
    fetchedAt,
    status: errorCount === total ? 500 : lastStatus,
    payload: { awards: allObs, solicitations },
    normalized,
    cacheKey: `sam:${stateFips}:${naicsCodes.join(',')}${fiscalYears.join(',')}`,
  };
}
