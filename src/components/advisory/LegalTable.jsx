import { useState, useMemo } from 'react'

/**
 * LegalTable — sortable, filterable data table for legal reference data.
 *
 * Props:
 *   columns — array of { key, label, render?: fn, sortable?: bool }
 *   data    — array of row objects
 *   searchKeys — array of field keys to include in text search
 *   caption — optional accessible table caption string
 */
export default function LegalTable({ columns, data, searchKeys = [], caption }) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let rows = data
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter((row) =>
        searchKeys.some((k) =>
          String(row[k] ?? '')
            .toLowerCase()
            .includes(q)
        )
      )
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [data, query, searchKeys, sortKey, sortDir])

  return (
    <div className="space-y-4">
      {/* Search */}
      {searchKeys.length > 0 && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-navy/40 pointer-events-none">
            🔍
          </span>
          <input
            type="search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-brand-navy/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-amber"
            aria-label="Search table"
          />
        </div>
      )}

      {/* Table wrapper */}
      <div className="overflow-x-auto rounded-xl border border-brand-navy/10 shadow-sm">
        <table className="min-w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-brand-navy text-white">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-left font-semibold whitespace-nowrap text-xs uppercase tracking-wide ${
                    col.sortable !== false ? 'cursor-pointer select-none hover:bg-white/10' : ''
                  }`}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {col.label}
                  {col.sortable !== false && (
                    <span className="ml-1 text-white/40" aria-hidden="true">
                      {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-brand-navy/40">
                  No results found.
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr
                  key={row.abbr ?? i}
                  className={`border-t border-brand-navy/5 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                  } hover:bg-brand-amber/5 transition-colors`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 align-top">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-brand-navy/40 text-right">
        {filtered.length} of {data.length} records
      </p>
    </div>
  )
}
