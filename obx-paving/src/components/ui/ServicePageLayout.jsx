/**
 * ServicePageLayout — shared layout for individual service detail pages.
 * Each page passes its own unique content sections; the shell (hero, CTA)
 * and schema injection are handled here.
 */
import { Link } from 'react-router-dom'
import { Phone, ArrowRight, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import SEO from '@/components/SEO.jsx'
import CTABanner from '@/components/sections/CTABanner.jsx'
import { SITE } from '@/config/site.js'
import {
  getWebPageSchema,
  getBreadcrumbSchema,
  getServiceSchema,
  getFAQSchema,
} from '@/lib/schema.js'
import { trackPhoneClick } from '@/lib/analytics.js'
import { cn } from '@/lib/utils.js'

export default function ServicePageLayout({
  service,          // service object from site.js
  seoTitle,
  seoDescription,
  heroLabel,
  heroHeading,      // JSX allowed for <span> highlights
  heroBody,
  whySection,       // { heading, items: [{icon, title, desc}] }
  processSection,   // { heading, steps: [{num, title, desc}] }
  galleryPlaceholder, // optional descriptive text for image placeholder
  faqs = [],
  children,         // any extra section inserted between process + FAQ
}) {
  const canonical = `/services/${service.slug}`

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonicalPath={canonical}
        schemas={[
          getWebPageSchema({ name: seoTitle, description: seoDescription, path: canonical }),
          getServiceSchema(service),
          getBreadcrumbSchema(canonical),
          ...(faqs.length ? [getFAQSchema(faqs)] : []),
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-gradient opacity-80" />
        <div className="absolute inset-0 bg-wave-pattern" />
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] -translate-y-1/2 rounded-full bg-ocean/15 blur-[100px]" />

        <div className="relative container-wide">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex mb-6">
            <ol className="flex items-center gap-2 text-xs text-white/40">
              <li><Link to="/" className="hover:text-white/60 transition-colors">Home</Link></li>
              <li>/</li>
              <li><Link to="/services" className="hover:text-white/60 transition-colors">Services</Link></li>
              <li>/</li>
              <li className="text-sand/80">{service.title}</li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="section-label text-sand/80 mb-4"
            >
              {heroLabel || 'Our Services'}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="font-display text-5xl md:text-6xl lg:text-7xl uppercase text-white tracking-tight leading-[0.92] mb-6"
            >
              {heroHeading}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-white/65 text-lg leading-relaxed mb-9 max-w-2xl"
            >
              {heroBody}
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-wrap gap-4"
            >
              <Link to="/contact" className="btn-primary-lg">
                Get Free Quote
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href={SITE.phoneHref}
                onClick={() => trackPhoneClick(`${service.slug}_hero`)}
                className="btn-outline text-base px-8 py-4"
              >
                <Phone className="w-4 h-4" />
                {SITE.phone}
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Service overview + highlights ────────────────────────────── */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            <div className="lg:col-span-3">
              <span className="section-label mb-3 block">About This Service</span>
              <h2 className="font-display text-3xl md:text-4xl uppercase text-navy tracking-tight mb-5">
                {service.title} for the Outer Banks
              </h2>
              <p className="text-slate-600 leading-relaxed text-base">{service.fullDesc}</p>
            </div>

            <div className="lg:col-span-2">
              <div className="card-base p-7">
                <p className="font-display text-sm uppercase tracking-[0.18em] text-ocean mb-4">
                  What's Included
                </p>
                <ul className="space-y-3">
                  {service.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                      {h}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <Link to="/contact" className="btn-primary w-full justify-center py-3.5">
                    Request a Free Quote
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why / differentiators ────────────────────────────────────── */}
      {whySection && (
        <section className="section-padding bg-off-white">
          <div className="container-wide">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="section-label mb-3 block">Why It Matters</span>
              <h2 className="font-display text-3xl md:text-4xl uppercase text-navy tracking-tight">
                {whySection.heading}
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {whySection.items.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="card-base card-hover p-6"
                >
                  <div className="w-10 h-10 rounded-xl bg-ocean/10 flex items-center justify-center mb-4">
                    <span className="font-display text-ocean text-xl">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="font-display text-lg uppercase text-navy tracking-tight mb-2">{item.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Process ──────────────────────────────────────────────────── */}
      {processSection && (
        <section className="section-padding bg-navy relative overflow-hidden">
          <div className="absolute inset-0 bg-wave-pattern" />
          <div className="relative container-wide">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="section-label text-sand/80 mb-3 block">How We Do It</span>
              <h2 className="font-display text-3xl md:text-4xl uppercase text-white tracking-tight">
                {processSection.heading}
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {processSection.steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10"
                >
                  <span className="font-display text-4xl text-sand leading-none block mb-4">{step.num}</span>
                  <h3 className="font-display text-lg uppercase text-white tracking-tight mb-2">{step.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Extra sections ───────────────────────────────────────────── */}
      {children}

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      {faqs.length > 0 && (
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
                {service.title} FAQs
              </h2>
            </motion.div>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
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
      )}

      {/* ── Related services ─────────────────────────────────────────── */}
      <section className="section-padding bg-off-white">
        <div className="container-wide">
          <h2 className="font-display text-2xl uppercase text-navy tracking-tight mb-6 text-center">
            Related Services
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Sealcoating', slug: 'sealcoating' },
              { title: 'Crack Filling', slug: 'crack-filling' },
              { title: 'Asphalt Repairs', slug: 'asphalt-repairs' },
              { title: 'Line Striping', slug: 'line-striping' },
            ]
              .filter((s) => s.slug !== service.slug)
              .slice(0, 4)
              .map((s) => (
                <Link
                  key={s.slug}
                  to={`/services/${s.slug}`}
                  className="card-base p-5 flex items-center justify-between gap-3 hover:shadow-lg hover:border-ocean/20 transition-all"
                >
                  <span className="font-semibold text-navy text-sm">{s.title}</span>
                  <ArrowRight className="w-4 h-4 text-ocean shrink-0" />
                </Link>
              ))}
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  )
}
