import { Construction, Shield, Wrench, Car, Layers, ClipboardCheck, CheckCircle2, Phone } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import SEO from '@/components/SEO.jsx'
import CTABanner from '@/components/sections/CTABanner.jsx'
import { SERVICES, SITE } from '@/config/site.js'
import {
  getWebPageSchema,
  getServicesPageSchema,
  getServiceSchema,
  getBreadcrumbSchema,
  getFAQSchema,
} from '@/lib/schema.js'
import { trackPhoneClick } from '@/lib/analytics.js'

const ICON_MAP = { Construction, Shield, Wrench, Car, Layers, ClipboardCheck }

const ACCENT_PAIRS = [
  { bg: 'from-ocean/15 to-ocean/5', icon: 'text-ocean' },
  { bg: 'from-teal/15 to-teal/5',  icon: 'text-teal'  },
  { bg: 'from-sand/20 to-sand/5',  icon: 'text-sand'  },
  { bg: 'from-ocean/15 to-ocean/5', icon: 'text-ocean' },
  { bg: 'from-teal/15 to-teal/5',  icon: 'text-teal'  },
  { bg: 'from-sand/20 to-sand/5',  icon: 'text-sand'  },
]

const SERVICES_FAQS = [
  {
    q: 'How long does sealcoating last in the Outer Banks salt-air environment?',
    a: 'With our coastal-formulated sealcoat, typically 2–4 years depending on traffic volume and UV exposure. We recommend annual inspections and sealcoating every 2–3 years for OBX properties to maximize pavement life.',
  },
  {
    q: 'What is the difference between crack filling and crack sealing?',
    a: 'Crack filling uses hot-pour rubberized material for cracks under 3/4 inch. Crack sealing uses routed and sealed joints for larger or working cracks. We assess each crack type and recommend the appropriate treatment.',
  },
  {
    q: 'Can you pave during the off-season in the Outer Banks?',
    a: 'Yes, with proper conditions. We monitor air and ground temperature and pavement mix temperature throughout every job. Off-season paving is often preferred for HOA and commercial properties to avoid peak rental season disruption.',
  },
  {
    q: 'Do you handle ADA parking lot compliance upgrades?',
    a: 'Yes. We assess existing parking lots for ADA compliance, design the correct number and placement of accessible spaces, and install compliant striping, signage, and curb cuts.',
  },
]

export default function Services() {
  return (
    <>
      <SEO
        title="Asphalt Paving & Sealcoating Services | OBX Paving Co. — Outer Banks NC"
        description="Full-service asphalt paving, sealcoating, crack repair, parking lots, and preventive maintenance for the Outer Banks of NC. Formulated for coastal conditions. Licensed & insured."
        canonicalPath="/services"
        schemas={[
          getWebPageSchema({
            name: 'Asphalt Paving & Sealcoating Services | OBX Paving Co.',
            description: 'Full-service coastal asphalt paving and sealcoating for the Outer Banks of North Carolina.',
            path: '/services',
          }),
          getServicesPageSchema(),
          getBreadcrumbSchema('/services'),
          ...SERVICES.map(getServiceSchema),
          getFAQSchema(SERVICES_FAQS),
        ]}
      />

      {/* Page hero */}
      <section className="pt-32 pb-16 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-gradient opacity-80" />
        <div className="absolute inset-0 bg-wave-pattern" />
        <div className="relative container-wide text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex justify-center mb-5">
              <ol className="flex items-center gap-2 text-xs text-white/40">
                <li><Link to="/" className="hover:text-white/70 transition-colors">Home</Link></li>
                <li aria-hidden>/</li>
                <li className="text-sand/80">Services</li>
              </ol>
            </nav>
            <span className="section-label text-sand/80 mb-4 block">What We Do</span>
            <h1 className="font-display text-5xl md:text-7xl uppercase text-white tracking-tight leading-tight mb-5">
              Our Services
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
              Every service formulated and executed for coastal North Carolina conditions —
              not generic asphalt work from a mainland contractor.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services detail */}
      <section className="bg-off-white py-16 md:py-20">
        <div className="container-wide space-y-24">
          {SERVICES.map((service, idx) => {
            const Icon = ICON_MAP[service.icon] || Construction
            const accent = ACCENT_PAIRS[idx % ACCENT_PAIRS.length]
            const isEven = idx % 2 === 0

            return (
              <motion.article
                key={service.id}
                id={service.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${!isEven ? 'lg:grid-flow-dense' : ''}`}
              >
                {/* Text */}
                <div className={!isEven ? 'lg:col-start-2' : ''}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${accent.bg}`}>
                      <Icon className={`w-6 h-6 ${accent.icon}`} />
                    </div>
                    <span className="text-xs font-semibold text-ocean uppercase tracking-[0.18em]">
                      Service {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h2 className="font-display text-3xl md:text-4xl uppercase text-navy tracking-tight mb-4">
                    {service.title}
                  </h2>
                  <p className="text-slate-600 leading-relaxed mb-6">{service.fullDesc}</p>
                  <ul className="space-y-2.5 mb-8">
                    {service.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-3 text-sm text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-teal shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/contact" className="btn-primary px-6 py-3">
                      Get a Quote
                    </Link>
                    <a
                      href={SITE.phoneHref}
                      onClick={() => trackPhoneClick(`services_${service.id}`)}
                      className="btn-outline-dark px-6 py-3"
                    >
                      <Phone className="w-4 h-4" />
                      {SITE.phone}
                    </a>
                  </div>
                </div>

                {/* Visual card */}
                <div className={!isEven ? 'lg:col-start-1' : ''}>
                  <div className={`rounded-2xl bg-gradient-to-br ${accent.bg} border border-navy/10 p-12 flex flex-col items-center justify-center gap-4 min-h-[280px]`}>
                    <Icon className={`w-24 h-24 opacity-20 ${accent.icon}`} />
                    <p className="font-display text-2xl uppercase text-navy/50 tracking-wide text-center">
                      {service.title}
                    </p>
                    <p className="text-slate-400 text-sm text-center max-w-xs">{service.shortDesc}</p>
                  </div>
                </div>
              </motion.article>
            )
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-white">
        <div className="container-tight">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="section-label mb-3 block">Common Questions</span>
            <h2 className="font-display text-3xl md:text-4xl uppercase text-navy tracking-tight">
              Service FAQs
            </h2>
          </motion.div>
          <div className="space-y-4">
            {SERVICES_FAQS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="card-base p-6"
              >
                <p className="font-semibold text-navy mb-2">{faq.q}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  )
}
