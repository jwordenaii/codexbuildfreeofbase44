/**
 * VirtualForeman — LangChain RAG-powered chat UI.
 *
 * Connects to POST /api/v1/foreman/chat.
 * Shows source attribution when the RAG engine is active.
 */

import { useState, useRef, useEffect } from 'react'

const BOT_AVATAR = '🏗️'
const USER_AVATAR = '👷'

const SUGGESTIONS = [
  'Which permit leads are HOT this week?',
  'What are VDOT HMA temperature specs?',
  'Show me the status of active sites',
  'What Virginia license do I need for a $200K job?',
]

const INITIAL_MESSAGES = [
  {
    id: 0,
    role: 'bot',
    text: "I'm your 4D Virtual Foreman 🏗️ — ask me about active sites, permit leads, trucking logistics, field specs, or Virginia construction law.",
    sources: [],
  },
]

function Message({ msg }) {
  const isBot = msg.role === 'bot'
  return (
    <div className={`flex gap-2 ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}>
      <span className="text-xl flex-shrink-0">{isBot ? BOT_AVATAR : USER_AVATAR}</span>
      <div className="max-w-[82%]">
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isBot
              ? 'bg-white/10 text-white rounded-tl-none'
              : 'bg-brand-amber text-brand-navy rounded-tr-none'
          }`}
        >
          {msg.text}
        </div>
        {isBot && msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {msg.sources.map((s) => (
              <span
                key={s}
                className="text-xs bg-white/5 text-white/40 border border-white/10 rounded-full px-2 py-0.5"
              >
                📄 {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-xl">{BOT_AVATAR}</span>
      <div className="bg-white/10 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function VirtualForeman({ context = null }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const question = text.trim()
    if (!question || loading) return

    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', text: question, sources: [] }])
    setInput('')
    setLoading(true)

    try {
      const BASE = import.meta.env.VITE_API_BASE_URL || ''
      const res = await fetch(`${BASE}/api/v1/foreman/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
        signal: AbortSignal.timeout(15_000),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'bot', text: data.answer, sources: data.sources || [] },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'bot', text: 'Connection issue — please try again.', sources: [] },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-brand-navy/50 rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="bg-brand-navy px-4 py-3 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
        <span className="text-2xl">🏗️</span>
        <div>
          <div className="font-bold text-white text-sm">4D Virtual Foreman</div>
          <div className="text-white/40 text-xs">RAG-powered · Sites · Leads · Logistics · Law</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-white/40">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.map((msg) => (
          <Message key={msg.id} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && !loading && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendMessage(s)}
              className="text-xs bg-white/5 text-white/70 border border-white/10 rounded-full px-3 py-1 hover:bg-white/10 transition-colors text-left"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 px-3 py-3 flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
          }}
          placeholder="Ask about sites, leads, trucks, specs…"
          maxLength={1500}
          className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
        />
        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="bg-brand-amber text-brand-navy rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-40 hover:bg-brand-amber/80 transition-colors"
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
