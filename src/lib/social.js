/**
 * Social media configuration for J. Worden & Sons.
 *
 * All platform URLs, handles, and sharing utilities live here.
 * Override individual URLs via environment variables so staging and
 * production can point to different profiles without code changes.
 */

export const SOCIAL_PROFILES = {
  facebook: {
    url: import.meta.env.VITE_FACEBOOK_URL || 'https://www.facebook.com/JWordenSons',
    label: 'Facebook',
    handle: 'JWordenSons',
    color: '#1877F2',
  },
  instagram: {
    url: import.meta.env.VITE_INSTAGRAM_URL || 'https://www.instagram.com/jwordensons',
    label: 'Instagram',
    handle: '@jwordensons',
    color: '#E1306C',
  },
  youtube: {
    url: import.meta.env.VITE_YOUTUBE_URL || 'https://www.youtube.com/@JWordenSons',
    label: 'YouTube',
    handle: '@JWordenSons',
    color: '#FF0000',
  },
  linkedin: {
    url: import.meta.env.VITE_LINKEDIN_URL || 'https://www.linkedin.com/company/jworden-sons',
    label: 'LinkedIn',
    handle: 'J. Worden & Sons',
    color: '#0A66C2',
  },
  twitter: {
    url: import.meta.env.VITE_TWITTER_URL || 'https://twitter.com/JWordenSons',
    label: 'X / Twitter',
    handle: '@JWordenSons',
    color: '#000000',
  },
  nextdoor: {
    url: import.meta.env.VITE_NEXTDOOR_URL || 'https://nextdoor.com/pages/jworden-sons-chester-va',
    label: 'Nextdoor',
    handle: 'J. Worden & Sons',
    color: '#8DB600',
  },
}

/** Ordered list for display — most impactful platforms first. */
export const SOCIAL_DISPLAY_ORDER = [
  'facebook',
  'instagram',
  'youtube',
  'linkedin',
  'twitter',
  'nextdoor',
]

/**
 * Flat array of all profile URLs — injected into Schema.org `sameAs`
 * to tell Google which social accounts belong to this business.
 */
export const SAME_AS_URLS = SOCIAL_DISPLAY_ORDER.map((k) => SOCIAL_PROFILES[k].url)

/**
 * Build a UTM-tagged canonical share URL for a given path.
 *
 * @param {string} path  — e.g. "/services" or "/projects"
 * @param {object} opts  — override utm_source, utm_medium, utm_campaign
 */
export function buildShareUrl(
  path,
  { utm_source = 'social', utm_medium = 'social', utm_campaign = 'share' } = {}
) {
  const base = import.meta.env.VITE_SITE_URL || 'https://jwordenasphaltpaving.com'
  const params = new URLSearchParams({ utm_source, utm_medium, utm_campaign })
  return `${base}${path}?${params.toString()}`
}

/**
 * Build ready-to-use platform share links for a given absolute URL.
 *
 * @param {string} pageUrl   — absolute URL to share (with UTM params already appended)
 * @param {string} shareText — pre-populated text for tweet / WhatsApp
 */
export function buildShareLinks(
  pageUrl,
  shareText = 'J. Worden & Sons — 4th-Generation Asphalt Paving Since 1984'
) {
  const encoded = encodeURIComponent(pageUrl)
  const encodedText = encodeURIComponent(shareText)
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    twitter: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedText}&via=JWordenSons`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
    whatsapp: `https://wa.me/?text=${encodedText}%20${encoded}`,
    email: `mailto:?subject=${encodeURIComponent('Check this out — J. Worden & Sons')}&body=${encodedText}%0A%0A${encoded}`,
  }
}
