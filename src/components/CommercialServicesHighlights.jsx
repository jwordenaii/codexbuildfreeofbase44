import { ShieldCheck, Droplets, Car, Zap } from 'lucide-react'

const services = [
  {
    title: 'Restaurant, Retail, And Parking Lot Paving',
    description:
      'KFC, Taco Bell, Arby\'s, retail, and active commercial lots need crews that understand phasing, access, traffic flow, and clean turnover.',
    icon: <Zap className="h-12 w-12 text-amber-400" />,
    link: '/parking-lots',
  },
  {
    title: 'Sealcoating And Crack Sealing',
    description:
      'Maintenance is only valuable when the base is sound. We tell owners when preservation makes sense and when it is just covering a bigger problem.',
    icon: <ShieldCheck className="h-12 w-12 text-amber-400" />,
    link: '/sealcoating',
  },
  {
    title: 'Drainage & Catch Basin Repairs',
    description: 'Understand how water destroys asphalt — and how to stop it.',
    icon: <Droplets className="h-12 w-12 text-amber-400" />,
    link: '/parking-lots',
  },
  {
    title: 'ADA Compliance & Pavement Marking',
    description:
      'Commercial lots need clean stall layout, handicap access, fire lanes, arrows, curb transitions, and a finish customers can navigate.',
    icon: <Car className="h-12 w-12 text-amber-400" />,
    link: '/parking-lots',
  },
]

export default function CommercialServicesHighlights() {
  return (
    <div className="bg-slate-900 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-amber-400">
            Commercial Proof
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Proven On Restaurant, Retail, And Active Business Lots
          </p>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Commercial paving has to protect the business while the work is happening. We plan access, phasing, drive-thru lanes, striping, drainage, and turnover so the property can keep operating.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
            {services.map(service => (
              <div key={service.title} className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  {service.icon}
                  {service.title}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-300">
                  <p className="flex-auto">{service.description}</p>
                  <p className="mt-6">
                    <a
                      href={service.link}
                      className="text-sm font-semibold leading-6 text-amber-400 hover:text-amber-300"
                    >
                      Learn more <span aria-hidden="true">→</span>
                    </a>
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
