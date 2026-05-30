/**
 * KickservEstimate — call-to-action card that sends customers to the
 * J. Worden & Sons Kickserv self-service estimate-request form so leads
 * land directly in the Kickserv CRM (scheduling, estimating, invoicing).
 *
 * Opens in a new tab rather than an iframe: Kickserv's self-service page
 * refuses to be framed on third-party domains ("This content is blocked"),
 * so a new-tab link is the reliable path that always works.
 */
import { trackEvent } from '../api/client'

// Account slug from the Kickserv portal URL.
const KICKSERV_ACCOUNT = 'jwordenandsonspaving'
// Public self-service estimate request form (no ?iframe=true — opens standalone).
const KICKSERV_URL = `https://app.kickserv.com/${KICKSERV_ACCOUNT}/self_service/requests/new`

export default function KickservEstimate({ className = '' }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border border-brand-navy/10 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="bg-brand-navy text-white px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <div className="font-display font-bold text-lg">Request Your Free Estimate</div>
            <div className="text-white/50 text-sm">
              Goes straight to our scheduling team — we respond within 24 hours.
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 sm:p-8 text-center">
        <p className="text-brand-navy/70 mb-6 leading-relaxed">
          Tell us about your project and we&apos;ll get you a detailed, no-obligation estimate.
          The form takes about 2 minutes — your request comes straight to our team.
        </p>

        <a
          href={KICKSERV_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('kickserv_estimate_click', { source: 'quote_page' })}
          className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 text-base"
        >
          Start My Free Estimate →
        </a>

        <p className="text-brand-navy/40 text-xs mt-4">
          Opens our secure request form in a new tab.
        </p>
      </div>
    </div>
  )
}
