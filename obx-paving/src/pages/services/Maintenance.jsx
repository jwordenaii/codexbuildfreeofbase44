import ServicePageLayout from '@/components/ui/ServicePageLayout.jsx'
import { SERVICE_BY_SLUG } from '@/config/site.js'

const service = SERVICE_BY_SLUG['maintenance']

const WHY = {
  heading: 'Why Preventive Maintenance Matters on the OBX',
  items: [
    {
      title: '$1 Prevents $6–10 in Repairs',
      desc: 'Industry data consistently shows that every dollar spent on preventive maintenance avoids $6–10 in future reactive repairs. In the harsher coastal environment, that ratio is even higher.',
    },
    {
      title: 'Salt Air Accelerates Everything',
      desc: 'Inland pavement can tolerate deferred maintenance for years. On the Outer Banks, salt air oxidizes binder, UV degrades the surface, and moisture penetrates cracks 2–3× faster than inland. Maintenance timing is critical.',
    },
    {
      title: 'HOA & Property Manager Focus',
      desc: 'We work directly with HOA boards and property management companies — providing annual condition reports, multi-year budgets, and coordinated scheduling across all your properties.',
    },
    {
      title: 'Scheduled Around Rental Season',
      desc: 'We plan all maintenance work outside peak vacation rental weeks. Your properties stay bookable, your guests are never disrupted, and the work gets done at the optimal time for pavement health.',
    },
    {
      title: 'Written Condition Reports',
      desc: 'Each annual inspection produces a written report with photos documenting current condition, work performed, and recommendations for the next cycle. You always know where your pavement stands.',
    },
    {
      title: 'Multi-Property Discounts',
      desc: 'HOAs and property managers with multiple locations get consolidated pricing. One contract, one schedule, one point of contact — less paperwork, better pricing.',
    },
  ],
}

const PROCESS = {
  heading: 'Our Maintenance Program',
  steps: [
    { num: '01', title: 'Annual Site Inspection', desc: 'We visit each property annually to assess pavement condition, document any new deterioration with photos, and determine what maintenance is needed for the upcoming cycle.' },
    { num: '02', title: 'Crack Filling & Spot Repairs', desc: 'Hot-pour crack filling and minor patching are performed as needed between sealcoat cycles — stopping moisture intrusion before it damages the base.' },
    { num: '03', title: 'Sealcoating Application', desc: 'Every 2–3 years, we apply a full two-coat sealcoating treatment using our coastal formula. Timing is based on actual surface condition, not an arbitrary calendar.' },
    { num: '04', title: 'Condition Report & Planning', desc: 'After each service visit, you receive an updated condition report with recommendations and budget projections for the next 1–3 years.' },
  ],
}

const FAQS = [
  {
    q: 'How much does a preventive maintenance program cost?',
    a: 'It depends on total pavement area, current condition, and number of properties. For a typical residential driveway, annual maintenance averages $200–400/year. For HOA common areas and commercial lots, we provide custom proposals based on a site survey. The cost is a fraction of what premature repairs or replacement would cost.',
  },
  {
    q: 'Can I sign up for a multi-year maintenance contract?',
    a: 'Yes. We offer 3-year and 5-year maintenance agreements with locked-in pricing and guaranteed scheduling windows. Multi-year contracts receive priority scheduling and discounted rates.',
  },
  {
    q: 'What if my pavement is already in poor condition?',
    a: 'We assess current condition first. If significant repairs are needed before entering a maintenance program, we provide a repair proposal to get your pavement to a maintainable state, then transition to preventive maintenance going forward.',
  },
  {
    q: 'How do you schedule work around vacation rental occupancy?',
    a: 'We coordinate directly with property managers and booking calendars to schedule all work during turnover days or off-season windows. We never schedule work that would disrupt a guest stay.',
  },
]

export default function Maintenance() {
  return (
    <ServicePageLayout
      service={service}
      seoTitle="Preventive Maintenance Plans — Outer Banks NC | OBX Paving Co."
      seoDescription="Annual asphalt maintenance programs for HOAs, property managers, and homeowners on the Outer Banks. Sealcoating, crack filling, and inspection packages."
      heroLabel="Preventive Maintenance — Outer Banks, NC"
      heroHeading={<>Maintenance Plans That <span className="text-gradient-sand">Protect</span> Your Investment</>}
      heroBody="The most cost-effective way to manage asphalt on the Outer Banks is consistent preventive maintenance. We offer annual inspection, sealcoating, and crack filling programs designed for HOAs, property managers, and vacation rental owners."
      whySection={WHY}
      processSection={PROCESS}
      faqs={FAQS}
    />
  )
}
