/**
 * SocialShare — "Share this page" button row with per-platform links
 * and a copy-to-clipboard action.
 *
 * Props:
 *   path       — canonical path for this page, e.g. "/projects"
 *   text       — pre-populated share text
 *   compact    — boolean, show fewer platforms + smaller buttons
 *   className  — extra wrapper classes
 */

import { useState } from 'react'
import { buildShareUrl, buildShareLinks } from '../lib/social'
import { trackEvent } from '../api/client'

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      className="w-full h-full"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
      className="w-full h-full"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const SHARE_PLATFORMS = [
  {
    key: 'facebook',
    label: 'Facebook',
    bg: 'bg-[#1877F2] hover:bg-[#0e6ae0]',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.258h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
      </svg>
    ),
  },
  {
    key: 'twitter',
    label: 'X',
    bg: 'bg-black hover:bg-gray-800',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    bg: 'bg-[#0A66C2] hover:bg-[#0958aa]',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    bg: 'bg-[#25D366] hover:bg-[#1db954]',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
      </svg>
    ),
  },
]

export default function SocialShare({
  path = '/',
  text = 'J. Worden & Sons — 4th-Generation Asphalt Paving Since 1984',
  compact = false,
  className = '',
}) {
  const [copied, setCopied] = useState(false)

  const pageUrl = buildShareUrl(path, { utm_source: 'social', utm_campaign: 'page_share' })
  const shareLinks = buildShareLinks(pageUrl, text)

  const platforms = compact ? SHARE_PLATFORMS.slice(0, 3) : SHARE_PLATFORMS

  function handleShare(key, url) {
    trackEvent('social_share', { platform: key, path })
    window.open(url, '_blank', 'width=600,height=400,noopener,noreferrer')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
      trackEvent('share_copy_link', { path })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select a temp input
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs font-semibold text-brand-navy/50 uppercase tracking-widest mr-1">
        Share
      </span>

      {platforms.map(({ key, label, bg, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-label={`Share on ${label}`}
          title={`Share on ${label}`}
          onClick={() => handleShare(key, shareLinks[key])}
          className={`w-8 h-8 rounded-lg text-white flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-amber ${bg}`}
        >
          <span className="w-4 h-4">
            <Icon />
          </span>
        </button>
      ))}

      {/* Copy link */}
      <button
        type="button"
        aria-label="Copy page link"
        title="Copy link"
        onClick={handleCopy}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-amber ${
          copied ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-brand-navy'
        }`}
      >
        <span className="w-4 h-4">{copied ? <CheckIcon /> : <CopyIcon />}</span>
      </button>
    </div>
  )
}
