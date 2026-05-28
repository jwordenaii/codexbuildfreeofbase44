import React from 'react'
import { Link } from 'react-router-dom'
import { Building2, CheckCircle2, Phone, ShieldCheck } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import SmartImage from '@/components/SmartImage'
import { trackPhoneClick } from '@/lib/analytics'
import { RICHMOND_COMMERCIAL_PROOF } from '@/lib/richmondCommercialProof'

const COMMERCIAL_CHECKLIST = [
  'Written line-item scope and asphalt section depth',
  'Drive-thru lanes, parking stalls, ADA striping, and customer access',
  'Phased scheduling for active restaurants, retail, offices, churches, and HOAs',
  'Clear warranty terms and maintenance guidance',
]

export default function RichmondCommercial() {
  const canonicalPath = '/commercial/richmond-va'
  const title = 'Commercial Asphalt Paving in Richmond, VA | J. Worden & Sons'
  const description =
    'Commercial asphalt paving, restaurant lots, drive-thru lanes, parking lot resurfacing, repairs, striping, drainage, and ADA upgrades in Richmond, VA.'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': 'https://www.jwordenasphaltpaving.com/commercial/richmond-va#service',
        name: 'Commercial Asphalt Paving in Richmond, VA',
        provider: {
          '@type': 'LocalBusiness',
          name: 'J. Worden & Sons Paving LLC',
          url: 'https://www.jwordenasphaltpaving.com/',
          telephone: '+18044461296',
        },
        areaServed: {
          '@type': 'City',
          name: 'Richmond',
        },
        serviceType: [
          'Commercial asphalt paving',
          'Parking lot resurfacing',
          'Parking lot repairs',
          'Parking lot striping',
          'ADA compliance upgrades',
        ],
        url: 'https://www.jwordenasphaltpaving.com/commercial/richmond-va',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Do you handle active commercial lots that cannot shut down?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. We build phased plans for active properties in Richmond so tenant and customer access stays open while paving work is completed in sections.',
            },
          },
          {
            '@type': 'Question',
            name: 'What commercial services do you provide in Richmond?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'We provide mill and overlay, full-depth repairs, crack sealing, sealcoating, line striping, ADA upgrades, and drainage-focused asphalt repairs for commercial sites.',
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.jwordenasphaltpaving.com/' },
          { '@type': 'ListItem', position: 2, name: 'Commercial Richmond', item: 'https://www.jwordenasphaltpaving.com/commercial/richmond-va' },
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
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.3em] uppercase mb-4">Richmond Commercial Division</p>
              <h1 className="font-display font-black text-foreground text-4xl md:text-6xl uppercase tracking-tight leading-[0.95] max-w-4xl">
                Richmond Commercial Asphalt With Documented Multi-Site Proof
              </h1>
              <p className="text-muted-foreground text-base md:text-lg mt-6 max-w-3xl leading-relaxed">
                We handle the work commercial owners actually need: parking lots, access lanes, drive-thru lanes,
                patching, milling, resurfacing, sealcoating, ADA layout, and striping. The same project discipline used on
                KFC, Taco Bell, Arby's, and regional retail portfolios is applied to Richmond-area properties.
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                <a
                  href="tel:+18044461296"
                  onClick={() => trackPhoneClick('richmond_commercial_page')}
                  className="premium-cta inline-flex items-center gap-2 px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase text-primary-foreground"
                >
                  <Phone className="w-4 h-4" />
                  Call 804-446-1296
                </a>
                <Link
                  to="/#quote"
                  className="border border-primary/50 text-primary px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase hover:bg-primary/10 transition-colors"
                >
                  Request Commercial Quote
                </Link>
              </div>
            </div>
            <figure className="border border-border bg-card p-3 shadow-[0_24px_60px_-36px_rgba(15,48,68,0.45)]">
              <SmartImage
                src="/work/imported/KFC/IMG_9499-COLLAGE.jpg"
                alt="KFC restaurant parking lot and drive-thru paving documentation by J. Worden and Sons"
                width={1200}
                height={900}
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="aspect-[4/3] w-full object-cover"
                priority
              />
              <figcaption className="px-2 pt-3 font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Restaurant parking lot and drive-thru project work
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-16 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight mb-4">
                What We Scope Before Work Starts
              </h2>
              <div className="space-y-3">
                {COMMERCIAL_CHECKLIST.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/90 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display font-black text-foreground text-2xl md:text-3xl uppercase tracking-tight mb-4">
                Richmond Commercial Focus
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                We support restaurants, retail centers, medical offices, churches, schools, HOAs, logistics yards,
                and multi-tenant properties with phased scheduling and long-life asphalt planning tuned to Richmond traffic and weather.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Licensed, bonded, insured, and experienced in phased commercial operations
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Richmond Proof</p>
              <h2 className="font-display font-black text-foreground text-3xl md:text-5xl uppercase tracking-tight leading-[0.95]">
                Commercial Proof From Real Project Photos
              </h2>
            </div>
            <Link
              to="/#projects"
              className="border border-border px-4 py-3 text-xs uppercase tracking-[0.14em] font-display font-bold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            >
              View Full Gallery
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {RICHMOND_COMMERCIAL_PROOF.slice(0, 6).map((project) => (
              <article key={project.id} className="border border-border bg-card overflow-hidden">
                <img
                  src={project.image_url}
                  alt={`${project.title} in ${project.location}`}
                  width="800"
                  height="600"
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-[4/3] object-cover quality-premium"
                />
                <div className="p-5">
                  <p className="font-display text-primary text-[10px] tracking-[0.2em] uppercase mb-2">{project.location}</p>
                  <h3 className="font-display font-black text-foreground text-xl uppercase tracking-tight leading-tight">{project.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-3">{project.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="premium-panel rounded-2xl p-7 md:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="font-display text-primary text-xs tracking-[0.28em] uppercase mb-2">Next Step</p>
              <h2 className="font-display font-black text-foreground text-3xl uppercase tracking-tight">Request Your Richmond Site Review</h2>
              <p className="text-muted-foreground text-sm md:text-base mt-3 max-w-2xl leading-relaxed">
                Get a practical recommendation, budget-aware scope options, and a clear timeline before you commit. We will tell you whether repair, preservation, resurfacing, or replacement is the right move.
              </p>
            </div>
            <a
              href="tel:+18044461296"
              onClick={() => trackPhoneClick('richmond_commercial_footer_cta')}
              className="premium-cta inline-flex items-center gap-2 px-6 py-4 font-display font-bold text-sm tracking-[0.14em] uppercase text-primary-foreground"
            >
              <Building2 className="w-4 h-4" />
              Talk To Commercial Team
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
