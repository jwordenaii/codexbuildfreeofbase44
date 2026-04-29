import { useState, useRef } from 'react'

const BASE = import.meta.env.VITE_API_BASE_URL || ''
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export default function GalleryUploadForm({ onUploaded }) {
  const [jobName, setJobName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef(null)

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > MAX_FILE_BYTES) {
      setError('File is too large. Maximum size is 10 MB.')
      return
    }
    setFile(selected)
    setError(null)
    setSuccess(false)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(selected)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) { setError('Please select an image file.'); return }
    if (!jobName.trim()) { setError('Please enter a job name.'); return }

    setLoading(true)
    setError(null)

    const form = new FormData()
    form.append('file', file)
    form.append('job_name', jobName.trim())
    if (description.trim()) form.append('description', description.trim())

    try {
      const res = await fetch(`${BASE}/api/v1/gallery/upload`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Upload failed (${res.status})`)
      }
      const data = await res.json()
      setSuccess(true)
      setJobName('')
      setDescription('')
      setFile(null)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      if (onUploaded) onUploaded(data.image)
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4"
    >
      <h3 className="text-lg font-display font-bold text-white">Upload a Job Photo</h3>

      {/* File picker */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">
          Photo <span className="text-brand-amber">*</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="block w-full text-sm text-white/80 file:mr-3 file:py-2 file:px-4
                     file:rounded-md file:border-0 file:text-sm file:font-medium
                     file:bg-brand-amber file:text-brand-navy hover:file:bg-amber-400
                     cursor-pointer"
        />
        {preview && (
          <img
            src={preview}
            alt="Preview"
            className="mt-3 h-40 w-full object-cover rounded-lg border border-white/10"
          />
        )}
      </div>

      {/* Job name */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">
          Job Name <span className="text-brand-amber">*</span>
        </label>
        <input
          type="text"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          placeholder="e.g. KFC Parking Lot — Richmond, VA"
          maxLength={200}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2
                     text-white placeholder-white/40 text-sm focus:outline-none
                     focus:ring-2 focus:ring-brand-amber"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">
          Description <span className="text-white/40">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the work done…"
          rows={3}
          maxLength={500}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2
                     text-white placeholder-white/40 text-sm focus:outline-none
                     focus:ring-2 focus:ring-brand-amber resize-none"
        />
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2">
          ✓ Photo uploaded successfully!
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-brand-navy border-t-transparent rounded-full animate-spin" />
            Uploading…
          </span>
        ) : (
          'Upload Photo'
        )}
      </button>
    </form>
  )
}
