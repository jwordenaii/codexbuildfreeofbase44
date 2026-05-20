/**
 * site.js — single source of truth for all business information, copy,
 * service definitions, and service area data.
 * Edit this file to rebrand or expand the site.
 */

export const SITE = {
  name: 'OBX Paving Co.',
  shortName: 'OBX Paving',
  tagline: 'Coastal Asphalt & Sealcoating Specialists',
  description:
    'Premium asphalt paving and sealcoating for the Outer Banks of North Carolina. Serving Dare County, Currituck County, and all surrounding coastal communities.',
  phone: '(252) 555-0140',
  phoneHref: 'tel:+12525550140',
  email: 'info@obxpaving.com',
  address: 'Kill Devil Hills, NC 27948',
  canonicalUrl: 'https://www.obxpaving.com',
  primaryColor: '#1666A8',
  accentColor: '#C8973A',
  social: {
    facebook: 'https://www.facebook.com/',
    instagram: 'https://www.instagram.com/',
    google: 'https://g.page/',
  },
  ctaText: 'Get Your Free Quote',
}

export const SERVICES = [
  {
    id: 'asphalt-paving',
    slug: 'asphalt-paving',
    title: 'Asphalt Paving',
    shortDesc:
      'New driveways, parking lots, and access roads engineered for coastal salt-air conditions.',
    fullDesc:
      'We design and install new asphalt surfaces built to withstand the unique challenges of the Outer Banks environment — salt air corrosion, high humidity, and sandy substrates. From residential driveways to commercial parking lots, every project is engineered to last.',
    icon: 'Construction',
    highlights: [
      'Residential driveways & private roads',
      'Commercial parking lots',
      'HOA community roads & entrances',
      'Vacation rental property access',
      'Coastal UV & salt-resistant mixes',
      'Base prep & proper drainage grading',
    ],
  },
  {
    id: 'sealcoating',
    slug: 'sealcoating',
    title: 'Sealcoating',
    shortDesc:
      'Salt-resistant sealcoating formulas that protect against OBX coastal weather, UV, and humidity.',
    fullDesc:
      "Standard sealcoating formulas weren't designed for coastal conditions. We use premium coal-tar and asphalt emulsion sealers with additives that resist salt spray, ocean humidity, and intense coastal UV — extending pavement life by years. Applied by professional-grade spray or squeegee depending on surface conditions.",
    icon: 'Shield',
    highlights: [
      'Salt-spray & ocean-humidity resistant formulas',
      'High-build UV-blocking sealer coat',
      'Sand-texture additive for traction & aesthetics',
      'Annual maintenance programs available',
      'HOA & vacation rental property plans',
      'Residential driveway sealcoating',
    ],
  },
  {
    id: 'crack-filling',
    slug: 'crack-filling',
    title: 'Crack Filling & Sealing',
    shortDesc:
      'Hot-pour rubberized crack filling that stops moisture before it destroys your pavement base.',
    fullDesc:
      "Coastal heat cycles, salt air, and shifting sandy soils make Outer Banks asphalt crack faster than inland pavement. Left unsealed, water penetrates, weakens the base, and turns a $2 repair into a $20,000 replacement. We route, clean, and fill every crack with hot-pour rubberized filler — the commercial-grade standard that flexes with seasonal movement.",
    icon: 'Zap',
    highlights: [
      'Hot-pour rubberized crack filler (ASTM D6690)',
      'Routing & cleaning before every application',
      'Linear cracking, edge cracks & reflection cracks',
      'Alligator / fatigue cracking treatment',
      'Block cracking across large surface areas',
      'Pre-sealcoat crack prep programs',
    ],
  },
  {
    id: 'asphalt-repairs',
    slug: 'asphalt-repairs',
    title: 'Asphalt Repairs & Patching',
    shortDesc:
      'Pothole repair, skin patching, and full-depth repairs before small failures become large ones.',
    fullDesc:
      'From isolated potholes to sections of alligator cracking showing base failure, our repair crew handles the full range of asphalt deterioration. We use infrared repair technology for seamless hot-mix patches, and full-depth cold milling where base replacement is needed. No more ugly cold-patch that washes out after the first storm.',
    icon: 'Wrench',
    highlights: [
      'Infrared seamless hot-mix patching',
      'Pothole repair & edge patching',
      'Full-depth replacement sections',
      'Utility cut restoration',
      'Heave & settlement corrections',
      'Base failure diagnosis & repair',
    ],
  },
  {
    id: 'line-striping',
    slug: 'line-striping',
    title: 'Line Striping & Pavement Marking',
    shortDesc:
      'Sharp, durable parking lot striping, ADA stalls, fire lanes, and custom pavement markings.',
    fullDesc:
      'Clear, high-visibility striping is a safety and legal requirement — not an afterthought. We stripe new lots and re-stripe faded ones using professional traffic-grade paint, thermoplastic, or waterborne latex. Our layouts are designed for maximum traffic flow, ADA compliance, and code conformance with local Dare and Currituck County requirements.',
    icon: 'PenLine',
    highlights: [
      'Parking stall layout & re-striping',
      'ADA-compliant accessible space marking',
      'Fire lane & no-parking zone marking',
      'Directional arrows & traffic flow symbols',
      'Loading zone & reserved space marking',
      'Crosswalks & pedestrian safety markings',
    ],
  },
  {
    id: 'parking-lots',
    slug: 'parking-lots',
    title: 'Parking Lot Construction',
    shortDesc:
      'Full-service commercial parking lot paving, drainage design, and ADA compliance upgrades.',
    fullDesc:
      'We handle complete parking lot design, construction, and long-term maintenance for restaurants, retail, hotels, vacation rental offices, and commercial properties throughout the Outer Banks. Proper base preparation, storm drainage planning, and ADA layout design are built into every project.',
    icon: 'Car',
    highlights: [
      'Commercial lot design & construction',
      'Storm water drainage integration',
      'ADA compliance layout & upgrades',
      'Curb & gutter installation',
      'Speed bump & traffic calming',
      'Multi-phase rental-season scheduling',
    ],
  },
  {
    id: 'resurfacing',
    slug: 'resurfacing',
    title: 'Resurfacing & Overlays',
    shortDesc:
      'Cost-effective asphalt overlays that restore deteriorated surfaces without full removal.',
    fullDesc:
      "When your existing pavement base is still sound, a mill-and-overlay or thin bonded wearing course can restore the surface for a fraction of full-depth replacement cost. We assess base conditions thoroughly before recommending an overlay approach — and we'll tell you when replacement is genuinely the better investment.",
    icon: 'Layers',
    highlights: [
      'Milling & leveling course placement',
      'Thin bonded wearing course (TBWC)',
      'Full-depth reclamation (FDR)',
      'Base condition assessment report',
      'Residential & commercial overlays',
      'Cost vs. replace analysis',
    ],
  },
  {
    id: 'maintenance',
    slug: 'maintenance',
    title: 'Preventive Maintenance Plans',
    shortDesc:
      'Annual inspection, sealcoating, and crack filling programs that maximize coastal pavement life.',
    fullDesc:
      'The most cost-effective way to manage asphalt in the Outer Banks is a consistent preventive maintenance schedule. Studies show that a $1 investment in preventive maintenance replaces $6–10 in reactive repairs. We offer annual inspection + sealcoating + crack maintenance packages for HOAs, property managers, and vacation rental owners.',
    icon: 'ClipboardCheck',
    highlights: [
      'Annual site inspection & condition report',
      'Scheduled sealcoating every 2–3 years',
      'Crack filling between sealcoat cycles',
      'HOA association multi-year programs',
      'Vacation rental manager packages',
      'Multi-property discount pricing',
    ],
  },
]

// Quick-access lookup by slug
export const SERVICE_BY_SLUG = Object.fromEntries(SERVICES.map((s) => [s.slug, s]))

export const AREAS = {
  primary: [
    { name: 'Kill Devil Hills', county: 'Dare', note: 'Headquarters area' },
    { name: 'Nags Head', county: 'Dare', note: 'Residential & commercial' },
    { name: 'Kitty Hawk', county: 'Dare', note: 'Beachfront properties' },
    { name: 'Duck', county: 'Dare', note: 'Premium coastal estates' },
    { name: 'Southern Shores', county: 'Dare', note: 'Gated communities' },
    { name: 'Manteo', county: 'Dare', note: 'Roanoke Island commercial' },
    { name: 'Corolla', county: 'Currituck', note: '4WD beach communities' },
    { name: 'Avon', county: 'Dare', note: 'Hatteras Island' },
    { name: 'Buxton', county: 'Dare', note: 'Hatteras Island' },
    { name: 'Hatteras Village', county: 'Dare', note: 'Ferry community' },
    { name: 'Frisco', county: 'Dare', note: 'Hatteras Island' },
    { name: 'Waves / Salvo', county: 'Dare', note: 'Hatteras Island' },
  ],
  growing: [
    { name: 'Moyock', county: 'Currituck', note: 'Fastest-growing area' },
    { name: 'Barco', county: 'Currituck', note: 'New development corridor' },
    { name: 'Grandy', county: 'Currituck', note: 'US-158 growth zone' },
    { name: 'Jarvisburg', county: 'Currituck', note: 'Rural residential' },
    { name: 'Maple', county: 'Currituck', note: 'Northern Currituck' },
    { name: 'Point Harbor', county: 'Currituck', note: 'Gateway to OBX' },
  ],
  mainland: [
    { name: 'Elizabeth City', county: 'Pasquotank', note: 'Regional hub' },
    { name: 'Edenton', county: 'Chowan', note: 'Historic waterfront' },
    { name: 'Hertford', county: 'Perquimans', note: 'Perquimans County' },
    { name: 'Columbia', county: 'Tyrrell', note: 'Tyrrell County' },
  ],
}

export const TESTIMONIALS = [
  {
    id: 1,
    name: 'Mark R.',
    location: 'Kill Devil Hills, NC',
    stars: 5,
    text: 'Had our rental property driveway sealcoated and it looks brand new. They understood the salt-air issue immediately and used the right product. Booking them again for two more properties.',
  },
  {
    id: 2,
    name: 'Jennifer W.',
    location: 'Duck, NC',
    stars: 5,
    text: 'Our HOA parking lot was in rough shape. OBX Paving gave us a clear assessment, phased the work to minimize disruption during peak rental season, and delivered exactly on schedule.',
  },
  {
    id: 3,
    name: 'Tom B.',
    location: 'Nags Head, NC',
    stars: 5,
    text: 'Great local contractor — they actually show up and do what they say. Fresh asphalt looks fantastic, crew was professional, and they cleaned everything up completely.',
  },
  {
    id: 4,
    name: 'Sarah M.',
    location: 'Corolla, NC',
    stars: 5,
    text: 'Tough access property up in 4WD beach but they handled it without hesitation. The crackfilling and reseal held up through a full hurricane season. Highly recommend.',
  },
]

export const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Free Site Assessment',
    desc: 'We visit your property and evaluate existing conditions — base integrity, drainage, coastal exposure, and current deterioration. No surprises later.',
  },
  {
    step: '02',
    title: 'Detailed Proposal',
    desc: 'You receive a written scope with line-item pricing, material specs, timeline, and our coastal maintenance recommendations — all in plain language.',
  },
  {
    step: '03',
    title: 'Professional Installation',
    desc: 'Our crew arrives on schedule with the right equipment. We work efficiently to minimize disruption and document the job with progress photos.',
  },
  {
    step: '04',
    title: 'Quality Walkthrough',
    desc: 'We inspect the finished work with you, explain curing timelines, and leave written care instructions. We\'re available if any question arises post-job.',
  },
]

export const STATS = [
  { value: '15+', label: 'Years Serving OBX' },
  { value: '1,200+', label: 'Projects Completed' },
  { value: '100%', label: 'Licensed & Insured' },
  { value: '5★', label: 'Average Google Rating' },
]

export const WHY_US = [
  {
    icon: 'Waves',
    title: 'Coastal Expertise',
    desc: 'We formulate specifically for salt air, ocean humidity, and UV conditions that destroy standard-spec pavement within 2–3 years.',
  },
  {
    icon: 'MapPin',
    title: 'Truly Local',
    desc: 'Based in Kill Devil Hills, licensed in North Carolina, and invested in the Outer Banks community. We\'re here year-round, not just in season.',
  },
  {
    icon: 'ShieldCheck',
    title: 'Licensed & Insured',
    desc: 'NC Licensed General Contractor. Full general liability and workers\' compensation coverage on every job.',
  },
  {
    icon: 'Calendar',
    title: 'Year-Round Availability',
    desc: 'We schedule work outside peak rental seasons when possible, and offer emergency repair services for property managers.',
  },
  {
    icon: 'FileText',
    title: 'Transparent Pricing',
    desc: 'Written proposals with line-item breakdowns. No surprise invoices. No vague scopes. What we quote is what you pay.',
  },
  {
    icon: 'Building2',
    title: 'HOA & PM Specialists',
    desc: 'We work directly with HOA boards and property management companies — multi-property maintenance programs, seasonal scheduling, and reporting.',
  },
]
