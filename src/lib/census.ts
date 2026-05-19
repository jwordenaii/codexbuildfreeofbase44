// census.lib.ts
// src/lib/census.ts
// ─────────────────────────────────────────────────────────────────────────────
// Census signal fetchers — BPS (Building Permits Survey) + ACS demographics
// Produces SourceFetchResult<T> ready for WBP-v1 signal store ingestion
//
// RATE LIMITS:
//   Without key : 500 req/day per IP (shared)
//   With key    : 500 req/day per key (individual) — no cost, instant signup
//   Key signup  : https://api.census.gov/data/key_signup.html
//   Env var     : CENSUS_API_KEY
//
// BPS API:
//   Base: https://api.census.gov/data/timeseries/bps
//   Docs: https://www.census.gov/data/developers/data-sets/building-permits.html
//   Geo:  nation / state / county / place / division
//   Lag:  ~3 months (monthly data, released ~60 days after period end)
//
// ACS API (5-year estimates):
//   Base: https://api.census.gov/data/{year}/acs/acs5
//   Docs: https://www.census.gov/data/developers/data-sets/acs-5year.html
//   Lag:  ~1 year (5-year estimates released annually in December)
//
// WBP-v1 metric namespace: bps.permits.*, acs.pop.*, acs.housing.*
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SourceFetchResult, NormalizedFact,
  BpsRawResponse, BpsObservation, BpsUnitType,
  AcsRawResponse, AcsObservation,
  BpsFetchParams, AcsFetchParams,
} from '../types/census.types';

const BPS_BASE = 'https://api.census.gov/data/timeseries/bps';
const ACS_BASE = 'https://api.census.gov/data';

// Virginia default — override via params for nationwide coverage
const VA_STATE_FIPS = '51';
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_YEARS = [
  CURRENT_YEAR - 5, CURRENT_YEAR - 4, CURRENT_YEAR - 3,
  CURRENT_YEAR - 2, CURRENT_YEAR - 1,
];

function apiKey(): string {
  return process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : '';
}

// ─── BPS: Building Permits Survey ────────────────────────────────────────────

/**
 * Fetch monthly building permit counts by county and unit type.
 * Returns 5 years of history by default (60 monthly observations per county).
 *
 * Metric names produced:
 *   bps.permits.single_unit    — 1-unit structures (best proxy for SFR demand)
 *   bps.permits.multifamily    — 5+ unit structures
 *   bps.permits.total_units    — all unit types combined
 */
export async function fetchBps(params: BpsFetchParams = {}): Promise<SourceFetchResult<BpsRawResponse>> {
  const {
    fips = VA_STATE_FIPS,
    years = DEFAULT_YEARS,
    unitTypes = ['1', '5+'],
  } = params;

  // BPS requires one request per (year, unit-type) pair. Batch with allSettled.
  const requests: Array<{ year: number; unitType: BpsUnitType; url: string }> = [];
  for (const year of years) {
    for (const ut of unitTypes) {
      // for-loop produces month pairs; use annual aggregate (?for=county)
      const url = `${BPS_BASE}/county?get=BLDGS,UNITS,county,state` +
        `&for=county:*&in=state:${fips.substring(0, 2)}` +
        `&YEAR=${year}&UNIT=${ut}${apiKey()}`;
      requests.push({ year, unitType: ut as BpsUnitType, url });
    }
  }

  const fetchedAt = new Date().toISOString();
  const allRows: BpsObservation[] = [];
  const errors: string[] = [];
  let lastStatus = 200;
  let lastUrl = '';

  const results = await Promise.allSettled(
    requests.map(async ({ year, unitType, url }) => {
      lastUrl = url;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WordenStandard/1.0 signal-library' },
      });
      lastStatus = res.status;
      if (!res.ok) throw new Error(`BPS ${res.status} year=${year} ut=${unitType}`);
      const json: string[][] = await res.json();
      const [, ...rows] = json; // drop header row
      for (const row of rows) {
        // row: [BLDGS, UNITS, county, state, year?, ...]
        const buildings = parseInt(row[0] ?? '0', 10);
        const units = parseInt(row[1] ?? '0', 10);
        const countyFips = (row[3] ?? '00') + (row[2] ?? '000'); // state+county
        allRows.push({
          fips: countyFips,
          period: `${year}-01`, // annual — January represents the year
          unitType,
          buildings: isNaN(buildings) ? 0 : buildings,
          units: isNaN(units) ? 0 : units,
        });
      }
    })
  );

  results.forEach((r) => {
    if (r.status === 'rejected') errors.push(String(r.reason));
  });

  // Normalize → NormalizedFact[]
  const normalized: NormalizedFact[] = allRows.flatMap((obs): NormalizedFact[] => {
    const metricBase = obs.unitType === '1' ? 'bps.permits.single_unit'
      : obs.unitType === '5+' ? 'bps.permits.multifamily'
      : `bps.permits.unit_${obs.unitType}`;
    return [
      {
        metric: metricBase + '.buildings',
        geo: obs.fips,
        observedAt: obs.period,
        value: obs.buildings,
        unit: 'count',
      },
      {
        metric: metricBase + '.units',
        geo: obs.fips,
        observedAt: obs.period,
        value: obs.units,
        unit: 'count',
      },
    ];
  });

  const payload: BpsRawResponse = {
    header: ['BLDGS', 'UNITS', 'FIPS', 'period', 'unitType'],
    rows: allRows.map(o => [
      String(o.buildings), String(o.units), o.fips, o.period,
    ] as [string, string, string, string]),
  };

  return {
    source: 'census',
    endpoint: lastUrl,
    geo: fips,
    fetchedAt,
    status: errors.length === requests.length ? 500 : lastStatus,
    payload,
    normalized,
    cacheKey: `census_bps:${fips}:${years.join(',')}`,
  };
}

// ─── ACS: American Community Survey (5-year estimates) ───────────────────────

/**
 * Fetch ACS 5-year housing + demographic indicators by county.
 * Variables: population, median HH income, housing stock, vacancy, tenure,
 *            median home value, median rent, construction worker count.
 *
 * Metric names produced:
 *   acs.pop.total              — total population
 *   acs.housing.units          — total housing units
 *   acs.housing.vacancy_rate   — % vacant (derived)
 *   acs.housing.median_value   — median owner-occupied value ($)
 *   acs.housing.median_rent    — median gross rent ($/mo)
 *   acs.econ.median_hh_income  — median household income ($)
 *   acs.labor.construction     — construction occupation worker count
 */
export async function fetchAcs(params: AcsFetchParams = {}): Promise<SourceFetchResult<AcsRawResponse>> {
  const {
    fips = VA_STATE_FIPS,
    years = DEFAULT_YEARS.filter(y => y <= CURRENT_YEAR - 1), // ACS lags ~1yr
  } = params;

  const VARS = [
    'B01001_001E',  // total population
    'B19013_001E',  // median HH income
    'B25001_001E',  // total housing units
    'B25002_003E',  // vacant units
    'B25003_002E',  // owner occupied
    'B25003_003E',  // renter occupied
    'B25077_001E',  // median home value
    'B25064_001E',  // median gross rent
    'B24121_004E',  // construction occupations
  ].join(',');

  const fetchedAt = new Date().toISOString();
  const allObs: AcsObservation[] = [];
  const errors: string[] = [];
  let lastStatus = 200;
  let lastUrl = '';

  const stateFips = fips.substring(0, 2);

  const results = await Promise.allSettled(
    years.map(async (year) => {
      const url = `${ACS_BASE}/${year}/acs/acs5?get=${VARS}` +
        `&for=county:*&in=state:${stateFips}${apiKey()}`;
      lastUrl = url;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WordenStandard/1.0 signal-library' },
      });
      lastStatus = res.status;
      if (!res.ok) throw new Error(`ACS ${res.status} year=${year}`);
      const json: string[][] = await res.json();
      const [, ...rows] = json;
      for (const row of rows) {
        const safe = (i: number) => { const n = parseInt(row[i] ?? '-1', 10); return isNaN(n) || n < 0 ? 0 : n; };
        const countyFips = (row[9] ?? '00') + (row[10] ?? '000'); // state+county at end
        allObs.push({
          fips: countyFips,
          year,
          totalPop: safe(0),
          medianHHIncome: safe(1),
          totalHousingUnits: safe(2),
          vacantUnits: safe(3),
          ownerOccupied: safe(4),
          renterOccupied: safe(5),
          medianHomeValue: safe(6),
          medianGrossRent: safe(7),
          constructionWorkers: safe(8),
        });
      }
    })
  );

  results.forEach(r => { if (r.status === 'rejected') errors.push(String(r.reason)); });

  const normalized: NormalizedFact[] = allObs.flatMap((obs): NormalizedFact[] => {
    const d = `${obs.year}-01-01`;
    const vacancyRate = obs.totalHousingUnits > 0
      ? Math.round((obs.vacantUnits / obs.totalHousingUnits) * 10000) / 100
      : 0;
    return [
      { metric: 'acs.pop.total',             geo: obs.fips, observedAt: d, value: obs.totalPop,           unit: 'count' },
      { metric: 'acs.econ.median_hh_income', geo: obs.fips, observedAt: d, value: obs.medianHHIncome,     unit: 'usd'   },
      { metric: 'acs.housing.units',         geo: obs.fips, observedAt: d, value: obs.totalHousingUnits,  unit: 'count' },
      { metric: 'acs.housing.vacancy_rate',  geo: obs.fips, observedAt: d, value: vacancyRate,            unit: 'pct'   },
      { metric: 'acs.housing.owner_occ',     geo: obs.fips, observedAt: d, value: obs.ownerOccupied,      unit: 'count' },
      { metric: 'acs.housing.renter_occ',    geo: obs.fips, observedAt: d, value: obs.renterOccupied,     unit: 'count' },
      { metric: 'acs.housing.median_value',  geo: obs.fips, observedAt: d, value: obs.medianHomeValue,    unit: 'usd'   },
      { metric: 'acs.housing.median_rent',   geo: obs.fips, observedAt: d, value: obs.medianGrossRent,    unit: 'usd'   },
      { metric: 'acs.labor.construction',    geo: obs.fips, observedAt: d, value: obs.constructionWorkers,unit: 'count' },
    ];
  });

  const payload: AcsRawResponse = {
    header: ['B01001_001E','B19013_001E','B25001_001E','B25002_003E','B25003_002E','B25003_003E','B25077_001E','B25064_001E','B24121_004E','state','county'],
    rows: allObs.map(o => [
      String(o.totalPop), String(o.medianHHIncome), String(o.totalHousingUnits),
      String(o.vacantUnits), String(o.ownerOccupied), String(o.renterOccupied),
      String(o.medianHomeValue), String(o.medianGrossRent), String(o.constructionWorkers),
      o.fips.substring(0, 2), o.fips.substring(2),
    ]),
  };

  return {
    source: 'census',
    endpoint: lastUrl,
    geo: fips,
    fetchedAt,
    status: errors.length === years.length ? 500 : lastStatus,
    payload,
    normalized,
    cacheKey: `census_acs:${fips}:${years.join(',')}`,
  };
}
