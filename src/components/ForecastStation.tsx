// =====================================================================
// ForecastStation — premium two-pane forecast surface
//
// Left:  county heatmap (click to drill down)
// Right: gauge + horizon tabs + per-signal contributions + narrative + badges
//
// Consumes:
//   GET  /.netlify/functions/forecast?model=&geo=&horizon=
//   POST /.netlify/functions/narrate
//
// Self-contained — no design-system dependency. Bone-only: not yet wired
// into App.jsx so it ships as a tree-shaken module until a route consumes it.
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ForecastStation.css';
import type { Horizon, EvaluatedSignal } from '../types/fusion.types';
import type {
  ForecastApiResponse,
  ForecastGeoCell,
  ForecastStationProps,
  NarrativeApiResponse,
} from '../types/forecast-station.types';

// ---------------------------------------------------------------------
// Defaults — primary VA footprint for jworden asphalt operating territory
// ---------------------------------------------------------------------
const DEFAULT_GEOS: ForecastGeoCell[] = [
  { fips: '51041', label: 'Chesterfield, VA', region: 'VA' },
  { fips: '51087', label: 'Henrico, VA',      region: 'VA' },
  { fips: '51760', label: 'Richmond City, VA', region: 'VA' },
  { fips: '51149', label: 'Prince George, VA', region: 'VA' },
  { fips: '51053', label: 'Dinwiddie, VA',     region: 'VA' },
  { fips: '51730', label: 'Petersburg, VA',    region: 'VA' },
  { fips: '51570', label: 'Colonial Heights, VA', region: 'VA' },
  { fips: '51075', label: 'Goochland, VA',     region: 'VA' },
];

const HORIZONS: Horizon[] = [30, 90, 180, 365];

const SIGNAL_LABELS: Record<string, string> = {
  permits:           'Building permits',
  sam_spending:      'Federal contract spend',
  yield_curve:       '10y-2y yield curve',
  jolts_openings:    'Construction job openings',
  aia_abi:           'Architecture Billings Index',
  material_cost:     'Material cost index',
  pavement_cond:     'Pavement condition',
  demographics:      'Population growth',
  jolts_hires:       'Construction hires',
  diesel:            'Diesel price',
  asphalt_ppi:       'Asphalt PPI',
  wages_eci:         'Construction wages',
  crude_wti:         'WTI crude',
  lumber_ppi:        'Lumber PPI',
  private_nonres:    'Private non-residential',
  total_construction:'Total construction spend',
};

function signalLabel(id: string): string {
  return SIGNAL_LABELS[id] ?? id.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------
// Score band helpers (mirror of reasoner.scoreBand for UI styling)
// ---------------------------------------------------------------------
type ScoreBand = 'boom' | 'steady' | 'soft' | 'bad';

function bandFor(score: number): ScoreBand {
  if (score >= 65) return 'boom';
  if (score >= 50) return 'steady';
  if (score >= 35) return 'soft';
  return 'bad';
}

function bandLabel(band: ScoreBand): string {
  switch (band) {
    case 'boom':   return 'expansion';
    case 'steady': return 'steady';
    case 'soft':   return 'softening';
    case 'bad':    return 'contraction';
  }
}

function bandColor(band: ScoreBand): string {
  switch (band) {
    case 'boom':   return 'var(--fs-good)';
    case 'steady': return 'var(--fs-neutral)';
    case 'soft':   return 'var(--fs-warn)';
    case 'bad':    return 'var(--fs-bad)';
  }
}

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------
export function ForecastStation({
  defaultGeo = '51041',
  defaultHorizon = 90,
  defaultModel = 'boom_probability_v1',
  geos = DEFAULT_GEOS,
  apiBase = '/.netlify/functions',
}: ForecastStationProps = {}): JSX.Element {
  const [horizon, setHorizon] = useState<Horizon>(defaultHorizon);
  const [activeGeo, setActiveGeo] = useState<string>(defaultGeo);
  const [forecast, setForecast] = useState<ForecastApiResponse | null>(null);
  const [narrative, setNarrative] = useState<NarrativeApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Heatmap snapshots — { fips -> score } for the current horizon
  const [heat, setHeat] = useState<Record<string, number | null>>({});

  const inflight = useRef<AbortController | null>(null);

  // ---------- forecast loader ----------
  const loadForecast = useCallback(
    async (geo: string, h: Horizon): Promise<ForecastApiResponse | null> => {
      const url = `${apiBase}/forecast?model=${encodeURIComponent(defaultModel)}&geo=${encodeURIComponent(geo)}&horizon=${h}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`forecast ${res.status}`);
      return (await res.json()) as ForecastApiResponse;
    },
    [apiBase, defaultModel],
  );

  // ---------- narrative loader ----------
  const loadNarrative = useCallback(
    async (f: ForecastApiResponse, label: string): Promise<NarrativeApiResponse | null> => {
      const res = await fetch(`${apiBase}/narrate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: f.model,
          geo: f.geo,
          horizon: f.horizon,
          score: f.score,
          components: f.components,
          geoLabel: label,
          style: 'executive',
        }),
      });
      if (!res.ok) return null;
      return (await res.json()) as NarrativeApiResponse;
    },
    [apiBase],
  );

  // ---------- drill-down on geo+horizon change ----------
  useEffect(() => {
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;

    setLoading(true);
    setError(null);
    setNarrative(null);

    const label = geos.find(g => g.fips === activeGeo)?.label ?? activeGeo;

    loadForecast(activeGeo, horizon)
      .then(async f => {
        if (ctl.signal.aborted) return;
        setForecast(f);
        if (f) {
          const n = await loadNarrative(f, label);
          if (!ctl.signal.aborted) setNarrative(n);
        }
      })
      .catch(e => {
        if (!ctl.signal.aborted) setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false);
      });

    return () => ctl.abort();
  }, [activeGeo, horizon, geos, loadForecast, loadNarrative]);

  // ---------- heatmap batch load on horizon change ----------
  useEffect(() => {
    let cancelled = false;
    setHeat({});
    Promise.all(
      geos.map(g =>
        loadForecast(g.fips, horizon)
          .then(f => [g.fips, f?.score ?? null] as const)
          .catch(() => [g.fips, null] as const),
      ),
    ).then(pairs => {
      if (cancelled) return;
      const next: Record<string, number | null> = {};
      for (const [fips, score] of pairs) next[fips] = score;
      setHeat(next);
    });
    return () => {
      cancelled = true;
    };
  }, [horizon, geos, loadForecast]);

  // ---------- derived ----------
  const activeLabel = useMemo(
    () => geos.find(g => g.fips === activeGeo)?.label ?? activeGeo,
    [geos, activeGeo],
  );
  const score = forecast?.score ?? 0;
  const band = bandFor(score);
  const sortedComponents = useMemo<EvaluatedSignal[]>(() => {
    const list = forecast?.components ?? [];
    return [...list].sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
  }, [forecast]);

  // ---------- render ----------
  return (
    <section className="fs-station" data-testid="forecast-station">
      {/* ------------- LEFT: heatmap ------------- */}
      <aside className="fs-panel">
        <h3>Geography · {horizon}d</h3>
        <div className="fs-heatmap-grid">
          {geos.map(g => {
            const s = heat[g.fips];
            const b: ScoreBand | 'cold' = s == null ? 'cold' : bandFor(s);
            const widthPct = s == null ? 8 : Math.max(4, Math.min(100, s));
            return (
              <button
                key={g.fips}
                type="button"
                className={`fs-cell${g.fips === activeGeo ? ' fs-cell--active' : ''}`}
                onClick={() => setActiveGeo(g.fips)}
                aria-pressed={g.fips === activeGeo}
              >
                <span className="fs-cell-label">{g.label}</span>
                <span className="fs-cell-fips">FIPS {g.fips}</span>
                <span className="fs-cell-score">
                  <span className="fs-cell-bar">
                    <span
                      className={`fs-cell-bar-fill fs-cell-bar-fill--${b}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </span>
                  <span className="fs-cell-num">{s == null ? '—' : Math.round(s)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ------------- RIGHT: drill-down ------------- */}
      <div className="fs-right">
        {/* Header */}
        <header className="fs-panel fs-head">
          <div className="fs-head-title">
            <small>Forecast Station</small>
            <strong>{activeLabel}</strong>
          </div>
          <div className="fs-horizon-tabs" role="tablist" aria-label="Horizon">
            {HORIZONS.map(h => (
              <button
                key={h}
                type="button"
                role="tab"
                aria-selected={h === horizon}
                className={`fs-horizon-tab${h === horizon ? ' fs-horizon-tab--active' : ''}`}
                onClick={() => setHorizon(h)}
              >
                {h}d
              </button>
            ))}
          </div>
        </header>

        {/* Error */}
        {error && <div className="fs-error">Forecast unavailable — {error}</div>}

        {/* Gauge */}
        <div className="fs-panel">
          <h3>Boom probability · {horizon}-day window</h3>
          {loading && !forecast ? (
            <div className="fs-loading">Loading forecast…</div>
          ) : (
            <div className="fs-gauge">
              <div className="fs-gauge-num">
                {Math.round(score)}
                <small>/100</small>
              </div>
              <div>
                <div className={`fs-gauge-band fs-gauge-band--${band}`}>{bandLabel(band)}</div>
                <div className="fs-gauge-bar">
                  <div
                    className="fs-gauge-bar-fill"
                    style={{ width: `${Math.max(2, score)}%`, background: bandColor(band) }}
                  />
                </div>
                <div className="fs-gauge-meta">
                  Model: <code>{forecast?.model ?? defaultModel}</code> · Generated:{' '}
                  {forecast ? new Date(forecast.generatedAt).toLocaleString() : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Source badges */}
          {forecast && (
            <div className="fs-badges" style={{ marginTop: '0.75rem' }}>
              {forecast.coldStart && <span className="fs-badge fs-badge--cold">cold-start</span>}
              {!forecast.coldStart && <span className="fs-badge fs-badge--ok">live signals</span>}
              {forecast.persisted && <span className="fs-badge fs-badge--info">persisted</span>}
              {!forecast.persisted && (
                <span className="fs-badge fs-badge--warn">ephemeral</span>
              )}
            </div>
          )}
        </div>

        {/* Narrative */}
        <div className="fs-panel">
          <h3>Narrative</h3>
          {!narrative ? (
            <div className="fs-loading">{loading ? 'Generating…' : 'No narrative yet.'}</div>
          ) : (
            <>
              <div className="fs-narr">{narrative.narrative}</div>
              <div className="fs-narr-meta">
                Source: {narrative.source}
                {narrative.tokensIn != null && ` · in ${narrative.tokensIn}`}
                {narrative.tokensOut != null && ` · out ${narrative.tokensOut}`}
              </div>
            </>
          )}
        </div>

        {/* Contributions */}
        <div className="fs-panel">
          <h3>Signal contributions</h3>
          {sortedComponents.length === 0 ? (
            <div className="fs-loading">No signals.</div>
          ) : (
            <div className="fs-contrib">
              {sortedComponents.map(c => {
                const cold = c.isSynthetic;
                const pct = Math.min(50, Math.abs(c.contrib) * 50);
                const positive = c.contrib >= 0;
                return (
                  <div key={c.signal}>
                    <div className="fs-contrib-row">
                      <div className="fs-contrib-name">
                        {signalLabel(c.signal)}
                        {cold && <small className="fs-contrib-cold"> cold-start</small>}
                      </div>
                      <div className="fs-contrib-z">
                        z={c.z.toFixed(2)} · w={c.weightAdj.toFixed(2)}
                      </div>
                    </div>
                    <div className="fs-contrib-bar">
                      <div className="fs-contrib-mid" />
                      <div
                        className={`fs-contrib-fill fs-contrib-fill--${positive ? 'pos' : 'neg'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ForecastStation;
