import { MapPin, TrendingUp, Globe, Phone, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import SEO from '@/components/SEO.jsx'
import CTABanner from '@/components/sections/CTABanner.jsx'
import { AREAS, SITE } from '@/config/site.js'
import { trackPhoneClick } from '@/lib/analytics.js'

function AreaCard({ area, accentClass }) {
  return (
    <div className={`rounded-xl p-5 border transition-all duration-200 ${accentClass}`}>
      <p className="font-semibold text-navy">{area.name}</p>
      <p className="text-sm text-slate-500 mt-0.5">{area.county} County</p>
      {area.note && (
        <p className="text-xs text-slate-400 mt-1.5 italic">{area.note}</p>
      )}
    </div>
  )
}

export default function ServiceAreas() {
  return (
    <>
      <SEO
        title="Service Areas | OBX Paving Co. — Outer Banks NC"
        description="OBX Paving Co. serves all of the Outer Banks and surrounding areas — Dare County, Currituck County, Kill Devil Hills, Nags Head, Kitty Hawk, Duck, Corolla, and more."
        canonicalPath="/service-areas"
      />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-gradient opacity-80" />
        <div className="absolute inset-0 bg-wave-pattern" />
        <div className="relative container-wide text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="section-label text-sand/80 mb-4 block">Where We Work</span>
            <h1 className="font-display text-5xl md:text-7xl uppercase text-white tracking-tight mb-5">
              Service Areas
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
              From Corolla to Hatteras and into the fastest-growing Currituck County
              communities — the entire Outer Banks is our home turf.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Coverage overview */}
      <section className="section-padding bg-off-white">
        <div className="container-wide">
          {/* Primary OBX */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="mb-14"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-ocean/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-ocean" />
              </div>
              <div>
                <h2 className="font-display text-2xl uppercase text-navy tracking-wide">
                  Core Outer Banks
                </h2>
                <p className="text-slate-500 text-sm">Dare County primary coverage area</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {AREAS.primary.map((area) => (
                <AreaCard
                  key={area.name}
                  area={area}
                  accentClass="bg-white border-slate-100 hover:border-ocean/25 hover:shadow-sm"
                />
              ))}
            </div>
          </motion.div>

          {/* Growing areas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="mb-14"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-teal" />
              </div>
              <div>
                <h2 className="font-display text-2xl uppercase text-navy tracking-wide">
                  Growing Currituck County
                </h2>
                <p className="text-slate-500 text-sm">Fastest-developing communities in NE North Carolina</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {AREAS.growing.map((area) => (
                <AreaCard
                  key={area.name}
                  area={area}
                  accentClass="bg-teal/5 border-teal/15 hover:border-teal/30"
                />
              ))}
            </div>
            <div className="mt-5 p-5 rounded-xl bg-teal/5 border border-teal/15">
              <p className="text-sm text-teal font-medium mb-1">
                Why Currituck County is growing so fast
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Currituck County is experiencing some of the fastest residential and commercial
                growth in North Carolina, driven by proximity to the Virginia Beach metro,
                expanding US-158 corridor development, and OBX property demand overflow.
                We're investing in this market to serve it properly, not just occasionally.
              </p>
            </div>
          </motion.div>

          {/* Mainland */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="mb-14"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-sand/15 flex items-center justify-center">
                <Globe className="w-5 h-5 text-sand" />
              </div>
              <div>
                <h2 className="font-display text-2xl uppercase text-navy tracking-wide">
                  Northeastern NC Mainland
                </h2>
                <p className="text-slate-500 text-sm">Extended service area — call to confirm availability</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {AREAS.mainland.map((area) => (
                <AreaCard
                  key={area.name}
                  area={area}
                  accentClass="bg-sand-pale border-sand/20 hover:border-sand/40"
                />
              ))}
            </div>
          </motion.div>

          {/* Not listed CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl bg-navy text-white p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
          >
            <div>
              <h3 className="font-display text-2xl uppercase tracking-wide mb-2">
                Area Not Listed?
              </h3>
              <p className="text-white/60 text-sm max-w-lg leading-relaxed">
                We're actively expanding coverage across northeastern NC. Call us or send a message —
                if it's within a reasonable radius, we'll make it work.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <a
                href={SITE.phoneHref}
                onClick={() => trackPhoneClick('service_areas_page')}
                className="btn-outline text-sm px-6 py-2.5"
              >
                <Phone className="w-4 h-4" />
                {SITE.phone}
              </a>
              <Link to="/contact" className="btn-primary text-sm px-6 py-2.5">
                Get a Quote
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <CTABanner />
    </>
  )
}
