/* eslint-disable react-refresh/only-export-components */
import { Helmet, HelmetData } from 'react-helmet-async'
import { SITE_URL } from '../lib/schemas'

// Re-export schema helpers so existing page imports still work via this path.
export {
  LOCAL_BUSINESS_SCHEMA,
  ORGANIZATION_SCHEMA,
  WEBSITE_SCHEMA,
  FOUNDER_PERSON_SCHEMA,
  serviceSchema,
  faqSchema,
  reviewsSchema,
  howToSchema,
  videoObjectSchema,
} from '../lib/schemas'

const standaloneHelmetData = new HelmetData({})

/**
 * Injects SEO meta tags, Open Graph, Twitter Card, and JSON-LD
 * structured data into <head> for a given page.
 *
 * Props:
 *   title       — page <title> (appended with brand)
 *   description — meta description (max ~160 chars)
 *   canonical   — canonical path, e.g. "/services"
 *   image       — absolute OG image URL (defaults to /og-default.jpg)
 *   schema      — JSON-LD object (or array of objects) to inject
 *   breadcrumb  — array of { name, path } for BreadcrumbList schema
 */
export default function SchemaMarkup({
  title,
  description,
  canonical = '/',
  image = `${SITE_URL}/og-default.jpg`,
  schema,
  breadcrumb,
}) {
  const fullTitle = `${title} | J. Worden & Sons Asphalt Paving`
  const canonicalUrl = `${SITE_URL}${canonical}`

  const schemas = []

  // Inject provided schema(s)
  if (schema) {
    if (Array.isArray(schema)) schemas.push(...schema)
    else schemas.push(schema)
  }

  // BreadcrumbList
  if (breadcrumb && breadcrumb.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumb.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: `${SITE_URL}${item.path}`,
      })),
    })
  }

  return (
    <Helmet helmetData={standaloneHelmetData}>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="J. Worden & Sons Asphalt Paving" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@JWordenSons" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD blocks */}
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  )
}
