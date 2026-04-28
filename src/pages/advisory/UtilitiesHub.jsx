import { Link } from 'react-router-dom'
import SchemaMarkup from '../../components/SchemaMarkup'
import DisclaimerBanner from '../../components/advisory/DisclaimerBanner'
import LegalTable from '../../components/advisory/LegalTable'
import PrintableReport from '../../components/advisory/PrintableReport'
import CitationBadge from '../../components/advisory/CitationBadge'
import utilitiesData from '../../data/legal/utilitiesOneCall'
import depthData from '../../data/legal/utilityDepthClearances'

const APWA_COLORS = [
  { color: 'bg-red-500', label: 'Red', utility: 'Electric power, cables, conduit' },
  { color: 'bg-yellow-400', label: 'Yellow', utility: 'Gas, oil, steam, petroleum' },
  { color: 'bg-orange-400', label: 'Orange', utility: 'Telecom, alarm, signal, data' },
  { color: 'bg-blue-500', label: 'Blue', utility: 'Potable water' },
  { color: 'bg-green-500', label: 'Green', utility: 'Sewer & drain lines' },
  { color: 'bg-purple-500', label: 'Purple', utility: 'Reclaimed water, irrigation' },
  { color: 'bg-pink-300', label: 'Pink', utility: 'Temporary survey markings' },
  { color: 'bg-white border border-gray-300', label: 'White', utility: 'Proposed excavation area' },
]

const UTILITY_COLS = [
  { key: 'state', label: 'State', sortable: true },
  { key: 'oneCallCenterName', label: '811 Center', sortable: true },
  {
    key: 'noticePeriodHours',
    label: 'Notice (hrs)',
    sortable: true,
    render: (v) => (v ? `${v}h` : '—'),
  },
  {
    key: 'toleranceZoneInches',
    label: 'Tolerance Zone',
    sortable: true,
    render: (v) => (v ? `±${v}"` : '—'),
  },
  {
    key: 'whiteLiningRequired',
    label: 'White-Line',
    sortable: false,
    render: (v) => (v ? '✅ Yes' : '❌ No'),
  },
  { key: 'penaltyCivil', label: 'Civil Penalty', sortable: false },
  {
    key: 'citation',
    label: 'Citation',
    sortable: false,
    render: (v) => <CitationBadge citation={v} />,
  },
]

const DEPTH_COLS = [
  { key: 'state', label: 'State', sortable: true },
  {
    key: 'gas',
    label: 'Gas (in)',
    sortable: false,
    render: (v) => (v?.minBurialDepthIn ? `${v.minBurialDepthIn}"` : '—'),
  },
  {
    key: 'electric',
    label: 'Electric (in)',
    sortable: false,
    render: (v) => (v?.minBurialDepthIn ? `${v.minBurialDepthIn}"` : '—'),
  },
  {
    key: 'water',
    label: 'Water (in)',
    sortable: false,
    render: (v) => (v?.minBurialDepthIn ? `${v.minBurialDepthIn}"` : '—'),
  },
  {
    key: 'sewer',
    label: 'Sewer (in)',
    sortable: false,
    render: (v) => (v?.minBurialDepthIn ? `${v.minBurialDepthIn}"` : '—'),
  },
  {
    key: 'telecom',
    label: 'Telecom (in)',
    sortable: false,
    render: (v) => (v?.minBurialDepthIn ? `${v.minBurialDepthIn}"` : '—'),
  },
  {
    key: 'frostLine',
    label: 'Frost Line (in)',
    sortable: false,
    render: (_, row) =>
      row.water?.frostLineDepthIn != null ? `${row.water.frostLineDepthIn}"` : '—',
  },
]

export default function UtilitiesHub() {
  return (
    <>
      <SchemaMarkup
        title="Utilities & 811 One-Call Rules — All 50 States"
        description="811 one-call center rules, notice periods, tolerance zones, APWA color codes, and minimum utility burial depths for all 50 US states."
        canonical="/advisory/utilities"
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Advisory Board', path: '/advisory' },
          { name: 'Utilities & 811', path: '/advisory/utilities' },
        ]}
      />

      <div className="bg-brand-navy pt-32 pb-16 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/advisory" className="text-brand-amber text-sm hover:underline">
            ← Advisory Board
          </Link>
          <h1 className="font-display font-black text-5xl mt-3 mb-3">
            🔌 Utilities &amp; <span className="text-brand-amber">811 Rules</span>
          </h1>
          <p className="text-white/70 text-lg">
            One-call center requirements, notice periods, tolerance zones, and utility depth
            clearances for all 50 states.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <DisclaimerBanner />

        {/* APWA Color Chart */}
        <section className="card p-6">
          <h2 className="font-display font-bold text-brand-navy text-xl mb-4">
            APWA Utility Marking Color Code
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {APWA_COLORS.map(({ color, label, utility }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <div className={`w-6 h-6 rounded-sm flex-shrink-0 ${color}`} />
                <div>
                  <div className="font-semibold text-brand-navy text-xs">{label}</div>
                  <div className="text-brand-navy/60 text-xs">{utility}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 811 Rules Table */}
        <section>
          <PrintableReport title="811 One-Call Rules — All 50 States">
            <h2 className="font-display font-bold text-brand-navy text-xl mb-4">
              811 One-Call Rules by State
            </h2>
            <LegalTable
              columns={UTILITY_COLS}
              data={utilitiesData}
              searchKeys={['state', 'oneCallCenterName', 'citation']}
              caption="811 one-call rules by state"
            />
          </PrintableReport>
        </section>

        {/* Depth Clearances Table */}
        <section>
          <PrintableReport title="Utility Depth Clearances — All 50 States">
            <h2 className="font-display font-bold text-brand-navy text-xl mb-4">
              Minimum Utility Burial Depths by State
            </h2>
            <p className="text-brand-navy/60 text-sm mb-4">
              Depths are in inches and represent minimum burial depth in normal conditions (not
              under roads or waterways). Federal PHMSA § 192.327 governs gas; NEC Article 300
              governs electric. Always verify with state DOT for road crossings.
            </p>
            <LegalTable
              columns={DEPTH_COLS}
              data={depthData}
              searchKeys={['state']}
              caption="Minimum utility burial depths by state"
            />
          </PrintableReport>
        </section>
      </div>
    </>
  )
}
