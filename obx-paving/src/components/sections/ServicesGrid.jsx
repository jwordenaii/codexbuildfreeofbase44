import { Link } from 'react-router-dom'
import { ArrowRight, Construction, Shield, Wrench, Car, Layers, ClipboardCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { SERVICES } from '@/config/site.js'
import { cn } from '@/lib/utils.js'

const ICON_MAP = {
  Construction,
  Shield,
  Wrench,
  Car,
  Layers,
  ClipboardCheck,
}

const ACCENT_COLORS = [
  'bg-ocean/10 text-ocean',
  'bg-teal/10 text-teal',
  'bg-sand/15 text-sand',
  'bg-ocean/10 text-ocean',
  'bg-teal/10 text-teal',
  'bg-sand/15 text-sand',
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function ServicesGrid({ preview = false }) {
  const displayed = preview ? SERVICES.slice(0, 6) : SERVICES

  return (
    <section id="services" className="section-padding bg-off-white">
      <div className="container-wide">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <span className="section-label mb-3 block">What We Do</span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase text-navy tracking-tight leading-tight">
            Coastal Paving Services
          </h2>
          <p className="text-slate-500 mt-4 max-w-2xl mx-auto leading-relaxed">
            Every service is engineered for the Outer Banks environment — salt air,
            coastal humidity, and the year-round conditions that standard contractors
            aren't equipped to handle.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {displayed.map((service, idx) => {
            const Icon = ICON_MAP[service.icon] || Construction
            const accentCls = ACCENT_COLORS[idx % ACCENT_COLORS.length]

            return (
              <motion.article
                key={service.id}
                variants={item}
                className="card-base card-hover p-7 flex flex-col group"
              >
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-5', accentCls)}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-display text-xl uppercase text-navy tracking-tight mb-3">
                  {service.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-5">
                  {service.shortDesc}
                </p>
                <ul className="space-y-1.5 mb-6">
                  {service.highlights.slice(0, 3).map((h) => (
                    <li key={h} className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="w-1 h-1 rounded-full bg-sand flex-shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
                <Link
                  to={service.slug ? `/services/${service.slug}` : `/services#${service.id}`}
                  className="flex items-center gap-1.5 text-ocean text-sm font-semibold group-hover:gap-2.5 transition-all"
                >
                  Learn more
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.article>
            )
          })}
        </motion.div>

        {/* CTA */}
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center mt-12"
          >
            <Link to="/services" className="btn-outline-dark px-8 py-3.5">
              View All Services
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  )
}
