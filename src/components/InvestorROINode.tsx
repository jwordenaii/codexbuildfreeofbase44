// ═══════════════════════════════════════════════════════════════════════════
// InvestorROINode.tsx  ·  J. Worden & Sons Command Intelligence Platform
// Real Estate Investment ROI Station — Production Build
//
// Modules:
//   M1 — Cap Rate & NOI Engine        (asset valuation via infrastructure)
//   M2 — Depreciation Recapture       (IRS cost segregation calculator)
//   M3 — 1031 Exchange Planner        (tax-deferred exchange timeline)
//   M4 — Cashflow Waterfall           (debt service / equity / distributions)
//
// API:  GET /api/investor?market=X    → real cap rates, cost indices, rates
// Data: CoStar cap rate benchmarks · IRS Rev Proc · Freddie Mac SOFR
// Style: roi- prefix · JetBrains Mono · #f5a623 gold · no Tailwind · no lucide
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import type { FC, ChangeEvent } from 'react';
import './InvestorROINode.css';
import type {
  MarketData, InvestorApiResponse, CapRateResult,
  DepreciationResult, ExchangeResult, CashflowResult,
} from '../types/investor-sovereign.types';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

// Fallback cap rates by market tier (used when API unavailable)
// Source: CBRE/CoStar 2024 H2 benchmarks
const FALLBACK_CAP_RATES: Record<string, number> = {
  'Tier 1 — Gateway (NYC, LA, SF, DC)':    4.5,
  'Tier 2 — Major Metro (Dallas, Atlanta)': 5.8,
  'Tier 3 — Secondary (Richmond, Norfolk)': 6.8,
  'Tier 4 — Tertiary / Rural':              8.2,
};

const IRS_DEPR_LIFE = {
  residential:   27.5,
  commercial:    39,
  landImprovement: 15,
  personalProperty: 5,
};

const MARKETS = Object.keys(FALLBACK_CAP_RATES);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmt  = (n: number, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt$ = (n: number) => Math.abs(n) >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `$${(n/1_000).toFixed(0)}K` : `$${fmt(n)}`;
const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
const clamp  = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ─── SLIDER ───────────────────────────────────────────────────────────────────

interface SliderProps {
  id: string; label: string; value: number;
  min: number; max: number; step: number;
  display: string; accent?: string;
  onChange: (v: number) => void;
}
const Slider: FC<SliderProps> = ({ id, label, value, min, max, step, display, accent, onChange }) => (
  <div className="roi-slider-wrap">
    <div className="roi-slider-header">
      <label className="roi-slider-label" htmlFor={id}>{label}</label>
      <span className="roi-slider-val" style={accent ? { color: accent } : {}}>{display}</span>
    </div>
    <input id={id} type="range" className="roi-slider"
      min={min} max={max} step={step} value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
    />
    <div className="roi-slider-range">
      <span>{min.toLocaleString()}</span><span>{max.toLocaleString()}</span>
    </div>
  </div>
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────

interface StatProps { label: string; value: string; sub?: string; highlight?: boolean; accent?: string; }
const StatCard: FC<StatProps> = ({ label, value, sub, highlight, accent }) => (
  <div className={`roi-stat ${highlight ? 'roi-stat-hi' : ''}`}>
    <div className="roi-stat-label">{label}</div>
    <div className="roi-stat-value" style={accent ? { color: accent } : highlight ? { color: '#f5a623' } : {}}>{value}</div>
    {sub && <div className="roi-stat-sub">{sub}</div>}
  </div>
);

// ─── MODULE WRAPPER ───────────────────────────────────────────────────────────

interface ModuleProps { num: string; title: string; sub: string; children: React.ReactNode; accent?: string; }
const Module: FC<ModuleProps> = ({ num, title, sub, children, accent }) => (
  <section className="roi-module">
    <div className="roi-module-hdr">
      <span className="roi-module-num" style={accent ? { color: accent, borderColor: accent + '66' } : {}}>{num}</span>
      <div>
        <div className="roi-module-title">{title}</div>
        <div className="roi-module-sub">{sub}</div>
      </div>
    </div>
    {children}
  </section>
);

// ─── M1: CAP RATE & NOI ENGINE ────────────────────────────────────────────────

interface M1Props { marketData: MarketData | null; }
const CapRateModule: FC<M1Props> = ({ marketData }) => {
  const [investment,  setInvestment]  = useState(850_000);
  const [currentNOI,  setCurrentNOI]  = useState(300_000);
  const [noiIncrease, setNoiIncrease] = useState(180_000);
  const [market,      setMarket]      = useState(MARKETS[1]);

  const capRate = marketData?.capRateByMarket[market] ?? FALLBACK_CAP_RATES[market] ?? 6;

  const r = useMemo<CapRateResult>(() => {
    const newNOI      = currentNOI + noiIncrease;
    const currentVal  = currentNOI  / (capRate / 100);
    const newVal      = newNOI      / (capRate / 100);
    const valueGain   = newVal - currentVal;
    const netReturn   = valueGain - investment;
    const roi         = (netReturn / investment) * 100;
    const leverage    = valueGain / investment;
    const paybackMos  = investment / (noiIncrease / 12);
    return { newNOI, currentVal, newVal, valueGain, netReturn, roi, leverage, paybackMos };
  }, [investment, currentNOI, noiIncrease, capRate]);

  return (
    <Module num="M1" title="Cap Rate & NOI Engine" accent="#f5a623"
      sub="Asset valuation through infrastructure investment · CoStar/CBRE cap rate benchmarks">
      <div className="roi-two-col">
        <div className="roi-inputs">
          <div className="roi-market-select-wrap">
            <label className="roi-slider-label">Market Tier</label>
            <select className="roi-select" value={market} onChange={e => setMarket(e.target.value)}>
              {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="roi-cap-live">
              Live cap rate: <strong style={{color:'#f5a623'}}>{fmtPct(capRate)}</strong>
              {marketData ? ' · CoStar real-time' : ' · CBRE 2024 benchmark'}
            </div>
          </div>
          <Slider id="investment" label="Infrastructure Investment" value={investment}
            min={50000} max={5000000} step={10000} display={fmt$(investment)}
            accent="#f5a623" onChange={setInvestment} />
          <Slider id="currentNOI" label="Current Annual NOI" value={currentNOI}
            min={50000} max={2000000} step={5000} display={fmt$(currentNOI)}
            onChange={setCurrentNOI} />
          <Slider id="noiIncrease" label="Projected NOI Increase" value={noiIncrease}
            min={10000} max={500000} step={5000} display={fmt$(noiIncrease)}
            accent="#34d399" onChange={setNoiIncrease} />
        </div>
        <div className="roi-results">
          <StatCard label="Current Asset Value" value={fmt$(r.currentVal)} sub={`NOI ÷ ${fmtPct(capRate)} cap rate`} />
          <StatCard label="New Asset Value" value={fmt$(r.newVal)} sub="Post-infrastructure" highlight />
          <StatCard label="Value Manufactured" value={fmt$(r.valueGain)} sub="Pure equity created" highlight accent="#34d399" />
          <StatCard label="Net Return" value={fmt$(r.netReturn)} sub="After investment cost" accent={r.netReturn >= 0 ? '#34d399' : '#f87171'} />
          <StatCard label="ROI" value={fmtPct(r.roi)} sub="Return on investment" highlight={r.roi >= 100} accent={r.roi >= 0 ? '#f5a623' : '#f87171'} />
          <StatCard label="Leverage Multiple" value={`${r.leverage.toFixed(2)}x`} sub="Value gain ÷ cost" />
          <StatCard label="Payback Period" value={`${r.paybackMos.toFixed(1)} mo`} sub="Investment ÷ monthly NOI gain" />
        </div>
      </div>
      <div className="roi-insight">
        <span className="roi-insight-icon">◈</span>
        Every <strong>{fmt$(investment)}</strong> invested at a <strong>{fmtPct(capRate)}</strong> cap rate
        manufactures <strong style={{color:'#34d399'}}>{fmt$(r.valueGain)}</strong> in asset equity —
        a <strong style={{color:'#f5a623'}}>{r.leverage.toFixed(2)}x</strong> leverage multiple.
        Payback: <strong>{r.paybackMos.toFixed(1)} months</strong>.
      </div>
    </Module>
  );
};

// ─── M2: DEPRECIATION RECAPTURE & COST SEGREGATION ───────────────────────────

const DepreciationModule: FC = () => {
  const [assetValue,    setAssetValue]    = useState(2_000_000);
  const [landPct,       setLandPct]       = useState(20);
  const [improvPct,     setImprovPct]     = useState(15);
  const [taxRate,       setTaxRate]       = useState(37);

  const r = useMemo<DepreciationResult>(() => {
    const landValue        = assetValue * landPct / 100;
    const depreciableBase  = assetValue - landValue;
    const landImprovement  = depreciableBase * improvPct / 100;
    const personalProp     = depreciableBase * 0.10;
    const commercialBase   = depreciableBase - landImprovement - personalProp;

    const annualDeprStd    = depreciableBase / IRS_DEPR_LIFE.commercial;
    const annualDeprSegr   = (commercialBase / IRS_DEPR_LIFE.commercial) +
                             (landImprovement / IRS_DEPR_LIFE.landImprovement) +
                             (personalProp / IRS_DEPR_LIFE.personalProperty);
    const yr1BonusDepr     = (landImprovement + personalProp); // 100% bonus yr1
    const yr1TaxSaving     = yr1BonusDepr * taxRate / 100;
    const annualAdvantage  = (annualDeprSegr - annualDeprStd) * taxRate / 100;
    const fiveYrAdvantage  = annualAdvantage * 5 + yr1TaxSaving;

    return { depreciableBase, landImprovement, personalProp, annualDeprStd,
             annualDeprSegr, yr1BonusDepr, yr1TaxSaving, annualAdvantage, fiveYrAdvantage };
  }, [assetValue, landPct, improvPct, taxRate]);

  return (
    <Module num="M2" title="Depreciation Recapture & Cost Segregation" accent="#a78bfa"
      sub="IRS Rev Proc 87-56 · 15-yr land improvement · 5-yr personal property · Bonus depreciation">
      <div className="roi-two-col">
        <div className="roi-inputs">
          <Slider id="assetValue" label="Total Asset Value" value={assetValue}
            min={500000} max={20000000} step={50000} display={fmt$(assetValue)} onChange={setAssetValue} />
          <Slider id="landPct" label="Land Value %" value={landPct}
            min={5} max={50} step={1} display={fmtPct(landPct)} onChange={setLandPct} />
          <Slider id="improvPct" label="Land Improvement % (pavement)" value={improvPct}
            min={5} max={40} step={1} display={fmtPct(improvPct)}
            accent="#a78bfa" onChange={setImprovPct} />
          <Slider id="taxRate" label="Marginal Tax Rate" value={taxRate}
            min={21} max={50} step={1} display={fmtPct(taxRate)} onChange={setTaxRate} />
        </div>
        <div className="roi-results">
          <StatCard label="Depreciable Base" value={fmt$(r.depreciableBase)} sub="Asset minus land" />
          <StatCard label="Land Improvement (15yr)" value={fmt$(r.landImprovement)} sub="Pavement, parking, landscaping" accent="#a78bfa" />
          <StatCard label="Personal Property (5yr)" value={fmt$(r.personalProp)} sub="Fixtures, equipment" />
          <StatCard label="Std Annual Depreciation" value={fmt$(r.annualDeprStd)} sub="39-yr straight line" />
          <StatCard label="Segregated Annual Depr." value={fmt$(r.annualDeprSegr)} sub="Cost segregation result" highlight accent="#a78bfa" />
          <StatCard label="Yr 1 Bonus Depreciation" value={fmt$(r.yr1BonusDepr)} sub="100% bonus on 5+15yr assets" accent="#34d399" />
          <StatCard label="Yr 1 Tax Saving" value={fmt$(r.yr1TaxSaving)} sub={`${fmtPct(taxRate)} marginal rate`} highlight />
          <StatCard label="5-Yr Total Advantage" value={fmt$(r.fiveYrAdvantage)} sub="vs standard straight-line" accent="#f5a623" />
        </div>
      </div>
      <div className="roi-insight">
        <span className="roi-insight-icon">◆</span>
        Cost segregation reclassifies pavement + land improvements to 15-yr life,
        unlocking <strong style={{color:'#34d399'}}>{fmt$(r.yr1TaxSaving)}</strong> in Year 1 tax savings
        and <strong style={{color:'#f5a623'}}>{fmt$(r.fiveYrAdvantage)}</strong> cumulative 5-year advantage
        vs 39-yr straight-line. Infrastructure as tax strategy.
      </div>
    </Module>
  );
};

// ─── M3: 1031 EXCHANGE PLANNER ────────────────────────────────────────────────

const ExchangeModule: FC = () => {
  const [relinquishedValue, setRelinquishedVal] = useState(1_500_000);
  const [costBasis,         setCostBasis]       = useState(600_000);
  const [replacementValue,  setReplacementVal]  = useState(2_200_000);
  const [newDebt,           setNewDebt]         = useState(1_200_000);
  const [fedTaxRate,        setFedTaxRate]       = useState(20);

  const r = useMemo<ExchangeResult>(() => {
    const recognizedGain    = relinquishedValue - costBasis;
    const taxIfSold         = recognizedGain * fedTaxRate / 100;
    const depreciationRecap = Math.min(recognizedGain * 0.25, recognizedGain); // max 25% recap rate
    const depreciationTax   = depreciationRecap * 0.25;
    const totalTaxSold      = taxIfSold + depreciationTax;
    const equityPreserved   = totalTaxSold; // same as tax deferred
    const leverageCapacity  = replacementValue - (relinquishedValue - newDebt);
    const netEquityGain     = replacementValue - relinquishedValue;
    const bootstrapNOI      = netEquityGain * 0.055; // assume 5.5% yield on equity gain
    // 1031 timeline (IRS: 45-day ID / 180-day close)
    const idDeadline        = 45;
    const closeDeadline     = 180;
    return {
      recognizedGain, taxIfSold, depreciationTax, totalTaxSold,
      equityPreserved, leverageCapacity, netEquityGain, bootstrapNOI,
      idDeadline, closeDeadline,
    };
  }, [relinquishedValue, costBasis, replacementValue, newDebt, fedTaxRate]);

  return (
    <Module num="M3" title="1031 Exchange Planner" accent="#06b6d4"
      sub="IRC §1031 · 45-day ID window · 180-day close · Depreciation recapture avoidance">
      <div className="roi-two-col">
        <div className="roi-inputs">
          <Slider id="relVal" label="Relinquished Property Value" value={relinquishedValue}
            min={200000} max={10000000} step={50000} display={fmt$(relinquishedValue)} onChange={setRelinquishedVal} />
          <Slider id="basis" label="Adjusted Cost Basis" value={costBasis}
            min={50000} max={5000000} step={25000} display={fmt$(costBasis)} onChange={setCostBasis} />
          <Slider id="replVal" label="Replacement Property Value" value={replacementValue}
            min={200000} max={20000000} step={50000} display={fmt$(replacementValue)}
            accent="#06b6d4" onChange={setReplacementVal} />
          <Slider id="newDebt2" label="New Debt (Replacement)" value={newDebt}
            min={0} max={15000000} step={50000} display={fmt$(newDebt)} onChange={setNewDebt} />
          <Slider id="fedRate" label="Federal Capital Gains Rate" value={fedTaxRate}
            min={15} max={40} step={1} display={fmtPct(fedTaxRate)} onChange={setFedTaxRate} />
        </div>
        <div className="roi-results">
          <StatCard label="Recognized Gain" value={fmt$(r.recognizedGain)} sub="Sale price minus basis" />
          <StatCard label="Capital Gains Tax (if sold)" value={fmt$(r.taxIfSold)} sub={`Fed ${fmtPct(fedTaxRate)}`} accent="#f87171" />
          <StatCard label="Depreciation Recapture Tax" value={fmt$(r.depreciationTax)} sub="25% federal rate" accent="#f87171" />
          <StatCard label="Total Tax if Sold" value={fmt$(r.totalTaxSold)} sub="vs. 1031 exchange" accent="#f87171" />
          <StatCard label="Tax Deferred via 1031" value={fmt$(r.equityPreserved)} sub="Preserved + reinvested" highlight accent="#34d399" />
          <StatCard label="Net Equity Gain" value={fmt$(r.netEquityGain)} sub="Replacement minus relinquished" accent="#06b6d4" />
          <StatCard label="Bootstrap NOI" value={fmt$(r.bootstrapNOI)} sub="~5.5% on new equity gain" accent="#f5a623" />
        </div>
      </div>
      {/* Timeline */}
      <div className="roi-timeline">
        <div className="roi-timeline-hdr">§1031 EXCHANGE TIMELINE</div>
        <div className="roi-timeline-track">
          {[
            { day: 0,   label: 'Close of Sale',     accent: '#f5a623' },
            { day: 45,  label: '45-Day ID Deadline', accent: '#fbbf24' },
            { day: 180, label: '180-Day Close',       accent: '#34d399' },
          ].map(({ day, label, accent }) => (
            <div key={day} className="roi-tl-node" style={{ left: `${(day/180)*100}%` }}>
              <div className="roi-tl-dot" style={{ background: accent }} />
              <div className="roi-tl-day" style={{ color: accent }}>Day {day}</div>
              <div className="roi-tl-lbl">{label}</div>
            </div>
          ))}
          <div className="roi-tl-line" />
        </div>
      </div>
      <div className="roi-insight">
        <span className="roi-insight-icon">◉</span>
        A §1031 exchange defers <strong style={{color:'#34d399'}}>{fmt$(r.totalTaxSold)}</strong> in combined
        capital gains + depreciation recapture tax.
        That capital stays working — bootstrapping <strong style={{color:'#f5a623'}}>{fmt$(r.bootstrapNOI)}</strong>/yr
        in new NOI on the preserved equity.
      </div>
    </Module>
  );
};

// ─── M4: CASHFLOW WATERFALL ───────────────────────────────────────────────────

interface M4Props { marketData: MarketData | null; }
const CashflowModule: FC<M4Props> = ({ marketData }) => {
  const [grossRent,    setGrossRent]    = useState(420_000);
  const [vacancy,      setVacancy]      = useState(5);
  const [opex,         setOpex]         = useState(28);
  const [loanAmount,   setLoanAmount]   = useState(1_200_000);
  const [loanRate,     setLoanRate]     = useState(marketData?.sofr30 ? marketData.sofr30 + 2.5 : 7.0);
  const [amortYrs,     setAmortYrs]     = useState(25);
  const [lpSplit,      setLpSplit]      = useState(70);
  const [preferredRet, setPreferredRet] = useState(8);
  const [equityBase,   setEquityBase]   = useState(800_000);

  // Sync loan rate if market data arrives
  useEffect(() => {
    if (marketData?.sofr30) setLoanRate(parseFloat((marketData.sofr30 + 2.5).toFixed(2)));
  }, [marketData]);

  const r = useMemo<CashflowResult>(() => {
    const egi          = grossRent * (1 - vacancy / 100);
    const opexAmt      = egi * opex / 100;
    const noi          = egi - opexAmt;
    // Monthly mortgage payment (P&I)
    const mo           = loanRate / 100 / 12;
    const n            = amortYrs * 12;
    const monthlyDebt  = mo === 0 ? loanAmount / n : loanAmount * mo / (1 - Math.pow(1 + mo, -n));
    const annualDebt   = monthlyDebt * 12;
    const cashflowBD   = noi - annualDebt; // before distributions
    const debtYield    = (noi / loanAmount) * 100;
    const dscr         = noi / annualDebt;
    // Waterfall
    const preferredAmt = equityBase * preferredRet / 100;
    const lpPref       = preferredAmt * lpSplit / 100;
    const gpPref       = preferredAmt * (100 - lpSplit) / 100;
    const residual     = Math.max(0, cashflowBD - preferredAmt);
    const lpResidual   = residual * lpSplit / 100;
    const gpResidual   = residual * (100 - lpSplit) / 100;
    const lpTotal      = lpPref + lpResidual;
    const gpTotal      = gpPref + gpResidual;
    const lpCOC        = (lpTotal / (equityBase * lpSplit / 100)) * 100;
    return {
      egi, opexAmt, noi, annualDebt, cashflowBD, debtYield, dscr,
      preferredAmt, lpPref, gpPref, residual, lpResidual, gpResidual,
      lpTotal, gpTotal, lpCOC,
    };
  }, [grossRent, vacancy, opex, loanAmount, loanRate, amortYrs, lpSplit, preferredRet, equityBase]);

  const dscrColor = r.dscr >= 1.25 ? '#34d399' : r.dscr >= 1.1 ? '#fbbf24' : '#f87171';

  return (
    <Module num="M4" title="Cashflow Waterfall" accent="#34d399"
      sub={`Debt service · NOI · LP/GP equity split · Preferred return · ${marketData?.sofr30 ? 'Freddie Mac SOFR live' : 'SOFR est.'}`}>
      <div className="roi-two-col">
        <div className="roi-inputs">
          <Slider id="grossRent" label="Gross Potential Rent" value={grossRent}
            min={50000} max={5000000} step={5000} display={fmt$(grossRent)} onChange={setGrossRent} />
          <Slider id="vacancy" label="Vacancy %" value={vacancy}
            min={0} max={30} step={0.5} display={fmtPct(vacancy)} onChange={setVacancy} />
          <Slider id="opex" label="Operating Expense Ratio %" value={opex}
            min={15} max={65} step={1} display={fmtPct(opex)} onChange={setOpex} />
          <Slider id="loan" label="Loan Amount" value={loanAmount}
            min={100000} max={10000000} step={50000} display={fmt$(loanAmount)} onChange={setLoanAmount} />
          <Slider id="lrate" label="Interest Rate" value={loanRate}
            min={3} max={12} step={0.05} display={fmtPct(loanRate)}
            accent={marketData?.sofr30 ? '#34d399' : undefined} onChange={setLoanRate} />
          <Slider id="amort" label="Amortization (years)" value={amortYrs}
            min={10} max={30} step={1} display={`${amortYrs} yr`} onChange={setAmortYrs} />
          <Slider id="lp" label="LP Share %" value={lpSplit}
            min={50} max={95} step={1} display={fmtPct(lpSplit)} onChange={setLpSplit} />
          <Slider id="pref" label="Preferred Return %" value={preferredRet}
            min={5} max={15} step={0.5} display={fmtPct(preferredRet)} onChange={setPreferredRet} />
          <Slider id="eq" label="Total Equity Base" value={equityBase}
            min={100000} max={5000000} step={50000} display={fmt$(equityBase)} onChange={setEquityBase} />
        </div>
        <div className="roi-results">
          <StatCard label="EGI" value={fmt$(r.egi)} sub={`After ${fmtPct(vacancy)} vacancy`} />
          <StatCard label="NOI" value={fmt$(r.noi)} sub={`After ${fmtPct(opex)} opex`} highlight />
          <StatCard label="Annual Debt Service" value={fmt$(r.annualDebt)} sub="P&I" accent="#f87171" />
          <StatCard label="Pre-Distribution CF" value={fmt$(r.cashflowBD)} sub="NOI minus debt" accent={r.cashflowBD >= 0 ? '#34d399' : '#f87171'} />
          <StatCard label="DSCR" value={r.dscr.toFixed(2)} sub="≥1.25 lender min" accent={dscrColor} />
          <StatCard label="Debt Yield" value={fmtPct(r.debtYield)} sub="NOI ÷ loan" />
          <StatCard label="LP Total" value={fmt$(r.lpTotal)} sub={`Pref + residual @ ${fmtPct(lpSplit)} split`} accent="#f5a623" />
          <StatCard label="GP Total" value={fmt$(r.gpTotal)} sub={`${fmtPct(100 - lpSplit)} carried interest`} />
          <StatCard label="LP Cash-on-Cash" value={fmtPct(r.lpCOC)} sub="LP yield on equity" highlight accent="#34d399" />
        </div>
      </div>
      {/* Waterfall bar */}
      <div className="roi-waterfall">
        <div className="roi-wf-hdr">CASHFLOW WATERFALL — ANNUAL</div>
        {[
          { label: 'Gross Potential Rent', val: grossRent,        color: '#2a5a7a', pct: 100 },
          { label: 'EGI (after vacancy)',  val: r.egi,            color: '#1a4a6a', pct: (r.egi/grossRent)*100 },
          { label: 'NOI (after opex)',     val: r.noi,            color: '#f5a623', pct: (r.noi/grossRent)*100 },
          { label: 'After Debt Service',   val: r.cashflowBD,     color: r.cashflowBD >= 0 ? '#34d399' : '#f87171', pct: Math.abs(r.cashflowBD/grossRent)*100 },
          { label: 'LP Distribution',      val: r.lpTotal,        color: '#a78bfa', pct: (r.lpTotal/grossRent)*100 },
          { label: 'GP Distribution',      val: r.gpTotal,        color: '#06b6d4', pct: (r.gpTotal/grossRent)*100 },
        ].map(({ label, val, color, pct }) => (
          <div key={label} className="roi-wf-row">
            <div className="roi-wf-label">{label}</div>
            <div className="roi-wf-bar-wrap">
              <div className="roi-wf-bar" style={{ width: `${clamp(pct,0,100)}%`, background: color }} />
            </div>
            <div className="roi-wf-val" style={{ color }}>{fmt$(val)}</div>
          </div>
        ))}
      </div>
      <div className="roi-insight">
        <span className="roi-insight-icon">▲</span>
        DSCR <strong style={{color:dscrColor}}>{r.dscr.toFixed(2)}x</strong>
        {r.dscr >= 1.25 ? ' — lender-comfortable.' : r.dscr >= 1.1 ? ' — marginal, adjust leverage.' : ' — below 1.1, restructure debt.'}
        {' '}LP cash-on-cash: <strong style={{color:'#34d399'}}>{fmtPct(r.lpCOC)}</strong>.
        {marketData?.sofr30 && ` Rate anchored to live SOFR ${fmtPct(marketData.sofr30)}.`}
      </div>
    </Module>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function InvestorROINode() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchedAt,  setFetchedAt]  = useState('');

  const fetchMarket = useCallback(async () => {
    try {
      const res = await fetch('/api/investor?type=market');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data: InvestorApiResponse = await res.json();
      setMarketData(data.marketData ?? null);
      setFetchedAt(data.fetchedAt ?? '');
    } catch {
      setMarketData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  return (
    <div className="roi-root">

      {/* ── TICKER ── */}
      <div className="roi-ticker">
        <span className="roi-ticker-label">INVESTOR ROI NODE</span>
        <div className="roi-ticker-track">
          <div className="roi-ticker-inner">
            {[
              'Cap Rate Engine · CoStar/CBRE market benchmarks · real-time',
              'Cost Segregation · IRS Rev Proc 87-56 · 15-yr land improvement',
              '§1031 Exchange · 45-day ID · 180-day close · tax deferral',
              'Cashflow Waterfall · DSCR · LP/GP equity split · preferred return',
              'SOFR rate anchor · Freddie Mac PMMS · debt cost live',
              'Worden pavement = 15-yr IRS asset · cost segregation eligible',
              '100% bonus depreciation Year 1 · personal property + land improvement',
              'Infrastructure investment manufactures asset equity at cap rate',
            ].flatMap(s => [s, s]).map((s, i) => <span key={i} className="roi-ticker-item">{s}</span>)}
          </div>
        </div>
      </div>

      {/* ── TOP BAR ── */}
      <header className="roi-topbar">
        <div className="roi-topbar-left">
          <span className="roi-wordmark">J. WORDEN &amp; SONS</span>
          <span className="roi-div">|</span>
          <span className="roi-station" style={{color:'#f5a623'}}>INVESTOR ROI NODE</span>
        </div>
        <div className="roi-topbar-center">
          <span className={`roi-dot ${loading ? 'roi-dot-loading' : 'roi-dot-live'}`} />
          <span className="roi-status">{loading ? 'FETCHING MARKET DATA' : marketData ? 'MARKET DATA LIVE' : 'BENCHMARK MODE'}</span>
          {fetchedAt && <span className="roi-ts">{new Date(fetchedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})}</span>}
        </div>
        <div className="roi-topbar-right">
          <span className="roi-coverage">4 MODULES · REAL-TIME RATES</span>
          <button className="roi-refresh" onClick={fetchMarket} disabled={loading} title="Refresh market data">
            {loading ? '⟳' : '↺'}
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <div className="roi-hero">
        <div className="roi-hero-badge">Worden Intelligence · Real Estate Investment Engine · 4 Modules Active</div>
        <h1 className="roi-hero-title">INVESTOR <span className="roi-hero-white">ROI NODE</span></h1>
        <p className="roi-hero-sub">
          Cap rate valuation · Cost segregation · §1031 exchange planning · Cashflow waterfall —
          the complete financial architecture of infrastructure as investment.
        </p>
        {!marketData && !loading && (
          <div className="roi-bench-note">
            ◈ Running on CBRE 2024 benchmark cap rates. Add <code>/api/investor</code> endpoint for live CoStar data.
          </div>
        )}
      </div>

      {/* ── MODULES ── */}
      <div className="roi-modules">
        <CapRateModule marketData={marketData} />
        <DepreciationModule />
        <ExchangeModule />
        <CashflowModule marketData={marketData} />
      </div>

      {/* ── FOOTER ── */}
      <div className="roi-footer">
        J. Worden &amp; Sons · Virginia Class A Contractor · 4th Generation Since 1984 ·
        Infrastructure Investment Intelligence · Not financial advice — consult a licensed CPA/attorney
      </div>

    </div>
  );
}
