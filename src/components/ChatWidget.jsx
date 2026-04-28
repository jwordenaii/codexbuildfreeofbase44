/**
 * ChatWidget — Mr. J. Worden 4D persona assistant.
 *
 * Architecture
 * ────────────
 * A floating animated avatar (MrWordenAvatar) anchored bottom-left persists
 * across every page (rendered outside <Routes> in App.jsx). Clicking the
 * avatar opens a compact three-tab panel:
 *   Chat    — AI-powered multi-turn conversation (POST /api/v1/ai/chat)
 *   Help    — Page-specific quick-answer FAQ cards
 *   Contact — Lightweight contact form with AI-assisted field suggestions
 *
 * Panel open/tab state is preserved in sessionStorage so navigation between
 * pages never resets the conversation or closes the panel.
 * Avatar state (idle / talking / listening) drives MrWordenAvatar animations.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'
import MrWordenAvatar from './MrWordenAvatar'

// ── Session helpers ───────────────────────────────────────────────────────────

function getOrCreateSessionId() {
  const key = 'jworden_chat_session_id'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `web-${crypto.randomUUID()}`
        : `web-${Date.now()}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
            b.toString(16).padStart(2, '0')
          ).join('')}`
    sessionStorage.setItem(key, sid)
  }
  return sid
}

function ssGet(key, fallback) {
  try {
    const v = sessionStorage.getItem(key)
    return v !== null ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function ssSet(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded or private browsing */
  }
}

// ── Page-aware content ────────────────────────────────────────────────────────

const PAGE_CONTEXT = {
  '/': 'home page',
  '/services': 'services page',
  '/about': 'about page',
  '/contact': 'contact page',
  '/quote': 'quote / booking page',
  '/reviews': 'reviews page',
  '/service-areas': 'service areas page',
  '/blog': 'blog page',
  '/visualizer': 'property visualizer tool',
  '/advisory': 'contractor advisory / legal hub',
}

const PAGE_HELP = {
  '/': {
    title: 'Welcome — How can I help you?',
    faqs: [
      {
        q: 'How much does a new driveway cost?',
        a: 'Residential asphalt typically runs $3.50–$8.00/sqft depending on thickness and site prep. Head to /quote for a free on-site estimate.',
      },
      {
        q: 'What services do you offer?',
        a: 'We do asphalt paving, sealcoating, crack filling, parking lot maintenance, and KFC franchise paving. See /services for the full list.',
      },
      {
        q: 'What areas do you serve?',
        a: 'We serve the greater Richmond, VA area and operate franchise paving programs in VA, NC, GA, FL, MI, TX, and more.',
      },
      {
        q: 'Are you licensed and insured?',
        a: 'Yes — fully licensed in Virginia with general liability and workers’ compensation coverage.',
      },
    ],
  },
  '/services': {
    title: 'About Our Services',
    faqs: [
      {
        q: 'What is sealcoating?',
        a: 'Sealcoating is a protective layer applied to existing asphalt to extend its life, prevent oxidation, and improve appearance. We recommend it every 2–3 years.',
      },
      {
        q: 'How long does asphalt paving take?',
        a: 'A standard residential driveway typically takes 1–2 days. Larger commercial lots may take 3–5 days depending on size and site conditions.',
      },
      {
        q: 'Do you handle commercial parking lots?',
        a: 'Absolutely — commercial paving is a core specialty. We work with strip malls, office parks, and national franchise programs.',
      },
      {
        q: "What's crack filling?",
        a: "Crack filling seals surface cracks before water infiltrates and causes base damage. It's the most cost-effective way to add years to your asphalt.",
      },
    ],
  },
  '/quote': {
    title: 'Getting Your Free Quote',
    faqs: [
      {
        q: 'What info do I need for a quote?',
        a: 'Just your name, contact info, service type, and an approximate project size. The more detail you provide, the more accurate your estimate.',
      },
      {
        q: 'How quickly do you respond?',
        a: 'We respond to all quote requests within 24 hours, Monday–Friday.',
      },
      {
        q: 'Is the on-site visit really free?',
        a: 'Yes — 100% free, no obligation. We come to your property, measure up, and give you a written estimate.',
      },
      {
        q: 'What does the deposit cover?',
        a: 'A small deposit holds your spot on our schedule. It is applied to your final invoice when the job is complete.',
      },
    ],
  },
  '/contact': {
    title: 'Reaching the Team',
    faqs: [
      {
        q: 'What are your business hours?',
        a: "Monday–Friday, 7am–5pm. We're often on job sites early, so call or leave a message and we'll get back to you.",
      },
      {
        q: 'Do you offer emergency service?',
        a: "For urgent commercial needs, call (804) 446-1296 directly and we'll do our best to accommodate you.",
      },
      {
        q: 'How can I track my project?',
        a: "Once your project is booked, your project manager will keep you updated. You can also ask here and I'll pull up your status.",
      },
    ],
  },
  '/about': {
    title: 'About J. Worden & Sons',
    faqs: [
      {
        q: 'How long have you been in business?',
        a: "J. Worden & Sons was founded in 1984 by J. Worden Sr. after 30+ years in roofing. That's 40+ years of laying asphalt.",
      },
      {
        q: 'Who runs the company now?',
        a: 'Mr. Worden (grandson) took over in 2016 after working alongside the founder since age 14. Same family, same standards.',
      },
      {
        q: 'What awards have you won?',
        a: "We've been named to Pavement Magazine's Top 75 in four categories, won Best of Houzz multiple years, and are a 2026 Top Contractor Nominee.",
      },
    ],
  },
  default: {
    title: 'Quick Help',
    faqs: [
      {
        q: 'How do I get a free estimate?',
        a: 'Head to /quote, fill in a few details, and our team will reach out within 24 hours to schedule your free on-site visit.',
      },
      {
        q: 'What is your phone number?',
        a: 'You can reach us at (804) 446-1296, Monday–Friday 7am–5pm.',
      },
      {
        q: 'What areas do you serve?',
        a: 'The greater Richmond, VA area plus national franchise paving programs across 12+ states.',
      },
    ],
  },
}

function getPageHelp(pathname) {
  return PAGE_HELP[pathname] || PAGE_HELP.default
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Message({ msg }) {
  const isBot = msg.role === 'bot'
  return (
    <div className={`flex gap-2 ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}>
      <span className="text-xl flex-shrink-0 leading-none mt-0.5">{isBot ? '👴' : '👷'}</span>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isBot
            ? 'bg-brand-navy/5 text-brand-navy rounded-tl-none'
            : 'bg-brand-amber text-brand-navy rounded-tr-none'
        }`}
      >
        {msg.text}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-xl leading-none mt-0.5">👴</span>
      <div className="bg-brand-navy/5 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brand-navy/40 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
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

const CONTACT_INITIAL = { name: '', email: '', phone: '', service_type: '', message: '' }

// ── Main component ────────────────────────────────────────────────────────────

const GREETING_DELAY_MS = 6000

const INITIAL_MESSAGES = [
  {
    id: 0,
    role: 'bot',
    text: "Welcome — I'm a digital tribute to J. Worden Sr., founder of J. Worden & Sons Paving since 1984. I'm here to answer your questions, give you a ballpark, and get you on our schedule. What are you working on today?",
  },
]

const SUGGESTIONS = [
  'How much does a new driveway cost?',
  'Can you pave my parking lot?',
  'I need sealcoating — how do I get started?',
  'What areas do you serve?',
]

export default function ChatWidget() {
  const { pathname } = useLocation()

  const [open, setOpen] = useState(() => ssGet('mrw_open', false))
  const [activeTab, setActiveTab] = useState(() => ssGet('mrw_tab', 'chat'))
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const sessionIdRef = useRef(getOrCreateSessionId())
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const [contactForm, setContactForm] = useState(CONTACT_INITIAL)
  const [contactStatus, setContactStatus] = useState('idle')
  const [contactError, setContactError] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const suggestTimerRef = useRef(null)

  const avatarState = loading ? 'talking' : open ? 'listening' : 'idle'

  useEffect(() => {
    ssSet('mrw_open', open)
  }, [open])
  useEffect(() => {
    ssSet('mrw_tab', activeTab)
  }, [activeTab])

  useEffect(() => {
    const greeted = sessionStorage.getItem('jworden_greeted')
    if (greeted) return
    const isMobile = window.innerWidth < 640
    sessionStorage.setItem('jworden_greeted', '1')
    if (isMobile) return
    const timer = setTimeout(() => {
      setOpen(true)
      setUnread(0)
    }, GREETING_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!open) return
    const pageLabel = PAGE_CONTEXT[pathname]
    if (!pageLabel || messages.length < 2) return
    const hintText = `Just so you know — you're now on our ${pageLabel}. Feel free to keep chatting or browse the quick help below.`
    setMessages((prev) => {
      if (prev.some((msg) => msg.isHint && msg.text === hintText)) return prev
      return [...prev, { id: Date.now(), role: 'bot', text: hintText, isHint: true }]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (open && activeTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, loading, activeTab])

  useEffect(() => {
    if (open && activeTab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open, activeTab])

  useEffect(() => {
    if (!open && messages.length > 1) {
      setUnread(messages.filter((m) => m.role === 'bot' && m.id !== 0).length)
    }
  }, [messages, open])

  useEffect(() => {
    if (open) setUnread(0)
  }, [open])

  const sendMessage = useCallback(
    async (text) => {
      const question = text.trim()
      if (!question || loading) return
      setMessages((prev) => [...prev, { id: Date.now(), role: 'user', text: question }])
      setInput('')
      setLoading(true)
      try {
        const data = await api.askAI({
          question,
          session_id: sessionIdRef.current,
          page_context: PAGE_CONTEXT[pathname] || null,
        })
        if (data.session_id) sessionIdRef.current = data.session_id
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', text: data.answer }])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: 'bot',
            text: "Sorry — we're having a little trouble connecting right now. Give us a call at (804) 446-1296 or head to /contact and we'll get right back to you.",
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [loading, pathname]
  )

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const fetchAiSuggestion = useCallback(
    async (msg) => {
      if (!msg || msg.length < 15) return
      try {
        const data = await api.contactSuggest({ message: msg })
        if (data?.service_type) {
          setAiSuggestion(data)
          if (!contactForm.service_type && data.service_type) {
            setContactForm((f) => ({ ...f, service_type: data.service_type }))
          }
        }
      } catch {
        /* optional */
      }
    },
    [contactForm.service_type]
  )

  const handleContactMessageChange = (e) => {
    const msg = e.target.value
    setContactForm((f) => ({ ...f, message: msg }))
    clearTimeout(suggestTimerRef.current)
    suggestTimerRef.current = setTimeout(() => fetchAiSuggestion(msg), 1200)
  }

  const handleContactMessageBlur = () => {
    clearTimeout(suggestTimerRef.current)
    fetchAiSuggestion(contactForm.message)
  }

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    setContactStatus('submitting')
    try {
      await api.submitContact({
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone || undefined,
        message: [
          contactForm.service_type ? `Service: ${contactForm.service_type}` : '',
          contactForm.message,
        ]
          .filter(Boolean)
          .join('\n'),
      })
      setContactStatus('success')
      setContactForm(CONTACT_INITIAL)
      setAiSuggestion(null)
    } catch (err) {
      setContactError(err.message || 'Something went wrong. Please try again.')
      setContactStatus('error')
    }
  }

  const panelVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 300, damping: 28 },
    },
    exit: { opacity: 0, y: 16, scale: 0.95, transition: { duration: 0.18 } },
  }

  const pageHelp = getPageHelp(pathname)

  return (
    <div className="fixed bottom-4 left-3 sm:left-5 z-50 flex flex-col items-start">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mb-3 w-[calc(100vw-1.5rem)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-brand-navy/10 flex flex-col overflow-hidden"
            style={{ maxHeight: 'min(78vh, 540px)' }}
          >
            {/* Header */}
            <div className="bg-brand-navy text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl leading-none">👴</span>
                <div>
                  <div className="font-bold text-sm">Mr. J. Worden</div>
                  <div className="text-white/60 text-xs flex items-center gap-1">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${loading ? 'bg-brand-amber animate-pulse' : 'bg-green-400'}`}
                    />
                    {loading ? 'Thinking…' : 'Founder · 40+ Years in Paving'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white transition-colors text-lg leading-none"
                aria-label="Close assistant"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-brand-navy/10 flex-shrink-0">
              {[
                { id: 'chat', label: '💬 Chat' },
                { id: 'help', label: '❓ Help' },
                { id: 'contact', label: '📋 Contact' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 text-xs font-semibold py-2.5 transition-colors ${
                    activeTab === tab.id
                      ? 'text-brand-navy border-b-2 border-brand-amber bg-brand-amber/5'
                      : 'text-brand-navy/50 hover:text-brand-navy/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* CHAT TAB */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                    {messages.map((msg) => (
                      <Message key={msg.id} msg={msg} />
                    ))}
                    {loading && <TypingIndicator />}
                    <div ref={bottomRef} />
                  </div>

                  {messages.length === 1 && !loading && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendMessage(s)}
                          className="text-xs bg-brand-amber/10 text-brand-navy border border-brand-amber/30 rounded-full px-3 py-1 hover:bg-brand-amber/20 transition-colors text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="px-4 pb-3 flex-shrink-0">
                    <Link
                      to="/quote"
                      onClick={() => setOpen(false)}
                      className="block w-full text-center bg-brand-amber text-brand-navy text-xs font-bold rounded-lg py-2 hover:bg-brand-amber/80 transition-colors"
                    >
                      📅 Book Free On-Site Visit &amp; Hold My Spot
                    </Link>
                  </div>

                  <div className="border-t border-brand-navy/10 px-3 py-3 flex gap-2 flex-shrink-0">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask Mr. Worden anything…"
                      maxLength={1000}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim() || loading}
                      className="bg-brand-amber text-brand-navy rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-amber/80 transition-colors"
                      aria-label="Send message"
                    >
                      ➤
                    </button>
                  </div>
                </div>
              )}

              {/* HELP TAB */}
              {activeTab === 'help' && (
                <div className="px-4 py-4 space-y-3">
                  <p className="font-bold text-brand-navy text-sm">{pageHelp.title}</p>
                  {pageHelp.faqs.map(({ q, a }) => (
                    <details
                      key={q}
                      className="group rounded-xl border border-brand-navy/10 overflow-hidden"
                    >
                      <summary className="flex justify-between items-center px-4 py-3 cursor-pointer text-sm font-semibold text-brand-navy hover:bg-brand-navy/5 select-none list-none">
                        <span>{q}</span>
                        <span className="text-brand-navy/30 group-open:rotate-180 transition-transform duration-200 ml-2 flex-shrink-0">
                          ▼
                        </span>
                      </summary>
                      <div className="px-4 pb-3 text-sm text-brand-navy/70 leading-relaxed bg-brand-navy/5">
                        {a}
                      </div>
                    </details>
                  ))}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('chat')}
                      className="text-xs text-brand-amber font-semibold hover:underline"
                    >
                      💬 Still have questions? Chat with Mr. Worden →
                    </button>
                  </div>
                </div>
              )}

              {/* CONTACT TAB */}
              {activeTab === 'contact' && (
                <div className="px-4 py-4">
                  {contactStatus === 'success' ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">✅</div>
                      <p className="font-bold text-brand-navy">Message sent!</p>
                      <p className="text-brand-navy/60 text-sm mt-1">
                        We’ll get back to you within one business day.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setContactStatus('idle')
                          setContactForm(CONTACT_INITIAL)
                        }}
                        className="mt-4 text-xs text-brand-amber font-semibold hover:underline"
                      >
                        Send another message
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-3">
                      <p className="text-xs text-brand-navy/50 mb-3">
                        Fill in your details and Mr. Worden’s team will respond within 24 hours.
                      </p>

                      <div>
                        <label
                          htmlFor="cw-name"
                          className="block text-xs font-semibold text-brand-navy mb-1"
                        >
                          Full Name *
                        </label>
                        <input
                          id="cw-name"
                          type="text"
                          required
                          maxLength={120}
                          value={contactForm.name}
                          onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="cw-email"
                          className="block text-xs font-semibold text-brand-navy mb-1"
                        >
                          Email *
                        </label>
                        <input
                          id="cw-email"
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="cw-phone"
                          className="block text-xs font-semibold text-brand-navy mb-1"
                        >
                          Phone <span className="font-normal text-brand-navy/40">(optional)</span>
                        </label>
                        <input
                          id="cw-phone"
                          type="tel"
                          maxLength={30}
                          value={contactForm.phone}
                          onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="cw-service"
                          className="block text-xs font-semibold text-brand-navy mb-1"
                        >
                          Service Type
                          {aiSuggestion?.service_type && (
                            <span className="ml-1 text-brand-amber font-normal">
                              (AI-suggested)
                            </span>
                          )}
                        </label>
                        <select
                          id="cw-service"
                          value={contactForm.service_type}
                          onChange={(e) =>
                            setContactForm((f) => ({ ...f, service_type: e.target.value }))
                          }
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors bg-white"
                        >
                          {SERVICE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="cw-message"
                          className="block text-xs font-semibold text-brand-navy mb-1"
                        >
                          Message *
                        </label>
                        <textarea
                          id="cw-message"
                          required
                          rows={3}
                          maxLength={1000}
                          value={contactForm.message}
                          onChange={handleContactMessageChange}
                          onBlur={handleContactMessageBlur}
                          placeholder="Describe your project…"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors resize-none"
                        />
                        {aiSuggestion?.hint && (
                          <p className="text-xs text-brand-amber mt-1">💡 {aiSuggestion.hint}</p>
                        )}
                      </div>

                      {contactStatus === 'error' && (
                        <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          {contactError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={contactStatus === 'submitting'}
                        className="w-full bg-brand-navy text-white text-sm font-bold rounded-lg py-2.5 hover:bg-brand-navy/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {contactStatus === 'submitting' ? 'Sending…' : 'Send Message'}
                      </button>

                      <p className="text-xs text-center text-brand-navy/40">
                        Or call us:{' '}
                        <a
                          href="tel:+18044461296"
                          className="text-brand-amber font-semibold hover:underline"
                        >
                          (804) 446-1296
                        </a>
                      </p>
                    </form>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated avatar toggle */}
      <MrWordenAvatar
        state={avatarState}
        size={52}
        onClick={() => setOpen((o) => !o)}
        isOpen={open}
        unread={unread}
      />
    </div>
  )
}
