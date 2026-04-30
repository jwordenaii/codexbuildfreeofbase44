/**
 * Schema.org JSON-LD builder functions.
 *
 * Kept in a separate module so that SchemaMarkup.jsx can be a
 * pure component file (required by react-refresh/only-export-components).
 *
 * SITE_URL is read from VITE_SITE_URL at build time so that staging and
 * production deployments automatically use the correct canonical domain.
 */

import { SAME_AS_URLS } from './social'
import STATES, { WORDEN_ACTIVE_STATES } from './states50'
import {
  ADDRESS,
  AGGREGATE_RATING,
  BUSINESS_DESCRIPTION,
  BUSINESS_FOUNDING_YEAR,
  BUSINESS_LEGAL_NAME,
  BUSINESS_NAME,
  EMAIL,
  FOUNDER,
  GEO,
  OPENING_HOURS,
  PHONE_E164,
  PHONE_SCHEMA,
  SCHEMA_IDS,
  SITE_URL as BUSINESS_SITE_URL,
} from './businessInfo'

export const SITE_URL = BUSINESS_SITE_URL

// National area served — all 50 states + DC via Schema.org State objects.
// Google uses this to understand the contractor's service geography.
// WORDEN_ACTIVE_STATES are listed first (verified completed work).
const _activeSet = new Set(WORDEN_ACTIVE_STATES)
const _sortedStates = [
  ...STATES.filter((s) => _activeSet.has(s.abbr)),
  ...STATES.filter((s) => !_activeSet.has(s.abbr)),
]
const NATIONAL_AREA_SERVED = _sortedStates.map((s) => ({
  '@type': 'State',
  name: s.name,
  containedInPlace: { '@type': 'Country', name: 'United States' },
}))

const POSTAL_ADDRESS = {
  '@type': 'PostalAddress',
  ...ADDRESS,
}

const OPENING_HOURS_SPEC = OPENING_HOURS.map((h) => ({
  '@type': 'OpeningHoursSpecification',
  ...h,
}))

const AGGREGATE_RATING_SCHEMA = {
  '@type': 'AggregateRating',
  ...AGGREGATE_RATING,
}

export const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': ['PavingContractor', 'LocalBusiness'],
  '@id': SCHEMA_IDS.localBusiness,
  name: BUSINESS_NAME,
  legalName: BUSINESS_LEGAL_NAME,
  description: BUSINESS_DESCRIPTION,
  foundingDate: BUSINESS_FOUNDING_YEAR,
  telephone: PHONE_SCHEMA,
  email: EMAIL,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/logo.png`,
  sameAs: SAME_AS_URLS,
  parentOrganization: { '@id': SCHEMA_IDS.organization },
  founder: { '@id': SCHEMA_IDS.founder },
  address: POSTAL_ADDRESS,
  geo: {
    '@type': 'GeoCoordinates',
    latitude: GEO.latitude,
    longitude: GEO.longitude,
  },
  areaServed: NATIONAL_AREA_SERVED,
  openingHoursSpecification: OPENING_HOURS_SPEC,
  aggregateRating: AGGREGATE_RATING_SCHEMA,
}

/**
 * Brand-level Organization entity. Carries the canonical sameAs list and
 * acts as the parent of the LocalBusiness. Inject once on the homepage
 * (and only there) so Google has a single, stable brand node to bind the
 * Knowledge Panel to.
 */
export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': SCHEMA_IDS.organization,
  name: BUSINESS_NAME,
  legalName: BUSINESS_LEGAL_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: BUSINESS_DESCRIPTION,
  foundingDate: BUSINESS_FOUNDING_YEAR,
  sameAs: SAME_AS_URLS,
  contactPoint: [
    {
      '@type': 'ContactPoint',
      telephone: PHONE_SCHEMA,
      contactType: 'customer service',
      email: EMAIL,
      areaServed: 'US',
      availableLanguage: ['English', 'Spanish'],
    },
  ],
  subOrganization: { '@id': SCHEMA_IDS.localBusiness },
  founder: { '@id': SCHEMA_IDS.founder },
}

/**
 * WebSite entity with SearchAction — qualifies the homepage for Google's
 * Sitelinks Search Box. The {search_term_string} placeholder must match
 * the query parameter the site uses for in-site search results.
 */
export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': SCHEMA_IDS.website,
  url: SITE_URL,
  name: BUSINESS_NAME,
  publisher: { '@id': SCHEMA_IDS.organization },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

/**
 * Person schema for the founder. Inject on /about so Google has a stable
 * author/owner entity for E-E-A-T signals. Keep the displayed name on the
 * page and `FOUNDER.name` here in lockstep.
 */
export const FOUNDER_PERSON_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': SCHEMA_IDS.founder,
  name: FOUNDER.name,
  jobTitle: FOUNDER.jobTitle,
  description: FOUNDER.description,
  worksFor: { '@id': SCHEMA_IDS.localBusiness },
  url: `${SITE_URL}/about`,
}

export function serviceSchema(name, description, url, priceRange) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    provider: {
      '@type': 'LocalBusiness',
      '@id': SCHEMA_IDS.localBusiness,
      name: BUSINESS_NAME,
      telephone: PHONE_E164,
      url: SITE_URL,
    },
    areaServed: NATIONAL_AREA_SERVED,
    ...(priceRange
      ? {
          offers: {
            '@type': 'Offer',
            priceSpecification: {
              '@type': 'PriceSpecification',
              priceCurrency: 'USD',
              description: priceRange,
            },
          },
        }
      : {}),
    url: `${SITE_URL}${url}`,
  }
}

export function howToSchema(name, description, steps) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  }
}

export function videoObjectSchema({ name, description, thumbnailUrl, uploadDate, contentUrl }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl,
    uploadDate,
    ...(contentUrl ? { contentUrl } : {}),
    publisher: {
      '@type': 'Organization',
      '@id': SCHEMA_IDS.organization,
      name: BUSINESS_NAME,
      url: SITE_URL,
    },
  }
}

export function faqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}

export function reviewsSchema(reviews, aggregateRating) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': SCHEMA_IDS.localBusiness,
    name: BUSINESS_NAME,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(aggregateRating),
      bestRating: '5',
      worstRating: '1',
      reviewCount: String(reviews.length),
    },
    review: reviews.map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewRating: { '@type': 'Rating', ratingValue: String(r.rating) },
      reviewBody: r.text,
      datePublished: r.date,
    })),
  }
}
