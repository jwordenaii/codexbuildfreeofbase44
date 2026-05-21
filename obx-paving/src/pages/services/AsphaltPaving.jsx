import ServicePageLayout from '@/components/ui/ServicePageLayout.jsx'
import { SERVICE_BY_SLUG } from '@/config/site.js'

const service = SERVICE_BY_SLUG['asphalt-paving']

const WHY = {
  heading: 'Why OBX Asphalt Paving Is Different',
  items: [
    {
      title: 'Sandy Substrate Engineering',
      desc: 'Outer Banks soils are predominantly sand — they drain fast but shift under load. We design geotextile-stabilized aggregate bases that lock the subgrade in place before a single ton of hot mix is placed.',
    },
    {
      title: 'Salt Air & Mix Design',
      desc: 'Standard DOT mix designs assume inland conditions. We specify modified asphalt binders with anti-stripping additives that resist the moisture damage salt air causes to the aggregate-binder bond.',
    },
    {
      title: 'Coastal Drainage Matters',
      desc: 'Flat terrain and high water tables mean drainage failures are the number-one cause of premature pavement failure on the OBX. Every project includes a grading plan that moves water off the surface and away from edges.',
    },
    {
      title: 'Vacation Rental Scheduling',
      desc: 'We coordinate with property managers to schedule paving work between rental turnover windows so your property stays bookable and guests are never disrupted.',
    },
    {
      title: 'Proper Compaction Protocols',
      desc: 'Coastal humidity and temperature swings affect hot-mix workability. We monitor mat temperatures with IR thermometers and adjust roller patterns to hit density specs in OBX conditions.',
    },
    {
      title: 'Long-Term Value',
      desc: 'A properly built asphalt surface in coastal NC should last 15–20 years with maintenance. We build for that lifespan — not for the lowest bid price that fails in 5.',
    },
  ],
}

const PROCESS = {
  heading: 'Our Paving Process',
  steps: [
    { num: '01', title: 'Site Survey & Grading Plan', desc: 'We survey existing grades, identify drainage paths, and design a finished surface plan that eliminates ponding water — the biggest threat to OBX asphalt longevity.' },
    { num: '02', title: 'Base Preparation', desc: 'Excavation to design depth, geotextile fabric placement where needed, and aggregate base installation with compaction testing. The base determines the pavement life.' },
    { num: '03', title: 'Hot-Mix Asphalt Placement', desc: 'Machine-paved or hand-placed depending on access, with real-time temperature monitoring and multi-pass roller compaction to achieve 92–96% density targets.' },
    { num: '04', title: 'Final Inspection & Handoff', desc: 'We walk the finished surface with you, verify grades and drainage flow, document the work with photos, and provide written maintenance recommendations.' },
  ],
}

const FAQS = [
  {
    q: 'How long does a new asphalt driveway last on the Outer Banks?',
    a: 'With proper base preparation and regular maintenance (sealcoating every 2–3 years, prompt crack filling), a well-built asphalt driveway on the OBX should last 15–20 years. Without maintenance, salt air and UV can reduce that to 8–10 years.',
  },
  {
    q: 'How thick should my asphalt driveway be?',
    a: 'For residential driveways, we typically install 2–3 inches of hot-mix asphalt over 6–8 inches of compacted aggregate base. Commercial parking lots require thicker sections depending on expected traffic loads. We design every project to its specific use case.',
  },
  {
    q: 'Can you pave during the winter months?',
    a: 'Asphalt plants typically operate when ambient temperatures are above 45–50°F. In the Outer Banks, we can usually pave from March through December. We schedule proactively around weather to avoid delays.',
  },
  {
    q: 'How soon can I drive on new asphalt?',
    a: 'Light vehicle traffic is typically safe after 48–72 hours. Full curing takes 6–12 months, during which the surface may be softer in extreme heat. We provide specific care instructions for your project.',
  },
  {
    q: 'Do you handle permits for driveway work?',
    a: 'Yes. Dare County and Currituck County both have grading and driveway permit requirements. We handle the application process and coordinate any required inspections as part of the project.',
  },
]

export default function AsphaltPaving() {
  return (
    <ServicePageLayout
      service={service}
      seoTitle="Asphalt Paving Services — Outer Banks NC | OBX Paving Co."
      seoDescription="Professional asphalt paving for driveways, parking lots, and roads across the Outer Banks. Engineered for coastal conditions in Dare County and Currituck County."
      heroLabel="Asphalt Paving — Outer Banks, NC"
      heroHeading={<>New <span className="text-gradient-sand">Asphalt Paving</span> Built for the Coast</>}
      heroBody="Sandy soils, salt air, and flat terrain demand paving expertise that most contractors don't have. We engineer every surface for the Outer Banks environment — from base stabilization to coastal mix design — so your pavement lasts decades, not years."
      whySection={WHY}
      processSection={PROCESS}
      faqs={FAQS}
    />
  )
}
