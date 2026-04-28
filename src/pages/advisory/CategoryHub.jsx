/**
 * CategoryHub — generic hub page for advisory board categories.
 *
 * Handles the 8 categories that were previously dead-linked:
 *   /advisory/licensing
 *   /advisory/construction-law
 *   /advisory/safety
 *   /advisory/contracts
 *   /advisory/prevailing-wage
 *   /advisory/environmental
 *   /advisory/building-codes
 *   /advisory/roads-paving
 *
 * Each category defines one or more sections; each section has its own
 * dynamic data loader and LegalTable column spec. Data is loaded on
 * first render and cached in state, keeping the initial bundle lean.
 */
import { useState, useEffect } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import SchemaMarkup from '../../components/SchemaMarkup'
import DisclaimerBanner from '../../components/advisory/DisclaimerBanner'
import LegalTable from '../../components/advisory/LegalTable'
import PrintableReport from '../../components/advisory/PrintableReport'
import CitationBadge from '../../components/advisory/CitationBadge'

// ── Column helper ─────────────────────────────────────────────────────────────

const bool = (v) => (v === null || v === undefined ? '—' : v ? '✅ Yes' : '❌ No')
const cite = (v) => <CitationBadge citation={v} />
const arr = (v) => (Array.isArray(v) ? (v.length ? v.join(', ') : '—') : (v ?? '—'))
const yrs = (v) => (v ? `${v} yr${v !== 1 ? 's' : ''}` : '—')
const days = (v) => (v ? `${v} days` : '—')
const ft = (v) => (v ? `${v} ft` : '—')
const usd = (v) => (v ? `$${Number(v).toLocaleString()}` : '—')
const acres = (v) => (v ? `${v} acre${v !== 1 ? 's' : ''}` : '—')

// ── Category configuration ────────────────────────────────────────────────────

const CATEGORIES = {
  licensing: {
    emoji: '📋',
    title: 'Contractor Licensing',
    desc: 'License classes, bonding requirements, reciprocity agreements, and CE hours for all 50 states.',
    sections: [
      {
        heading: 'Contractor Licensing — All 50 States',
        loader: () => import('../../data/legal/constructionLicensing'),
        searchKeys: ['state', 'authority', 'examProvider'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          { key: 'stateLicenseRequired', label: 'License Req.', sortable: true, render: bool },
          { key: 'licenseClasses', label: 'Classes', sortable: false, render: arr },
          { key: 'authority', label: 'Authority', sortable: true },
          { key: 'bondMinResidential', label: 'Bond (Res.)', sortable: true, render: usd },
          { key: 'bondMinCommercial', label: 'Bond (Com.)', sortable: true, render: usd },
          { key: 'workersCompRequired', label: 'Workers Comp', sortable: true, render: bool },
          { key: 'licenseRenewalYears', label: 'Renewal', sortable: true, render: yrs },
          {
            key: 'ceHoursRequired',
            label: 'CE Hours',
            sortable: true,
            render: (v) => (v ? `${v} hrs` : '—'),
          },
          { key: 'reciprocityStates', label: 'Reciprocity', sortable: false, render: arr },
        ],
      },
    ],
  },

  'construction-law': {
    emoji: '⚖️',
    title: 'Construction Law — Liens & Prompt Payment',
    desc: 'Mechanics lien filing deadlines, preliminary notice rules, prompt payment periods, and retainage caps for all 50 states.',
    sections: [
      {
        heading: 'Mechanics Lien Laws — All 50 States',
        loader: () => import('../../data/legal/mechanicsLienLaws'),
        searchKeys: ['state', 'citation'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          {
            key: 'preliminaryNoticeRequired',
            label: 'Prelim. Notice',
            sortable: true,
            render: bool,
          },
          { key: 'lienFilingDeadlineDays', label: 'File Deadline', sortable: true, render: days },
          {
            key: 'lienForeClosureDeadlineDays',
            label: 'Foreclose Deadline',
            sortable: true,
            render: days,
          },
          { key: 'noticeOfIntentRequired', label: 'NOI Required', sortable: true, render: bool },
          {
            key: 'residentialOwnerOccupiedExceptions',
            label: 'Res. Exceptions',
            sortable: true,
            render: bool,
          },
          { key: 'claimantTypes', label: 'Claimants', sortable: false, render: arr },
          { key: 'citation', label: 'Citation', sortable: false, render: cite },
        ],
      },
      {
        heading: 'Prompt Payment Laws — All 50 States',
        loader: () => import('../../data/legal/promptPaymentLaws'),
        searchKeys: ['state', 'citation'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          { key: 'ownerToGcDays', label: 'Owner → GC', sortable: true, render: days },
          { key: 'gcToSubDays', label: 'GC → Sub', sortable: true, render: days },
          {
            key: 'retainageMaxPercent',
            label: 'Retainage Max',
            sortable: true,
            render: (v) => (v ? `${v}%` : '—'),
          },
          { key: 'payIfPaidEnforceable', label: 'Pay-if-Paid', sortable: true, render: bool },
          { key: 'publicProjectsCovered', label: 'Public Projects', sortable: true, render: bool },
          {
            key: 'privateProjectsCovered',
            label: 'Private Projects',
            sortable: true,
            render: bool,
          },
          { key: 'citation', label: 'Citation', sortable: false, render: cite },
        ],
      },
    ],
  },

  safety: {
    emoji: '🦺',
    title: 'Safety & OSHA',
    desc: 'State OSHA plans, fall protection thresholds, excavation rules, and workers comp requirements for all 50 states.',
    sections: [
      {
        heading: 'OSHA & Worker Safety — All 50 States',
        loader: () => import('../../data/legal/workersSafety'),
        searchKeys: ['state', 'oshAuthority', 'citation'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          { key: 'statePlanState', label: 'State OSHA Plan', sortable: true, render: bool },
          { key: 'publicSectorOnly', label: 'Public Only', sortable: true, render: bool },
          { key: 'oshAuthority', label: 'Authority', sortable: true },
          { key: 'fallProtectionThresholdFt', label: 'Fall Protect.', sortable: true, render: ft },
          { key: 'workerCompProgramRequired', label: 'Workers Comp', sortable: true, render: bool },
          { key: 'citation', label: 'Citation', sortable: false, render: cite },
        ],
      },
    ],
  },

  contracts: {
    emoji: '📝',
    title: 'Contract Law',
    desc: 'Statutes of limitations, statutes of repose, anti-indemnity laws, pay-if-paid enforceability, and liquidated damages rules for all 50 states.',
    sections: [
      {
        heading: 'Construction Contract Law — All 50 States',
        loader: () => import('../../data/legal/contractLaw'),
        searchKeys: ['state', 'citation'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          {
            key: 'statuteOfLimitationsWrittenYears',
            label: 'SOL (Written)',
            sortable: true,
            render: yrs,
          },
          {
            key: 'statuteOfLimitationsOralYears',
            label: 'SOL (Oral)',
            sortable: true,
            render: yrs,
          },
          { key: 'statuteOfReposeYears', label: 'Statute of Repose', sortable: true, render: yrs },
          { key: 'antiIndemnityLaw', label: 'Anti-Indemnity', sortable: true, render: bool },
          { key: 'payIfPaidEnforceable', label: 'Pay-if-Paid', sortable: true, render: bool },
          {
            key: 'liquidatedDamagesEnforceable',
            label: 'Liq. Damages',
            sortable: true,
            render: bool,
          },
          { key: 'rightToRepairLaw', label: 'Right to Repair', sortable: true, render: bool },
          { key: 'citation', label: 'Citation', sortable: false, render: cite },
        ],
      },
    ],
  },

  'prevailing-wage': {
    emoji: '💰',
    title: 'Prevailing Wage',
    desc: 'State prevailing wage laws, coverage thresholds, administering agencies, and Davis-Bacon applicability for all 50 states.',
    sections: [
      {
        heading: 'Prevailing Wage Laws — All 50 States',
        loader: () => import('../../data/legal/prevailingWage'),
        searchKeys: ['state', 'administeredBy', 'citation'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          { key: 'prevailingWageLaw', label: 'State PW Law', sortable: true, render: bool },
          { key: 'lawScope', label: 'Scope', sortable: false },
          { key: 'administeredBy', label: 'Administered By', sortable: true },
          {
            key: 'thresholdForPublicWorks',
            label: 'Coverage Threshold',
            sortable: false,
            render: (v) => v ?? '—',
          },
          { key: 'davisBaconApplies', label: 'Davis-Bacon', sortable: true, render: bool },
          { key: 'citation', label: 'Citation', sortable: false, render: cite },
        ],
      },
    ],
  },

  environmental: {
    emoji: '🌱',
    title: 'Environmental Permits',
    desc: 'NPDES stormwater permits, SWPPP requirements, land disturbance thresholds, and wetland rules for all 50 states.',
    sections: [
      {
        heading: 'Environmental Permits — All 50 States',
        loader: () => import('../../data/legal/environmentalPermits'),
        searchKeys: ['state', 'npdesAuthority', 'stateEnvAgency', 'citation'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          { key: 'npdesAuthority', label: 'NPDES Authority', sortable: true },
          {
            key: 'landDisturbanceThresholdAcres',
            label: 'Disturb. Threshold',
            sortable: true,
            render: acres,
          },
          { key: 'swpppRequired', label: 'SWPPP Required', sortable: true, render: bool },
          {
            key: 'stateWetlandProgram',
            label: 'State Wetland Prog.',
            sortable: true,
            render: bool,
          },
          { key: 'stateEnvAgency', label: 'State Agency', sortable: true },
          { key: 'citation', label: 'Citation', sortable: false, render: cite },
        ],
      },
    ],
  },

  'building-codes': {
    emoji: '🏗️',
    title: 'Building Codes & Permits',
    desc: 'Adopted code editions, statewide building code status, permit fee structures, and required inspections for all 50 states.',
    sections: [
      {
        heading: 'Building Codes & Permits — All 50 States',
        loader: () => import('../../data/legal/buildingPermits'),
        searchKeys: ['state', 'stateBuildingOffice', 'citation'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          { key: 'statewideBuildingCode', label: 'Statewide Code', sortable: false },
          { key: 'adoptedCodes', label: 'Adopted Codes', sortable: false, render: arr },
          { key: 'stateBuildingOffice', label: 'State Office', sortable: true },
          { key: 'permitFeeStructure', label: 'Fee Structure', sortable: false },
          { key: 'citation', label: 'Citation', sortable: false, render: cite },
        ],
      },
    ],
  },

  'roads-paving': {
    emoji: '🛣️',
    title: 'Roads & Paving Regulations',
    desc: 'DOT paving specifications, overweight permit thresholds, utility accommodation policies, and encroachment requirements for all 50 states.',
    sections: [
      {
        heading: 'Roads & Paving Regulations — All 50 States',
        loader: () => import('../../data/legal/roadsAndPavingRegulations'),
        searchKeys: ['state', 'roadAuthority', 'citation'],
        columns: [
          { key: 'state', label: 'State', sortable: true },
          { key: 'roadAuthority', label: 'DOT Authority', sortable: true },
          { key: 'utilityPermitRequired', label: 'Utility Permit', sortable: true, render: bool },
          {
            key: 'overweightPermitRequired',
            label: 'Overweight Permit',
            sortable: true,
            render: bool,
          },
          {
            key: 'overweightThresholdLbs',
            label: 'OW Threshold',
            sortable: true,
            render: (v) => (v ? `${Number(v).toLocaleString()} lbs` : '—'),
          },
          {
            key: 'encroachmentPermitRequired',
            label: 'Encroachment Permit',
            sortable: true,
            render: bool,
          },
          {
            key: 'restorationBondRequired',
            label: 'Restoration Bond',
            sortable: true,
            render: bool,
          },
          { key: 'citation', label: 'Citation', sortable: false, render: cite },
        ],
      },
    ],
  },
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Section component ─────────────────────────────────────────────────────────

function CategorySection({ section }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    section.loader().then((mod) => setData(mod.default))
  }, [section])

  return (
    <section>
      <PrintableReport title={section.heading}>
        <h2 className="font-display font-bold text-brand-navy text-xl mb-4">{section.heading}</h2>
        {data ? (
          <LegalTable
            columns={section.columns}
            data={data}
            searchKeys={section.searchKeys}
            caption={section.heading}
          />
        ) : (
          <SectionSpinner />
        )}
      </PrintableReport>
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CategoryHub() {
  const { category } = useParams()
  const config = CATEGORIES[category]

  if (!config) {
    return <Navigate to="/advisory" replace />
  }

  return (
    <>
      <SchemaMarkup
        title={`${config.title} — All 50 States`}
        description={config.desc}
        canonical={`/advisory/${category}`}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Advisory Board', path: '/advisory' },
          { name: config.title, path: `/advisory/${category}` },
        ]}
      />

      <div className="bg-brand-navy pt-32 pb-16 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/advisory" className="text-brand-amber text-sm hover:underline">
            ← Advisory Board
          </Link>
          <h1 className="font-display font-black text-5xl mt-3 mb-3">
            {config.emoji} <span className="text-brand-amber">{config.title}</span>
          </h1>
          <p className="text-white/70 text-lg max-w-3xl mx-auto">{config.desc}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <DisclaimerBanner />

        {config.sections.map((section) => (
          <CategorySection key={section.heading} section={section} />
        ))}

        {/* Bottom nav */}
        <div className="card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-brand-navy text-sm">Looking for a specific state?</p>
            <p className="text-brand-navy/50 text-xs mt-0.5">
              View a full profile for any state across all 9 categories.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link to="/advisory" className="btn-outline text-sm !py-2">
              ← All Categories
            </Link>
            <Link to="/advisory/compare" className="btn-primary text-sm !py-2">
              Compare States
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
