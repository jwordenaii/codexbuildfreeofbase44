import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BrainCircuit, Loader2 } from 'lucide-react';
import { api } from '@/api/client';

function formatTimestamp(value) {
  if (!value) return 'Waiting for first research cycle';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Research timestamp unavailable';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getPrimaryDomain(signal) {
  const firstDomain = Array.isArray(signal?.top_domains) ? signal.top_domains[0] : null;
  return firstDomain?.domain_label || 'Applied AI research';
}

export default function PublicResearchFeed({ limit = 4 }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadBrief = async () => {
      try {
        const response = await api.getPublicTechIntelligenceBrief({ limit });
        if (!active) return;
        setBrief(response);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Could not load research feed.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBrief();
    const intervalId = window.setInterval(loadBrief, 15 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [limit]);

  const highlights = Array.isArray(brief?.highlights) ? brief.highlights : [];
  const domainSummary = Array.isArray(brief?.domain_summary) ? brief.domain_summary : [];

  return (
    <section className="border-b border-border bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="inline-flex items-center gap-3 border border-primary/35 bg-primary/10 px-4 py-2 text-primary">
              <BrainCircuit className="h-4 w-4" />
              <span className="font-display text-sm uppercase tracking-[0.22em]">Live research engine</span>
            </div>
            <h2 className="mt-5 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">
              The site can ingest new AI research and update itself automatically.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              This panel is fed by the repo&apos;s hourly tech radar. It pulls new signals, ranks what matters for scanning, operations, compliance, and field AI, then refreshes the website without hand-editing this page.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="border border-border bg-background p-5">
                <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Last refresh</p>
                <p className="mt-2 font-display text-2xl uppercase text-foreground">{formatTimestamp(brief?.generated_at)}</p>
              </div>
              <div className="border border-border bg-background p-5">
                <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">Signals analyzed</p>
                <p className="mt-2 font-display text-2xl uppercase text-foreground">{brief?.signals_analyzed || 0}</p>
              </div>
            </div>
            {domainSummary.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-3">
                {domainSummary.map((item) => (
                  <div key={item.domain_id || item.domain_label} className="border border-border bg-white px-4 py-3">
                    <p className="font-display text-sm uppercase text-foreground">{item.domain_label}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Pressure {item.pressure_score ?? 0} · {item.signal_count ?? 0} signals
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-px border border-border bg-border">
            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center bg-card">
                <div className="inline-flex items-center gap-3 font-display text-lg uppercase text-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Loading research feed
                </div>
              </div>
            ) : error ? (
              <div className="bg-card p-8">
                <p className="font-display text-2xl uppercase text-foreground">Research feed unavailable</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{error}</p>
              </div>
            ) : highlights.length === 0 ? (
              <div className="bg-card p-8">
                <p className="font-display text-2xl uppercase text-foreground">No fresh signals yet</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  The ingestion pipeline is live, but this cycle has not published public highlights yet.
                </p>
              </div>
            ) : (
              highlights.map((signal) => (
                <article key={`${signal.url}-${signal.title}`} className="bg-card p-7">
                  <p className="font-display text-xs uppercase tracking-[0.18em] text-primary">
                    {signal.priority} · {getPrimaryDomain(signal)}
                  </p>
                  <h3 className="mt-3 font-display text-3xl uppercase leading-none text-foreground">{signal.title}</h3>
                  <p className="mt-4 text-sm uppercase tracking-[0.16em] text-muted-foreground">
                    {signal.source_name} · {formatTimestamp(signal.published_at)}
                  </p>
                  {Array.isArray(signal.capability_tags) && signal.capability_tags.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {signal.capability_tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="border border-border bg-background px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          {tag.replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  {signal.url && (
                    <a
                      href={signal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 inline-flex items-center gap-2 font-display text-sm uppercase tracking-[0.14em] text-primary"
                    >
                      Read source
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}