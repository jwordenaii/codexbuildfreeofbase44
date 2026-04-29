/**
 * JWORDENAI™ — Public tech-stack and customer tools page.
 *
 * The two public customer tools (Scan + Measure) are featured prominently.
 * Backend platform capabilities (IoT, GenAI, safety, workforce AI) are
 * briefly described here — full access is gated behind the Command Center.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

/* ── SEO ────────────────────────────────────────────────────────────────── */
const PAGE_TITLE = 'JWORDENAI™ | AI-Powered Paving Intelligence'
const PAGE_DESC =
  "JWORDENAI™ is J. Worden & Sons' in-house AI platform. Free public tools: scan your driveway condition with a phone photo and measure your driveway area instantly."

/* ── Public customer tools ──────────────────────────────────────────────── */
const PUBLIC_TOOLS = [
  {
    icon: '📷',
    title: 'Driveway Condition Scanner',
    desc: 'Take a photo of your driveway with your phone and get an instant AI report: what damage is visible, what prep work is needed, and what service we recommend — before you even call us.',
    badge: '100% Free · No Login',
    cta: 'Scan My Driveway',
    ctaHref: '/jwordenai/scan',
    dark: false,
  },
  {
    icon: '📐',
    title: 'Driveway Measure & Estimate',
    desc: 'Sketch your driveway outline with your finger or enter simple dimensions to get an instant square footage calculation and ballpark cost range — so you know what to expect.',
    badge: '100% Free · No Login',
    cta: 'Measure My Driveway',
    ctaHref: '/jwordenai/scan',
    dark: true,
  },
]

/* ── Backend platform capabilities ─────────────────────────────────────── */
const PLATFORM_CAPS = [
  { icon: '🤖', title: 'Generative AI', desc: 'Layout optimization and 4D construction sequencing for every project.' },
  { icon: '🛰️', title: 'IoT Integration', desc: 'Live fleet telemetry from drones, wearables, mixers, and field sensors.' },
  { icon: '🦺', title: 'AI Safety Monitoring', desc: 'Real-time risk signals, sensor triage, and automated incident logging.' },
  { icon: '👷', title: 'Workforce Optimization', desc: 'Predictive staffing, cert tracking, and skills-based crew matching.' },
  { icon: '🧠', title: 'Smart Advisory', desc: 'Regulatory guidance, market intelligence, and data-driven bid analysis.' },
  { icon: '⚙️', title: 'Predictive Maintenance', desc: 'ML models trained on fleet data predict failures before they happen.' },
]

/* ── Success metrics ────────────────────────────────────────────────────── */
const METRICS = [
  { value: '98%', label: 'Takeoff Accuracy', sub: 'vs. industry avg. of 82%' },
  { value: '80%', label: 'Faster Bidding', sub: 'on quantity measurements' },
  { value: '4×', label: 'Maintenance ROI', sub: 'within 12–24 months' },
  { value: '28%', label: 'Fewer Incidents', sub: 'on monitored sites' },
]

/* ── Animation helper ────────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, delay },
})

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function JWordenAI() {
  React.useEffect(() => {
    document.title = PAGE_TITLE
    const m = document.querySelector('meta[name="description"]')
    if (m) m.setAttribute('content', PAGE_DESC)
  }, [])

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative bg-brand-charcoal text-white overflow-hidden pt-24 pb-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 65% 40%, rgba(245,166,35,0.13) 0%, transparent 70%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp(0)} className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 bg-brand-amber/10 border border-brand-amber/30 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse" />
              JWORDENAI™ · Proprietary Technology
            </span>
            <h1 className="font-display font-black text-5xl sm:text-6xl leading-tight mb-5">
              AI That Works
              <br />
              <span className="text-brand-amber">For You — Free</span>
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
              JWORDENAI™ is our in-house artificial intelligence platform. The two tools below are
              free for any homeowner or property manager — no login, no obligation. Snap a photo
              or sketch your driveway and let the AI do the work.
            </p>
            <Link
              to="/jwordenai/scan"
              className="inline-flex items-center gap-2 bg-brand-amber text-brand-navy font-black px-8 py-4 rounded-xl text-base hover:bg-brand-amber/90 transition-colors shadow-lg"
            >
              Try the Free Tools →
            </Link>
          </motion.div>

          {/* Metrics strip */}
          <motion.div {...fadeUp(0.2)} className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4">
            {METRICS.map(({ value, label, sub }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <div className="font-display font-black text-brand-amber text-3xl">{value}</div>
                <div className="text-white font-semibold text-sm mt-1">{label}</div>
                <div className="text-white/40 text-xs mt-0.5">{sub}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Public Customer Tools ─────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className="text-center mb-14">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Free For Every Homeowner
            </span>
            <h2 className="font-display font-black text-brand-navy text-4xl mt-2">
              Know Your Driveway —{' '}
              <span className="text-brand-amber">Before You Call</span>
            </h2>
            <p className="text-brand-navy/60 mt-3 max-w-xl mx-auto">
              Two tools powered by JWORDENAI™ that give you real information about your project
              right from your phone — completely free, no login required.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {PUBLIC_TOOLS.map((tool, i) => (
              <motion.div
                key={tool.title}
                {...fadeUp(i * 0.12)}
                className="rounded-2xl overflow-hidden shadow-lg border border-brand-navy/8"
              >
                <div
                  className={`px-7 pt-8 pb-10 relative overflow-hidden ${
                    tool.dark ? 'bg-brand-charcoal' : 'bg-brand-amber'
                  }`}
                >
                  <div aria-hidden="true" className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
                  <span className="text-5xl">{tool.icon}</span>
                  <h3 className={`font-display font-black text-2xl mt-3 mb-1 ${tool.dark ? 'text-white' : 'text-brand-navy'}`}>
                    {tool.title}
                  </h3>
                  <span className={`inline-block bg-white/20 text-xs font-bold px-3 py-1 rounded-full mt-1 ${tool.dark ? 'text-white' : 'text-brand-navy'}`}>
                    {tool.badge}
                  </span>
                </div>
                <div className="bg-white p-7 flex flex-col gap-4">
                  <p className="text-brand-navy/65 text-sm leading-relaxed">{tool.desc}</p>
                  <Link to={tool.ctaHref} className="btn-primary text-sm text-center py-3 px-6 mt-auto">
                    {tool.cta} →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* How it works */}
          <motion.div {...fadeUp(0.1)} className="mt-14 bg-brand-navy/4 border border-brand-navy/10 rounded-2xl p-8">
            <h3 className="font-display font-bold text-brand-navy text-xl text-center mb-6">
              How the Condition Scanner Works
            </h3>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { step: '1', icon: '📸', title: 'Take a Photo', desc: 'Snap a clear photo of your driveway from ground level or looking down. Your phone camera is perfect.' },
                { step: '2', icon: '🤖', title: 'AI Analyzes It', desc: 'JWORDENAI™ reads the image — identifying crack types, surface wear, drainage issues, and more in seconds.' },
                { step: '3', icon: '📋', title: 'Get Your Report', desc: 'You receive a plain-English report: condition score, issues found, prep work needed, and recommended service.' },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="w-10 h-10 rounded-full bg-brand-amber text-brand-navy font-black text-lg flex items-center justify-center mx-auto mb-3">{s.step}</div>
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <h4 className="font-display font-bold text-brand-navy text-base mb-1">{s.title}</h4>
                  <p className="text-brand-navy/55 text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Backend Platform (brief) ───────────────────────────────────── */}
      <section className="py-20 bg-brand-charcoal text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className="text-center mb-12">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">Under the Hood</span>
            <h2 className="font-display font-black text-4xl mt-2">
              The Full{' '}
              <span className="text-brand-amber">JWORDENAI™</span> Platform
            </h2>
            <p className="text-white/60 mt-3 max-w-xl mx-auto">
              Beyond the public tools, JWORDENAI™ powers our entire operation. These capabilities
              are available to our team through the staff Command Center.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PLATFORM_CAPS.map((cap, i) => (
              <motion.div
                key={cap.title}
                {...fadeUp(i * 0.07)}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 transition-colors"
              >
                <span className="text-3xl">{cap.icon}</span>
                <h3 className="font-display font-bold text-white text-base mt-3 mb-1">{cap.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp(0.1)} className="mt-10 text-center">
            <Link
              to="/command-center"
              className="inline-flex items-center gap-2 border border-brand-amber/50 text-brand-amber font-bold px-7 py-3 rounded-xl hover:bg-brand-amber/10 transition-colors"
            >
              Staff Command Center →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section className="py-16 bg-brand-amber text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-display font-black text-brand-navy text-3xl mb-3">
            See what your driveway really needs.
          </h2>
          <p className="text-brand-navy/70 mb-6 text-base">
            The condition scanner is free, instant, and requires no account — just a photo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/jwordenai/scan" className="bg-brand-navy text-white font-black px-8 py-4 rounded-xl hover:bg-brand-navy/90 transition-colors inline-block">
              Scan My Driveway Free
            </Link>
            <Link to="/quote" className="border-2 border-brand-navy text-brand-navy font-bold px-8 py-4 rounded-xl hover:bg-brand-navy/10 transition-colors inline-block">
              Request a Free Quote
            </Link>
          </div>
          <p className="mt-6 text-brand-navy/40 text-xs">
            JWORDENAI™ is a trademarked technology platform of J. Worden &amp; Sons Asphalt Paving.
          </p>
        </div>
      </section>
    </>
  )
}
