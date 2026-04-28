import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'

/**
 * Floating "Get a Free Quote" CTA button pinned to the bottom-right.
 * Hides until the user starts scrolling, then becomes visible VISIBILITY_DELAY_MS
 * after the first scroll event — so it doesn't compete with the hero CTA.
 */

const VISIBILITY_DELAY_MS = 3000

export default function FloatingCTA() {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)
  const startedRef = useRef(false)

  const onScroll = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    timerRef.current = setTimeout(() => setVisible(true), VISIBILITY_DELAY_MS)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onScroll])

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <Link
        to="/quote"
        aria-label="Get a free asphalt paving quote"
        className="flex items-center gap-2 bg-brand-amber hover:bg-brand-amber-dark text-brand-navy font-bold px-5 py-3 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 text-sm"
        onClick={() => {
          if (typeof window.gtag === 'function')
            window.gtag('event', 'cta_click', { location: 'floating_button' })
        }}
      >
        <span className="text-lg" aria-hidden="true">
          🏗
        </span>
        Free Quote
      </Link>
    </div>
  )
}
