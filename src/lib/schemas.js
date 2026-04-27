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

export const SITE_URL =
  import.meta.env.VITE_SITE_URL || 'https://www.jwordenasphaltpaving.com'

// National area served — all 50 states + DC via Schema.org State objects.
// Google uses this to understand the contractor's service geography.
// WORDEN_ACTIVE_STATES are listed first (verified completed work).
const _activeSet = new Set(WORDEN_ACTIVE_STATES)
const _sortedStates = [
  ...STATES.filter(s => _activeSet.has(s.abbr)),
  ...STATES.filter(s => !_activeSet.has(s.abbr)),
]
const NATIONAL_AREA_SERVED = _sortedStates.map(s => ({
  '@type': 'State',
  name: s.name,
  containedInPlace: { '@type': 'Country', name: 'United States' },
}))

export const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': ['PavingContractor', 'LocalBusiness'],
  name: 'J. Worden & Sons Asphalt Paving',
  description:
    'Family-owned asphalt paving contractor est. 1984. KFC national QSR new-build and remodel program across 12+ states. ' +
    'Pavement Magazine Top 75 (4 categories). Best of Houzz. 2026 Top Contractor Nominee.',
  foundingDate: '1984',
  telephone: '+1-804-446-1296',
  email: 'contact@jworden.com',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  sameAs: [
    'https://www.facebook.com/jwordenpaving/',
    'https://www.linkedin.com/showcase/j.-worden-%26-sons-paving-l.l.c./',
    'https://nextdoor.com/pages/nashville-asphalt-paving-pros-chester-va/photos/',
    'https://www.alignable.com/chester-va/j-worden-sons-paving',
    'https://www.houzz.com/professionals/stone-pavers-and-concrete/j-worden-and-sons-paving-l-l-c-pfvwus-pf~663227484',
  ],
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Chester',
    addressRegion: 'VA',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 37.3529,
    longitude: -77.4326,
  },
  areaServed: NATIONAL_AREA_SERVED,
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '07:00',
      closes: '17:00',
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    bestRating: '5',
    worstRating: '1',
    reviewCount: '87',
  },
}

export function serviceSchema(name, description, url, priceRange) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    provider: {
      '@type': 'LocalBusiness',
      name: 'J. Worden & Sons Asphalt Paving',
      telephone: '+18044461296',
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
      name: 'J. Worden & Sons Asphalt Paving',
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
    name: 'J. Worden & Sons Asphalt Paving',
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
