import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SchemaMarkup, { LOCAL_BUSINESS_SCHEMA } from '../components/SchemaMarkup'
import { SERVICE_AREAS } from '../data/serviceAreas'
import { SITE_URL } from '../lib/schemas'
import { trackEvent } from '../api/client'

// Build an areaServed list schema for all service cities
function serviceAreaListSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'PavingContractor',
    name: 'J. Worden & Sons Asphalt Paving',
    telephone: '+18044461296',
    url: SITE_URL,
    areaServed: SERVICE_AREAS.map((a) => ({
      '@type': 'City',
      name: a.city,
      containedInPlace: { '@type': 'State', name: a.state },
    })),
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.04 } }),
}

export default function ServiceAreas() {
  // Group by state for display
  const byState = SERVICE_AREAS.reduce((acc, area) => {
    const key = area.state
    if (!acc[key]) acc[key] = []
    acc[key].push(area)
    return acc
  }, {})

  return (
    <>
      <SchemaMarkup
        title="Service Areas — Asphalt Paving Across Virginia"
        description="J. Worden & Sons Asphalt Paving serves Richmond, Chester, Chesterfield, Henrico, Colonial Heights, Petersburg, Hopewell, Midlothian, and 20+ Virginia cities. Free estimates — call (804) 446-1296."
        canonical="/service-areas"
        schema={[LOCAL_BUSINESS_SCHEMA, serviceAreaListSchema()]}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Service Areas', path: '/service-areas' },
        ]}
      />

      {/* ── Hero ── */}
      <section className="bg-brand-navy py-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
            Where We Work
          </span>
          <h1 className="font-display font-black text-4xl md:text-6xl mt-3 mb-4">Service Areas</h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto mb-8">
            Based in Chester, VA — we serve Richmond, Hampton Roads, the I-95 corridor, and beyond.
            Commercial and residential asphalt work across Virginia and into the Southeast.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/quote"
              className="btn-primary text-lg px-8 py-4"
              onClick={() => trackEvent('cta_click', { location: 'service_areas_hero' })}
            >
              Get a Free Estimate
            </Link>
            <a
              href="tel:+18044461296"
              className="btn-outline text-lg px-8 py-4"
              onClick={() => trackEvent('phone_click', { location: 'service_areas_hero' })}
            >
              📞 (804) 446-1296
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="bg-brand-charcoal py-8 text-white">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { stat: '40+', label: 'Years serving Virginia' },
            { stat: '20+', label: 'Cities covered' },
            { stat: '12+', label: 'States — QSR work' },
            { stat: 'Free', label: 'On-site estimates' },
          ].map(({ stat, label }) => (
            <div key={label}>
              <div className="font-display font-black text-brand-amber text-3xl">{stat}</div>
              <div className="text-white/50 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── City grid ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {Object.entries(byState).map(([stateName, areas]) => (
            <div key={stateName} className="mb-16">
              <h2 className="font-display font-black text-2xl text-brand-navy mb-8 border-b-2 border-brand-amber pb-3">
                📍 {stateName}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {areas.map((area, i) => (
                  <motion.div
                    key={area.slug}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    custom={i}
                    variants={fadeUp}
                  >
                    <Link
                      to={`/service-areas/${area.slug}`}
                      className="block card p-5 hover:border-brand-amber border-2 border-transparent group transition-all"
                      onClick={() => trackEvent('service_area_click', { city: area.city })}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-display font-bold text-brand-navy text-lg group-hover:text-brand-amber transition-colors">
                            {area.city}
                          </div>
                          <div className="text-brand-navy/50 text-xs">{area.county}</div>
                        </div>
                        <span className="text-brand-amber text-lg">→</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {area.services.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="text-xs bg-brand-navy/5 text-brand-navy/60 px-2 py-0.5 rounded-full"
                          >
                            {s}
                          </span>
                        ))}
                        {area.services.length > 3 && (
                          <span className="text-xs text-brand-amber">
                            +{area.services.length - 3} more
                          </span>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Don't see your city? ── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display font-black text-2xl text-brand-navy mb-3">
            Don&apos;t see your city?
          </h2>
          <p className="text-brand-navy/60 mb-6">
            We travel for the right commercial project. If you&apos;re in Virginia or a neighboring
            state and need a professional asphalt contractor, reach out — we&apos;ll let you know if
            we can make it work.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/contact" className="btn-primary">
              Ask About Your Location
            </Link>
            <a href="tel:+18044461296" className="btn-outline">
              📞 Call Us
            </a>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 bg-brand-amber">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display font-black text-brand-navy text-3xl mb-3">
            Ready for a Free Estimate?
          </h2>
          <p className="text-brand-navy/70 mb-6">
            Fill out the quick quote form or call us directly. We get back to every request —
            usually within a few hours.
          </p>
          <Link
            to="/quote"
            className="bg-brand-navy text-white font-bold px-8 py-4 rounded-lg hover:bg-brand-navy/90 transition-colors text-lg"
            onClick={() => trackEvent('cta_click', { location: 'service_areas_bottom' })}
          >
            Request a Free Quote
          </Link>
        </div>
      </section>
    </>
  )
}
