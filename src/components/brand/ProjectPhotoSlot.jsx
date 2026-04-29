/**
 * ProjectPhotoSlot — branded placeholder for project cards with no photo yet.
 * Uses asphalt-texture SVG + JWORDENAI™ branding instead of a generic gray box.
 * Guides the operator to add their real Dropbox / Google Photos archive image.
 */
export default function ProjectPhotoSlot({ projectName = 'Project', emoji = '📸', className = '' }) {
  const patternId = `pps-${projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
  return (
    <div
      className={`relative overflow-hidden flex flex-col items-center justify-center bg-brand-navy ${className}`}
      role="img"
      aria-label={`Project photo placeholder for ${projectName} — add from archive`}
    >
      {/* Asphalt texture background */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <pattern id={patternId} x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="#1a1a1a" />
            <rect x="1" y="1" width="1" height="1" fill="#222" opacity="0.6" />
            <rect x="4" y="4" width="2" height="1" fill="#111" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      {/* Diagonal amber construction stripes */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <pattern id={`${patternId}-stripe`} x="0" y="0" width="28" height="28"
                   patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="28" fill="#F5A623" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId}-stripe)`} />
      </svg>

      {/* Corner bracket marks */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g stroke="#F5A623" strokeWidth="2" fill="none" opacity="0.35">
          <path d="M10 28 L10 10 L28 10" />
          <path d="M100% 28" />
        </g>
      </svg>

      {/* Content */}
      <div className="relative z-10 text-center px-4 py-6">
        <div className="text-4xl mb-2" aria-hidden="true">{emoji}</div>
        <div className="font-display font-black text-brand-amber text-sm tracking-wide mb-1">
          J. Worden &amp; Sons
        </div>
        <div className="text-white/40 text-xs leading-snug max-w-[160px] mx-auto">
          Photo on file in<br />Dropbox / Google Photos
        </div>
      </div>
    </div>
  )
}
