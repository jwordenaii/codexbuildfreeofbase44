// ═══════════════════════════════════════════════════════════════════════
// investor-sovereign.types.ts
// Shared types for InvestorROINode + SovereignAssetAnalysis
// Import: import type { ... } from '../types/investor-sovereign.types';
// ═══════════════════════════════════════════════════════════════════════

// ─── API TYPES ────────────────────────────────────────────────────────────────

export interface MarketData {
  capRateByMarket: Record<string, number>;  // market tier label → cap rate %
  sofr30:          number | null;           // FRED 30-day SOFR
  treasury10yr:    number | null;           // FRED 10-yr Treasury
  asphaltPPI:      number | null;           // BLS PCU2373 index
  source:          string;                  // data source description
}

export interface CostData {
  rsmeansIndex:      Record<string, number>; // state → index (100 = national avg)
  asphaltPPI:        number | null;          // BLS PPI
  wordenCostSqft:    number;                 // current Worden $/SF
  standardCostSqft:  number;                 // market standard $/SF
  source:            string;
}

export interface InvestorApiResponse {
  fetchedAt:   string;           // ISO 8601
  type:        'market' | 'costs';
  marketData:  MarketData | null;
  costData:    CostData   | null;
}

// ─── MODULE RESULT TYPES ─────────────────────────────────────────────────────

// M1: Cap Rate & NOI
export interface CapRateResult {
  newNOI:       number;
  currentVal:   number;
  newVal:       number;
  valueGain:    number;
  netReturn:    number;
  roi:          number;    // %
  leverage:     number;    // multiple
  paybackMos:   number;
}

// M2: Depreciation Recapture
export interface DepreciationResult {
  depreciableBase:   number;
  landImprovement:   number;
  personalProp:      number;
  annualDeprStd:     number;  // 39-yr straight line
  annualDeprSegr:    number;  // cost segregation result
  yr1BonusDepr:      number;  // 100% bonus eligible amount
  yr1TaxSaving:      number;  // USD
  annualAdvantage:   number;  // segregated vs standard per year
  fiveYrAdvantage:   number;  // cumulative 5-yr
}

// M3: 1031 Exchange
export interface ExchangeResult {
  recognizedGain:    number;
  taxIfSold:         number;
  depreciationTax:   number;
  totalTaxSold:      number;
  equityPreserved:   number;  // = total tax deferred
  leverageCapacity:  number;
  netEquityGain:     number;
  bootstrapNOI:      number;  // annual NOI on preserved equity
  idDeadline:        number;  // days (45)
  closeDeadline:     number;  // days (180)
}

// M4: Cashflow Waterfall
export interface CashflowResult {
  egi:           number;   // effective gross income
  opexAmt:       number;
  noi:           number;
  annualDebt:    number;
  cashflowBD:    number;   // before distributions
  debtYield:     number;   // %
  dscr:          number;
  preferredAmt:  number;
  lpPref:        number;
  gpPref:        number;
  residual:      number;
  lpResidual:    number;
  gpResidual:    number;
  lpTotal:       number;
  gpTotal:       number;
  lpCOC:         number;   // LP cash-on-cash %
}

// ─── SOVEREIGN TCO RESULT ─────────────────────────────────────────────────────

export interface TCOResult {
  adjW:            number;   // adjusted Worden $/SF
  adjS:            number;   // adjusted standard $/SF
  wordenInitial:   number;
  standardInitial: number;
  wordenCycles:    number;
  standardCycles:  number;
  wordenReplace:   number;
  standardReplace: number;
  wordenMaint:     number;
  standardMaint:   number;
  wordenTCO:       number;
  standardTCO:     number;
  tcoSavings:      number;
  costPerYrW:      number;
  costPerYrS:      number;
  premiumPct:      number;
  savingsPct:      number;
}

// ─── PCI DATA POINT ───────────────────────────────────────────────────────────

export interface PCIPoint {
  yr:  number;   // year 0-20
  pW:  number;   // Worden PCI (0-100)
  pS:  number;   // Standard PCI (0-100)
}

// ─── SPEC REFERENCE ──────────────────────────────────────────────────────────

export interface PavingSpec {
  costPerSqft:     number;
  lifespanYrs:     number;
  warrantyYrs:     number;
  compaction:      string;
  spec:            string;
  geogrid:         string;
  oilBuffer:       string;
}
