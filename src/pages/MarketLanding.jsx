import React from 'react'
import { ArrowRight, CheckCircle2, Phone, ShieldCheck, Snowflake } from 'lucide-react'
import SEO from '@/components/SEO'
import { trackPhoneClick } from '@/lib/analytics'
import { resolveSiteProfile } from '@/lib/siteProfiles'

const DEFAULT_MARKET_CONTENT = {
  marketName: 'Local Asphalt Paving',
  primaryRegion: 'Your Service Region',
  primaryMetro: 'Major Metro Area',
  heroKicker: 'Verified Field Documentation',
  heroHeadline: 'Premium Asphalt Construction Built For Local Conditions',
  heroBody:
    'Commercial parking lots and residential driveways delivered with clear scope, structural prep discipline, and execution standards built for long-term performance.',
  ctaLabel: 'Call For A Professional Estimate',
  phoneDisplay: '804-446-1296',
  proofHeadline: 'Recent Documented Work',
  geo: {
    region: 'US-VA',
    placename: 'Chester, Virginia',
    position: '37.3563;-77.4411',
    icbm: '37.3563, -77.4411',
  },
}

const DELIVERY_STANDARDS = [
  'Detailed scope and sequencing approved before mobilization',
  'Compaction and lift planning matched to actual traffic load',
  'Seasonal installation protocols for temperature-sensitive paving windows',
  'Photo-documented closeout package for every project',
]

const SERVICE_MIX = [
  'Commercial parking lots, retail lanes, and access corridors',
  'Drive-thru and franchise remodel paving scopes',
  'Private driveways, estate lanes, and long-lane resurfacing',
  'Repair, overlay, and preservation planning',
]

const PROOF_IMAGES = [
  {
    id: 'kfc-9509',
    src: '/work/imported/KFC/IMG_9509.JPG',
    title: 'High-traffic commercial lot delivery',
    body: 'Documented paving execution for high-use customer traffic with controlled sequencing and closeout verification.',
  },
  {
    id: 'va-8724',
    src: '/work/imported/va cars photos and videos for website/IMG_8724.JPG',
    title: 'Residential driveway finish and edge control',
    body: 'Clean residential finish work with stable transitions, water-shedding slope, and detail-focused completion.',
  },
  {
    id: 'va-8733',
    src: '/work/imported/va cars photos and videos for website/IMG_8733.JPG',
    title: 'Surface renewal with preservation planning',
    body: 'Asphalt renewal strategy designed to protect service life, support traffic demand, and reduce avoidable capital rework.',
  },
]

function toTelHref(phoneDisplay) {
  const digits = String(phoneDisplay || '').replace(/\D/g, '')
  if (!digits) return 'tel:+18044461296'
  if (digits.startsWith('1')) return `tel:+${digits}`
  return `tel:+1${digits}`
}

export default function MarketLanding() {
  const siteProfile = resolveSiteProfile()
  const market = {
    ...DEFAULT_MARKET_CONTENT,
    ...(siteProfile.market || {}),
  }

  const phoneDisplay = market.phoneDisplay || DEFAULT_MARKET_CONTENT.phoneDisplay
  const phoneHref = toTelHref(phoneDisplay)

  const title = `${market.marketName} | Verified Asphalt Paving`
  const description = `${market.marketName} serving ${market.primaryRegion}. Documented project proof, clear scope language, and asphalt construction built for local weather cycles.`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        name: market.marketName,
        areaServed: {
          '@type': 'AdministrativeArea',
          name: market.primaryRegion,
        },
        telephone: `+1${String(phoneDisplay || '').replace(/\D/g, '') || '8044461296'}`,
        url: siteProfile.canonicalUrl,
      },
      {
        '@type': 'Service',
        name: `${market.marketName} Asphalt Services`,
        provider: {
          '@type': 'Organization',
          name: market.marketName,
          url: siteProfile.canonicalUrl,
        },
        areaServed: {
          '@type': 'AdministrativeArea',
          name: market.primaryRegion,
        },
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <SEO title={title} description={description} canonicalPath="/" geo={market.geo} jsonLd={jsonLd} />

      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-primary">Licensed Asphalt Operations</p>
            <p className="font-display text-lg uppercase leading-none">{market.marketName}</p>
          </div>
          <a
            href={phoneHref}
            onClick={() => trackPhoneClick('market_landing_header')}
            className="premium-cta inline-flex items-center gap-2 px-4 py-3 text-xs font-display font-bold uppercase tracking-[0.14em] text-primary-foreground"
          >
            <Phone className="w-4 h-4" />
            {phoneDisplay}
          </a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(15,76,129,0.12),transparent_50%),radial-gradient(circle_at_90%_90%,rgba(249,115,22,0.15),transparent_45%)]" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-24">
            <p className="font-display text-primary text-xs tracking-[0.24em] uppercase mb-4">{market.heroKicker}</p>
            <h1 className="font-display text-4xl md:text-6xl uppercase tracking-tight leading-[0.94] max-w-5xl">
              {market.heroHeadline}
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-3xl leading-relaxed">
              {market.heroBody}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={phoneHref}
                onClick={() => trackPhoneClick('market_landing_hero')}
                className="premium-cta inline-flex items-center gap-2 px-6 py-4 text-sm font-display font-bold uppercase tracking-[0.14em] text-primary-foreground"
              >
                <Phone className="w-4 h-4" />
                {market.ctaLabel}
              </a>
              <a
                href="#proof"
                className="inline-flex items-center gap-2 px-6 py-4 border border-primary/40 text-primary text-sm font-display font-bold uppercase tracking-[0.14em] hover:bg-primary/10 transition-colors"
              >
                See Verified Photos
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Primary Region</p>
                <p className="font-display text-2xl uppercase mt-2">{market.primaryRegion}</p>
              </div>
              <div className="border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Core Metro</p>
                <p className="font-display text-2xl uppercase mt-2">{market.primaryMetro}</p>
              </div>
              <div className="border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operating Standard</p>
                <p className="font-display text-2xl uppercase mt-2">Documented Delivery</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 border-b border-border">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <p className="font-display text-primary text-xs tracking-[0.22em] uppercase mb-3">Delivery Standards</p>
              <div className="space-y-3">
                {DELIVERY_STANDARDS.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/90 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <p className="font-display text-primary text-xs tracking-[0.22em] uppercase mb-3">Service Mix</p>
              <div className="space-y-3">
                {SERVICE_MIX.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <Snowflake className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/90 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Scope clarity, documented execution, and accountable delivery standards on every project.
              </div>
            </div>
          </div>
        </section>

        <section id="proof" className="py-14 md:py-18 border-b border-border">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <p className="font-display text-primary text-xs tracking-[0.24em] uppercase mb-2">{market.proofHeadline}</p>
            <h2 className="font-display text-3xl md:text-5xl uppercase tracking-tight leading-[0.95] mb-8">
              Field photos used for estimate confidence and scope accuracy
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {PROOF_IMAGES.map((item) => (
                <article key={item.id} className="border border-border bg-card overflow-hidden">
                  <img
                    src={item.src}
                    alt={item.title}
                    width="900"
                    height="600"
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <div className="p-5">
                    <h3 className="font-display text-xl uppercase tracking-tight">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <p>{market.marketName}</p>
          <p>Professional asphalt delivery standards</p>
        </div>
      </footer>
    </div>
  )
}
