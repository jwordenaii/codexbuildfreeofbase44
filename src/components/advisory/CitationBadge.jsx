import { useState, useCallback } from 'react'

/**
 * CitationBadge — displays a statute citation with a copy-to-clipboard button.
 *
 * Props:
 *   citation — string e.g. "Cal. Civ. Code § 8100 et seq."
 */
export default function CitationBadge({ citation }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!citation) return
    navigator.clipboard.writeText(citation).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [citation])

  if (!citation) return null

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy citation"
      className="inline-flex items-center gap-1.5 bg-brand-navy/5 hover:bg-brand-navy/10 border border-brand-navy/20 text-brand-navy/70 text-xs font-mono rounded-md px-2 py-1 transition-colors"
    >
      <span className="text-brand-amber" aria-hidden="true">
        §
      </span>
      <span>{citation}</span>
      <span className="text-brand-navy/40" aria-hidden="true">
        {copied ? '✓' : '⧉'}
      </span>
      <span className="sr-only">{copied ? 'Copied' : 'Copy citation'}</span>
    </button>
  )
}
