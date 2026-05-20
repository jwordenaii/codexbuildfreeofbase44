import { Link } from 'react-router-dom'
import { MapPin, ArrowRight, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { AREAS } from '@/config/site.js'
import { cn } from '@/lib/utils.js'

export default function ServiceAreasSection() {
  return (
    <section className="section-padding bg-sand-pale">
      <div className="container-wide">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <span className="section-label mb-3 block">Where We Work</span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase text-navy tracking-tight">
            Service Areas
          </h2>
          <p className="text-slate-500 mt-4 max-w-2xl mx-auto">
            From Corolla to Hatteras and into the fastest-growing Currituck County
            communities — we're the paving contractor the Outer Banks relies on.
          </p>
        </motion.div>

        {/* Primary areas */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-5">
            <MapPin className="w-5 h-5 text-ocean" />
            <h3 className="font-display text-xl uppercase text-navy tracking-wide">Core Outer Banks</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {AREAS.primary.map((area) => (
              <Link
                key={area.name}
                to="/service-areas"
                className="group flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-100 hover:border-ocean/30 hover:shadow-[0_4px_20px_-4px_rgba(22,102,168,0.15)] transition-all duration-200"
              >
                <div className="w-2 h-2 rounded-full bg-ocean mt-1.5 shrink-0 group-hover:bg-sand transition-colors" />
                <div>
                  <p className="font-semibold text-navy text-sm">{area.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{area.county} Co.</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Growing areas */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-teal" />
            <h3 className="font-display text-xl uppercase text-navy tracking-wide">
              Growing Currituck County
            </h3>
            <span className="text-xs bg-teal/10 text-teal font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Fastest growing
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {AREAS.growing.map((area) => (
              <Link
                key={area.name}
                to="/service-areas"
                className="group flex flex-col gap-1 p-4 rounded-xl bg-teal/5 border border-teal/15 hover:border-teal/35 hover:bg-teal/10 transition-all duration-200"
              >
                <p className="font-semibold text-navy text-sm">{area.name}</p>
                <p className="text-teal text-xs">{area.county} Co.</p>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 p-6 rounded-2xl bg-navy text-white"
        >
          <div>
            <p className="font-display text-xl uppercase tracking-wide">
              Don't see your area?
            </p>
            <p className="text-white/60 text-sm mt-1">
              We serve all of northeastern NC. Contact us and we'll confirm coverage.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link to="/service-areas" className="btn-outline text-sm px-6 py-2.5">
              Full Area Map
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/contact" className="btn-primary text-sm px-6 py-2.5">
              Get a Quote
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
