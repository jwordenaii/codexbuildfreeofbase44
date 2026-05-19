import { Link } from 'react-router-dom'
import { Phone, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { SITE } from '@/config/site.js'
import { trackPhoneClick } from '@/lib/analytics.js'

export default function CTABanner() {
  return (
    <section className="relative py-20 overflow-hidden bg-navy">
      <div className="absolute inset-0 bg-hero-gradient opacity-70" />
      <div className="absolute inset-0 bg-wave-pattern" />
      <div className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full bg-sand/10 blur-[100px]" />

      <div className="relative container-wide">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <span className="section-label text-sand/80 mb-4 block">Ready to Start?</span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase text-white tracking-tight leading-tight mb-6">
            Get Your Free{' '}
            <span className="text-gradient-sand">Site Assessment</span>
          </h2>
          <p className="text-white/60 text-lg leading-relaxed mb-10">
            No obligation. We visit your property, evaluate existing conditions,
            and provide a written proposal with line-item pricing —
            all within 48 hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact" className="btn-primary-lg">
              {SITE.ctaText}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href={SITE.phoneHref}
              onClick={() => trackPhoneClick('cta_banner')}
              className="btn-outline text-base px-9 py-4"
            >
              <Phone className="w-4 h-4" />
              {SITE.phone}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
