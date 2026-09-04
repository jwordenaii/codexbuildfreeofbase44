import { useState } from 'react'
import { Phone, MessageSquare, CheckCircle2 } from 'lucide-react'
import { api, trackEvent } from '../api/client'
import { PHONE_E164, PHONE_DISPLAY, SMS_E164, SMS_PREFILL } from '../lib/businessInfo'

/**
 * QuickQuoteBar — friction-free, single-input lead capture.
 *
 * Why it exists: the long quote form on /quote was scaring people away
 * (348 ad clicks → 0 real submissions). This component asks for ONE
 * thing — a phone number — and ships it to the lead pipeline. We auto-fill
 * safe defaults for required backend fields (property_type, urgency,
 * service_type) so the customer doesn't have to think.
 *
 * Drop in anywhere above the fold. Renders as a horizontal row on
 * desktop and stacks on mobile. Always shows the call-to-call button
 * because for trade services the phone tap is the highest-converting
 * action by far.
 */
export default function QuickQuoteBar({
  source = 'unknown_page',
  servicePreset = 'paving',
  className = '',
  headline = 'Get a free quote — text me first.',
  subline = 'Just your number. We respond by text within 1 hour, 7 days a week.',
}) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  function normalizeDigits(value) {
    return (value || '').replace(/\D+/g, '').slice(0, 11)
  }

  function isValidPhone(digits) {
    return digits.length === 10 || digits.length === 11
  }

  async function submit(e) {
    e.preventDefault()
    setErr('')
    const digits = normalizeDigits(phone)
    if (!isValidPhone(digits)) {
      setErr('Enter a 10-digit phone number')
      return
    }
    setBusy(true)

    // Synthesize a valid email so the backend's EmailStr validator passes.
    // The phone digits in the local-part keep the inbox readable for Gene.
    const syntheticEmail = `lead-${digits}@phoneonly.jwordenasphaltpaving.com`
    const payload = {
      name: 'Quick Lead (phone only)',
      email: syntheticEmail,
      phone: digits,
      service_type: servicePreset,
      property_type: 'residential',
      urgency: 'flexible',
      message: `1-tap quick-quote request from ${source}. Customer wants to be texted at ${digits}.`,
    }

    // The backend API is the only lead sink now.
    //
    // This used to fire a '/.netlify/functions/lead-fallback-notify' request in
    // parallel as an "always-on" safety net. Hosting moved off Netlify, so that
    // function no longer exists — the request just hit the SPA catch-all. The
    // net effect was worse than having no fallback: on a backend outage the code
    // below still showed the customer a success screen, on the assumption the
    // fallback had captured the lead. It had not.
    const apiResult = await api.submitQuote(payload).catch((e) => ({ __error: e }))

    setBusy(false)
    if (apiResult && apiResult.__error) {
      // Backend rejected and there is no secondary capture — do NOT claim
      // success. Tell the customer plainly and give them the phone number.
      trackEvent('quick_quote_failed', { source, error: String(apiResult.__error?.message || apiResult.__error) })
      setErr(`We couldn't submit that just now. Please call or text us at ${PHONE_DISPLAY}.`)
      return
    }

    trackEvent('quick_quote_submit', { source, lead_id: apiResult?.lead_id })
    setDone(true)
  }

  if (done) {
    return (
      <div
        className={`rounded-lg border-2 border-emerald-500/60 bg-emerald-50 p-5 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 flex-none text-emerald-600" />
          <div>
            <p className="font-display text-base font-extrabold uppercase tracking-wide text-emerald-900">
              Got it — we&apos;ll text you within 1 hour.
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Need it now? Tap to call{' '}
              <a
                href={`tel:${PHONE_E164}`}
                className="font-bold underline"
                onClick={() => trackEvent('phone_click', { location: 'quick_quote_success' })}
              >
                {PHONE_DISPLAY}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className={`rounded-lg border-2 border-brand-amber/70 bg-white p-5 shadow-[0_18px_36px_-26px_rgba(15,48,68,0.45)] ${className}`}
      aria-label="Quick quote request"
    >
      <p className="font-display text-lg font-extrabold uppercase tracking-wide text-brand-navy md:text-xl">
        {headline}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{subline}</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          aria-label="Your phone number"
          placeholder="(804) 555-1234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-h-[56px] flex-1 rounded-md border-2 border-border bg-white px-4 text-lg font-semibold tracking-wide text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-md bg-brand-amber px-6 font-display text-base font-extrabold uppercase tracking-wide text-brand-navy transition-colors hover:brightness-95 disabled:opacity-60"
        >
          <MessageSquare className="h-5 w-5" />
          {busy ? 'Sending…' : 'Text Me'}
        </button>
        <a
          href={`tel:${PHONE_E164}`}
          onClick={() => trackEvent('phone_click', { location: `quick_quote:${source}` })}
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-md border-2 border-primary px-5 font-display text-base font-extrabold uppercase tracking-wide text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <Phone className="h-5 w-5" />
          Call Now
        </a>
        <a
          href={`sms:${SMS_E164}?&body=${encodeURIComponent(SMS_PREFILL)}`}
          onClick={() => trackEvent('sms_click', { location: `quick_quote:${source}` })}
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-md border-2 border-emerald-600 px-5 font-display text-base font-extrabold uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white"
        >
          <MessageSquare className="h-5 w-5" />
          Text Us
        </a>
      </div>

      {err && (
        <p className="mt-2 text-sm font-bold text-red-600" role="alert">
          {err}
        </p>
      )}
    </form>
  )
}
