/**
 * SchedulingPanel — AI-assisted CPM project scheduler for the Command Center.
 *
 * Features:
 *  - GC/civil/sitework/paving phase taxonomy
 *  - CPM forward & backward pass (ES, EF, LS, LF, Float)
 *  - Critical path highlighting
 *  - List view with inline status updates
 *  - CSS-based Gantt chart with float bars
 *  - Add / edit / delete tasks with predecessor linking
 */
import { useState, useMemo } from 'react'

const PHASES = [
  'Mobilization',
  'Clearing & Demolition',
  'Earthwork / Grading',
  'Erosion Control',
  'Underground Utilities',
  'Storm Drainage',
  'Subbase / Base Course',
  'Curb & Gutter',
  'Asphalt Paving',
  'Concrete Flatwork',
  'Striping & Signage',
  'Punch List / Closeout',
]

const PHASE_COLORS = {
  'Mobilization':           'bg-purple-400',
  'Clearing & Demolition':  'bg-red-400',
  'Earthwork / Grading':    'bg-yellow-500',
  'Erosion Control':        'bg-green-300',
  'Underground Utilities':  'bg-blue-400',
  'Storm Drainage':         'bg-cyan-400',
  'Subbase / Base Course':  'bg-orange-400',
  'Curb & Gutter':          'bg-stone-400',
  'Asphalt Paving':         'bg-gray-700',
  'Concrete Flatwork':      'bg-slate-400',
  'Striping & Signage':     'bg-yellow-300',
  'Punch List / Closeout':  'bg-green-500',
}

const STATUS_STYLE = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  completed:    'bg-green-100 text-green-700',
  delayed:      'bg-red-100 text-red-700',
}

const BLANK_TASK = {
  id: null,
  name: '',
  phase: 'Earthwork / Grading',
  duration: 5,
  predecessors: '',
  assignee: '',
  status: 'not_started',
}

/** CPM: forward pass + backward pass returning ES, EF, LS, LF, Float */
function computeCPM(tasks) {
  if (!tasks.length) return { tasks: [], projectDuration: 0 }

  const byId = {}
  tasks.forEach((t) => {
    byId[t.id] = { ...t, es: 0, ef: 0, ls: 0, lf: 0, float: 0 }
  })

  // Forward pass
  const fwdVisited = new Set()
  function forwardPass(id) {
    if (fwdVisited.has(id)) return byId[id]?.ef ?? 0
    fwdVisited.add(id)
    const t = byId[id]
    if (!t) return 0
    const predIds = t.predecessors
      ? t.predecessors.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean)
      : []
    let maxPredEF = 0
    predIds.forEach((pid) => { maxPredEF = Math.max(maxPredEF, forwardPass(pid)) })
    t.es = maxPredEF
    t.ef = t.es + t.duration
    return t.ef
  }
  tasks.forEach((t) => forwardPass(t.id))

  const projectDuration = Math.max(...Object.values(byId).map((t) => t.ef), 0)

  // Backward pass
  const bwdVisited = new Set()
  function backwardPass(id) {
    if (bwdVisited.has(id)) return byId[id]?.ls ?? projectDuration
    bwdVisited.add(id)
    const t = byId[id]
    if (!t) return projectDuration
    const successors = tasks.filter((s) => {
      const predIds = s.predecessors
        ? s.predecessors.split(',').map((x) => parseInt(x.trim(), 10)).filter(Boolean)
        : []
      return predIds.includes(id)
    })
    t.lf = successors.length === 0
      ? projectDuration
      : Math.min(...successors.map((s) => backwardPass(s.id)))
    t.ls = t.lf - t.duration
    t.float = t.ls - t.es
    return t.ls
  }
  tasks.forEach((t) => backwardPass(t.id))

  return { tasks: Object.values(byId), projectDuration }
}

const DEFAULT_TASKS = [
  { id: 1,  name: 'Mobilization & Site Setup',         phase: 'Mobilization',          duration: 3,  predecessors: '',    assignee: 'J. Worden', status: 'not_started' },
  { id: 2,  name: 'Clearing & Demo',                   phase: 'Clearing & Demolition',  duration: 5,  predecessors: '1',   assignee: '',          status: 'not_started' },
  { id: 3,  name: 'Mass Earthwork / Cut-Fill',          phase: 'Earthwork / Grading',    duration: 10, predecessors: '2',   assignee: '',          status: 'not_started' },
  { id: 4,  name: 'Install Erosion Controls',           phase: 'Erosion Control',        duration: 2,  predecessors: '2',   assignee: '',          status: 'not_started' },
  { id: 5,  name: 'Storm Drainage Install',             phase: 'Storm Drainage',         duration: 7,  predecessors: '3',   assignee: '',          status: 'not_started' },
  { id: 6,  name: 'Subbase & Aggregate Base Course',    phase: 'Subbase / Base Course',  duration: 6,  predecessors: '5',   assignee: '',          status: 'not_started' },
  { id: 7,  name: 'Curb & Gutter',                     phase: 'Curb & Gutter',          duration: 4,  predecessors: '6',   assignee: '',          status: 'not_started' },
  { id: 8,  name: 'Asphalt Paving – Base Course',       phase: 'Asphalt Paving',         duration: 3,  predecessors: '6',   assignee: '',          status: 'not_started' },
  { id: 9,  name: 'Asphalt Paving – Surface Course',    phase: 'Asphalt Paving',         duration: 2,  predecessors: '8',   assignee: '',          status: 'not_started' },
  { id: 10, name: 'Striping & Signage',                 phase: 'Striping & Signage',     duration: 2,  predecessors: '9,7', assignee: '',          status: 'not_started' },
  { id: 11, name: 'Punch List & Closeout',              phase: 'Punch List / Closeout',  duration: 3,  predecessors: '10',  assignee: '',          status: 'not_started' },
]

export default function SchedulingPanel() {
  const [tasks, setTasks]             = useState(DEFAULT_TASKS)
  const [showAdd, setShowAdd]         = useState(false)
  const [form, setForm]               = useState({ ...BLANK_TASK })
  const [editId, setEditId]           = useState(null)
  const [view, setView]               = useState('list')
  const [projectName, setProjectName] = useState('New GC Project')

  const { tasks: cpmTasks, projectDuration } = useMemo(() => computeCPM(tasks), [tasks])
  const criticalIds = useMemo(
    () => new Set(cpmTasks.filter((t) => t.float === 0).map((t) => t.id)),
    [cpmTasks],
  )

  const nextId = () => Math.max(...tasks.map((t) => t.id), 0) + 1

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editId !== null) {
      setTasks((prev) => prev.map((t) => (t.id === editId ? { ...form, id: editId } : t)))
      setEditId(null)
    } else {
      setTasks((prev) => [...prev, { ...form, id: nextId() }])
    }
    setForm({ ...BLANK_TASK })
    setShowAdd(false)
  }

  const deleteTask  = (id) => setTasks((prev) => prev.filter((t) => t.id !== id))
  const setStatus   = (id, status) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
  const startEdit   = (task) => { setForm({ ...task }); setEditId(task.id); setShowAdd(true) }
  const set         = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const pctDone = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* ── Header controls ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="input text-sm font-semibold w-56"
            aria-label="Project name"
          />
          <div className="flex gap-1 bg-gray-100 rounded-full p-1">
            {['list', 'gantt'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  view === v ? 'bg-brand-navy text-white' : 'text-brand-navy/60 hover:text-brand-navy'
                }`}
              >
                {v === 'list' ? '📋 List' : '📊 Gantt'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <div className="card px-3 py-2 text-center text-xs">
            <div className="text-brand-navy/50">Duration</div>
            <div className="font-bold text-brand-navy">{projectDuration} days</div>
          </div>
          <div className="card px-3 py-2 text-center text-xs">
            <div className="text-brand-navy/50">Tasks</div>
            <div className="font-bold text-brand-navy">{tasks.length}</div>
          </div>
          <div className="card px-3 py-2 text-center text-xs">
            <div className="text-red-500/70">Critical</div>
            <div className="font-bold text-red-600">{criticalIds.size}</div>
          </div>
          <div className="card px-3 py-2 text-center text-xs">
            <div className="text-brand-navy/50">Complete</div>
            <div className="font-bold text-green-600">{pctDone}%</div>
          </div>
          <button
            type="button"
            onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ ...BLANK_TASK }) }}
            className="btn-primary text-xs !py-2"
          >
            + Add Task
          </button>
        </div>
      </div>

      {/* ── Add / edit form ── */}
      {showAdd && (
        <div className="card p-6">
          <h4 className="font-display font-semibold text-brand-navy mb-4">
            {editId !== null ? 'Edit Task' : 'New Task'}
          </h4>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Task Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="input text-sm w-full"
                placeholder="e.g. Install Storm Drainage"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Phase</label>
              <select value={form.phase} onChange={(e) => set('phase', e.target.value)} className="input text-sm w-full">
                {PHASES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Duration (days)</label>
              <input
                type="number"
                min="1"
                required
                value={form.duration}
                onChange={(e) => set('duration', Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">
                Predecessors <span className="text-brand-navy/30">(IDs, comma-separated)</span>
              </label>
              <input
                type="text"
                value={form.predecessors}
                onChange={(e) => set('predecessors', e.target.value)}
                className="input text-sm w-full"
                placeholder="e.g. 1,2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Assignee</label>
              <input
                type="text"
                value={form.assignee}
                onChange={(e) => set('assignee', e.target.value)}
                className="input text-sm w-full"
                placeholder="Name or crew"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 mb-1">Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input text-sm w-full">
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="delayed">Delayed</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary text-sm !py-2">
                {editId !== null ? 'Save Changes' : 'Add Task'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setEditId(null) }}
                className="btn-outline text-sm !py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Critical path banner ── */}
      {criticalIds.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="text-lg leading-none mt-0.5">⚠️</span>
          <div>
            <strong>Critical Path ({projectDuration} days): </strong>
            {cpmTasks.filter((t) => criticalIds.has(t.id)).map((t) => t.name).join(' → ')}.{' '}
            Any delay to these tasks will extend the project end date.
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex justify-between text-xs text-brand-navy/60 mb-1">
          <span>Overall Progress</span>
          <span>{completedCount} / {tasks.length} tasks complete</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className="h-2.5 rounded-full bg-brand-amber transition-all" style={{ width: `${pctDone}%` }} />
        </div>
      </div>

      {/* ── List view ── */}
      {view === 'list' && (
        <div className="card p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-navy/10 text-xs text-brand-navy/50 font-semibold text-left">
                  <th className="pb-2 pr-2 w-6">#</th>
                  <th className="pb-2 pr-3">Task</th>
                  <th className="pb-2 pr-3 hidden md:table-cell">Phase</th>
                  <th className="pb-2 pr-2 text-center">Dur</th>
                  <th className="pb-2 pr-2 text-center">ES</th>
                  <th className="pb-2 pr-2 text-center">EF</th>
                  <th className="pb-2 pr-2 text-center">Float</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {cpmTasks.map((task) => {
                  const isCritical = criticalIds.has(task.id)
                  return (
                    <tr
                      key={task.id}
                      className={`border-b border-brand-navy/5 ${isCritical ? 'bg-red-50/40' : 'hover:bg-brand-navy/[0.02]'}`}
                    >
                      <td className="py-2.5 pr-2 text-brand-navy/30 text-xs font-mono">{task.id}</td>
                      <td className="py-2.5 pr-3">
                        <div className={`font-semibold text-sm ${isCritical ? 'text-red-700' : 'text-brand-navy'}`}>
                          {isCritical && <span className="mr-1 text-xs">🔴</span>}
                          {task.name}
                        </div>
                        {task.predecessors && (
                          <div className="text-brand-navy/30 text-xs">after: {task.predecessors}</div>
                        )}
                        {task.assignee && (
                          <div className="text-brand-navy/40 text-xs">{task.assignee}</div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 hidden md:table-cell">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${PHASE_COLORS[task.phase] || 'bg-gray-400'}`} />
                        <span className="text-brand-navy/60 text-xs">{task.phase}</span>
                      </td>
                      <td className="py-2.5 pr-2 text-center font-mono text-xs text-brand-navy">{task.duration}d</td>
                      <td className="py-2.5 pr-2 text-center font-mono text-xs text-brand-navy/50">{task.es}</td>
                      <td className="py-2.5 pr-2 text-center font-mono text-xs text-brand-navy/50">{task.ef}</td>
                      <td className={`py-2.5 pr-2 text-center font-bold font-mono text-xs ${
                        task.float === 0 ? 'text-red-600' : task.float <= 3 ? 'text-orange-500' : 'text-green-600'
                      }`}>
                        {task.float}d
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          value={task.status}
                          onChange={(e) => setStatus(task.id, e.target.value)}
                          className={`text-xs font-semibold border rounded-full px-2 py-0.5 appearance-none cursor-pointer ${STATUS_STYLE[task.status]}`}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="delayed">Delayed</option>
                        </select>
                      </td>
                      <td className="py-2.5">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(task)}
                            className="text-xs text-brand-navy/40 hover:text-brand-navy underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTask(task.id)}
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
            </table>
          </div>
        </div>
      )}

      {/* ── Gantt view ── */}
      {view === 'gantt' && projectDuration > 0 && (
        <div className="card p-6 overflow-x-auto">
          <h4 className="font-display font-semibold text-brand-navy mb-4">
            Gantt Chart — {projectName} ({projectDuration}-day schedule)
          </h4>
          <div style={{ minWidth: 600 }}>
            {/* Day header */}
            <div className="flex mb-2">
              <div className="w-44 shrink-0" />
              <div className="flex flex-1">
                {Array.from({ length: projectDuration }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 text-center text-[10px] font-mono border-l border-gray-100 ${
                      (i + 1) % 5 === 0 ? 'text-brand-navy/50' : 'text-brand-navy/20'
                    }`}
                  >
                    {(i + 1) % 5 === 0 ? i + 1 : ''}
                  </div>
                ))}
              </div>
            </div>

            {cpmTasks.map((task) => {
              const isCritical = criticalIds.has(task.id)
              const colorCls = PHASE_COLORS[task.phase] || 'bg-gray-400'
              return (
                <div key={task.id} className="flex items-center mb-1.5">
                  <div className="w-44 shrink-0 pr-2">
                    <div className={`text-xs font-semibold truncate ${isCritical ? 'text-red-600' : 'text-brand-navy'}`}>
                      {isCritical && '🔴 '}{task.name}
                    </div>
                    <div className="text-[10px] text-brand-navy/30">
                      {task.duration}d · float: {task.float}d
                    </div>
                  </div>
                  <div className="flex flex-1 relative h-6">
                    {/* Grid lines */}
                    {Array.from({ length: projectDuration }, (_, i) => (
                      <div
                        key={i}
                        className={`flex-1 border-l h-full ${
                          (i + 1) % 5 === 0 ? 'border-gray-200' : 'border-gray-100'
                        }`}
                      />
                    ))}
                    {/* Task bar */}
                    <div
                      className={`absolute top-1 h-4 rounded ${colorCls} ${isCritical ? 'opacity-100 ring-1 ring-red-400' : 'opacity-80'} flex items-center px-1 overflow-hidden`}
                      style={{
                        left: `${(task.es / projectDuration) * 100}%`,
                        width: `${(task.duration / projectDuration) * 100}%`,
                      }}
                    >
                      <span className="text-white text-[9px] font-bold truncate">{task.name}</span>
                    </div>
                    {/* Float bar */}
                    {task.float > 0 && (
                      <div
                        className="absolute top-1 h-4 rounded bg-gray-200 opacity-40"
                        style={{
                          left: `${(task.ef / projectDuration) * 100}%`,
                          width: `${(task.float / projectDuration) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Phase legend */}
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            {PHASES.filter((p) => tasks.some((t) => t.phase === p)).map((p) => (
              <div key={p} className="flex items-center gap-1">
                <span className={`w-3 h-3 rounded ${PHASE_COLORS[p] || 'bg-gray-400'}`} />
                <span className="text-brand-navy/60">{p}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-200" />
              <span className="text-brand-navy/40">Float</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
