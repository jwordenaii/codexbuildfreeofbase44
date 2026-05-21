import ServicePageLayout from '@/components/ui/ServicePageLayout.jsx'
import { SERVICE_BY_SLUG } from '@/config/site.js'

const service = SERVICE_BY_SLUG['parking-lots']

const WHY = {
  heading: 'Why OBX Parking Lot Construction Is Different',
  items: [
    {
      title: 'Peak Season Planning',
      desc: 'The Outer Banks economy runs on summer tourism. We schedule major parking lot work during the off-season and phase multi-stage projects so your business never loses revenue during peak months.',
    },
    {
      title: 'Stormwater Compliance',
      desc: 'Dare and Currituck Counties have strict stormwater management requirements for impervious surfaces. We design lots with proper drainage integration — retention, swales, or permeable borders — to meet permitting requirements.',
    },
    {
      title: 'ADA Layout Expertise',
      desc: 'From accessible space counts and van-accessible widths to proper slope and signage requirements, we design layouts that meet current ADA standards and avoid the costly violations inspectors flag.',
    },
    {
      title: 'Coastal Load Engineering',
      desc: 'Commercial delivery trucks, heavy rental equipment, and constant vehicle traffic demand heavier pavement sections than residential work. We design base and surface thickness for your actual traffic loads.',
    },
    {
      title: 'Curb & Drainage Design',
      desc: 'Proper curbing directs water to designed collection points and protects pavement edges from erosion — critical in flat coastal terrain where sheet drainage is the only option.',
    },
    {
      title: 'Multi-Property Programs',
      desc: 'Property management companies and HOA boards get consolidated pricing, coordinated scheduling, and a single point of contact for all their parking and common-area pavement needs.',
    },
  ],
}

const PROCESS = {
  heading: 'Our Parking Lot Process',
  steps: [
    { num: '01', title: 'Site Assessment & Design', desc: 'We survey the site, analyze traffic patterns and expected loads, design the layout for optimal flow, ADA compliance, and drainage — then produce a proposal with full specifications.' },
    { num: '02', title: 'Permitting & Scheduling', desc: 'We handle county permits, stormwater documentation, and coordinate scheduling around your business operations to minimize disruption.' },
    { num: '03', title: 'Construction & Paving', desc: 'Excavation, base installation, curbing, drainage structures, and machine-paved asphalt surface — all executed by our own crews with daily progress communication.' },
    { num: '04', title: 'Striping & Final Walkthrough', desc: 'Professional line striping, ADA markings, directional arrows, fire lanes, and signage. We walk the completed lot with you and hand over maintenance recommendations.' },
  ],
}

const FAQS = [
  {
    q: 'How long does a commercial parking lot project take?',
    a: 'A typical small-to-mid-size commercial lot (20–80 spaces) takes 2–4 weeks from excavation to striping, weather permitting. Larger multi-phase projects are scoped individually. We provide a detailed timeline in every proposal.',
  },
  {
    q: 'Can you repave an existing parking lot without shutting down the business?',
    a: 'Yes. We frequently phase parking lot work so that a portion of the lot stays open while we work on the other section. For restaurants, retail, and hotels, we schedule around your peak hours and seasons.',
  },
  {
    q: 'Do you handle the striping and ADA markings?',
    a: 'Yes, striping is included in our full parking lot construction service. We design the layout for maximum efficiency, proper ADA compliance, fire lane clearances, and traffic flow before any paint is applied.',
  },
  {
    q: 'What maintenance does a commercial parking lot need?',
    a: 'Annual crack filling, sealcoating every 2–3 years, and periodic re-striping are the fundamentals. We offer preventive maintenance packages that cover all of these on a scheduled basis — significantly extending lot life and reducing long-term cost.',
  },
]

export default function ParkingLots() {
  return (
    <ServicePageLayout
      service={service}
      seoTitle="Parking Lot Construction — Outer Banks NC | OBX Paving Co."
      seoDescription="Commercial parking lot paving, ADA compliance, drainage design, and maintenance for Outer Banks businesses. Dare County and Currituck County."
      heroLabel="Parking Lot Construction — Outer Banks, NC"
      heroHeading={<>Commercial <span className="text-gradient-sand">Parking Lots</span> Built Right</>}
      heroBody="Your parking lot is the first thing customers see. We design, build, and maintain commercial lots that handle OBX traffic loads, meet ADA and stormwater requirements, and stay in excellent condition year after year."
      whySection={WHY}
      processSection={PROCESS}
      faqs={FAQS}
    />
  )
}
