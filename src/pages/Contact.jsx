import { useState, useRef } from 'react'
import SchemaMarkup from '../components/SchemaMarkup'
import { api, trackEvent } from '../api/client'

const CONTACT_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact J. Worden & Sons',
  url: 'https://www.jwordenasphaltpaving.com/contact',
}

const SERVICE_OPTIONS = [
  { value: '', label: 'Select service type…' },
  { value: 'driveway', label: 'Residential Driveway' },
  { value: 'parking_lot', label: 'Commercial Parking Lot' },
  { value: 'sealcoating', label: 'Sealcoating' },
  { value: 'crack_filling', label: 'Crack Filling' },
  { value: 'paving', label: 'General Paving' },
  { value: 'other', label: 'Other / Not Sure' },
]

const URGENCY_OPTIONS = [
  { value: '', label: 'Select urgency…' },
  { value: 'asap', label: 'ASAP — urgent' },
  { value: 'within_1_week', label: 'Within 1 week' },
  { value: 'within_1_month', label: 'Within 1 month' },
  { value: 'flexible', label: 'Flexible' },
]

const INITIAL = { name: '', email: '', phone: '', service_type: '', urgency: '', message: '' }

export default function Contact() {
  const [form, setForm] = useState(INITIAL)
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const suggestTimer = useRef(null)

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const fetchSuggestion = async (msg) => {
    if (!msg || msg.length < 15) return
    try {
      const data = await api.contactSuggest({ message: msg })
      if (data?.service_type) {
        setAiSuggestion(data)
        if (!form.service_type && data.service_type) {
          setForm((f) => ({ ...f, service_type: data.service_type }))
        }
      }
    } catch {
      /* optional */
    }
  }

  const handleMessageChange = (e) => {
    const msg = e.target.value
    setForm((f) => ({ ...f, message: msg }))
    clearTimeout(suggestTimer.current)
    suggestTimer.current = setTimeout(() => fetchSuggestion(msg), 1200)
  }

  const handleMessageBlur = () => {
    clearTimeout(suggestTimer.current)
    fetchSuggestion(form.message)
  }

  const buildMessageBody = () => {
    const meta = [
      form.service_type ? `Service: ${form.service_type}` : null,
      form.urgency ? `Urgency: ${form.urgency}` : null,
      form.phone ? `Phone: ${form.phone}` : null,
    ].filter(Boolean)
    // Separate the metadata block from the user's message with a blank line
    // (only when there is actually any metadata to separate).
    return [...meta, ...(meta.length ? [''] : []), form.message].join('\n')
  }

  /** Fallback: if the backend can't be reached, open the user's email client
   *  with a pre-filled message so the lead is never lost. */
  const fallbackToMailto = () => {
    const subject = encodeURIComponent(
      `New website inquiry from ${form.name || 'a website visitor'}`
    )
    const bodyLines = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      form.phone ? `Phone: ${form.phone}` : '',
      form.service_type ? `Service: ${form.service_type}` : '',
      form.urgency ? `Urgency: ${form.urgency}` : '',
      '',
      form.message,
    ].filter(Boolean)
    const body = encodeURIComponent(bodyLines.join('\n'))
    window.location.href = `mailto:j.wordenandsonspaving@gmail.com?subject=${subject}&body=${body}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email && !form.phone) {
      setErrorMsg('Please add a phone number or email so we can reach you.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setErrorMsg('')

    // A non-blocking '/.netlify/functions/lead-fallback-notify' call used to fire
    // here as an email safety net. Hosting moved off Netlify, so that function no
    // longer exists and the request only ever hit the SPA catch-all. Removed —
    // api.submitContact below is the lead sink, and it surfaces failures properly.
    try {
      await api.submitContact({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        message: buildMessageBody(),
      })
      setStatus('success')
      setForm(INITIAL)
      setAiSuggestion(null)
      trackEvent('contact_form_submit', { success: true })
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
      trackEvent('contact_form_submit', { success: false, error: err.message })
    }
  }

  return (
    <>
      <SchemaMarkup
        title="Contact Us — Free Estimates & Project Questions"
        description="Contact J. Worden & Sons Paving LLC. Call, email, or fill out our form. We respond within one business day. Free estimates always."
        canonical="/contact"
        schema={CONTACT_SCHEMA}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ]}
      />

      {/* Header */}
      <div className="bg-brand-navy pt-32 pb-20 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="font-display font-black text-5xl md:text-6xl mb-4">
            Get in <span className="text-brand-amber">Touch</span>
          </h1>
          <p className="text-white/70 text-xl">We respond within one business day.</p>
        </div>
      </div>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-14">
          {/* Contact info */}
          <div>
            <h2 className="section-heading mb-8">Contact Information</h2>
            <div className="space-y-6">
              {[
                { icon: '📞', label: 'Phone', value: '(804) 446-1296', href: 'tel:+18044461296' },
                {
                  icon: '📧',
                  label: 'Email',
                  value: 'j.wordenandsonspaving@gmail.com',
                  href: 'mailto:j.wordenandsonspaving@gmail.com',
                },
                {
                  icon: '📍',
                  label: 'Address',
                  value: '1601 Ware Bottom Spring Rd Suite 214, Chester VA 23836',
                  href: 'https://www.google.com/maps/search/1601+Ware+Bottom+Springs+Rd+Chester+VA+23836',
                },
                { icon: '🕐', label: 'Hours', value: 'Monday–Friday, 7am–5pm' },
              ].map(({ icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-amber/10 flex items-center justify-center text-xl flex-shrink-0">
                    {icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-brand-navy/40">
                      {label}
                    </div>
                    {href ? (
                      <a
                        href={href}
                        className="font-semibold text-brand-navy hover:text-brand-amber transition-colors"
                        onClick={() =>
                          trackEvent(label === 'Phone' ? 'phone_click' : 'email_click', {
                            location: 'contact_page',
                          })
                        }
                      >
                        {value}
                      </a>
                    ) : (
                      <span className="font-semibold text-brand-navy">{value}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Map placeholder */}
            <div className="mt-10 bg-brand-navy/5 rounded-2xl aspect-video flex items-center justify-center border-2 border-dashed border-brand-navy/20">
              <div className="text-center text-brand-navy/30">
                <div className="text-4xl mb-2">📍</div>
                <p className="text-sm">Google Maps embed coming soon</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div>
            <h2 className="section-heading mb-2">Request a Free Estimate</h2>
            <p className="text-brand-navy/60 mb-6">
              Just a few quick fields. We&apos;ll handle the rest.
            </p>

            {status === 'success' ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-brand-navy/60">
                  We received your message and will get back to you within one business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-brand-navy mb-1.5">
                    Your Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="First and last name"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
                  />
                </div>

                {/* Best way to reach you - phone OR email */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-brand-navy mb-1.5">
                      Phone
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="(804) 555-1234"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-brand-navy mb-1.5">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
                    />
                  </div>
                </div>
                <p className="text-xs text-brand-navy/50 -mt-2">
                  Provide a phone <span className="font-semibold">or</span> email — whichever you prefer.
                </p>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-brand-navy mb-1.5">
                    How can we help?
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    value={form.message}
                    onChange={handleMessageChange}
                    onBlur={handleMessageBlur}
                    placeholder="Tell us briefly what you need — e.g. driveway paving, parking lot sealcoating, address, timing."
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors resize-none"
                  />
                  {aiSuggestion?.hint && (
                    <p className="text-sm text-brand-amber mt-1">💡 {aiSuggestion.hint}</p>
                  )}
                </div>

                {/* Optional details (collapsed) */}
                <details className="rounded-lg border border-gray-200 bg-gray-50/60">
                  <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-brand-navy hover:text-brand-amber">
                    Add details (optional)
                  </summary>
                  <div className="grid sm:grid-cols-2 gap-4 px-4 pb-4 pt-1">
                    <div>
                      <label htmlFor="service_type" className="block text-xs font-semibold text-brand-navy/70 mb-1.5">
                        Service Type
                      </label>
                      <select
                        id="service_type"
                        name="service_type"
                        value={form.service_type}
                        onChange={handleChange}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors bg-white"
                      >
                        {SERVICE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="urgency" className="block text-xs font-semibold text-brand-navy/70 mb-1.5">
                        Urgency
                      </label>
                      <select
                        id="urgency"
                        name="urgency"
                        value={form.urgency}
                        onChange={handleChange}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors bg-white"
                      >
                        {URGENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </details>

                {status === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm space-y-2">
                    <p>
                      {errorMsg || 'Something went wrong sending your message.'}
                    </p>
                    <p className="font-semibold">
                      Don&apos;t worry — your message is not lost. Use one of these
                      to reach us right now:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={fallbackToMailto}
                        className="inline-flex items-center gap-1 bg-brand-navy text-white font-semibold px-3 py-2 rounded-md text-sm hover:bg-brand-navy/90 transition-colors"
                      >
                        📧 Email us instead
                      </button>
                      <a
                        href="tel:+18044461296"
                        className="inline-flex items-center gap-1 bg-brand-amber text-brand-navy font-semibold px-3 py-2 rounded-md text-sm hover:bg-brand-amber-dark transition-colors"
                        onClick={() =>
                          trackEvent('phone_click', { location: 'contact_form_error' })
                        }
                      >
                        📞 Call (804) 446-1296
                      </a>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === 'submitting' ? 'Sending…' : 'Send Request'}
                </button>
                <p className="text-center text-xs text-brand-navy/50">
                  Free estimate. No obligation. We reply within one business day.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
