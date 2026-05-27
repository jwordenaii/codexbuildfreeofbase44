import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  ClipboardCheck,
  Construction,
  Droplets,
  Factory,
  Home,
  MapPin,
  Phone,
  Plane,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Wrench,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import SchemaMarkup from '../components/SchemaMarkup';
import SmartImage from '@/components/SmartImage';
import PublicResearchFeed from '@/components/PublicResearchFeed';
import { trackPhoneClick } from '@/lib/analytics';
import { SITE_IMAGES } from '@/lib/siteImages';

const scanSteps = [
  {
    title: 'Use iPhone Photos',
    body: 'Take clear photos of the driveway, parking lot, cracks, potholes, edges, failed patches, oil stains, and standing water. No special equipment is needed for a first look.',
    icon: Smartphone,
  },
  {
    title: 'Sketch The Surface',
    body: 'Mark the pavement area, entrances, problem zones, drainage paths, traffic flow, and any section that needs a separate price or repair recommendation.',
    icon: ScanLine,
  },
  {
    title: 'Add Drone Views',
    body: 'For larger lots, churches, HOAs, retail centers, industrial yards, and apartment communities, drone photos can show the whole property in one review packet.',
    icon: Plane,
  },
  {
    title: 'Get Estimator Ready',
    body: 'JWORDENAI organizes photos, notes, sketches, water issues, location details, and service needs so J. Worden can respond with a sharper estimate conversation.',
    icon: ClipboardCheck,
  },
];

const pavementServices = [
  { title: 'Asphalt Paving', body: 'New driveways, parking lots, private lanes, access roads, commercial overlays, and replacement planning.', icon: Construction },
  { title: 'Sealcoating', body: 'Oxidation, fading, surface wear, open pores, coating failure, and maintenance timing for residential and commercial pavement.', icon: ShieldCheck },
  { title: 'Asphalt Repairs', body: 'Potholes, failed patches, edge breakup, alligator cracking, rutting, utility cuts, and trip hazards.', icon: Wrench },
  { title: 'Drainage Problems', body: 'Standing water, low spots, washouts, runoff toward buildings, soft edges, and water-damaged base concerns.', icon: Droplets },
  { title: 'Concrete And ADA', body: 'Sidewalk panels, curbs, ramps, detectable warnings, trip points, accessible routes, and concrete repair areas.', icon: BadgeCheck },
  { title: 'Striping And Flow', body: 'Parking layout, arrows, fire lanes, loading areas, crosswalks, traffic direction, and restriping needs.', icon: MapPin },
];

const customerTypes = [
  'Homeowners and long private driveways',
  'Commercial real estate and retail centers',
  'HOAs, condos, and multifamily communities',
  'Churches, schools, and municipal properties',
  'Industrial yards, warehouses, and service lots',
  'Property managers planning pavement budgets',
];

const locations = [
  'Richmond',
  'Chesterfield',
  'Henrico',
  'Short Pump',
  'Petersburg',
  'Fredericksburg',
  'Williamsburg',
  'New Kent',
  'Hampton Roads',
  'Northern Virginia',
  'Shenandoah Valley',
  'Roanoke corridor',
];

const estimateReasons = [
  'A photo packet helps us see the problem before we call you back.',
  'A sketch helps separate paving, repair, drainage, concrete, and striping needs.',
  'Drone views help larger lots get phased without missing hidden problem areas.',
  'A human estimator still reviews the final scope before pricing is treated as real.',
];

const futureTech = [
  {
    title: 'Roof Scan Preview',
    body: 'Future scan packets can collect roof photos and drone views to flag missing shingles, ponding, flashing concerns, storm damage, and areas needing roofer review.',
    icon: Home,
  },
  {
    title: 'House Damage Triage',
    body: 'Exterior cracks, water intrusion, fascia damage, settlement clues, drainage issues, and visible wear can be organized before a contractor visits the property.',
    icon: Building2,
  },
  {
    title: 'Professional Review Boundary',
    body: 'AI can help collect evidence and rank urgency. Final safety decisions stay with licensed engineers, inspectors, roofers, and qualified construction professionals.',
    icon: Factory,
  },
];

const boundaries = [
  'Public page shows scanning abilities only',
  'Pricing, routing, and bid logic stays private',
  'No public command center access',
  'No customer documents exposed',
  'Human estimator review before final pricing',
  'Roof, house, and structural scans require professional review',
];

export default function JwordenAI() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'JWORDENAI Driveway and Lot AI Scan',
    description: 'J. Worden & Sons iPhone and drone pavement scan brochure for driveway paving, parking lot paving, asphalt repair, sealcoating, drainage, concrete, ADA, and striping estimates in Virginia.',
    url: 'https://www.jwordenasphaltpaving.com/jwordenai',
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="JWORDENAI | Driveway and Parking Lot AI Scan"
        description="Use iPhone photos, drone views, pavement sketches, water problem notes, and damage flags to request a J. Worden asphalt paving estimate in Virginia."
        canonicalPath="/jwordenai"
        jsonLd={schema}
      />
      <SchemaMarkup
        title="JWORDENAI | Driveway and Parking Lot AI Scan"
        description="A public brochure for J. Worden driveway, parking lot, iPhone, and drone scan intake technology."
        canonical="/jwordenai"
        breadcrumb={[{ name: 'Home', path: '/' }, { name: 'JWORDENAI', path: '/jwordenai' }]}
      />
      <Navbar />

      <section className="relative overflow-hidden bg-white pt-36">
        <div className="absolute inset-0 opacity-25">
          <SmartImage
            src={SITE_IMAGES.industrialWork}
            alt="Commercial asphalt paving and parking lot maintenance work"
            width={1800}
            height={1200}
            priority
            sizes="100vw"
            className="h-full w-full grayscale contrast-110"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.94)_50%,rgba(255,122,0,0.20)_100%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-12 lg:px-8">
          <div className="max-w-5xl">
            <div className="mb-7 inline-flex items-center gap-3 border border-primary/45 bg-primary/10 px-4 py-2 text-primary">
              <ScanLine className="h-4 w-4" />
              <span className="font-display text-sm uppercase tracking-[0.22em]">Driveway + Lot AI Scan</span>
            </div>
            <h1 className="font-display text-6xl font-black uppercase leading-[0.86] tracking-normal text-foreground md:text-8xl lg:text-9xl">
              Scan pavement. Get a better estimate.
            </h1>
            <p className="mt-8 max-w-3xl text-xl leading-relaxed text-muted-foreground md:text-2xl">
              JWORDENAI helps customers show J. Worden & Sons what is happening on the pavement before the estimate. Upload iPhone photos, sketch the driveway or lot, flag cracks and water problems, add drone views when needed, and request a human-reviewed asphalt paving estimate.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/quote" className="inline-flex min-h-[52px] items-center gap-3 bg-primary px-7 py-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                Request Estimate
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/ai-research" className="inline-flex min-h-[52px] items-center gap-3 border border-primary/45 bg-white px-7 py-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-primary hover:text-primary">
                View AI Radar
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="tel:+18044461296" onClick={() => trackPhoneClick('jwordenai_hero')} className="inline-flex min-h-[52px] items-center gap-3 border border-primary/45 bg-white px-7 py-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-primary hover:text-primary">
                <Phone className="h-5 w-5" />
                Call 804.446.1296
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-[#0b0b0b] py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">What the scan collects</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-white md:text-7xl">
              Photos, drone views, sketches, and repair notes in one clean packet.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-zinc-300">
              The scan turns scattered texts, unclear pictures, and rough guesses into a better first conversation. That means faster scope review for driveways, parking lots, sealcoating, asphalt repair, concrete, ADA, striping, and drainage problems.
            </p>
          </div>
          <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
            {scanSteps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="bg-[#111111] p-7">
                  <Icon className="mb-7 h-7 w-7 text-primary" />
                  <h3 className="font-display text-3xl uppercase leading-none text-white">{step.title}</h3>
                  <p className="mt-5 text-sm leading-relaxed text-zinc-400">{step.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-10 max-w-4xl">
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Pavement maintenance scan coverage</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">
              Built around the services property owners already search for.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              We handle every service the scan uncovers — paving, sealcoating, repair, concrete, ADA compliance, striping, drainage, and site maintenance. One call to J. Worden & Sons covers it all across Virginia.
            </p>
          </div>
          <div className="grid gap-px border border-border bg-border md:grid-cols-2 xl:grid-cols-3">
            {pavementServices.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className="bg-card p-8">
                  <Icon className="mb-8 h-7 w-7 text-primary" />
                  <h3 className="font-display text-3xl uppercase leading-none text-foreground">{service.title}</h3>
                  <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{service.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-[#111111] py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Who it helps</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-white md:text-7xl">
              Residential, commercial, HOA, industrial, and public-facing pavement work.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-zinc-300">
              A homeowner can show driveway cracks and drainage issues in minutes. A property manager can show a full parking lot, repair zones, traffic lanes, concrete issues, and striping needs before budgeting the work.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {customerTypes.map((type) => (
              <div key={type} className="border border-white/10 bg-black p-5 font-display text-2xl uppercase leading-tight text-white">
                {type}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-10 max-w-4xl">
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Virginia locations</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">
              Local content for J. Worden service areas.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              JWORDENAI supports estimate requests across Virginia pavement conditions: Richmond-area driveways, Chesterfield and Henrico parking lots, coastal drainage concerns, mountain freeze-thaw cracking, new-construction entrances, and commercial maintenance corridors.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {locations.map((location) => (
              <span key={location} className="border border-border bg-background px-5 py-3 font-display text-lg uppercase text-foreground">
                {location}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Why customers should use it</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">
              Better information makes a better estimate request.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              A clear scan helps the office and estimator understand what you need before the first call. That can help separate urgent repairs from future maintenance, compare service options, and prepare the right questions for your property.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/quote" className="inline-flex min-h-[52px] items-center gap-3 bg-primary px-7 py-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                Fill Out Estimate Form
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="tel:+18044461296" onClick={() => trackPhoneClick('jwordenai_middle_cta')} className="inline-flex min-h-[52px] items-center gap-3 border border-primary/45 bg-white px-7 py-4 font-display text-sm font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-primary hover:text-primary">
                <Phone className="h-5 w-5" />
                Call Now
              </a>
            </div>
          </div>
          <div className="space-y-3">
            {estimateReasons.map((reason) => (
              <div key={reason} className="border-l-4 border-primary bg-white p-5 font-body text-lg leading-relaxed text-foreground shadow-sm">
                {reason}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-[#0b0b0b] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-10 max-w-4xl">
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Coming next from J. Worden & Sons</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-white md:text-7xl">
              The scan pattern can grow beyond pavement with the right review boundaries.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-zinc-300">
              We're expanding beyond pavement. Our team is evaluating roof photo intake, exterior damage review, water intrusion detection, and structural assessment — giving property owners a faster path to the right contractor and a sharper estimate before work begins.
            </p>
          </div>
          <div className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
            {futureTech.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="bg-[#111111] p-8">
                  <Icon className="mb-8 h-7 w-7 text-primary" />
                  <h3 className="font-display text-3xl uppercase leading-none text-white">{item.title}</h3>
                  <p className="mt-5 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <PublicResearchFeed limit={4} />

      <section className="border-b border-border bg-background py-16 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.24em] text-primary">Public boundary</p>
            <h2 className="mt-4 font-display text-5xl uppercase leading-none text-foreground md:text-7xl">
              Brochure outside. Company intelligence inside.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Customers should understand what they can scan and why it helps. The deeper tools, pricing logic, routing decisions, and company operating systems stay behind J. Worden & Sons.
            </p>
          </div>
          <div className="space-y-3">
            {boundaries.map((item) => (
              <div key={item} className="border-l-4 border-primary bg-white p-5 font-display text-2xl uppercase leading-tight text-foreground shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-16 text-black">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.22em]">Ready to show us the pavement?</p>
            <h2 className="mt-2 font-display text-4xl uppercase leading-none md:text-6xl">
              Send photos, sketch the surface, or schedule a drone review.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/quote" className="inline-flex min-h-[52px] items-center gap-3 bg-black px-7 py-4 font-display text-lg uppercase tracking-[0.12em] text-white">
              <Camera className="h-5 w-5" />
              Request Estimate
            </Link>
            <a href="tel:+18044461296" onClick={() => trackPhoneClick('jwordenai_scan_cta')} className="inline-flex min-h-[52px] items-center gap-3 border border-black/30 px-7 py-4 font-display text-lg uppercase tracking-[0.12em] text-black">
              <Phone className="h-5 w-5" />
              Call 804.446.1296
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}