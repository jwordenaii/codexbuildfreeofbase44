/**
 * StateComparison — side-by-side comparison of 2–3 states across an arbitrary
 * set of labeled fields.
 *
 * Props:
 *   states  — array of objects (the data rows to compare), max 3
 *   fields  — array of { label, key, render?: fn }
 *   title   — optional section heading
 */
export default function StateComparison({ states = [], fields = [], title }) {
  if (!states.length) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-brand-navy/10 shadow-sm">
      {title && (
        <div className="bg-brand-navy text-white px-4 py-3 font-semibold text-sm">{title}</div>
      )}
      <table className="min-w-full text-sm">
        <thead className="bg-brand-navy/5">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-brand-navy/60 text-xs uppercase tracking-wide w-40">
              Field
            </th>
            {states.map((s) => (
              <th
                key={s.abbr ?? s.state}
                className="px-4 py-3 text-left font-bold text-brand-navy text-xs uppercase tracking-wide"
              >
                {s.state} ({s.abbr})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map(({ label, key, render }, i) => (
            <tr
              key={key}
              className={`border-t border-brand-navy/5 ${
                i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
              }`}
            >
              <td className="px-4 py-3 font-medium text-brand-navy/70 align-top whitespace-nowrap">
                {label}
              </td>
              {states.map((s) => (
                <td key={s.abbr ?? s.state} className="px-4 py-3 align-top text-brand-navy">
                  {render ? render(s[key], s) : s[key] != null ? String(s[key]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
