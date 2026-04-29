import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: '🤖',
    title: 'Advisory AI',
    description:
      'Intelligent advisory systems that surface critical insights, regulatory guidance, and strategic recommendations — putting expert-level analysis at your fingertips.',
  },
  {
    icon: '⚙️',
    title: 'Automation Tools',
    description:
      'End-to-end automation for project planning, scheduling, and management. Eliminate manual bottlenecks and let your team focus on what matters most.',
  },
  {
    icon: '🔮',
    title: 'Predictive Technologies',
    description:
      'Next-generation predictive maintenance capabilities that move your operations from reactive repairs to proactive, data-driven asset management.',
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.12 } }),
}

export default function JwordenAI() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative bg-brand-navy text-white overflow-hidden">
        {/* Decorative gradient blob */}
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-[480px] h-[480px] rounded-full bg-brand-amber/10 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 -left-20 w-[320px] h-[320px] rounded-full bg-brand-amber/5 blur-2xl pointer-events-none"
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 text-center">
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 bg-brand-amber/10 border border-brand-amber/30 rounded-full px-4 py-1.5 mb-6"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <span className="w-2 h-2 rounded-full bg-brand-amber animate-pulse" />
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Proprietary AI Technology
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-black text-5xl md:text-7xl leading-tight mb-6"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            JWORDENAI<span className="text-brand-amber">™</span>
          </motion.h1>

          <motion.p
            className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            A cutting-edge proprietary AI brand built for the 22nd century. JWORDENAI™ powers the
            intelligence behind J.&nbsp;Worden &amp; Sons — transforming how construction and
            infrastructure projects are planned, managed, and maintained.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <Link to="/contact" className="btn-primary">
              Request Premium Access
            </Link>
            <Link to="/services" className="btn-outline">
              Explore Our Services
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Core Capabilities
            </span>
            <h2 className="section-heading mt-2">What JWORDENAI™ Brings</h2>
            <p className="text-brand-navy/60 mt-4 max-w-xl mx-auto">
              Three pillars of intelligent technology working together to elevate every project.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {FEATURES.map(({ icon, title, description }, i) => (
              <motion.div
                key={title}
                className="bg-brand-navy/5 rounded-2xl p-8 flex flex-col gap-4 hover:shadow-lg transition-shadow duration-300"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="text-4xl">{icon}</div>
                <h3 className="font-display font-bold text-brand-navy text-xl">{title}</h3>
                <p className="text-brand-navy/60 text-sm leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Premium CTA ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-brand-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Exclusive Access
            </span>
            <h2 className="font-display font-black text-4xl md:text-5xl mt-3 mb-5">
              The Full Picture Stays{' '}
              <span className="text-brand-amber">Premium</span>
            </h2>
            <p className="text-white/60 text-lg mb-10 leading-relaxed">
              JWORDENAI™ is a trademarked proprietary system. The details of our architecture,
              models, and workflows are reserved for our partners and clients. Reach out to learn
              how JWORDENAI™ can power your next project.
            </p>
            <Link to="/contact" className="btn-primary text-base">
              Contact Us for Premium Insights →
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  )
}
