import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SchemaMarkup, { serviceSchema, faqSchema, howToSchema } from '../components/SchemaMarkup'
import FAQAccordion from '../components/FAQAccordion'
import InspirationGallery from '../components/InspirationGallery'

const SERVICES = [
  {
    id: 'paving',
    icon: '🛣',
    title: 'Asphalt Paving',
    tagline: 'New construction & overlay paving',
    priceRange: 'Starting around $3–$8 per sq ft depending on project size and base conditions',
    description:
      'Whether you need a brand-new asphalt surface or a milled-and-overlaid refresh, our crews use commercial-grade compaction equipment to deliver a smooth, durable result. We handle base preparation, grading, and drainage planning before the first ton of asphalt goes down.',
    features: [
      'Full-depth reclamation & base prep',
      'Hot-mix asphalt (HMA) installation',
      'Infrared repair of failed sections',
      'Sub-base drainage engineering',
      'ADA-compliant slopes & transitions',
    ],
    ideal: 'New driveways, subdivision roads, commercial parking lots',
  },
  {
    id: 'sealcoating',
    icon: '🖤',
    title: 'Sealcoating',
    tagline: 'Extend pavement life by 50%',
    priceRange: 'Starting around $0.15–$0.25 per sq ft for spray or squeegee application',
    description:
      'A quality sealcoat fills surface voids, blocks UV oxidation, repels fuel and oil spills, and gives your pavement that jet-black finish. We apply it by spray or squeegee depending on surface texture, and we let nothing move until it is fully cured.',
    features: [
      'Coal-tar & asphalt-based sealers',
      'Spray & squeegee application',
      'Crack-fill before sealing',
      'Traffic paint / line striping',
      'Recommended every 3–5 years',
    ],
    ideal: 'Existing driveways 2+ years old, commercial lots',
  },
  {
    id: 'crackfill',
    icon: '🔧',
    title: 'Crack Filling',
    tagline: 'Stop water before it destroys your base',
    priceRange: 'Starting around $0.50–$2.00 per linear foot of crack',
    description:
      'Water entering through cracks is the #1 cause of asphalt failure. Our hot-pour rubberized crack fill expands and contracts with temperature cycles, creating a waterproof seal that outlasts cold-pour products by years.',
    features: [
      'Hot-pour rubberized sealant',
      'Saw-cut & rout for wide cracks',
      'Blow-out & dry before fill',
      'Compatible with sealcoating same day',
    ],
    ideal: 'Any pavement showing cracks before sealing season',
  },
  {
    id: 'parking',
    icon: '🏢',
    title: 'Parking Lots',
    tagline: 'Commercial lots built to handle heavy traffic',
    priceRange: 'Starting around $3–$7 per sq ft; varies by lot size, drainage, and base depth',
    description:
      'Commercial parking lots demand thicker base depths, precise drainage grades, and line striping that meets code. We have completed lots for fast-food chains, retail centers, warehouses, and apartment complexes across the region.',
    features: [
      'Site grading & drainage design',
      'Heavy-duty 4" to 6" HMA sections',
      'ADA parking & curb ramps',
      'Thermoplastic line striping',
      'Wheel stops & signage',
      'Annual maintenance contracts',
    ],
    ideal: 'Commercial properties, HOAs, schools, churches',
  },
  {
    id: 'driveways',
    icon: '🏠',
    title: 'Residential Driveways',
    tagline: 'Curb appeal that lasts a generation',
    priceRange: 'Most residential driveways run $2,500–$8,000 depending on size and base conditions',
    description:
      'We remove your old driveway, prep the sub-base, and install a full-depth asphalt section sized for your soil conditions and vehicle load. Most residential driveways are completed in a single day.',
    features: [
      'Old driveway demo & haul-off',
      'Compacted stone base',
      '2"–3" HMA wearing course',
      'Edging & tie-in to apron',
      'Cleanup included',
    ],
    ideal: 'Residential homes, multi-unit rentals',
  },
  {
    id: 'maintenance',
    icon: '🔄',
    title: 'Maintenance Plans',
    tagline: 'One contract — zero pavement headaches',
    priceRange: 'Custom pricing based on lot square footage and services included',
    description:
      'Commercial property managers rely on our annual maintenance plans to keep lots looking sharp and code-compliant year after year. We schedule sealcoating, crack fill, and minor repairs on a rotating calendar.',
    features: [
      'Annual site inspection',
      'Priority scheduling',
      'Multi-year volume pricing',
      'Documentation for property records',
    ],
    ideal: 'Property managers, commercial landlords, HOAs',
  },
  {
    id: 'general-contracting',
    icon: '🏗',
    title: 'General Contracting',
    tagline: 'Full-service GC — turnkey builds from ground up',
    priceRange: 'Quoted per project scope; GC fee typically 15–20% of total construction cost',
    description:
      'As a licensed VA Class A General Contractor, we manage every phase of your construction project from permit pull to final punch-list. Our GC division coordinates all licensed subcontractors, enforces strict quality standards, maintains budget transparency, and delivers on schedule — so you never have to chase 12 different trades.',
    features: [
      'Full permit acquisition & code compliance',
      'Subcontractor bid, vetting & management',
      'Detailed project schedules with milestones',
      'Budget tracking & change-order management',
      'Owner-rep communication & weekly reports',
      'Final walk-through & warranty documentation',
      'Commercial & residential new construction',
      'Ground-up QSR/franchise build experience (KFC, Arby\'s, Taco Bell)',
    ],
    ideal: 'New commercial builds, QSR franchise construction, large residential additions, full renovations',
  },
  {
    id: 'interior-design',
    icon: '🎨',
    title: 'Interior Design & Decorating',
    tagline: 'Award-winning design — Best of Houzz recognized',
    priceRange: 'Design consultations from $150/hr; full-room packages from $2,500',
    description:
      'Our interior design team brings the precision and eye for detail that earned us Best of Houzz recognition. From mood-board concept to final installation, we create spaces that are beautiful, functional, and uniquely yours. We source premium materials, manage vendor coordination, and handle all procurement so your only job is to enjoy the reveal.',
    features: [
      'In-home design consultation & space planning',
      'Digital mood boards & 3D visualization renders',
      'Custom color palette & materials selection',
      'Furniture, fixture & finish (FF&E) procurement',
      'Flooring, cabinetry, countertop selection & install coordination',
      'Lighting design & smart-home integration planning',
      'Outdoor living room & covered patio design',
      'Full project management from concept to completion',
    ],
    ideal: 'Full home renovations, new construction interiors, commercial office & hospitality spaces, outdoor living areas',
  },
  {
    id: 'cobblestone-pavers',
    icon: '🪨',
    title: 'Cobblestone & Brick Paver Patios',
    tagline: 'Timeless hardscapes that elevate outdoor living',
    priceRange: 'Brick pavers from $15–$30 per sq ft installed; cobblestone from $25–$55 per sq ft',
    description:
      'Cobblestone and brick pavers transform outdoor spaces into showpiece living areas that last generations. Our masons design and install patios, walkways, pool decks, driveways, and courtyard features using premium natural stone and tumbled brick units. Every installation begins with a properly engineered base — the secret to pavers that never shift or settle.',
    features: [
      'Full base engineering: compacted aggregate + bedding sand',
      'Patterns: herringbone, running bond, basket weave, fan, custom',
      'Reclaimed cobblestone & hand-tumbled brick options',
      'Permeable paver systems for stormwater management',
      'Integrated border, soldier course & edge restraints',
      'Polymeric sand jointing for weed & insect resistance',
      'Sealing for stain protection & color enhancement',
      'Steps, retaining walls & fire pit surrounds to match',
    ],
    ideal: 'Residential patios, pool decks, garden walkways, driveways, commercial courtyard plazas',
  },
  {
    id: 'stone-masonry',
    icon: '🧱',
    title: 'Stone Masonry',
    tagline: 'Natural stone craftsmanship — built to outlast a lifetime',
    priceRange: 'Dry-stack walls from $30–$60 per sq ft; mortared stone from $40–$85 per sq ft',
    description:
      'Stone masonry is the highest expression of outdoor craftsmanship. Our skilled masons work with natural fieldstone, flagstone, limestone, bluestone, granite, and cultured stone to build structures of enduring beauty and structural integrity. From accent walls to full retaining systems, every stone is hand-selected and placed with purpose.',
    features: [
      'Natural fieldstone & flagstone walls',
      'Retaining walls — dry-stack & mortared',
      'Stone veneer on foundations, columns & fireplaces',
      'Flagstone patios, garden paths & stepping stones',
      'Stone steps, pilasters & gate piers',
      'Outdoor kitchen surrounds & built-in fire features',
      'Waterfall & water feature stone work',
      'Historic restoration & stone repair',
    ],
    ideal: 'Retaining walls, outdoor fireplaces, foundation veneers, estate-level landscape features, historic properties',
  },
]

const SERVICE_FAQS = [
  {
    question: 'How thick should a commercial parking lot asphalt be?',
    answer:
      'Commercial lots typically require 4"–6" of hot-mix asphalt over a compacted stone base of 6"–12". The exact spec depends on soil bearing capacity and anticipated traffic loads (cars vs. delivery trucks).',
  },
  {
    question: 'How long after paving can I sealcoat?',
    answer:
      'New asphalt should cure for at least 90 days — ideally one full summer season — before sealcoating. Applying too soon traps gases and can cause bubbling.',
  },
  {
    question: 'What is the difference between crack filling and crack sealing?',
    answer:
      'Crack filling uses hot-pour rubber compound to fill non-working cracks. Crack sealing (saw-cut & rout) is used for working cracks that move with temperature — it creates a wider channel for better sealant adhesion.',
  },
  {
    question: 'Do you handle ADA compliance for parking lots?',
    answer:
      'Yes. We install ADA-compliant handicapped stalls, access aisles, curb ramps, and signage to current ADAAG standards.',
  },
  {
    question: 'What does a General Contractor actually manage on my project?',
    answer:
      'As your GC, we handle everything: pulling all permits, hiring and scheduling licensed subcontractors, inspecting quality at every phase, managing the project budget, processing change orders, and delivering a complete punch-list sign-off. You deal with one point of contact — us — and we handle the rest.',
  },
  {
    question: 'How does your interior design process work?',
    answer:
      'We start with a consultation to understand your style, budget, and functional needs. From there our designers produce digital mood boards and material palettes for your approval. Once the design is locked, we manage all vendor sourcing, procurement, and installation coordination through to the final reveal.',
  },
  {
    question: 'How long do brick paver patios last compared to poured concrete?',
    answer:
      'A properly installed brick or cobblestone paver patio outlasts poured concrete by decades. Individual units can be lifted and replaced if they settle or crack — unlike concrete which requires full demolition. With a quality compacted base and polymeric sand joints, paver patios routinely last 25–50 years.',
  },
  {
    question: 'What types of stone do you use for masonry work?',
    answer:
      'We work with natural fieldstone, Pennsylvania bluestone, Virginia limestone, granite, slate, flagstone, and cultured stone veneers. Stone selection depends on the structural requirements, local availability, and your aesthetic goals. We are happy to source specialty stones for estate-level projects.',
  },
]

const SEALCOATING_HOW_TO = howToSchema(
  'How Sealcoating Is Applied',
  'Step-by-step process J. Worden & Sons uses to apply professional sealcoating to asphalt pavement.',
  [
    {
      name: 'Surface Inspection & Crack Filling',
      text: 'We inspect the entire asphalt surface for cracks, potholes, and damage. All cracks are filled with hot-pour rubberized sealant and allowed to cure before any sealer is applied.',
    },
    {
      name: 'Surface Cleaning',
      text: 'The pavement is blown clean with commercial air blowers and power-washed to remove oil spots, dirt, and debris. Oil stains are spot-treated with a primer to prevent bleed-through.',
    },
    {
      name: 'Edging & Masking',
      text: 'All curbs, sidewalks, and garage aprons are masked off with tape and paper to protect adjacent surfaces. Crews hand-cut the edges for a clean, professional line.',
    },
    {
      name: 'Sealer Application',
      text: 'Sealcoat is applied by commercial spray equipment or squeegee — the method is chosen based on surface texture and condition. Two coats are applied for maximum protection and uniform coverage.',
    },
    {
      name: 'Curing & Traffic Control',
      text: 'The sealed surface must cure for 24–48 hours depending on temperature and humidity. Cones and signs are placed to keep traffic off until the sealer has fully hardened.',
    },
  ]
)

export default function Services() {
  return (
    <>
      <SchemaMarkup
        title="Construction, Paving, Interior Design & Stone Masonry Services"
        description="Full-service General Contractor — asphalt paving, sealcoating, interior design, cobblestone & brick paver patios, and stone masonry. Best of Houzz recognized. Free estimates."
        canonical="/services"
        schema={[
          ...SERVICES.map((s) =>
            serviceSchema(s.title, s.description, `/services#${s.id}`, s.priceRange)
          ),
          faqSchema(SERVICE_FAQS),
          SEALCOATING_HOW_TO,
        ]}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Services', path: '/services' },
        ]}
      />

      {/* Page header */}
      <div className="bg-brand-navy pt-32 pb-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="font-display font-black text-5xl md:text-6xl mb-4">
            Our <span className="text-brand-amber">Services</span>
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto">
            Full-service General Contractor — asphalt paving, stone masonry, cobblestone patios, interior design, and ground-up construction.
          </p>
        </div>
      </div>

      {/* Service cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-24">
        {SERVICES.map((svc, i) => (
          <motion.section
            key={svc.id}
            id={svc.id}
            className={`grid md:grid-cols-2 gap-12 items-start ${
              i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''
            }`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {/* Content */}
            <div>
              <div className="text-5xl mb-4">{svc.icon}</div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-amber">
                {svc.tagline}
              </span>
              <h2 className="font-display font-black text-3xl md:text-4xl text-brand-navy mt-2 mb-4">
                {svc.title}
              </h2>
              <p className="text-brand-navy/70 leading-relaxed mb-6">{svc.description}</p>
              <ul className="space-y-2 mb-8">
                {svc.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-brand-navy/80">
                    <span className="text-brand-amber mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-brand-navy/40 mb-6">
                <strong>Best for:</strong> {svc.ideal}
              </p>
              <Link to="/quote" className="btn-primary">
                Get a Quote for {svc.title}
              </Link>
            </div>

            {/* Visual placeholder */}
            <div className="bg-brand-navy/5 rounded-2xl aspect-video flex items-center justify-center border-2 border-dashed border-brand-navy/20">
              <div className="text-center text-brand-navy/30">
                <div className="text-6xl mb-2">{svc.icon}</div>
                <p className="text-sm">Photo coming soon</p>
              </div>
            </div>
          </motion.section>
        ))}
      </div>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-heading text-center mb-12">Service FAQs</h2>
          <FAQAccordion items={SERVICE_FAQS} />
        </div>
      </section>

      {/* Project Inspiration Gallery */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
              Project Inspiration
            </span>
            <h2 className="section-heading mt-2 mb-4">
              Browse Our Work by Style &amp; Category
            </h2>
            <p className="text-brand-navy/60 max-w-xl mx-auto">
              Filter by interior design, outdoor living, stone masonry, or construction
              projects to find inspiration for your next build.
            </p>
          </div>
          <InspirationGallery />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-amber text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-display font-black text-brand-navy text-3xl mb-4">
            Not sure which service you need?
          </h2>
          <p className="text-brand-navy/70 mb-6">
            Tell us about your project and we will recommend the right approach — whether that&rsquo;s paving, masonry, a full GC engagement, or an interior design consultation. No pressure.
          </p>
          <Link to="/quote" className="bg-brand-navy text-white font-bold px-8 py-4 rounded-lg hover:bg-brand-navy/90 transition-colors">
            Start Your Free Quote
          </Link>
        </div>
      </section>
    </>
  )
}
