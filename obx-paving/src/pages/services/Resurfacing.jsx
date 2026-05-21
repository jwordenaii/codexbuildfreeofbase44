import ServicePageLayout from '@/components/ui/ServicePageLayout.jsx'
import { SERVICE_BY_SLUG } from '@/config/site.js'

const service = SERVICE_BY_SLUG['resurfacing']

const WHY = {
  heading: 'Why OBX Resurfacing Is Different',
  items: [
    {
      title: 'Honest Assessment First',
      desc: "Not every surface is a candidate for overlay. If the base has failed, an overlay is a waste of money. We assess base conditions thoroughly and tell you honestly when replacement is the better investment.",
    },
    {
      title: 'Milling for a Proper Bond',
      desc: 'We mill the existing surface to remove loose material and create a rough profile that the new asphalt bonds to mechanically. Overlaying on top of a smooth, oxidized surface leads to delamination within 2 years.',
    },
    {
      title: 'Coastal Joint Treatment',
      desc: 'Where new overlay meets existing curbs, drains, or structures, we use rubberized tack coat and joint sealant designed for the thermal cycling and moisture conditions unique to the Outer Banks.',
    },
    {
      title: 'Drainage Preservation',
      desc: 'Adding an overlay changes surface elevations. We plan leveling courses and surface grades so that existing drainage patterns are maintained or improved — not blocked.',
    },
    {
      title: 'Cost vs. Replace Analysis',
      desc: 'We provide a written comparison of overlay cost versus full replacement cost, including expected lifespan of each option. You make the decision with real numbers, not a sales pitch.',
    },
    {
      title: 'Faster Turnaround',
      desc: 'Resurfacing projects are typically completed in 1–3 days for residential and a week or less for commercial — far less disruption than full-depth removal and replacement.',
    },
  ],
}

const PROCESS = {
  heading: 'Our Resurfacing Process',
  steps: [
    { num: '01', title: 'Base Condition Assessment', desc: 'We core-sample or probe the existing pavement to assess base integrity. If the base is sound, overlay is viable. If not, we recommend the right repair strategy before proceeding.' },
    { num: '02', title: 'Surface Preparation', desc: 'Milling removes the deteriorated top layer and creates bonding texture. We address localized failures, apply tack coat, and verify grades before paving.' },
    { num: '03', title: 'Overlay Placement', desc: 'Machine-paved hot-mix asphalt overlay at the specified thickness, compacted to density targets. Leveling course applied first where needed to correct grades.' },
    { num: '04', title: 'Finish & Handoff', desc: 'Edge sealing, grade verification, and a walkthrough with you. We document the work and provide a maintenance timeline to maximize the overlay lifespan.' },
  ],
}

const FAQS = [
  {
    q: 'How do I know if my driveway needs resurfacing or full replacement?',
    a: 'If the surface has oxidation cracking, shallow raveling, or isolated potholes but the base is still firm and well-drained, resurfacing is likely the right choice. If you see widespread alligator cracking, significant settling, or standing water, the base has probably failed and full replacement is more cost-effective long-term. We assess both options and give you an honest recommendation.',
  },
  {
    q: 'How long does an asphalt overlay last?',
    a: 'On a sound base with regular maintenance, an overlay on the Outer Banks typically lasts 10–15 years. Without maintenance (sealcoating, crack filling), salt air and UV can reduce that to 7–10 years.',
  },
  {
    q: 'Is resurfacing cheaper than full replacement?',
    a: 'Typically 40–60% less expensive than full removal and replacement, since you avoid excavation, disposal, and new base installation costs. The tradeoff is a shorter lifespan compared to a completely new pavement structure.',
  },
  {
    q: 'Can you resurface a parking lot in sections?',
    a: 'Yes. We frequently phase parking lot resurfacing so your business stays operational. We work in sections, moving traffic and access points as each area is completed.',
  },
]

export default function Resurfacing() {
  return (
    <ServicePageLayout
      service={service}
      seoTitle="Resurfacing & Overlays — Outer Banks NC | OBX Paving Co."
      seoDescription="Cost-effective asphalt resurfacing and overlay services for the Outer Banks. Restore deteriorated driveways and parking lots without full replacement."
      heroLabel="Resurfacing & Overlays — Outer Banks, NC"
      heroHeading={<>Asphalt <span className="text-gradient-sand">Resurfacing</span> That Saves You Money</>}
      heroBody="When your base is still sound, a professional mill-and-overlay restores your surface for a fraction of full replacement cost. We assess conditions honestly and only recommend overlay when it makes financial sense."
      whySection={WHY}
      processSection={PROCESS}
      faqs={FAQS}
    />
  )
}
