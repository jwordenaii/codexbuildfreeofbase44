/**
 * Schema.org JSON-LD builder functions.
 *
 * Kept in a separate module so that SchemaMarkup.jsx can be a
 * pure component file (required by react-refresh/only-export-components).
 *
 * SITE_URL is read from VITE_SITE_URL at build time so that staging and
 * production deployments automatically use the correct canonical domain.
 */

export const SITE_URL =
  import.meta.env.VITE_SITE_URL || 'https://www.jwordenasphaltpaving.com'

export const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': ['PavingContractor', 'LocalBusiness'],
  name: 'J. Worden & Sons Asphalt Paving',
  description:
    'Fourth-generation asphalt paving company serving residential and commercial clients since 1984.',
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

export function serviceSchema(name, description, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    provider: {
      '@type': 'LocalBusiness',
      name: 'J. Worden & Sons Asphalt Paving',
      url: SITE_URL,
    },
    areaServed: { '@type': 'State', name: 'Your State' },
    url: `${SITE_URL}${url}`,
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
