/**
 * RetrospectivesPanel — Post-Project Lessons Learned Engine.
 * Pulls from /api/v1/retrospectives/*
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const BLANK = {
  project_name: '',
  project_type: '',
  region: '',
  closed_date: '',
  schedule_variance_days: '',
  cost_variance_pct: '',
  supply_chain_issues: '',
  soil_conditions: '',
  design_conflicts: '',
  lessons_learned: '',
}

function TagBadge({ tag }) {
  return (
    <span className="inline-block bg-brand-amber/15 text-brand-navy text-xs font-semibold px-2 py-0.5 rounded-full mr-1 mb-1">
      {tag}
    </span>
  )
}

function RetroCard({ retro, onTag, onDelete }) {
  const [tagging, setTagging] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleTag = async () => {
    setTagging(true)
    try {
      await onTag(retro.id)
    } finally {
      setTagging(false)
    }
  }
  const handleDelete = async () => {
    if (!window.confirm('Delete this retrospective?')) return
    setDeleting(true)
    try {
      await onDelete(retro.id)
    } finally {
      setDeleting(false)
    }
  }

  const variance = retro.schedule_variance_days
  const costVar = retro.cost_variance_pct

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display font-bold text-brand-navy text-base">
            {retro.project_name}
          </div>
          <div className="text-xs text-brand-navy/50 mt-0.5">
            {retro.project_type && <span className="mr-3">🏗 {retro.project_type}</span>}
            {retro.region && <span className="mr-3">📍 {retro.region}</span>}
            {retro.closed_date && (
              <span>✅ Closed {new Date(retro.closed_date).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleTag}
            disabled={tagging}
            className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold hover:bg-blue-200 disabled:opacity-50"
          >
            {tagging ? '…' : '🏷 AI Tag'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full font-semibold hover:bg-red-200 disabled:opacity-50"
          >
            {deleting ? '…' : '✕'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {(variance != null || costVar != null) && (
        <div className="flex gap-4 text-xs">
          {variance != null && (
            <span className={`font-bold ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Schedule: {variance > 0 ? `+${variance}` : variance}d
            </span>
          )}
          {costVar != null && (
            <span className={`font-bold ${costVar > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Cost: {costVar > 0 ? `+${costVar}` : costVar}%
            </span>
          )}
        </div>
      )}

      {/* Narrative fields */}
      {retro.lessons_learned && (
        <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-brand-navy/80">
          <span className="font-bold text-brand-navy">💡 Lessons: </span>
          {retro.lessons_learned}
        </div>
      )}
      {retro.supply_chain_issues && (
        <div className="text-xs text-brand-navy/60">
          <span className="font-semibold">Supply Chain:</span> {retro.supply_chain_issues}
        </div>
      )}
      {retro.soil_conditions && (
        <div className="text-xs text-brand-navy/60">
          <span className="font-semibold">Soil:</span> {retro.soil_conditions}
        </div>
      )}
      {retro.design_conflicts && (
        <div className="text-xs text-brand-navy/60">
          <span className="font-semibold">Design:</span> {retro.design_conflicts}
        </div>
      )}

      {/* AI tags */}
      {retro.ai_tags?.length > 0 && (
        <div className="flex flex-wrap">
          {retro.ai_tags.map((t) => (
            <TagBadge key={t} tag={t} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RetrospectivesPanel() {
  const [retros, setRetros] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [surfacing, setSurfacing] = useState(false)
  const [surfaceResults, setSurfaceResults] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await api.listRetrospectives()
      setRetros(d.retrospectives || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createRetrospective({
        ...form,
        schedule_variance_days:
          form.schedule_variance_days !== '' ? Number(form.schedule_variance_days) : null,
        cost_variance_pct: form.cost_variance_pct !== '' ? Number(form.cost_variance_pct) : null,
      })
      setForm(BLANK)
      setShowAdd(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTag = async (id) => {
    await api.tagRetrospective(id)
    load()
  }

  const handleDelete = async (id) => {
    await api.deleteRetrospective(id)
    load()
  }

  const handleSurface = async () => {
    setSurfacing(true)
    setSurfaceResults(null)
    try {
      const d = await api.surfaceLessons({ project_type: search })
      setSurfaceResults(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setSurfacing(false)
    }
  }

  const filtered = retros.filter(
    (r) =>
      !search ||
      r.project_name.toLowerCase().includes(search.toLowerCase()) ||
      r.project_type?.toLowerCase().includes(search.toLowerCase()) ||
      r.region?.toLowerCase().includes(search.toLowerCase()) ||
      r.ai_tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  )

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, type, region, or tag…"
            className="input text-sm flex-1 min-w-0"
          />
          <button
            onClick={handleSurface}
            disabled={surfacing}
            className="btn-outline text-sm !py-2 whitespace-nowrap"
          >
            {surfacing ? '…' : '🔍 Surface Lessons'}
          </button>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn-primary text-sm !py-2 whitespace-nowrap"
        >
          + Add Retrospective
        </button>
      </div>

      {/* Surfaced lessons */}
      {surfaceResults && (
        <div className="card p-5 bg-amber-50 border-amber-200">
          <div className="font-bold text-brand-navy mb-3">
            🔦 Relevant Past Lessons ({surfaceResults.count})
          </div>
          {surfaceResults.lessons.length === 0 ? (
            <p className="text-sm text-brand-navy/50">No matching lessons yet.</p>
          ) : (
            <div className="space-y-2">
              {surfaceResults.lessons.map((r) => (
                <div key={r.id} className="bg-white rounded-lg px-3 py-2 text-xs">
                  <span className="font-semibold text-brand-navy">{r.project_name}</span>
                  {r.region && <span className="text-brand-navy/40 ml-2">📍{r.region}</span>}
                  {r.lessons_learned && (
                    <p className="text-brand-navy/70 mt-1">{r.lessons_learned}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setSurfaceResults(null)}
            className="text-xs text-brand-navy/40 mt-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card p-6">
          <h4 className="font-display font-semibold text-brand-navy mb-4">New Project Closeout</h4>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['project_name', 'Project Name', 'text', true],
                ['project_type', 'Project Type (paving, sealcoat…)', 'text', false],
                ['region', 'Region / City', 'text', false],
                ['closed_date', 'Closed Date', 'date', false],
                ['schedule_variance_days', 'Schedule Variance (days, + = late)', 'number', false],
                ['cost_variance_pct', 'Cost Variance % (+ = over budget)', 'number', false],
              ].map(([key, label, type, req]) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    required={req}
                    step={type === 'number' ? 'any' : undefined}
                    className="input text-sm w-full"
                  />
                </div>
              ))}
            </div>
            {[
              ['supply_chain_issues', 'Supply Chain Issues'],
              ['soil_conditions', 'Soil / Site Conditions'],
              ['design_conflicts', 'Design Conflicts'],
              ['lessons_learned', '💡 Key Lessons Learned'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                  {label}
                </label>
                <textarea
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  rows={2}
                  className="input text-sm w-full"
                />
              </div>
            ))}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary text-sm !py-2 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Closeout'}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="btn-outline text-sm !py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          {error}{' '}
          <button type="button" onClick={load} className="ml-2 underline text-xs">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-brand-navy/40 text-sm gap-3">
          <span className="w-5 h-5 border-2 border-brand-amber border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-brand-navy/30 text-sm">
          {retros.length === 0
            ? 'No retrospectives yet. Add your first project closeout.'
            : 'No matches for your search.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <RetroCard key={r.id} retro={r} onTag={handleTag} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
