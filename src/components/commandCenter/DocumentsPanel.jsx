/**
 * DocumentsPanel — Upload contracts, blueprints, or permit PDFs for AI Vision analysis.
 *
 * Three upload modes via tabs:
 *   Contract  — POST /api/v1/documents/parse-contract  (PDF or image)
 *   Blueprint — POST /api/v1/documents/parse-blueprint (image)
 *   Permit    — POST /api/v1/documents/parse-permit    (PDF only)
 */
import { useState, useRef } from 'react'

const MODES = [
  {
    id: 'contract',
    label: '📝 Contract',
    accept: '.pdf,.jpg,.jpeg,.png,.webp',
    hint: 'PDF or image (JPEG/PNG/WebP). Max 20 MB.',
    endpoint: '/api/v1/documents/parse-contract',
  },
  {
    id: 'blueprint',
    label: '📐 Blueprint',
    accept: '.jpg,.jpeg,.png,.webp,.gif',
    hint: 'Image file (JPEG/PNG/WebP/GIF). Max 20 MB.',
    endpoint: '/api/v1/documents/parse-blueprint',
  },
  {
    id: 'permit',
    label: '🏗 Permit PDF',
    accept: '.pdf',
    hint: 'PDF only. Max 20 MB.',
    endpoint: '/api/v1/documents/parse-permit',
  },
]

function ResultBlock({ data }) {
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, val]) => {
        if (key === 'status' || key === 'filename') return null
        const display = Array.isArray(val)
          ? val.join(', ')
          : typeof val === 'object' && val !== null
            ? JSON.stringify(val, null, 2)
            : String(val ?? '—')
        return (
          <div key={key} className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-bold text-brand-navy/50 uppercase tracking-wide mb-1">
              {key.replace(/_/g, ' ')}
            </div>
            <div className="text-sm text-brand-navy whitespace-pre-wrap">{display || '—'}</div>
          </div>
        )
      })}
    </div>
  )
}

const BASE = import.meta.env.VITE_API_BASE_URL || ''
// Document AI analysis may take longer than the default timeout for larger files
const UPLOAD_TIMEOUT_MS = 60_000

export default function DocumentsPanel() {
  const [mode, setMode] = useState('contract')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const currentMode = MODES.find((m) => m.id === mode)

  const handleFile = (e) => {
    setFile(e.target.files[0] || null)
    setResult(null)
    setError('')
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)
    setError('')

    const form = new FormData()
    form.append('file', file)

    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
      const res = await fetch(`${BASE}${currentMode.endpoint}`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })
      clearTimeout(tid)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      setResult(await res.json())
    } catch (e) {
      setError(
        e.name === 'AbortError' ? `Upload timed out (${UPLOAD_TIMEOUT_MS / 1000} s).` : e.message
      )
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-display font-bold text-brand-navy text-xl mb-1">
          📁 Document Intelligence
        </h2>
        <p className="text-brand-navy/50 text-sm mb-5">
          Upload a contract, blueprint, or permit for AI-powered extraction of key terms, deadlines,
          risk flags, and dimensions.
        </p>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id)
                reset()
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                mode === m.id
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Upload area */}
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center mb-4">
          {file ? (
            <div className="text-brand-navy text-sm">
              <span className="font-semibold">{file.name}</span>
              <span className="text-brand-navy/50 ml-2">({(file.size / 1024).toFixed(0)} KB)</span>
            </div>
          ) : (
            <p className="text-brand-navy/40 text-sm">{currentMode.hint}</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={currentMode.accept}
            onChange={handleFile}
            className="hidden"
            id="doc-upload-input"
          />
          <label
            htmlFor="doc-upload-input"
            className="mt-3 inline-block cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-brand-navy transition-colors"
          >
            {file ? 'Change file' : 'Choose file'}
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Analyzing…' : '🔍 Analyze Document'}
          </button>
          {(file || result) && (
            <button type="button" onClick={reset} className="btn-outline">
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-brand-navy text-lg">Analysis Results</h3>
            {result.filename && (
              <span className="text-xs text-brand-navy/40">{result.filename}</span>
            )}
          </div>
          <ResultBlock data={result} />
        </div>
      )}
    </div>
  )
}
