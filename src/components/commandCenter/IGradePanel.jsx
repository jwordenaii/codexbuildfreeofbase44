/**
 * IGradePanel — iGrade Engine dashboard for the Command Center.
 *
 * Displays:
 *   • Grade distribution (A/B/C/D) with confidence and correction rates
 *   • Recent grade log entries
 *   • Self-correction sweep runner with improvement suggestions
 *   • Media file storage registry (register / list / delete)
 *
 * Pulls from /api/v1/igrade/*
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

const GRADE_META = {
  A: {
    label: 'Grade A — Premium',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    desc: 'Complex / legal / compliance → GPT-4o',
  },
  B: {
    label: 'Grade B — Standard',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    desc: 'Paving & technical Q&A → GPT-4o-mini',
  },
  C: {
    label: 'Grade C — Fast',
    color: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
    desc: 'Simple / quick lookups → fast mini',
  },
  D: {
    label: 'Grade D — Bulk',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    desc: 'Batch / rule-engine decisions',
  },
}

const FILE_TYPES = ['photo', 'blueprint', 'permit', 'contract', 'report', 'other']

const BLANK_MEDIA = {
  filename: '',
  file_type: 'photo',
  storage_url: '',
  storage_provider: 'local',
  project_name: '',
  tags: '',
  ai_description: '',
}

export default function IGradePanel() {
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState([])
  const [mediaFiles, setMediaFiles] = useState([])
  const [sweepResult, setSweepResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [error, setError] = useState(null)
  const [showAddMedia, setShowAddMedia] = useState(false)
  const [mediaForm, setMediaForm] = useState(BLANK_MEDIA)
  const [savingMedia, setSavingMedia] = useState(false)
  const [gradeFilter, setGradeFilter] = useState('')

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, l, m] = await Promise.all([
        api.getIGradeStats(),
        api.listGradeLogs({ limit: 50 }),
        api.listMediaFiles({ limit: 50 }),
      ])
      setStats(s)
      setLogs(l.logs || [])
      setMediaFiles(m.files || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleSweep = async () => {
    setSweeping(true)
    setError(null)
    try {
      const r = await api.runSelfCorrectionSweep()
      setSweepResult(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setSweeping(false)
    }
  }

  const handleSaveMedia = async (e) => {
    e.preventDefault()
    setSavingMedia(true)
    try {
      const created = await api.registerMediaFile(mediaForm)
      setMediaFiles((prev) => [created, ...prev])
      setMediaForm(BLANK_MEDIA)
      setShowAddMedia(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingMedia(false)
    }
  }

  const handleDeleteMedia = async (id) => {
    if (!window.confirm('Remove this file record?')) return
    await api.deleteMediaFile(id)
    setMediaFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const set = (k, v) => setMediaForm((f) => ({ ...f, [k]: v }))

  const filteredLogs = gradeFilter ? logs.filter((l) => l.grade === gradeFilter) : logs

  const TABS = [
    { id: 'overview', label: '🎓 Grade Overview' },
    { id: 'logs', label: `📋 Grade Log (${logs.length})` },
    { id: 'sweep', label: '🔄 Self-Correction' },
    { id: 'storage', label: `🗄 Storage (${mediaFiles.length})` },
  ]

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              tab === t.id
                ? 'bg-brand-navy text-white border-brand-navy'
                : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={loadStats}
          disabled={loading}
          className="ml-auto px-3 py-1 text-xs border border-gray-200 rounded-full text-brand-navy/50 hover:border-brand-navy/40 disabled:opacity-40"
        >
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border-red-200 text-red-700 text-sm">
          {error}{' '}
          <button type="button" onClick={loadStats} className="underline text-xs ml-2">
            Retry
          </button>
        </div>
      )}

      {/* ── Overview ── */}
      {tab === 'overview' && stats && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-brand-navy">
                {stats.total_decisions}
              </div>
              <div className="text-xs text-brand-navy/50 mt-1 font-semibold uppercase tracking-wide">
                Total Decisions
              </div>
            </div>
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-brand-amber">
                {(stats.overall_avg_confidence * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-brand-navy/50 mt-1 font-semibold uppercase tracking-wide">
                Avg Confidence
              </div>
            </div>
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-blue-600">
                {stats.total_corrections}
              </div>
              <div className="text-xs text-brand-navy/50 mt-1 font-semibold uppercase tracking-wide">
                Human Corrections
              </div>
            </div>
            <div className="card p-5 text-center">
              <div className="font-display font-black text-3xl text-green-600">
                {stats.auto_corrections_applied}
              </div>
              <div className="text-xs text-brand-navy/50 mt-1 font-semibold uppercase tracking-wide">
                Auto-Corrections
              </div>
            </div>
          </div>

          {/* Grade breakdown */}
          <div className="card p-6">
            <h3 className="font-display font-bold text-brand-navy mb-4">Grade Tier Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(GRADE_META).map(([g, meta]) => {
                const bd = stats.grade_breakdown?.[g] || {}
                return (
                  <div key={g} className={`rounded-xl border p-4 ${meta.color}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold text-sm">{meta.label}</span>
                        <div className="text-xs opacity-70 mt-0.5">{meta.desc}</div>
                      </div>
                      <div className="text-2xl font-black">{bd.count ?? 0}</div>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span>
                        <strong>{bd.pct ?? 0}%</strong> of total
                      </span>
                      <span>
                        <strong>{((bd.avg_confidence ?? 0) * 100).toFixed(1)}%</strong> conf
                      </span>
                      <span>
                        <strong>{bd.correction_rate ?? 0}%</strong> corrected
                      </span>
                      {bd.avg_processing_ms != null && (
                        <span>
                          <strong>{bd.avg_processing_ms}ms</strong> avg
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-current rounded-full transition-all"
                        style={{ width: `${bd.pct ?? 0}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {stats.total_decisions === 0 && (
            <div className="text-center py-10 text-brand-navy/30 text-sm">
              No AI decisions recorded yet. Grade logs will appear here as the AI processes
              requests.
            </div>
          )}
        </div>
      )}

      {tab === 'overview' && !stats && !loading && (
        <div className="text-center py-10 text-brand-navy/30 text-sm">
          Loading grade statistics…
        </div>
      )}

      {/* ── Grade Log ── */}
      {tab === 'logs' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-brand-navy/50 font-semibold">Filter:</span>
            {['', 'A', 'B', 'C', 'D'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  gradeFilter === g
                    ? 'bg-brand-navy text-white border-brand-navy'
                    : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
                }`}
              >
                {g || 'All'}
              </button>
            ))}
          </div>

          <div className="card p-6">
            {filteredLogs.length === 0 ? (
              <p className="text-center py-8 text-brand-navy/30 text-sm">No grade logs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                      <th className="pb-2 pr-3">Grade</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Input</th>
                      <th className="pb-2 pr-3 hidden sm:table-cell">Engine</th>
                      <th className="pb-2 pr-3">Confidence</th>
                      <th className="pb-2 hidden md:table-cell">ms</th>
                      <th className="pb-2 hidden md:table-cell">Corrected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l) => {
                      const meta = GRADE_META[l.grade] || GRADE_META.B
                      return (
                        <tr key={l.id} className="border-b border-brand-navy/5">
                          <td className="py-2.5 pr-3">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.color}`}
                            >
                              {l.grade}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-brand-navy/60">
                            {l.decision_type}
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-brand-navy max-w-xs truncate">
                            {l.input_summary}
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-brand-navy/50 hidden sm:table-cell">
                            {l.ai_engine || '—'}
                          </td>
                          <td className="py-2.5 pr-3 text-xs font-semibold">
                            <span
                              className={
                                l.confidence >= 0.75
                                  ? 'text-green-600'
                                  : l.confidence >= 0.55
                                    ? 'text-amber-500'
                                    : 'text-red-500'
                              }
                            >
                              {(l.confidence * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-brand-navy/40 hidden md:table-cell">
                            {l.processing_ms != null ? `${l.processing_ms}` : '—'}
                          </td>
                          <td className="py-2.5 text-xs hidden md:table-cell">
                            {l.was_corrected ? (
                              <span className="text-red-500">✓</span>
                            ) : (
                              <span className="text-brand-navy/20">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Self-Correction Sweep ── */}
      {tab === 'sweep' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-display font-bold text-brand-navy mb-2">
              🔄 Self-Correction Analysis
            </h3>
            <p className="text-sm text-brand-navy/60 mb-5">
              The sweep analyzes every recorded human correction and grade log to identify patterns
              where the AI performs below expectations. Suggestions are returned for your review —
              no changes are made automatically without your approval.
            </p>
            <button
              type="button"
              onClick={handleSweep}
              disabled={sweeping}
              className="btn-primary disabled:opacity-50"
            >
              {sweeping ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running sweep…
                </span>
              ) : (
                '▶ Run Self-Correction Sweep'
              )}
            </button>
          </div>

          {sweepResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="card p-5 bg-blue-50 border-blue-200">
                <div className="flex gap-4 flex-wrap mb-2">
                  <div className="text-center">
                    <div className="font-display font-black text-2xl text-blue-600">
                      {sweepResult.swept_corrections}
                    </div>
                    <div className="text-xs text-brand-navy/60">Corrections Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-black text-2xl text-brand-amber">
                      {sweepResult.patterns_found}
                    </div>
                    <div className="text-xs text-brand-navy/60">Patterns Found</div>
                  </div>
                </div>
                <p className="text-sm text-brand-navy font-medium">{sweepResult.summary}</p>
              </div>

              {/* Suggestions */}
              {sweepResult.suggestions?.length > 0 ? (
                <div className="card p-6">
                  <h4 className="font-semibold text-brand-navy mb-4">Improvement Suggestions</h4>
                  <div className="space-y-3">
                    {sweepResult.suggestions.map((s, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-amber-700 uppercase">
                            {s.decision_type}
                          </span>
                          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                            &quot;{s.pattern}&quot; ×{s.frequency}
                          </span>
                        </div>
                        <p className="text-sm text-brand-navy/70">{s.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                sweepResult.swept_corrections > 0 && (
                  <div className="card p-6 text-center text-green-600 font-semibold">
                    ✅ No recurring correction patterns found — the AI is self-correcting
                    effectively.
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Media / Storage Registry ── */}
      {tab === 'storage' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display font-bold text-brand-navy">
                🗄 Media &amp; File Storage Registry
              </h3>
              <p className="text-xs text-brand-navy/50 mt-0.5">
                Track all project photos, blueprints, permits, and contracts. Links to Dropbox / GCS
                / S3.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMedia(!showAddMedia)}
              className="btn-primary text-xs !py-1.5"
            >
              + Register File
            </button>
          </div>

          {/* Add form */}
          {showAddMedia && (
            <div className="card p-6">
              <h4 className="font-semibold text-brand-navy mb-4">Register Media File</h4>
              <form onSubmit={handleSaveMedia} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Filename *
                  </label>
                  <input
                    type="text"
                    value={mediaForm.filename}
                    onChange={(e) => set('filename', e.target.value)}
                    required
                    placeholder="e.g. site-before-001.jpg"
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    File Type
                  </label>
                  <select
                    value={mediaForm.file_type}
                    onChange={(e) => set('file_type', e.target.value)}
                    className="input text-sm w-full"
                  >
                    {FILE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Storage Provider
                  </label>
                  <select
                    value={mediaForm.storage_provider}
                    onChange={(e) => set('storage_provider', e.target.value)}
                    className="input text-sm w-full"
                  >
                    {['local', 'dropbox', 'gcs', 's3'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={mediaForm.project_name}
                    onChange={(e) => set('project_name', e.target.value)}
                    className="input text-sm w-full"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Storage URL
                  </label>
                  <input
                    type="url"
                    value={mediaForm.storage_url}
                    onChange={(e) => set('storage_url', e.target.value)}
                    placeholder="https://…"
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={mediaForm.tags}
                    onChange={(e) => set('tags', e.target.value)}
                    placeholder="before, kfc, va"
                    className="input text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                    AI Description
                  </label>
                  <input
                    type="text"
                    value={mediaForm.ai_description}
                    onChange={(e) => set('ai_description', e.target.value)}
                    placeholder="Optional AI-generated caption"
                    className="input text-sm w-full"
                  />
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={savingMedia}
                    className="btn-primary text-sm !py-2 disabled:opacity-50"
                  >
                    {savingMedia ? 'Saving…' : 'Register File'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddMedia(false)}
                    className="btn-outline text-sm !py-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* File table */}
          <div className="card p-6">
            {mediaFiles.length === 0 ? (
              <p className="text-center py-8 text-brand-navy/30 text-sm">
                No media files registered yet. Register project photos, blueprints, and documents to
                build your project archive.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                      <th className="pb-2 pr-3">Filename</th>
                      <th className="pb-2 pr-3 hidden sm:table-cell">Type</th>
                      <th className="pb-2 pr-3 hidden sm:table-cell">Project</th>
                      <th className="pb-2 pr-3 hidden md:table-cell">Provider</th>
                      <th className="pb-2 pr-3 hidden md:table-cell">Tags</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediaFiles.map((f) => (
                      <tr key={f.id} className="border-b border-brand-navy/5">
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-brand-navy text-xs">
                            {f.storage_url ? (
                              <a
                                href={f.storage_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-brand-amber underline"
                              >
                                {f.filename}
                              </a>
                            ) : (
                              f.filename
                            )}
                          </div>
                          {f.ai_description && (
                            <div className="text-xs text-brand-navy/40 truncate max-w-xs">
                              {f.ai_description}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 hidden sm:table-cell">
                          <span className="text-xs bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded-full">
                            {f.file_type || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-brand-navy/60 hidden sm:table-cell">
                          {f.project_name || '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-brand-navy/40 hidden md:table-cell">
                          {f.storage_provider || 'local'}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-brand-navy/40 hidden md:table-cell">
                          {f.tags
                            ? f.tags
                                .split(',')
                                .slice(0, 3)
                                .map((t, idx) => (
                                  <span
                                    key={`${t.trim()}-${idx}`}
                                    className="inline-block bg-gray-100 rounded px-1.5 mr-1"
                                  >
                                    {t.trim()}
                                  </span>
                                ))
                            : '—'}
                        </td>
                        <td className="py-2.5">
                          <button
                            onClick={() => handleDeleteMedia(f.id)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
