/**
 * KickservEstimate — embeds the J. Worden & Sons Kickserv self-service
 * estimate-request form so leads land directly in the Kickserv CRM
 * (scheduling, estimating, invoicing) with no manual re-entry.
 *
 * Requires `https://app.kickserv.com` in the CSP `frame-src` allow-list
 * (see netlify.toml) or the iframe renders blank.
 */
import { trackEvent } from '../api/client'

// Account slug from the Kickserv portal URL.
const KICKSERV_ACCOUNT = 'jwordenandsonspaving'
const KICKSERV_FORM_PATH = 'self_service/requests/new'

// Embedded iframe URL (adds ?iframe=true so Kickserv strips its own chrome).
const KICKSERV_IFRAME_SRC = `https://app.kickserv.com/${KICKSERV_ACCOUNT}/${KICKSERV_FORM_PATH}?iframe=true`
// Plain URL for the "open in a new window" fallback.
const KICKSERV_DIRECT_URL = `https://app.kickserv.com/${KICKSERV_ACCOUNT}/${KICKSERV_FORM_PATH}`

export default function KickservEstimate({ className = '', height = 1000 }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border border-brand-navy/10 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="bg-brand-navy text-white px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <div className="font-display font-bold text-lg">Request Your Free Estimate</div>
            <div className="text-white/50 text-sm">
              Goes straight to our scheduling team — we respond within 24 hours.
            </div>
          </div>
        </div>
        <a
          href={KICKSERV_DIRECT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('kickserv_open_new_window', { source: 'estimate_embed' })}
          className="hidden sm:inline-block text-xs font-semibold text-brand-amber underline-offset-4 hover:underline whitespace-nowrap"
        >
          Open in new window ↗
        </a>
      </div>

      {/* Embedded Kickserv self-service request form */}
      <iframe
        src={KICKSERV_IFRAME_SRC}
        title="Request a free estimate from J. Worden & Sons"
        className="w-full"
        style={{ border: 'none', height: `${height}px` }}
        scrolling="auto"
        loading="lazy"
        onLoad={() => trackEvent('kickserv_form_loaded', { source: 'estimate_embed' })}
      />

      {/* Mobile fallback link (header link is hidden on small screens) */}
      <div className="sm:hidden border-t border-gray-100 px-6 py-3 text-center">
        <a
          href={KICKSERV_DIRECT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('kickserv_open_new_window', { source: 'estimate_embed_mobile' })}
          className="text-sm font-semibold text-brand-navy underline-offset-4 hover:underline"
        >
          Trouble loading the form? Open it in a new window ↗
        </a>
      </div>
    </div>
  )
}
