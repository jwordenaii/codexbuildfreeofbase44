import React from 'react';
import { ArrowRight, Award, BookOpen, Building2, CheckCircle2, CircleDollarSign, ClipboardCheck, Hammer, ListChecks, Phone, TriangleAlert } from 'lucide-react';
import SEO from '../components/SEO';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import HomeSchema from '../components/HomeSchema';
import SmartImage from '@/components/SmartImage';
import { trackPhoneClick } from '@/lib/analytics';
import LiveReviewBadges from '../components/LiveReviewBadges';
import CommercialServicesHighlights from '../components/CommercialServicesHighlights';
import CustomerProofGallery from '../components/CustomerProofGallery';
import QuickQuoteBar from '../components/QuickQuoteBar';

const HERO_IMAGE = '/work/portfolio/portfolio-010.jpg';
const LOT_IMAGE = '/work/portfolio/portfolio-030.jpg';
const WORK_IMAGE = '/work/portfolio/portfolio-019.jpg';
const COMMERCIAL_PROOF_IMAGE = '/work/imported/KFC/IMG_9499-COLLAGE.jpg';
const RESIDENTIAL_PROOF_IMAGE = '/work/portfolio/portfolio-017.jpg';
const QSR_IMAGE = '/work/kfc/kfc-job-032.jpg';

const serviceCards = [
  {
    label: 'Residential',
    title: 'Private driveway paving with estate-grade finish standards.',
    body: 'Driveways, circular layouts, private lanes, widening, resurfacing, and full replacement executed with clean edges, controlled slope, and finish quality that complements the property.',
    href: '/residential',
    cta: 'View Residential Work',
    image: RESIDENTIAL_PROOF_IMAGE,
    alt: 'Finished high-end residential asphalt driveway in Richmond Virginia',
    points: ['Estate driveways', 'Private lanes', 'Clean edges', 'Drainage-first scope'],
  },
  {
    label: 'Commercial',
    title: 'Commercial paving built for active properties and tenant continuity.',
    body: 'Parking lots, drive-thru lanes, retail access lanes, patching, milling, sealcoating, ADA striping, and phased execution designed to keep businesses operating.',
    href: '/parking-lots',
    cta: 'View Commercial Proof',
    image: COMMERCIAL_PROOF_IMAGE,
    alt: 'KFC commercial parking lot project documentation by J. Worden and Sons',
    points: ['KFC experience', 'Taco Bell and Arby\'s work', 'Drive-thru lanes', 'ADA striping'],
  },
];

const serviceSolutions = [
  'Residential driveway paving, overlays, and private lanes',
  'Commercial parking lots, drive-thru lanes, and resurfacing',
  'Sealcoating, crack sealing, and pavement preservation programs',
  'Asphalt repair, pothole patching, milling, and overlays',
  'Drainage, base failure, grading, and water correction',
  'Line striping, ADA layout, and property reimage work',
];

const markets = [
  'Property and facility managers',
  'Retail centers and shopping plazas',
  'Industrial yards and logistics properties',
  'Churches, schools, HOAs, and private communities',
  'Commercial owners preparing to lease, sell, or reposition',
  'Residential driveways and estate access roads',
  'Rural homeowners between the larger cities',
  'Sealcoating and repair customers protecting existing pavement',
];

const richmondMetroSignals = [
  {
    title: 'Richmond City',
    body: 'Driveway repair, alley access, commercial patching, and sealcoating from The Fan and Museum District to Manchester, Church Hill, Scott\'s Addition, and Shockoe Bottom.',
    href: '/locations/richmond-va',
  },
  {
    title: 'Chester / Chesterfield',
    body: 'The home-base corridor for residential driveways, private lanes, church lots, HOAs, rural entrances, and commercial maintenance south of Richmond.',
    href: '/locations/chester-va',
  },
  {
    title: 'Henrico / West End',
    body: 'Sealcoating, crack repair, parking-lot resurfacing, residential paving, and industrial pavement planning from Glen Allen to Sandston.',
    href: '/locations/henrico-va',
  },
  {
    title: 'Midlothian / Short Pump',
    body: 'High-value residential driveways, estate access roads, retail centers, and maintenance plans for the west and northwest Richmond growth markets.',
    href: '/locations/midlothian-va',
  },
];

const landmarkSignals = [
  {
    title: 'Downtown Richmond Core',
    body: 'Project planning around Broad Street, Shockoe Bottom, The Fan, Scott\'s Addition, and VCU-adjacent commercial corridors where traffic timing and staging matter.',
  },
  {
    title: 'Short Pump Retail Belt',
    body: 'Parking-lot resurfacing and lane control for high-volume shopping centers, grocery anchors, and medical offices near West Broad and Pump Road.',
  },
  {
    title: 'Chesterfield Growth Corridor',
    body: 'Driveways, private roads, and commercial lots around Hull Street, Courthouse Road, and Route 288 where base prep and drainage are critical.',
  },
  {
    title: 'River & Airport Routes',
    body: 'Scope planning across Route 1, I-95 access roads, and Richmond International Airport corridors where pavement carries heavier delivery and commuter load.',
  },
]

const contractorStandards = [
  {
    title: 'Driveway Finish',
    body: 'Clean edges, smooth transitions, proper pitch away from the home, and enough base under the asphalt to hold up.',
  },
  {
    title: 'Commercial Scheduling',
    body: 'Phased work for lots that need to stay open, with clear access plans for customers, tenants, employees, and deliveries.',
  },
  {
    title: 'Drainage First',
    body: 'Standing water ruins asphalt. We look at grade, runoff, soft spots, and drainage before recommending a surface repair.',
  },
  {
    title: 'Written Scope',
    body: 'You should know what is being paved, repaired, milled, sealed, striped, hauled away, and excluded before work starts.',
  },
];


const footprintAnchors = [
  {
    title: 'Southside / Dinwiddie',
    body: 'Driveways, private lanes, church lots, and commercial surfaces from Dinwiddie through the Petersburg and I-85 Southside corridor.',
  },
  {
    title: 'Northern Virginia / Fairfax',
    body: 'Residential, HOA, commercial, and phased parking-lot work for Fairfax and the Northern Virginia commuter corridor.',
  },
  {
    title: 'Hampton Roads / Virginia Beach',
    body: 'Coastal asphalt planning for Virginia Beach, Chesapeake, Williamsburg, and high-moisture pavement conditions near the water.',
  },
  {
    title: 'Williamsburg / New Kent Growth',
    body: 'New-construction driveways, estate lanes, commercial pads, and access roads in Williamsburg, New Kent County, and the I-64 growth corridor.',
  },
  {
    title: 'Rural Residential Corridors',
    body: 'Long driveways, private roads, farm entrances, and county-road homes between the bigger city markets where residential asphalt demand is strongest.',
  },
  {
    title: 'I-81 / Shenandoah Corridor',
    body: 'Mountain-grade pavement planning for Roanoke, Harrisonburg, Winchester, and I-81 freeze-thaw conditions.',
  },
];

const processSteps = [
  {
    title: 'Diagnose Before We Price',
    body: 'We look for base failure, drainage problems, cracking patterns, traffic load, ADA issues, and the actual reason the pavement is breaking down.',
  },
  {
    title: 'Explain The Options',
    body: 'You get a clear recommendation: repair, preserve, resurface, replace, or wait. The goal is the right scope, not the biggest scope.',
  },
  {
    title: 'Build It To Hold Up',
    body: 'Crews execute with the right prep, compaction, material choice, drainage control, and communication so the finished work protects the property.',
  },
];

const learningTopics = [
  'How to spot base failure before a low bid turns expensive',
  'When sealcoating is preservation and when it is only cosmetic',
  'Why drainage destroys asphalt faster than traffic in many lots',
  'What property managers should ask before approving a paving quote',
];

const pricingFactors = [
  'Square footage and access for trucks, rollers, and milling equipment',
  'Existing pavement depth, base condition, soft spots, and excavation needs',
  'Drainage correction, catch basins, grading, and water flow problems',
  'Rural driveway length, slope, turnaround needs, culvert conditions, and stone base depth',
  'Material choice, lift thickness, traffic load, striping, and ADA details',
];

const decisionSignals = [
  { label: 'Repair', body: 'Best when damage is isolated, the base is stable, and the surrounding pavement still has useful life.' },
  { label: 'Preserve', body: 'Best when asphalt is oxidizing or cracking early but does not yet need major structural replacement.' },
  { label: 'Resurface', body: 'Best when the lot needs a new wearing surface but drainage and base conditions are controlled.' },
  { label: 'Replace', body: 'Best when base failure, alligator cracking, standing water, or repeated patch failure shows the structure is gone.' },
];

const trustChecklist = [
  'Ask for a written scope with asphalt thickness, base depth, and prep method',
  'Confirm drainage corrections are included before approving resurfacing',
  'Compare repair, preservation, resurfacing, and replacement options side by side',
  'Require insurance, local accountability, references, and clear warranty terms',
  'Avoid vague proposals that hide milling, patching, striping, or disposal details',
];

const internalLinks = [
  { label: 'Asphalt Paving', href: '/paving' },
  { label: 'Residential Driveways', href: '/residential' },
  { label: 'Sealcoating', href: '/sealcoating' },
  { label: 'Parking Lots', href: '/parking-lots' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Richmond Commercial', href: '/commercial/richmond-va' },
  { label: 'Learning Center', href: '/blog' },
];

const serviceAreaLinks = [
  { label: 'Chester', href: '/locations/chester-va' },
  { label: 'Dinwiddie', href: '/locations/dinwiddie-va' },
  { label: 'Richmond', href: '/locations/richmond-va' },
  { label: 'Fredericksburg', href: '/locations/fredericksburg-va' },
  { label: 'Fairfax', href: '/locations/fairfax-va' },
  { label: 'Virginia Beach', href: '/locations/virginia-beach-va' },
  { label: 'Williamsburg', href: '/locations/williamsburg-va' },
  { label: 'New Kent', href: '/locations/new-kent-va' },
  { label: 'Roanoke', href: '/locations/roanoke-va' },
  { label: 'Harrisonburg', href: '/locations/harrisonburg-va' },
  { label: 'Winchester', href: '/locations/winchester-va' },
];

const faqs = [
  {
    question: 'How do I know if my asphalt should be repaired or replaced?',
    answer: 'Start with the failure pattern. Isolated potholes and edge damage may be repairable, but alligator cracking, standing water, rutting, and repeated patch failure usually point to base or drainage issues that need a bigger correction.',
  },
  {
    question: 'What drives the cost of asphalt paving in Virginia?',
    answer: 'Square footage matters, but the real price comes from base condition, excavation depth, drainage, access, asphalt thickness, traffic load, striping, ADA needs, and whether the old surface has to be milled or removed.',
  },
  {
    question: 'Is sealcoating always worth it?',
    answer: 'Sealcoating is worth it when the pavement structure is sound and the surface needs oxidation protection. It is not a structural repair. If cracks, soft spots, or drainage problems are active, those issues should be diagnosed first.',
  },
  {
    question: 'Why do low asphalt bids fail?',
    answer: 'Low bids often leave out base repair, proper milling, drainage correction, adequate asphalt thickness, edge work, or cleanup. A cheap scope can look good for one season and cost far more when the same failure returns.',
  },
  {
    question: 'Does J. Worden & Sons handle both commercial and residential paving?',
    answer: 'Yes. J. Worden & Sons handles residential driveways, private lanes, parking lots, sealcoating, crack repair, pothole repair, milling, resurfacing, and line striping. Service areas include Chester, Richmond, Chesterfield, Henrico, Midlothian, Dinwiddie, Petersburg, Williamsburg, Virginia Beach, Fredericksburg, Fairfax, and other Virginia markets by project fit.',
  },
  {
    question: 'Do you handle sealcoating and asphalt repair, or only full paving?',
    answer: 'Sealcoating, crack sealing, pothole repair, patching, milling, overlays, and pavement preservation are major services. Many properties do not need full replacement yet; the right repair or maintenance plan can protect the driveway or lot and delay a larger capital project.',
  },
  {
    question: 'What Richmond-area markets does J. Worden prioritize?',
    answer: 'Richmond metro is home turf. The core local service area includes Richmond, Chester, Chesterfield, Henrico, Glen Allen, Short Pump, Midlothian, Bon Air, Tuckahoe, Mechanicsville, Ashland, Petersburg, Hopewell, and nearby rural residential corridors where driveway, sealcoating, repair, and parking-lot work are strongest.',
  },
];

const proofStats = [
  { value: '40+', label: 'years in the trade' },
  { value: 'Chester', label: 'home base for Central VA' },
  { value: 'KFC', label: 'restaurant project experience' },
  { value: 'Family-run', label: 'direct accountability' },
  { value: 'Photos', label: 'completed work on file' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-body relative text-foreground">
      <SEO 
        title="J. Worden & Sons Asphalt Paving | Chester, Richmond, Chesterfield & Henrico VA"
        description="Premium residential driveway and commercial parking lot paving in Chester, Richmond, Chesterfield, and Henrico, VA. Sealcoating, asphalt repair, resurfacing, and documented project proof."
        canonicalPath="/"
      />
      <HomeSchema />
      <Navbar />

      <main className="pb-20 md:pb-0">
        {/* Hero */}
        <div className="relative isolate overflow-hidden">
          <div className="absolute inset-0">
            <SmartImage
              src={HERO_IMAGE}
              alt="J. Worden & Sons asphalt paving crew work"
              width={2560}
              height={1440}
              priority
              sizes="100vw"
              className="h-full w-full object-cover opacity-34 saturate-90 contrast-105"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,247,241,0.98)_0%,rgba(248,247,241,0.9)_46%,rgba(248,247,241,0.44)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background to-transparent" />
          </div>

          <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-end px-6 pb-16 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-end">
              <div className="max-w-5xl">
              <div className="mb-7 inline-flex items-center gap-3 rounded-md border border-primary/25 bg-white/88 px-4 py-2 text-primary shadow-[0_14px_30px_-24px_rgba(15,48,68,0.45)]">
                <Award className="h-4 w-4" />
                <span className="font-display text-sm uppercase tracking-[0.24em]">Chester based • Richmond metro • real job photos</span>
              </div>
              <h1 className="font-display text-5xl font-black uppercase leading-[0.88] tracking-normal text-foreground sm:text-6xl md:text-8xl lg:text-9xl">
                Premium Asphalt<br />
                <span className="text-primary">Built To Last.</span>
              </h1>
              <p className="mt-8 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-2xl">
                Residential and commercial asphalt work across Chester, Richmond, Chesterfield, Henrico, and Central Virginia. From The Fan and Short Pump to Route 1 business corridors, every scope is built around traffic, drainage, and long-term pavement life.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  href="tel:+18044461296"
                  onClick={() => trackPhoneClick('homepage_hero')}
                  className="inline-flex min-h-[52px] items-center gap-3 rounded-md bg-primary px-7 py-4 font-display text-lg uppercase tracking-[0.12em] text-primary-foreground shadow-[0_16px_32px_-22px_rgba(20,97,138,0.75)] transition-colors hover:bg-accent"
                >
                  <Phone className="h-5 w-5" />
                  Call For A Free Estimate
                </a>
                <a
                  href="/residential"
                  className="inline-flex min-h-[52px] items-center gap-3 rounded-md border border-primary/35 bg-white/80 px-7 py-4 font-display text-lg uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  Residential Driveways
                  <ArrowRight className="h-5 w-5" />
                </a>
                <a
                  href="/parking-lots"
                  className="inline-flex min-h-[52px] items-center gap-3 rounded-md border border-primary/35 bg-white/80 px-7 py-4 font-display text-lg uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  Commercial Lots
                  <Building2 className="h-5 w-5" />
                </a>
              </div>

              {/* 1-tap lead capture: phone number only. Beats the long /quote form. */}
              <div className="mt-8 max-w-2xl">
                <QuickQuoteBar source="home_hero" servicePreset="paving" />
              </div>
            </div>

              <div className="hidden border border-border bg-white/92 p-4 shadow-[0_24px_60px_-36px_rgba(15,48,68,0.48)] lg:block">
                <SmartImage
                  src={QSR_IMAGE}
                  alt="Documented commercial asphalt work by J. Worden and Sons"
                  width={900}
                  height={675}
                  sizes="380px"
                  className="aspect-[4/3] w-full object-cover"
                />
                <p className="mt-4 font-display text-xs uppercase tracking-[0.2em] text-primary">Commercial paving</p>
                <h2 className="mt-2 font-display text-3xl uppercase leading-none text-foreground">Restaurant lots, drive-thru lanes, and local commercial work.</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  High-traffic commercial pavement requires disciplined scheduling, protected access, durable drive-thru lanes, and finish quality ready for immediate use.
                </p>
              </div>
            </div>

            <div className="mt-14 grid max-w-6xl grid-cols-2 overflow-hidden rounded-lg border border-border bg-white/84 shadow-[0_20px_48px_-34px_rgba(15,48,68,0.36)] md:grid-cols-5">
              {proofStats.map((stat) => (
                <div key={stat.label} className="border-border p-5 md:border-r md:last:border-r-0">
                  <p className="font-display text-3xl uppercase text-foreground md:text-4xl">{stat.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Review Platform Badges */}
        <section className="border-b border-border bg-white py-10">
          <div className="max-w-4xl mx-auto px-6">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
              Verified Reviews On
            </p>
            <LiveReviewBadges />
          </div>
        </section>

        <section className="bg-background py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-10 max-w-4xl">
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Main services</p>
              <h2 className="mt-4 font-display text-4xl uppercase leading-none text-foreground sm:text-5xl md:text-7xl">
                Residential driveways and commercial parking lots.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                J. Worden & Sons handles the asphalt work most property owners need: driveway paving, parking lot paving, resurfacing, sealcoating, crack repair, pothole patching, drainage correction, and line striping.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {serviceCards.map((path) => (
                <article key={path.label} className="overflow-hidden border border-border bg-card">
                  <div className="grid md:grid-cols-[0.95fr_1.05fr]">
                    <SmartImage
                      src={path.image}
                      alt={path.alt}
                      width={1100}
                      height={850}
                      sizes="(max-width: 768px) 100vw, 35vw"
                      className="h-full min-h-[280px] w-full object-cover"
                    />
                    <div className="p-7 md:p-8">
                      <p className="font-display text-xs uppercase tracking-[0.24em] text-primary">{path.label}</p>
                      <h3 className="mt-4 font-display text-4xl uppercase leading-none text-foreground">{path.title}</h3>
                      <p className="mt-5 text-base leading-relaxed text-muted-foreground">{path.body}</p>
                      <div className="mt-6 grid gap-2">
                        {path.points.map((point) => (
                          <div key={point} className="flex items-center gap-2 text-sm text-foreground/80">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                      <a href={path.href} className="mt-7 inline-flex items-center gap-3 rounded-md bg-primary px-5 py-3 font-display text-sm uppercase tracking-[0.14em] text-primary-foreground">
                        {path.cta}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <CommercialServicesHighlights />

        <CustomerProofGallery />

        <section className="border-y border-border bg-white py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">What we check before we pave</p>
                <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">Good asphalt starts before the truck arrives.</h2>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                  A good paving job is not just a black surface. It is base prep, water movement, thickness, compaction, edges, timing, and a crew that understands how the property is used.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {contractorStandards.map((item) => (
                  <article key={item.title} className="border border-border bg-[#eef4f1] p-6">
                    <h3 className="font-display text-3xl uppercase leading-none text-foreground">{item.title}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Service Solutions */}
        <section id="services" className="bg-[#eef4f1] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Core service solutions</p>
              <h2 className="mt-4 font-display text-4xl uppercase leading-none text-foreground sm:text-5xl md:text-7xl">Paving, repairs, sealcoating, and striping.</h2>
              </div>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                Driveways need clean finish work, careful edges, and drainage that moves water away from the home. Commercial lots need phasing, ADA layout, durable drive-thru lanes, and a crew that can work around an active business.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {serviceSolutions.map((service) => (
                <article key={service} className="rounded-lg border border-border bg-card p-7 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)] transition-colors hover:border-primary/40">
                  <Hammer className="mb-6 h-6 w-6 text-primary" />
                  <h3 className="font-display text-3xl uppercase leading-none text-foreground">{service}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid bg-white lg:grid-cols-2">
          <div className="order-first min-h-[300px] lg:order-none lg:min-h-[420px]">
            <SmartImage
              src={LOT_IMAGE}
              alt="Finished commercial parking lot by J. Worden & Sons"
              width={1600}
              height={1100}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex items-center px-6 py-20 lg:px-16">
            <div className="max-w-2xl">
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Markets we serve</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">Driveways, lots, lanes, and repairs.</h2>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                We handle the practical asphalt work property owners call about every day: residential driveways, rural lanes, commercial parking lots, restaurant drive-thru lanes, sealcoating, crack repair, milling, overlays, drainage correction, and line striping.
              </p>
              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                {markets.map((market) => (
                  <div key={market} className="rounded-r-md border-l-4 border-accent bg-[#eef4f1] p-4 text-sm leading-relaxed text-muted-foreground">
                    {market}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-background py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-12 max-w-4xl">
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Richmond local pack focus</p>
              <h2 className="mt-4 font-display text-4xl uppercase leading-none text-foreground sm:text-5xl md:text-7xl">Home turf around Richmond.</h2>
              <p className="mt-7 text-lg leading-relaxed text-muted-foreground">
                Richmond is the center of gravity for the company: Chester, Chesterfield, Henrico, Midlothian, Short Pump, Glen Allen, Bon Air, Tuckahoe, Mechanicsville, Ashland, Petersburg, and Hopewell. That is where residential driveways, rural lanes, sealcoating, crack repair, pothole repair, and commercial lot maintenance need fast local response and clear scope details.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {richmondMetroSignals.map((market) => (
                <a key={market.title} href={market.href} className="rounded-lg border border-border bg-card p-7 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)] transition-colors hover:border-primary/40">
                  <p className="font-display text-2xl uppercase leading-none text-foreground">{market.title}</p>
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{market.body}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#eef4f1] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-12 max-w-4xl">
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Landmark service coverage</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">Built for real Virginia traffic corridors.</h2>
              <p className="mt-7 text-lg leading-relaxed text-muted-foreground">
                Search intent follows landmarks and known corridors. Our field scopes are built around the actual places people reference when they call for asphalt work.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {landmarkSignals.map((item) => (
                <article key={item.title} className="rounded-lg border border-border bg-card p-7 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)]">
                  <h3 className="font-display text-3xl uppercase leading-none text-foreground">{item.title}</h3>
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="border-y border-border bg-background py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-12 max-w-4xl">
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">The Worden process</p>
              <h2 className="mt-4 font-display text-4xl uppercase leading-none text-foreground sm:text-5xl md:text-7xl">No mystery. No scare tactics. No throwaway scopes.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {processSteps.map((step, index) => (
                <article key={step.title} className="rounded-lg border border-border bg-card p-8 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)]">
                  <p className="font-display text-6xl text-primary">{index + 1}</p>
                  <h3 className="mt-8 font-display text-3xl uppercase leading-none text-foreground">{step.title}</h3>
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="learning" className="bg-[#eef4f1] py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Learning center mindset</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">We explain the job before we sell the job.</h2>
              <p className="mt-7 max-w-3xl text-lg leading-relaxed text-muted-foreground">
                A good estimate should make the problem easier to understand. We explain base failure, drainage, repair vs. replace, sealcoating limits, traffic loads, and what is actually included in the scope.
              </p>
              <a href="/blog" className="mt-8 inline-flex items-center gap-3 rounded-md border border-primary/35 bg-white px-6 py-4 font-display text-lg uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent">
                Visit The Learning Center
                <BookOpen className="h-5 w-5" />
              </a>
            </div>
            <div className="space-y-4">
              {learningTopics.map((topic) => (
                <div key={topic} className="flex gap-4 rounded-lg border border-border bg-card p-5 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)]">
                  <ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-base leading-relaxed text-muted-foreground">{topic}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-border bg-background py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-8">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Cost and pricing guidance</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">Paving prices depend on the condition of the property.</h2>
              <p className="mt-7 text-lg leading-relaxed text-muted-foreground">
                A responsible estimate should explain what drives cost before it asks you to sign. We help owners understand the variables, compare scopes, and spot bids that leave out the work that actually protects the pavement.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {pricingFactors.map((factor) => (
                <article key={factor} className="rounded-lg border border-border bg-card p-7 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)]">
                  <CircleDollarSign className="mb-6 h-6 w-6 text-primary" />
                  <p className="text-base leading-relaxed text-muted-foreground">{factor}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#eef4f1] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-12 max-w-4xl">
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Repair or replace?</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">The answer should come from the pavement, not the salesperson.</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-4">
              {decisionSignals.map((signal) => (
                <article key={signal.label} className="rounded-lg border border-border bg-card p-7 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)]">
                  <ListChecks className="mb-7 h-6 w-6 text-primary" />
                  <h3 className="font-display text-4xl uppercase leading-none text-foreground">{signal.label}</h3>
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{signal.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-background py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">How to compare contractors</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">Know what is in the bid before you choose.</h2>
              <p className="mt-7 text-lg leading-relaxed text-muted-foreground">
                A paving estimate should be clear enough to compare. These are the items every Virginia property owner should ask about before approving driveway, parking lot, repair, or sealcoating work.
              </p>
            </div>
            <div className="space-y-4">
              {trustChecklist.map((item) => (
                <div key={item} className="flex gap-4 rounded-lg border border-border bg-card p-5 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)]">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-base leading-relaxed text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#eef4f1] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-12 max-w-4xl">
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Helpful answers</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">Common asphalt paving questions.</h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {faqs.map((faq) => (
                <article key={faq.question} className="rounded-lg border border-border bg-card p-7 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)]">
                  <h3 className="font-display text-3xl uppercase leading-none text-foreground">{faq.question}</h3>
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-background py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Explore services</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">Clear paths for every major paving need.</h2>
              <div className="mt-8 flex flex-wrap gap-3">
                {internalLinks.map((link) => (
                  <a key={link.href} href={link.href} className="rounded-md border border-border bg-card px-5 py-3 font-display text-xl uppercase text-foreground transition-colors hover:border-primary hover:text-primary">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Service areas</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">Dinwiddie to Fairfax. Virginia Beach to I-81.</h2>
              <div className="mt-8 grid gap-4">
                {footprintAnchors.map((anchor) => (
                  <article key={anchor.title} className="rounded-r-md border-l-4 border-accent bg-card p-5 shadow-[0_18px_42px_-34px_rgba(15,48,68,0.34)]">
                    <h3 className="font-display text-3xl uppercase leading-none text-foreground">{anchor.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{anchor.body}</p>
                  </article>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                {serviceAreaLinks.map((link) => (
                  <a key={link.href} href={link.href} className="rounded-md border border-border bg-card px-5 py-3 font-display text-xl uppercase text-foreground transition-colors hover:border-primary hover:text-primary">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid bg-white lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex items-center px-6 py-20 lg:px-16">
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-3 rounded-md border border-primary/25 bg-[#eef4f1] px-4 py-2 text-primary">
                <TriangleAlert className="h-4 w-4" />
                <span className="font-display text-sm uppercase tracking-[0.2em]">Avoid the expensive mistake</span>
              </div>
              <h2 className="font-display text-5xl uppercase leading-none text-foreground md:text-7xl">The wrong paving contractor is not cheap.</h2>
              <p className="mt-7 text-lg leading-relaxed text-muted-foreground">
                Low bids often hide missing prep, thin asphalt, weak base repair, ignored drainage, vague exclusions, and future change orders. The right question is not just price. It is whether the scope protects the pavement after we leave.
              </p>
            </div>
          </div>
          <div className="min-h-[420px]">
            <SmartImage
              src={WORK_IMAGE}
              alt="Asphalt paving equipment and crew on active project"
              width={1600}
              height={1100}
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="h-full w-full object-cover saturate-90"
            />
          </div>
        </section>

        <section className="bg-primary py-16 text-primary-foreground">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.22em]">How can we help?</p>
              <h2 className="mt-2 font-display text-4xl uppercase leading-none md:text-6xl">Ready to take the guesswork out of asphalt?</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="tel:+18044461296" onClick={() => trackPhoneClick('homepage_bottom')} className="inline-flex min-h-[52px] items-center gap-3 rounded-md bg-white px-7 py-4 font-display text-lg uppercase tracking-[0.12em] text-primary">
                <Phone className="h-5 w-5" />
                Call 804.446.1296
              </a>
              <a href="/parking-lots" className="inline-flex min-h-[52px] items-center gap-3 rounded-md border border-white/55 px-7 py-4 font-display text-lg uppercase tracking-[0.12em] text-white">
                View Commercial Proof
                <Building2 className="h-5 w-5" />
              </a>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
