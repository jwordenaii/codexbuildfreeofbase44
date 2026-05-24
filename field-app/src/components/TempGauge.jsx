import { ASPHALT } from '../lib/business'

function tempColor(tempF) {
  if (tempF >= ASPHALT.minLayTemp)     return { ring: '#22c55e', label: 'HOT — GOOD',  bg: 'bg-green-500/10  border-green-500/40' }
  if (tempF >= ASPHALT.breakdownTemp)  return { ring: '#f59e0b', label: 'WORKING',     bg: 'bg-brand-500/10  border-brand-500/40' }
  if (tempF >= ASPHALT.finalRollTemp)  return { ring: '#f97316', label: 'FINAL ROLL',  bg: 'bg-orange-500/10 border-orange-500/40' }
  return                                      { ring: '#ef4444', label: 'TOO COLD',    bg: 'bg-red-500/10    border-red-500/40' }
}

export default function TempGauge({ tempF, label, compact = false }) {
  const { ring, label: status, bg } = tempColor(tempF)

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${bg}`}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ring }} />
        <span className="text-sm font-bold text-slate-200">{tempF}°F</span>
        <span className="text-xs text-slate-400">{status}</span>
      </div>
    )
  }

  const pct = Math.min(100, Math.max(0, (tempF / 350) * 100))

  return (
    <div className={`card border ${bg} space-y-3`}>
      {label && <p className="section-title">{label}</p>}
      <div className="flex items-end gap-3">
        <span className="text-4xl font-black tracking-tight" style={{ color: ring }}>
          {tempF}°F
        </span>
        <span className={`status-badge mb-1 text-surface-950 font-black`} style={{ background: ring }}>
          {status}
        </span>
      </div>
      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${pct}%`, background: ring }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
        <span>175°</span><span>240°</span><span>275°</span><span>350°</span>
      </div>
    </div>
  )
}
