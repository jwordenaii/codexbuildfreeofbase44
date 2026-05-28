/**
 * ChatWidget — "Mr. Worden" Premium Concierge Experience (Option 1B)
 *
 * Architecture
 * ────────────
 * A floating animated avatar (MrWordenAvatar) anchored BOTTOM-RIGHT persists
 * across every page (rendered outside <Routes> in App.jsx).  Clicking the
 * avatar opens a compact four-tab panel:
 *
 *   Actions — Quick-action onboarding buttons ("Get a Quote", "Call Now", etc.)
 *   Chat    — multi-turn conversation (POST /api/v1/public/chat)
 *             Structured responses include quick-reply chips and handoff CTAs.
 *   Help    — Page-specific FAQ accordion cards
 *   Lead    — Full lead-capture form (name/phone/email/address/city/ZIP/
 *             service type/timeframe/project size/notes) with service suggestions
 *
 * Panel open/tab state is preserved in sessionStorage.
 * Conversation history is sent to the backend (capped at 10 turns).
 * Avatar state (idle / talking / listening / wave) drives MrWordenAvatar.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Volume2, VolumeX, X, Camera, Ruler, ClipboardList, CalendarCheck, MessageSquare } from 'lucide-react'
import { api } from '../api/client'
import MrWordenAvatar from './MrWordenAvatar'
import { voiceService } from '../lib/ElevenLabsService'

// ── Config ────────────────────────────────────────────────────────────────────
const BUSINESS_PHONE = '(804) 446-1296'
const BUSINESS_PHONE_TEL = '+18044461296'
const BUSINESS_STATE = 'VA'

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

function timeOfDayGreeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return "Mornin'"
  if (h < 17) return 'Good afternoon'
  return "Good evenin'"
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
  '/general-contracting': 'general contracting and paid design packet page',
  '/jwordenai': 'photo estimate intake page',
}

const PAGE_HELP = {
  '/': {
    title: 'Welcome — How can I help you?',
    faqs: [
      {
        q: 'How much does a new driveway cost?',
        a: 'Residential asphalt typically runs $3.50\u2013$8.00/sqft depending on thickness and site prep. Head to /quote for a free on-site estimate.',
      },
      {
        q: 'What services do you offer?',
        a: 'We do asphalt paving, sealcoating, crack filling, concrete, cobblestone, brick pavers, and parking lot maintenance. See /services for the full list.',
      },
      {
        q: 'What areas do you serve?',
        a: 'We serve the greater Richmond, VA area and operate franchise paving programs in VA, NC, GA, FL, MI, TX, and more.',
      },
      {
        q: 'Are you licensed and insured?',
        a: 'Yes \u2014 fully licensed in Virginia with general liability and workers\u2019 compensation coverage.',
      },
    ],
  },
  '/services': {
    title: 'About Our Services',
    faqs: [
      {
        q: 'What is sealcoating?',
        a: 'Sealcoating is a protective layer applied to existing asphalt to extend its life, prevent oxidation, and improve appearance. We recommend it every 2\u20133 years.',
      },
      {
        q: 'How long does asphalt paving take?',
        a: 'A standard residential driveway typically takes 1\u20132 days. Larger commercial lots may take 3\u20135 days depending on size and site conditions.',
      },
      {
        q: 'Do you handle commercial parking lots?',
        a: 'Absolutely \u2014 commercial paving is a core specialty. We work with strip malls, office parks, and national franchise programs.',
      },
      {
        q: "What\u2019s crack filling?",
        a: "Crack filling seals surface cracks before water infiltrates and causes base damage. It\u2019s the most cost-effective way to add years to your asphalt.",
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
        a: 'We respond to all quote requests within 24 hours, Monday\u2013Friday.',
      },
      {
        q: 'Is the on-site visit really free?',
        a: 'Yes \u2014 100% free, no obligation. We come to your property, measure up, and give you a written estimate.',
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
        a: 'Monday\u2013Friday, 7am\u20135pm. We\u2019re often on job sites early, so call or leave a message and we\u2019ll get back to you.',
      },
      {
        q: 'Do you offer emergency service?',
        a: `For urgent commercial needs, call ${BUSINESS_PHONE} directly and we\u2019ll do our best to accommodate you.`,
      },
      {
        q: 'How can I track my project?',
        a: 'Once your project is booked, your project manager will keep you updated. You can also ask here and we\u2019ll pull up your status.',
      },
    ],
  },
  '/about': {
    title: 'About J. Worden & Sons',
    faqs: [
      {
        q: 'How long have you been in business?',
        a: "J. Worden & Sons was founded in 1984 by J. Worden Sr. after 30+ years in roofing. That\u2019s 40+ years of laying asphalt.",
      },
      {
        q: 'Who runs the company now?',
        a: 'Mr. Worden (grandson) took over in 2016 after working alongside the founder since age 14. Same family, same standards.',
      },
      {
        q: 'What awards have you won?',
        a: "We\u2019ve been named to Pavement Magazine\u2019s Top 75 in four categories, won Best of Houzz multiple years, and are a 2026 Top Contractor Nominee.",
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
        a: `You can reach us at ${BUSINESS_PHONE}, Monday\u2013Friday 7am\u20135pm.`,
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

// ── Header avatar (clean JW monogram) ───────────────────────────────────────

function HeaderAvatar() {
  return (
    <div
      className="h-10 w-10 flex-shrink-0 rounded-full bg-brand-amber text-brand-navy flex items-center justify-center font-display font-black text-sm tracking-wide shadow-sm"
      aria-hidden="true"
    >
      JW
    </div>
  )
}

// ── Quick action definitions ──────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    id: 'quote',
    Icon: CalendarCheck,
    label: 'Free Estimate',
    sub: 'Get on the schedule',
    action: 'tab:lead',
    primary: true,
  },
  {
    id: 'call',
    Icon: Phone,
    label: 'Call Now',
    sub: BUSINESS_PHONE,
    action: `tel:${BUSINESS_PHONE_TEL}`,
    primary: true,
  },
  {
    id: 'scan',
    Icon: Camera,
    label: 'Send Photos',
    sub: 'Driveway or lot review',
    action: 'chat:Help me send photos for a driveway or small parking lot estimate.',
  },
  {
    id: 'design',
    Icon: Ruler,
    label: 'Design Packet',
    sub: 'Patio, addition, remodel',
    action: 'chat:I want a 4D design packet for a remodel, addition, patio, or property build.',
  },
  {
    id: 'plan',
    Icon: ClipboardList,
    label: 'Plan-to-Bid',
    sub: 'Plans, sketches, scope',
    action: 'chat:I have plans or sketches and want a plan-to-bid readiness review.',
  },
  {
    id: 'ask',
    Icon: MessageSquare,
    label: 'Ask a Question',
    sub: 'Talk to the team',
    action: 'tab:chat',
  },
]

// ── Form options ──────────────────────────────────────────────────────────────

const SERVICE_OPTIONS = [
  { value: 'photo_review', label: 'Photo Review / Damage Notes' },
  { value: 'design_packet', label: '4D Design Packet' },
  { value: 'plan_to_bid', label: 'Plan-To-Bid Readiness Review' },
  { value: '', label: 'Select service type\u2026' },
  { value: 'driveway', label: 'Residential Driveway' },
  { value: 'parking_lot', label: 'Commercial Parking Lot' },
  { value: 'sealcoating', label: 'Sealcoating' },
  { value: 'crack_filling', label: 'Crack Filling' },
  { value: 'overlay', label: 'Asphalt Overlay / Resurfacing' },
  { value: 'paving', label: 'General Asphalt Paving' },
  { value: 'concrete', label: 'Concrete Work' },
  { value: 'brick_pavers', label: 'Brick Pavers' },
  { value: 'cobblestone', label: 'Cobblestone' },
  { value: 'other', label: 'Other / Not Sure' },
]

const TIMEFRAME_OPTIONS = [
  { value: '', label: 'Select timeframe\u2026' },
  { value: 'asap', label: 'As soon as possible' },
  { value: 'within_1_week', label: 'Within 1 week' },
  { value: 'within_1_month', label: 'Within 1 month' },
  { value: 'flexible', label: 'Flexible / Just planning' },
]

const LEAD_INITIAL = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  zip: '',
  service_type: '',
  timeframe: '',
  sqft: '',
  notes: '',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Message({ msg }) {
  const isBot = msg.role === 'bot'
  return (
    <div className={`flex gap-2 ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}>
      <span className="text-base flex-shrink-0 leading-none mt-0.5 select-none">{isBot ? '👷' : '🧑'}</span>
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isBot
            ? 'bg-brand-navy/5 text-brand-navy rounded-tl-none'
            : 'bg-brand-amber text-brand-navy rounded-tr-none font-medium'
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
      <span className="text-base leading-none mt-0.5 select-none">👷</span>
      <div className="bg-brand-navy/5 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brand-navy/50 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
        <span className="text-xs text-brand-navy/40 ml-1">Mr. Worden is thinking\u2026</span>
      </div>
    </div>
  )
}

function EstimateCard({ estimate }) {
  if (!estimate?.available) return null
  return (
    <div className="mx-2 my-1 bg-brand-amber/10 border border-brand-amber/40 rounded-xl p-3 text-xs text-brand-navy">
      <div className="font-bold text-brand-amber mb-1">💰 Ballpark Estimate</div>
      <div className="font-semibold">{estimate.service}</div>
      <div className="text-lg font-bold text-brand-navy mt-0.5">{estimate.range_text}</div>
      {estimate.drivers && (
        <div className="mt-1 text-brand-navy/60 leading-relaxed">{estimate.drivers}</div>
      )}
      <div className="mt-1.5 text-brand-navy/50 italic">
        Free on-site visit gives you the exact number.
      </div>
    </div>
  )
}

function HandoffBanner({ handoff, onShowForm }) {
  if (!handoff) return null
  if (handoff === 'call') {
    return (
      <div className="mx-3 my-1.5 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
        <span className="text-lg">📞</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-green-800">Ready to talk?</div>
          <div className="text-xs text-green-700">Call us now \u2014 we pick up fast.</div>
        </div>
        <a
          href={`tel:${BUSINESS_PHONE_TEL}`}
          className="flex-shrink-0 bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
        >
          Call
        </a>
      </div>
    )
  }
  return (
    <div className="mx-3 my-1.5 bg-brand-amber/10 border border-brand-amber/40 rounded-xl px-3 py-2.5 flex items-center gap-2">
      <span className="text-lg">📋</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-brand-navy">Ready for a quote?</div>
        <div className="text-xs text-brand-navy/60">Two-minute form. Free on-site visit.</div>
      </div>
      <button
        type="button"
        onClick={onShowForm}
        className="flex-shrink-0 bg-brand-amber text-brand-navy text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-amber/80 transition-colors"
      >
        {`Let's go`}
      </button>
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GREETING_DELAY_MS = 5500
const MESSAGES_SS_KEY = 'mrw_messages'
const MESSAGES_PERSIST_LIMIT = 40
const DEFAULT_QUICK_REPLIES = [
  'Send photos for review',
  'Request a design consultation',
  'Price my driveway or lot',
  'Help me decide repair or replace',
]

function buildInitialMessages() {
  return [
    {
      id: 0,
      role: 'bot',
      text: `${timeOfDayGreeting()}. This is J. Worden & Sons. Tell us what you need paved or repaired: driveway, parking lot, sealcoating, crack repair, drainage, concrete, or striping. We can help you get the right estimate started.`,
    },
  ]
}

function suggestionsForPath(pathname) {
  const help = PAGE_HELP[pathname]
  if (help && Array.isArray(help.faqs) && help.faqs.length > 0) {
    return help.faqs.slice(0, 4).map((f) => f.q)
  }
  return DEFAULT_QUICK_REPLIES
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const { pathname } = useLocation()

  const [open, setOpen] = useState(() => ssGet('mrw_open', false))
  const [activeTab, setActiveTab] = useState(() => ssGet('mrw_tab', 'actions'))
  const [messages, setMessages] = useState(() => {
    const saved = ssGet(MESSAGES_SS_KEY, null)
    if (Array.isArray(saved) && saved.length > 0) return saved
    return buildInitialMessages()
  })
  const [quickReplies, setQuickReplies] = useState(DEFAULT_QUICK_REPLIES)
  const [pendingHandoff, setPendingHandoff] = useState(null)
  const [pendingEstimate, setPendingEstimate] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [justArrived, setJustArrived] = useState(false)
  const sessionIdRef = useRef(getOrCreateSessionId())
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Lead capture form state
  const [leadForm, setLeadForm] = useState(LEAD_INITIAL)
  const [leadStatus, setLeadStatus] = useState('idle')
  const [leadError, setLeadError] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const suggestTimerRef = useRef(null)

  // Phone verification (Twilio Verify) — gates lead submission when configured
  const [verifyEnabled, setVerifyEnabled] = useState(false)
  const [verifyMode, setVerifyMode]       = useState('idle')   // 'idle' | 'pending' | 'verifying'
  const [verifyCode, setVerifyCode]       = useState('')
  const [verifyError, setVerifyError]     = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  useEffect(() => {
    let cancelled = false
    api.twilioVerifyStatus()
      .then((r) => { if (!cancelled) setVerifyEnabled(Boolean(r?.configured)) })
      .catch(() => { /* silent — fall back to no-gate behaviour */ })
    return () => { cancelled = true }
  }, [])

  // Premium voice — uses voiceService (ElevenLabs + browser fallback in service).
  const [voiceOn, setVoiceOn] = useState(() => ssGet('mrw_voice_on', false))
  const stopVoice = useCallback(() => {
    voiceService.stop()
  }, [])
  useEffect(() => {
    ssSet('mrw_voice_on', voiceOn)
    if (!voiceOn) stopVoice()
  }, [voiceOn, stopVoice])
  const speak = useCallback(
    async (text) => {
      if (!voiceOn || !text) return
      try {
        voiceService.play(text)
      } catch {
        /* fallback handled in service */
      }
    },
    [voiceOn]
  )
  useEffect(() => {
    if (!open) stopVoice()
  }, [open, stopVoice])
  useEffect(() => {
    return () => stopVoice()
  }, [stopVoice])

  const avatarState = loading
    ? 'talking'
    : justArrived
      ? 'wave'
      : open
        ? 'listening'
        : 'idle'

  useEffect(() => { ssSet('mrw_open', open) }, [open])
  useEffect(() => { ssSet('mrw_tab', activeTab) }, [activeTab])
  useEffect(() => {
    const trimmed = messages.length > MESSAGES_PERSIST_LIMIT
      ? messages.slice(messages.length - MESSAGES_PERSIST_LIMIT)
      : messages
    ssSet(MESSAGES_SS_KEY, trimmed)
  }, [messages])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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
    const hintText = `Just so y\u2019all know \u2014 you\u2019re now on our ${pageLabel}. Keep on chattin\u2019 or take a peek at the quick help below, much obliged.`
    setMessages((prev) => {
      if (prev.some((msg) => msg.isHint && msg.text === hintText)) return prev
      return [...prev, { id: Date.now(), role: 'bot', text: hintText, isHint: true }]
    })
     
  }, [pathname])

  useEffect(() => {
    setJustArrived(true)
    const t = setTimeout(() => setJustArrived(false), 1500)
    return () => clearTimeout(t)
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
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(12) } catch { /* not supported */ }
      }
      setMessages((prev) => [...prev, { id: Date.now(), role: 'user', text: question }])
      setInput('')
      setLoading(true)
      setPendingHandoff(null)
      setPendingEstimate(null)

      const historyForBackend = messages
        .slice(-20)
        .filter((m) => !m.isHint)
        .map((m) => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          content: m.text,
        }))

      try {
        const data = await api.publicChat({
          message: question,
          session_id: sessionIdRef.current,
          state_code: BUSINESS_STATE,
          page_context: PAGE_CONTEXT[pathname] || null,
          history: historyForBackend,
          city: leadForm.city || undefined,
          zip_code: leadForm.zip || undefined,
          service_type: leadForm.service_type || undefined,
          timeframe: leadForm.timeframe || undefined,
          sqft: leadForm.sqft ? parseFloat(leadForm.sqft) : undefined,
        })
        if (data.session_id) sessionIdRef.current = data.session_id

        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', text: data.message }])
        speak(data.message)

        if (Array.isArray(data.quick_replies) && data.quick_replies.length > 0) {
          setQuickReplies(data.quick_replies)
        }
        if (data.handoff) setPendingHandoff(data.handoff)
        if (data.estimate?.available) setPendingEstimate(data.estimate)
      } catch {
        const fallback =
          'Well now \u2014 looks like our line\u2019s a little crackly right this minute. Give us a holler at (804) 446-1296 or drop us a note on the Quote tab and we\u2019ll be right back with y\u2019all, much obliged.'
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'bot', text: fallback },
        ])
        speak(fallback)
        setQuickReplies(DEFAULT_QUICK_REPLIES)
      } finally {
        setLoading(false)
      }
    },
    [loading, pathname, speak, messages, leadForm]
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
          if (!leadForm.service_type && data.service_type) {
            setLeadForm((f) => ({ ...f, service_type: data.service_type }))
          }
        }
      } catch {
        /* optional */
      }
    },
    [leadForm.service_type]
  )

  const handleNotesChange = (e) => {
    const msg = e.target.value
    setLeadForm((f) => ({ ...f, notes: msg }))
    clearTimeout(suggestTimerRef.current)
    suggestTimerRef.current = setTimeout(() => fetchAiSuggestion(msg), 1200)
  }

  const handleLeadSubmit = async (e) => {
    e.preventDefault()

    // Phone verification gate — only when Twilio is configured AND phone hasn't been verified yet.
    // If Twilio is OFF, behaviour is unchanged.
    if (verifyEnabled && !phoneVerified && leadForm.phone) {
      setVerifyError('')
      setLeadStatus('submitting')
      try {
        const r = await api.twilioVerifyStart(leadForm.phone, 'sms')
        if (r?.ok) {
          setVerifyMode('pending')
          setLeadStatus('idle')
          return
        }
        // If start failed, surface error but still allow user to retry / fall through.
        setVerifyError(r?.error || 'Could not send verification code. Please double-check the phone number.')
        setLeadStatus('idle')
        return
      } catch (err) {
        // Network or unexpected — fall through to plain submit so we never block a real lead.
        console.warn('Twilio verify start failed, submitting unverified:', err)
      }
    }

    setLeadStatus('submitting')
    setLeadError('')
    try {
      const parts = [
        leadForm.address && `Address: ${leadForm.address}`,
        (leadForm.city || leadForm.zip) &&
          `Location: ${[leadForm.city, leadForm.zip].filter(Boolean).join(', ')}`,
        leadForm.service_type && `Service: ${leadForm.service_type}`,
        leadForm.timeframe && `Timeline: ${leadForm.timeframe}`,
        leadForm.sqft && `Project size: ~${leadForm.sqft} sq ft`,
        leadForm.notes && `Notes: ${leadForm.notes}`,
        phoneVerified && 'Phone verified via SMS ✅',
      ].filter(Boolean)

      await api.submitContact({
        name: leadForm.name,
        email: leadForm.email || undefined,
        phone: leadForm.phone || undefined,
        message: parts.join('\n') || 'Lead submitted via concierge widget',
      })
      setLeadStatus('success')
      setLeadForm(LEAD_INITIAL)
      setAiSuggestion(null)
      setPhoneVerified(false)
      setVerifyMode('idle')
      setVerifyCode('')
    } catch (err) {
      setLeadError(err.message || 'Something went wrong. Please try again.')
      setLeadStatus('error')
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setVerifyError('')
    setVerifyMode('verifying')
    try {
      const r = await api.twilioVerifyCheck(leadForm.phone, verifyCode)
      if (r?.ok) {
        setPhoneVerified(true)
        setVerifyMode('idle')
        setVerifyCode('')
        // Auto-resume submission with the verified phone
        await handleLeadSubmit({ preventDefault: () => {} })
      } else {
        setVerifyError('That code didn\u2019t match. Please try again.')
        setVerifyMode('pending')
      }
    } catch (err) {
      setVerifyError(err.message || 'Verification failed.')
      setVerifyMode('pending')
    }
  }

  const handleResendCode = async () => {
    setVerifyError('')
    try {
      const r = await api.twilioVerifyStart(leadForm.phone, 'sms')
      if (!r?.ok) setVerifyError(r?.error || 'Could not resend code.')
    } catch (err) {
      setVerifyError(err.message || 'Could not resend code.')
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
    <div
      className="fixed bottom-4 right-3 sm:right-5 z-50 flex flex-col items-end"
      role="complementary"
      aria-label="Mr. Worden concierge assistant"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Mr. Worden Concierge"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mb-3 w-[calc(100vw-1.5rem)] sm:w-[400px] bg-white rounded-2xl shadow-xl border border-brand-navy/10 flex flex-col overflow-hidden"
            style={{ maxHeight: 'min(80vh, 560px)' }}
          >
            {/* Header */}
            <div className="bg-brand-navy text-white px-4 py-3 flex items-center justify-between flex-shrink-0 border-b-2 border-brand-amber">
              <div className="flex items-center gap-3">
                <HeaderAvatar />
                <div>
                  <div className="font-display font-bold text-sm leading-tight">Mr. Worden</div>
                  <div className="text-white/70 text-xs flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${loading ? 'bg-brand-amber animate-pulse' : 'bg-emerald-400'}`} aria-hidden="true" />
                    {loading ? 'Thinking…' : 'Online · Reply in seconds'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`tel:${BUSINESS_PHONE_TEL}`}
                  className="bg-brand-amber hover:bg-brand-amber/90 text-brand-navy text-xs font-semibold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                  aria-label={`Call ${BUSINESS_PHONE}`}
                >
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Call</span>
                </a>
                <button
                  type="button"
                  onClick={() => setVoiceOn((v) => !v)}
                  className="text-white/60 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                  aria-label={voiceOn ? 'Mute Mr. Worden' : 'Unmute Mr. Worden'}
                  aria-pressed={voiceOn}
                >
                  {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-white/60 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
                  aria-label="Close Mr. Worden concierge"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-brand-navy/10 flex-shrink-0 bg-white" role="tablist">
              {[
                { id: 'actions', label: 'Command' },
                { id: 'chat', label: 'Advisor' },
                { id: 'help', label: 'Proof' },
                { id: 'lead', label: 'Intake' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 text-xs font-semibold py-2.5 transition-colors ${
                    activeTab === tab.id
                      ? 'text-brand-navy border-b-2 border-brand-amber bg-brand-amber/5'
                      : 'text-brand-navy/40 hover:text-brand-navy/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab bodies */}
            <div className="flex-1 overflow-y-auto min-h-0">

              {/* QUICK ACTIONS */}
              {activeTab === 'actions' && (
                <div className="px-4 py-5 space-y-3">
                  <div className="mb-4">
                    <p className="text-brand-navy font-display font-bold text-base">How can we help?</p>
                    <p className="text-brand-navy/60 text-xs mt-0.5">
                      {timeOfDayGreeting()} — J. Worden &amp; Sons, Chester, VA · Since 1984
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map((action) => {
                      const Icon = action.Icon
                      const baseClasses = action.primary
                        ? 'bg-brand-navy text-white border border-brand-navy hover:bg-brand-navy/90'
                        : 'bg-white text-brand-navy border border-brand-navy/15 hover:border-brand-amber hover:bg-brand-amber/5'
                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => {
                            if (action.action.startsWith('tab:')) {
                              setActiveTab(action.action.replace('tab:', ''))
                            } else if (action.action.startsWith('chat:')) {
                              setActiveTab('chat')
                              sendMessage(action.action.replace('chat:', ''))
                            } else if (action.action.startsWith('tel:')) {
                              window.location.href = action.action
                            }
                          }}
                          className={`${baseClasses} rounded-lg px-3 py-3 text-left transition-colors duration-150 flex flex-col gap-1`}
                        >
                          <Icon className={`w-4 h-4 ${action.primary ? 'text-brand-amber' : 'text-brand-navy/70'}`} aria-hidden="true" />
                          <span className="font-semibold text-xs leading-tight">{action.label}</span>
                          <span className="text-[11px] opacity-70 leading-tight">{action.sub}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-brand-navy/10 text-center">
                    <p className="text-[11px] text-brand-navy/50">
                      Licensed &amp; Insured · 40+ Years · Pavement Mag Top 75
                    </p>
                  </div>
                </div>
              )}

              {/* CHAT */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                    {messages.map((msg) => (
                      <Message key={msg.id} msg={msg} />
                    ))}
                    {loading && <TypingIndicator />}
                    {pendingEstimate && !loading && (
                      <EstimateCard estimate={pendingEstimate} />
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {pendingHandoff && !loading && (
                    <HandoffBanner
                      handoff={pendingHandoff}
                      onShowForm={() => setActiveTab('lead')}
                    />
                  )}

                  {!loading && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
                      {(messages.length <= 1 ? suggestionsForPath(pathname) : quickReplies).map((s) => (
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
                      placeholder="Ask about price, scans, 4D design, plans, drainage, or schedule..."
                      maxLength={800}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors"
                      aria-label="Message Mr. Worden"
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

              {/* HELP */}
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
                        <span className="text-brand-navy/30 group-open:rotate-180 transition-transform duration-200 ml-2 flex-shrink-0" aria-hidden="true">
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

              {/* LEAD FORM */}
              {activeTab === 'lead' && (
                <div className="px-4 py-4">
                  {leadStatus === 'success' ? (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-3">✅</div>
                      <p className="font-bold text-brand-navy text-base">{`You're on the list!`}</p>
                      <p className="text-brand-navy/60 text-sm mt-1 leading-relaxed">
                        Much obliged \u2014 {`we'll`} reach out within 24 hours to confirm your free on-site visit.
                      </p>
                      <div className="mt-4 space-y-2">
                        <a
                          href={`tel:${BUSINESS_PHONE_TEL}`}
                          className="block w-full text-center bg-green-600 text-white text-sm font-bold rounded-lg py-2.5 hover:bg-green-700 transition-colors"
                        >
                          📞 Or call us now: {BUSINESS_PHONE}
                        </a>
                        <button
                          type="button"
                          onClick={() => { setLeadStatus('idle'); setLeadForm(LEAD_INITIAL) }}
                          className="block w-full text-xs text-brand-amber font-semibold hover:underline pt-1"
                        >
                          Submit another request
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleLeadSubmit} className="space-y-3">
                      <p className="text-xs text-brand-navy/50 mb-1">
                        Fill in what you know \u2014 the more detail, the more accurate your estimate. We follow up within 24 hours.
                      </p>

                      <div>
                        <label htmlFor="lf-name" className="block text-xs font-semibold text-brand-navy mb-1">Full Name *</label>
                        <input id="lf-name" type="text" required maxLength={120} value={leadForm.name}
                          onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Your name"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors" />
                      </div>

                      <div>
                        <label htmlFor="lf-phone" className="block text-xs font-semibold text-brand-navy mb-1">Phone Number *</label>
                        <input id="lf-phone" type="tel" required maxLength={30} value={leadForm.phone}
                          onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="(804) 555-0100"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors" />
                      </div>

                      <div>
                        <label htmlFor="lf-email" className="block text-xs font-semibold text-brand-navy mb-1">
                          Email <span className="font-normal text-brand-navy/40">(optional)</span>
                        </label>
                        <input id="lf-email" type="email" maxLength={120} value={leadForm.email}
                          onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="your@email.com"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors" />
                      </div>

                      <div>
                        <label htmlFor="lf-address" className="block text-xs font-semibold text-brand-navy mb-1">
                          Project Address <span className="font-normal text-brand-navy/40">(optional)</span>
                        </label>
                        <input id="lf-address" type="text" maxLength={200} value={leadForm.address}
                          onChange={(e) => setLeadForm((f) => ({ ...f, address: e.target.value }))}
                          placeholder="123 Main St"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="lf-city" className="block text-xs font-semibold text-brand-navy mb-1">City</label>
                          <input id="lf-city" type="text" maxLength={80} value={leadForm.city}
                            onChange={(e) => setLeadForm((f) => ({ ...f, city: e.target.value }))}
                            placeholder="Richmond"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors" />
                        </div>
                        <div>
                          <label htmlFor="lf-zip" className="block text-xs font-semibold text-brand-navy mb-1">ZIP</label>
                          <input id="lf-zip" type="text" maxLength={10} value={leadForm.zip}
                            onChange={(e) => setLeadForm((f) => ({ ...f, zip: e.target.value }))}
                            placeholder="23831"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors" />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="lf-service" className="block text-xs font-semibold text-brand-navy mb-1">Service Type</label>
                        <select id="lf-service" value={leadForm.service_type}
                          onChange={(e) => setLeadForm((f) => ({ ...f, service_type: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors bg-white">
                          {SERVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="lf-timeframe" className="block text-xs font-semibold text-brand-navy mb-1">Timeframe</label>
                        <select id="lf-timeframe" value={leadForm.timeframe}
                          onChange={(e) => setLeadForm((f) => ({ ...f, timeframe: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors bg-white">
                          {TIMEFRAME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="lf-sqft" className="block text-xs font-semibold text-brand-navy mb-1">
                          Approx. Size <span className="font-normal text-brand-navy/40">(sq ft, optional)</span>
                        </label>
                        <input id="lf-sqft" type="number" min="0" max="10000000" step="50" value={leadForm.sqft}
                          onChange={(e) => setLeadForm((f) => ({ ...f, sqft: e.target.value }))}
                          placeholder="e.g. 1000"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors" />
                      </div>

                      <div>
                        <label htmlFor="lf-notes" className="block text-xs font-semibold text-brand-navy mb-1">Notes / Description</label>
                        <textarea id="lf-notes" rows={3} maxLength={1000} value={leadForm.notes}
                          onChange={handleNotesChange}
                          placeholder="Tell us about your project\u2026"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber transition-colors resize-none" />
                        {aiSuggestion?.hint && (
                          <p className="text-xs text-brand-amber mt-1">💡 {aiSuggestion.hint}</p>
                        )}
                      </div>

                      {leadStatus === 'error' && (
                        <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          {leadError}
                        </p>
                      )}

                      {verifyMode === 'pending' ? (
                        <div className="rounded-lg border border-brand-amber/40 bg-brand-amber/5 p-3 space-y-2">
                          <p className="text-xs text-brand-navy font-semibold">
                            📲 We just texted a 6-digit code to {leadForm.phone}
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={10}
                              value={verifyCode}
                              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                              placeholder="123456"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
                            />
                            <button
                              type="button"
                              onClick={handleVerifyCode}
                              disabled={verifyCode.length < 4 || verifyMode === 'verifying'}
                              className="bg-brand-amber text-brand-navy text-xs font-bold rounded-lg px-3 py-2 hover:bg-brand-amber/90 disabled:opacity-60"
                            >
                              {verifyMode === 'verifying' ? '\u2026' : 'Verify'}
                            </button>
                          </div>
                          {verifyError && (
                            <p className="text-red-600 text-[11px]">{verifyError}</p>
                          )}
                          <button
                            type="button"
                            onClick={handleResendCode}
                            className="text-[11px] text-brand-navy/60 hover:underline"
                          >
                            Didn\u2019t get it? Resend code
                          </button>
                        </div>
                      ) : (
                        <button
                          type="submit"
                          disabled={leadStatus === 'submitting'}
                          className="w-full bg-brand-navy text-white text-sm font-bold rounded-lg py-2.5 hover:bg-brand-navy/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {leadStatus === 'submitting'
                            ? (verifyEnabled && !phoneVerified ? 'Sending code\u2026' : 'Sending\u2026')
                            : phoneVerified
                              ? '✅ Submit Verified Request'
                              : verifyEnabled
                                ? '📲 Verify Phone & Submit'
                                : '📋 Request Free Estimate'}
                        </button>
                      )}

                      <div className="flex items-center gap-3 justify-center pt-1">
                        <a href={`tel:${BUSINESS_PHONE_TEL}`}
                          className="text-xs text-green-700 font-semibold hover:underline flex items-center gap-1">
                          <span aria-hidden="true">📞</span> {BUSINESS_PHONE}
                        </a>
                        <span className="text-brand-navy/20 text-xs">|</span>
                        <a href="mailto:j.wordenandsonspaving@gmail.com"
                          className="text-xs text-brand-amber font-semibold hover:underline">
                          Email us
                        </a>
                      </div>
                    </form>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MrWordenAvatar
        state={avatarState}
        size={76}
        onClick={() => setOpen((o) => !o)}
        isOpen={open}
        unread={unread}
      />
    </div>
  )
}
