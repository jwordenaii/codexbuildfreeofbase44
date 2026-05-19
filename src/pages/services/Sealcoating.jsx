import ServicePageLayout from '@/components/ui/ServicePageLayout.jsx'
import { SERVICE_BY_SLUG } from '@/config/site.js'

const service = SERVICE_BY_SLUG['sealcoating']

const WHY = {
  heading: 'Why OBX Sealcoating Is Different',
  items: [
    {
      title: 'Salt Air Degrades Fast',
      desc: "Ocean salt spray is corrosive to standard asphalt oxidants. Our coastal formula adds chloride-resistant polymers that standard sealers skip — protecting the binder before it becomes brittle.",
    },
    {
      title: 'UV Intensity is Higher',
      desc: "The Outer Banks gets intense solar UV with little inland tree canopy to block it. Our sealer uses a higher TiO₂ loading that reflects UV rather than absorbing it, dramatically slowing oxidation.",
    },
    {
      title: 'Humidity Needs a Curing Window',
      desc: "High coastal humidity can trap sealers before they cure properly. We monitor dew point, air and surface temperature before every application — ensuring a proper, durable bond every time.",
    },
    {
      title: 'Sand Texture for Traction',
      desc: "We add a calibrated silica sand aggregate to sealcoating on driveways and parking lots — boosting traction on wet coastal surfaces and giving a finished, professional look.",
    },
    {
      title: 'Properly Timed Cycles',
      desc: "In the OBX climate, sealcoating every 2–3 years is optimal. Too early traps gases from the asphalt; too late allows oxidation cracks to form. We recommend timing based on your specific exposure.",
    },
    {
      title: 'Commercial-Grade Equipment',
      desc: "We use 500-gallon heated spray tankers for large commercial applications and professional squeegee application for residential driveways — not a brush and a bucket from a pickup.",
    },
  ],
}

const PROCESS = {
  heading: 'Our Sealcoating Process',
  steps: [
    { num: '01', title: 'Site Prep & Cleaning', desc: 'We blow-clean the entire surface, remove all vegetation from cracks, degrease oil spots with emulsifier, and let the surface fully dry. Sealcoating over contamination fails fast.' },
    { num: '02', title: 'Crack Filling First', desc: "Any cracks over 1/8\" are filled with hot-pour rubberized filler and allowed to cure 24 hours before sealcoating. Sealcoating alone does not seal cracks — this step is non-negotiable." },
    { num: '03', title: 'Sealer Application', desc: 'We apply two coats at the manufacturer-specified rate — first coat by squeegee to push sealer into the surface texture, second coat by spray for uniform coverage and a sharp finish.' },
    { num: '04', title: 'Cure & Walk-through', desc: 'We barricade the surface and observe a minimum 24-hour dry time (48 hours for vehicle traffic). We walk the job with you before removing barriers and leave written care instructions.' },
  ],
}

const FAQS = [
  {
    q: 'How long should I wait before driving on a freshly sealcoated surface?',
    a: 'We recommend 24 hours foot traffic and 48 hours before driving on it. In high-humidity OBX conditions, waiting the full 48 hours for vehicles is particularly important to avoid tire tracking.',
  },
  {
    q: 'How often should I sealcoat my driveway on the Outer Banks?',
    a: 'For residential driveways with normal exposure, every 2–3 years. For driveways with heavy UV exposure (south or west facing, no shade) or high traffic, every 2 years is optimal. We assess condition during each visit and recommend based on what we see.',
  },
  {
    q: 'Does sealcoating fill cracks?',
    a: 'No. Sealcoating is a protective surface coating — it does not fill or structurally repair cracks. Cracks must be filled with hot-pour rubberized filler before sealcoating. We include crack prep in our full sealcoating service.',
  },
  {
    q: 'Can you sealcoat during the off-season in winter?',
    a: 'We can apply sealcoat when air and surface temperatures are above 50°F and rising, with no rain forecast for 24 hours. In the Outer Banks, this allows work from roughly April through November. We schedule jobs proactively around suitable weather windows.',
  },
  {
    q: 'What is the difference between coal-tar sealer and asphalt emulsion sealer?',
    a: 'Coal-tar sealers offer superior resistance to fuel and oil penetration and have historically been preferred for commercial parking lots. Asphalt emulsion sealers are more environmentally friendly and are often specified for HOA communities with environmental restrictions. We assess your specific situation and recommend the right product.',
  },
]

export default function Sealcoating() {
  return (
    <ServicePageLayout
      service={service}
      seoTitle="Sealcoating Services — Outer Banks NC | OBX Paving Co."
      seoDescription="Professional sealcoating for driveways and parking lots across the Outer Banks. Salt-resistant, UV-blocking formulas designed for Dare County and Currituck County coastal conditions."
      heroLabel="Sealcoating — Outer Banks, NC"
      heroHeading={<>Coastal <span className="text-gradient-sand">Sealcoating</span> That Actually Lasts</>}
      heroBody="Standard sealers fail in the OBX environment within 18 months. We use premium coastal-formulated sealers with salt-inhibiting additives, proper surface prep, and two-coat application — protecting your investment for 3+ years."
      whySection={WHY}
      processSection={PROCESS}
      faqs={FAQS}
    />
  )
}
