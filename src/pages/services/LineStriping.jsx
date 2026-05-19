import ServicePageLayout from '@/components/ui/ServicePageLayout.jsx'
import { SERVICE_BY_SLUG } from '@/config/site.js'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

const service = SERVICE_BY_SLUG['line-striping']

const WHY = {
  heading: 'Why Striping Matters More Than You Think',
  items: [
    {
      title: 'ADA Compliance is the Law',
      desc: "Non-compliant accessible parking is an ADA violation. Fines start at $75,000 for first violations under DOJ enforcement. We design and stripe ADA-compliant layouts with correct number, dimensions, access aisles, and signage.",
    },
    {
      title: 'Safety & Liability',
      desc: "Faded or missing fire lane markings, directional arrows, and pedestrian crosswalks create liability. If someone is injured in a poorly marked lot, property owners face direct exposure. Fresh, visible markings reduce risk.",
    },
    {
      title: 'Maximize Stall Count',
      desc: "An optimized layout can add 10–20% more stalls to a lot versus an unplanned striping job. We design layouts for maximum efficiency within your lot dimensions and local code requirements.",
    },
    {
      title: 'Traffic-Grade Paint Only',
      desc: "We use high-quality waterborne traffic paint (not hardware store paint) with proper reflective beads where required. It bonds to fresh sealcoat and cured asphalt, dries fast, and won't fade for 2–5 years.",
    },
    {
      title: 'Vacation Season Timing',
      desc: "We understand OBX property rental calendars. We stripe during transition windows between rental seasons or overnight to minimize business disruption. Emergency striping before peak season is available.",
    },
    {
      title: 'Full Layout Design Service',
      desc: "Before any paint hits the pavement, we provide a scaled layout drawing for your approval showing stall count, dimensions, ADA locations, fire lanes, and directional flow.",
    },
  ],
}

const PROCESS = {
  heading: 'Our Striping Process',
  steps: [
    { num: '01', title: 'Layout Design', desc: 'We measure your lot and produce a scaled layout drawing with stall count, ADA placement, fire lanes, and traffic flow. You approve the design before any marking begins.' },
    { num: '02', title: 'Layout Snapping', desc: 'We use a chalk-line machine and measuring wheel to snap precise layout lines across the entire lot before any paint. This catches layout errors before they\'re permanent.' },
    { num: '03', title: 'Machine Striping', desc: 'All line work is applied with a self-propelled walk-behind striping machine at controlled speed and pressure — producing sharp, straight lines with consistent 4" or 6" width as specified.' },
    { num: '04', title: 'Stencils & Symbols', desc: 'ADA symbols, arrows, FIRE LANE text, reserved space stencils, and all pavement symbols are hand-placed with precision stencils and rolled or spray-applied for sharp, durable results.' },
  ],
}

const MARKING_TYPES = [
  { label: 'Standard Parking Stalls', note: '9\'×18\' or custom dimensions' },
  { label: 'ADA Accessible Stalls', note: '8\' + 5\' access aisle or 8\'+8\'' },
  { label: 'Van Accessible Stalls', note: '8\' + 8\' access aisle required' },
  { label: 'Fire Lane Marking', note: 'Yellow curb paint + NO PARKING text' },
  { label: 'Directional Arrows', note: 'Single, double, turn arrows' },
  { label: 'Stop Bars', note: '12\' or 24\' white thermoplastic' },
  { label: 'Pedestrian Crosswalks', note: '6\' stripe pattern or continental' },
  { label: 'Loading Zone', note: 'Yellow hash lines + text' },
  { label: 'Reserved Spaces', note: 'Custom text stenciling' },
  { label: 'Speed Humps', note: 'High-visibility yellow chevrons' },
  { label: 'No Parking Zones', note: 'Red curb or hash markings' },
  { label: 'Curb Numbering', note: 'Address or unit numbers' },
]

const FAQS = [
  {
    q: 'How long does parking lot striping last?',
    a: 'Traffic-grade waterborne paint on a sealed surface lasts 2–5 years depending on traffic volume and UV exposure. High-traffic commercial lots may need re-striping every 2 years. Residential HOA lots every 3–5 years. We include a re-stripe assessment in annual maintenance visits.',
  },
  {
    q: 'Can you stripe over an old, faded lot without repaving?',
    a: 'Yes — re-striping over existing pavement is the most common service. We blow-clean the surface, apply a tack primer where needed for adhesion on aged sealer, and apply new paint directly over old lines. Old lines fade into the new paint within one season.',
  },
  {
    q: 'What are the ADA requirements for parking lots in North Carolina?',
    a: 'NC follows ADA Standards for Accessible Design. Required number of accessible spaces ranges from 1 in 25 for lots of 1–25 spaces, scaling up per ADAAG table. At least 1 must be van-accessible. Access aisles must be level (max 2% slope), clearly marked with the ISA symbol, and connected to an accessible route. We design for full compliance.',
  },
  {
    q: 'Should I sealcoat first or stripe first?',
    a: "Always sealcoat first. Sealcoating refreshes and darkens the pavement surface, making new striping dramatically more visible. Sealcoating over fresh striping destroys the markings. We typically sealcoat and allow 48–72 hours cure before applying new striping.",
  },
]

export default function LineStriping() {
  return (
    <ServicePageLayout
      service={service}
      seoTitle="Parking Lot Striping & Pavement Marking — Outer Banks NC | OBX Paving Co."
      seoDescription="Professional parking lot striping, ADA compliance marking, fire lane marking, and pavement symbols for the Outer Banks of NC. Dare County, Currituck County, and all surrounding areas."
      heroLabel="Line Striping — Outer Banks, NC"
      heroHeading={<>Sharp, <span className="text-gradient-sand">ADA-Compliant</span> Parking Lot Striping</>}
      heroBody="Faded striping creates liability, ADA violations, and lost parking capacity. We design your layout, snap precise lines, and apply traffic-grade paint that stays visible through years of OBX sun, rain, and rental-season traffic."
      whySection={WHY}
      processSection={PROCESS}
      faqs={FAQS}
    >
      {/* Marking types reference section */}
      <section className="section-padding bg-white">
        <div className="container-wide">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="section-label mb-3 block">What We Mark</span>
            <h2 className="font-display text-3xl md:text-4xl uppercase text-navy tracking-tight">
              Complete Pavement Marking Services
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MARKING_TYPES.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-off-white border border-slate-100"
              >
                <CheckCircle2 className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-navy text-sm">{m.label}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{m.note}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </ServicePageLayout>
  )
}
