import React from 'react'
import { Link } from 'react-router-dom'
import { BadgeDollarSign, Building2, CalendarClock, Camera, CheckCircle2, ClipboardCheck, Hammer, Home, Layers3, Palette, Phone, ScanLine, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import SmartImage from '@/components/SmartImage'
import { trackPhoneClick } from '@/lib/analytics'
import { SITE_IMAGES } from '@/lib/siteImages'

const GC_SERVICES = [
  'Photo and damage-intake packets for better owner decisions before major work',
  'Full permit acquisition and municipal coordination',
  'Bid package development and subcontractor management',
  'Milestone scheduling with weekly owner updates',
  'Budget controls and change-order tracking',
  'Site safety compliance and quality control checkpoints',
  'Final turnover, punch-list closeout, and documentation',
]

const GC_MARKETS = [
  'Commercial tenant improvements',
  'Ground-up franchise and QSR projects',
  'Industrial and logistics support builds',
  'Site-work coordinated paving and exterior scopes',
  'Roof, exterior, drainage, and visible building-damage triage',
  'Kitchen remodel, additions, patios, hardscapes, and interior design planning',
]

const DESIGN_INTELLIGENCE_ITEMS = [
  {
    title: '4D Kitchen Remodel Planning',
    body: 'Turn photos, measurements, room goals, cabinet ideas, counters, flooring, lighting, schedule, and budget into a staged kitchen remodel packet before trades are scheduled.',
    icon: Sparkles,
  },
  {
    title: 'Additions And Floor Plans',
    body: 'Use the floor-plan studio logic to sketch rooms, estimate square footage, test additions, compare layouts, and prepare a GC review packet with cost ranges and phasing notes.',
    icon: Layers3,
  },
  {
    title: 'Patios And Outdoor Living',
    body: 'Connect hardscape design, pavers, concrete, drainage, grading, steps, seating areas, and landscape transitions into one visual owner decision flow.',
    icon: Palette,
  },
  {
    title: '4D Schedule Preview',
    body: 'Show customers how the project unfolds over time: scan, design, permits, demo, rough-in, surfaces, finishes, inspection, punch list, and final handoff.',
    icon: CalendarClock,
  },
]

const SCAN_DECISION_ITEMS = [
  {
    title: 'Property Review Packets',
    body: 'Customers can request a focused review before committing to a full project. Photos, video, drone notes, measurements, visible damage, and owner concerns are organized into a readable scope discussion.',
    icon: BadgeDollarSign,
  },
  {
    title: 'Roof And Exterior Damage Triage',
    body: 'The same intake model can flag missing shingles, flashing concerns, soft decking risk, wall cracks, fascia rot, water intrusion, settlement clues, and drainage problems for professional review.',
    icon: Home,
  },
  {
    title: 'Better Scope Decisions',
    body: 'The goal is not to sell the biggest job. The review helps owners see what can wait, what needs repair now, what needs an engineer, and what belongs in a full GC scope.',
    icon: ScanLine,
  },
  {
    title: 'Professional Review Boundary',
    body: 'Photos and notes help organize the conversation, but final structural safety, roof condition, code, and repair decisions require a qualified contractor, roofer, inspector, or structural engineer.',
    icon: ShieldAlert,
  },
]

const PREMIUM_REVENUE_OFFERS = [
  {
    title: 'Paid Damage Scan',
    price: '$149-$349+',
    body: 'A focused customer-paid review for pavement, roof, exterior, drainage, or visible building concerns before a larger proposal is built.',
  },
  {
    title: '4D Design Packet',
    price: '$499-$1,500+',
    body: 'Kitchen, addition, patio, hardscape, or interior planning packet with photos, dimensions, concept direction, range, and phasing.',
  },
  {
    title: 'Commercial Site Assessment',
    price: '$750-$2,500+',
    body: 'Drone-recommended assessment for shopping centers, industrial lots, franchise sites, access phasing, pavement condition, and owner decision support.',
  },
  {
    title: 'Plan-To-Bid Readiness',
    price: '$350-$1,250+',
    body: 'A paid pre-bid review for plans, sketches, photos, permits, measurements, risks, and scope questions before a full construction number is released.',
  },
]

const GC_FAQS = [
  {
    q: 'What does your GC team handle from start to finish?',
    a: 'We handle permits, subcontractor coordination, schedules, budget tracking, quality control, and closeout so owners have one accountable point of contact.',
  },
  {
    q: 'Do you support paving projects that need full GC oversight?',
    a: 'Yes. We coordinate site-work, utilities, concrete, and paving-related trades under one delivery plan for smoother execution.',
  },
  {
    q: 'Can you manage active-site schedules for businesses that stay open?',
    a: 'Yes. We phase work around operating hours and maintain access planning so business operations can continue during construction.',
  },
  {
    q: 'Can a scan help before I pay for a full GC project?',
    a: 'Yes. A paid scan packet can organize photos, video, drone notes, visible damage, measurements, and owner priorities so you can make a smarter decision before approving a large scope.',
  },
  {
    q: 'Can this support roof or structural damage decisions?',
    a: 'It can support triage by collecting evidence and flagging risks, but final roof, structural, safety, and code decisions should be reviewed by a qualified roofer, inspector, contractor, or structural engineer.',
  },
  {
    q: 'Can this help with kitchen remodels, additions, patios, or interior design?',
    a: 'Yes. The same scan-and-design workflow can organize photos, measurements, room layouts, finish ideas, hardscape options, budget ranges, and 4D phasing so owners understand the project before committing to a full remodel or build.',
  },
]

export default function GeneralContracting() {
  const canonicalPath = '/general-contracting'
  const title = 'General Contracting Services in Virginia | J. Worden & Sons'
  const description =
    'Licensed general contracting for commercial, residential, remodel, interior, patio, and site-driven projects in Virginia, with paid scan packets and premium 4D design decision support.'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': 'https://www.jwordenasphaltpaving.com/general-contracting#service',
        name: 'General Contracting Services',
        provider: {
          '@type': 'LocalBusiness',
          name: 'J. Worden & Sons Paving LLC',
          url: 'https://www.jwordenasphaltpaving.com/',
          telephone: '+18044461296',
        },
        areaServed: {
          '@type': 'State',
          name: 'Virginia',
        },
        serviceType: [
          'General contracting',
          'Permit and compliance coordination',
          'Construction scheduling and subcontractor management',
          'Commercial project delivery',
          'Property photo review and damage triage packets',
          '4D kitchen remodel, addition, patio, hardscape, and interior design planning',
        ],
        url: 'https://www.jwordenasphaltpaving.com/general-contracting',
      },
      {
        '@type': 'FAQPage',
        mainEntity: GC_FAQS.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.jwordenasphaltpaving.com/' },
          { '@type': 'ListItem', position: 2, name: 'General Contracting', item: 'https://www.jwordenasphaltpaving.com/general-contracting' },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO title={title} description={description} canonicalPath={canonicalPath} jsonLd={jsonLd} />
      <Navbar />

      <section className="relative border-b border-border pt-32 pb-16 md:pb-20 overflow-hidden bg-black">
        <div className="absolute inset-0 opacity-55">
          <SmartImage
            src={SITE_IMAGES.concretePatio}
            alt="Concrete patio and exterior construction planning work"
            width={1800}
            height={1200}
            priority
            sizes="100vw"
            className="h-full w-full"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,10,0.95)_0%,rgba(5,7,10,0.82)_48%,rgba(5,7,10,0.42)_100%)]" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-4">General Contracting Division</p>
          <h1 className="font-display font-black text-white text-4xl md:text-6xl uppercase tracking-tight leading-[0.95] max-w-5xl">
            General Contracting Under One Accountable Team
          </h1>
          <p className="text-white/72 text-base md:text-lg mt-6 max-w-3xl leading-relaxed">
            From permit coordination to final closeout, we run construction delivery with clear scope,
            disciplined schedules, and single-source accountability for owners and operators.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <a
              href="tel:+18044461296"
              onClick={() => trackPhoneClick('gc_page_hero')}
              className="premium-cta inline-flex items-center gap-2 px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase text-primary-foreground"
            >
              <Phone className="w-4 h-4" />
              Call 804-446-1296
            </a>
            <Link
              to="/#quote"
              className="border border-primary/50 text-primary px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase hover:bg-primary/10 transition-colors"
            >
              Request GC Consultation
            </Link>
            <Link
              to="/quote"
              className="border border-border text-foreground px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase hover:bg-card transition-colors inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Request Design Review
            </Link>
          </div>
        </div>
      </section>

      {/* Houzz Credentials Strip */}
      <section className="py-8 bg-[#111] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <a
              href="https://www.houzz.com/professionals/paving-contractors/j-worden-sons-asphalt-paving-pfvwus-pf~48430947"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 group"
            >
              <span className="w-9 h-9 bg-[#4dbc15] flex items-center justify-center rounded font-black text-white text-xl">h</span>
              <div>
                <p className="font-display font-black text-white text-sm tracking-widest uppercase leading-tight group-hover:text-[#4dbc15] transition-colors">Houzz Pro Certified</p>
                <p className="text-white/50 text-xs mt-0.5">4.8 ★ · 12 Reviews · Recommended on Houzz · 500+ Ideabook Saves</p>
              </div>
            </a>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {['2023', '2016', '2015', '2014'].map(year => (
                <a
                  key={year}
                  href="https://www.houzz.com/professionals/paving-contractors/j-worden-sons-asphalt-paving-pfvwus-pf~48430947"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center border border-[#4dbc15]/40 hover:border-[#4dbc15] bg-black px-4 py-2 transition-colors group"
                >
                  <span className="text-[#4dbc15] font-black text-[10px] tracking-widest uppercase">Best of Houzz</span>
                  <span className="text-white font-display font-black text-xl leading-tight">{year}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Design Planning</p>
              <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">
                Houzz-Style Design Power, Built For Real Construction Decisions
              </h2>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed mt-5 max-w-3xl">
                Customers should not have to imagine the whole remodel from a flat proposal. We can support kitchen remodels, additions, patios, hardscapes, exterior upgrades, and interior design by turning photos, measurements, materials, floor plans, budgets, and schedule phases into a clear decision packet.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/quote"
                  className="bg-foreground text-background px-5 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase hover:bg-foreground/90 transition-colors inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Request Design Review
                </Link>
                <Link
                  to="/hardscapes"
                  className="border border-border text-foreground px-5 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase hover:bg-card transition-colors inline-flex items-center gap-2"
                >
                  <Layers3 className="w-4 h-4" />
                  Hardscape Design
                </Link>
                <Link
                  to="/hardscapes"
                  className="border border-primary/40 text-primary px-5 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase hover:bg-primary/10 transition-colors inline-flex items-center gap-2"
                >
                  <Hammer className="w-4 h-4" />
                  Patio & Hardscape Design
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DESIGN_INTELLIGENCE_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="border border-border bg-card p-5 shadow-sm">
                    <Icon className="w-5 h-5 text-primary mb-4" />
                    <h3 className="font-display font-black text-foreground text-xl uppercase tracking-tight leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.body}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Photo Review Decision Support</p>
              <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">
                Review The Property, Then Help Customers Make Better Decisions
              </h2>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed mt-5 max-w-3xl">
                A focused property review gives the GC division a clean front-end offer: organize the visible evidence, explain risk, and help the owner decide whether they need repair, maintenance, engineering review, roof work, drainage correction, or a full GC-managed scope.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/quote"
                  className="border border-primary/40 text-primary px-5 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase hover:bg-primary/10 transition-colors inline-flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Request Property Review
                </Link>
                <Link
                  to="/quote"
                  className="border border-border text-foreground px-5 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase hover:bg-background transition-colors inline-flex items-center gap-2"
                >
                  <ScanLine className="w-4 h-4" />
                  Send Project Details
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SCAN_DECISION_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="border border-border bg-background p-5">
                    <Icon className="w-5 h-5 text-primary mb-4" />
                    <h3 className="font-display font-black text-foreground text-xl uppercase tracking-tight leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.body}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8 max-w-4xl">
            <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Revenue-first service design</p>
            <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">
              Turn Knowledge Into Paid Assessment Products
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed mt-5 max-w-3xl">
              The public offer should not give away the operating system. It should sell decision clarity, collect better project evidence, and move qualified customers into paid review, design, drone, and GC planning paths.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {PREMIUM_REVENUE_OFFERS.map((offer) => (
              <article key={offer.title} className="border border-border bg-card p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display font-black text-foreground text-2xl uppercase tracking-tight leading-none">{offer.title}</h3>
                  <span className="rounded-lg bg-primary/10 px-3 py-1.5 font-display text-sm font-black text-primary whitespace-nowrap">{offer.price}</span>
                </div>
                <p className="mt-5 text-sm text-muted-foreground leading-relaxed">{offer.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-16 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight mb-4">
                Core GC Services
              </h2>
              <div className="space-y-3">
                {GC_SERVICES.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/90 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight mb-4">
                Where We Deliver Best
              </h2>
              <div className="space-y-3">
                {GC_MARKETS.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <ClipboardCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/90 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-6">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Structured communication, risk controls, and predictable execution
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Commercial Alignment</p>
          <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95] mb-6">
            Need Paving Plus Full Project Oversight?
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-3xl mb-8">
            Pair this GC division with our Richmond commercial paving team when your scope includes multiple trades,
            phased access, and strict scheduling requirements.
          </p>
          <Link
            to="/commercial/richmond-va"
            className="border border-primary/40 text-primary px-6 py-4 font-display font-bold text-xs tracking-[0.14em] uppercase hover:bg-primary/10 transition-colors inline-flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            View Commercial Paving Division
          </Link>
        </div>
      </section>

      <section className="py-14 md:py-18 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Common Questions</p>
          <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95] mb-8">
            General Contracting FAQ
          </h2>
          <div className="space-y-4">
            {GC_FAQS.map((item) => (
              <article key={item.q} className="border border-border bg-card p-5 md:p-6">
                <h3 className="font-display font-black text-foreground text-lg md:text-xl uppercase tracking-tight leading-tight">
                  {item.q}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="premium-panel rounded-2xl p-7 md:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Start Your Project</p>
              <h2 className="font-display font-black text-foreground text-3xl uppercase tracking-tight">Book A GC Planning Call</h2>
              <p className="text-muted-foreground text-sm md:text-base mt-3 max-w-2xl leading-relaxed">
                We will map permitting, timeline, major risks, and delivery strategy before construction begins.
              </p>
            </div>
            <a
              href="tel:+18044461296"
              onClick={() => trackPhoneClick('gc_page_footer_cta')}
              className="premium-cta inline-flex items-center gap-2 px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase text-primary-foreground"
            >
              <Building2 className="w-4 h-4" />
              Talk To GC Team
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
