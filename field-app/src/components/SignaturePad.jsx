import { useRef, useCallback, useState } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'

export default function SignaturePad({ onCapture, onClear }) {
  const padRef   = useRef(null)
  const [signed, setSigned] = useState(false)

  const handleEnd = useCallback(() => {
    if (padRef.current && !padRef.current.isEmpty()) {
      setSigned(true)
      const dataUrl = padRef.current.getTrimmedCanvas().toDataURL('image/png')
      onCapture?.(dataUrl)
    }
  }, [onCapture])

  const clear = useCallback(() => {
    padRef.current?.clear()
    setSigned(false)
    onClear?.()
  }, [onClear])

  return (
    <div className="space-y-3">
      <div className={`relative rounded-2xl overflow-hidden border-2 transition-colors duration-200
                       ${signed ? 'border-brand-500 glow-brand' : 'border-surface-600'}`}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          {!signed && (
            <p className="text-slate-500 text-sm font-medium select-none">Sign here</p>
          )}
        </div>
        <ReactSignatureCanvas
          ref={padRef}
          onEnd={handleEnd}
          canvasProps={{
            className: 'block w-full touch-none',
            style: { height: 160, background: '#1e293b' },
          }}
          penColor="#f59e0b"
          minWidth={2}
          maxWidth={4}
          velocityFilterWeight={0.6}
        />
      </div>

      {signed && (
        <button onClick={clear} className="btn-secondary py-3 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear signature
        </button>
      )}
    </div>
  )
}
