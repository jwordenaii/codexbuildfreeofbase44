import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SchemaMarkup, { faqSchema } from '../components/SchemaMarkup'
import FAQAccordion from '../components/FAQAccordion'
import { getServiceArea, SERVICE_AREAS } from '../data/serviceAreas'
import { SITE_URL } from '../lib/schemas'
import { trackEvent } from '../api/client'
import NotFound from './NotFound'

// Build LocalBusiness schema with city-specific areaServed
function cityLocalBusinessSchema(area) {
  return {
    '@context': 'https://schema.org',
    '@type': ['PavingContractor', 'LocalBusiness'],
    name: 'J. Worden & Sons Asphalt Paving',
    description: area.description,
    telephone: '+18044461296',
    email: 'contact@jwordenasphaltpaving.com',
    url: `${SITE_URL}/service-areas/${area.slug}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '1601 Ware Bottom Springs Rd Suite 214',
      addressLocality: 'Chester',
      addressRegion: 'VA',
      postalCode: '23836',
      addressCountry: 'US',
    },
    areaServed: {
      '@type': 'City',
      name: area.city,
      containedInPlace: { '@type': 'State', name: area.state },
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: area.lat,
      longitude: area.lng,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      bestRating: '5',
      worstRating: '1',
      reviewCount: '87',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Asphalt Paving Services',
      itemListElement: area.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s },
      })),
    },
  }
}

const NEARBY_SERVICES = [
  { icon: '🛣', name: 'Asphalt Paving' },
  { icon: '🖤', name: 'Sealcoating' },
  { icon: '🔧', name: 'Crack Filling' },
  { icon: '🏢', name: 'Parking Lots' },
  { icon: '🏠', name: 'Driveways' },
  { icon: '🔄', name: 'Maintenance Plans' },
]

const SERVICE_LINKS = {
  'Asphalt Paving': '/services#paving',
  Sealcoating: '/services#sealcoating',
  'Crack Filling': '/services#crackfill',
  'Parking Lots': '/services#parking',
  Driveways: '/services#driveways',
  'Maintenance Plans': '/services#maintenance',
}

function cityRankingSignals(area) {
  return [
    {
      title: `${area.city} service-area relevance`,
      text: `This page connects asphalt paving, sealcoating, crack filling, parking lots, driveways, and maintenance to ${area.city}, ${area.stateCode} instead of relying on one generic statewide claim.`,
    },
    {
      title: 'Local corridors and landmarks',
      text: `${area.nearbyLandmarks.join(', ')} help customers and search engines understand the real local market we serve.`,
    },
    {
      title: 'Virginia pavement conditions',
      text: 'We account for summer heat, freeze/thaw cycles, clay soils, drainage, rutting, base failure, oxidation, and the maintenance timing that affects asphalt in Virginia.',
    },
    {
      title: 'Commercial-grade proof',
      text: 'The same planning used for QSR/franchise work — traffic control, ADA layout, drainage review, utility awareness, asphalt temperature logic, and maintenance records — supports local jobs.',
    },
  ]
}

export default function CityPage() {
  const { citySlug } = useParams()
  const area = getServiceArea(citySlug)

  if (!area) return <NotFound />

  // 3 nearby areas (different slugs)
  const nearbyAreas = SERVICE_AREAS.filter((a) => a.slug !== area.slug).slice(0, 3)
  const localSignals = cityRankingSignals(area)

  return (
    <>
      <SchemaMarkup
        title={area.headline}
        description={`${area.description.slice(0, 155)}…`}
        canonical={`/service-areas/${area.slug}`}
        schema={[cityLocalBusinessSchema(area), faqSchema(area.faqs)]}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Service Areas', path: '/service-areas' },
          { name: area.city, path: `/service-areas/${area.slug}` },
        ]}
      />

      {/* ── Hero ── */}
      <section className="bg-brand-navy text-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <nav className="text-white/40 text-sm mb-8 flex items-center gap-2">
            <Link to="/" className="hover:text-brand-amber transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to="/service-areas" className="hover:text-brand-amber transition-colors">
              Service Areas
            </Link>
            <span>/</span>
            <span className="text-white/80">
              {area.city}, {area.stateCode}
            </span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              📍 {area.county}
            </span>
            <h1 className="font-display font-black text-4xl md:text-5xl mt-3 mb-4 leading-tight">
              {area.headline}
            </h1>
            <p className="text-white/70 text-xl max-w-2xl mb-8">{area.tagline}</p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/quote"
                className="btn-primary text-lg px-8 py-4"
                onClick={() => trackEvent('cta_click', { location: `city_hero_${area.slug}` })}
              >
                Get a Free Estimate in {area.city}
              </Link>
              <a
                href="tel:+18044461296"
                className="btn-outline text-lg px-8 py-4"
                onClick={() => trackEvent('phone_click', { location: `city_hero_${area.slug}` })}
              >
                📞 (804) 446-1296
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Services available in this city ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="section-heading mb-3">
            Asphalt Paving Services in {area.city}, {area.stateCode}
          </h2>
          <p className="text-brand-navy/60 mb-10 max-w-2xl">
            J. Worden &amp; Sons gives {area.city} homeowners and commercial property managers clear
            service choices for asphalt paving, parking lots, driveways, sealcoating, crack filling,
            repair, and maintenance.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {NEARBY_SERVICES.filter((s) => area.services.includes(s.name)).map((svc, i) => (
              <motion.div
                key={svc.name}
                className="card p-5"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
              >
                <Link to={SERVICE_LINKS[svc.name] || '/services'} className="block">
                  <div className="text-3xl mb-2">{svc.icon}</div>
                  <div className="font-display font-bold text-brand-navy">{svc.name}</div>
                  <div className="text-xs text-brand-amber mt-2">View service →</div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About this area ── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display font-black text-2xl text-brand-navy mb-4">
                Why {area.city} Homeowners &amp; Businesses Choose J Worden &amp; Sons
              </h2>
              <p className="text-brand-navy/70 leading-relaxed mb-6">{area.description}</p>
              <ul className="space-y-3">
                {[
                  '40+ years of asphalt expertise',
                  'Free on-site estimates',
                  'Commercial-grade equipment',
                  'Fully licensed and insured',
                  'KFC national QSR vendor — 12+ states',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand-amber flex-shrink-0 flex items-center justify-center text-brand-navy font-bold text-xs">
                      ✓
                    </span>
                    <span className="text-brand-navy/80 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-navy rounded-2xl p-8 text-white">
              <div className="text-brand-amber text-xs font-bold uppercase tracking-widest mb-4">
                Serving {area.city}
              </div>
              <div className="space-y-3 text-white/80 text-sm">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span>Headquarters</span>
                  <span className="text-white font-medium">Chester, VA</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span>Phone</span>
                  <a href="tel:+18044461296" className="text-brand-amber font-medium">
                    (804) 446-1296
                  </a>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span>Est.</span>
                  <span className="text-white font-medium">1984</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span>Google Rating</span>
                  <span className="text-brand-amber font-medium">4.9 ★</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimates</span>
                  <span className="text-green-400 font-medium">Always Free</span>
                </div>
              </div>
              <Link
                to="/quote"
                className="mt-6 w-full text-center btn-primary block"
                onClick={() => trackEvent('cta_click', { location: `city_sidebar_${area.slug}` })}
              >
                Get My Free Quote
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Local ranking / buyer proof ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Local paving proof for {area.city}
            </span>
            <h2 className="section-heading mt-2 mb-3">
              Why This Page Is Built to Help {area.city} Buyers Decide
            </h2>
            <p className="text-brand-navy/60 max-w-2xl mx-auto">
              Strong paving pages win when they prove the service, the place, the buyer type, and
              the production details. This content connects those signals for {area.city},{' '}
              {area.stateCode}.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {localSignals.map((signal) => (
              <div key={signal.title} className="rounded-xl border border-brand-navy/10 p-5">
                <h3 className="font-display font-bold text-brand-navy">{signal.title}</h3>
                <p className="text-sm text-brand-navy/65 leading-relaxed mt-2">{signal.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Local landmarks ── */}
      {area.nearbyLandmarks?.length > 0 && (
        <section className="py-12 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h3 className="font-display font-bold text-xl text-brand-navy mb-6">
              Areas &amp; Landmarks We Serve Near {area.city}
            </h3>
            <div className="flex flex-wrap gap-2">
              {area.nearbyLandmarks.map((lm) => (
                <span
                  key={lm}
                  className="bg-brand-navy/5 text-brand-navy/70 px-4 py-2 rounded-full text-sm"
                >
                  📍 {lm}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      {area.faqs?.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="section-heading text-center mb-10">
              FAQs — Paving in {area.city}, {area.stateCode}
            </h2>
            <FAQAccordion items={area.faqs} />
          </div>
        </section>
      )}

      {/* ── Nearby service areas ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h3 className="font-display font-bold text-xl text-brand-navy mb-6">
            Nearby Service Areas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {nearbyAreas.map((nearby) => (
              <Link
                key={nearby.slug}
                to={`/service-areas/${nearby.slug}`}
                className="card p-5 hover:border-brand-amber border-2 border-transparent transition-all group"
              >
                <div className="font-display font-bold text-brand-navy group-hover:text-brand-amber transition-colors">
                  {nearby.city}, {nearby.stateCode}
                </div>
                <div className="text-brand-navy/50 text-xs mt-1">{nearby.county}</div>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              to="/service-areas"
              className="text-brand-amber font-semibold hover:underline text-sm"
            >
              View all service areas →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 bg-brand-amber">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display font-black text-brand-navy text-3xl mb-3">
            Ready to Get Started in {area.city}?
          </h2>
          <p className="text-brand-navy/70 mb-6 text-lg">
            Free estimate. No pressure. Fast response.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/quote"
              className="bg-brand-navy text-white font-bold px-8 py-4 rounded-lg hover:bg-brand-navy/90 transition-colors text-lg"
              onClick={() => trackEvent('cta_click', { location: `city_bottom_${area.slug}` })}
            >
              Request a Free Quote
            </Link>
            <a
              href="tel:+18044461296"
              className="border-2 border-brand-navy text-brand-navy font-bold px-8 py-4 rounded-lg hover:bg-brand-navy hover:text-white transition-colors text-lg"
            >
              📞 (804) 446-1296
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
