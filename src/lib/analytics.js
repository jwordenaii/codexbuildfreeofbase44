const hasGtag = () => typeof window !== 'undefined' && typeof window.gtag === 'function'

export function trackEvent(name, params = {}) {
  if (!hasGtag()) return
  window.gtag('event', name, params)
}

export function trackPhoneClick(location = 'unknown') {
  trackEvent('phone_click', { event_label: location })
  const gadsId = import.meta.env.VITE_GADS_ID
  const label = import.meta.env.VITE_GADS_LABEL_PHONE
  if (hasGtag() && gadsId && label) {
    window.gtag('event', 'conversion', { send_to: `${gadsId}/${label}` })
  }
}

export function trackQuoteSubmit() {
  trackEvent('quote_submitted')
  const gadsId = import.meta.env.VITE_GADS_ID
  const label = import.meta.env.VITE_GADS_LABEL_QUOTE
  if (hasGtag() && gadsId && label) {
    window.gtag('event', 'conversion', { send_to: `${gadsId}/${label}`, value: 250, currency: 'USD' })
  }
}
