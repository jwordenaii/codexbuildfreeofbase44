import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import SchemaMarkup, { LOCAL_BUSINESS_SCHEMA } from '../components/SchemaMarkup'
import SocialLinks from '../components/SocialLinks'
import SocialShare from '../components/SocialShare'

/**
 * All content in this file reflects the verified, real history of
 * J. Worden & Sons as told by owner Mr. Worden.
 * No fictional names, characters, or events are included.
 */

const TIMELINE = [
  {
    year: 'The Foundation',
    headline: 'A Lifetime in the Trades.',
    event:
      "Our founder — Mr. Worden's grandfather — spent more than 30 years running a roofing company before making the move to asphalt paving. By the time he picked up a paver, he already knew what it meant to work in the heat, meet a deadline, and stand behind a job. That foundation never left the company.",
  },
  {
    year: 'Est. 1984',
    headline: 'J. Worden & Sons Is Born.',
    event:
      'After three decades in roofing, the founder launched J. Worden & Sons Asphalt Paving. The work ethic was the same, the trade was different. The company built its reputation one job at a time — from Motels, Virginia all the way out to Virginia Beach — earning trust through quality work and zero shortcuts.',
  },
  {
    year: 'Virginia Coast Roots',
    headline: 'Motels, VA to Virginia Beach.',
    event:
      "The company became a highly respected name across the coastal Virginia corridor. Residential driveways, commercial lots, local businesses — the founder's reputation for doing the job right the first time spread entirely by word of mouth across the region.",
  },
  {
    year: 'Age 14',
    headline: 'Mr. Worden Joins His Grandfather.',
    event:
      'Mr. Worden started working alongside his grandfather at fourteen years old. Not watching — working. Learning to grade, to read a mat, to run a crew, to estimate a job. Everything he knows about paving, he learned hands-on from the man who built the company.',
  },
  {
    year: 'The Franchise Era Begins',
    headline: 'First KFC Contract — Virginia.',
    event:
      'The company lands its first KFC franchise paving contract in Virginia. The standard is different at the national franchise level — tight tolerances, brand-compliant documentation, zero margin for rework. Worden & Sons delivers, and the relationship grows.',
  },
  {
    year: 'National Expansion',
    headline: 'KFC: Virginia → NC → GA → FL → MI.',
    event:
      "Word spreads through the KFC franchise network. Contracts follow in North Carolina, Georgia, Florida, and Michigan. The Worden name becomes a known quantity in national QSR paving — a contractor that shows up, meets spec, and doesn't create problems for the operator.",
  },
  {
    year: 'New Build Program',
    headline: 'Selected for KFC New QSR Build Program.',
    event:
      "KFC selects Worden & Sons to assist with ground-up new store construction under a national new build program. This is not maintenance or resurfacing — it's building new fast-food sites from the ground up, civil through finish. The program runs through the end of 2023.",
  },
  {
    year: '2015',
    headline: 'The Founder Passes.',
    event:
      "Mr. Worden's grandfather passes away in 2015. He built the company from nothing — from a roofing career into an asphalt legacy that reached from Virginia Beach to Michigan. The business he started, and the standard he held, live on in every job the company takes.",
  },
  {
    year: '2016',
    headline: 'Mr. Worden Takes Over.',
    event:
      'Mr. Worden takes over leadership of the company his grandfather built. He had been working in it for over twenty years at that point. The transition was not about changing the company — it was about carrying it forward. Same standards. Same name. Same promise.',
  },
  {
    year: 'Post-Pandemic Multi-State',
    headline: 'TX, KS, MI, MN, IA, MO, NY, NJ, NC, GA and Beyond.',
    event:
      'Since the pandemic the company has continued expanding its national footprint — Carolina, Minnesota, Michigan, Texas, Kansas, Kansas City, Iowa, Missouri, New York, New Jersey, North Carolina, Georgia, and others. New KFC store built ground-up in Texas. Store remodels across ten-plus states. Every project backed by verified photo documentation in Dropbox and Google Photos.',
  },
  {
    year: 'Recognized Nationally',
    headline: 'Pavement Magazine Top 75. Best of Houzz. 2026 Nominee.',
    event:
      "The work has been recognized nationally. Pavement Magazine Top 75 Contractors — in four separate categories. Best of Houzz, multiple years. And a nomination for the 2026 Pavement Magazine Top Contractor Award. These aren't self-reported — they're industry-verified recognitions of a track record built over decades.",
  },
  {
    year: 'Today',
    headline: 'Private Work. Next QSR Chapter.',
    event:
      "The company is active in private commercial paving and actively pursuing the next phase of QSR fast food builds and civil work. The documentation exists — photos, contracts, completed projects across more than ten states. The legacy is not marketing. It's the record.",
  },
]

const NOTABLE_PROJECTS = [
  {
    name: 'Virginia Beach Corridor — Early Era',
    year: '1984 – 2000s',
    type: 'Commercial / Residential',
    scope: 'Motels, VA to Virginia Beach',
    headline: 'Where the Reputation Was Built.',
    story:
      "The company's early years were defined by the coastal Virginia corridor — from Motels, VA to Virginia Beach. Commercial lots, residential driveways, local businesses. No advertising. The reputation spread by word of mouth from job sites where the work spoke for itself.",
    emoji: '🌊',
  },
  {
    name: 'KFC National Franchise Program — Virginia to Michigan',
    year: '2000s – 2016',
    type: 'QSR / Franchise',
    scope: 'VA, NC, GA, FL, MI',
    headline: 'Earning the National Trust.',
    story:
      'What started as a single KFC contract in Virginia grew into a multi-state franchise program spanning Virginia, North Carolina, Georgia, Florida, and Michigan. KFC franchise operators require precise documentation, brand-standard ADA compliance, and zero rework. Worden & Sons became the contractor operators specifically requested.',
    emoji: '🍗',
  },
  {
    name: 'KFC New QSR Build Program',
    year: '2016 – 2023',
    type: 'QSR / New Construction',
    scope: 'Multi-state new store builds',
    headline: 'Ground-Up. Start to Finish.',
    story:
      'Selected by KFC to assist with ground-up new store construction under their national new build program. Not maintenance — new site builds, civil through finish. The program ran from around 2016 through end of 2023. Every project documented with verified photos and records.',
    emoji: '🏗',
  },
  {
    name: 'New KFC Build — Texas',
    year: '2020s',
    type: 'QSR / New Construction',
    scope: 'Texas',
    headline: 'New Build. New State. Same Standard.',
    story:
      "A ground-up KFC new store construction in Texas — one of several projects the company completed in the state post-pandemic. Site work, paving, and civil scope handled start to finish. Part of the company's expanded national QSR footprint that now includes Texas and extends across the South and Midwest.",
    emoji: '🤠',
  },
  {
    name: 'Multi-State KFC Remodel Program',
    year: '2020s',
    type: 'QSR / Remodel',
    scope: 'TX, KS, Kansas City, MI, IA, MO, NY, NJ, NC, GA + others',
    headline: 'Ten States. One Standard.',
    story:
      'Store remodels across Texas, Kansas, Kansas City, Michigan, Iowa, Missouri, New York, New Jersey, North Carolina, Georgia, and others since the pandemic. Each project fully documented in Dropbox and Google Photos. The scale of this program is what earned the Pavement Magazine Top 75 recognition in four categories.',
    emoji: '🗺',
  },
]

const AWARDS = [
  {
    icon: '🏆',
    title: 'Pavement Magazine Top 75',
    detail:
      'Recognized in four separate contractor categories — one of the highest distinctions in the national paving industry.',
  },
  {
    icon: '⭐',
    title: 'Best of Houzz',
    detail:
      'Multiple years. Awarded by the Houzz community based on client reviews, service quality, and project documentation.',
  },
  {
    icon: '🎖',
    title: '2026 Top Contractor Nominee',
    detail:
      'Nominated for the 2026 Pavement Magazine Top Contractor Award — an industry-wide recognition of sustained excellence.',
  },
]

const VALUES = [
  {
    icon: '📞',
    title: 'Show Up',
    desc: "We answer the phone. We're on site when we say. Showing up — on time, prepared, and ready — is the baseline. We set it higher.",
  },
  {
    icon: '⚙️',
    title: 'Build It Right',
    desc: "Commercial-grade specs on every job. We don't cut base depth because no one will see it. The sub-grade is where the job is really won or lost.",
  },
  {
    icon: '🤝',
    title: 'Stand Behind It',
    desc: "If something isn't right, we fix it. No debate, no charge. Our name is on the work — and we protect it.",
  },
  {
    icon: '📋',
    title: 'Document Everything',
    desc: "Every major project is backed by photos and records. We have a Dropbox and a Google Photos archive that proves the work. That's not common in this industry. It should be.",
  },
]

export default function About() {
  return (
    <>
      <SchemaMarkup
        title="About J. Worden & Sons — Family-Owned Asphalt Paving Since 1984"
        description="The real story of J. Worden & Sons — founded by Mr. Worden's grandfather after 30 years in roofing. From Virginia Beach to KFC national builds across 10+ states. Pavement Magazine Top 75. Best of Houzz. 2026 Top Contractor Nominee."
        canonical="/about"
        schema={LOCAL_BUSINESS_SCHEMA}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ]}
      />

      {/* Header */}
      <div className="bg-brand-navy pt-32 pb-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <span className="inline-block bg-brand-amber/20 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
            Est. 1984 · Chester, Virginia · Family Owned
          </span>
          <h1 className="font-display font-black text-5xl md:text-6xl mb-4">
            Our <span className="text-brand-amber">Story</span>
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto">
            Started by a man who spent 30 years in roofing before picking up a paver. Built into a
            national QSR contractor by his grandson. No shortcuts in either generation.
          </p>
          <div className="mt-8 flex justify-center">
            <SocialShare
              path="/about"
              text="The real story of J. Worden & Sons — family-owned asphalt paving since 1984, now operating in 10+ states"
              compact
            />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <section className="py-10 bg-brand-amber">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { stat: '1984', label: 'Founded' },
              { stat: '10+', label: 'States Worked In' },
              { stat: '30+', label: 'Years KFC / QSR Work' },
              { stat: '4', label: 'Pavement Mag Top 75 Categories' },
            ].map(({ stat, label }) => (
              <div key={label}>
                <div className="font-display font-black text-brand-navy text-3xl">{stat}</div>
                <div className="text-brand-navy/60 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-2xl md:text-3xl font-display font-bold text-brand-navy leading-tight">
            &ldquo;My grandfather built this company after 30 years in roofing. I started working
            beside him at 14. Everything I know about this trade, I learned from him — and I run
            this company the same way he did.&rdquo;
          </p>
          <p className="mt-6 text-brand-navy/50 font-medium">— Mr. Worden, Owner</p>
        </div>
      </section>

      {/* Awards */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-heading text-center mb-10">Industry Recognition</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {AWARDS.map((award, i) => (
              <motion.div
                key={award.title}
                className="card p-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="text-4xl mb-3">{award.icon}</div>
                <h3 className="font-display font-bold text-brand-navy text-lg mb-2">
                  {award.title}
                </h3>
                <p className="text-brand-navy/60 text-sm leading-relaxed">{award.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-heading text-center mb-16">The Real History</h2>
          <div className="relative">
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-brand-amber/30" />
            <div className="space-y-12">
              {TIMELINE.map((item, i) => (
                <motion.div
                  key={item.year}
                  className={`relative flex gap-6 md:gap-0 ${
                    i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-amber border-4 border-white z-10" />
                  <div
                    className={`ml-14 md:ml-0 md:w-5/12 ${
                      i % 2 === 0 ? 'md:pr-10' : 'md:pl-10 md:ml-auto'
                    }`}
                  >
                    <div className="card p-5">
                      <div className="font-display font-black text-brand-amber text-lg mb-0.5">
                        {item.year}
                      </div>
                      <div className="font-bold text-brand-navy text-sm mb-2">{item.headline}</div>
                      <p className="text-brand-navy/70 text-sm leading-relaxed">{item.event}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Notable Projects */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="section-heading mb-4">Projects That Tell the Story</h2>
            <p className="text-brand-navy/60 max-w-xl mx-auto">
              Verified work. Real projects. The documentation exists — photos, records, completed
              jobs across more than ten states.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {NOTABLE_PROJECTS.map((p, i) => (
              <motion.div
                key={p.name}
                className="card p-6"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl flex-shrink-0">{p.emoji}</div>
                  <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-brand-amber">
                        {p.year}
                      </span>
                      <span className="text-xs text-brand-navy/30">·</span>
                      <span className="text-xs text-brand-navy/50">{p.type}</span>
                      <span className="text-xs text-brand-navy/30">·</span>
                      <span className="text-xs text-brand-navy/50">{p.scope}</span>
                    </div>
                    <h3 className="font-display font-bold text-lg text-brand-navy mb-1">
                      {p.name}
                    </h3>
                    <p className="text-brand-amber font-semibold text-sm mb-2">{p.headline}</p>
                    <p className="text-brand-navy/70 text-sm leading-relaxed">{p.story}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/projects" className="btn-primary">
              View Full Project Portfolio →
            </Link>
          </div>
        </div>
      </section>

      {/* The Owner */}
      <section className="py-20 bg-brand-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-black text-4xl text-center mb-12">
            The <span className="text-brand-amber">People</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Founder tribute */}
            <motion.div
              className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-20 h-20 rounded-full bg-brand-amber/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👴</span>
              </div>
              <h3 className="font-display font-bold text-xl text-brand-amber">The Founder</h3>
              <p className="text-white/50 text-sm mt-1">Est. 1984 · In Memoriam</p>
              <p className="text-white/70 text-sm mt-4 leading-relaxed">
                Spent 30 years in roofing before founding J. Worden & Sons. Built the company&apos;s
                reputation from Virginia Beach to Chester by doing the work right, every time.
                Passed away in 2015. The standard he set has never been lowered.
              </p>
            </motion.div>

            {/* Mr. Worden */}
            <motion.div
              className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="w-20 h-20 rounded-full bg-brand-amber/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👷</span>
              </div>
              <h3 className="font-display font-bold text-xl text-brand-amber">Mr. Worden</h3>
              <p className="text-white/50 text-sm mt-1">Owner · Since 2016</p>
              <p className="text-white/70 text-sm mt-4 leading-relaxed">
                Started working alongside his grandfather at age 14. Took over the company in 2016.
                Has led KFC franchise paving programs across Virginia, NC, GA, FL, MI, TX, and more
                — including ground-up new store builds and multi-state remodel programs. Pavement
                Magazine Top 75 recognized. Still on job sites.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-heading text-center mb-12">How We Work</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((v, i) => (
              <motion.div
                key={v.title}
                className="bg-brand-navy/5 rounded-2xl p-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="text-4xl mb-3">{v.icon}</div>
                <h3 className="font-display font-bold text-brand-navy text-lg mb-2">{v.title}</h3>
                <p className="text-brand-navy/60 text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="py-16 bg-brand-navy text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-black text-3xl text-center mb-10">
            Licensed, Insured, &amp; <span className="text-brand-amber">Documented</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              ['🏛', 'State Licensed', 'Contractor'],
              ['🛡', 'General Liability', 'Insured'],
              ['👷', "Workers' Comp", 'Covered'],
              ['📸', 'Photo Verified', 'Every major job'],
            ].map(([icon, title, sub]) => (
              <div key={title} className="bg-white/5 rounded-xl p-5">
                <div className="text-3xl mb-2">{icon}</div>
                <div className="font-bold text-white">{title}</div>
                <div className="text-white/40 text-xs mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social follow */}
      <section className="py-14 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display font-black text-brand-navy text-2xl mb-3">Follow the Work</h2>
          <p className="text-brand-navy/60 mb-6">
            Before &amp; afters, job site updates, and real paving content across every platform.
          </p>
          <SocialLinks size="lg" variant="badge" className="justify-center" />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-amber text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-display font-black text-brand-navy text-3xl mb-4">
            Ready to work with us?
          </h2>
          <Link
            to="/quote"
            className="bg-brand-navy text-white font-bold px-8 py-4 rounded-lg hover:bg-brand-navy/90 transition-colors inline-block"
          >
            Request a Free Quote
          </Link>
        </div>
      </section>
    </>
  )
}
