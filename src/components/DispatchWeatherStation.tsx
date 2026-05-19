// DispatchWeatherStation.tsx
// src/components/DispatchWeatherStation.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Merged 14-Day Tactical + 90-Day Strategic Weather Dispatch Station
// Premium build: NOAA live forecasts, trade-specific risk engine, SpaceX-liner
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import type { FC } from 'react';
import './DispatchWeatherStation.css';
import type {
  Trade, DayStatus, ViewMode, WeatherDay, DayAnalysis, DispatchApiResponse,
} from '../types/dispatch-weather.types';

// ─── Risk engine ──────────────────────────────────────────────────────────────

function analyzeDayForTrade(day: WeatherDay, trade: Trade): DayAnalysis {
  const warnings: string[] = [];
  let status: DayStatus = 'optimal';
  let financialRisk = 0;
  let profitProtection = 100;
  let seasonalAlert: string | undefined;

  const dt = new Date(day.date);
  const month = dt.getMonth();
  const isFreezing = day.groundTemp < 32 || day.tempLow < 32;
  const isDeepFreeze = day.groundTemp < 20 || day.tempLow < 20;
  const isHighWind = day.windSpeed >= 20;
  const hasRain = day.precipMM > 0;
  const hasHeavyRain = day.precipMM >= 15;
  const isHumidCoating = day.humidity > 85 || Math.abs(day.tempHigh - day.dewPoint) < 5;
  const highPrecipProb = day.precipProbability >= 50;

  if (isDeepFreeze && trade === 'asphalt') {
    seasonalAlert = `Day ${day.dayIndex}: Deep freeze risk — Ground ${day.groundTemp}°F. Near-certain mat failure. Est. ±$42,000 total loss.`;
  }
  if ((month === 11 || month === 0 || month === 1) && trade === 'earthwork') {
    seasonalAlert = `Day ${day.dayIndex}: Winter earthwork — frozen ground. Equipment productivity -40%. Add $18,000 cold-weather ops cost.`;
  }

  switch (trade) {
    case 'asphalt': {
      if (isFreezing) {
        status = 'nogo'; financialRisk = -38000; profitProtection = 0;
        warnings.push(`Ground temp ${day.groundTemp}°F — below 32°F paving threshold. Mat will crack on cooling.`);
      } else if (day.tempLow < 40) {
        status = 'marginal'; financialRisk = -12000; profitProtection = 55;
        warnings.push(`Low temp ${day.tempLow}°F approaching risk floor. Mix cooling too fast — compaction window <90 min.`);
      }
      if (hasRain || highPrecipProb) {
        status = 'nogo'; financialRisk = -28000; profitProtection = 0;
        warnings.push(`Precipitation ${day.precipMM}mm (${day.precipProbability}% prob) — cannot lay asphalt on wet base.`);
      }
      if (day.tempHigh > 95) {
        if (status === 'optimal') { status = 'marginal'; financialRisk = -8000; profitProtection = 65; }
        warnings.push(`High temp ${day.tempHigh}°F — accelerated oxidation, bleed-out risk on chip seals.`);
      }
      if (isHighWind) {
        if (status === 'optimal') { status = 'marginal'; financialRisk = -5000; profitProtection = 70; }
        warnings.push(`Wind ${day.windSpeed}mph — rapid cooling, joint failure risk.`);
      }
      if (status === 'optimal') { financialRisk = 4200; profitProtection = 100; }
      break;
    }
    case 'concrete': {
      if (isDeepFreeze) {
        status = 'nogo'; financialRisk = -55000; profitProtection = 0;
        warnings.push(`Deep freeze — concrete will not cure. Tear-out and replace scenario.`);
      } else if (isFreezing) {
        status = 'nogo'; financialRisk = -32000; profitProtection = 0;
        warnings.push(`Freezing temps — cold-weather protocol required. Without heated enclosure, pour is a no-go.`);
      } else if (day.tempLow < 40) {
        status = 'marginal'; financialRisk = -18000; profitProtection = 50;
        warnings.push(`Temps near freeze — blanket curing required. Add $2,800 cold-weather cost.`);
      }
      if (day.tempHigh > 90) {
        status = status === 'optimal' ? 'marginal' : status;
        financialRisk = Math.min(financialRisk, -9000); profitProtection = Math.min(profitProtection, 60);
        warnings.push(`Heat ${day.tempHigh}°F — rapid evaporation. Plastic shrinkage cracking risk. Sunshade + wet burlap required.`);
      }
      if (hasHeavyRain) {
        status = 'nogo'; financialRisk = -42000; profitProtection = 0;
        warnings.push(`Heavy rain ${day.precipMM}mm — wash-out of surface finish, w/c ratio violation.`);
      } else if (hasRain) {
        if (status === 'optimal') { status = 'marginal'; financialRisk = -7000; profitProtection = 60; }
        warnings.push(`Rain ${day.precipMM}mm (${day.precipProbability}%) — monitor surface moisture closely.`);
      }
      if (isHumidCoating && status === 'optimal') {
        status = 'marginal'; financialRisk = -4000; profitProtection = 72;
        warnings.push(`Dew point spread only ${Math.abs(day.tempHigh - day.dewPoint)}°F — surface blush/scaling risk on finishing.`);
      }
      if (status === 'optimal') { financialRisk = 5800; profitProtection = 100; }
      break;
    }
    case 'earthwork': {
      if (hasHeavyRain || (hasRain && day.precipMM >= 8)) {
        status = 'nogo'; financialRisk = -22000; profitProtection = 0;
        warnings.push(`Rain ${day.precipMM}mm — soil unstable. Equipment risk of getting stuck. Compaction non-compliant.`);
      } else if (hasRain) {
        status = 'marginal'; financialRisk = -6000; profitProtection = 55;
        warnings.push(`Light rain — soil moisture at limit. Monitor proctor compaction hourly.`);
      }
      if (isFreezing) {
        status = 'nogo'; financialRisk = -18000; profitProtection = 0;
        warnings.push(`Frozen ground — excavation impossible without rock saw. Subgrade compaction not achievable.`);
      }
      if (isHighWind) {
        if (status === 'optimal') { status = 'marginal'; financialRisk = -3500; profitProtection = 75; }
        warnings.push(`Wind ${day.windSpeed}mph — airborne dust/silica. OSHA Site Stop trigger if >20mph sustained.`);
      }
      if (status === 'optimal') { financialRisk = 3200; profitProtection = 100; }
      break;
    }
    case 'crane': {
      if (day.windSpeed >= 35) {
        status = 'nogo'; financialRisk = -85000; profitProtection = 0;
        warnings.push(`Wind ${day.windSpeed}mph — crane standby. OSHA 1926.1417 requires shutdown >35mph sustained.`);
      } else if (day.windSpeed >= 25) {
        status = 'marginal'; financialRisk = -28000; profitProtection = 35;
        warnings.push(`Wind ${day.windSpeed}mph approaching limit. Swing radius loads critical.`);
      } else if (isHighWind) {
        status = 'marginal'; financialRisk = -14000; profitProtection = 60;
        warnings.push(`Wind ${day.windSpeed}mph — reduced picks, load factor penalty.`);
      }
      if (hasRain) {
        status = status === 'optimal' ? 'marginal' : status;
        warnings.push(`Rain — operator visibility and rigging slip risk.`);
      }
      if (isFreezing) {
        if (status === 'optimal') { status = 'marginal'; financialRisk = -12000; profitProtection = 55; }
        warnings.push(`Freezing — hydraulic fluid viscosity degraded. Pre-heat cycle required (+90 min).`);
      }
      if (status === 'optimal') { financialRisk = 8500; profitProtection = 100; }
      break;
    }
    case 'roofing': {
      if (hasRain || highPrecipProb) {
        status = 'nogo'; financialRisk = -19000; profitProtection = 0;
        warnings.push(`Precipitation — cannot apply roofing membrane, shingles, or flashing. Water intrusion liability.`);
      }
      if (isHighWind) {
        status = status === 'optimal' ? 'nogo' : status;
        financialRisk = Math.min(financialRisk, -22000); profitProtection = 0;
        warnings.push(`Wind ${day.windSpeed}mph — shingle blow-off, membrane lifting. OSHA fall protection wind restriction.`);
      }
      if (isFreezing) {
        if (status === 'optimal') { status = 'marginal'; financialRisk = -8000; profitProtection = 50; }
        warnings.push(`Freezing — adhesive won't seal. Ice dam risk. Self-adhered membrane won't stick below 40°F.`);
      }
      if (isHumidCoating) {
        if (status === 'optimal') { status = 'marginal'; financialRisk = -5000; profitProtection = 65; }
        warnings.push(`High humidity ${day.humidity}% — coating adhesion compromised. Blister risk on cap sheet.`);
      }
      if (status === 'optimal') { financialRisk = 4800; profitProtection = 100; }
      break;
    }
  }

  const riskLabel = status === 'optimal' ? 'GO' : status === 'marginal' ? 'CAUTION' : 'NO-GO';
  return { day, status, riskLabel, financialRisk, profitProtection, warnings, seasonalAlert };
}

// ─── Ticker data ──────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { label: 'ASPHALT PAVING', sub: '≥40°F LOW · DRY BASE · <20MPH' },
  { label: 'CONCRETE POUR', sub: '40°–90°F · NO RAIN · LOW WIND' },
  { label: 'EARTHWORK / GRADING', sub: 'DRY SOIL · >28°F GROUND' },
  { label: 'CRANE OPS', sub: '<35MPH SUSTAINED · OSHA 1926.1417' },
  { label: 'ROOFING', sub: 'DRY · <20MPH · ≥40°F' },
  { label: 'NOAA NWS LIVE', sub: 'API.WEATHER.GOV · NO KEY REQUIRED' },
  { label: 'CACHE TTL', sub: '5 MIN FRESH · 10 MIN STALE' },
  { label: 'VIRGINIA CLIMATE', sub: 'RICHMOND BASELINE · VA SEASONAL' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const TickerBar: FC = memo(() => (
  <div className="dws-ticker">
    <div className="dws-ticker-track">
      {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
        <span key={i} className="dws-ticker-item">
          <span className="dws-ticker-dot optimal" />
          <b>{item.label}</b> — {item.sub}
        </span>
      ))}
    </div>
  </div>
));

interface StatusDotProps { status: DayStatus }
const StatusDot: FC<StatusDotProps> = ({ status }) => (
  <span className={`dws-ticker-dot ${status}`} />
);

interface DayCard14Props {
  analysis: DayAnalysis;
  selected: boolean;
  onClick: () => void;
}
const DayCard14: FC<DayCard14Props> = memo(({ analysis, selected, onClick }) => {
  const { day, status, financialRisk, warnings } = analysis;
  const label = status === 'optimal' ? '● GO' : status === 'marginal' ? '◐ CAUTION' : '✕ NO-GO';
  return (
    <div
      className={`dws-day-card ${status}${day.isWeekend ? ' weekend' : ''}${selected ? ' selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="dws-day-dow">{day.dayOfWeek}</div>
      <div className="dws-day-date">{day.dayOfMonth}</div>
      <div className="dws-day-month">{day.month.substring(0, 3)}</div>
      <div className={`dws-day-status-pill ${status}`}>
        <StatusDot status={status} /> {label}
      </div>
      <div className="dws-day-temps">
        <span className="dws-day-high">{day.tempHigh}°</span>
        <span className="dws-day-low">{day.tempLow}°</span>
      </div>
      <div className="dws-day-wind">💨 {day.windSpeed}mph</div>
      <div className={`dws-day-precip ${day.precipMM > 0 ? 'wet' : 'dry'}`}>
        {day.precipMM > 0 ? `🌧 ${day.precipMM}mm (${day.precipProbability}%)` : '☀ Clear'}
      </div>
      <div className={`dws-day-risk ${financialRisk < 0 ? 'negative' : 'positive'}`}>
        {financialRisk < 0
          ? `-$${Math.abs(financialRisk).toLocaleString()} risk`
          : `+$${financialRisk.toLocaleString()} protected`}
      </div>
      {warnings.length > 0 && (
        <div className="dws-day-source">⚠ {warnings.length} alert{warnings.length > 1 ? 's' : ''}</div>
      )}
      <div className="dws-day-source">{day.source === 'noaa' ? '⬡ NOAA' : '⬡ SYNTHETIC'}</div>
    </div>
  );
});

interface StripCell90Props {
  analysis: DayAnalysis;
  selected: boolean;
  onClick: () => void;
}
const StripCell90: FC<StripCell90Props> = memo(({ analysis, selected, onClick }) => (
  <div
    className={`dws-strip-cell ${analysis.status}${analysis.day.isWeekend ? ' weekend' : ''}${selected ? ' selected' : ''}`}
    onClick={onClick}
    title={`${analysis.day.dayOfWeek} ${analysis.day.month.substring(0,3)} ${analysis.day.dayOfMonth} — ${analysis.status.toUpperCase()} | ${analysis.day.tempHigh}°F/${analysis.day.tempLow}°F | ${analysis.day.precipMM}mm`}
  />
));

interface DetailPanelProps { analysis: DayAnalysis }
const DetailPanel: FC<DetailPanelProps> = ({ analysis }) => {
  const { day, status, financialRisk, profitProtection, warnings, seasonalAlert } = analysis;
  return (
    <div className="dws-detail">
      <div className="dws-detail-header">
        <div className="dws-detail-date">
          {day.dayOfWeek} {day.month} {day.dayOfMonth}
        </div>
        <div className="dws-detail-dow">Day {day.dayIndex}</div>
        <div className={`dws-detail-status-badge ${status}`}>
          {status === 'optimal' ? '● GO' : status === 'marginal' ? '◐ CAUTION' : '✕ NO-GO'}
        </div>
      </div>

      <div className="dws-detail-col">
        <div className="dws-detail-row">
          <span className="dws-detail-key">Temp High</span>
          <span className="dws-detail-val">{day.tempHigh}°F</span>
        </div>
        <div className="dws-detail-row">
          <span className="dws-detail-key">Temp Low</span>
          <span className="dws-detail-val">{day.tempLow}°F</span>
        </div>
        <div className="dws-detail-row">
          <span className="dws-detail-key">Ground Temp</span>
          <span className="dws-detail-val">{day.groundTemp}°F</span>
        </div>
        <div className="dws-detail-row">
          <span className="dws-detail-key">Wind Speed</span>
          <span className="dws-detail-val">{day.windSpeed}mph{day.windGust ? ` (gust ${day.windGust})` : ''}</span>
        </div>
      </div>

      <div className="dws-detail-col">
        <div className="dws-detail-row">
          <span className="dws-detail-key">Precip</span>
          <span className="dws-detail-val">{day.precipMM}mm ({day.precipProbability}%)</span>
        </div>
        <div className="dws-detail-row">
          <span className="dws-detail-key">Humidity</span>
          <span className="dws-detail-val">{day.humidity}%</span>
        </div>
        <div className="dws-detail-row">
          <span className="dws-detail-key">Dew Point</span>
          <span className="dws-detail-val">{day.dewPoint}°F</span>
        </div>
        <div className="dws-detail-row">
          <span className="dws-detail-key">Source</span>
          <span className="dws-detail-val" style={{ color: day.source === 'noaa' ? '#10b981' : '#f59e0b', fontSize: '11px' }}>
            {day.source === 'noaa' ? '⬡ NOAA LIVE' : '⬡ SYNTHETIC'}
          </span>
        </div>
      </div>

      {day.shortForecast && (
        <div className="dws-forecast-text">
          "{day.shortForecast}{day.detailedForecast ? ' — ' + day.detailedForecast.substring(0, 120) + '...' : ''}"
        </div>
      )}

      {warnings.length > 0 && (
        <div className="dws-warnings">
          {warnings.map((w, i) => (
            <div key={i} className="dws-warning-item">
              <span className="dws-warning-icon">⚠</span>
              {w}
            </div>
          ))}
        </div>
      )}

      {seasonalAlert && (
        <div className="dws-seasonal-alert">
          🔔 SEASONAL ALERT — {seasonalAlert}
        </div>
      )}

      <div className="dws-detail-row" style={{ gridColumn: '1/-1', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(245,166,35,0.1)' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#6b7fa3', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Financial Risk</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: financialRisk < 0 ? '#ef4444' : '#10b981' }}>
            {financialRisk < 0 ? `-$${Math.abs(financialRisk).toLocaleString()}` : `+$${financialRisk.toLocaleString()}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#6b7fa3', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Margin Protected</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: profitProtection >= 80 ? '#10b981' : profitProtection >= 50 ? '#f59e0b' : '#ef4444' }}>
            {profitProtection}%
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Financial Summary ────────────────────────────────────────────────────────

interface FinSummaryProps { analyses: DayAnalysis[] }
const FinSummary: FC<FinSummaryProps> = ({ analyses }) => {
  const go = analyses.filter(a => a.status === 'optimal').length;
  const marginal = analyses.filter(a => a.status === 'marginal').length;
  const nogo = analyses.filter(a => a.status === 'nogo').length;
  const totalRisk = analyses.reduce((s, a) => s + (a.financialRisk < 0 ? a.financialRisk : 0), 0);
  const totalProtected = analyses.reduce((s, a) => s + (a.financialRisk > 0 ? a.financialRisk : 0), 0);
  return (
    <div className="dws-fin-row">
      <div className="dws-fin-card">
        <div className="dws-fin-label">Go Days</div>
        <div className="dws-fin-value green">{go}</div>
        <div className="dws-fin-sub">of {analyses.length} scheduled</div>
      </div>
      <div className="dws-fin-card">
        <div className="dws-fin-label">Caution Days</div>
        <div className="dws-fin-value yellow">{marginal}</div>
        <div className="dws-fin-sub">monitor conditions</div>
      </div>
      <div className="dws-fin-card">
        <div className="dws-fin-label">No-Go Days</div>
        <div className="dws-fin-value red">{nogo}</div>
        <div className="dws-fin-sub">reschedule required</div>
      </div>
      <div className="dws-fin-card">
        <div className="dws-fin-label">Margin at Risk</div>
        <div className="dws-fin-value ${totalRisk < 0 ? 'red' : 'green'}">
          {totalRisk < 0 ? `-$${Math.abs(totalRisk).toLocaleString()}` : '+$0'}
        </div>
        <div className="dws-fin-sub">
          +$${totalProtected.toLocaleString()} protected
        </div>
      </div>
    </div>
  );
};

// ─── 90-Day grid grouped by month ─────────────────────────────────────────────

interface Grid90Props {
  analyses: DayAnalysis[];
  selected: number | null;
  onSelect: (idx: number) => void;
}
const Grid90: FC<Grid90Props> = memo(({ analyses, selected, onSelect }) => {
  // Group by month
  const months: Record<string, DayAnalysis[]> = {};
  for (const a of analyses) {
    const key = a.day.month + ' ' + new Date(a.day.date).getFullYear();
    if (!months[key]) months[key] = [];
    months[key].push(a);
  }
  return (
    <div className="dws-grid90-wrapper">
      <div className="dws-grid90-months">
        {Object.entries(months).map(([month, days]) => (
          <div key={month} className="dws-month-row">
            <div className="dws-month-label">{month}</div>
            <div className="dws-month-days">
              {days.map((a) => (
                <StripCell90
                  key={a.day.dayIndex}
                  analysis={a}
                  selected={selected === a.day.dayIndex}
                  onClick={() => onSelect(a.day.dayIndex)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── 14-Day grid ──────────────────────────────────────────────────────────────

interface Grid14Props {
  analyses: DayAnalysis[];
  selected: number | null;
  onSelect: (idx: number) => void;
}
const Grid14: FC<Grid14Props> = memo(({ analyses, selected, onSelect }) => (
  <div className="dws-grid14">
    {analyses.map((a) => (
      <DayCard14
        key={a.day.dayIndex}
        analysis={a}
        selected={selected === a.day.dayIndex}
        onClick={() => onSelect(a.day.dayIndex)}
      />
    ))}
  </div>
));

// ─── Main component ───────────────────────────────────────────────────────────

const TRADES: { key: Trade; label: string }[] = [
  { key: 'asphalt', label: 'Asphalt' },
  { key: 'concrete', label: 'Concrete' },
  { key: 'earthwork', label: 'Earthwork' },
  { key: 'crane', label: 'Crane' },
  { key: 'roofing', label: 'Roofing' },
];

const DispatchWeatherStation: FC = () => {
  const [view, setView] = useState<ViewMode>('14day');
  const [trade, setTrade] = useState<Trade>('asphalt');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [forecast14, setForecast14] = useState<WeatherDay[]>([]);
  const [forecast90, setForecast90] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'noaa' | 'synthetic'>('synthetic');

  // Fetch on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const [r14, r90] = await Promise.allSettled([
          fetch('/.netlify/functions/dispatch?days=14').then(r => r.json() as Promise<DispatchApiResponse>),
          fetch('/.netlify/functions/dispatch?days=90').then(r => r.json() as Promise<DispatchApiResponse>),
        ]);
        if (cancelled) return;
        if (r14.status === 'fulfilled' && r14.value.forecast.length > 0) {
          setForecast14(r14.value.forecast);
          const hasLive = r14.value.forecast.some(d => d.source === 'noaa');
          setDataSource(hasLive ? 'noaa' : 'synthetic');
        }
        if (r90.status === 'fulfilled' && r90.value.forecast.length > 0) {
          setForecast90(r90.value.forecast);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const analyses14 = useMemo(() =>
    forecast14.map(d => analyzeDayForTrade(d, trade)),
    [forecast14, trade]
  );
  const analyses90 = useMemo(() =>
    forecast90.map(d => analyzeDayForTrade(d, trade)),
    [forecast90, trade]
  );

  const activeAnalyses = view === '14day' ? analyses14 : analyses90;
  const selectedAnalysis = selectedDay != null
    ? activeAnalyses.find(a => a.day.dayIndex === selectedDay)
    : null;

  const handleSelectDay = useCallback((idx: number) => {
    setSelectedDay(prev => prev === idx ? null : idx);
  }, []);

  // Summary stats
  const goCount = activeAnalyses.filter(a => a.status === 'optimal').length;
  const nogoCount = activeAnalyses.filter(a => a.status === 'nogo').length;
  const totalRiskDollars = activeAnalyses.reduce((s, a) => s + (a.financialRisk < 0 ? a.financialRisk : 0), 0);

  return (
    <div className="dws-root">
      <TickerBar />

      {/* Top bar */}
      <div className="dws-topbar">
        <div className="dws-topbar-brand">
          <div className="dws-topbar-icon">🌦</div>
          <div>
            <div className="dws-topbar-title">Dispatch Weather Station</div>
            <div className="dws-topbar-sub">Trade Risk Intelligence · J. Worden & Sons</div>
          </div>
        </div>
        <div className="dws-topbar-status">
          <div className="dws-status-dot" />
          <span>{dataSource === 'noaa' ? 'NOAA LIVE' : 'SYNTHETIC MODEL'}</span>
        </div>
      </div>

      {/* Hero stats */}
      <div className="dws-hero">
        <div className="dws-hero-row">
          <div className="dws-hero-stat">
            <div className="dws-hero-label">Go Days</div>
            <div className="dws-hero-value" style={{ color: '#10b981' }}>
              {loading ? '—' : goCount}
              <span className="dws-hero-unit">/ {activeAnalyses.length}</span>
            </div>
          </div>
          <div className="dws-hero-divider" />
          <div className="dws-hero-stat">
            <div className="dws-hero-label">No-Go Days</div>
            <div className="dws-hero-value" style={{ color: '#ef4444' }}>
              {loading ? '—' : nogoCount}
            </div>
          </div>
          <div className="dws-hero-divider" />
          <div className="dws-hero-stat">
            <div className="dws-hero-label">Margin at Risk</div>
            <div className="dws-hero-value" style={{ color: totalRiskDollars < 0 ? '#ef4444' : '#f5a623' }}>
              {loading ? '—' : totalRiskDollars < 0 ? `-$${Math.abs(totalRiskDollars / 1000).toFixed(0)}K` : '$0'}
            </div>
          </div>
          <div className="dws-hero-divider" />
          <div className="dws-hero-stat">
            <div className="dws-hero-label">Horizon</div>
            <div className="dws-hero-value">{view === '14day' ? '14' : '90'}<span className="dws-hero-unit">days</span></div>
          </div>
          <div className={`dws-source-badge ${dataSource}`}>
            {dataSource === 'noaa' ? '⬡ NOAA LIVE' : '⬡ SYNTHETIC'}
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div className="dws-tabs">
        <button
          className={`dws-tab${view === '14day' ? ' active' : ''}`}
          onClick={() => { setView('14day'); setSelectedDay(null); }}
        >
          14-Day Tactical
        </button>
        <button
          className={`dws-tab${view === '90day' ? ' active' : ''}`}
          onClick={() => { setView('90day'); setSelectedDay(null); }}
        >
          90-Day Strategic
        </button>
      </div>

      {/* Trade controls */}
      <div className="dws-controls">
        <span className="dws-control-label">Trade</span>
        <div className="dws-trade-btns">
          {TRADES.map(t => (
            <button
              key={t.key}
              className={`dws-trade-btn${trade === t.key ? ' active' : ''}`}
              onClick={() => { setTrade(t.key); setSelectedDay(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="dws-loading">
          <div className="dws-spinner" />
          <div className="dws-loading-text">Fetching NOAA forecast…</div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="dws-error">⚠ {error} — showing synthetic fallback data</div>
      )}

      {/* Financial summary */}
      {!loading && <FinSummary analyses={activeAnalyses} />}

      {/* 14-Day grid */}
      {!loading && view === '14day' && (
        <Grid14 analyses={analyses14} selected={selectedDay} onSelect={handleSelectDay} />
      )}

      {/* 90-Day grid */}
      {!loading && view === '90day' && (
        <Grid90 analyses={analyses90} selected={selectedDay} onSelect={handleSelectDay} />
      )}

      {/* Detail panel */}
      {selectedAnalysis && <DetailPanel analysis={selectedAnalysis} />}
    </div>
  );
};

export default DispatchWeatherStation;
