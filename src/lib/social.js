/**
 * Social media configuration for J. Worden & Sons.
 *
 * All platform URLs, handles, and sharing utilities live here.
 * Override individual URLs via environment variables so staging and
 * production can point to different profiles without code changes.
 */

export const SOCIAL_PROFILES = {
  facebook: {
    url: import.meta.env.VITE_FACEBOOK_URL || 'https://www.facebook.com/jwordenpaving/',
    label: 'Facebook',
    handle: 'jwordenpaving',
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
    url:
      import.meta.env.VITE_LINKEDIN_URL ||
      'https://www.linkedin.com/showcase/j.-worden-%26-sons-paving-l.l.c./',
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
    url:
      import.meta.env.VITE_NEXTDOOR_URL ||
      'https://nextdoor.com/pages/nashville-asphalt-paving-pros-chester-va/',
    label: 'Nextdoor',
    handle: 'J. Worden & Sons',
    color: '#8DB600',
  },
  alignable: {
    url:
      import.meta.env.VITE_ALIGNABLE_URL ||
      'https://www.alignable.com/chester-va/j-worden-sons-paving',
    label: 'Alignable',
    handle: 'J. Worden & Sons',
    color: '#1F2D5A',
  },
  houzz: {
    url:
      import.meta.env.VITE_HOUZZ_URL ||
      'https://www.houzz.com/professionals/stone-pavers-and-concrete/j-worden-and-sons-paving-l-l-c-pfvwus-pf~663227484',
    label: 'Houzz',
    handle: 'J. Worden & Sons',
    color: '#7AC142',
  },
}

/** Ordered list for display in icon strips — only platforms with icon assets in SocialLinks.jsx. */
export const SOCIAL_DISPLAY_ORDER = [
  'facebook',
  'instagram',
  'youtube',
  'linkedin',
  'twitter',
  'nextdoor',
]

/**
 * All keys in SOCIAL_PROFILES — used for Schema.org `sameAs` so Google
 * sees every profile, even ones we don't render an icon for.
 */
export const SOCIAL_ALL_KEYS = Object.keys(SOCIAL_PROFILES)

/**
 * Flat array of all profile URLs — injected into Schema.org `sameAs`
 * to tell Google which social accounts belong to this business.
 */
export const SAME_AS_URLS = SOCIAL_ALL_KEYS.map((k) => SOCIAL_PROFILES[k].url)

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
