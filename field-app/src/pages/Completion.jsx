import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SignaturePad from '../components/SignaturePad'
import { submitCompletion } from '../api/jobs'
import { BUSINESS } from '../lib/business'

const CHECKLIST_ITEMS = [
  { id: 'cleanup',     label: 'Site cleanup complete'           },
  { id: 'edges',       label: 'Edges trimmed & clean'           },
  { id: 'drainage',    label: 'Drainage unobstructed'           },
  { id: 'markings',    label: 'Markings / striping done'        },
  { id: 'materials',   label: 'Leftover materials removed'      },
  { id: 'photos',      label: 'Before & after photos taken'     },
  { id: 'equipment',   label: 'All equipment accounted for'     },
]

const STEPS = ['checklist', 'photos', 'rating', 'signature', 'done']

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-1 px-4">
      {STEPS.slice(0, -1).map((step, i) => {
        const idx = STEPS.indexOf(current)
        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i < idx  ? 'bg-brand-500' :
              i === idx ? 'bg-brand-400 scale-125 shadow-brand-glow' :
              'bg-surface-700'
            }`} />
            {i < STEPS.length - 2 && <div className={`flex-1 h-px ${i < idx ? 'bg-brand-500' : 'bg-surface-700'}`} />}
          </div>
        )
      })}
    </div>
  )
}

export default function Completion() {
  const { jobId } = useParams()
  const navigate  = useNavigate()
  const fileRef   = useRef(null)

  const [step, setStep]           = useState('checklist')
  const [checked, setChecked]     = useState({})
  const [photos, setPhotos]       = useState([])
  const [rating, setRating]       = useState(0)
  const [signature, setSignature] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)

  const allChecked = CHECKLIST_ITEMS.every(item => checked[item.id])

  const addPhoto = (e) => {
    const files = Array.from(e.target.files ?? [])
    const previews = files.map(f => ({ url: URL.createObjectURL(f), file: f, type: 'after' }))
    setPhotos(p => [...p, ...previews])
  }

  const removePhoto = (idx) => setPhotos(p => p.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!signature) { setError('Customer signature required'); return }
    setSubmitting(true)
    setError(null)
    try {
      await submitCompletion({
        job_id:        jobId,
        checklist:     checked,
        rating,
        signature_png: signature,
        customer_name: customerName,
        completed_at:  new Date().toISOString(),
      })
      setStep('done')
    } catch (err) {
      setError(err.message || 'Submission failed — saved offline')
    } finally {
      setSubmitting(false)
    }
  }

  const sendReviewRequest = () => {
    const url = BUSINESS.googleReviewUrl
    window.open(url, '_blank', 'noopener')
  }

  // ── STEP: CHECKLIST ──────────────────────────────────────────────
  if (step === 'checklist') return (
    <div className="animate-fade-in">
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-black text-slate-100">Job Close-Out</h1>
      </div>

      <div className="px-4 pt-5 space-y-5">
        <StepIndicator current="checklist" />

        <div>
          <p className="section-title">Completion Checklist</p>
          <div className="space-y-2">
            {CHECKLIST_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setChecked(c => ({ ...c, [item.id]: !c[item.id] }))}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left
                             transition-all duration-150 active:scale-[0.98] ${
                  checked[item.id]
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-surface-600 bg-surface-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  checked[item.id] ? 'border-green-400 bg-green-400' : 'border-surface-500'
                }`}>
                  {checked[item.id] && (
                    <svg className="w-3.5 h-3.5 text-surface-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm font-semibold ${checked[item.id] ? 'text-slate-300 line-through opacity-70' : 'text-slate-200'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
          allChecked ? 'bg-green-500/10 text-green-400' : 'bg-surface-800 text-slate-500'
        }`}>
          {allChecked
            ? <><span>✓</span> All items checked</>
            : <>{Object.values(checked).filter(Boolean).length} of {CHECKLIST_ITEMS.length} complete</>
          }
        </div>

        <button onClick={() => setStep('photos')} disabled={!allChecked} className="btn-primary">
          Next — Photos
        </button>
      </div>
    </div>
  )

  // ── STEP: PHOTOS ─────────────────────────────────────────────────
  if (step === 'photos') return (
    <div className="animate-fade-in">
      <div className="page-header">
        <button onClick={() => setStep('checklist')} className="p-1 -ml-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-black text-slate-100">After Photos</h1>
      </div>

      <div className="px-4 pt-5 space-y-5">
        <StepIndicator current="photos" />

        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={addPhoto} className="hidden" />

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-surface-800">
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-surface-950/80 flex items-center justify-center"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-surface-600 bg-surface-800
                         flex flex-col items-center justify-center gap-1 active:bg-surface-700"
            >
              <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs text-slate-500">Add more</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-4 py-12 w-full bg-surface-800 border-2 border-dashed
                       border-surface-600 rounded-2xl active:bg-surface-700"
          >
            <svg className="w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <div className="text-center">
              <p className="font-bold text-slate-200">Take After Photos</p>
              <p className="text-xs text-slate-500 mt-1">Required for job record</p>
            </div>
          </button>
        )}

        <button onClick={() => setStep('rating')} disabled={photos.length === 0} className="btn-primary">
          Next — Customer Rating
        </button>
        {photos.length === 0 && (
          <button onClick={() => setStep('rating')} className="btn-secondary py-3 text-sm">
            Skip photos
          </button>
        )}
      </div>
    </div>
  )

  // ── STEP: RATING ─────────────────────────────────────────────────
  if (step === 'rating') return (
    <div className="animate-fade-in">
      <div className="page-header">
        <button onClick={() => setStep('photos')} className="p-1 -ml-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-black text-slate-100">Customer Rating</h1>
      </div>

      <div className="px-4 pt-5 space-y-6">
        <StepIndicator current="rating" />

        <div className="card text-center space-y-6 py-8">
          <div>
            <p className="text-base font-bold text-slate-200">How satisfied is the customer?</p>
            <p className="text-sm text-slate-500 mt-1">Hand them your phone</p>
          </div>
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-4xl transition-all duration-150 active:scale-90 ${
                  star <= rating ? 'opacity-100 scale-110' : 'opacity-30'
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm font-bold text-slate-300 animate-fade-in">
              {rating === 5 ? 'Excellent! 🎉' : rating >= 4 ? 'Great job 👍' : rating >= 3 ? 'Good 👌' : 'Noted — we\'ll follow up'}
            </p>
          )}
        </div>

        <div>
          <label className="label">Customer name (optional)</label>
          <input
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="input-field"
            placeholder="First and last name"
          />
        </div>

        <button onClick={() => setStep('signature')} className="btn-primary">
          Next — Signature
        </button>
      </div>
    </div>
  )

  // ── STEP: SIGNATURE ───────────────────────────────────────────────
  if (step === 'signature') return (
    <div className="animate-fade-in">
      <div className="page-header">
        <button onClick={() => setStep('rating')} className="p-1 -ml-1 text-slate-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-black text-slate-100">Sign Off</h1>
      </div>

      <div className="px-4 pt-5 space-y-5">
        <StepIndicator current="signature" />

        <div className="card bg-surface-800 space-y-2">
          <p className="text-sm font-bold text-slate-200">Work Completion Summary</p>
          <p className="text-xs text-slate-500">
            By signing, you confirm that the work described above has been completed to your satisfaction.
          </p>
          <div className="mt-3 pt-3 border-t border-surface-700 grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-slate-500">Date</p><p className="font-semibold text-slate-300">{new Date().toLocaleDateString()}</p></div>
            <div><p className="text-slate-500">Customer</p><p className="font-semibold text-slate-300">{customerName || '—'}</p></div>
            {rating > 0 && <div><p className="text-slate-500">Rating</p><p className="font-semibold">{'⭐'.repeat(rating)}</p></div>}
          </div>
        </div>

        <div>
          <label className="label">Customer Signature</label>
          <SignaturePad
            onCapture={setSignature}
            onClear={() => setSignature(null)}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-slide-down">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={!signature || submitting} className="btn-primary">
          {submitting ? (
            <svg className="w-5 h-5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="10" />
            </svg>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Complete Job
            </>
          )}
        </button>
      </div>
    </div>
  )

  // ── STEP: DONE ────────────────────────────────────────────────────
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 animate-slide-up">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-100">Job Complete</h2>
            <p className="text-slate-400 mt-1">Signed off · Receipt sent · Records saved</p>
          </div>
        </div>

        {rating >= 4 && (
          <div className="card border-brand-500/30 space-y-4">
            <p className="font-bold text-slate-200">
              {customerName ? `${customerName} rated 5 stars` : 'Great rating!'} — ask for a Google review
            </p>
            <button onClick={sendReviewRequest} className="btn-primary">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
              Send Review Link
            </button>
          </div>
        )}

        <div className="space-y-3">
          <button onClick={() => navigate('/')} className="btn-primary">
            Back to Jobs
          </button>
        </div>
      </div>
    </div>
  )
}
