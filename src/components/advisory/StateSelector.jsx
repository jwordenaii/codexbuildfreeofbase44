import states from '../../data/legal/states'

/**
 * StateSelector — dropdown for picking a state by name or abbreviation.
 *
 * Props:
 *   value    — current state abbr string (e.g. 'CA') or null
 *   onChange — callback(abbr: string)
 *   label    — optional label string (default: 'Select a State')
 *   className — optional extra class on wrapper
 */
export default function StateSelector({
  value,
  onChange,
  label = 'Select a State',
  className = '',
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor="state-selector" className="block text-sm font-medium text-brand-navy">
          {label}
        </label>
      )}
      <select
        id="state-selector"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="block w-full px-3 py-2 border border-brand-navy/20 rounded-lg bg-white text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-amber"
      >
        <option value="">— All States —</option>
        {states.map(({ abbr, state }) => (
          <option key={abbr} value={abbr}>
            {state} ({abbr})
          </option>
        ))}
      </select>
    </div>
  )
}
