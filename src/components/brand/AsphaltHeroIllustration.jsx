/**
 * AsphaltHeroIllustration — branded SVG hero background.
 * Depicts a paving machine laying fresh asphalt under construction-amber lighting.
 * 100% original JWORDENAI™ artwork — no stock photos.
 */
export default function AsphaltHeroIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 1200 480"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Aged asphalt texture */}
        <pattern id="ahi-asphalt" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#1a1a1a" />
          <rect x="1" y="2" width="2" height="1" fill="#222" opacity="0.7" />
          <rect x="6" y="5" width="1" height="2" fill="#111" opacity="0.5" />
          <rect x="3" y="7" width="3" height="1" fill="#252525" opacity="0.4" />
          <rect x="8" y="1" width="1" height="3" fill="#1e1e1e" opacity="0.3" />
        </pattern>
        {/* Fresh hot asphalt — warm, slightly brighter */}
        <pattern id="ahi-fresh" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#232323" />
          <rect x="2" y="2" width="1" height="1" fill="#2e2e2e" opacity="0.8" />
          <rect x="5" y="5" width="2" height="1" fill="#1e1e1e" opacity="0.5" />
        </pattern>
        {/* Amber radial glow from paving machine */}
        <radialGradient id="ahi-glow" cx="52%" cy="68%" r="30%">
          <stop offset="0%" stopColor="#F5A623" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
        </radialGradient>
        {/* Machine body gradient */}
        <linearGradient id="ahi-machine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5A623" />
          <stop offset="60%" stopColor="#D4880A" />
          <stop offset="100%" stopColor="#b37308" />
        </linearGradient>
        {/* Edge fade — dark sides so text reads over it */}
        <linearGradient id="ahi-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#161616" stopOpacity="0.96" />
          <stop offset="18%"  stopColor="#161616" stopOpacity="0" />
          <stop offset="78%"  stopColor="#161616" stopOpacity="0" />
          <stop offset="100%" stopColor="#161616" stopOpacity="0.90" />
        </linearGradient>
        {/* Top fade — sky to content */}
        <linearGradient id="ahi-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#161616" stopOpacity="1" />
          <stop offset="40%" stopColor="#161616" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Sky / overall background */}
      <rect width="1200" height="480" fill="#161616" />

      {/* Road surface — full width */}
      <rect x="0" y="250" width="1200" height="230" fill="url(#ahi-asphalt)" />

      {/* Fresh-laid strip behind the machine */}
      <rect x="480" y="265" width="720" height="200" fill="url(#ahi-fresh)" />

      {/* Dividing line — old vs new asphalt */}
      <line x1="480" y1="265" x2="480" y2="465" stroke="#F5A623" strokeWidth="1.5" opacity="0.20" />

      {/* Road shoulder markings */}
      <rect x="0"    y="258" width="1200" height="4" fill="#F5A623" opacity="0.08" />
      <rect x="0"    y="462" width="1200" height="4" fill="#F5A623" opacity="0.08" />

      {/* Yellow centerline dashes */}
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={i * 88 + 14} y="356" width="56" height="9" rx="2" fill="#F5A623" opacity="0.55" />
      ))}

      {/* Ambient amber glow from machine heat */}
      <rect width="1200" height="480" fill="url(#ahi-glow)" />

      {/* ── Paving Machine ──────────────────────────────────────── */}
      <g transform="translate(430, 222)">
        {/* Hopper (front wedge) */}
        <polygon points="0,45 35,8 175,8 210,45" fill="#F5A623" opacity="0.85" />
        {/* Main body */}
        <rect x="0" y="44" width="210" height="78" rx="3" fill="url(#ahi-machine)" />
        {/* Cab structure */}
        <rect x="18" y="10" width="82" height="46" rx="4" fill="#b37308" />
        {/* Cab windshield */}
        <rect x="26" y="16" width="64" height="30" rx="3" fill="#0d0d0d" opacity="0.85" />
        {/* Windshield glare */}
        <rect x="28" y="18" width="18" height="10" rx="1" fill="white" opacity="0.06" />
        {/* Screed (rear paving bar) */}
        <rect x="202" y="94" width="28" height="14" rx="2" fill="#2c2c2c" />
        <rect x="202" y="98" width="28" height="4"  rx="1" fill="#F5A623" opacity="0.30" />
        {/* Drive tracks */}
        <rect x="8"   y="118" width="72" height="18" rx="9" fill="#1a1a1a" />
        <rect x="130" y="118" width="72" height="18" rx="9" fill="#1a1a1a" />
        {/* Track tread links */}
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={11 + i * 11} y="120" width="8" height="14" rx="2" fill="#2a2a2a" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={133 + i * 11} y="120" width="8" height="14" rx="2" fill="#2a2a2a" />
        ))}
        {/* Brand label on side */}
        <text x="48" y="96" fontFamily="monospace" fontSize="11" fontWeight="bold"
              fill="#161616" opacity="0.55" letterSpacing="1">JWORDENAI™</text>
        {/* Rotating amber safety beacon */}
        <circle cx="198" cy="10" r="9"  fill="#F5A623" opacity="0.90" />
        <circle cx="198" cy="10" r="6"  fill="#fff"    opacity="0.15" />
        <circle cx="198" cy="10" r="3"  fill="#F5A623" />
        {/* Exhaust stack */}
        <rect x="155" y="0" width="8" height="22" rx="3" fill="#2c2c2c" />
        {/* Exhaust puff */}
        <ellipse cx="159" cy="0" rx="10" ry="6" fill="#3a3a3a" opacity="0.35" />
        <ellipse cx="162" cy="-8" rx="7"  ry="5" fill="#3a3a3a" opacity="0.20" />
      </g>

      {/* Heat shimmer wisps above fresh asphalt */}
      {[520, 620, 730, 840, 950].map((x, i) => (
        <ellipse key={i} cx={x} cy="262" rx="14" ry="28"
                 fill="#F5A623" opacity="0.06" />
      ))}

      {/* Worker silhouette — flagging crew */}
      <g transform="translate(340, 298)" opacity="0.45">
        <circle cx="10" cy="0"  r="9"  fill="#2a2a2a" />   {/* head */}
        <rect   x="4"  y="9"   width="12" height="28" rx="3" fill="#2a2a2a" />  {/* body */}
        <rect   x="-2" y="14"  width="8"  height="3"  rx="1" fill="#2a2a2a" />  {/* left arm */}
        <rect   x="14" y="10"  width="3"  height="26" rx="1" fill="#F5A623" opacity="0.8" />  {/* flag pole */}
        <polygon points="17,10 28,14 17,18" fill="#F5A623" opacity="0.85" />  {/* flag */}
        <rect   x="4"  y="37"  width="5"  height="20" rx="2" fill="#2a2a2a" />  {/* left leg */}
        <rect   x="11" y="37"  width="5"  height="20" rx="2" fill="#2a2a2a" />  {/* right leg */}
      </g>

      {/* Edge fade overlay */}
      <rect width="1200" height="480" fill="url(#ahi-fade)" />
      {/* Top fade */}
      <rect width="1200" height="480" fill="url(#ahi-top)" />
    </svg>
  )
}
