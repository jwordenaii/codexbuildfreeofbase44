/**
 * schema.js — Google-first JSON-LD structured data generators.
 *
 * Every function returns a plain object ready to be serialised with
 * JSON.stringify() and dropped into a <script type="application/ld+json">.
 *
 * References:
 *   https://schema.org/PavingContractor
 *   https://developers.google.com/search/docs/appearance/structured-data
 *   https://validator.schema.org/
 */

import { SITE, SERVICES, AREAS, TESTIMONIALS } from '@/config/site.js'

const BASE_URL = SITE.canonicalUrl.replace(/\/$/, '')

// ─── Shared references ─────────────────────────────────────────────────────

export const BUSINESS_ID = `${BASE_URL}/#business`
export const ORG_ID      = `${BASE_URL}/#organization`
export const WEBSITE_ID  = `${BASE_URL}/#website`

// ─── Full area-served list ──────────────────────────────────────────────────

const ALL_AREAS_SERVED = [
  ...AREAS.primary.map((a) => ({ '@type': 'City', name: a.name, 'containedInPlace': { '@type': 'AdministrativeArea', name: `${a.county} County, North Carolina` } })),
  ...AREAS.growing.map((a) => ({ '@type': 'City', name: a.name, 'containedInPlace': { '@type': 'AdministrativeArea', name: `${a.county} County, North Carolina` } })),
  ...AREAS.mainland.map((a) => ({ '@type': 'City', name: a.name, 'containedInPlace': { '@type': 'AdministrativeArea', name: `${a.county} County, North Carolina` } })),
  { '@type': 'AdministrativeArea', name: 'Dare County, North Carolina' },
  { '@type': 'AdministrativeArea', name: 'Currituck County, North Carolina' },
  { '@type': 'AdministrativeArea', name: 'Outer Banks, North Carolina' },
]

// ─── LocalBusiness (core — included on every page) ─────────────────────────

export function getLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['PavingContractor', 'LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': BUSINESS_ID,
    name: SITE.name,
    alternateName: ['OBX Paving', 'Outer Banks Paving Company', 'OBX Asphalt'],
    legalName: 'OBX Paving Co.',
    description: SITE.description,
    slogan: SITE.tagline,
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      '@id': `${BASE_URL}/#logo`,
      url: `${BASE_URL}/logo.png`,
      width: 512,
      height: 512,
      caption: SITE.name,
    },
    image: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/og-default.jpg`,
      width: 1200,
      height: 630,
    },
    telephone: '+1-252-555-0140',
    email: SITE.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Kill Devil Hills, NC',
      addressLocality: 'Kill Devil Hills',
      addressRegion: 'NC',
      postalCode: '27948',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 35.9957,
      longitude: -75.6243,
    },
    hasMap: 'https://maps.google.com/?q=Kill+Devil+Hills+NC+27948',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:00',
        closes: '17:00',
      },
    ],
    priceRange: '$$',
    paymentAccepted: 'Cash, Check, Credit Card, ACH',
    currenciesAccepted: 'USD',
    areaServed: ALL_AREAS_SERVED,
    serviceArea: {
      '@type': 'GeoCircle',
      geoMidpoint: { '@type': 'GeoCoordinates', latitude: 35.9957, longitude: -75.6243 },
      geoRadius: '120000',
    },
    knowsAbout: [
      'Asphalt Paving',
      'Sealcoating',
      'Crack Repair',
      'Parking Lot Construction',
      'Driveway Paving',
      'Coastal Asphalt',
      'Preventive Pavement Maintenance',
      'HOA Paving Services',
      'Vacation Rental Property Maintenance',
      'North Carolina Contractor',
    ],
    hasCredential: [
      { '@type': 'EducationalOccupationalCredential', name: 'North Carolina General Contractor License' },
      { '@type': 'EducationalOccupationalCredential', name: 'NC DOT Prequalified Contractor' },
    ],
    memberOf: [
      { '@type': 'Organization', name: 'National Asphalt Pavement Association (NAPA)' },
      { '@type': 'Organization', name: 'Outer Banks Association of REALTORS' },
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '100',
      bestRating: '5',
      worstRating: '1',
    },
    review: TESTIMONIALS.map((t) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: t.name },
      reviewRating: { '@type': 'Rating', ratingValue: String(t.stars), bestRating: '5' },
      reviewBody: t.text,
      publisher: { '@id': BUSINESS_ID },
    })),
    sameAs: [
      SITE.social.facebook,
      SITE.social.instagram,
      SITE.social.google,
      'https://www.bbb.org/',
      'https://www.yelp.com/',
      'https://www.angi.com/',
      'https://www.houzz.com/',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Asphalt Paving & Sealcoating Services',
      itemListElement: SERVICES.map((s, i) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          '@id': `${BASE_URL}/services#${s.id}`,
          name: s.title,
          description: s.shortDesc,
          provider: { '@id': BUSINESS_ID },
          areaServed: ALL_AREAS_SERVED,
          serviceType: s.title,
        },
        position: i + 1,
        priceCurrency: 'USD',
        seller: { '@id': BUSINESS_ID },
      })),
    },
    foundingDate: '2009',
    numberOfEmployees: { '@type': 'QuantitativeValue', minValue: 5, maxValue: 20 },
  }
}

// ─── Organization ───────────────────────────────────────────────────────────

export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-252-555-0140',
      contactType: 'customer service',
      areaServed: 'US-NC',
      availableLanguage: 'English',
    },
    sameAs: [SITE.social.facebook, SITE.social.instagram],
  }
}

// ─── WebSite (home page only) ────────────────────────────────────────────────

export function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    url: BASE_URL,
    description: SITE.description,
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/services?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: 'en-US',
  }
}

// ─── WebPage base ────────────────────────────────────────────────────────────

export function getWebPageSchema({ name, description, path, dateModified }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${BASE_URL}${path}#webpage`,
    url: `${BASE_URL}${path}`,
    name,
    description,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': BUSINESS_ID },
    datePublished: '2024-01-01',
    dateModified: dateModified || new Date().toISOString().slice(0, 10),
    inLanguage: 'en-US',
    breadcrumb: getBreadcrumbSchema(path),
  }
}

// ─── BreadcrumbList ──────────────────────────────────────────────────────────

export function getBreadcrumbSchema(path) {
  const crumbs = [{ name: 'Home', path: '/' }]
  const segments = path.replace(/\/$/, '').split('/').filter(Boolean)
  let current = ''
  for (const seg of segments) {
    current += `/${seg}`
    crumbs.push({
      name: seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      path: current,
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${BASE_URL}${c.path}`,
    })),
  }
}

// ─── FAQPage ─────────────────────────────────────────────────────────────────

export function getFAQSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }
}

// ─── Individual Service ───────────────────────────────────────────────────────

export function getServiceSchema(service) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${BASE_URL}/services#${service.id}`,
    name: service.title,
    serviceType: service.title,
    description: service.fullDesc,
    provider: { '@id': BUSINESS_ID },
    areaServed: ALL_AREAS_SERVED,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${service.title} Options`,
      itemListElement: service.highlights.map((h, i) => ({
        '@type': 'Offer',
        position: i + 1,
        itemOffered: { '@type': 'Service', name: h },
      })),
    },
  }
}

// ─── Services page — OfferCatalog ─────────────────────────────────────────────

export function getServicesPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Asphalt Paving & Sealcoating Services — OBX Paving Co.',
    description: 'Full list of coastal asphalt paving and sealcoating services for the Outer Banks of North Carolina.',
    url: `${BASE_URL}/services`,
    numberOfItems: SERVICES.length,
    itemListElement: SERVICES.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Service',
        '@id': `${BASE_URL}/services#${s.id}`,
        name: s.title,
        description: s.shortDesc,
        provider: { '@id': BUSINESS_ID },
      },
    })),
  }
}

// ─── Service area page ────────────────────────────────────────────────────────

export function getServiceAreaPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Asphalt Paving & Sealcoating — Outer Banks, NC',
    provider: { '@id': BUSINESS_ID },
    areaServed: ALL_AREAS_SERVED,
    description: 'Professional asphalt paving and sealcoating across all Outer Banks communities in Dare County, Currituck County, and surrounding northeastern NC areas.',
    serviceArea: {
      '@type': 'GeoCircle',
      geoMidpoint: { '@type': 'GeoCoordinates', latitude: 35.9957, longitude: -75.6243 },
      geoRadius: '120000',
    },
  }
}

// ─── ContactPage ──────────────────────────────────────────────────────────────

export function getContactPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${BASE_URL}/contact#webpage`,
    url: `${BASE_URL}/contact`,
    name: 'Get a Free Quote — OBX Paving Co.',
    description: 'Request a free asphalt paving or sealcoating quote for your Outer Banks property.',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': BUSINESS_ID },
    mainEntity: { '@id': BUSINESS_ID },
  }
}

// ─── AboutPage ────────────────────────────────────────────────────────────────

export function getAboutPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${BASE_URL}/about#webpage`,
    url: `${BASE_URL}/about`,
    name: 'About OBX Paving Co. — Outer Banks Asphalt Contractor',
    description: 'OBX Paving Co. is a licensed and insured asphalt paving and sealcoating contractor based in Kill Devil Hills, NC.',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': BUSINESS_ID },
    mainEntity: { '@id': ORG_ID },
  }
}
