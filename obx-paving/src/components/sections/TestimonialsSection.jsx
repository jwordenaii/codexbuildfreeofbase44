import { Star, Quote } from 'lucide-react'
import { motion } from 'framer-motion'
import { TESTIMONIALS } from '@/config/site.js'

function StarRating({ count = 5 }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(count)].map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-sand text-sand" />
      ))}
    </div>
  )
}

export default function TestimonialsSection() {
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
          <span className="section-label mb-3 block">Customer Reviews</span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl uppercase text-navy tracking-tight">
            What OBX Customers Say
          </h2>
          <div className="flex items-center justify-center gap-2 mt-4">
            <StarRating />
            <span className="text-slate-500 text-sm font-medium">5.0 · 100+ Google Reviews</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t, idx) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="card-base p-7 relative group hover:shadow-[0_12px_40px_-12px_rgba(22,102,168,0.18)] transition-shadow duration-300"
            >
              <Quote className="w-10 h-10 text-sand/30 absolute top-6 right-6 rotate-180" />
              <StarRating count={t.stars} />
              <p className="text-slate-600 leading-relaxed mt-4 mb-6 relative z-10">
                "{t.text}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ocean/10 flex items-center justify-center font-display text-ocean text-lg">
                  {t.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-navy text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs">{t.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Google badge */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-10"
        >
          <p className="text-slate-400 text-sm">
            All reviews are verified Google reviews from real customers in the Outer Banks area.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
