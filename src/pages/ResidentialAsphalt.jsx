import React from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Home, Phone, ShieldCheck } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import SmartImage from '@/components/SmartImage'
import { trackPhoneClick } from '@/lib/analytics'
import { getRichmondRadiusLocations, RICHMOND_RADIUS_MILES } from '@/lib/locations'

const RESIDENTIAL_IMAGES = [
  {
    src: '/work/portfolio/portfolio-017.jpg',
    alt: 'Premium finished asphalt driveway in Windsor Farms Richmond by J. Worden and Sons',
    label: 'Historic Richmond finish work',
  },
  {
    src: '/work/portfolio/portfolio-030.jpg',
    alt: 'Large estate circular driveway paving in Chesterfield by J. Worden and Sons',
    label: 'Estate circular driveway',
  },
  {
    src: '/work/portfolio/portfolio-013.jpg',
    alt: 'Circular residential asphalt driveway with clean edges in Chesterfield Virginia',
    label: 'Circular driveway layout',
  },
  {
    src: '/work/portfolio/portfolio-006.jpg',
    alt: 'Residential asphalt driveway with decorative brick edging in Richmond Virginia',
    label: 'Asphalt with border detail',
  },
]

const RESIDENTIAL_SERVICES = [
  {
    title: 'New Driveway Installation',
    detail: 'A properly prepared driveway with clean edges, correct pitch, solid base, and a finish that looks right beside the home.',
  },
  {
    title: 'Driveway Resurfacing',
    detail: 'Mill-and-overlay and surface renewal options when the base is stable but the top layer has aged out.',
  },
  {
    title: 'Remove And Replace',
    detail: 'Full-depth reconstruction when the existing driveway is beyond patching, including base correction and water control.',
  },
  {
    title: 'Crack Repair And Sealcoating',
    detail: 'Preventive maintenance programs that reduce water intrusion, oxidation, and costly emergency repairs.',
  },
  {
    title: 'Private Lanes And Long Driveways',
    detail: 'Long residential lanes, estate drives, farm entrances, and rural approaches that need stronger planning than a short city driveway.',
  },
  {
    title: 'Widening And Lengthening',
    detail: 'More parking, better turn radius, cleaner garage access, and a driveway that works for how the home is actually used.',
  },
]

const RESIDENTIAL_FAQS = [
  {
    q: 'How long should a residential asphalt driveway last in Virginia?',
    a: 'A properly built residential asphalt driveway in Virginia typically lasts 18-25 years with correct base prep, drainage, and maintenance.',
  },
  {
    q: 'Do you provide written scope and pricing before starting?',
    a: 'Yes. We provide clear line-item scope, asphalt section details, and straightforward pricing before any work begins.',
  },
  {
    q: 'Can you fix drainage issues at the same time as paving?',
    a: 'Yes. We correct grade and drainage conditions during construction so water runs away from your home and away from the new mat.',
  },
]

export default function ResidentialAsphalt() {
  const canonicalPath = '/residential'
  const title = 'Residential Asphalt Paving in Virginia | J. Worden & Sons'
  const description =
    'High-quality residential driveway paving, resurfacing, private lanes, and asphalt maintenance around Chester, Richmond, Chesterfield, Henrico, and Central Virginia.'

  const richmondRadiusMarkets = getRichmondRadiusLocations()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': 'https://www.jwordenasphaltpaving.com/residential#service',
        name: 'Residential Asphalt Paving',
        provider: {
          '@type': 'LocalBusiness',
          name: 'J. Worden & Sons Paving LLC',
          url: 'https://www.jwordenasphaltpaving.com/',
          telephone: '+18044461296',
        },
        areaServed: {
          '@type': 'GeoCircle',
          geoMidpoint: {
            '@type': 'GeoCoordinates',
            latitude: 37.5407,
            longitude: -77.4360,
          },
          geoRadius: 144841,
        },
        serviceType: [
          'Residential driveway paving',
          'Driveway resurfacing',
          'Asphalt remove and replace',
          'Driveway sealcoating',
          'Crack repair',
        ],
        url: 'https://www.jwordenasphaltpaving.com/residential',
      },
      {
        '@type': 'FAQPage',
        mainEntity: RESIDENTIAL_FAQS.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.jwordenasphaltpaving.com/' },
          { '@type': 'ListItem', position: 2, name: 'Residential', item: 'https://www.jwordenasphaltpaving.com/residential' },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO title={title} description={description} canonicalPath={canonicalPath} jsonLd={jsonLd} />
      <Navbar />

      <section className="relative border-b border-border pt-32 pb-16 md:pb-20 overflow-hidden">
        <div className="absolute -top-16 right-0 w-72 h-72 rounded-full bg-primary/12 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-4">Residential Driveway Division</p>
              <h1 className="font-display font-black text-foreground text-4xl md:text-6xl uppercase tracking-tight leading-[0.95] max-w-5xl">
                Luxury Driveways Built With Structural Discipline
              </h1>
              <p className="text-muted-foreground text-base md:text-lg mt-6 max-w-3xl leading-relaxed">
                Your driveway is part of your property value. We evaluate drainage, base condition, tie-ins, edges, turnarounds,
                and daily traffic before recommending repair, resurfacing, or full-depth replacement.
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                <a
                  href="tel:+18044461296"
                  onClick={() => trackPhoneClick('residential_page_hero')}
                  className="premium-cta inline-flex items-center gap-2 px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase text-primary-foreground"
                >
                  <Phone className="w-4 h-4" />
                  Call 804-446-1296
                </a>
                <Link
                  to="/#quote"
                  className="border border-primary/50 text-primary px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase hover:bg-primary/10 transition-colors"
                >
                  Request Free Estimate
                </Link>
              </div>
            </div>
            <figure className="border border-border bg-card p-3 shadow-[0_24px_60px_-36px_rgba(15,48,68,0.45)]">
              <SmartImage
                src="/work/portfolio/portfolio-017.jpg"
                alt="Premium residential asphalt driveway finished in Richmond Virginia"
                width={1200}
                height={900}
                sizes="(max-width: 1024px) 100vw, 48vw"
                className="aspect-[4/3] w-full object-cover"
                priority
              />
              <figcaption className="px-2 pt-3 font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Finished residential driveway work
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Residential Services</p>
              <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">
                High-Quality Home Asphalt Work
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {RESIDENTIAL_SERVICES.map((service) => (
              <article key={service.title} className="border border-border bg-card p-6">
                <h3 className="font-display font-black text-foreground text-xl uppercase tracking-tight leading-tight">
                  {service.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">{service.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18 border-b border-border bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Real Residential Work</p>
            <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">
              Clean Edges, Smooth Finish, Proper Fit To The Home
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
              Finished driveways, circular layouts, estate properties, and clean details help you see what the work should look like before you schedule an estimate.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {RESIDENTIAL_IMAGES.map((image) => (
              <figure key={image.src} className="border border-border bg-card overflow-hidden">
                <SmartImage
                  src={image.src}
                  alt={image.alt}
                  width={900}
                  height={675}
                  sizes="(max-width: 768px) 100vw, 25vw"
                  className="aspect-[4/3] w-full object-cover quality-premium"
                />
                <figcaption className="border-t border-border px-4 py-3 font-display text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {image.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-16 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight mb-4">
                Why Homeowners Call Us
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground/90 leading-relaxed">We look at water, grade, base, edges, and daily use before recommending a scope.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground/90 leading-relaxed">Family-run accountability from estimate to finish, with real project photos to back up the work.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground/90 leading-relaxed">Clear scope, disciplined execution, and no shortcut workmanship that fails after one weather cycle.</p>
                </div>
              </div>
            </div>

            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight mb-4">
                Licensed And Insured
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                We build residential projects with the same discipline used on commercial work: documented scope,
                protection-focused operations, and practical maintenance recommendations after completion.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Professional residential paving standards with accountable execution
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-16 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Service Coverage</p>
          <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95] mb-8">
            Residential Paving Within A {RICHMOND_RADIUS_MILES}-Mile Radius Of Richmond
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mb-8">
            These are active service markets we cover around Richmond with dedicated local pages and city-specific scope details.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {richmondRadiusMarkets.map((loc) => (
              <Link
                key={loc.slug}
                to={`/locations/${loc.slug}`}
                className="border border-border bg-card p-4 flex items-center gap-2.5 hover:border-primary/40 transition-colors"
              >
                <Home className="w-4 h-4 text-primary shrink-0" />
                <span className="font-display font-bold text-foreground text-sm tracking-wide">{loc.city}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Common Questions</p>
          <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95] mb-8">
            Residential Paving FAQ
          </h2>
          <div className="space-y-4">
            {RESIDENTIAL_FAQS.map((item) => (
              <article key={item.q} className="border border-border bg-card p-5 md:p-6">
                <h3 className="font-display font-black text-foreground text-lg md:text-xl uppercase tracking-tight leading-tight">
                  {item.q}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="premium-panel rounded-2xl p-7 md:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Start Here</p>
              <h2 className="font-display font-black text-foreground text-3xl uppercase tracking-tight">Get A Residential Driveway Plan</h2>
              <p className="text-muted-foreground text-sm md:text-base mt-3 max-w-2xl leading-relaxed">
                We will review your driveway, explain the right scope, and give you a clear estimate with no pressure.
              </p>
            </div>
            <a
              href="tel:+18044461296"
              onClick={() => trackPhoneClick('residential_page_footer_cta')}
              className="premium-cta inline-flex items-center gap-2 px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase text-primary-foreground"
            >
              <Home className="w-4 h-4" />
              Talk To Residential Team
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
