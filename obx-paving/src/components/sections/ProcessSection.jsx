import { motion } from 'framer-motion'
import { PROCESS_STEPS } from '@/config/site.js'
import { ArrowRight } from 'lucide-react'

export default function ProcessSection() {
  return (
    <section className="section-padding bg-white">
      <div className="container-wide">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <span className="section-label mb-3 block">How It Works</span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase text-navy tracking-tight">
            Our Process
          </h2>
          <p className="text-slate-500 mt-4 max-w-xl mx-auto">
            Clear, professional, and on your schedule — every project follows the same
            four-step process with no surprises.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {PROCESS_STEPS.map((step, idx) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="relative"
            >
              {/* Connector line on desktop */}
              {idx < PROCESS_STEPS.length - 1 && (
                <div className="hidden xl:block absolute top-10 left-[calc(100%-16px)] w-8 h-0.5 bg-gradient-to-r from-ocean/40 to-transparent z-10" />
              )}

              <div className="card-base p-7 h-full">
                {/* Step number */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="font-display text-4xl text-sand leading-none">{step.step}</span>
                  {idx < PROCESS_STEPS.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-slate-200 xl:hidden" />
                  )}
                </div>
                <h3 className="font-display text-xl uppercase text-navy tracking-tight mb-3">
                  {step.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
