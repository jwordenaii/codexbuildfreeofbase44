/**
 * SEO.jsx — best-practice document-head manager.
 *
 * Handles: title, description, canonical, robots, hreflang, Open Graph,
 * Twitter Card, geo meta, and one or more JSON-LD schema objects.
 *
 * Usage:
 *   <SEO
 *     title="Page Title | OBX Paving Co."
 *     description="Unique page description under 160 chars."
 *     canonicalPath="/services"
 *     schemas={[getWebPageSchema(...), getFAQSchema(faqs)]}
 *   />
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SITE } from '@/config/site.js'
import { getLocalBusinessSchema, getOrganizationSchema, getWebSiteSchema } from '@/lib/schema.js'

const CANONICAL_BASE = SITE.canonicalUrl.replace(/\/$/, '')

// ─── Meta helpers ────────────────────────────────────────────────────────────

function setMeta(selector, attr, value) {
  if (value === undefined || value === null || value === '') return
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    const m = selector.match(/\[(.+?)="(.+?)"\]/)
    if (m) el.setAttribute(m[1], m[2])
    document.head.appendChild(el)
  }
  el.setAttribute(attr, String(value))
}

function setLink(rel, href, extra = {}) {
  if (!href) return
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v)
}

function injectSchema(id, data) {
  const existing = document.head.querySelector(`script[data-schema-id="${id}"]`)
  if (existing) existing.remove()
  const s = document.createElement('script')
  s.type = 'application/ld+json'
  s.setAttribute('data-schema-id', id)
  s.text = JSON.stringify(data)
  document.head.appendChild(s)
}

function removeSchemas(prefix) {
  document.head.querySelectorAll(`script[data-schema-id^="${prefix}"]`).forEach((el) => el.remove())
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SEO({
  title,
  description,
  canonicalPath,
  ogImage = '/og-default.jpg',
  noindex = false,
  schemas = [],            // array of JSON-LD schema objects for this page
  skipGlobalSchemas = false, // set true to suppress LocalBusiness/Org/WebSite on page
}) {
  const { pathname } = useLocation()
  const resolvedPath = canonicalPath ?? pathname
  const normalizedPath = resolvedPath !== '/' ? resolvedPath.replace(/\/+$/, '') : '/'
  const canonicalUrl = `${CANONICAL_BASE}${normalizedPath === '/' ? '' : normalizedPath}`
  const ogImageUrl = ogImage.startsWith('http') ? ogImage : `${CANONICAL_BASE}${ogImage}`
  const siteName = SITE.name

  useEffect(() => {
    // ── Title ───────────────────────────────────────────────────────────────
    if (title) document.title = title

    // ── Description ─────────────────────────────────────────────────────────
    setMeta('meta[name="description"]', 'content', description)

    // ── Robots ──────────────────────────────────────────────────────────────
    setMeta('meta[name="robots"]', 'content',
      noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
    setMeta('meta[name="googlebot"]', 'content',
      noindex ? 'noindex, nofollow' : 'index, follow')

    // ── Canonical ────────────────────────────────────────────────────────────
    setLink('canonical', canonicalUrl)

    // ── Hreflang ─────────────────────────────────────────────────────────────
    setLink('alternate', canonicalUrl, { hreflang: 'en-US' })
    setLink('alternate', canonicalUrl, { hreflang: 'x-default' })

    // ── Open Graph ───────────────────────────────────────────────────────────
    setMeta('meta[property="og:type"]', 'content', normalizedPath === '/' ? 'website' : 'article')
    setMeta('meta[property="og:title"]', 'content', title || siteName)
    setMeta('meta[property="og:description"]', 'content', description || SITE.description)
    setMeta('meta[property="og:url"]', 'content', canonicalUrl)
    setMeta('meta[property="og:image"]', 'content', ogImageUrl)
    setMeta('meta[property="og:image:width"]', 'content', '1200')
    setMeta('meta[property="og:image:height"]', 'content', '630')
    setMeta('meta[property="og:image:alt"]', 'content', title || siteName)
    setMeta('meta[property="og:site_name"]', 'content', siteName)
    setMeta('meta[property="og:locale"]', 'content', 'en_US')

    // ── Twitter Card ─────────────────────────────────────────────────────────
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', 'content', title || siteName)
    setMeta('meta[name="twitter:description"]', 'content', description || SITE.description)
    setMeta('meta[name="twitter:image"]', 'content', ogImageUrl)
    setMeta('meta[name="twitter:image:alt"]', 'content', title || siteName)

    // ── Geo ──────────────────────────────────────────────────────────────────
    setMeta('meta[name="geo.region"]', 'content', 'US-NC')
    setMeta('meta[name="geo.placename"]', 'content', 'Kill Devil Hills, North Carolina')
    setMeta('meta[name="geo.position"]', 'content', '35.9957;-75.6243')
    setMeta('meta[name="ICBM"]', 'content', '35.9957, -75.6243')

    // ── Article meta (freshness signal) ─────────────────────────────────────
    setMeta('meta[property="article:publisher"]', 'content', SITE.social.facebook)

    // ── Global schemas (LocalBusiness, Organization, WebSite) ───────────────
    if (!skipGlobalSchemas) {
      injectSchema('local-business', getLocalBusinessSchema())
      injectSchema('organization', getOrganizationSchema())
      if (normalizedPath === '/') {
        injectSchema('website', getWebSiteSchema())
      }
    }

    // ── Page-specific schemas ────────────────────────────────────────────────
    removeSchemas('page-')
    schemas.forEach((schema, i) => {
      injectSchema(`page-${i}`, schema)
    })

    return () => {
      // Cleanup page schemas on unmount
      removeSchemas('page-')
    }
  }, [title, description, canonicalPath, pathname, ogImage, noindex, schemas, skipGlobalSchemas])

  return null
}
