/**
 * DrivewayScanIllustration — branded SVG for the driveway scan tool.
 * Shows a phone scanning a cracked driveway with AI detection overlays.
 * 100% original JWORDENAI™ artwork — no stock photos.
 */
export default function DrivewayScanIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 420 310"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <pattern id="dsi-cracks" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <rect width="48" height="48" fill="#262626" />
          <path d="M4 6 Q8 14 6 28 Q4 36 8 44"  stroke="#111" strokeWidth="1.8" fill="none" opacity="0.9" />
          <path d="M22 2 L26 18 Q24 22 28 32"   stroke="#111" strokeWidth="1.2" fill="none" opacity="0.7" />
          <path d="M36 20 Q42 28 38 40 L42 46"  stroke="#111" strokeWidth="1.0" fill="none" opacity="0.5" />
          <circle cx="16" cy="24" r="2.5" fill="#1a1a1a" opacity="0.8" />
          <circle cx="38" cy="10" r="1.5" fill="#1a1a1a" opacity="0.6" />
        </pattern>
        <linearGradient id="dsi-beam" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#F5A623" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
        </linearGradient>
        <filter id="dsi-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="dsi-clip">
          <rect x="40" y="145" width="340" height="150" rx="4" />
        </clipPath>
      </defs>

      {/* Dark background */}
      <rect width="420" height="310" fill="#161616" />

      {/* Driveway surface */}
      <rect x="40" y="145" width="340" height="150" rx="4" fill="url(#dsi-cracks)" />
      {/* Driveway border highlight */}
      <rect x="40" y="145" width="340" height="3" fill="#F5A623" opacity="0.15" rx="2" />

      {/* Scan beam from phone to surface */}
      <polygon points="168,100 252,100 360,290 60,290"
               fill="url(#dsi-beam)" opacity="0.30" clipPath="url(#dsi-clip)" />

      {/* Active scan line */}
      <line x1="48" y1="208" x2="372" y2="208"
            stroke="#F5A623" strokeWidth="2.5" opacity="0.95" filter="url(#dsi-glow)" />
      <line x1="48" y1="208" x2="372" y2="208"
            stroke="white" strokeWidth="0.8" opacity="0.60" />

      {/* Scan corner brackets */}
      <g stroke="#F5A623" strokeWidth="2.2" fill="none" opacity="0.85">
        <path d="M52 165 L52 150 L70 150" />
        <path d="M368 150 L386 150 L386 165" />
        <path d="M52 278 L52 292 L70 292" />
        <path d="M368 292 L386 292 L386 278" />
      </g>

      {/* AI detection bounding boxes on driveway */}
      {/* Crack box */}
      <rect x="80"  y="163" width="62" height="42" rx="2"
            stroke="#ef4444" strokeWidth="1.8" fill="none" strokeDasharray="5 3" opacity="0.90" />
      <rect x="80"  y="155" width="40" height="12" rx="2" fill="#ef4444" opacity="0.85" />
      <text x="84" y="165" fontFamily="monospace" fontSize="8.5" fill="white" fontWeight="bold">CRACK</text>

      {/* Oxidation box */}
      <rect x="248" y="178" width="72" height="50" rx="2"
            stroke="#f97316" strokeWidth="1.8" fill="none" strokeDasharray="5 3" opacity="0.85" />
      <rect x="248" y="169" width="60" height="12" rx="2" fill="#f97316" opacity="0.85" />
      <text x="252" y="179" fontFamily="monospace" fontSize="8.5" fill="white" fontWeight="bold">OXIDATION</text>

      {/* Pothole box */}
      <rect x="140" y="238" width="55" height="38" rx="2"
            stroke="#eab308" strokeWidth="1.8" fill="none" strokeDasharray="5 3" opacity="0.80" />
      <rect x="140" y="230" width="56" height="11" rx="2" fill="#eab308" opacity="0.85" />
      <text x="143" y="239" fontFamily="monospace" fontSize="8" fill="#161616" fontWeight="bold">POTHOLE</text>

      {/* ── Phone ──────────────────────────────────────────────── */}
      <rect x="156" y="18" width="108" height="84" rx="11" fill="#1C1C1C" stroke="#F5A623" strokeWidth="1.5" />
      <rect x="164" y="25" width="92"  height="62" rx="7"  fill="#0d0d0d" />
      {/* Camera bump */}
      <rect x="194" y="14" width="32"  height="6"  rx="3"  fill="#2a2a2a" />
      <circle cx="210" cy="17" r="2.5" fill="#1a1a1a" />
      {/* Camera app viewfinder on screen */}
      <circle cx="210" cy="56" r="20" stroke="#F5A623" strokeWidth="1.8" fill="none" opacity="0.75" />
      <circle cx="210" cy="56" r="12" stroke="#F5A623" strokeWidth="1.2" fill="none" opacity="0.55" />
      <circle cx="210" cy="56" r="4"  fill="#F5A623" opacity="0.85" />
      {/* Corner focus markers on phone screen */}
      <g stroke="#F5A623" strokeWidth="1.5" fill="none" opacity="0.65">
        <path d="M170 32 L170 27 L176 27" />
        <path d="M250 27 L256 27 L256 32" />
        <path d="M170 78 L170 83 L176 83" />
        <path d="M250 83 L256 83 L256 78" />
      </g>
      {/* Shutter button */}
      <circle cx="210" cy="96" r="7"  fill="#F5A623" />
      <circle cx="210" cy="96" r="5"  fill="white" opacity="0.18" />

      {/* ── AI Score badge ─────────────────────────────────────── */}
      <rect x="298" y="148" width="72" height="48" rx="9" fill="#161616" stroke="#F5A623" strokeWidth="1.5" />
      <text x="334" y="166" fontFamily="monospace" fontSize="9"   fill="#F5A623"
            textAnchor="middle" fontWeight="bold" letterSpacing="1">SCORE</text>
      <text x="334" y="186" fontFamily="monospace" fontSize="18"  fill="#F5A623"
            textAnchor="middle" fontWeight="bold">6/10</text>

      {/* Confidence bar */}
      <rect x="50"  y="298" width="220" height="5" rx="3" fill="#2a2a2a" />
      <rect x="50"  y="298" width="154" height="5" rx="3" fill="#F5A623" opacity="0.80" />
      <text x="50"  y="310" fontFamily="monospace" fontSize="8" fill="#F5A623" opacity="0.55">AI CONFIDENCE: 70%</text>

      {/* Brand watermark */}
      <text x="210" y="308" fontFamily="monospace" fontSize="8.5" fill="#F5A623"
            textAnchor="middle" opacity="0.45" fontWeight="bold" letterSpacing="1.5">
        JWORDENAI™ CONDITION SCANNER
      </text>
    </svg>
  )
}
