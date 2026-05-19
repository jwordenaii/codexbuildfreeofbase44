// RealityEngineNode.tsx
// src/components/RealityEngineNode.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Live Arbitration Engine — Execute vs Wait vs Crash Schedule
// Premium build: NOAA live weather, deterministic cost math,
// optional Anthropic AI narrative, full countermeasure protocol library
// SpaceX-liner aesthetic, vanilla React 19, no UI library deps
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, memo } from 'react';
import type { FC, ChangeEvent } from 'react';
import './RealityEngineNode.css';
import type {
  ScenarioKey, ScenarioInput, ArbitrationVerdict,
  WeatherSnapshot, RealityEngineResponse, CounterMeasure,
} from '../types/reality-engine.types';

// ─── Scenario catalog ─────────────────────────────────────────────────────────

interface ScenarioDef {
  key: ScenarioKey;
  icon: string;
  label: string;
  sub: string;
  trade: string;
  defaultWaitPerDay: number;
  defaultExecuteCost: number;
  defaultDaysToIdeal: number;
  defaultCrewSize: number;
  defaultCrewRate: number;
  defaultContractValue: number;
}

const SCENARIOS: ScenarioDef[] = [
  {
    key: 'cold_asphalt',
    icon: '🌡',
    label: 'Cold Weather Asphalt Paving',
    sub: 'Below 40°F ground temp · Mat failure risk',
    trade: 'asphalt',
    defaultWaitPerDay: 4200,
    defaultExecuteCost: 38000,
    defaultDaysToIdeal: 8,
    defaultCrewSize: 8,
    defaultCrewRate: 1400,
    defaultContractValue: 380000,
  },
  {
    key: 'wet_earthwork',
    icon: '🌧',
    label: 'Wet Subgrade Earthwork',
    sub: 'Soil moisture above Proctor optimum · Compaction failure',
    trade: 'earthwork',
    defaultWaitPerDay: 3500,
    defaultExecuteCost: 28000,
    defaultDaysToIdeal: 5,
    defaultCrewSize: 6,
    defaultCrewRate: 1200,
    defaultContractValue: 240000,
  },
  {
    key: 'schedule_crash',
    icon: '⚡',
    label: 'Schedule Crash — Storm Incoming',
    sub: '14-day rain system · LD clock running',
    trade: 'earthwork',
    defaultWaitPerDay: 7000,
    defaultExecuteCost: 18000,
    defaultDaysToIdeal: 14,
    defaultCrewSize: 10,
    defaultCrewRate: 1600,
    defaultContractValue: 620000,
  },
  {
    key: 'wind_crane',
    icon: '💨',
    label: 'High Wind Crane Operations',
    sub: '>20 mph sustained · OSHA 1926.1417',
    trade: 'crane',
    defaultWaitPerDay: 8500,
    defaultExecuteCost: 85000,
    defaultDaysToIdeal: 3,
    defaultCrewSize: 5,
    defaultCrewRate: 2200,
    defaultContractValue: 420000,
  },
  {
    key: 'frost_concrete',
    icon: '❄',
    label: 'Frost Risk Concrete Pour',
    sub: 'Below 40°F ambient · ACI 306R cold-weather protocol',
    trade: 'concrete',
    defaultWaitPerDay: 5500,
    defaultExecuteCost: 55000,
    defaultDaysToIdeal: 10,
    defaultCrewSize: 7,
    defaultCrewRate: 1500,
    defaultContractValue: 310000,
  },
];

// ─── Ticker items ─────────────────────────────────────────────────────────────

const TICKERS = [
  { label: 'REALITY ENGINE', sub: 'EXECUTE · WAIT · CRASH SCHEDULE' },
  { label: 'NOAA NWS LIVE', sub: 'API.WEATHER.GOV · KEYLESS · REAL-TIME' },
  { label: 'COLD ASPHALT', sub: 'VDOT 315.03(b) · WMA PROTOCOL' },
  { label: 'WET EARTHWORK', sub: 'ASTM D559 · LIME STABILIZATION' },
  { label: 'FROST CONCRETE', sub: 'ACI 306R · HEATED ENCLOSURE' },
  { label: 'CRANE OPS', sub: 'OSHA 1926.1417 · 35 MPH LIMIT' },
  { label: 'ANTHROPIC AI', sub: 'CLAUDE 3.5 HAIKU · FIELD NARRATIVE' },
  { label: 'AUDIT TRAIL', sub: 'SIGNED VERDICT · IMMUTABLE LOG' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => n < 0 ? `-$${Math.abs(n).toLocaleString()}` : `$${n.toLocaleString()}`;

function riskColor(level: string): string {
  if (level === 'LOW') return 'green';
  if (level === 'MEDIUM') return 'yellow';
  if (level === 'HIGH') return 'yellow';
  return 'red'; // CRITICAL
}

function decisionIcon(d: string): string {
  if (d === 'EXECUTE_NOW') return '✅';
  if (d === 'WAIT') return '⏸';
  if (d === 'CRASH_SCHEDULE') return '⚡';
  return '🛑';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TickerBar: FC = memo(() => (
  <div className="rne-ticker">
    <div className="rne-ticker-track">
      {[...TICKERS, ...TICKERS].map((t, i) => (
        <span key={i} className="rne-ticker-item">
          <b>{t.label}</b> — {t.sub}
        </span>
      ))}
    </div>
  </div>
));

interface WeatherStripProps { weather: WeatherSnapshot }
const WeatherStrip: FC<WeatherStripProps> = memo(({ weather }) => (
  <div className="rne-weather">
    <div className="rne-weather-label">Live Weather Conditions</div>
    <div className="rne-weather-row">
      <div className="rne-weather-item">
        <span className="rne-weather-key">High / Low</span>
        <span className="rne-weather-val">{weather.tempHigh}° / {weather.tempLow}°F</span>
      </div>
      <div className="rne-weather-item">
        <span className="rne-weather-key">Ground Temp</span>
        <span className="rne-weather-val">{weather.groundTemp}°F</span>
      </div>
      <div className="rne-weather-item">
        <span className="rne-weather-key">Wind</span>
        <span className="rne-weather-val">{weather.windSpeed} mph</span>
      </div>
      <div className="rne-weather-item">
        <span className="rne-weather-key">Precip Prob</span>
        <span className="rne-weather-val">{weather.precipProbability}%</span>
      </div>
      <div className="rne-weather-item">
        <span className="rne-weather-key">Humidity</span>
        <span className="rne-weather-val">{weather.humidity}%</span>
      </div>
      <div className="rne-weather-item">
        <span className="rne-weather-key">Clear Window</span>
        <span className="rne-weather-val">{weather.forecastWindowDays} days</span>
      </div>
      <div className="rne-weather-item">
        <span className="rne-weather-key">Next Rain</span>
        <span className="rne-weather-val">{weather.nextRainDays} days</span>
      </div>
    </div>
    <div className={`rne-weather-source ${weather.source}`}>
      {weather.source === 'noaa' ? '⬡ NOAA LIVE' : '⬡ SYNTHETIC'}
    </div>
  </div>
));

interface CMItemProps { cm: CounterMeasure }
const CMItem: FC<CMItemProps> = memo(({ cm }) => (
  <div className={`rne-cm-item ${cm.type}`}>
    <span className="rne-cm-badge">{cm.type}</span>
    <div>
      <div className="rne-cm-action">{cm.action}</div>
      {cm.spec && <div className="rne-cm-spec">Spec: {cm.spec}</div>}
      {cm.cost !== undefined && <div className="rne-cm-cost">Cost: ${cm.cost.toLocaleString()}</div>}
      {cm.timeRequired && <div className="rne-cm-spec">Time: {cm.timeRequired}</div>}
    </div>
  </div>
));

interface MetricsRowProps { verdict: ArbitrationVerdict }
const MetricsRow: FC<MetricsRowProps> = memo(({ verdict }) => (
  <div className="rne-metrics">
    <div className="rne-metric">
      <div className="rne-metric-label">Net Savings</div>
      <div className={`rne-metric-val ${verdict.netSavings >= 0 ? 'green' : 'red'}`}>
        {fmt$(verdict.netSavings)}
      </div>
      <div className="rne-metric-sub">vs suboptimal path</div>
    </div>
    <div className="rne-metric">
      <div className="rne-metric-label">Wait Cost Total</div>
      <div className="rne-metric-val red">{fmt$(-verdict.waitCostTotal)}</div>
      <div className="rne-metric-sub">{verdict.breakEvenDay}d break-even</div>
    </div>
    <div className="rne-metric">
      <div className="rne-metric-label">Execute Cost</div>
      <div className="rne-metric-val yellow">{fmt$(verdict.executeCostAdjusted)}</div>
      <div className="rne-metric-sub">w/ countermeasures</div>
    </div>
    <div className="rne-metric">
      <div className="rne-metric-label">Risk Level</div>
      <div className={`rne-metric-val ${riskColor(verdict.riskLevel)}`}>
        {verdict.riskLevel}
      </div>
      <div className="rne-metric-sub">{verdict.confidenceScore}% confidence</div>
    </div>
  </div>
));

interface VerdictPanelProps { verdict: ArbitrationVerdict; weather: WeatherSnapshot }
const VerdictPanel: FC<VerdictPanelProps> = memo(({ verdict, weather }) => (
  <div className={`rne-verdict ${verdict.decision}`}>
    <div className="rne-verdict-header">
      <div className="rne-verdict-icon">{decisionIcon(verdict.decision)}</div>
      <div>
        <div className="rne-verdict-decision">
          {verdict.decision.replace('_', ' ')}
        </div>
        <div className="rne-verdict-headline">{verdict.headline}</div>
      </div>
      <div className="rne-confidence">
        <div className="rne-confidence-val">{verdict.confidenceScore}%</div>
        <div className="rne-confidence-label">Confidence</div>
      </div>
    </div>
    <div className="rne-verdict-body">
      <div className="rne-rationale">{verdict.rationale}</div>

      {verdict.weatherInfluence && (
        <div className="rne-weather-influence">
          📡 {verdict.weatherInfluence}
        </div>
      )}

      <MetricsRow verdict={verdict} />

      <WeatherStrip weather={weather} />

      {verdict.aiNarrative && (
        <div className="rne-ai-narrative">
          <div className="rne-ai-label">⬡ Claude AI — Field Narrative</div>
          <div className="rne-ai-text">"{verdict.aiNarrative}"</div>
        </div>
      )}

      {verdict.countermeasures.length > 0 && (
        <div className="rne-cm-section">
          <div className="rne-cm-header">
            Countermeasure Protocol — {verdict.countermeasures.filter(c => c.type === 'MANDATORY').length} Mandatory ·{' '}
            {verdict.countermeasures.filter(c => c.type === 'RECOMMENDED').length} Recommended
          </div>
          {verdict.countermeasures.map((cm, i) => <CMItem key={i} cm={cm} />)}
        </div>
      )}

      <div className="rne-audit">
        <div className="rne-audit-sig">⬡ {verdict.auditSignature}</div>
        <div className="rne-audit-ts">{new Date(verdict.auditTimestamp).toLocaleString()}</div>
      </div>
    </div>
  </div>
));

// ─── Main component ───────────────────────────────────────────────────────────

const RealityEngineNode: FC = () => {
  const [selectedKey, setSelectedKey] = useState<ScenarioKey>('cold_asphalt');
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<ArbitrationVerdict | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const def = SCENARIOS.find(s => s.key === selectedKey) ?? SCENARIOS[0];

  // Form state — initialized from scenario defaults
  const [waitPerDay, setWaitPerDay] = useState(def.defaultWaitPerDay);
  const [executeCost, setExecuteCost] = useState(def.defaultExecuteCost);
  const [daysToIdeal, setDaysToIdeal] = useState(def.defaultDaysToIdeal);
  const [deadlinePressure, setDeadlinePressure] = useState(50);
  const [crewSize, setCrewSize] = useState(def.defaultCrewSize);
  const [crewRate, setCrewRate] = useState(def.defaultCrewRate);
  const [contractValue, setContractValue] = useState(def.defaultContractValue);

  const handleScenarioSelect = useCallback((key: ScenarioKey) => {
    const d = SCENARIOS.find(s => s.key === key)!;
    setSelectedKey(key);
    setWaitPerDay(d.defaultWaitPerDay);
    setExecuteCost(d.defaultExecuteCost);
    setDaysToIdeal(d.defaultDaysToIdeal);
    setCrewSize(d.defaultCrewSize);
    setCrewRate(d.defaultCrewRate);
    setContractValue(d.defaultContractValue);
    setVerdict(null);
    setWeather(null);
    setHasRun(false);
  }, []);

  const handleArbitrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const scenario: ScenarioInput = {
      key: selectedKey,
      label: def.label,
      trade: def.trade,
      waitCostPerDay: waitPerDay,
      executeCost,
      daysToIdeal,
      deadlinePressure,
      crewSize,
      crewDailyRate: crewRate,
      contractValue,
    };
    try {
      const res = await fetch('/.netlify/functions/reality-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, useAI }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RealityEngineResponse = await res.json();
      if (data.error && !data.verdict) throw new Error(data.error);
      setVerdict(data.verdict);
      setWeather(data.weather);
      setHasRun(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedKey, def, waitPerDay, executeCost, daysToIdeal, deadlinePressure, crewSize, crewRate, contractValue, useAI]);

  const numInput = (label: string, val: number, setter: (n: number) => void, prefix = '$') => (
    <div className="rne-field">
      <label className="rne-field-label">{label}</label>
      <input
        className="rne-input"
        type="number"
        value={val}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setter(Number(e.target.value))}
      />
    </div>
  );

  return (
    <div className="rne-root">
      <TickerBar />

      {/* Top bar */}
      <div className="rne-topbar">
        <div className="rne-topbar-brand">
          <div className="rne-topbar-icon">⚖</div>
          <div>
            <div className="rne-topbar-title">Reality Engine</div>
            <div className="rne-topbar-sub">Live Arbitration · J. Worden & Sons</div>
          </div>
        </div>
        <div className="rne-topbar-status">
          <div className="rne-status-dot" />
          <span>ARBITRATION READY</span>
        </div>
      </div>

      {/* Hero */}
      <div className="rne-hero">
        <div className="rne-hero-label">Station 11 — Decision Intelligence</div>
        <div className="rne-hero-title">Execute Now · Wait for Ideal Conditions · Crash the Schedule</div>
        <div className="rne-hero-sub">
          Live NOAA weather data + deterministic cost arbitration engine.
          Configure your scenario, set your exposure, and get a signed field verdict with full countermeasure protocol stack.
          Optional Anthropic AI narrative for foreman briefing.
        </div>
      </div>

      <div className="rne-body">
        {/* Left panel */}
        <div className="rne-left">
          {/* Scenario selector */}
          <div>
            <div className="rne-section-label">Select Scenario</div>
            {SCENARIOS.map(s => (
              <div
                key={s.key}
                className={`rne-scenario-card${selectedKey === s.key ? ' active' : ''}`}
                onClick={() => handleScenarioSelect(s.key)}
                style={{ marginBottom: 6 }}
              >
                <div className="rne-scenario-icon">{s.icon}</div>
                <div>
                  <div className="rne-scenario-name">{s.label}</div>
                  <div className="rne-scenario-sub">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Cost inputs */}
          <div>
            <div className="rne-section-label">Cost Parameters</div>
            <div className="rne-field-row">
              {numInput('Wait Cost / Day', waitPerDay, setWaitPerDay)}
              {numInput('Execute Cost (bad conditions)', executeCost, setExecuteCost)}
            </div>
            <div className="rne-field-row" style={{ marginTop: 8 }}>
              {numInput('Days to Ideal Window', daysToIdeal, setDaysToIdeal, '')}
              {numInput('Contract Value', contractValue, setContractValue)}
            </div>
          </div>

          {/* Crew inputs */}
          <div>
            <div className="rne-section-label">Crew Exposure</div>
            <div className="rne-field-row">
              {numInput('Crew Size', crewSize, setCrewSize, '')}
              {numInput('Crew Rate / Day', crewRate, setCrewRate)}
            </div>
          </div>

          {/* Deadline pressure slider */}
          <div>
            <div className="rne-section-label">Deadline Pressure</div>
            <div className="rne-slider-wrap">
              <div className="rne-slider-header">
                <span className="rne-field-label">LD / Schedule Urgency</span>
                <span className="rne-slider-val">{deadlinePressure}</span>
              </div>
              <input
                type="range"
                className="rne-slider"
                min={0} max={100}
                value={deadlinePressure}
                style={{ '--pct': `${deadlinePressure}%` } as React.CSSProperties}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDeadlinePressure(Number(e.target.value))}
              />
              <div className="rne-slider-labels">
                <span>No deadline</span>
                <span>LD clock running</span>
              </div>
            </div>
          </div>

          {/* AI toggle */}
          <label className="rne-ai-toggle">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUseAI(e.target.checked)}
            />
            <span>Include Claude AI field narrative</span>
          </label>

          <button
            className="rne-arbitrate-btn"
            onClick={handleArbitrate}
            disabled={loading}
          >
            {loading ? 'Arbitrating…' : '⚖ Run Arbitration Engine'}
          </button>
        </div>

        {/* Right panel */}
        <div className="rne-right">
          {loading && (
            <div className="rne-loading">
              <div className="rne-spinner" />
              <div className="rne-loading-text">
                Fetching NOAA conditions · Running cost arbitration{useAI ? ' · Generating AI narrative' : ''}…
              </div>
            </div>
          )}

          {!loading && !hasRun && (
            <div className="rne-empty">
              <div className="rne-empty-icon">⚖</div>
              <div className="rne-empty-text">Select a scenario and run the arbitration engine</div>
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 11, color: '#f87171' }}>
              ⚠ {error}
            </div>
          )}

          {!loading && verdict && weather && (
            <VerdictPanel verdict={verdict} weather={weather} />
          )}
        </div>
      </div>
    </div>
  );
};

export default RealityEngineNode;
