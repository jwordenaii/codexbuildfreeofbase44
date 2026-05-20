import { CheckCircle2, Award, Users, Wrench, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import SEO from '@/components/SEO.jsx'
import CTABanner from '@/components/sections/CTABanner.jsx'
import TestimonialsSection from '@/components/sections/TestimonialsSection.jsx'
import { STATS } from '@/config/site.js'

const VALUES = [
  {
    icon: Award,
    title: 'Craftsman Standards',
    desc: 'We treat every driveway and parking lot like a signature project. No rushed crews, no cut corners on compaction or mix temperature.',
  },
  {
    icon: Users,
    title: 'Community Commitment',
    desc: 'We live and work on the Outer Banks. Our reputation is built here, maintained here, and our interest in getting it right is personal.',
  },
  {
    icon: Wrench,
    title: 'Technical Rigor',
      desc: "Coastal conditions demand technical discipline — we specify the right mixes, additives, and seal coats for each job's exposure profile.",
  },
  {
    icon: Heart,
    title: 'Straightforward Service',
    desc: 'No upselling. No vague scopes. We tell you what you need, explain why, price it fairly, and deliver what we promised.',
  },
]

const CREDENTIALS = [
  'NC General Contractor License',
  'General Liability Insurance — $2M coverage',
  'Workers Compensation Insurance',
  'NAPA Member — National Asphalt Pavement Association',
  'NC Dept. of Transportation Prequalified',
  'Dare County Business License',
  'Currituck County Business License',
]

export default function About() {
  return (
    <>
      <SEO
        title="About OBX Paving Co. | Outer Banks Asphalt Contractor"
        description="OBX Paving Co. is a licensed and insured asphalt paving and sealcoating contractor based in Kill Devil Hills, NC. Serving the Outer Banks for 15+ years."
        canonicalPath="/about"
      />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-gradient opacity-80" />
        <div className="absolute inset-0 bg-wave-pattern" />
        <div className="relative container-wide text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="section-label text-sand/80 mb-4 block">Our Story</span>
            <h1 className="font-display text-5xl md:text-7xl uppercase text-white tracking-tight mb-5">
              About Us
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Local, licensed, and built for the Outer Banks.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Our story */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="section-label mb-4 block">Who We Are</span>
              <h2 className="font-display text-4xl md:text-5xl uppercase text-navy tracking-tight mb-6">
                Outer Banks Paving Since Day One
              </h2>
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  OBX Paving Co. was founded in Kill Devil Hills with a simple mission:
                  provide the Outer Banks with a paving contractor that actually understands
                  the coastal environment — not one that uses the same materials and methods
                  as an inland contractor and wonders why the work deteriorates in two seasons.
                </p>
                <p>
                  Over 15 years and more than 1,200 projects, we've built our business
                  exclusively on the Outer Banks. Every formulation we use, every application
                  method we've refined, and every maintenance schedule we recommend has been
                  calibrated for salt air, ocean humidity, coastal UV exposure, and the
                  sandy substrates that underlie much of our service area.
                </p>
                <p>
                  We specialize in serving property managers, HOA boards, vacation rental
                  owners, and commercial property operators who need a contractor they can
                  actually rely on — one who shows up on schedule, communicates clearly,
                  and produces work that lasts.
                </p>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <div className="grid grid-cols-2 gap-5">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="card-base p-7 text-center hover:shadow-lg transition-shadow"
                  >
                    <p className="font-display text-3xl text-ocean uppercase tracking-wide mb-2">
                      {stat.value}
                    </p>
                    <p className="text-slate-500 text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-off-white">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="text-center mb-14"
          >
            <span className="section-label mb-3 block">What We Stand For</span>
            <h2 className="font-display text-4xl md:text-5xl uppercase text-navy tracking-tight">
              Our Values
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VALUES.map((v, idx) => {
              const Icon = v.icon
              return (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="card-base card-hover p-7 flex gap-5"
                >
                  <div className="w-12 h-12 rounded-xl bg-ocean/10 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-ocean" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl uppercase text-navy tracking-tight mb-2">
                      {v.title}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{v.desc}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <span className="section-label mb-4 block">Credentials</span>
              <h2 className="font-display text-4xl md:text-5xl uppercase text-navy tracking-tight mb-6">
                Licensed, Insured & Qualified
              </h2>
              <p className="text-slate-600 leading-relaxed mb-8">
                Every job we take is covered by full general liability and workers'
                compensation insurance. We maintain all required NC contractor licenses
                and stay current with state regulations.
              </p>
              <ul className="space-y-3">
                {CREDENTIALS.map((c) => (
                  <li key={c} className="flex items-center gap-3 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-teal shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="p-8 rounded-2xl bg-navy text-white"
            >
              <p className="font-display text-2xl uppercase tracking-wide mb-4">
                Work with a Contractor You Can Trust
              </p>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                We provide certificates of insurance on request. All proposals include
                written scope, material specs, and payment terms — before any work begins.
              </p>
              <Link to="/contact" className="btn-primary w-full justify-center py-3.5">
                Request a Free Proposal
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <TestimonialsSection />
      <CTABanner />
    </>
  )
}
