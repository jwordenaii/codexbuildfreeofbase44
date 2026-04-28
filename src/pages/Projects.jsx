import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SchemaMarkup, { LOCAL_BUSINESS_SCHEMA } from '../components/SchemaMarkup'
import SocialShare from '../components/SocialShare'
import { trackEvent } from '../api/client'

/**
 * All projects listed here reflect verified, real work completed by
 * J. Worden & Sons as described by Mr. Worden.
 * Documentation (photos, records) exists in Dropbox and Google Photos.
 */

const PROJECTS = [
  // ── Provided project photo ──────────────────────────────────────────────
  {
    id: 'commercial-asphalt-access-road-photo',
    name: 'Commercial Asphalt Access Road & Gated Facility',
    year: 2024,
    yearDisplay: 'Featured Photo',
    type: 'Commercial',
    location: 'Virginia and regional commercial work',
    headline: 'Fresh asphalt access, clean edges, and commercial-site coordination.',
    description:
      'A documented commercial asphalt access road and gated facility approach showing the kind of practical site work buyers want to see before requesting an estimate: clean transitions, usable access, edge detail, and work completed around active commercial operations.',
    scope: [
      'Commercial access paving',
      'Industrial site access',
      'Edge detail',
      'Traffic access coordination',
      'Photo-documented work',
    ],
    highlight: 'Owner-provided project image added to the portfolio.',
    emoji: '🛣',
    imageUrl: 'https://github.com/user-attachments/assets/52e9f487-8090-43d6-a3f8-ab9d18933545',
    imageAlt:
      'Commercial asphalt access road beside a fenced industrial facility with fresh pavement and clean edge detail',
  },

  // ── Virginia Roots ────────────────────────────────────────────────────
  {
    id: 'va-coastal-corridor',
    name: 'Virginia Coastal Corridor — Regional Build-Out',
    year: 1984,
    yearDisplay: '1984 – 2000s',
    type: 'Commercial',
    location: 'Motels, VA to Virginia Beach, VA',
    headline: 'Where the Reputation Was Built.',
    description:
      "The foundation of the company. Mr. Worden's grandfather built J. Worden & Sons into a highly respected regional name from Motels, Virginia all the way to Virginia Beach — commercial lots, driveways, and local business paving across the coastal corridor. All word of mouth. No shortcuts.",
    scope: [
      'Commercial lot paving',
      'Residential driveways',
      'Sub-base construction',
      'Drainage grading',
    ],
    highlight: 'Built entirely on reputation — zero advertising.',
    emoji: '🌊',
  },

  // ── KFC Virginia — First Franchise Contract ───────────────────────────
  {
    id: 'kfc-virginia-initial',
    name: 'KFC Franchise Program — Virginia',
    year: 2000,
    yearDisplay: 'Early 2000s',
    type: 'QSR / Franchise',
    location: 'Virginia',
    headline: 'First KFC Contract. The Door Opens.',
    description:
      "The company's first KFC franchise paving contract in Virginia. National franchise operators hold contractors to a different standard — tighter tolerances, brand-compliant documentation, ADA compliance, zero rework tolerance. Worden & Sons delivered, and the KFC network took notice.",
    scope: [
      'Parking lot mill & overlay',
      'Drive-thru lane paving',
      'ADA-compliant stalls',
      'Thermoplastic striping',
      'Documentation package',
    ],
    highlight: 'First franchise contract — led to multi-state expansion.',
    emoji: '🍗',
  },

  // ── KFC NC ────────────────────────────────────────────────────────────
  {
    id: 'kfc-north-carolina',
    name: 'KFC Franchise Program — North Carolina',
    year: 2005,
    yearDisplay: 'Mid 2000s',
    type: 'QSR / Franchise',
    location: 'North Carolina',
    headline: 'Crossing State Lines.',
    description:
      'KFC operators in North Carolina bring Worden & Sons into the state based on the Virginia track record. Parking lot maintenance, resurfacing, and franchise-standard documentation. The same system that worked in Virginia translates directly.',
    scope: [
      'Lot resurfacing',
      'Crack fill & sealcoat',
      'Drive-thru lane work',
      'Striping & ADA compliance',
    ],
    highlight: 'Direct referral from Virginia franchise network.',
    emoji: '🐾',
  },

  // ── KFC Southeast ─────────────────────────────────────────────────────
  {
    id: 'kfc-georgia-florida',
    name: 'KFC Franchise Program — Georgia & Florida',
    year: 2007,
    yearDisplay: '2007 – 2012',
    type: 'QSR / Franchise',
    location: 'Georgia and Florida',
    headline: 'Southeast Expansion.',
    description:
      'Franchise work expands into Georgia and Florida. Multiple locations across both states — parking lot maintenance, resurfacing, and franchise-standard closeout documentation. Coordinating crews across state lines at franchise scale requires logistics precision that Worden & Sons had built into their process.',
    scope: [
      'Multi-location lot paving',
      'Franchise compliance documentation',
      'ADA upgrades',
      'Striping & sealcoating',
    ],
    highlight: 'Multi-state multi-location coordination.',
    emoji: '☀️',
  },

  // ── KFC Michigan ──────────────────────────────────────────────────────
  {
    id: 'kfc-michigan',
    name: 'KFC Franchise Program — Michigan',
    year: 2010,
    yearDisplay: '2010 – 2015',
    type: 'QSR / Franchise',
    location: 'Michigan',
    headline: 'Midwest Entry.',
    description:
      'The franchise network expands into the Midwest. KFC operators in Michigan select Worden & Sons based on Southeast and Mid-Atlantic performance. Lot paving, maintenance, and full franchise documentation across multiple Michigan locations.',
    scope: [
      'Full lot resurfacing',
      'Drive-thru lane rebuild',
      'Concrete curb & gutter',
      'Thermoplastic striping',
    ],
    highlight: 'National QSR presence now coast to Midwest.',
    emoji: '🌲',
  },

  // ── New QSR Build Program ──────────────────────────────────────────────
  {
    id: 'kfc-new-build-program',
    name: 'KFC New QSR Build Program — Multi-State',
    year: 2016,
    yearDisplay: '2016 – 2023',
    type: 'QSR / New Build',
    location: 'Multi-state',
    headline: 'Selected for Ground-Up New Store Construction.',
    description:
      "KFC selects Worden & Sons to assist with new store construction under their national new build program. This is not maintenance or resurfacing — it's building new QSR sites from the ground up, civil through finish. The program runs through the end of 2023. Every project backed by verified photo documentation.",
    scope: [
      'Ground-up site construction',
      'Civil & earthwork',
      'Full-depth paving',
      'Drive-thru geometry',
      'Utility coordination',
      'ADA site compliance',
    ],
    highlight: 'National new-build program. Civil through finish.',
    emoji: '🏗',
  },

  // ── New KFC Build — Texas ─────────────────────────────────────────────
  {
    id: 'kfc-new-build-texas',
    name: 'KFC — New Store Build, Texas',
    year: 2021,
    yearDisplay: '2020s',
    type: 'QSR / New Build',
    location: 'Texas',
    headline: 'New Build. New State. Same Standard.',
    description:
      'A ground-up KFC new store build in Texas — one of several Texas projects completed post-pandemic. Full site work from civil through paving finish. Part of the national new build program, executed with the same documentation and standards that built the franchise relationship over two decades.',
    scope: [
      'Full site civil work',
      'Sub-base & drainage',
      'Full-depth HMA',
      'Drive-thru lane construction',
      'Concrete flatwork coordination',
      'Closeout documentation',
    ],
    highlight: 'Verified. Photos and records on file.',
    emoji: '🤠',
  },

  // ── Texas Remodels ────────────────────────────────────────────────────
  {
    id: 'kfc-texas-remodels',
    name: 'KFC Store Remodels — Texas (Multiple)',
    year: 2021,
    yearDisplay: '2020s',
    type: 'QSR / Remodel',
    location: 'Texas',
    headline: 'Multi-Location Texas Program.',
    description:
      "Multiple KFC store remodels across Texas post-pandemic. Parking lot renovation, drive-thru modifications, ADA upgrades, and franchise-standard documentation at each location. Texas becomes one of the company's most active post-pandemic states.",
    scope: [
      'Lot mill & overlay',
      'Drive-thru modifications',
      'ADA compliance upgrades',
      'Thermoplastic striping',
      'Franchise closeout docs',
    ],
    highlight: 'Multiple Texas locations. All documented.',
    emoji: '🌵',
  },

  // ── Kansas / Kansas City ──────────────────────────────────────────────
  {
    id: 'kfc-kansas-kc',
    name: 'KFC Store Remodels — Kansas & Kansas City',
    year: 2021,
    yearDisplay: '2020s',
    type: 'QSR / Remodel',
    location: 'Kansas and Kansas City, MO',
    headline: 'Heartland Program.',
    description:
      'Store remodels across Kansas and Kansas City. Parking lot renovation and franchise remodel scope at multiple locations. Coordinated across both the Kansas and Missouri sides of the metro.',
    scope: [
      'Parking lot renovation',
      'Concrete repair',
      'Striping & ADA compliance',
      'Franchise documentation',
    ],
    highlight: 'Cross-state metro coordination.',
    emoji: '🌾',
  },

  // ── Iowa / Missouri ────────────────────────────────────────────────────
  {
    id: 'kfc-iowa-missouri',
    name: 'KFC Store Remodels — Iowa & Missouri',
    year: 2021,
    yearDisplay: '2020s',
    type: 'QSR / Remodel',
    location: 'Iowa and Missouri',
    headline: 'Midwest Remodel Run.',
    description:
      'Store remodel program across Iowa and Missouri. Lot resurfacing, concrete work, ADA upgrades, and striping. Part of the broader post-pandemic KFC remodel push that took the company across the Midwest.',
    scope: ['Lot resurfacing', 'ADA upgrades', 'Concrete flatwork', 'Thermoplastic striping'],
    highlight: 'Part of multi-state Midwest program.',
    emoji: '🌽',
  },

  // ── Michigan (post-pandemic) ───────────────────────────────────────────
  {
    id: 'kfc-michigan-remodels',
    name: 'KFC Store Remodels — Michigan (Post-Pandemic)',
    year: 2020,
    yearDisplay: '2020s',
    type: 'QSR / Remodel',
    location: 'Michigan',
    headline: 'Return to Michigan.',
    description:
      'A return to Michigan with post-pandemic remodel scope — lot resurfacing, drive-thru reconstruction, and franchise-standard closeouts. The relationship with Michigan franchise operators predates the pandemic and continues through the current cycle.',
    scope: [
      'Lot resurfacing',
      'Drive-thru reconstruction',
      'ADA compliance',
      'Full franchise closeout',
    ],
    highlight: 'Long-term franchise relationship continues.',
    emoji: '🏔',
  },

  // ── Minnesota ─────────────────────────────────────────────────────────
  {
    id: 'kfc-minnesota',
    name: 'QSR Program — Minnesota',
    year: 2020,
    yearDisplay: '2020s',
    type: 'QSR / Remodel',
    location: 'Minnesota',
    headline: 'Northern Expansion.',
    description:
      "QSR paving work in Minnesota — part of the company's continued national expansion post-pandemic. Lot resurfacing and franchise remodel scope completed to national brand standards.",
    scope: [
      'Lot resurfacing',
      'Drive-thru lane work',
      'Cold-weather paving protocols',
      'Franchise documentation',
    ],
    highlight: 'National footprint now reaches Minnesota.',
    emoji: '❄️',
  },

  // ── New York / New Jersey ─────────────────────────────────────────────
  {
    id: 'kfc-ny-nj',
    name: 'KFC Store Remodels — New York & New Jersey',
    year: 2022,
    yearDisplay: '2020s',
    type: 'QSR / Remodel',
    location: 'New York and New Jersey',
    headline: 'Northeast Program.',
    description:
      'Store remodels in New York and New Jersey — the northeastern expansion of the KFC remodel program. Urban-market franchise locations have additional logistical complexity; the Worden team navigated access, scheduling, and documentation requirements at each site.',
    scope: [
      'Lot renovation',
      'Concrete repair & replacement',
      'ADA compliance',
      'Urban scheduling coordination',
      'Franchise closeout documentation',
    ],
    highlight: 'Urban-market franchise execution.',
    emoji: '🗽',
  },

  // ── North Carolina / Georgia Post-Pandemic ────────────────────────────
  {
    id: 'kfc-nc-ga-postpandemic',
    name: 'KFC Remodels — North Carolina & Georgia (Post-Pandemic)',
    year: 2020,
    yearDisplay: '2020s',
    type: 'QSR / Remodel',
    location: 'North Carolina and Georgia',
    headline: 'Returning to the Southeast.',
    description:
      'A return to North Carolina and Georgia for post-pandemic KFC remodel scope. States where the company built its early national reputation — now operating with even more documentation discipline, verified photos, and proven multi-state logistics.',
    scope: [
      'Full lot renovation',
      'Drive-thru modifications',
      'ADA upgrades',
      'Thermoplastic striping',
      'Franchise documentation',
    ],
    highlight: 'Where it started. Still going.',
    emoji: '🌿',
  },

  // ── Private Commercial ─────────────────────────────────────────────────
  {
    id: 'private-commercial-current',
    name: 'Private Commercial Work — Active',
    year: 2024,
    yearDisplay: 'Current',
    type: 'Commercial',
    location: 'Virginia and regional',
    headline: 'Private Work. Same Standard.',
    description:
      'Alongside QSR work, the company actively takes on private commercial paving — parking lots, site work, and maintenance programs. The same documentation discipline, franchise-level precision, and Worden standard applied to every private job.',
    scope: [
      'Parking lot construction & renovation',
      'Commercial site paving',
      'Maintenance programs',
      'Drainage engineering',
      'Striping & ADA compliance',
    ],
    highlight: 'Franchise-level quality on every job.',
    emoji: '🏢',
  },
]

const TYPES = ['All', 'QSR / New Build', 'QSR / Remodel', 'QSR / Franchise', 'Commercial']

const TYPE_COLORS = {
  'QSR / New Build': 'bg-amber-100 text-amber-700',
  'QSR / Remodel': 'bg-orange-100 text-orange-700',
  'QSR / Franchise': 'bg-red-100 text-red-700',
  Commercial: 'bg-blue-100 text-blue-700',
}

const STATES_SERVED = ['VA', 'NC', 'GA', 'FL', 'MI', 'TX', 'KS', 'MO', 'IA', 'MN', 'NY', 'NJ']

export default function Projects() {
  const [activeType, setActiveType] = useState('All')

  const filtered = activeType === 'All' ? PROJECTS : PROJECTS.filter((p) => p.type === activeType)

  const sorted = [...filtered].sort((a, b) => b.year - a.year)

  return (
    <>
      <SchemaMarkup
        title="Project Portfolio — KFC National QSR Program & Commercial Paving"
        description="Verified project history for J. Worden & Sons — KFC new store builds and remodels across 12+ states including TX, NY, NJ, MI, MN, IA, MO, KS, GA, FL, NC, VA. Pavement Magazine Top 75. Est. 1984."
        canonical="/projects"
        schema={LOCAL_BUSINESS_SCHEMA}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Projects', path: '/projects' },
        ]}
      />

      {/* Header */}
      <div className="bg-brand-navy pt-32 pb-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <span className="inline-block bg-brand-amber/20 text-brand-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
            Verified Work · {STATES_SERVED.length}+ States
          </span>
          <h1 className="font-display font-black text-5xl md:text-6xl mb-4">
            Our <span className="text-brand-amber">Projects</span>
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto">
            Real work. Real documentation. From Virginia Beach to Texas — KFC national new builds,
            multi-state remodel programs, and private commercial paving since 1984.
          </p>
          <div className="mt-8 flex justify-center">
            <SocialShare
              path="/projects"
              text="J. Worden & Sons — KFC national QSR contractor, 12+ states, Pavement Magazine Top 75"
              compact
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <section className="bg-brand-amber py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { stat: '1984', label: 'Est.' },
              { stat: `${STATES_SERVED.length}+`, label: 'States Worked In' },
              { stat: 'Top 75', label: 'Pavement Magazine (4 categories)' },
              { stat: '2026', label: 'Top Contractor Nominee' },
            ].map(({ stat, label }) => (
              <div key={label}>
                <div className="font-display font-black text-brand-navy text-3xl">{stat}</div>
                <div className="text-brand-navy/60 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* States served strip */}
      <section className="bg-brand-navy py-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">States Worked In</p>
          <div className="flex flex-wrap justify-center gap-2">
            {STATES_SERVED.map((state) => (
              <span
                key={state}
                className="bg-white/10 text-brand-amber font-bold text-sm px-3 py-1 rounded-full"
              >
                {state}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Filter tabs */}
      <section className="bg-white sticky top-16 z-30 border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto gap-1 py-3 no-scrollbar">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setActiveType(type)
                  trackEvent('project_filter', { type })
                }}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeType === type
                    ? 'bg-brand-navy text-white'
                    : 'bg-gray-100 text-brand-navy/70 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Project grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {sorted.map((project, i) => (
              <motion.article
                key={project.id}
                className="card p-6 flex flex-col"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: (i % 2) * 0.1 }}
              >
                {project.imageUrl && (
                  <figure className="-m-6 mb-5">
                    <img
                      src={project.imageUrl}
                      alt={project.imageAlt}
                      className="h-72 w-full rounded-t-2xl object-cover"
                      loading={i < 2 ? 'eager' : 'lazy'}
                    />
                    <figcaption className="bg-brand-navy px-5 py-3 text-xs font-semibold text-brand-amber">
                      {project.headline}
                    </figcaption>
                  </figure>
                )}
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-4xl flex-shrink-0">{project.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-brand-amber">
                        {project.yearDisplay}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          TYPE_COLORS[project.type] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {project.type}
                      </span>
                    </div>
                    <h2 className="font-display font-bold text-lg text-brand-navy leading-tight">
                      {project.name}
                    </h2>
                    <p className="text-brand-navy/40 text-xs mt-0.5">📍 {project.location}</p>
                  </div>
                </div>

                <p className="text-brand-amber font-semibold text-sm mb-2">{project.headline}</p>
                <p className="text-brand-navy/70 text-sm leading-relaxed mb-4 flex-1">
                  {project.description}
                </p>

                {/* Scope tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {project.scope.map((item) => (
                    <span
                      key={item}
                      className="text-xs bg-brand-navy/5 text-brand-navy/60 px-2 py-0.5 rounded-full"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                {/* Highlight */}
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-brand-amber font-semibold">✓ {project.highlight}</p>
                </div>
              </motion.article>
            ))}
          </div>

          {sorted.length === 0 && (
            <div className="text-center py-20 text-brand-navy/40">
              No projects in this category yet.
            </div>
          )}
        </div>
      </section>

      {/* Documentation callout */}
      <section className="py-16 bg-brand-navy text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-4xl mb-4">📸</div>
          <h2 className="font-display font-black text-3xl mb-4">
            Every Major Project Is <span className="text-brand-amber">Documented</span>
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Mr. Worden maintains a full Dropbox and Google Photos archive of verified photos and
            records for every major project. This is not common in the industry. When you hire us,
            you get a contractor who can prove the work.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-amber text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-display font-black text-brand-navy text-4xl mb-4">
            Ready to be our next project?
          </h2>
          <p className="text-brand-navy/70 text-lg mb-8">
            Free estimates. Franchise-level standards on every job.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/quote"
              className="bg-brand-navy text-white font-bold px-8 py-4 rounded-lg hover:bg-brand-navy/90 transition-colors text-lg"
              onClick={() => trackEvent('cta_click', { location: 'projects_bottom' })}
            >
              Get a Free Quote
            </Link>
            <a
              href="tel:+18044461296"
              className="border-2 border-brand-navy text-brand-navy font-bold px-8 py-4 rounded-lg hover:bg-brand-navy hover:text-white transition-colors text-lg"
              onClick={() => trackEvent('phone_click', { location: 'projects_bottom' })}
            >
              📞 (804) 446-1296
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
