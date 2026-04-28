/**
 * VoicePanel — Upload an audio file for Whisper transcription + lead extraction.
 *
 * POST /api/v1/voice/transcribe
 * Accepts: mp3/wav/m4a/ogg/webm (max 25 MB)
 * Returns: transcript, extracted entities, optional auto-created lead.
 */
import { useState, useRef } from 'react'

const ACCEPTED = '.mp3,.wav,.m4a,.ogg,.webm,audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm'
const BASE = import.meta.env.VITE_API_BASE_URL || ''
const UPLOAD_TIMEOUT_MS = 90_000 // Whisper transcription may take up to ~90 s for long audio

export default function VoicePanel() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

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
      const res = await fetch(`${BASE}/api/v1/voice/transcribe`, {
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
        <h2 className="font-display font-bold text-brand-navy text-xl mb-1">🎙 Voice Intake</h2>
        <p className="text-brand-navy/50 text-sm mb-5">
          Upload a recorded call or voicemail (MP3/WAV/M4A/OGG/WebM, max 25 MB). JWordenAI will
          transcribe it with Whisper, extract lead entities, and optionally create a lead record.
        </p>

        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center mb-4">
          {file ? (
            <div className="text-brand-navy text-sm">
              <span className="font-semibold">{file.name}</span>
              <span className="text-brand-navy/50 ml-2">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          ) : (
            <p className="text-brand-navy/40 text-sm">MP3, WAV, M4A, OGG, or WebM — max 25 MB</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            onChange={handleFile}
            className="hidden"
            id="voice-upload-input"
          />
          <label
            htmlFor="voice-upload-input"
            className="mt-3 inline-block cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-brand-navy transition-colors"
          >
            {file ? 'Change file' : 'Choose audio file'}
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Transcribing…' : '🎤 Transcribe & Extract Lead'}
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
        <div className="card p-6 space-y-5">
          <h3 className="font-display font-bold text-brand-navy text-lg">Transcription Results</h3>

          {/* Lead auto-created banner */}
          {result.lead_created && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-bold text-green-800 text-sm">Lead Created Automatically</div>
                <div className="text-xs text-green-700 mt-0.5">
                  Lead #{result.lead_id}
                  {result.lead_score ? ` · ${result.lead_score}` : ''}
                </div>
              </div>
            </div>
          )}

          {/* Transcript */}
          <div>
            <div className="text-xs font-bold text-brand-navy/50 uppercase tracking-wide mb-2">
              Transcript
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-brand-navy/80 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {result.transcript || '(no transcript)'}
            </div>
          </div>

          {/* Entities */}
          {result.entities && Object.keys(result.entities).length > 0 && (
            <div>
              <div className="text-xs font-bold text-brand-navy/50 uppercase tracking-wide mb-2">
                Extracted Entities
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(result.entities).map(([k, v]) => {
                  if (k === 'confidence') return null
                  return (
                    <div key={k} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-brand-navy/40 uppercase tracking-wide">
                        {k.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm font-semibold text-brand-navy mt-0.5">
                        {String(v || '—')}
                      </div>
                    </div>
                  )
                })}
                {result.entities.confidence != null && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-brand-navy/40 uppercase tracking-wide">
                      Confidence
                    </div>
                    <div className="text-sm font-semibold text-brand-navy mt-0.5">
                      {(result.entities.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
