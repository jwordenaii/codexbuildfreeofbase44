import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SchemaMarkup, {
  LOCAL_BUSINESS_SCHEMA,
  ORGANIZATION_SCHEMA,
  WEBSITE_SCHEMA,
  faqSchema,
} from '../components/SchemaMarkup'
import { trackEvent } from '../api/client'
import CountUp from '../components/CountUp'
import FAQAccordion from '../components/FAQAccordion'
import SocialLinks from '../components/SocialLinks'
import EstimateWidget from '../components/EstimateWidget'
import InspirationGallery from '../components/InspirationGallery'


const SERVICES = [
  {
    icon: '🛣',
    title: 'Asphalt Paving',
    desc: 'New construction and overlay paving for driveways, roads, and commercial lots. Built to last 20+ years.',
    href: '/services#paving',
  },
  {
    icon: '🖤',
    title: 'Sealcoating',
    desc: 'Protective coal-tar or asphalt-based sealcoat that doubles the life of your pavement.',
    href: '/services#sealcoating',
  },
  {
    icon: '🔧',
    title: 'Crack Filling',
    desc: 'Hot-pour rubberized crack fill stops water intrusion before it becomes costly base damage.',
    href: '/services#crackfill',
  },
  {
    icon: '🏢',
    title: 'Parking Lots',
    desc: 'Full-service commercial parking lot construction, ADA compliance, and line striping.',
    href: '/services#parking',
  },
  {
    icon: '🏠',
    title: 'Driveways',
    desc: 'Residential driveway installation and replacement. Clean, fast, and priced fairly.',
    href: '/services#driveways',
  },
  {
    icon: '🔄',
    title: 'Maintenance Plans',
    desc: 'Annual maintenance programs for commercial properties — sealcoat, crack fill, and touch-up on a schedule.',
    href: '/services#maintenance',
  },
  {
    icon: '🏗',
    title: 'General Contracting',
    desc: 'Full GC services — permits, subcontractor management, budget control, and turnkey delivery for commercial and residential builds.',
    href: '/services#general-contracting',
  },
  {
    icon: '🎨',
    title: 'Interior Design',
    desc: 'Best of Houzz–recognized design team. Mood boards, 3D renders, FF&E procurement, and full project management.',
    href: '/services#interior-design',
  },
  {
    icon: '🪨',
    title: 'Cobblestone & Brick Paver Patios',
    desc: 'Timeless hardscapes — herringbone, fan pattern, and custom cobblestone or brick installations with engineered bases.',
    href: '/services#cobblestone-pavers',
  },
  {
    icon: '🧱',
    title: 'Stone Masonry',
    desc: 'Natural fieldstone walls, flagstone patios, stone steps, retaining walls, and outdoor fireplace surrounds.',
    href: '/services#stone-masonry',
  },
]

const ASPHALT_RANKING_CLUSTERS = [
  {
    title: 'Commercial Parking Lot Paving',
    keywords: 'parking lot paving, mill & overlay, ADA stalls, line striping',
    copy: 'For property managers, restaurants, retail centers, churches, schools, warehouses, and franchise operators that need durable traffic flow and clean curb appeal.',
    href: '/services#parking',
  },
  {
    title: 'Residential Driveway Paving',
    keywords: 'driveway paving, resurfacing, replacement, grading',
    copy: 'For Virginia homeowners comparing new asphalt, resurfacing, base repair, drainage correction, and long-term sealcoating schedules.',
    href: '/services#driveways',
  },
  {
    title: 'Asphalt Repair & Preventive Maintenance',
    keywords: 'asphalt repair, crack filling, sealcoating, pothole repair, preservation',
    copy: 'For owners who want preservation-first planning: stop water intrusion early, protect pavement from oxidation, and avoid full-depth replacement too soon.',
    href: '/services#maintenance',
  },
  {
    title: 'Pavement Preservation & Lifecycle Planning',
    keywords: 'pavement preservation, resurfacing, recycling, reconstruction',
    copy: 'For DOT-style, HOA, municipal, industrial, and commercial buyers who need the right fix at the right time: preserve, repair, overlay, recycle, or rebuild.',
    href: '/services#maintenance',
  },
  {
    title: 'Pavement Intelligence & Utility-Safe Production',
    keywords: '811, GPR, utility locating, pavement decay, thermal asphalt checks',
    copy: 'For commercial buyers who want premium planning: 811 response checks, GPR/EM locating, pavement age-decay review, drainage risk, and asphalt temperature logic.',
    href: '/services',
  },
]

const LOCAL_SEO_SIGNALS = [
  'Richmond, Chester, Chesterfield, Henrico, Midlothian, Glen Allen, Petersburg, Hopewell, Fredericksburg, Hampton Roads, and Virginia Beach pages',
  'Virginia-specific climate guidance for freeze/thaw, summer heat, coastal salt air, clay soils, drainage, and sealcoating cycles',
  'Preservation-first content that explains when to seal, crack fill, overlay, recycle, reconstruct, or fully replace pavement',
  'Commercial buyer language for property managers, QSR/franchise operators, retail centers, churches, HOAs, schools, and industrial lots',
  'Trust proof from 1984 roots, 4th-generation ownership, VA Class A GC licensing, national QSR work, and 4.9-star reputation',
]

const TRUST_BADGES = [
  { label: 'KFC', desc: 'National QSR vendor' },
  { label: 'Pavement Mag', desc: 'Top 75 · 4 categories' },
  { label: 'Best of Houzz', desc: 'Interior design award' },
  { label: '2026 Nominee', desc: 'Top Contractor Award' },
  { label: '12+ States', desc: 'Verified QSR work' },
  { label: 'Est. 1984', desc: 'Family owned' },
  { label: 'VA Class A GC', desc: 'Licensed & Insured' },
  { label: 'Stone Masonry', desc: 'Patio · Wall · Fireplace' },
]

const HOME_FAQS = [
  {
    question: 'How long does a new asphalt driveway last?',
    answer:
      'A properly installed and maintained asphalt driveway lasts 20–30 years. Regular sealcoating every 3–5 years significantly extends lifespan.',
  },
  {
    question: 'How soon can we use the driveway after paving?',
    answer:
      'You can walk on new asphalt after 24 hours and drive on it after 48–72 hours. Full cure takes about 6 months.',
  },
  {
    question: 'Do you offer free estimates?',
    answer:
      'Yes. All quotes are free and come with a detailed breakdown. Fill out our quote form or call us directly.',
  },
  {
    question: 'What makes J. Worden & Sons different from other paving companies in Virginia?',
    answer:
      'We combine 4th-generation paving experience with commercial-grade planning: drainage review, base prep, 811/utility awareness, asphalt temperature checks, pavement lifecycle thinking, and documented maintenance recommendations.',
  },
  {
    question: 'Do you work with commercial property managers and franchise operators?',
    answer:
      'Yes. We handle commercial parking lots, QSR/franchise projects, retail centers, churches, HOAs, schools, maintenance programs, ADA layout, line striping, sealcoating, crack filling, and mill-and-overlay work across Virginia and other served states.',
  },
  {
    question: 'Are you licensed and insured?',
    answer:
      "Yes. J. Worden & Sons is fully licensed as a VA Class A General Contractor and carries general liability and workers' compensation insurance.",
  },
  {
    question: 'Do you do interior design as well as construction?',
    answer:
      'Yes — our Best of Houzz–recognized interior design team handles everything from mood boards and material selection to full FF&E procurement and install coordination. We are a true one-stop shop from the foundation up to the finishing touches.',
  },
  {
    question: 'What outdoor hardscape options do you offer?',
    answer:
      'We install cobblestone and brick paver patios, natural stone masonry walls, flagstone paths, stone steps, retaining walls, and outdoor fireplace surrounds. Every hardscape project starts with a properly engineered base for lasting stability.',
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08 },
  }),
}

export default function Home() {
  return (
    <>
      <SchemaMarkup
        title="4th-Generation Asphalt Paving Since 1984"
        description="J. Worden & Sons — trusted asphalt paving, sealcoating, crack filling, and parking lot construction. Serving residential and commercial clients since 1984. Free estimates."
        canonical="/"
        schema={[ORGANIZATION_SCHEMA, WEBSITE_SCHEMA, LOCAL_BUSINESS_SCHEMA, faqSchema(HOME_FAQS)]}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center bg-brand-navy overflow-hidden pt-16">
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #f5a623 0, #f5a623 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <span className="inline-block bg-brand-amber/20 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
              Est. 1984 · 4th Generation · Family Owned
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-black text-white text-5xl md:text-7xl leading-tight mb-6"
            initial="hidden"
            animate="visible"
            custom={1}
            variants={fadeUp}
          >
            Built on Every
            <br />
            <span className="text-brand-amber">Road We&apos;ve Paved.</span>
          </motion.h1>

          <motion.p
            className="text-white/70 text-xl max-w-2xl mx-auto mb-10"
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
          >
            J. Worden &amp; Sons has been building and beautifying properties for four generations.
            Trusted by KFC, Arby&apos;s, Taco Bell, and hundreds of homeowners — asphalt paving,
            stone masonry, cobblestone patios, interior design, and full GC services. We show up, we
            do it right, and we stand behind every job.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
          >
            <Link
              to="/quote"
              className="btn-primary text-lg px-8 py-4"
              onClick={() => trackEvent('cta_click', { location: 'hero_primary' })}
            >
              Get a Free Quote
            </Link>
            <a
              href="tel:+18044461296"
              className="btn-outline text-lg px-8 py-4"
              onClick={() => trackEvent('phone_click', { location: 'hero' })}
            >
              📞 Call Us Today
            </a>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-xs flex flex-col items-center gap-1 animate-bounce">
          <span>Scroll</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── Trust badges ──────────────────────────────────────────────── */}
      <section className="bg-brand-charcoal py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {TRUST_BADGES.map(({ label, desc }) => (
              <div key={label} className="text-center">
                <div className="font-display font-black text-brand-amber text-xl">{label}</div>
                <div className="text-white/40 text-xs mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services overview ─────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Asphalt-first service depth
            </span>
            <h2 className="section-heading mb-4 mt-2">Virginia Asphalt Paving Services</h2>
            <p className="text-brand-navy/60 max-w-xl mx-auto">
              The highest-ranking paving sites win by answering every buying intent clearly. We make
              asphalt paving, parking lots, driveways, sealcoating, crack filling, repair,
              maintenance, and utility-safe planning easy to compare in one place.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((svc, i) => (
              <motion.a
                key={svc.title}
                href={svc.href}
                className="card p-6 group cursor-pointer hover:border-brand-amber border-2 border-transparent"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <div className="text-4xl mb-4">{svc.icon}</div>
                <h3 className="font-display font-bold text-lg mb-2 group-hover:text-brand-amber transition-colors">
                  {svc.title}
                </h3>
                <p className="text-brand-navy/60 text-sm leading-relaxed">{svc.desc}</p>
              </motion.a>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/services" className="btn-primary">
              View All Services
            </Link>
          </div>
        </div>
      </section>

      {/* ── Search-intent asphalt clusters ─────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
            <div>
              <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
                Built for how customers search
              </span>
              <h2 className="section-heading mt-2 mb-4">More Than “Paving Near Me”</h2>
              <p className="text-brand-navy/70 leading-relaxed mb-6">
                Property owners compare contractors by service clarity, local proof, pricing
                guidance, reviews, photos, and confidence that the crew can handle drainage, base
                failure, traffic, 811 utility issues, and long-term maintenance. These are the
                signals we now surface across the site.
              </p>
              <Link to="/service-areas" className="btn-primary">
                Compare Our Virginia Service Areas
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {ASPHALT_RANKING_CLUSTERS.map((cluster) => (
                <Link
                  key={cluster.title}
                  to={cluster.href}
                  className="card p-5 border-2 border-transparent hover:border-brand-amber group"
                >
                  <h3 className="font-display font-bold text-brand-navy group-hover:text-brand-amber">
                    {cluster.title}
                  </h3>
                  <p className="text-xs text-brand-amber font-semibold mt-2">{cluster.keywords}</p>
                  <p className="text-sm text-brand-navy/60 leading-relaxed mt-3">{cluster.copy}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Project Inspiration Gallery (Houzz-style) ─────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Project Inspiration
            </span>
            <h2 className="section-heading mt-2 mb-4">Browse by Style &amp; Service</h2>
            <p className="text-brand-navy/60 max-w-xl mx-auto">
              From Houzz-award–winning interior spaces to hand-laid cobblestone courtyards and
              natural stone masonry — explore the range of work we deliver.
            </p>
          </div>
          <InspirationGallery maxItems={8} />
        </div>
      </section>

      {/* ── Industry Authority: Legacy + Innovation ─────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section header */}
          <div className="text-center mb-16">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Asphalt &amp; construction industry trends
            </span>
            <h2 className="section-heading mt-2 mb-4">
              The State of Asphalt &amp; Construction: How J Worden &amp; Sons Leads with Legacy + Innovation
            </h2>
            <p className="text-brand-navy/60 max-w-3xl mx-auto text-lg leading-relaxed">
              <strong className="text-brand-navy">40+ Years of Tradition. Embracing Tomorrow&apos;s Technology.</strong>
            </p>
            <p className="text-brand-navy/60 max-w-3xl mx-auto mt-4 leading-relaxed">
              The asphalt and construction industry is undergoing a fundamental transformation. New tools — drones, ground-penetrating radar, thermal imaging, and modern field measurement — are reshaping how contractors plan, execute, and maintain projects, raising the bar for every serious operator. J Worden &amp; Sons has spent 40+ years building trust through quality work and deep Virginia roots. We&apos;re not stopping innovation now.
            </p>
          </div>

          {/* 4 subsections */}
          <div className="space-y-12">

            {/* 1 — The Industry Challenge */}
            <div className="rounded-3xl bg-gray-50 border border-gray-100 p-8 md:p-10 grid md:grid-cols-[auto_1fr] gap-6 items-start">
              <div className="text-5xl leading-none">🏗️</div>
              <div>
                <h3 className="font-display font-black text-brand-navy text-2xl mb-4">
                  The Industry Challenge: Pavement Failure is Expensive
                </h3>
                <p className="text-brand-navy/70 leading-relaxed mb-4">
                  Most pavement fails not because of poor materials, but because of poor planning. Freeze-thaw cycles crack and heave asphalt from below. Water intrusion through unsealed cracks destroys the base layer — the most expensive part of any pavement system to repair. Inadequate base preparation and underestimated traffic loads compound the problem, turning a 25-year pavement into a 10-year liability.
                </p>
                <p className="text-brand-navy/70 leading-relaxed mb-4">
                  Virginia&apos;s climate is particularly unforgiving: clay soils shift with moisture, coastal salt air accelerates oxidation, and summer heat softens asphalt that wasn&apos;t mixed or compacted correctly. These aren&apos;t edge cases — they&apos;re the everyday reality of modern pavement management in this region.
                </p>
                <p className="text-brand-amber font-semibold">
                  That&apos;s why we invest in planning before we pour.
                </p>
              </div>
            </div>

            {/* 2 — Modern Field Tools (JWORDENAI™ teaser) */}
            <div className="rounded-3xl bg-brand-navy p-8 md:p-10 grid md:grid-cols-[auto_1fr] gap-6 items-start">
              <div className="text-5xl leading-none">🛰️</div>
              <div>
                <h3 className="font-display font-black text-white text-2xl mb-4">
                  Modern Field Tools: Drones, GPR, and Thermal Imaging
                </h3>
                <p className="text-white/70 leading-relaxed mb-4">
                  A new generation of field equipment is changing how serious contractors assess, plan, and execute. Drone imagery replaces slow manual site surveys with precise aerial mapping — catching drainage problems, grade issues, and access constraints before a single machine rolls on site. Ground-penetrating radar (GPR) and electromagnetic locating eliminate the guesswork around buried utilities, protecting your property and our crews.
                </p>
                <p className="text-white/70 leading-relaxed mb-4">
                  Thermal imaging cameras verify asphalt temperature during placement — the difference between a mat that bonds correctly and one that fails in year three. We invest in this equipment because it produces measurably better results in the field.
                </p>
                <div className="rounded-2xl border border-brand-amber/30 bg-white/5 p-5 mt-6">
                  <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
                    Proprietary platform
                  </span>
                  <h4 className="font-display font-black text-white text-xl mt-2 mb-2">
                    Powered behind the scenes by JWORDENAI<span className="align-super text-sm">™</span>
                  </h4>
                  <p className="text-white/60 text-sm leading-relaxed mb-4">
                    Our proprietary advisory, automation, and predictive-maintenance platform is in active development and reserved for qualified operators and partners. The public site shows what we deliver in the field — the platform itself stays under the hood.
                  </p>
                  <Link
                    to="/jwordenai"
                    className="inline-flex items-center gap-2 text-brand-amber font-semibold text-sm hover:underline"
                  >
                    See JWORDENAI<span className="align-super text-xs">™</span> capabilities &amp; roadmap →
                  </Link>
                </div>
              </div>
            </div>

            {/* 3 — Sustainability Shift */}
            <div className="rounded-3xl bg-gray-50 border border-gray-100 p-8 md:p-10 grid md:grid-cols-[auto_1fr] gap-6 items-start">
              <div className="text-5xl leading-none">🌱</div>
              <div>
                <h3 className="font-display font-black text-brand-navy text-2xl mb-4">
                  The Sustainability Shift: Recycling, Preservation, and Lifecycle Thinking
                </h3>
                <p className="text-brand-navy/70 leading-relaxed mb-4">
                  The sustainable asphalt recycling movement is reshaping how the industry thinks about cost and waste. Reclaimed asphalt pavement (RAP) — milled from old surfaces and reprocessed into new mix — reduces landfill waste and lowers material costs without sacrificing performance. Modern preservation-first maintenance strategies extend pavement life by 10–15 years through timely sealcoating, crack filling, and micro-surfacing, deferring the far more expensive full-depth reconstruction.
                </p>
                <p className="text-brand-navy/70 leading-relaxed mb-4">
                  Lifecycle costing is the framework that ties it all together: instead of comparing only upfront bids, sophisticated property owners and managers now evaluate the true 20-year cost of ownership — factoring in maintenance intervals, failure risk, and replacement timing. This is how DOT agencies, HOAs, and commercial property managers are making smarter pavement decisions across Virginia and beyond.
                </p>
                <p className="text-brand-amber font-semibold">
                  We&apos;ve been preservation-first for decades. Now the whole industry is catching up.
                </p>
              </div>
            </div>

            {/* 4 — J Worden & Sons Difference */}
            <div className="rounded-3xl bg-brand-amber p-8 md:p-10 grid md:grid-cols-[auto_1fr] gap-6 items-start">
              <div className="text-5xl leading-none">🏆</div>
              <div>
                <h3 className="font-display font-black text-brand-navy text-2xl mb-4">
                  The J Worden &amp; Sons Difference: Legacy Meets Innovation
                </h3>
                <p className="text-brand-navy/80 leading-relaxed mb-4">
                  We&apos;re not a startup chasing trends. We&apos;re a 40-year-old legacy construction company in Virginia that earned trust through quality work, honest pricing, and showing up when we say we will. That foundation is what makes our investment in new technology meaningful — we&apos;re not adopting tools to look modern, we&apos;re adopting them because they produce better outcomes for our clients.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mb-6">
                  {[
                    ['Est. 1984', '4th-generation family ownership'],
                    ['VA Class A GC', 'Meets Virginia\'s highest licensing standard'],
                    ['KFC · Arby\'s · Taco Bell', 'National QSR franchise experience'],
                    ['4.9★ · 87+ Reviews', 'Verified Google reputation'],
                    ['Drones · GPR · Thermal', 'Cutting-edge field equipment'],
                    ['Preservation-first', 'Lifecycle planning on every project'],
                  ].map(([bold, detail]) => (
                    <div key={bold} className="flex items-start gap-3 bg-white/40 rounded-xl p-3">
                      <span className="w-5 h-5 rounded-full bg-brand-navy flex-shrink-0 flex items-center justify-center text-white font-bold text-xs mt-0.5">
                        ✓
                      </span>
                      <span className="text-brand-navy/90 text-sm">
                        <strong className="text-brand-navy">{bold}</strong> — {detail}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-brand-navy font-semibold">
                  We honor our legacy by embracing the future. That&apos;s how we deliver pavement that lasts.
                </p>
              </div>
            </div>

          </div>

          {/* Closing CTA */}
          <div className="mt-16 text-center">
            <p className="text-brand-navy/70 text-lg mb-6 max-w-2xl mx-auto">
              Ready to work with an innovative paving contractor who combines 40 years of experience with tomorrow&apos;s technology?
            </p>
            <Link
              to="/quote"
              className="btn-primary text-lg px-8 py-4"
              onClick={() => trackEvent('cta_click', { location: 'industry_authority_section' })}
            >
              Get a Free Quote
            </Link>
          </div>

        </div>
      </section>

      {/* ── Why choose us ─────────────────────────────────────────────── */}
      <section className="py-20 bg-brand-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display font-black text-4xl mb-6">
                Why Four Generations Have
                <span className="text-brand-amber block">Trusted the J Worden &amp; Sons Name</span>
              </h2>
              <ul className="space-y-4">
                {[
                  ['40+ years', 'of asphalt expertise in this region'],
                  ['Commercial-grade', 'equipment on every residential job'],
                  ['Transparent pricing', 'no hidden fees, ever'],
                  ['On-time guarantee', 'or we send daily updates'],
                  ['Fully insured', 'licensed and bonded'],
                ].map(([bold, rest]) => (
                  <li key={bold} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-amber flex-shrink-0 flex items-center justify-center text-brand-navy font-bold text-xs mt-0.5">
                      ✓
                    </span>
                    <span className="text-white/80">
                      <strong className="text-white">{bold}</strong> {rest}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/about" className="mt-8 btn-outline inline-flex">
                Our Story
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { end: 40, prefix: '', suffix: '+', decimals: 0, label: 'Years in business' },
                { end: 500, prefix: '', suffix: '+', decimals: 0, label: 'Projects completed' },
                { end: 4.9, prefix: '', suffix: '★', decimals: 1, label: 'Google rating' },
                { end: 100, prefix: '', suffix: '%', decimals: 0, label: 'Licensed & insured' },
              ].map(({ end, prefix, suffix, decimals, label }) => (
                <div
                  key={label}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"
                >
                  <div className="font-display font-black text-brand-amber text-3xl">
                    <CountUp end={end} prefix={prefix} suffix={suffix} decimals={decimals} />
                  </div>
                  <div className="text-white/60 text-sm mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Estimate Calculator ──────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
                Instant Ballpark
              </span>
              <h2 className="section-heading mt-2 mb-4">
                How Much Will My
                <span className="text-brand-amber block">Project Cost?</span>
              </h2>
              <p className="text-brand-navy/60 leading-relaxed mb-6">
                Use our quick calculator to get a ballpark estimate in seconds — 50-state pricing
                data, adjusted for your region. Then submit the quote form for a precise,
                no-obligation number from our team.
              </p>
              <ul className="space-y-3 text-sm text-brand-navy/70">
                {[
                  'Residential &amp; commercial pricing',
                  "Adjusted for your state's labor &amp; material costs",
                  'All major services covered',
                  'Free on-site estimate always included',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand-amber/20 flex items-center justify-center text-brand-amber font-bold text-xs">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <EstimateWidget />
          </div>
        </div>
      </section>

      {/* ── Service Areas strip ──────────────────────────────────────── */}
      <section className="py-16 bg-brand-charcoal text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
            <div>
              <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
                Where We Work
              </span>
              <h2 className="font-display font-black text-2xl mt-1">Serving 20+ Virginia Cities</h2>
            </div>
            <Link to="/service-areas" className="btn-outline text-sm flex-shrink-0">
              View All Service Areas →
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              'Chester',
              'Richmond',
              'Chesterfield',
              'Henrico',
              'Colonial Heights',
              'Petersburg',
              'Hopewell',
              'Midlothian',
              'Mechanicsville',
              'Glen Allen',
              'Ashland',
              'Powhatan',
              'Virginia Beach',
              'Norfolk',
              'Fredericksburg',
            ].map((city) => (
              <Link
                key={city}
                to={`/service-areas/${city.toLowerCase().replace(/\s+/g, '-')}-va`}
                className="bg-white/10 hover:bg-brand-amber hover:text-brand-navy text-white/80 text-sm px-4 py-2 rounded-full transition-all"
                onClick={() => trackEvent('city_pill_click', { city })}
              >
                📍 {city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Local authority signals ───────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
                Why our Virginia pages can outrank generic paving sites
              </span>
              <h2 className="section-heading mt-2 mb-4">
                Local Proof, Service Depth, and Premium Job Logic
              </h2>
              <p className="text-brand-navy/70 leading-relaxed">
                Search engines reward paving contractors that prove where they work, explain what
                they do, and answer the questions buyers ask before calling. Our content now
                connects local service areas, asphalt-specific services, commercial trust, pricing
                guidance, FAQs, and the Command Center&rsquo;s advanced scan logic into one stronger
                authority system.
              </p>
            </div>
            <div className="space-y-3">
              {LOCAL_SEO_SIGNALS.map((signal) => (
                <div key={signal} className="rounded-xl border border-brand-navy/10 p-4 flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-amber text-brand-navy font-bold text-xs flex items-center justify-center flex-shrink-0">
                    ✓
                  </span>
                  <p className="text-sm text-brand-navy/70 leading-relaxed">{signal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Award badges / trust strip ───────────────────────────────── */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-brand-navy/40 text-xs font-bold uppercase tracking-widest mb-8">
            Trusted By Industry Leaders &amp; National Franchise Programs
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 text-center">
            {[
              { emoji: '🍗', name: 'KFC', sub: '12+ states' },
              { emoji: '🥩', name: "Arby's", sub: 'Regional ops' },
              { emoji: '🌮', name: 'Taco Bell', sub: 'QSR program' },
              { emoji: '🏆', name: 'Pavement Mag', sub: 'Top 75 · 4 cats' },
              { emoji: '🏠', name: 'Best of Houzz', sub: 'Multi-year' },
              { emoji: '⭐', name: '2026 Nominee', sub: 'Top Contractor' },
            ].map(({ emoji, name, sub }) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <span className="text-3xl">{emoji}</span>
                <div className="font-display font-black text-brand-navy text-sm">{name}</div>
                <div className="text-brand-navy/40 text-xs">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Got Questions?
            </span>
            <h2 className="section-heading mt-2">Common Questions</h2>
          </div>
          <FAQAccordion items={HOME_FAQS} />
          <div className="text-center mt-10">
            <Link to="/contact" className="text-brand-amber font-semibold hover:underline text-sm">
              Have a different question? Contact us →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social Follow ─────────────────────────────────────────────── */}
      <section className="py-16 bg-brand-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
            Follow Along
          </span>
          <h2 className="font-display font-black text-3xl mt-2 mb-3">
            See the Work Before You Call
          </h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto">
            Before &amp; afters, crew in the field, and paving tips for homeowners and property
            managers — across every platform.
          </p>
          <SocialLinks size="lg" variant="badge" className="justify-center flex-wrap" />
          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-3 gap-6 max-w-sm mx-auto">
            {[
              { icon: '⭐', stat: '4.9', label: 'Google Rating' },
              { icon: '💬', stat: '87', label: 'Reviews' },
              { icon: '📍', stat: '40+', label: 'Years Local' },
            ].map(({ icon, stat, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="font-display font-black text-brand-amber text-xl">{stat}</div>
                <div className="text-white/40 text-xs">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────── */}
      <section className="py-16 bg-brand-amber">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display font-black text-brand-navy text-4xl mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-brand-navy/70 mb-8 text-lg">
            Free estimates. Fast turnaround. Quality that lasts 20+ years.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/quote"
              className="bg-brand-navy text-white font-bold px-8 py-4 rounded-lg hover:bg-brand-navy/90 transition-colors text-lg"
              onClick={() => trackEvent('cta_click', { location: 'home_bottom_banner' })}
            >
              Request a Free Quote
            </Link>
            <a
              href="tel:+18044461296"
              className="border-2 border-brand-navy text-brand-navy font-bold px-8 py-4 rounded-lg hover:bg-brand-navy hover:text-white transition-colors text-lg"
              onClick={() => trackEvent('phone_click', { location: 'home_bottom_banner' })}
            >
              📞 (804) 446-1296
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
