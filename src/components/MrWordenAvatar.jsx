/**
 * MrWordenAvatar — Animated SVG persona of Mr. J. Worden Sr.
 *
 * Renders a layered SVG caricature of the company founder with three
 * behavioral states driven by framer-motion animations:
 *
 *   idle     — gentle up/down float with ambient amber glow pulse
 *   talking  — rhythmic head nod + open-mouth; glow intensifies
 *   listening — slight head tilt, attentive expression
 *
 * The component is deliberately lightweight (pure SVG + CSS transforms,
 * no WebGL/canvas) so it renders instantly on every page without blocking
 * the main thread or requiring a GPU context.
 */
import { motion, AnimatePresence } from 'framer-motion'

/** The SVG character art for Mr. J. Worden Sr. */
function JWordenSVG({ talking = false }) {
  return (
    <svg
      viewBox="0 0 80 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {/* Ground shadow — adds depth */}
      <ellipse cx="40" cy="86" rx="18" ry="3.5" fill="black" opacity="0.12" />

      {/* ── Hard hat ─────────────────────────────────────────────────── */}
      <path d="M18 31 Q17 17 40 15 Q63 17 62 31 Z" fill="#f5a623" />
      <rect x="13" y="29" width="54" height="6" rx="3" fill="#d4880a" />
      <rect x="15" y="29" width="50" height="4.5" rx="2" fill="#f5a623" />
      {/* Hat badge */}
      <rect x="36" y="22" width="8" height="5" rx="1.5" fill="#d4880a" opacity="0.8" />
      <text x="40" y="26.5" fontSize="4" fill="white" textAnchor="middle" fontWeight="bold">
        JW
      </text>

      {/* ── Ears ─────────────────────────────────────────────────────── */}
      <ellipse cx="21.5" cy="47" rx="3.5" ry="4.5" fill="#F0B98F" />
      <ellipse cx="58.5" cy="47" rx="3.5" ry="4.5" fill="#F0B98F" />

      {/* ── Head ─────────────────────────────────────────────────────── */}
      <ellipse cx="40" cy="46" rx="18" ry="20" fill="#F4C3A1" />

      {/* ── Glasses ──────────────────────────────────────────────────── */}
      <circle
        cx="32"
        cy="44"
        r="6.5"
        stroke="#4a4a4a"
        strokeWidth="1.8"
        fill="white"
        fillOpacity="0.6"
      />
      <circle
        cx="48"
        cy="44"
        r="6.5"
        stroke="#4a4a4a"
        strokeWidth="1.8"
        fill="white"
        fillOpacity="0.6"
      />
      {/* Bridge */}
      <path d="M38.5 44 H41.5" stroke="#4a4a4a" strokeWidth="1.6" />
      {/* Temples */}
      <path d="M25.5 44 H20" stroke="#4a4a4a" strokeWidth="1.6" />
      <path d="M54.5 44 H60" stroke="#4a4a4a" strokeWidth="1.6" />

      {/* ── Eyes ─────────────────────────────────────────────────────── */}
      <circle cx="32" cy="44" r="2.8" fill="#2a1505" />
      <circle cx="48" cy="44" r="2.8" fill="#2a1505" />
      {/* Catchlight */}
      <circle cx="33" cy="43" r="0.9" fill="white" />
      <circle cx="49" cy="43" r="0.9" fill="white" />

      {/* ── Nose ─────────────────────────────────────────────────────── */}
      <path
        d="M37.5 48 Q40 52.5 42.5 48"
        stroke="#c8966c"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── Mustache ─────────────────────────────────────────────────── */}
      <path
        d="M31 54 Q36 57 40 55 Q44 57 49 54"
        stroke="#7a4a25"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* ── Mouth (animated open when talking) ──────────────────────── */}
      {talking ? (
        <>
          <ellipse cx="40" cy="58" rx="5.5" ry="3.2" fill="#c87040" />
          <ellipse cx="40" cy="57" rx="4.5" ry="1.5" fill="#f4c3a1" opacity="0.5" />
        </>
      ) : (
        <path
          d="M33 57 Q40 62.5 47 57"
          stroke="#c8966c"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* ── Cheek blush ──────────────────────────────────────────────── */}
      <ellipse cx="24" cy="51" rx="3.5" ry="2" fill="#e0846e" opacity="0.3" />
      <ellipse cx="56" cy="51" rx="3.5" ry="2" fill="#e0846e" opacity="0.3" />

      {/* ── Neck ─────────────────────────────────────────────────────── */}
      <rect x="35" y="64" width="10" height="7" rx="2" fill="#F0B98F" />

      {/* ── Jacket / body ────────────────────────────────────────────── */}
      <path d="M19 73 Q18 88 40 88 Q62 88 61 73 Q52 66 40 66 Q28 66 19 73 Z" fill="#1a1a2e" />
      {/* Lapels */}
      <path d="M37 67 L28 72 L33 75 L40 70 Z" fill="#16213e" />
      <path d="M43 67 L52 72 L47 75 L40 70 Z" fill="#16213e" />

      {/* ── Amber tie ────────────────────────────────────────────────── */}
      <path d="M37.5 66 L40 70 L42.5 66 L40 68.5 Z" fill="#f5a623" />
      <path d="M38.5 70 L40 78 L41.5 70 Z" fill="#f5a623" />

      {/* ── Shirt collar ─────────────────────────────────────────────── */}
      <path
        d="M36 65 L38 70 L40 67 L42 70 L44 65"
        stroke="white"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Exported avatar component.
 *
 * Props:
 *   state  — 'idle' | 'talking' | 'listening'
 *   size   — pixel size of the rendered character (default 56)
 *   onClick — click handler (opens/closes the chat panel)
 *   isOpen  — whether the chat panel is currently open (used for badge)
 *   unread  — number of unread messages (shows badge when > 0 and closed)
 */
export default function MrWordenAvatar({
  state = 'idle',
  size = 56,
  onClick,
  isOpen = false,
  unread = 0,
}) {
  // Keyframe sequences per state
  const floatAnim =
    state === 'idle'
      ? { y: [0, -6, 0] }
      : state === 'talking'
        ? { y: [0, -3, 0], scaleX: [1, 1.03, 1] }
        : { rotate: [-2, 2, -2] }

  const floatTransition =
    state === 'idle'
      ? { repeat: Infinity, duration: 3.2, ease: 'easeInOut' }
      : state === 'talking'
        ? { repeat: Infinity, duration: 0.65, ease: 'easeInOut' }
        : { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }

  const glowColor = state === 'talking' ? 'rgba(245,166,35,0.5)' : 'rgba(245,166,35,0.25)'
  const glowScale = state === 'talking' ? [1, 1.4, 1] : [1, 1.25, 1]
  const glowDuration = state === 'talking' ? 0.65 : 2.8

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? 'Close assistant panel' : 'Open Mr. J. Worden assistant'}
      className="relative focus:outline-none group select-none"
      style={{ width: size + 16, height: size + 20 }}
    >
      {/* Ambient glow ring */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: -6,
          background: glowColor,
          filter: 'blur(8px)',
        }}
        animate={{ scale: glowScale, opacity: [0.6, 0.15, 0.6] }}
        transition={{ repeat: Infinity, duration: glowDuration, ease: 'easeInOut' }}
      />

      {/* Outer ring */}
      <motion.div
        className="absolute rounded-full border-2 pointer-events-none"
        style={{
          inset: 0,
          borderColor: state === 'talking' ? '#f5a623' : 'rgba(245,166,35,0.4)',
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.8, 0.3, 0.8] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
      />

      {/* Character with CSS 3D perspective for depth */}
      <motion.div
        animate={floatAnim}
        transition={floatTransition}
        whileHover={{ scale: 1.12, y: -4 }}
        style={{
          width: size,
          height: size + 8,
          perspective: 400,
          transformStyle: 'preserve-3d',
          marginLeft: 8,
        }}
      >
        <motion.div
          whileHover={{ rotateY: 8, rotateX: -4 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <JWordenSVG talking={state === 'talking'} />
        </motion.div>
      </motion.div>

      {/* Unread badge */}
      <AnimatePresence>
        {!isOpen && unread > 0 && (
          <motion.div
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md"
          >
            {unread > 9 ? '9+' : unread}
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Ask me!" tooltip on first hover */}
      <motion.div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-brand-navy text-white text-xs rounded-lg whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ zIndex: 10 }}
      >
        {isOpen ? 'Close Mr. Worden' : 'Ask Mr. Worden'}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-brand-navy" />
      </motion.div>
    </button>
  )
}
