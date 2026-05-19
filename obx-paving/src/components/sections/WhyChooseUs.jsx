import { Waves, MapPin, ShieldCheck, Calendar, FileText, Building2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { WHY_US } from '@/config/site.js'

const ICON_MAP = { Waves, MapPin, ShieldCheck, Calendar, FileText, Building2 }

const item = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function WhyChooseUs() {
  return (
    <section className="section-padding bg-navy relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-wave-pattern opacity-100" />
      <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full bg-ocean/10 blur-[120px]" />

      <div className="relative container-wide">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Left — headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="section-label text-sand/80 mb-4 block">Why Choose Us</span>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase text-white tracking-tight leading-tight mb-6">
              Built for the{' '}
              <span className="text-gradient-sand">Outer Banks</span>{' '}
              Environment
            </h2>
            <p className="text-white/60 text-lg leading-relaxed mb-8">
              The Outer Banks is not a standard paving market. Salt air corrosion,
              sandy substrates, coastal UV intensity, and seasonal access constraints
              demand a contractor who actually understands local conditions.
            </p>
            <div className="flex items-center gap-3 p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-12 h-12 rounded-full bg-sand/20 flex items-center justify-center shrink-0">
                <span className="font-display text-sand text-xl">15+</span>
              </div>
              <div>
                <p className="text-white font-semibold">Years of Coastal Experience</p>
                <p className="text-white/50 text-sm">Over 1,200 projects across Dare and Currituck Counties</p>
              </div>
            </div>
          </motion.div>

          {/* Right — feature grid */}
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
          >
            {WHY_US.map((item_) => {
              const Icon = ICON_MAP[item_.icon] || ShieldCheck
              return (
                <motion.div key={item_.title} variants={item} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-ocean/30 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-ocean/20 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-ocean-light" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{item_.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{item_.desc}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
