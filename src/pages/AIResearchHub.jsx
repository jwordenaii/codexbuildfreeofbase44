import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Cpu, Globe, Radar, ScanSearch } from 'lucide-react';
import SEO from '@/components/SEO';
import SchemaMarkup from '@/components/SchemaMarkup';
import PublicResearchFeed from '@/components/PublicResearchFeed';

const pillars = [
  {
    title: 'Automated ingest',
    body: 'The repo continuously watches AI platform releases, preprint signals, and infrastructure changes, then imports the results into a stable intelligence payload.',
    icon: Radar,
  },
  {
    title: 'Construction scoring',
    body: 'Signals are ranked for scanning, field vision, operations, compliance, and contractor workflows so research does not stay generic.',
    icon: ScanSearch,
  },
  {
    title: 'Website-ready output',
    body: 'The public site can read the sanitized digest directly, which means research visibility can update automatically without rewriting templates by hand.',
    icon: Globe,
  },
  {
    title: 'AI operating loop',
    body: 'This is designed to feed the broader Jarvis system, command surfaces, and future market-site factory outputs with the same core intelligence stream.',
    icon: Cpu,
  },
];

const guardrails = [
  'Research can publish safe summaries automatically, but money-page claims should still respect approval rules.',
  'The engine should surface original sources and timestamps so trust stays visible.',
  'High-volume automation must avoid thin, repetitive, search-first page generation.',
  'Public research output should stay distinct from private operating intelligence, pricing logic, and internal strategy.',
];

export default function AIResearchHub() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'AI Research Hub',
    description: 'Live AI research engine for J. Worden systems, showing automatically ingested technology updates and innovation signals.',
    url: 'https://www.jwordenasphaltpaving.com/ai-research',
  };

  return (
    <>
      <SEO
        title="AI Research Hub | Live Technology Intelligence"
        description="Live AI research engine powered by the repo tech radar, with automatically ingested innovation updates relevant to scanning, field AI, and construction operations."
        canonicalPath="/ai-research"
        jsonLd={schema}
      />
      <SchemaMarkup
        title="AI Research Hub | Live Technology Intelligence"
        description="Public technology research hub for the J. Worden operating system."
        canonical="/ai-research"
        breadcrumb={[{ name: 'Home', path: '/' }, { name: 'AI Research Hub', path: '/ai-research' }]}
      />

      <section className="border-b border-border bg-[#0b0b0b] pt-36 text-white">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-12 lg:px-8">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-3 border border-primary/45 bg-primary/10 px-4 py-2 text-primary">
              <BrainCircuit className="h-4 w-4" />
              <span className="font-display text-sm uppercase tracking-[0.22em]">Repo-wide research engine</span>
            </div>
            <h1 className="mt-6 font-display text-6xl font-black uppercase leading-[0.86] tracking-normal md:text-8xl lg:text-9xl">
              A live AI radar for the whole repo.
            </h1>
            <p className="mt-8 max-w-3xl text-xl leading-relaxed text-zinc-300 md:text-2xl">
              This hub turns new AI launches, preprint signals, infrastructure updates, and innovation changes into a website-facing intelligence stream. The ingest runs automatically, the site can refresh automatically, and the output is shaped for real contractor operations rather than generic tech news.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/jwordenai" className="inline-flex min-h-[52px] items-center gap-3 bg-primary px-7 py-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                Open JWordenAI
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="#research-feed" className="inline-flex min-h-[52px] items-center gap-3 border border-white/20 px-7 py-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-white transition-colors hover:border-primary hover:text-primary">
                View live feed
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-10 max-w-4xl">
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">What this engine does</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">
              Ingest, rank, publish, and keep learning.
            </h2>
          </div>
          <div className="grid gap-px border border-border bg-border md:grid-cols-2">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article key={pillar.title} className="bg-card p-8">
                  <Icon className="mb-8 h-7 w-7 text-primary" />
                  <h3 className="font-display text-3xl uppercase leading-none text-foreground">{pillar.title}</h3>
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <div id="research-feed">
        <PublicResearchFeed limit={8} />
      </div>

      <section className="border-b border-border bg-background py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Publishing guardrails</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">
              Automatic updates need boundaries.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              The right model is not blind self-editing. The right model is a trusted research engine that continuously ingests new information, publishes safe summaries automatically, and hands higher-risk website changes into controlled approval paths.
            </p>
          </div>
          <div className="space-y-3">
            {guardrails.map((item) => (
              <div key={item} className="border-l-4 border-primary bg-white p-5 font-body text-lg leading-relaxed text-foreground shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}