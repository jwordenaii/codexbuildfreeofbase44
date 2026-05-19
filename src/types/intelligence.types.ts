// ═══════════════════════════════════════════════════════════════════════
// api/intelligence.types.ts
// Shared TypeScript types for IronGridMap intelligence platform.
// Import into both the component and the API handler.
// ═══════════════════════════════════════════════════════════════════════

export type Trend = 'up' | 'down' | 'flat';

export type DataLayer =
  | 'construction'   // Google Trends keyword demand by state
  | 'realestate'     // Zillow / ATTOM median price, listings, DOM
  | 'respermits'     // Census BPS residential units authorized
  | 'compermits'     // Census C404 commercial permit value
  | 'rawmaterials'   // OPIS asphalt · BLS PPI · CME steel · EIA diesel
  | 'civil'          // FHWA · SAM.gov · FEMA · state DOT bids
  | 'labor'          // BLS QCEW construction employment + job postings
  | 'weather';       // NOAA temp · freeze-thaw · paving season status

export type ConstructionCluster =
  | 'paving'         // asphalt, driveway, sealcoating, resurfacing
  | 'concrete'       // flatwork, slab, driveways, repair
  | 'sitework'       // excavation, grading, land clearing
  | 'utilities'      // trenching, water line, sewer, HDD
  | 'heavycivil'     // DOT, VDOT, infrastructure, highway
  | 'roofing';       // commercial, TPO, flat roof, metal

// ─── STATE SIGNAL ────────────────────────────────────────────────────────────
// One record per state (+ DC). All nullable fields are populated only
// when the corresponding API returns data. The component handles nulls
// gracefully with '—' display and zero intensity.

export interface StateSignal {
  abbr: string;

  // ── Layer 1: Construction Demand ──────────────────────────────────────
  constructionInterest:    number;          // 0–100 Google Trends relative
  constructionTrend:       Trend;
  topKeyword:              string;          // highest-volume keyword this fetch
  keywordCluster:          ConstructionCluster;

  // ── Layer 2: Real Estate ──────────────────────────────────────────────
  medianListPrice:         number | null;   // USD
  activeListings:          number | null;   // count
  daysOnMarket:            number | null;   // median DOM
  priceChangePct:          number | null;   // YoY %  (+ = appreciation)
  saleToListRatio:         number | null;   // 1.0 = at asking
  realEstateTrend:         Trend;

  // ── Layer 3: Residential Permits ──────────────────────────────────────
  resSingleFamily:         number | null;   // units authorized / month
  resMultiFamily:          number | null;   // units authorized / month
  resTotalUnits:           number | null;   // SF + MF
  resPermitChangePct:      number | null;   // YoY %
  resPermitTrend:          Trend;

  // ── Layer 4: Commercial Permits ───────────────────────────────────────
  comOfficeRetail:         number | null;   // $M value authorized
  comIndustrialWarehouse:  number | null;   // $M value authorized
  comTotalValue:           number | null;   // $M total
  comPermitChangePct:      number | null;   // YoY %
  comPermitTrend:          Trend;

  // ── Layer 5: Raw Materials ────────────────────────────────────────────
  asphaltPriceIndex:       number | null;   // OPIS indexed (100 = baseline)
  concretePPI:             number | null;   // BLS PPI indexed
  steelRebarIndex:         number | null;   // CME indexed
  lumberPPI:               number | null;   // BLS PPI indexed
  dieselPricePerGallon:    number | null;   // EIA $/gal (state avg)
  aggregateDemandIndex:    number | null;   // USGS indexed
  materialsCostTrend:      Trend;

  // ── Layer 6: Civil / Infrastructure ──────────────────────────────────
  fhwaObligatedM:          number | null;   // $M FHWA funds obligated YTD
  samGovContractsCount:    number | null;   // open federal construction awards
  femaDeclarations:        number | null;   // active major disaster declarations
  dotActiveBids:           number | null;   // state DOT open solicitations
  civilDemandScore:        number;          // 0–100 composite
  civilTrend:              Trend;

  // ── Layer 7: Labor & Capacity ─────────────────────────────────────────
  constructionEmployment:  number | null;   // BLS thousands employed
  jobPostingIndex:         number | null;   // Indeed/BLS indexed (100 = baseline)
  contractorDensity:       number | null;   // licensed contractors per 100K pop
  laborAvailabilityScore:  number;          // 0–100  (100 = abundant labor)
  laborTrend:              Trend;

  // ── Layer 8: Weather & Season ─────────────────────────────────────────
  avgTempF:                number | null;   // NOAA average °F (recent 7 days)
  freezeThawRisk:         'high' | 'medium' | 'low' | null;
  pavingSeason:           'open' | 'marginal' | 'closed' | null;
  activeFemaAlerts:        number | null;   // active NWS severe weather alerts
  heatingDegreeDays:       number | null;   // HDD vs 65°F base
  weatherRiskScore:        number;          // 0–100 opportunity score

  lastUpdated:             string;          // ISO 8601 timestamp
}

// ─── API RESPONSE ─────────────────────────────────────────────────────────────

export interface IntelligenceApiResponse {
  fetchedAt:   string;                      // ISO 8601
  layer:       DataLayer;
  cluster:     ConstructionCluster;
  signals:     StateSignal[];               // one per state/DC (max 51)
  globalMeta:  GlobalMeta;
}

export interface GlobalMeta {
  nationalAsphaltPriceIndex: number | null; // OPIS national avg indexed
  nationalConcretePPI:       number | null; // BLS national PPI
  nationalSteelIndex:        number | null; // CME national
  nationalDieselAvg:         number | null; // EIA national avg $/gal
  totalFederalObligatedBn:   number | null; // FHWA total $B YTD
  activeFemaDeclarations:    number | null; // national total active
}

// ─── FEED ENTRY ───────────────────────────────────────────────────────────────

export interface FeedEntry {
  abbr:     string;
  state:    string;
  headline: string;
  sub:      string;
  value:    string;
  trend:    Trend;
  layer:    DataLayer;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  ts:       string;                         // formatted time string
}

// ─── LAYER METADATA ───────────────────────────────────────────────────────────

export interface LayerMeta {
  label:  string;
  icon:   string;
  accent: string;   // hex color
  group:  string;
  desc:   string;   // data source description shown in tooltip
}

// ─── API WIRING GUIDE ─────────────────────────────────────────────────────────
//
// Layer              API Endpoint                                  Key Required
// ─────────────────  ────────────────────────────────────────────  ────────────
// construction       SerpAPI Google Trends / pytrends service      SERPAPI_KEY
// realestate         api.gateway.attomdata.com / Zillow Research   ATTOM_API_KEY
// respermits         api.census.gov/data/timeseries/bps/totals     CENSUS_API_KEY
// compermits         api.census.gov (C404) / McGraw-Hill Dodge     CENSUS_API_KEY
// rawmaterials       api.eia.gov (diesel) + BLS PPI + CME          EIA_API_KEY / BLS_API_KEY
// civil              api.sam.gov + FHWA FMIS + api.fema.gov        SAM_API_KEY
// labor              api.bls.gov/publicAPI/v2/timeseries           BLS_API_KEY
// weather            api.weather.gov + ncdc.noaa.gov/cdo-web       NOAA_TOKEN
//
// All keys go in Netlify environment variables or .env.local for Next.js.
// Census, EIA, BLS, NOAA, SAM are all free with registration.
// ATTOM and SerpAPI are paid — budget ~$50-150/mo for full coverage.
