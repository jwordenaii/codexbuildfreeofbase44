import { useState, useEffect, useCallback } from 'react'
import GalleryUploadForm from '../components/GalleryUploadForm'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ImageCard({ image, token, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  async function handleDelete() {
    if (!window.confirm(`Delete "${image.job_name}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`${BASE}/api/v1/gallery/images/${image.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      if (onDeleted) onDeleted(image.id)
    } catch {
      alert('Could not delete image. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden group hover:border-brand-amber/40 transition-colors">
        {/* Photo */}
        <button
          className="w-full aspect-video overflow-hidden block"
          onClick={() => setLightbox(true)}
          aria-label={`View full size: ${image.job_name}`}
        >
          <img
            src={image.url}
            alt={image.job_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </button>

        {/* Info */}
        <div className="p-4 space-y-1">
          <h3 className="font-display font-bold text-white text-sm leading-tight">
            {image.job_name}
          </h3>
          {image.description && (
            <p className="text-white/60 text-xs leading-relaxed line-clamp-2">
              {image.description}
            </p>
          )}
          <p className="text-white/40 text-xs">{formatDate(image.uploaded_at)}</p>

          {/* Admin delete */}
          {token && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="mt-2 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting…' : '✕ Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={image.url}
            alt={image.job_name}
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <p className="text-white font-semibold">{image.job_name}</p>
            {image.description && (
              <p className="text-white/60 text-sm mt-1">{image.description}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default function Gallery() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [showTokenForm, setShowTokenForm] = useState(false)

  const fetchImages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BASE}/api/v1/gallery/images`)
      if (!res.ok) throw new Error(`Failed to load gallery (${res.status})`)
      const data = await res.json()
      setImages(data.images || [])
    } catch (err) {
      setError(err.message || 'Could not load gallery.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  function handleUploaded(newImage) {
    setImages((prev) => [newImage, ...prev])
    setShowUpload(false)
  }

  function handleDeleted(id) {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }

  function handleTokenSubmit(e) {
    e.preventDefault()
    setToken(tokenInput.trim())
    setShowTokenForm(false)
  }

  return (
    <div className="min-h-screen bg-brand-navy pt-20">
      {/* Hero */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-brand-amber/10 text-brand-amber text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            Our Work
          </span>
          <h1 className="font-display font-black text-4xl md:text-5xl text-white mb-4">
            Job Photo Gallery
          </h1>
          <p className="text-white/60 text-lg">
            Real projects. Real results. From KFC parking lots to residential driveways — see the
            quality J. Worden &amp; Sons delivers on every job.
          </p>
        </div>
      </section>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="btn-primary text-sm !py-2"
        >
          {showUpload ? '✕ Cancel Upload' : '+ Upload Photo'}
        </button>

        {!token ? (
          <button
            onClick={() => setShowTokenForm((v) => !v)}
            className="text-sm text-white/50 hover:text-white/80 transition-colors underline underline-offset-2"
          >
            Admin login
          </button>
        ) : (
          <button
            onClick={() => { setToken(''); setTokenInput('') }}
            className="text-sm text-brand-amber hover:text-amber-400 transition-colors"
          >
            ✓ Admin mode — log out
          </button>
        )}
      </div>

      {/* Admin token form */}
      {showTokenForm && !token && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <form
            onSubmit={handleTokenSubmit}
            className="flex gap-2 max-w-sm bg-white/5 border border-white/10 rounded-xl p-4"
          >
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Admin token"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2
                         text-white placeholder-white/40 text-sm focus:outline-none
                         focus:ring-2 focus:ring-brand-amber"
            />
            <button type="submit" className="btn-primary text-sm !py-2">
              Login
            </button>
          </form>
        </div>
      )}

      {/* Upload form */}
      {showUpload && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
          <div className="max-w-lg">
            <GalleryUploadForm onUploaded={handleUploaded} />
          </div>
        </div>
      )}

      {/* Gallery grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={fetchImages} className="btn-primary text-sm !py-2">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && images.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📷</p>
            <p className="text-white/60 text-lg">No photos yet.</p>
            <p className="text-white/40 text-sm mt-1">
              Use the upload button above to add the first job photo.
            </p>
          </div>
        )}

        {!loading && !error && images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {images.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                token={token}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
