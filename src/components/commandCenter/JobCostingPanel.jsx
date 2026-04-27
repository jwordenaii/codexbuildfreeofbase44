/**
 * JobCostingPanel — Budget vs Actual job costing for GC projects.
 *
 * Features:
 *  - Multiple projects with per-project cost code breakdowns
 *  - GC-standard CSI-aligned cost codes (earthwork, asphalt, utilities, etc.)
 *  - Inline actual-cost editing
 *  - Variance analysis (over/under budget) with color coding
 *  - Gross margin & projected margin tracking
 *  - Budget consumed progress bar
 */
import { useState, useMemo } from 'react'

const COST_CODES = [
  { code: '01-000', name: 'Mobilization & General Conditions' },
  { code: '02-100', name: 'Clearing & Demolition' },
  { code: '02-200', name: 'Earthwork / Grading' },
  { code: '02-300', name: 'Erosion & Sediment Control' },
  { code: '02-400', name: 'Storm Drainage' },
  { code: '02-500', name: 'Sanitary Utilities' },
  { code: '02-600', name: 'Water Utilities' },
  { code: '02-700', name: 'Subbase / Aggregate Base Course' },
  { code: '02-750', name: 'Asphalt Paving – Base Course' },
  { code: '02-760', name: 'Asphalt Paving – Surface Course' },
  { code: '02-770', name: 'Milling & Overlay' },
  { code: '02-800', name: 'Curb, Gutter & Sidewalk' },
  { code: '02-900', name: 'Striping, Signage & Pavement Markings' },
  { code: '03-000', name: 'Concrete Flatwork' },
  { code: '05-000', name: 'Traffic Control' },
  { code: '31-000', name: 'Equipment' },
  { code: '32-000', name: 'Labor – Self-Perform' },
  { code: '33-000', name: 'Subcontractors' },
  { code: '99-000', name: 'Contingency / Misc' },
]

const BLANK_LINE = { costCode: '02-200', budgetAmt: '', actualAmt: '', notes: '' }

function fmt(n) {
  if (n === null || n === undefined || n === '') return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

function VarianceBadge({ budget, actual }) {
  if (!actual && actual !== 0) return null
  const b = Number(budget) || 0
  const a = Number(actual) || 0
  if (a === 0) return null
  const variance = a - b
  const pct = b > 0 ? (variance / b) * 100 : 0
  const over = variance > 0
  return (
    <div className={`text-xs font-bold ${over ? 'text-red-600' : 'text-green-600'}`}>
      {over ? '▲' : '▼'} {fmt(Math.abs(variance))}
      <span className="font-normal ml-1">({Math.abs(pct).toFixed(1)}%)</span>
    </div>
  )
}

const DEMO_PROJECT = {
  id: 1,
  name: 'Industrial Park Paving – Phase 1',
  contractAmount: 485000,
  lines: [
    { id: 1,  costCode: '01-000', budgetAmt: 12000,  actualAmt: 11500, notes: '' },
    { id: 2,  costCode: '02-200', budgetAmt: 45000,  actualAmt: 52000, notes: 'Extra rock encountered — RFI-002 pending' },
    { id: 3,  costCode: '02-700', budgetAmt: 38000,  actualAmt: 37500, notes: '' },
    { id: 4,  costCode: '02-750', budgetAmt: 95000,  actualAmt: 91000, notes: '' },
    { id: 5,  costCode: '02-760', budgetAmt: 110000, actualAmt: 0,     notes: 'Not yet performed' },
    { id: 6,  costCode: '02-900', budgetAmt: 18000,  actualAmt: 0,     notes: '' },
    { id: 7,  costCode: '05-000', budgetAmt: 14000,  actualAmt: 13200, notes: '' },
    { id: 8,  costCode: '32-000', budgetAmt: 85000,  actualAmt: 79000, notes: '' },
    { id: 9,  costCode: '33-000', budgetAmt: 55000,  actualAmt: 57000, notes: 'Sub overrun on drainage' },
    { id: 10, costCode: '99-000', budgetAmt: 13000,  actualAmt: 4500,  notes: '' },
  ],
}

let _projectCounter = 1
let _lineCounter = 20

export default function JobCostingPanel() {
  const [projects, setProjects]               = useState([DEMO_PROJECT])
  const [selectedId, setSelectedId]           = useState(1)
  const [showNewProject, setShowNewProject]   = useState(false)
  const [newProjForm, setNewProjForm]         = useState({ name: '', contractAmount: '' })
  const [showAddLine, setShowAddLine]         = useState(false)
  const [newLine, setNewLine]                 = useState({ ...BLANK_LINE })
  const [editLineId, setEditLineId]           = useState(null)

  const project = projects.find((p) => p.id === selectedId)

  const totals = useMemo(() => {
    if (!project) return { budget: 0, actual: 0, variance: 0, pctConsumed: 0 }
    const budget   = project.lines.reduce((s, l) => s + (Number(l.budgetAmt)  || 0), 0)
    const actual   = project.lines.reduce((s, l) => s + (Number(l.actualAmt) || 0), 0)
    const variance = actual - budget
    const pctConsumed = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0
    return { budget, actual, variance, pctConsumed }
  }, [project])

  const estMargin = project && project.contractAmount > 0
    ? ((project.contractAmount - totals.budget) / project.contractAmount) * 100
    : 0
  const projMargin = project && project.contractAmount > 0
    ? ((project.contractAmount - totals.actual) / project.contractAmount) * 100
    : 0

  const createProject = (e) => {
    e.preventDefault()
    _projectCounter = Math.max(...projects.map((p) => p.id), 0) + 1
    const p = {
      id: _projectCounter,
      name: newProjForm.name,
      contractAmount: Number(newProjForm.contractAmount) || 0,
      lines: [],
    }
    setProjects((prev) => [...prev, p])
    setSelectedId(p.id)
    setShowNewProject(false)
    setNewProjForm({ name: '', contractAmount: '' })
  }

  const addLine = (e) => {
    e.preventDefault()
    if (!project) return
    _lineCounter = Math.max(...projects.flatMap((p) => p.lines.map((l) => l.id)), 0) + 1
    const line = {
      id: _lineCounter,
      ...newLine,
      budgetAmt: Number(newLine.budgetAmt) || 0,
      actualAmt: Number(newLine.actualAmt) || 0,
    }
    setProjects((prev) =>
      prev.map((p) => p.id === selectedId ? { ...p, lines: [...p.lines, line] } : p),
    )
    setNewLine({ ...BLANK_LINE })
    setShowAddLine(false)
  }

  const updateLine = (lineId, field, value) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === selectedId
          ? { ...p, lines: p.lines.map((l) => l.id === lineId ? { ...l, [field]: value } : l) }
          : p,
      ),
    )
  }

  const deleteLine = (lineId) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === selectedId ? { ...p, lines: p.lines.filter((l) => l.id !== lineId) } : p,
      ),
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Project selector ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedId(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              selectedId === p.id
                ? 'bg-brand-navy text-white border-brand-navy'
                : 'border-gray-200 text-brand-navy/60 hover:border-brand-navy/40'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowNewProject(!showNewProject)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-brand-navy/30 text-brand-navy/50 hover:border-brand-amber hover:text-brand-amber transition-colors"
        >
          + New Project
        </button>
      </div>

      {/* ── New project form ── */}
      {showNewProject && (
        <div className="card p-5">
          <h4 className="font-display font-semibold text-brand-navy mb-3">New Project</h4>
          <form onSubmit={createProject} className="flex flex-wrap gap-3">
            <input
              type="text"
              required
              value={newProjForm.name}
              onChange={(e) => setNewProjForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Project name"
              className="input text-sm flex-1 min-w-48"
            />
            <input
              type="number"
              value={newProjForm.contractAmount}
              onChange={(e) => setNewProjForm((f) => ({ ...f, contractAmount: e.target.value }))}
              placeholder="Contract amount ($)"
              className="input text-sm w-44"
            />
            <button type="submit" className="btn-primary text-sm !py-2">Create</button>
            <button type="button" onClick={() => setShowNewProject(false)} className="btn-outline text-sm !py-2">
              Cancel
            </button>
          </form>
        </div>
      )}

      {project && (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Contract Value', value: fmt(project.contractAmount), color: 'text-brand-navy' },
              { label: 'Total Budget',   value: fmt(totals.budget),          color: 'text-blue-700' },
              {
                label: 'Actual Cost',
                value: fmt(totals.actual),
                color: totals.variance > 0 ? 'text-red-600' : 'text-green-700',
              },
              {
                label: 'Variance',
                value: fmt(Math.abs(totals.variance)),
                sub: totals.variance > 0 ? '▲ Over Budget' : '▼ Under Budget',
                color: totals.variance > 0 ? 'text-red-600' : 'text-green-600',
              },
            ].map((c) => (
              <div key={c.label} className="card p-4 text-center">
                <div className="text-xs text-brand-navy/50 mb-1">{c.label}</div>
                <div className={`text-lg font-black ${c.color}`}>{c.value}</div>
                {c.sub && <div className={`text-xs font-semibold mt-0.5 ${c.color}`}>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── Progress & margin bar ── */}
          <div className="card p-4 space-y-2">
            <div className="flex justify-between text-xs text-brand-navy/60 mb-1">
              <span>Budget Consumed</span>
              <span>{totals.pctConsumed.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${totals.variance > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${totals.pctConsumed}%` }}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs pt-1">
              <span className="text-brand-navy/50">
                Est. Gross Margin:{' '}
                <strong className="text-brand-navy">{estMargin.toFixed(1)}%</strong>
              </span>
              <span className="text-brand-navy/50">
                Projected Margin:{' '}
                <strong className={projMargin < estMargin ? 'text-red-600' : 'text-green-600'}>
                  {projMargin.toFixed(1)}%
                </strong>
              </span>
              {totals.variance > 0 && (
                <span className="text-red-600 font-semibold">
                  ⚠️ {fmt(totals.variance)} over budget — review cost codes
                </span>
              )}
            </div>
          </div>

          {/* ── Cost code table ── */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h4 className="font-display font-semibold text-brand-navy">Cost Code Breakdown</h4>
              <button
                type="button"
                onClick={() => setShowAddLine(!showAddLine)}
                className="btn-primary text-xs !py-1.5"
              >
                + Add Line
              </button>
            </div>

            {/* Add line form */}
            {showAddLine && (
              <form
                onSubmit={addLine}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200"
              >
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Cost Code</label>
                  <select
                    value={newLine.costCode}
                    onChange={(e) => setNewLine((f) => ({ ...f, costCode: e.target.value }))}
                    className="input text-sm w-full"
                  >
                    {COST_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Budget ($)</label>
                  <input
                    type="number"
                    value={newLine.budgetAmt}
                    onChange={(e) => setNewLine((f) => ({ ...f, budgetAmt: e.target.value }))}
                    className="input text-sm w-full"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Actual ($)</label>
                  <input
                    type="number"
                    value={newLine.actualAmt}
                    onChange={(e) => setNewLine((f) => ({ ...f, actualAmt: e.target.value }))}
                    className="input text-sm w-full"
                    placeholder="0"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Notes</label>
                  <input
                    type="text"
                    value={newLine.notes}
                    onChange={(e) => setNewLine((f) => ({ ...f, notes: e.target.value }))}
                    className="input text-sm w-full"
                    placeholder="Optional notes"
                  />
                </div>
                <div className="sm:col-span-4 flex gap-3">
                  <button type="submit" className="btn-primary text-sm !py-1.5">Add Line</button>
                  <button type="button" onClick={() => setShowAddLine(false)} className="btn-outline text-sm !py-1.5">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {project.lines.length === 0 ? (
              <div className="text-center text-brand-navy/40 py-10 text-sm">
                No cost lines yet. Add your first line above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                      <th className="pb-2 pr-3">Code</th>
                      <th className="pb-2 pr-3">Description</th>
                      <th className="pb-2 pr-3 text-right">Budget</th>
                      <th className="pb-2 pr-3 text-right">Actual</th>
                      <th className="pb-2 pr-3 text-right">Variance</th>
                      <th className="pb-2 hidden lg:table-cell">Notes</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {project.lines.map((line) => {
                      const cc      = COST_CODES.find((c) => c.code === line.costCode)
                      const budget  = Number(line.budgetAmt) || 0
                      const actual  = Number(line.actualAmt) || 0
                      const editing = editLineId === line.id

                      return (
                        <tr key={line.id} className="border-b border-brand-navy/5 hover:bg-brand-navy/[0.02]">
                          <td className="py-2.5 pr-3">
                            <span className="font-mono text-xs text-brand-navy/50">{line.costCode}</span>
                          </td>
                          <td className="py-2.5 pr-3 max-w-[200px]">
                            <span className="text-brand-navy text-xs font-medium">{cc?.name || line.costCode}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-right">
                            {editing ? (
                              <input
                                type="number"
                                value={line.budgetAmt}
                                onChange={(e) => updateLine(line.id, 'budgetAmt', e.target.value)}
                                className="input text-xs text-right w-24 !py-1"
                              />
                            ) : (
                              <span className="text-brand-navy/70 text-xs">{fmt(budget)}</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-right">
                            {editing ? (
                              <input
                                type="number"
                                value={line.actualAmt}
                                onChange={(e) => updateLine(line.id, 'actualAmt', e.target.value)}
                                className="input text-xs text-right w-24 !py-1"
                              />
                            ) : (
                              <span className={`text-xs font-semibold ${actual === 0 ? 'text-brand-navy/25' : actual > budget ? 'text-red-600' : 'text-brand-navy'}`}>
                                {actual === 0 ? '—' : fmt(actual)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-right">
                            {actual > 0 && <VarianceBadge budget={budget} actual={actual} />}
                          </td>
                          <td className="py-2.5 hidden lg:table-cell">
                            {editing ? (
                              <input
                                type="text"
                                value={line.notes}
                                onChange={(e) => updateLine(line.id, 'notes', e.target.value)}
                                className="input text-xs w-full !py-1"
                              />
                            ) : (
                              <span className="text-brand-navy/40 text-xs">{line.notes}</span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <div className="flex gap-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setEditLineId(editing ? null : line.id)}
                                className="text-xs text-brand-navy/40 hover:text-brand-navy underline"
                              >
                                {editing ? 'Done' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLine(line.id)}
                                className="text-xs text-red-400 hover:text-red-600 underline"
                              >
                                Del
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-brand-navy/20 font-bold">
                      <td colSpan={2} className="pt-3 pr-3 text-xs text-brand-navy">TOTAL</td>
                      <td className="pt-3 pr-3 text-right text-xs text-brand-navy">{fmt(totals.budget)}</td>
                      <td className="pt-3 pr-3 text-right text-xs text-brand-navy">{fmt(totals.actual)}</td>
                      <td className="pt-3 pr-3 text-right">
                        <span className={`text-xs font-bold ${totals.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {totals.variance > 0 ? '▲' : '▼'} {fmt(Math.abs(totals.variance))}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell" />
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
