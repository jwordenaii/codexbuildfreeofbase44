import { useLocation } from 'react-router-dom'
import { PHONE_E164, PHONE_DISPLAY, SMS_E164, SMS_PREFILL } from '../lib/businessInfo'
import { trackEvent } from '../api/client'

/**
 * Sticky bottom mobile bar with one-tap phone + quote CTA.
 *
 * Visible on commercial-intent public pages only (Home, Service Areas,
 * City pages, Services, Blog, BlogPost, Quote, Contact). Hidden on
 * desktop (≥768px), inside command-center / advisory dashboards, and
 * the Visualizer (which has its own bottom UI). Single tap = phone
 * call — the strongest mobile-conversion signal for a local trade
 * site, and it feeds Google's click-to-call ranking signals.
 */

// Routes where the bar should be visible. Any other route hides it.
const ALLOWED_PREFIXES = [
  '/',
  '/services',
  '/about',
  '/reviews',
  '/projects',
  '/contact',
  '/quote',
  '/gallery',
  '/service-areas',
  '/blog',
  '/states',
  '/jwordenai',
  '/ai-research',
]

// Routes that explicitly hide the bar even when prefix matches.
const HIDDEN_PREFIXES = ['/command-center', '/advisory', '/visualizer']

function shouldShow(pathname) {
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false
  }
  return ALLOWED_PREFIXES.some((p) =>
    p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)
  )
}

export default function MobileCallBar() {
  const { pathname } = useLocation()
  if (!shouldShow(pathname)) return null

  return (
    <div
      // pb env() respects iPhone home-indicator safe area so the buttons
      // never sit under the system gesture bar.
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-brand-navy border-t-2 border-brand-amber shadow-2xl pb-[env(safe-area-inset-bottom)]"
      role="region"
      aria-label="Quick contact"
    >
      <div className="flex items-stretch">
        <a
          href={`tel:${PHONE_E164}`}
          // min-h ≥ 56px satisfies WCAG 2.2 / Google Lighthouse "Tap targets"
          // audit (recommended ≥ 48×48). Bigger and bolder so it reads as
          // the primary mobile action.
          className="flex-1 flex items-center justify-center gap-2 min-h-[56px] py-3 text-white font-extrabold text-base hover:bg-white/10 active:bg-white/20 transition-colors"
          onClick={() => trackEvent('phone_click', { location: 'mobile_call_bar' })}
          aria-label={`Call J. Worden & Sons at ${PHONE_DISPLAY}`}
        >
          <svg
            className="w-5 h-5 text-brand-amber"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.05-.24c1.16.39 2.4.6 3.67.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A18 18 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.27.21 2.51.6 3.67a1 1 0 0 1-.24 1.05l-2.24 2.07Z" />
          </svg>
          <span>Call {PHONE_DISPLAY}</span>
        </a>
        <a
          href={`sms:${SMS_E164}?&body=${encodeURIComponent(SMS_PREFILL)}`}
          className="flex items-center justify-center gap-2 min-h-[56px] px-4 bg-emerald-600 text-white font-extrabold text-base hover:bg-emerald-700 active:brightness-95 transition-colors"
          onClick={() => trackEvent('sms_click', { location: 'mobile_call_bar' })}
          aria-label="Text us for a free quote"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" />
          </svg>
          Text
        </a>
        <a
          href="/quote"
          className="flex items-center justify-center gap-2 min-h-[56px] px-4 bg-brand-amber text-brand-navy font-extrabold text-base hover:bg-brand-amber-dark active:brightness-95 transition-colors"
          onClick={() => trackEvent('cta_click', { location: 'mobile_call_bar' })}
        >
          Quote
        </a>
      </div>
    </div>
  )
}
