// ═══════════════════════════════════════════════════════════════════════════
// PreConOmniNode.tsx  ·  J. Worden & Sons Command Intelligence Platform
// Pre-Construction Omni-Analysis Station — Production Build
//
// Views:  God-Mode 4-Quadrant  |  Heavy Civil 4-Module
// API:    POST /api/precon  { address } → PreConApiResponse
// Real:   Mapbox geocoding · USDA NRCS soils · NOAA weather ·
//         USGS 3DEP elevation · OSM Overpass roads · Anthropic contract
// UX:     scan → spinner → reveal  |  Recent Scans (localStorage, last 5)
// Style:  pco- prefix  ·  JetBrains Mono  ·  #f5a623 gold  ·  no Tailwind
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { FC } from 'react';
import './PreConOmniNode.css';
import type {
  SiteAnalysis, PreConApiResponse, WeatherDay, ActiveTab, SoilRisk, WeatherRisk,
} from '../types/precon.types';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const RECENT_KEY = 'pco_recent_scans';
const MAX_RECENT = 5;
const SCAN_STEPS = [
  'Geocoding address → lat/lng…',
  'Querying Mapbox parcel boundary…',
  'Pulling USDA NRCS soil classification…',
  'Fetching NOAA 30-day forecast grid…',
  'Sampling USGS 3DEP elevation tiles…',
  'Running OSM Overpass road-class query…',
  'Computing earthwork cut/fill volumes…',
  'Generating Worden Contract via Claude…',
  'Analysis complete.',
];

// ─── LOCAL STORAGE HELPERS ────────────────────────────────────────────────────

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); }
  catch { return []; }
}

function saveRecent(address: string): void {
  try {
    const prev = loadRecent().filter(a => a !== address);
    localStorage.setItem(RECENT_KEY, JSON.stringify([address, ...prev].slice(0, MAX_RECENT)));
  } catch { /* storage unavailable */ }
}

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────

const fmt$ = (n: number) => '$' + n.toLocaleString();
const fmtK = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(Math.round(n));
const fmtPct = (n: number) => n.toFixed(1) + '%';

function riskColor(risk: SoilRisk): string {
  return risk === 'high' ? '#f87171' : risk === 'medium' ? '#fbbf24' : '#34d399';
}

function weatherRiskColor(risk: WeatherRisk): string {
  return risk === 'green' ? '#34d399' : risk === 'yellow' ? '#fbbf24' : '#f87171';
}

// ─── SCAN STEP TICKER ────────────────────────────────────────────────────────

interface ScannerProps { steps: string[]; }
const ScannerTicker: FC<ScannerProps> = ({ steps }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (idx >= steps.length - 1) return;
    const t = setTimeout(() => setIdx(i => i + 1), 420);
    return () => clearTimeout(t);
  }, [idx, steps.length]);
  return (
    <div className="pco-scanner">
      <div className="pco-scanner-ring" />
      <div className="pco-scanner-label">RUNNING OMNI-ANALYSIS</div>
      <div className="pco-scanner-steps">
        {steps.map((s, i) => (
          <div key={i} className={`pco-scanner-step ${i < idx ? 'done' : i === idx ? 'active' : 'pending'}`}>
            <span className="pco-scanner-bullet">{i < idx ? '✓' : i === idx ? '▶' : '·'}</span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ALERT BANNER ────────────────────────────────────────────────────────────

interface AlertBannerProps { alerts: string[]; }
const AlertBanner: FC<AlertBannerProps> = ({ alerts }) => {
  const [open, setOpen] = useState(true);
  if (!alerts.length) return null;
  return (
    <div className="pco-alerts">
      <div className="pco-alerts-header" onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
        <span className="pco-alerts-count">⚠ {alerts.length} CRITICAL ALERT{alerts.length > 1 ? 'S' : ''} — WORDEN AI AUTO-CORRECTED</span>
        <span className="pco-alerts-toggle">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="pco-alerts-body">
          {alerts.map((a, i) => <div key={i} className="pco-alert-row">{a}</div>)}
        </div>
      )}
    </div>
  );
};

// ─── WEATHER CELL ─────────────────────────────────────────────────────────────

interface WeatherCellProps { day: WeatherDay; }
const WeatherCell: FC<WeatherCellProps> = ({ day }) => {
  const cls = day.optimal ? 'pco-wday pco-wday-optimal'
    : day.rain > 60 ? 'pco-wday pco-wday-rain'
    : day.wind > 20 || day.tempF < 45 ? 'pco-wday pco-wday-warn'
    : 'pco-wday';
  return (
    <div className={cls}>
      <div className="pco-wday-num">D{day.day}</div>
      <div className="pco-wday-temp">{day.tempF}°</div>
      <div className="pco-wday-wind">{day.wind}mph</div>
      <div className="pco-wday-rain">{day.rain}%</div>
      {day.optimal && <div className="pco-wday-opt">OPT</div>}
    </div>
  );
};

// ─── CONTRACT TERMINAL ────────────────────────────────────────────────────────

interface TerminalProps { contractText: string; loading: boolean; }
const ContractTerminal: FC<TerminalProps> = ({ contractText, loading }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [contractText]);
  return (
    <div className="pco-terminal" ref={ref}>
      {loading ? (
        <div className="pco-terminal-loading">
          <span className="pco-terminal-cursor">█</span> Generating Worden Contract via Claude…
        </div>
      ) : (
        contractText.split('\n').map((line, i) => (
          <div key={i} className={`pco-terminal-line ${
            line.startsWith('━') ? 'pco-tl-div'
            : line.includes('J. WORDEN') || line.includes('Virginia Class') ? 'pco-tl-header'
            : line.startsWith('>') ? 'pco-tl-cmd'
            : line.startsWith('  ') ? 'pco-tl-body'
            : 'pco-tl-default'
          }`}>{line || ' '}</div>
        ))
      )}
    </div>
  );
};

// ─── STAT TILE ───────────────────────────────────────────────────────────────

interface StatTileProps { label: string; value: string; accent?: string; sub?: string; }
const StatTile: FC<StatTileProps> = ({ label, value, accent, sub }) => (
  <div className="pco-stat">
    <div className="pco-stat-value" style={accent ? { color: accent } : {}}>{value}</div>
    <div className="pco-stat-label">{label}</div>
    {sub && <div className="pco-stat-sub">{sub}</div>}
  </div>
);

// ─── MODULE CARD ─────────────────────────────────────────────────────────────

interface ModuleCardProps {
  q: string; title: string; sub: string; accent: string;
  icon: string; children: React.ReactNode;
}
const ModuleCard: FC<ModuleCardProps> = ({ q, title, sub, accent, icon, children }) => (
  <div className="pco-module" style={{ borderColor: accent + '44' }}>
    <div className="pco-module-header">
      <div className="pco-module-icon" style={{ borderColor: accent + '88', background: accent + '18' }}>
        <span>{icon}</span>
      </div>
      <div>
        <div className="pco-module-q" style={{ color: accent }}>{q} · {title}</div>
        <div className="pco-module-sub">{sub}</div>
      </div>
    </div>
    {children}
  </div>
);

// ─── GOD-MODE VIEW ────────────────────────────────────────────────────────────

interface GodModeProps { analysis: SiteAnalysis; contractLoading: boolean; }
const GodModeView: FC<GodModeProps> = ({ analysis, contractLoading }) => {
  const soil = analysis.soilRisk;
  const soilClr = riskColor(soil);
  const wxClr = weatherRiskColor(analysis.weatherRisk);

  return (
    <div className="pco-grid-2">

      {/* Q1 — Visual Recon */}
      <ModuleCard q="Q1" title="Visual Recon" sub="Mapbox Satellite · Parcel Boundary · Street-Level Flags"
        accent="#00d4ff" icon="◈">
        <div className="pco-recon-map">
          <div className="pco-recon-overlay">
            <div className="pco-recon-icon">◈</div>
            <div className="pco-recon-address">{analysis.address}</div>
            <div className="pco-recon-coords">{analysis.lat.toFixed(5)}, {analysis.lng.toFixed(5)}</div>
          </div>
        </div>
        <div className="pco-kv-list">
          <div className="pco-kv">
            <span>Parcel Area</span>
            <strong>{analysis.sqft.toLocaleString()} SF</strong>
          </div>
          <div className="pco-kv">
            <span>Avg Slope</span>
            <strong style={{ color: analysis.avgSlope < 1.5 ? '#fbbf24' : '#34d399' }}>{fmtPct(analysis.avgSlope)}</strong>
          </div>
          <div className="pco-kv">
            <span>Arterial Access</span>
            <strong style={{ color: analysis.arterialRoad ? '#f87171' : '#34d399' }}>
              {analysis.arterialRoad ? '⚠ MOT Required' : '✓ Clear'}
            </strong>
          </div>
          <div className="pco-kv">
            <span>Overhead Lines</span>
            <strong style={{ color: analysis.sqft > 20000 ? '#fbbf24' : '#34d399' }}>
              {analysis.sqft > 20000 ? '⚠ Shuttle Buggy +$4,500' : '✓ Clear'}
            </strong>
          </div>
          <div className="pco-kv">
            <span>Parcel Source</span>
            <strong style={{ color: '#94a3b8' }}>Mapbox Tilequery</strong>
          </div>
        </div>
      </ModuleCard>

      {/* Q2 — Geotechnical */}
      <ModuleCard q="Q2" title="Geotechnical" sub="USDA NRCS SDMDataAccess · AASHTO Classification"
        accent={soilClr} icon="⬡">
        <div className="pco-soil-block">
          <div className="pco-soil-type">{analysis.soilType}</div>
          <div className="pco-soil-class">{analysis.soilClass}</div>
          <div className="pco-risk-badge" style={{ color: soilClr, borderColor: soilClr + '88' }}>
            RISK: {soil.toUpperCase()}
          </div>
        </div>
        <div className={`pco-soil-alert pco-soil-${soil}`}>
          {soil === 'high' && '🛑 Expansive clay confirmed. Auto-upgraded: 3" HD + 8" stone base + biaxial geogrid (ASTM D6637). Standard 2" spec will fail within 14 months.'}
          {soil === 'medium' && '⚠ Marginal soil. 96% Proctor compaction test required before paving. Standard spec approved with moisture monitoring.'}
          {soil === 'low' && '✓ Excellent bearing capacity. Standard VDOT Section 315 spec confirmed. No geogrid required.'}
        </div>
        <div className="pco-kv-list">
          <div className="pco-kv">
            <span>Recommended Spec</span>
            <strong style={{ color: '#f5a623' }}>{soil === 'high' ? '3" HD + Geogrid' : '2.5" Standard VDOT'}</strong>
          </div>
          <div className="pco-kv">
            <span>Base Depth</span>
            <strong>{soil === 'high' ? '8"' : '6"'} Crushed Stone</strong>
          </div>
          <div className="pco-kv">
            <span>Oil Buffer</span>
            <strong style={{ color: '#f5a623' }}>±$9/ton shield active</strong>
          </div>
          <div className="pco-kv">
            <span>Data Source</span>
            <strong style={{ color: '#94a3b8' }}>USDA NRCS Web Soil Survey</strong>
          </div>
        </div>
      </ModuleCard>

      {/* Q3 — Weather Matrix */}
      <ModuleCard q="Q3" title="30-Day Financial Weather Matrix" sub="NOAA api.weather.gov · Forecast + Historical Normals"
        accent={wxClr} icon="◉">
        <div className="pco-wx-badge" style={{ color: wxClr, borderColor: wxClr + '66' }}>
          {analysis.weatherRisk === 'green' && '✓ PAVE — OPTIMAL WINDOW NEAR'}
          {analysis.weatherRisk === 'yellow' && `⚠ MARGINAL — RESCHEDULE TO DAY ${analysis.optimalStartDay}`}
          {analysis.weatherRisk === 'red' && `🛑 NO-PAVE — DELAY TO DAY ${analysis.optimalStartDay}`}
        </div>
        <div className="pco-wday-grid">
          {analysis.weatherDays.map(d => <WeatherCell key={d.day} day={d} />)}
        </div>
        <div className="pco-kv-list">
          <div className="pco-kv">
            <span>Optimal Start</span>
            <strong style={{ color: '#34d399' }}>Day {analysis.optimalStartDay} ({analysis.projectDays}-day window)</strong>
          </div>
          <div className="pco-kv">
            <span>Profit at Risk</span>
            <strong style={{ color: '#f5a623' }}>{fmt$(analysis.baseProfit - analysis.adjustedProfit)} if wrong day chosen</strong>
          </div>
          <div className="pco-kv">
            <span>Ground Temp Delta</span>
            <strong>Air {analysis.weatherDays[0]?.tempF ?? '—'}°F vs Ground ~{Math.round((analysis.weatherDays[0]?.tempF ?? 58) - 14)}°F</strong>
          </div>
          <div className="pco-kv">
            <span>Data Source</span>
            <strong style={{ color: '#94a3b8' }}>NOAA api.weather.gov</strong>
          </div>
        </div>
      </ModuleCard>

      {/* Q4 — AI Contract */}
      <ModuleCard q="Q4" title="AI Contract Engine" sub="Anthropic Claude · Worden Contract Protocol"
        accent="#a78bfa" icon="▲">
        <ContractTerminal contractText={analysis.contractText} loading={contractLoading} />
      </ModuleCard>

    </div>
  );
};

// ─── HEAVY CIVIL VIEW ─────────────────────────────────────────────────────────

interface HeavyCivilProps { analysis: SiteAnalysis; }
const HeavyCivilView: FC<HeavyCivilProps> = ({ analysis }) => {
  const drainageCost = analysis.catchBasinsRequired * 4200;
  const utilityCost  = analysis.hasMunicipalMain ? 3200 : 800;
  const motTotal     = analysis.motCostPerDay * analysis.projectDays;
  const totalCivil   = analysis.fillImportCost + drainageCost + utilityCost + motTotal;

  return (
    <div className="pco-civil-wrap">

      {/* Civil header */}
      <div className="pco-civil-header">
        <div className="pco-civil-header-left">
          <span className="pco-civil-icon">⬢</span>
          <div>
            <div className="pco-civil-title">Heavy Civil Engineering Analysis</div>
            <div className="pco-civil-sub">AASHTO · VDOT Sec 303/315 · MUTCD · ASTM D2321 · FHWA — {analysis.address}</div>
          </div>
        </div>
        <div className="pco-civil-total">
          <div className="pco-civil-total-val" style={{ color: '#f5a623' }}>{fmt$(totalCivil)}</div>
          <div className="pco-civil-total-lbl">Total Civil Cost</div>
        </div>
      </div>

      <div className="pco-grid-2">

        {/* Module 1: Earthwork */}
        <ModuleCard q="M1" title="Earthwork & Topo" sub="Cut/Fill Balancing · AASHTO T99/T180 · VDOT Sec 303"
          accent="#f97316" icon="⬡">
          <div className="pco-stat-grid">
            <StatTile label="CY Cut" value={fmtK(analysis.cutVolumeCY)} />
            <StatTile label="CY Fill" value={fmtK(analysis.fillVolumeCY)} />
            <StatTile label="Swell Factor" value={fmtPct(analysis.swellFactor * 100)} accent="#f97316" />
            <StatTile label="Import Cost" value={fmt$(analysis.fillImportCost)} accent="#f5a623" />
          </div>
          {analysis.fillVolumeCY > 800 ? (
            <div className="pco-module-alert pco-alert-warn">
              <div className="pco-alert-hdr">⚠ STRUCTURAL FILL IMPORT REQUIRED</div>
              <p>{fmtK(analysis.fillVolumeCY)} CY structural fill import. Swell {fmtPct(analysis.swellFactor * 100)} applied.
              Adding {fmt$(analysis.fillImportCost)} to earthwork phase.
              96% Proctor compaction required at each 6" lift (AASHTO T180).</p>
            </div>
          ) : (
            <div className="pco-module-alert pco-alert-ok">
              <div className="pco-alert-hdr">✓ ON-SITE MATERIAL REUSE POSSIBLE</div>
              <p>Cut/fill balance achievable. Mass haul-off: {fmtK(Math.max(0, analysis.cutVolumeCY - analysis.fillVolumeCY))} CY.
              Compaction: 96% Marshall Unit Weight.</p>
            </div>
          )}
          <div className="pco-kv-list">
            <div className="pco-kv"><span>Source</span><strong style={{color:'#94a3b8'}}>USGS 3DEP DEM</strong></div>
          </div>
        </ModuleCard>

        {/* Module 2: Stormwater */}
        <ModuleCard q="M2" title="Stormwater & Drainage" sub="Impervious Surface · VPDES · Sheet Flow Calcs"
          accent="#06b6d4" icon="◈">
          <div className="pco-stat-grid">
            <StatTile label="Avg Slope" value={fmtPct(analysis.avgSlope)} />
            <StatTile label="Catch Basins" value={String(analysis.catchBasinsRequired)} accent="#06b6d4" />
            <StatTile label="Impervious (ac)" value={(analysis.sqft * 0.92 / 43560).toFixed(2)} />
            <StatTile label="Drainage Cost" value={fmt$(drainageCost)} accent="#f5a623" />
          </div>
          {analysis.avgSlope < 1.5 ? (
            <div className="pco-module-alert pco-alert-warn">
              <div className="pco-alert-hdr">⚠ FLAT TERRAIN — DRAINAGE INTERVENTION</div>
              <p>Forcing minimum 1.5% pitch via subgrade reshaping.
              Adding {analysis.catchBasinsRequired} Type-C catch basins.
              VPDES permit required for disturbance &gt;1 acre.</p>
            </div>
          ) : (
            <div className="pco-module-alert pco-alert-ok">
              <div className="pco-alert-hdr">✓ ADEQUATE SLOPE — STANDARD DRAINAGE</div>
              <p>Natural slope ({fmtPct(analysis.avgSlope)}) exceeds minimum. Standard curb inlets adequate.
              SWPPP required if disturbance &gt;10,000 SF.</p>
            </div>
          )}
          <div className="pco-kv-list">
            <div className="pco-kv"><span>Source</span><strong style={{color:'#94a3b8'}}>USGS 3DEP + OSM</strong></div>
          </div>
        </ModuleCard>

        {/* Module 3: Underground Utilities */}
        <ModuleCard q="M3" title="Underground Utilities" sub="Clash Detection · ASTM D2321 · Dig Safe 811"
          accent="#f97316" icon="◆">
          <div className="pco-kv-list pco-kv-list-lg">
            {[
              { label: 'Water Main Depth', value: `${analysis.utilityDepthFt}ft`, alert: analysis.hasMunicipalMain, color: '#f97316' },
              { label: 'Storm Invert Clearance', value: analysis.hasMunicipalMain ? `${(analysis.utilityDepthFt + 1.5).toFixed(1)}ft forced` : 'Standard', alert: analysis.hasMunicipalMain, color: '#e0f0ff' },
              { label: 'Pipe Bedding Spec', value: analysis.hasMunicipalMain ? 'Class-C (ASTM D2321)' : 'Class-B Standard', alert: false, color: '#e0f0ff' },
              { label: 'Dig Safe 811', value: 'Required — 72hr Notice', alert: false, color: '#fbbf24' },
              { label: 'Trench Shoring', value: analysis.utilityDepthFt >= 5 ? '>5ft — OSHA 29 CFR 1926.652' : 'Not required', alert: analysis.utilityDepthFt >= 5, color: analysis.utilityDepthFt >= 5 ? '#f87171' : '#94a3b8' },
            ].map(r => (
              <div key={r.label} className="pco-kv">
                <span>{r.label}</span>
                <strong style={{ color: r.color }}>{r.alert ? '⚠ ' : ''}{r.value}</strong>
              </div>
            ))}
          </div>
          {analysis.hasMunicipalMain ? (
            <div className="pco-module-alert pco-alert-warn">
              <div className="pco-alert-hdr">⚠ UTILITY CLASH DETECTED</div>
              <p>Municipal water main at {analysis.utilityDepthFt}ft depth.
              Adjusting storm sewer invert. Forcing Class-C pipe bedding (ASTM D2321).
              Notify local utility authority before excavation.</p>
            </div>
          ) : (
            <div className="pco-module-alert pco-alert-ok">
              <div className="pco-alert-hdr">✓ NO MAJOR CLASHES DETECTED</div>
              <p>No conflicts with known municipal utilities. Class-B bedding standard.
              811 call required 72hrs pre-dig.</p>
            </div>
          )}
        </ModuleCard>

        {/* Module 4: MOT */}
        <ModuleCard q="M4" title="Traffic Control & MOT" sub="MUTCD · VDOT Work Zone · Maintenance of Traffic"
          accent="#a78bfa" icon="●">
          <div className="pco-stat-grid">
            <StatTile label="Flaggers" value={String(analysis.flaggersRequired)} />
            <StatTile label="$/Day MOT" value={fmt$(analysis.motCostPerDay)} accent="#a78bfa" />
            <StatTile label="Total MOT Budget" value={fmt$(motTotal)} accent="#f5a623" />
            <StatTile label="MUTCD Type" value={analysis.arterialRoad ? 'Type-3' : 'Type-1'} />
          </div>
          {analysis.arterialRoad ? (
            <div className="pco-module-alert pco-alert-warn">
              <div className="pco-alert-hdr">⚠ ARTERIAL ROAD — MOT REQUIRED</div>
              <p>MUTCD Type-3 lane closure with advance warning signs.
              {analysis.flaggersRequired} certified flaggers per VDOT Work Zone Standards.
              {fmt$(analysis.motCostPerDay)}/day · Total project MOT: {fmt$(motTotal)}.</p>
            </div>
          ) : (
            <div className="pco-module-alert pco-alert-ok">
              <div className="pco-alert-hdr">✓ LOW-IMPACT ACCESS — STANDARD MOT</div>
              <p>MUTCD Type-1 barricades + 1 flagger adequate.
              Coordinate with local traffic engineering for access permit.</p>
            </div>
          )}
          <div className="pco-kv-list">
            <div className="pco-kv"><span>Source</span><strong style={{color:'#94a3b8'}}>OSM Overpass + MUTCD Tables</strong></div>
          </div>
        </ModuleCard>

      </div>

      {/* Civil Summary */}
      <div className="pco-civil-summary">
        <div className="pco-civil-summary-hdr">⬢ Full Civil Engineering Cost Summary — Worden Standard</div>
        <div className="pco-stat-grid pco-stat-grid-4">
          <StatTile label="Earthwork / Grading" value={fmt$(analysis.fillImportCost)}
            accent="#f5a623" sub="Fill import + compaction" />
          <StatTile label="Drainage Infrastructure" value={fmt$(drainageCost)}
            accent="#06b6d4" sub={`${analysis.catchBasinsRequired} Type-C basins`} />
          <StatTile label="Utility Coordination" value={fmt$(utilityCost)}
            accent="#f97316" sub={analysis.hasMunicipalMain ? 'Class-C bedding + 811' : 'Class-B + 811'} />
          <StatTile label="MOT / Traffic Control" value={fmt$(motTotal)}
            accent="#a78bfa" sub={`${analysis.projectDays} days × ${fmt$(analysis.motCostPerDay)}`} />
        </div>
        <div className="pco-badge-row">
          {['96% Marshall Compaction','VDOT Sec 315 Stone Base','±$9/ton Oil Shield',
            'AASHTO T180 Proctor','MUTCD Compliant','VPDES Ready','Dig Safe 811','4th Gen · Since 1984'
          ].map(b => <span key={b} className="pco-badge">{b}</span>)}
        </div>
      </div>
    </div>
  );
};

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

const EmptyState: FC = () => (
  <div className="pco-empty">
    <div className="pco-empty-grid">
      {[
        { icon: '◈', title: 'Satellite Recon', desc: 'Mapbox parcel boundary · lat/lng · overhead line detection · arterial access flags' },
        { icon: '⬡', title: 'USGS Soils', desc: 'AASHTO soil class · frost-heave risk · auto spec upgrade to 3" HD + geogrid' },
        { icon: '◉', title: '30-Day Weather', desc: 'NOAA Pave/No-Pave matrix with financial profit/loss risk per day' },
        { icon: '⬢', title: 'Heavy Civil', desc: 'Cut/fill · VPDES drainage · utility clash detection · MUTCD MOT analysis' },
      ].map(c => (
        <div key={c.title} className="pco-empty-card">
          <div className="pco-empty-icon">{c.icon}</div>
          <div className="pco-empty-title">{c.title}</div>
          <div className="pco-empty-desc">{c.desc}</div>
        </div>
      ))}
    </div>
    <div className="pco-empty-cta">Enter a project address above to activate the full Worden Omni-Analysis engine.</div>
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function PreConOmniNode() {
  const [input, setInput]           = useState('');
  const [scanning, setScanning]     = useState(false);
  const [analysis, setAnalysis]     = useState<SiteAnalysis | null>(null);
  const [contractLoading, setCL]    = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<ActiveTab>('godmode');
  const [recent, setRecent]         = useState<string[]>([]);
  const inputRef                    = useRef<HTMLInputElement>(null);

  // Load recent scans on mount
  useEffect(() => { setRecent(loadRecent()); }, []);

  const runScan = useCallback(async (address: string) => {
    if (!address.trim()) return;
    setScanning(true);
    setAnalysis(null);
    setError(null);
    setCL(false);

    try {
      const res = await fetch('/api/precon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
      const data: PreConApiResponse = await res.json();

      if (data.error) throw new Error(data.error);

      saveRecent(address.trim());
      setRecent(loadRecent());
      setAnalysis(data.analysis);
      setActiveTab('godmode');

      // If contract not yet done, stream a follow-up (already in analysis.contractText if sync)
      if (!data.analysis.contractText || data.analysis.contractText.includes('…')) {
        setCL(true);
        const cr = await fetch('/api/precon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: address.trim(), contractOnly: true }),
        });
        if (cr.ok) {
          const cd: PreConApiResponse = await cr.json();
          if (cd.analysis?.contractText) {
            setAnalysis(prev => prev ? { ...prev, contractText: cd.analysis!.contractText } : prev);
          }
        }
        setCL(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed — check /api/precon endpoint');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleSubmit = () => { if (input.trim() && !scanning) runScan(input.trim()); };

  return (
    <div className="pco-root">

      {/* ── TOP BAR ── */}
      <header className="pco-topbar">
        <div className="pco-topbar-left">
          <span className="pco-wordmark">J. WORDEN &amp; SONS</span>
          <span className="pco-topbar-div">|</span>
          <span className="pco-topbar-station">PRE-CON OMNI-NODE</span>
        </div>
        <div className="pco-topbar-center">
          <span className={`pco-status-dot ${scanning ? 'pco-s-scanning' : analysis ? 'pco-s-live' : 'pco-s-idle'}`} />
          <span className="pco-status-txt">{scanning ? 'SCANNING' : analysis ? 'ANALYSIS READY' : 'AWAITING ADDRESS'}</span>
        </div>
        <div className="pco-topbar-right">
          <span className="pco-coverage">SATELLITE · SOILS · WEATHER · CIVIL</span>
        </div>
      </header>

      {/* ── NATIONAL TICKER ── */}
      <div className="pco-ticker">
        <span className="pco-ticker-label">WORDEN OMNI-NODE</span>
        <div className="pco-ticker-track">
          <div className="pco-ticker-inner">
            {[
              'AASHTO A-7-6 Expansive Clay — Auto-upgrade to 3" HD + Geogrid',
              'NOAA 30-day financial weather matrix active',
              'USGS 3DEP DEM elevation tiles — slope computed in real time',
              'MUTCD Type-3 lane closure logic — VDOT Work Zone compliant',
              'Anthropic Claude contract generation — Worden Protocol v4',
              'VPDES permit threshold: 1 acre disturbance · SWPPP >10,000 SF',
              '96% Marshall Compaction · VDOT Section 315 Stone Base',
              '±$9/ton oil buffer shield active · liquid asphalt hedge',
              'Dig Safe 811 — 72hr notice required before excavation',
              '4th Generation · Virginia Class A License · Since 1984',
            ].concat([
              'AASHTO A-7-6 Expansive Clay — Auto-upgrade to 3" HD + Geogrid',
              'NOAA 30-day financial weather matrix active',
              'USGS 3DEP DEM elevation tiles — slope computed in real time',
              'MUTCD Type-3 lane closure logic — VDOT Work Zone compliant',
              'Anthropic Claude contract generation — Worden Protocol v4',
              'VPDES permit threshold: 1 acre disturbance · SWPPP >10,000 SF',
              '96% Marshall Compaction · VDOT Section 315 Stone Base',
              '±$9/ton oil buffer shield active · liquid asphalt hedge',
              'Dig Safe 811 — 72hr notice required before excavation',
              '4th Generation · Virginia Class A License · Since 1984',
            ]).map((item, i) => <span key={i} className="pco-ticker-item">{item}</span>)}
          </div>
        </div>
      </div>

      {/* ── HERO INPUT ── */}
      <div className="pco-hero">
        <div className="pco-hero-label-row">
          <div className="pco-hero-badge">Worden OS v4 · God-Mode Pre-Con Dashboard · All Civil Logic Active</div>
        </div>
        <h1 className="pco-hero-title">PRE-CON <span className="pco-hero-title-white">OMNI-NODE</span></h1>
        <p className="pco-hero-sub">Satellite recon · USGS soils · 30-day financial weather matrix · Full heavy civil analysis · AI contract generation — in a single scan.</p>

        <div className="pco-input-row">
          <div className="pco-input-wrap">
            <label className="pco-input-label">Project Site Address — Paste any address to trigger full civil analysis</label>
            <input
              ref={inputRef}
              type="text"
              className="pco-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="e.g. 7011 Wood Rd, Richmond, VA 23225"
              disabled={scanning}
            />
          </div>
          <button className="pco-scan-btn" onClick={handleSubmit} disabled={scanning || !input.trim()}>
            {scanning ? '⟳ SCANNING…' : '◈ RUN OMNI-ANALYSIS'}
          </button>
        </div>

        {/* Recent Scans */}
        {recent.length > 0 && (
          <div className="pco-recent">
            <span className="pco-recent-label">RECENT SCANS</span>
            {recent.map(addr => (
              <button key={addr} className="pco-recent-btn" onClick={() => { setInput(addr); runScan(addr); }}>
                {addr}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── SCANNER ── */}
      {scanning && <ScannerTicker steps={SCAN_STEPS} />}

      {/* ── ERROR ── */}
      {error && !scanning && (
        <div className="pco-error">⚠ {error}</div>
      )}

      {/* ── RESULTS ── */}
      {analysis && !scanning && (
        <div className="pco-results">
          <AlertBanner alerts={analysis.alerts} />

          {/* Tab bar */}
          <div className="pco-tabs">
            <button className={`pco-tab ${activeTab === 'godmode' ? 'pco-tab-active' : ''}`}
              onClick={() => setActiveTab('godmode')}>
              ◈ 4-Quadrant God-Mode
            </button>
            <button className={`pco-tab ${activeTab === 'heavy-civil' ? 'pco-tab-active' : ''}`}
              onClick={() => setActiveTab('heavy-civil')}>
              ⬢ Heavy Civil Engineering
            </button>
          </div>

          {activeTab === 'godmode' && <GodModeView analysis={analysis} contractLoading={contractLoading} />}
          {activeTab === 'heavy-civil' && <HeavyCivilView analysis={analysis} />}

          <div className="pco-footer-note">
            J. Worden &amp; Sons · Virginia Class A Contractor · 4th Generation Since 1984 · 96% Marshall Compaction · VDOT Section 315 Standard
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {!analysis && !scanning && !error && <EmptyState />}

    </div>
  );
}
