/**
 * ChatWidget — J. Worden Sr. founder persona chat bubble.
 *
 * Renders a chat button fixed to the bottom-left corner (FloatingCTA lives
 * on the right). On click it expands to a chat panel voiced as J. Worden Sr.,
 * the company founder.  All questions are sent to POST /api/v1/ai/chat; a
 * client-side stub answers gracefully when the backend is unavailable.
 *
 * The widget auto-opens with a greeting after a short delay on first visit
 * (once per browser session) to proactively engage arriving customers.
 */
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

// Generate a stable session ID per browser session (persisted in sessionStorage)
function getOrCreateSessionId() {
  const key = 'jworden_chat_session_id'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    // Use crypto.randomUUID() when available (all modern browsers); fall back
    // to a time-based ID only in environments where the Web Crypto API is absent.
    sid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `web-${crypto.randomUUID()}`
      : `web-${Date.now()}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')}`
    sessionStorage.setItem(key, sid)
  }
  return sid
}

const SUGGESTIONS = [
  'How much does a new driveway cost?',
  'Can you pave my parking lot?',
  'I need sealcoating — how do I get started?',
  'What areas do you serve?',
]

const BOT_AVATAR = '👴'
const USER_AVATAR = '👷'

function Message({ msg }) {
  const isBot = msg.role === 'bot'
  return (
    <div className={`flex gap-2 ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}>
      <span className="text-xl flex-shrink-0">{isBot ? BOT_AVATAR : USER_AVATAR}</span>
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
      <span className="text-xl">{BOT_AVATAR}</span>
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

// How long (ms) to wait before auto-opening the chat on a visitor's first page load
const GREETING_DELAY_MS = 6000

const INITIAL_MESSAGES = [
  {
    id: 0,
    role: 'bot',
    text: "Welcome — I'm a digital tribute to J. Worden Sr., founder of J. Worden & Sons Paving since 1984. I'm here to answer your questions, give you a ballpark, and get you on our schedule. What are you working on today?",
  },
]

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  // Stable session ID — persisted across page navigations within the same tab
  const sessionIdRef = useRef(getOrCreateSessionId())

  // Auto-open once per session after a short delay to proactively greet visitors.
  // Skip on mobile (viewport narrower than 640 px) to avoid covering the page.
  useEffect(() => {
    const greeted = sessionStorage.getItem('jworden_greeted')
    if (greeted) return
    const isMobile = window.innerWidth < 640
    if (isMobile) {
      // Mark greeted so the check doesn't fire again, but don't open the panel.
      sessionStorage.setItem('jworden_greeted', '1')
      return
    }
    const timer = setTimeout(() => {
      setOpen(true)
      sessionStorage.setItem('jworden_greeted', '1')
    }, GREETING_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Scroll to bottom on new message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, loading])

  // Focus input when chat opens
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const sendMessage = async (text) => {
    const question = text.trim()
    if (!question || loading) return

    const userMsg = { id: Date.now(), role: 'user', text: question }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const data = await api.askAI({ question, session_id: sessionIdRef.current })
      // If the backend echoes back a session_id, keep ours in sync
      if (data.session_id) sessionIdRef.current = data.session_id
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'bot', text: data.answer },
      ])
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
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="fixed bottom-6 left-4 sm:left-6 z-50 flex flex-col items-start">
      {/* Chat panel */}
      {open && (
        <div
          className="mb-3 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-brand-navy/10 flex flex-col overflow-hidden"
          style={{ maxHeight: 'min(75vh, 520px)' }}
        >
          {/* Header */}
          <div className="bg-brand-navy text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👴</span>
              <div>
                <div className="font-bold text-sm">J. Worden Sr.</div>
                <div className="text-white/60 text-xs">Founder · 40+ Years in Paving</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white transition-colors text-lg leading-none"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map((msg) => (
              <Message key={msg.id} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (shown only on opening message) */}
          {messages.length === 1 && !loading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
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

          {/* Schedule / Deposit CTA */}
          <div className="px-4 pb-3 flex-shrink-0">
            <Link
              to="/quote"
              onClick={() => setOpen(false)}
              className="block w-full text-center bg-brand-amber text-brand-navy text-sm font-bold rounded-lg py-2 hover:bg-brand-amber/80 transition-colors"
            >
              📅 Book Free On-Site Visit &amp; Hold My Spot
            </Link>
          </div>

          {/* Input */}
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

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="bg-brand-navy text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-brand-navy/90 transition-all hover:scale-105 active:scale-95"
        aria-label={open ? 'Close chat with J. Worden Sr.' : 'Chat with J. Worden Sr., our founder'}
      >
        {open ? (
          <span className="text-xl">✕</span>
        ) : (
          <span className="text-2xl">👴</span>
        )}
      </button>
    </div>
  )
}
