import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import SchemaMarkup, { LOCAL_BUSINESS_SCHEMA } from '../components/SchemaMarkup'
import GalleryUploadForm from '../components/GalleryUploadForm'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

// ── Admin auth ────────────────────────────────────────────────────────────────
// The gallery upload is public, but delete requires a bearer token.
// We store the token in sessionStorage so it persists across soft navigations
// but clears when the tab closes.
const ADMIN_TOKEN_KEY = 'gallery_admin_token'

function getStoredToken() {
  try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '' } catch { return '' }
}
function setStoredToken(t) {
  try { sessionStorage.setItem(ADMIN_TOKEN_KEY, t) } catch {}
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ image, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative max-w-4xl w-full bg-brand-navy rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={image.url}
            alt={image.job_name}
            className="w-full max-h-[70vh] object-contain bg-black"
          />
          <div className="p-5">
            <h3 className="font-display font-black text-white text-xl mb-1">{image.job_name}</h3>
            {image.description && (
              <p className="text-white/60 text-sm leading-relaxed">{image.description}</p>
            )}
            <p className="text-white/30 text-xs mt-2">
              {new Date(image.uploaded_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            aria-label="Close lightbox"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Image card ────────────────────────────────────────────────────────────────
function ImageCard({ image, index, isAdmin, onDelete, onOpen }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${image.job_name}"? This cannot be undone.`)) return
    setDeleting(true)
    await onDelete(image.id)
    setDeleting(false)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: (index % 3) * 0.07 }}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpen(image)}
    >
      {/* Photo */}
      <div className="relative overflow-hidden bg-gray-100 aspect-[4/3]">
        <img
          src={image.url}
          alt={image.job_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading={index < 6 ? 'eager' : 'lazy'}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-brand-navy/0 group-hover:bg-brand-navy/20 transition-colors flex items-center justify-center">
          <svg
            className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-display font-bold text-brand-navy text-base leading-snug mb-1 group-hover:text-brand-amber transition-colors">
          {image.job_name}
        </h3>
        {image.description && (
          <p className="text-brand-navy/55 text-xs leading-relaxed line-clamp-2 mb-2">
            {image.description}
          </p>
        )}
        <p className="text-brand-navy/30 text-xs">
          {new Date(image.uploaded_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </p>
      </div>

      {/* Admin delete button */}
      {isAdmin && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          aria-label={`Delete ${image.job_name}`}
          title="Delete photo"
        >
          {deleting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      )}
    </motion.article>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Gallery() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [lightboxImage, setLightboxImage] = useState(null)

  // Admin mode
  const [adminToken, setAdminToken] = useState(getStoredToken)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)

  const isAdmin = Boolean(adminToken)

  // Fetch images
  const fetchImages = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`${BASE}/api/v1/gallery/images`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setImages(data.images || [])
    } catch (err) {
      setFetchError('Could not load gallery photos. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchImages() }, [fetchImages])

  function handleUploadSuccess(newImage) {
    setImages((prev) => [newImage, ...prev])
    setShowUploadForm(false)
  }

  async function handleDelete(imageId) {
    try {
      const res = await fetch(`${BASE}/api/v1/gallery/images/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.detail || 'Delete failed.')
        return
      }
      setImages((prev) => prev.filter((img) => img.id !== imageId))
    } catch {
      alert('Delete failed. Check your connection.')
    }
  }

  function handleAdminLogin(e) {
    e.preventDefault()
    const t = tokenInput.trim()
    if (!t) return
    setAdminToken(t)
    setStoredToken(t)
    setTokenInput('')
    setShowAdminLogin(false)
  }

  function handleAdminLogout() {
    setAdminToken('')
    setStoredToken('')
    setShowUploadForm(false)
  }

  return (
    <>
      <SchemaMarkup
        title="Job Photo Gallery — Asphalt Paving Projects"
        description="Browse real job photos from J. Worden & Sons Asphalt Paving — KFC parking lots, commercial driveways, and paving projects across 12+ states."
        canonical="/gallery"
        schema={LOCAL_BUSINESS_SCHEMA}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Gallery', path: '/gallery' },
        ]}
      />

      {/* Lightbox */}
      {lightboxImage && (
        <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}

      {/* ── Hero ── */}
      <section className="bg-brand-navy text-white py-20 pt-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
            Job Photos
          </span>
          <h1 className="font-display font-black text-4xl md:text-6xl mt-3 mb-4">
            Our <span className="text-brand-amber">Work</span>
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto">
            Real photos from real jobs — KFC parking lots, commercial driveways, and paving
            projects across 12+ states. Every photo is from an actual J. Worden &amp; Sons project.
          </p>
        </div>
      </section>

      {/* ── Admin toolbar ── */}
      <section className="bg-white border-b border-gray-100 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-brand-navy/50 text-sm">
            {loading ? 'Loading…' : `${images.length} photo${images.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowUploadForm((v) => !v)}
                  className="btn-primary text-sm !py-1.5"
                >
                  {showUploadForm ? 'Cancel Upload' : '+ Upload Photo'}
                </button>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="text-xs text-brand-navy/40 hover:text-brand-navy/70 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowAdminLogin((v) => !v)}
                className="text-xs text-brand-navy/40 hover:text-brand-amber transition-colors"
              >
                Admin
              </button>
            )}
          </div>
        </div>

        {/* Admin login panel */}
        {showAdminLogin && !isAdmin && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 sm:px-6 py-4">
            <form onSubmit={handleAdminLogin} className="flex items-center gap-3 max-w-md">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter admin token…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber"
                autoFocus
              />
              <button type="submit" className="btn-primary text-sm !py-2">
                Sign in
              </button>
            </form>
          </div>
        )}
      </section>

      {/* ── Upload form (admin only) ── */}
      {isAdmin && showUploadForm && (
        <section className="bg-gray-50 border-b border-gray-100 py-8">
          <div className="max-w-xl mx-auto px-4 sm:px-6">
            <GalleryUploadForm onSuccess={handleUploadSuccess} />
          </div>
        </section>
      )}

      {/* ── Gallery grid ── */}
      <section className="py-16 bg-gray-50 min-h-[40vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading && (
            <div className="flex justify-center py-24">
              <div className="w-10 h-10 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {fetchError && !loading && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📷</div>
              <p className="text-brand-navy/50 mb-4">{fetchError}</p>
              <button
                type="button"
                onClick={fetchImages}
                className="text-brand-amber font-semibold hover:underline text-sm"
              >
                Try again →
              </button>
            </div>
          )}

          {!loading && !fetchError && images.length === 0 && (
            <div className="text-center py-24">
              <div className="text-6xl mb-5">🏗</div>
              <h2 className="font-display font-black text-brand-navy text-2xl mb-2">
                No photos yet
              </h2>
              <p className="text-brand-navy/50 text-sm max-w-sm mx-auto">
                {isAdmin
                  ? 'Use the "Upload Photo" button above to add your first job photo.'
                  : 'Job photos will appear here once they\'ve been uploaded.'}
              </p>
            </div>
          )}

          {!loading && !fetchError && images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {images.map((image, i) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  index={i}
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                  onOpen={setLightboxImage}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 bg-brand-navy text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <span className="text-brand-amber text-xs font-bold uppercase tracking-widest">
            Ready to Start?
          </span>
          <h2 className="font-display font-black text-3xl mt-2 mb-3">
            Get a Free Estimate
          </h2>
          <p className="text-white/60 mb-8">
            40 years of asphalt expertise. Franchise-level quality on every job — from driveways
            to national QSR programs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/quote" className="btn-primary">
              Get a Free Quote
            </Link>
            <Link to="/projects" className="btn-outline">
              View Project History
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
