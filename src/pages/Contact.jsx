import { Phone, Mail, MapPin, Clock, MessageSquare } from 'lucide-react'
import { motion } from 'framer-motion'
import SEO from '@/components/SEO.jsx'
import QuoteForm from '@/components/QuoteForm.jsx'
import { SITE } from '@/config/site.js'
import { trackPhoneClick } from '@/lib/analytics.js'

const CONTACT_DETAILS = [
  {
    icon: Phone,
    label: 'Phone',
    value: SITE.phone,
    href: SITE.phoneHref,
    action: () => trackPhoneClick('contact_page'),
  },
  {
    icon: Mail,
    label: 'Email',
    value: SITE.email,
    href: `mailto:${SITE.email}`,
    action: null,
  },
  {
    icon: MapPin,
    label: 'Based In',
    value: SITE.address,
    href: null,
    action: null,
  },
  {
    icon: Clock,
    label: 'Hours',
    value: 'Mon–Fri 7 am – 5 pm\nEmergency line available',
    href: null,
    action: null,
  },
]

export default function Contact() {
  return (
    <>
      <SEO
        title="Get a Free Quote | OBX Paving Co. — Outer Banks, NC"
        description="Request a free asphalt paving or sealcoating quote for your Outer Banks property. Fast response, written proposal, no obligation."
        canonicalPath="/contact"
      />

      {/* Hero */}
      <section className="pt-32 pb-14 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-gradient opacity-80" />
        <div className="absolute inset-0 bg-wave-pattern" />
        <div className="relative container-wide text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="section-label text-sand/80 mb-4 block">Get Started</span>
            <h1 className="font-display text-5xl md:text-7xl uppercase text-white tracking-tight mb-5">
              Free Quote
            </h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Fill in the form and we'll reach out within one business day
              to schedule your free on-site assessment.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact layout */}
      <section className="section-padding bg-off-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Left sidebar — contact info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-2 space-y-6"
            >
              <div>
                <span className="section-label mb-3 block">Contact Info</span>
                <h2 className="font-display text-3xl uppercase text-navy tracking-tight mb-3">
                  Reach Out Any Time
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Prefer to talk? Call or text us directly. We're a local contractor —
                  you'll reach a real person who knows the OBX.
                </p>
              </div>

              <div className="space-y-4">
                {CONTACT_DETAILS.map(({ icon: Icon, label, value, href, action }) => (
                  <div key={label} className="flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-100">
                    <div className="w-10 h-10 rounded-lg bg-ocean/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-ocean" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                        {label}
                      </p>
                      {href ? (
                        <a
                          href={href}
                          onClick={action || undefined}
                          className="text-navy font-medium text-sm hover:text-ocean transition-colors"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="text-navy font-medium text-sm whitespace-pre-line">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Response time promise */}
              <div className="p-5 rounded-xl bg-ocean/5 border border-ocean/15">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-ocean" />
                  <p className="font-semibold text-navy text-sm">Our Response Promise</p>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                  We respond to all quote requests within one business day. For urgent
                  repair needs, call us directly for same or next-day assessment.
                </p>
              </div>
            </motion.div>

            {/* Right — form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="lg:col-span-3"
            >
              <div className="card-base p-8">
                <h2 className="font-display text-2xl uppercase text-navy tracking-tight mb-6">
                  Request a Free Site Assessment
                </h2>
                <QuoteForm />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-white">
        <div className="container-tight">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="text-center mb-10"
          >
            <span className="section-label mb-3 block">Common Questions</span>
            <h2 className="font-display text-3xl md:text-4xl uppercase text-navy tracking-tight">
              Before You Call
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                q: 'How long does a quote take?',
                a: 'We typically schedule a site visit within 2–3 business days and deliver a written proposal within 24 hours of the visit.',
              },
              {
                q: 'Do you work on occupied rental properties?',
                a: 'Yes. We work closely with property managers and HOAs to schedule around rental calendars, minimizing downtime and guest disruption.',
              },
              {
                q: 'What makes coastal paving different?',
                a: 'Salt air accelerates oxidation and embrittlement of standard asphalt mixes. We use premium polymer-modified binders and specialized sealcoating formulas with salt-inhibiting additives.',
              },
              {
                q: 'Do you offer maintenance contracts?',
                a: 'Yes. We offer annual inspection + sealcoating maintenance programs for property managers, HOAs, and rental property owners. Ask about multi-property discounts.',
              },
              {
                q: 'How do I pay?',
                a: 'Check, ACH, or major credit card. Deposit on contract signing; remainder on completion. We never ask for full payment upfront.',
              },
            ].map((faq, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.07 }}
                className="card-base p-6"
              >
                <p className="font-semibold text-navy mb-2">{faq.q}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
