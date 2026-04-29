import { useState, useRef } from 'react'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

/**
 * GalleryUploadForm — lets J. upload job photos to the public gallery.
 *
 * Props:
 *   onSuccess(image) — called after a successful upload with the new image object
 *   token            — bearer token for authenticated uploads (optional;
 *                      upload endpoint is public so token is not required)
 */
export default function GalleryUploadForm({ onSuccess }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [jobName, setJobName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setError(null)
    setSuccess(false)

    // Generate local preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(selected)
  }

  function handleDrop(e) {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return
    // Simulate a file input change
    const dt = new DataTransfer()
    dt.items.add(dropped)
    if (fileInputRef.current) fileInputRef.current.files = dt.files
    handleFileChange({ target: { files: dt.files } })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) { setError('Please select an image file.'); return }
    if (!jobName.trim()) { setError('Please enter a job name.'); return }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('job_name', jobName.trim())
      if (description.trim()) formData.append('description', description.trim())

      const res = await fetch(`${BASE}/api/v1/gallery/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || `Upload failed (HTTP ${res.status})`)
      }

      const data = await res.json()
      setSuccess(true)
      setFile(null)
      setPreview(null)
      setJobName('')
      setDescription('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSuccess?.(data.image)
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5"
    >
      <h3 className="font-display font-black text-brand-navy text-xl">Upload a Job Photo</h3>

      {/* Drop zone / file picker */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="relative border-2 border-dashed border-brand-amber/40 rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-brand-amber transition-colors bg-brand-amber/5 min-h-[160px]"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="max-h-40 rounded-lg object-contain shadow"
          />
        ) : (
          <>
            <svg className="w-10 h-10 text-brand-amber/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-brand-navy/50 text-center">
              Drag &amp; drop a photo here, or <span className="text-brand-amber font-semibold">click to browse</span>
            </p>
            <p className="text-xs text-brand-navy/30">JPEG, PNG, WebP, GIF — max 10 MB</p>
          </>
        )}
        {file && (
          <p className="text-xs text-brand-navy/50 mt-1 truncate max-w-full">{file.name}</p>
        )}
      </div>

      {/* Job name */}
      <div>
        <label className="block text-sm font-semibold text-brand-navy mb-1.5" htmlFor="guf-job-name">
          Job Name <span className="text-red-500">*</span>
        </label>
        <input
          id="guf-job-name"
          type="text"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          placeholder="e.g. KFC Parking Lot — Richmond, VA"
          maxLength={200}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-brand-navy mb-1.5" htmlFor="guf-description">
          Description <span className="text-brand-navy/40 font-normal">(optional)</span>
        </label>
        <textarea
          id="guf-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the work shown…"
          rows={3}
          maxLength={1000}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Photo uploaded successfully!
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary justify-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Uploading…
          </span>
        ) : (
          'Upload Photo'
        )}
      </button>
    </form>
  )
}
