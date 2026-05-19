/**
 * WSDesignSystemDemo  ·  Visual smoke-test for the Worden Standard
 * design system. Renders one of every primitive so we can eyeball the
 * brand layer without depending on any feature station.
 *
 * Mount at /design (or anywhere) to verify the system after token edits.
 */
import { useState } from 'react';

export default function WSDesignSystemDemo() {
  const [tab, setTab] = useState<'primitives' | 'tokens'>('primitives');

  return (
    <div className="ws-root">
      {/* ── Topbar ── */}
      <header className="ws-topbar">
        <div className="ws-topbar__left">
          <span className="ws-wordmark">THE WORDEN STANDARD</span>
          <span className="ws-divider">|</span>
          <span className="ws-station-tag">Design System</span>
        </div>
        <div className="ws-topbar__center">
          <span className="ws-dot ws-dot--live" />
          <span className="ws-status-text">System Online</span>
        </div>
        <div className="ws-topbar__right">
          <span className="ws-meta">v1.0.0 · ws-tokens</span>
        </div>
      </header>

      {/* ── Ticker ── */}
      <div className="ws-ticker">
        <span className="ws-ticker__label">LIVE</span>
        <div className="ws-ticker__track">
          <div className="ws-ticker__inner">
            <span className="ws-ticker__item">GOLD #f5a623</span>
            <span className="ws-ticker__item">BG-0 #030810</span>
            <span className="ws-ticker__item">JetBrains Mono</span>
            <span className="ws-ticker__item">Radius 2px</span>
            <span className="ws-ticker__item">14 Primitives</span>
            <span className="ws-ticker__item">5 Animations</span>
            {/* duplicate for seamless loop */}
            <span className="ws-ticker__item">GOLD #f5a623</span>
            <span className="ws-ticker__item">BG-0 #030810</span>
            <span className="ws-ticker__item">JetBrains Mono</span>
            <span className="ws-ticker__item">Radius 2px</span>
            <span className="ws-ticker__item">14 Primitives</span>
            <span className="ws-ticker__item">5 Animations</span>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="ws-hero">
        <span className="ws-hero__badge">Foundation Layer</span>
        <h1 className="ws-hero__title">
          The Worden <span className="ws-hero__title-alt">Standard</span>
        </h1>
        <p className="ws-hero__sub">
          One token file. Fourteen primitives. Five animations. Every station
          on wordenstandard inherits the same brand layer — change a single
          variable and the entire platform updates.
        </p>
      </section>

      {/* ── Tabs ── */}
      <div style={{ padding: '20px 24px' }}>
        <div className="ws-tabs">
          <button
            className={`ws-tab ${tab === 'primitives' ? 'ws-tab--active' : ''}`}
            onClick={() => setTab('primitives')}
          >
            Primitives
          </button>
          <button
            className={`ws-tab ${tab === 'tokens' ? 'ws-tab--active' : ''}`}
            onClick={() => setTab('tokens')}
          >
            Tokens
          </button>
        </div>

        {tab === 'primitives' && (
          <>
            {/* ── Stat tiles ── */}
            <div className="ws-stat-grid" style={{ marginBottom: 16 }}>
              <div className="ws-stat">
                <div className="ws-stat__value">14</div>
                <div className="ws-stat__label">Primitives</div>
                <div className="ws-stat__sub">composable blocks</div>
              </div>
              <div className="ws-stat">
                <div className="ws-stat__value">5</div>
                <div className="ws-stat__label">Animations</div>
                <div className="ws-stat__sub">declared once</div>
              </div>
              <div className="ws-stat">
                <div className="ws-stat__value">38</div>
                <div className="ws-stat__label">Tokens</div>
                <div className="ws-stat__sub">single source</div>
              </div>
              <div className="ws-stat">
                <div className="ws-stat__value">~40%</div>
                <div className="ws-stat__label">CSS Reduction</div>
                <div className="ws-stat__sub">per station</div>
              </div>
            </div>

            {/* ── Status dots ── */}
            <div className="ws-panel" style={{ marginBottom: 16 }}>
              <div className="ws-panel__header">
                <h3 className="ws-panel__title">Status Dots</h3>
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span className="ws-dot ws-dot--live" />
                  <span className="ws-status-text">Live</span>
                </span>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span className="ws-dot ws-dot--scanning" />
                  <span className="ws-status-text">Scanning</span>
                </span>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span className="ws-dot ws-dot--idle" />
                  <span className="ws-status-text">Idle</span>
                </span>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <span className="ws-dot ws-dot--error" />
                  <span className="ws-status-text">Error</span>
                </span>
              </div>
            </div>

            {/* ── Pills ── */}
            <div className="ws-panel" style={{ marginBottom: 16 }}>
              <div className="ws-panel__header">
                <h3 className="ws-panel__title">Pill Tags</h3>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="ws-pill ws-pill--gold">Premium</span>
                <span className="ws-pill ws-pill--live">Active</span>
                <span className="ws-pill ws-pill--warn">Caution</span>
                <span className="ws-pill ws-pill--error">Critical</span>
                <span className="ws-pill ws-pill--muted">Inactive</span>
              </div>
            </div>

            {/* ── Alerts ── */}
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <div className="ws-alert ws-alert--ok">
                <div className="ws-alert__header">All Systems Nominal</div>
                Foundation deployed. Token cascade verified across all 14 primitives.
              </div>
              <div className="ws-alert ws-alert--warn">
                <div className="ws-alert__header">Migration Pending</div>
                IronGrid · PreCon · Investor — all three need refactor PR to consume ws-* primitives.
              </div>
            </div>

            {/* ── KV list ── */}
            <div className="ws-panel" style={{ marginBottom: 16 }}>
              <div className="ws-panel__header">
                <h3 className="ws-panel__title">Brand Manifest</h3>
                <span className="ws-panel__sub">single source of truth</span>
              </div>
              <div className="ws-kv">
                <div className="ws-kv__row">
                  <span className="ws-kv__key">Accent</span>
                  <span className="ws-kv__value">#f5a623</span>
                </div>
                <div className="ws-kv__row">
                  <span className="ws-kv__key">Mono Font</span>
                  <span className="ws-kv__value">JetBrains Mono</span>
                </div>
                <div className="ws-kv__row">
                  <span className="ws-kv__key">Surface Stack</span>
                  <span className="ws-kv__value">4 tiers</span>
                </div>
                <div className="ws-kv__row">
                  <span className="ws-kv__key">Radius</span>
                  <span className="ws-kv__value">2px</span>
                </div>
              </div>
            </div>

            {/* ── Recent chips ── */}
            <div className="ws-panel" style={{ marginBottom: 16 }}>
              <div className="ws-recent">
                <span className="ws-recent__label">Stations</span>
                <button className="ws-recent__chip">IronGrid</button>
                <button className="ws-recent__chip">PreCon</button>
                <button className="ws-recent__chip">Investor</button>
                <button className="ws-recent__chip">Sovereign</button>
                <button className="ws-recent__chip">+ Dispatch</button>
              </div>
            </div>

            {/* ── Buttons ── */}
            <div className="ws-panel">
              <div className="ws-panel__header">
                <h3 className="ws-panel__title">Actions</h3>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="ws-btn ws-btn--primary">Primary CTA</button>
                <button className="ws-btn">Secondary</button>
                <button className="ws-btn" disabled>Disabled</button>
              </div>
            </div>
          </>
        )}

        {tab === 'tokens' && (
          <div className="ws-panel">
            <div className="ws-panel__header">
              <h3 className="ws-panel__title">Edit src/styles/ws-tokens.css to rebrand</h3>
              <span className="ws-panel__sub">every station updates instantly</span>
            </div>
            <pre style={{
              fontSize: 10,
              color: 'var(--ws-text-1)',
              overflowX: 'auto',
              margin: 0,
            }}>
{`--ws-gold:   #f5a623;
--ws-bg-0:   #030810;
--ws-bg-1:   #060e1a;
--ws-bg-2:   #0a1525;
--ws-bg-3:   #0f1e30;
--ws-text-0: #e0f0ff;
--ws-font-mono: 'JetBrains Mono', ...;
--ws-radius: 2px;`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
