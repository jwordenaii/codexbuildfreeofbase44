import { Link } from 'react-router-dom'
import { Phone, ArrowRight, ChevronDown, Star, ShieldCheck, MapPin } from 'lucide-react'
import { motion } from 'framer-motion'
import { SITE } from '@/config/site.js'
import { trackPhoneClick } from '@/lib/analytics.js'

const BADGES = [
  { icon: ShieldCheck, text: 'NC Licensed & Insured' },
  { icon: Star, text: '5-Star Rated' },
  { icon: MapPin, text: 'Outer Banks Local' },
]

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-navy">
      {/* Background layers */}
      <div className="absolute inset-0 bg-hero-gradient opacity-90" />
      <div className="absolute inset-0 bg-wave-pattern opacity-100" />
      {/* Radial glow */}
      <div className="absolute top-1/3 -left-1/4 w-[800px] h-[800px] rounded-full bg-ocean/20 blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-teal/15 blur-[100px]" />
      {/* Animated grain overlay */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat', backgroundSize: '128px' }} />

      {/* Content */}
      <div className="relative flex-1 flex flex-col justify-center container-wide pt-28 pb-20">
        <div className="max-w-4xl">
          {/* Top label */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-2 mb-6"
          >
            <span className="inline-flex items-center gap-1.5 bg-sand/15 border border-sand/30 text-sand text-xs font-semibold tracking-[0.2em] uppercase px-4 py-2 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-sand animate-pulse" />
              Outer Banks · Dare County · Currituck County
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl uppercase tracking-tight leading-[0.9] text-white mb-6"
          >
            Outer Banks{' '}
            <span className="text-gradient-sand">Asphalt &</span>{' '}
            Sealcoating
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-white/70 text-lg md:text-xl leading-relaxed max-w-2xl mb-10"
          >
            Premium paving and sealcoating engineered for the coastal environment —
            salt air, ocean humidity, and high UV. Serving all of Dare County,
            Currituck County, and surrounding areas.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.5 }}
            className="flex flex-wrap gap-4 mb-12"
          >
            <Link to="/contact" className="btn-primary-lg">
              {SITE.ctaText}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href={SITE.phoneHref}
              onClick={() => trackPhoneClick('hero')}
              className="btn-outline text-base px-8 py-4"
            >
              <Phone className="w-4 h-4" />
              {SITE.phone}
            </a>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="flex flex-wrap gap-4"
          >
            {BADGES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-white/60 text-sm">
                <Icon className="w-4 h-4 text-sand" />
                {text}
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.75 }}
        className="relative border-t border-white/10 bg-navy-mid/60 backdrop-blur-sm"
      >
        <div className="container-wide py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: '15+', label: 'Years Local Experience' },
            { value: '1,200+', label: 'OBX Projects' },
            { value: 'Dare & Currituck', label: 'Counties Served' },
            { value: '5★ Google', label: 'Customer Rating' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="font-display text-xl sm:text-2xl text-sand uppercase tracking-wide leading-none">
                {value}
              </p>
              <p className="text-white/50 text-xs mt-1 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-24 right-8 hidden md:flex flex-col items-center gap-2"
      >
        <span className="text-white/30 text-[10px] uppercase tracking-widest">Scroll</span>
        <ChevronDown className="w-4 h-4 text-white/30 animate-bounce" />
      </motion.div>
    </section>
  )
}
