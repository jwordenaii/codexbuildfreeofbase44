import ServicePageLayout from '@/components/ui/ServicePageLayout.jsx'
import { SERVICE_BY_SLUG } from '@/config/site.js'

const service = SERVICE_BY_SLUG['crack-filling']

const WHY = {
  heading: 'Why Crack Treatment Is Critical on the OBX',
  items: [
    {
      title: 'Water Destroys from Below',
      desc: "A 1/4\" crack lets water reach the base course in one rainstorm. Once water saturates the base, you get potholing, heaving, and full-depth base failure — a repair 10–30× the cost of filling that crack now.",
    },
    {
      title: 'Salt Accelerates Crack Widening',
      desc: 'Ocean salt ions widen cracks faster than inland conditions by accelerating the oxidation of asphalt binder at the crack edges. Untreated OBX cracks grow to alligator cracking in 2–3 seasons.',
    },
    {
      title: 'Hot-Pour vs Cold-Applied',
      desc: 'Hardware-store cold-pour crack filler shrinks, stiffens, and pops out within one season. We use ASTM D6690 compliant hot-pour rubberized crack filler — it stays flexible through OBX heat and cold cycles.',
    },
    {
      title: 'Routing Matters',
      desc: "Just pouring filler into a crack without routing is a short-term fix. We rout cracks to a uniform 3/4\" x 3/4\" channel before filling — creating a proper reservoir for the filler to bond and flex properly.",
    },
    {
      title: 'Before Sealcoating',
      desc: 'Crack filling must happen before sealcoating — not after. We always complete crack treatment and allow full curing before any sealcoat application, ensuring both treatments perform at full effectiveness.',
    },
    {
      title: 'Annual Inspection Included',
      desc: 'Our maintenance clients get an annual crack assessment visit — we map new cracks before they grow and schedule treatment proactively rather than reactively when failure has already begun.',
    },
  ],
}

const PROCESS = {
  heading: 'Our Crack Filling Process',
  steps: [
    { num: '01', title: 'Crack Mapping & Assessment', desc: 'We walk every linear foot of cracking, categorize by type (linear, alligator, edge, block), measure width and depth, and identify any that indicate base failure requiring a different repair.' },
    { num: '02', title: 'Routing', desc: "Cracks under 1/2\" are routed to a 3/4\" x 3/4\" reservoir using a self-propelled crack router. Routing removes deteriorated material and creates a clean bonding surface. This step is skipped by many contractors — we don't skip it." },
    { num: '03', title: 'Cleaning & Drying', desc: 'We air-blow every routed crack to remove all debris and ensure the crack is completely dry. Moisture contamination causes filler adhesion failure. We won\'t fill a wet crack.' },
    { num: '04', title: 'Hot-Pour Application', desc: 'Hot-pour rubberized filler is applied at 380°F, slightly overfilling then squeegeed flush. The material self-levels and bonds to crack walls as it cools, creating a flexible, watertight seal.' },
  ],
}

const FAQS = [
  {
    q: 'What types of cracks can be filled vs. which require deeper repair?',
    a: 'Linear cracks, edge cracks, reflection cracks, and block cracks under 1" wide respond well to hot-pour crack filling. Alligator cracking (interconnected map cracking) indicates base failure and requires remove-and-replace repair — crack filling alone won\'t hold in alligator cracked areas.',
  },
  {
    q: 'How long does crack filling last?',
    a: 'Properly routed and filled cracks with ASTM D6690 hot-pour filler typically last 3–5 years before refilling is needed. In the OBX coastal environment with thermal expansion and salt air, plan to inspect and refill every 2–3 years as part of a preventive maintenance program.',
  },
  {
    q: 'Can you fill cracks in wet conditions?',
    a: 'No — and you should be skeptical of any contractor who does. Moisture trapped under hot-pour filler causes immediate adhesion failure and the filler will pop out within weeks. We schedule crack work around dry weather windows and blow all cracks dry before application.',
  },
  {
    q: 'How soon after crack filling can sealcoating be applied?',
    a: 'We require 24 hours minimum cure time after crack filling before sealcoating. This allows the rubberized filler to cool fully and reach working flexibility. Sealcoating over uncured filler can cause the crack filler to bleed through the sealer surface.',
  },
]

export default function CrackFilling() {
  return (
    <ServicePageLayout
      service={service}
      seoTitle="Crack Filling & Crack Sealing — Outer Banks NC | OBX Paving Co."
      seoDescription="Professional hot-pour crack filling and sealing for asphalt driveways and parking lots across the Outer Banks. Stop moisture infiltration before it destroys your pavement base."
      heroLabel="Crack Filling — Outer Banks, NC"
      heroHeading={<>Stop Cracks Before They Become <span className="text-gradient-sand">Costly Failures</span></>}
      heroBody="Every unsealed crack in OBX asphalt is a water infiltration point. Salt water, humidity, and freeze-thaw cycles turn hairline cracks into base failures fast. We route, clean, and hot-pour fill every crack using commercial-grade ASTM D6690 rubberized filler — the only method that holds in coastal conditions."
      whySection={WHY}
      processSection={PROCESS}
      faqs={FAQS}
    />
  )
}
