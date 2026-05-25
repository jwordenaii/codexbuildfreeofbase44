import { useState, useRef, useCallback } from 'react'
import { analyzePhoto } from '../api/vision'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const SCAN_TYPES = [
  {
    id:    'compaction',
    label: 'Compaction',
    desc:  'Asphalt or gravel compaction quality',
    icon:  '🔵',
    color: 'border-blue-500/40 bg-blue-500/10',
    active: 'border-blue-400 bg-blue-500/20',
  },
  {
    id:    'base',
    label: 'Gravel Base',
    desc:  'Base layer depth and uniformity',
    icon:  '🟤',
    color: 'border-amber-700/40 bg-amber-900/10',
    active: 'border-amber-500 bg-amber-500/10',
  },
  {
    id:    'existing',
    label: 'Existing Conditions',
    desc:  'Document site before work starts',
    icon:  '📋',
    color: 'border-slate-500/40 bg-slate-700/20',
    active: 'border-slate-400 bg-slate-600/20',
  },
  {
    id:    'asphalt',
    label: 'Asphalt Surface',
    desc:  'Finished surface texture & quality',
    icon:  '🟧',
    color: 'border-orange-500/40 bg-orange-500/10',
    active: 'border-brand-400 bg-brand-500/10',
  },
]

function ScoreBar({ label, score, color = '#f59e0b' }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        <span className="text-xs font-black font-mono" style={{ color }}>{score}/10</span>
      </div>
      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000"
             style={{ width: `${score * 10}%`, background: color }} />
      </div>
    </div>
  )
}

export default function PhotoScan() {
  const fileRef  = useRef(null)
  const online   = useOnlineStatus()

  const [scanType, setScanType]   = useState('compaction')
  const [preview, setPreview]     = useState(null)
  const [file, setFile]           = useState(null)
  const [scanning, setScanning]   = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)

  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }, [])

  const onFileInput = (e) => handleFile(e.target.files?.[0])

  const openCamera = () => {
    if (fileRef.current) {
      fileRef.current.setAttribute('capture', 'environment')
      fileRef.current.click()
    }
  }

  const openGallery = () => {
    if (fileRef.current) {
      fileRef.current.removeAttribute('capture')
      fileRef.current.click()
    }
  }

  const analyze = async () => {
    if (!file) return
    if (!online) { setError('No connection — photo saved, analysis will run when online'); return }
    setScanning(true)
    setError(null)
    try {
      const data = await analyzePhoto(file, scanType)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Analysis failed')
    } finally {
      setScanning(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const selected = SCAN_TYPES.find(t => t.id === scanType)

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="text-lg font-black text-slate-100">AI Site Scan</h1>
        {!online && (
          <span className="ml-auto status-badge bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Offline
          </span>
        )}
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* Scan type selector */}
        {!result && (
          <div>
            <p className="section-title">What are you scanning?</p>
            <div className="grid grid-cols-2 gap-2">
              {SCAN_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setScanType(t.id)}
                  className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.97]
                               ${scanType === t.id ? t.active : t.color}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{t.icon}</span>
                    {scanType === t.id && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-brand-400" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-200">{t.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Photo area */}
        {!result && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFileInput}
              className="hidden"
            />

            {preview ? (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-surface-800 border border-surface-700">
                  <img src={preview} alt="Scan preview" className="w-full object-cover" style={{ maxHeight: 280 }} />
                  <button
                    onClick={reset}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-950/80 backdrop-blur
                               flex items-center justify-center text-slate-300 active:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="absolute bottom-0 inset-x-0 px-4 py-3 bg-gradient-to-t from-surface-950/90">
                    <p className="text-xs font-semibold text-slate-300">
                      {selected?.icon} {selected?.label}
                    </p>
                  </div>
                </div>

                <button onClick={analyze} disabled={scanning} className="btn-primary">
                  {scanning ? (
                    <>
                      <svg className="w-5 h-5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="10" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Run AI Analysis
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={openCamera}
                  className="flex flex-col items-center gap-3 py-8 px-4 bg-surface-800 border-2 border-dashed
                             border-surface-600 rounded-2xl active:bg-surface-700 transition-colors"
                >
                  <svg className="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                  <span className="text-sm font-bold text-slate-200">Take Photo</span>
                  <span className="text-xs text-slate-500">Open camera</span>
                </button>

                <button
                  onClick={openGallery}
                  className="flex flex-col items-center gap-3 py-8 px-4 bg-surface-800 border-2 border-dashed
                             border-surface-600 rounded-2xl active:bg-surface-700 transition-colors"
                >
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-bold text-slate-200">From Gallery</span>
                  <span className="text-xs text-slate-500">Choose photo</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl animate-slide-down">
            <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-100">Analysis Results</h2>
              <button onClick={reset} className="text-xs font-semibold text-brand-400 active:text-brand-300 py-1 px-3">
                Scan again
              </button>
            </div>

            {preview && (
              <div className="rounded-2xl overflow-hidden border border-surface-700">
                <img src={preview} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />
              </div>
            )}

            {/* Overall verdict */}
            <div className={`card border-2 ${
              result.overall_score >= 7 ? 'border-green-500/40 bg-green-500/5'
              : result.overall_score >= 5 ? 'border-brand-500/40 bg-brand-500/5'
              : 'border-red-500/40 bg-red-500/5'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`text-4xl font-black font-mono ${
                  result.overall_score >= 7 ? 'text-green-400'
                  : result.overall_score >= 5 ? 'text-brand-400'
                  : 'text-red-400'
                }`}>
                  {result.overall_score ?? '—'}<span className="text-xl text-slate-500">/10</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-100">{result.verdict ?? 'Assessment Complete'}</p>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">{result.summary}</p>
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            {result.scores && Object.keys(result.scores).length > 0 && (
              <div className="card space-y-3">
                <p className="section-title">Breakdown</p>
                {Object.entries(result.scores).map(([key, val]) => (
                  <ScoreBar
                    key={key}
                    label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    score={val}
                    color={val >= 7 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </div>
            )}

            {/* Flags */}
            {result.flags?.length > 0 && (
              <div className="card border-red-500/20 space-y-2">
                <p className="section-title text-red-500">Issues Flagged</p>
                {result.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
                    <span className="text-slate-300">{flag}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <div className="card border-brand-500/20 space-y-2">
                <p className="section-title text-brand-500">Recommendations</p>
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-brand-400 mt-0.5 flex-shrink-0">→</span>
                    <span className="text-slate-300">{rec}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-center text-xs text-slate-600">
              Saved to job record · {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
