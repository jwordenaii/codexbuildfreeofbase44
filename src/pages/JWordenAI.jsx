/**
 * JWORDENAI Tech Stack — public-facing showcase page.
 *
 * Highlights the JWORDENAI brand's AI capabilities without disclosing
 * proprietary implementation details. Premium / detailed access is
 * gated behind the staff Command Center (login required).
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

/* ── SEO / Schema ───────────────────────────────────────────────────────── */
const PAGE_TITLE = 'JWORDENAI Tech Stack | AI-Powered Construction Intelligence'
const PAGE_DESC =
  'Discover JWORDENAI — our proprietary AI platform powering smarter decisions, predictive maintenance, automated takeoffs, and real-time risk analysis across every project we touch.'

/* ── Feature Highlights ─────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: '🧠',
    title: 'Smart Advisory Systems',
    desc: 'Intelligent recommendation engines that synthesize regulatory data, project history, and market intelligence to guide every decision — from bidding to closeout.',
    stat: '98%',
    statLabel: 'advisory accuracy',
  },
  {
    icon: '⚙️',
    title: 'Predictive Maintenance AI',
    desc: 'Machine-learning models trained on fleet telemetry and pavement distress data predict failures before they happen, converting costly breakdowns into planned repairs.',
    stat: '4×',
    statLabel: 'ROI within 24 months',
  },
  {
    icon: '📐',
    title: 'Automated Takeoff Tools',
    desc: 'Spatial-intelligence algorithms process site imagery and plan sets to produce high-precision quantity takeoffs — dramatically reducing manual measurement time.',
    stat: '80%',
    statLabel: 'reduction in takeoff time',
  },
  {
    icon: '🛰️',
    title: 'Real-Time Monitoring & Risk Analysis',
    desc: 'Live field data pipelines fuse drone, sensor, and camera inputs to surface schedule risks, safety flags, and quality deviations as they emerge — not after the fact.',
    stat: '28%',
    statLabel: 'fewer on-site incidents',
  },
]

/* ── Success Metrics ────────────────────────────────────────────────────── */
const METRICS = [
  { value: '98%', label: 'Takeoff Accuracy', sub: 'vs. industry avg. of 82%' },
  { value: '80%', label: 'Time Saved', sub: 'on quantity measurements' },
  { value: '4×', label: 'Maintenance ROI', sub: 'within 12–24 months' },
  { value: '$47K', label: 'Avg. Failure Cost Avoided', sub: 'per prevented engine failure' },
]

/* ── Case Studies ───────────────────────────────────────────────────────── */
const CASE_STUDIES = [
  {
    icon: '🏗️',
    category: 'Preconstruction',
    headline: 'Automated Takeoffs Cut Pre-Bid Time by 80%',
    body: "By deploying JWORDENAI's spatial measurement engine across multi-site QSR remodel programs, our estimating team eliminated manual re-measurement. Bid cycles that took three days now close in under twelve hours — with documented accuracy improvements that reduced change orders on post-award scopes.",
  },
  {
    icon: '🔧',
    category: 'Fleet Operations',
    headline: 'Predictive Maintenance Turns a $50K Replacement Into a $3K Repair',
    body: "JWORDENAI's predictive maintenance module flagged early bearing-wear signatures in a paver before catastrophic failure. The planned repair cost $3,000. The avoided replacement would have cost over $50,000 and idled the crew for two weeks during peak season.",
  },
  {
    icon: '🛣️',
    category: 'Civil Infrastructure',
    headline: 'Pavement Health Scoring Guides Multi-Year Maintenance Programs',
    body: "Integrating distress imagery with JWORDENAI's deep-learning defect classifier, our team now delivers data-backed Pavement Management Plans with treatment prioritization that extends asset life and maximizes every maintenance dollar for commercial property owners.",
  },
]

/* ── Animation helpers ──────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, delay },
})

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function JWordenAI() {
  // Update document metadata for SEO
  React.useEffect(() => {
    document.title = PAGE_TITLE
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', PAGE_DESC)
  }, [])

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative bg-brand-navy text-white overflow-hidden pt-24 pb-20">
        {/* Decorative glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 60% 40%, rgba(245,166,35,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp(0)} className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <span className="inline-flex items-center gap-2 bg-brand-amber/10 border border-brand-amber/30 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse" />
              Proprietary Technology · Trademarked
            </span>

            <h1 className="font-display font-black text-5xl sm:text-6xl leading-tight mb-6">
              JWORDENAI
              <br />
              <span className="text-brand-amber">Tech Stack</span>
            </h1>

            <p className="text-white/70 text-lg leading-relaxed mb-10">
              JWORDENAI is our in-house artificial intelligence platform — a separate, trademarked
              technology initiative that powers every data-driven capability at J.&nbsp;Worden &amp;
              Sons. From automated preconstruction to real-time field intelligence, JWORDENAI is the
              digital co-pilot behind our results.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact" className="btn-primary text-base px-8 py-3">
                Request a Capabilities Brief
              </Link>
              <Link
                to="/command-center"
                className="border border-brand-amber text-brand-amber font-bold px-8 py-3 rounded-lg hover:bg-brand-amber/10 transition-colors text-base"
              >
                Staff Command Center →
              </Link>
            </div>
          </motion.div>

          {/* Stat strip */}
          <motion.div
            {...fadeUp(0.2)}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {METRICS.map(({ value, label, sub }) => (
              <div
                key={label}
                className="bg-white/5 border border-white/10 rounded-xl p-5 text-center"
              >
                <div className="font-display font-black text-brand-amber text-3xl">{value}</div>
                <div className="text-white font-semibold text-sm mt-1">{label}</div>
                <div className="text-white/40 text-xs mt-0.5">{sub}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Feature Highlights ────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Core Capabilities
            </span>
            <h2 className="font-display font-black text-brand-navy text-4xl mt-2">
              What JWORDENAI Powers
            </h2>
            <p className="text-brand-navy/60 mt-3 max-w-xl mx-auto">
              Four interconnected AI systems — each purpose-built for the construction, paving, and
              civil infrastructure industries.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp(i * 0.1)}
                className="bg-brand-navy/4 border border-brand-navy/10 rounded-2xl p-8 flex flex-col gap-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{f.icon}</span>
                  <div>
                    <h3 className="font-display font-bold text-brand-navy text-xl">{f.title}</h3>
                    <span className="text-brand-amber font-black text-lg">
                      {f.stat}{' '}
                      <span className="text-brand-navy/50 font-normal text-sm">{f.statLabel}</span>
                    </span>
                  </div>
                </div>
                <p className="text-brand-navy/65 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Case Studies ──────────────────────────────────────────────── */}
      <section className="py-20 bg-brand-charcoal text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Real-World Results
            </span>
            <h2 className="font-display font-black text-4xl mt-2">
              JWORDENAI in the <span className="text-brand-amber">Field</span>
            </h2>
            <p className="text-white/60 mt-3 max-w-xl mx-auto">
              A selection of outcomes from live deployments. Specific client and project details
              remain confidential — results are documented and available to qualified partners.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {CASE_STUDIES.map((cs, i) => (
              <motion.div
                key={cs.headline}
                {...fadeUp(i * 0.1)}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{cs.icon}</span>
                  <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
                    {cs.category}
                  </span>
                </div>
                <h3 className="font-display font-bold text-white text-lg leading-snug">
                  {cs.headline}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed flex-1">{cs.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture Note ─────────────────────────────────────────── */}
      <section className="py-16 bg-brand-navy/5 border-y border-brand-navy/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className="text-center">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              How It's Built
            </span>
            <h2 className="font-display font-black text-brand-navy text-3xl mt-2 mb-6">
              Purpose-Built for Construction
            </h2>
            <div className="grid sm:grid-cols-3 gap-6 text-left">
              {[
                {
                  icon: '🔒',
                  title: 'Hybrid Architecture',
                  desc: 'Sensitive project data stays on-premises. Large-scale training and inference workloads run in secure cloud compute — balancing compliance with performance.',
                },
                {
                  icon: '🎯',
                  title: 'Precision-First Models',
                  desc: 'We use domain-specific architectures — ensemble models for strength prediction, deep residual networks for defect detection — not generic chat AI.',
                },
                {
                  icon: '📋',
                  title: 'Standards-Aligned',
                  desc: 'Model validation follows emerging ASTM AI committee guidelines and ACI conventions for construction-sector AI, ensuring defensible outputs.',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  {...fadeUp(i * 0.1)}
                  className="bg-white rounded-xl border border-brand-navy/10 p-5 shadow-sm"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <h3 className="font-display font-bold text-brand-navy text-base mt-3 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-brand-navy/60 text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Premium / Gated CTA ───────────────────────────────────────── */}
      <section className="py-20 bg-brand-navy text-white relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 30% 60%, rgba(245,166,35,0.10) 0%, transparent 70%)',
          }}
        />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <motion.div {...fadeUp()}>
            <span className="inline-flex items-center gap-2 bg-brand-amber/10 border border-brand-amber/30 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
              🔐 Premium Access
            </span>
            <h2 className="font-display font-black text-4xl mb-4">
              Unlock the Full{' '}
              <span className="text-brand-amber">JWORDENAI</span> Platform
            </h2>
            <p className="text-white/65 text-lg leading-relaxed mb-8">
              Live demonstrations, detailed capability reports, API integration specs, and
              case-study deep-dives are available exclusively through our staff Command Center and
              to qualified enterprise partners. Contact us to begin the access request process.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/command-center"
                className="bg-brand-amber text-brand-navy font-black px-8 py-4 rounded-lg hover:bg-brand-amber/90 transition-colors text-base"
              >
                Staff Login → Command Center
              </Link>
              <Link
                to="/contact"
                className="border border-white/30 text-white font-bold px-8 py-4 rounded-lg hover:bg-white/10 transition-colors text-base"
              >
                Partner Inquiry
              </Link>
            </div>

            <p className="mt-6 text-white/30 text-xs">
              JWORDENAI™ is a trademarked technology platform. Proprietary algorithms, training
              datasets, and implementation details are confidential.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section className="py-14 bg-brand-amber text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-display font-black text-brand-navy text-3xl mb-3">
            Ready to see what AI-powered paving looks like?
          </h2>
          <p className="text-brand-navy/70 mb-6">
            Every project we deliver today is backed by JWORDENAI technology.
          </p>
          <Link
            to="/quote"
            className="bg-brand-navy text-white font-bold px-8 py-4 rounded-lg hover:bg-brand-navy/90 transition-colors inline-block"
          >
            Request a Free Quote
          </Link>
        </div>
      </section>
    </>
  )
}
