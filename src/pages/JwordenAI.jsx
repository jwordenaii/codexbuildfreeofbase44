import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const FEATURES = [
  {
    icon: '🧠',
    title: 'Advisory AI',
    tagline: 'Intelligent insights & recommendations',
    description:
      'JWORDENAI™ analyzes project conditions, site data, and industry patterns to surface intelligent recommendations — helping owners and operators make faster, more confident decisions at every stage of a paving or construction project.',
    capabilities: [
      'Site condition analysis & risk flagging',
      'Scope recommendation engine',
      'Regulatory & compliance guidance',
      'Cost-benefit scenario modeling',
      'Vendor & material intelligence',
    ],
  },
  {
    icon: '⚙️',
    title: 'Automation Tools',
    tagline: 'Project planning & management',
    description:
      'Purpose-built automation tools that eliminate manual bottlenecks across the project lifecycle — from initial takeoff and scheduling through documentation, change orders, and closeout. Built for the pace of real field operations.',
    capabilities: [
      'Automated project scheduling & sequencing',
      'Takeoff & quantity estimation',
      'Document generation & management',
      'Change order tracking & approval workflows',
      'Crew coordination & dispatch logic',
    ],
  },
  {
    icon: '📡',
    title: 'Predictive Technologies',
    tagline: 'Maintenance forecasting',
    description:
      'Proprietary predictive models trained on pavement lifecycle data to forecast maintenance windows, surface degradation timelines, and capital expenditure needs — before failure becomes the only option.',
    capabilities: [
      'Pavement condition decay modeling',
      'Maintenance window forecasting',
      'Capital expenditure planning',
      'Lifecycle cost optimization',
      'Proactive intervention triggers',
    ],
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.12, ease: 'easeOut' },
  }),
}

export default function JwordenAI() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-brand-navy pt-32 pb-24 text-white relative overflow-hidden">
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 bg-brand-amber/15 border border-brand-amber/30 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse" />
            Proprietary AI Technology
          </motion.div>

          {/* Wordmark */}
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="font-display font-black text-5xl md:text-7xl mb-6 leading-none tracking-tight"
          >
            JWORDENAI
            <span className="text-brand-amber align-super text-2xl md:text-3xl">™</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="text-white/70 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed mb-4"
          >
            J's proprietary AI platform for the paving industry — built from decades of field
            experience and engineered to give operators an unfair advantage.
          </motion.p>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
            className="text-white/40 text-sm max-w-xl mx-auto mb-12"
          >
            Advisory intelligence. Operational automation. Predictive maintenance forecasting.
            Purpose-built for asphalt and construction professionals.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/contact"
              className="btn-primary text-base !px-8 !py-3"
              onClick={() => {
                if (typeof window.gtag === 'function')
                  window.gtag('event', 'cta_click', { location: 'jwordenai_hero_primary' })
              }}
            >
              Contact for Premium Access
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors text-base font-medium"
            >
              Explore Services
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Divider stat bar ─────────────────────────────────────────────── */}
      <section className="bg-brand-amber">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-brand-navy text-center">
            {[
              { value: '40+', label: 'Years of field data' },
              { value: '3', label: 'Core AI capability pillars' },
              { value: '100%', label: 'Paving-industry focused' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="font-display font-black text-2xl">{value}</p>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature cards ────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Platform capabilities
            </span>
            <h2 className="font-display font-black text-4xl md:text-5xl text-brand-navy mt-3 mb-4">
              Three Pillars of JWORDENAI™
            </h2>
            <p className="text-brand-navy/60 max-w-2xl mx-auto text-lg">
              Each capability is purpose-built for the realities of paving and construction
              operations — not adapted from generic enterprise software.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="group rounded-2xl border border-brand-navy/10 bg-white p-8 hover:border-brand-amber/40 hover:shadow-xl transition-all duration-300"
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-brand-navy/5 flex items-center justify-center text-3xl mb-6 group-hover:bg-brand-amber/10 transition-colors">
                  {feature.icon}
                </div>

                {/* Tagline */}
                <span className="text-xs font-bold uppercase tracking-widest text-brand-amber">
                  {feature.tagline}
                </span>

                {/* Title */}
                <h3 className="font-display font-black text-2xl text-brand-navy mt-2 mb-4">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-brand-navy/65 text-sm leading-relaxed mb-6">
                  {feature.description}
                </p>

                {/* Capabilities list */}
                <ul className="space-y-2">
                  {feature.capabilities.map((cap) => (
                    <li key={cap} className="flex items-start gap-2 text-sm text-brand-navy/70">
                      <span className="text-brand-amber mt-0.5 shrink-0">✓</span>
                      {cap}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proprietary notice ───────────────────────────────────────────── */}
      <section className="py-20 bg-brand-navy/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 bg-brand-navy text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
              <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              Proprietary Platform
            </div>

            <h2 className="font-display font-black text-4xl md:text-5xl text-brand-navy mb-6">
              Built in the Field.{' '}
              <span className="text-brand-amber">Not in a Boardroom.</span>
            </h2>

            <p className="text-brand-navy/65 text-lg leading-relaxed max-w-3xl mx-auto mb-4">
              JWORDENAI™ is the result of four decades of paving knowledge encoded into intelligent
              systems. The underlying models, methodologies, and data structures are proprietary to
              J. Worden &amp; Sons and are not publicly disclosed.
            </p>

            <p className="text-brand-navy/45 text-sm max-w-2xl mx-auto mb-12">
              Premium access is available to qualified operators and partners. Contact us to discuss
              how JWORDENAI™ can be applied to your operation.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact"
                className="btn-primary text-base !px-8 !py-3"
                onClick={() => {
                  if (typeof window.gtag === 'function')
                    window.gtag('event', 'cta_click', { location: 'jwordenai_bottom_primary' })
                }}
              >
                Contact for Premium Access
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg border border-brand-navy/20 text-brand-navy hover:border-brand-navy/40 hover:bg-brand-navy/5 transition-colors text-base font-medium"
              >
                Explore Services
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
