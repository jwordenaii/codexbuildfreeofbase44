import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import SchemaMarkup from '../../components/SchemaMarkup'
import DisclaimerBanner from '../../components/advisory/DisclaimerBanner'
import CitationBadge from '../../components/advisory/CitationBadge'
// states.js is tiny (8KB) — keep it eagerly loaded for immediate stateCode validation
import states from '../../data/legal/states'

// ── Tab → dynamic import map ──────────────────────────────────────────────────
// Each tab loads only its data file on first click, then caches in component state.
const TAB_LOADERS = {
  licensing: () => import('../../data/legal/constructionLicensing'),
  liens: () =>
    Promise.all([
      import('../../data/legal/mechanicsLienLaws'),
      import('../../data/legal/promptPaymentLaws'),
    ]),
  contracts: () => import('../../data/legal/contractLaw'),
  utilities: () => import('../../data/legal/utilitiesOneCall'),
  permits: () => import('../../data/legal/buildingPermits'),
  safety: () => import('../../data/legal/workersSafety'),
  prevwage: () => import('../../data/legal/prevailingWage'),
  roads: () => import('../../data/legal/roadsAndPavingRegulations'),
  env: () => import('../../data/legal/environmentalPermits'),
}

const TABS = [
  { id: 'licensing', label: '📋 Licensing' },
  { id: 'liens', label: '⚖️ Liens & Pay' },
  { id: 'contracts', label: '📝 Contract Law' },
  { id: 'utilities', label: '🔌 Utilities' },
  { id: 'permits', label: '🏗️ Permits' },
  { id: 'safety', label: '🦺 Safety' },
  { id: 'prevwage', label: '💰 Prevailing Wage' },
  { id: 'roads', label: '🛣️ Roads & Paving' },
  { id: 'env', label: '🌱 Environmental' },
]

function Row({ label, value, citation }) {
  if (value == null || value === '') return null
  const display =
    typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : Array.isArray(value)
        ? value.join(', ') || '—'
        : String(value)
  return (
    <tr className="border-t border-brand-navy/5">
      <td className="px-4 py-3 font-medium text-brand-navy/70 text-sm w-1/3 align-top">{label}</td>
      <td className="px-4 py-3 text-brand-navy text-sm align-top">
        {display}
        {citation && (
          <span className="ml-2">
            <CitationBadge citation={citation} />
          </span>
        )}
      </td>
    </tr>
  )
}

function Section({ title, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-brand-navy/5 px-4 py-3 font-bold text-brand-navy text-sm border-b border-brand-navy/10">
        {title}
      </div>
      <table className="w-full">
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-brand-amber border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function StateDetail() {
  const { stateCode } = useParams()
  const [activeTab, setActiveTab] = useState('licensing')
  // Cache: { tabId: loaded data object(s) }
  const dataCache = useRef({})
  const [tabData, setTabData] = useState({})
  const [loading, setLoading] = useState(false)

  const stateInfo = states.find((s) => s.abbr === stateCode?.toUpperCase())

  // Load data for the active tab if not yet cached
  useEffect(() => {
    if (!stateInfo) return
    if (dataCache.current[activeTab]) {
      setTabData((prev) => ({ ...prev, [activeTab]: dataCache.current[activeTab] }))
      return
    }
    setLoading(true)
    TAB_LOADERS[activeTab]()
      .then((result) => {
        // liens returns [liens, promptPay] via Promise.all; others return a single module
        const payload = Array.isArray(result) ? result.map((m) => m.default) : result.default
        dataCache.current[activeTab] = payload
        setTabData((prev) => ({ ...prev, [activeTab]: payload }))
      })
      .finally(() => setLoading(false))
  }, [activeTab, stateInfo])

  if (!stateInfo) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-32 text-center">
        <h1 className="font-display font-black text-3xl text-brand-navy mb-4">State Not Found</h1>
        <p className="text-brand-navy/60 mb-6">No data found for &quot;{stateCode}&quot;.</p>
        <Link to="/advisory" className="btn-primary">
          Back to Advisory Board
        </Link>
      </div>
    )
  }

  const abbr = stateInfo.abbr

  // Helpers to get a single state record from a loaded dataset
  const findStateRecord = (dataset) =>
    (Array.isArray(dataset) ? dataset.find((s) => s.abbr === abbr) : dataset) || {}
  const [liensData, payData] = Array.isArray(tabData.liens) ? tabData.liens : [null, null]

  return (
    <>
      <SchemaMarkup
        title={`${stateInfo.state} Construction Law Reference`}
        description={`Complete construction law reference for ${stateInfo.state}: contractor licensing, mechanics liens, utilities/811, OSHA safety, permits, and more.`}
        canonical={`/advisory/state/${abbr}`}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Advisory Board', path: '/advisory' },
          { name: stateInfo.state, path: `/advisory/state/${abbr}` },
        ]}
      />

      <div className="bg-brand-navy pt-32 pb-12 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/advisory" className="text-brand-amber text-sm hover:underline">
            ← Advisory Board
          </Link>
          <h1 className="font-display font-black text-5xl mt-3 mb-2">{stateInfo.state}</h1>
          <p className="text-white/60 text-sm">
            {stateInfo.region} · Capital: {stateInfo.capital} · Last Verified: 2026-01-01
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <DisclaimerBanner />

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-brand-amber text-brand-navy'
                  : 'bg-brand-navy/5 text-brand-navy hover:bg-brand-navy/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading && <TabSpinner />}

        {!loading &&
          activeTab === 'licensing' &&
          tabData.licensing &&
          (() => {
            const lic = findStateRecord(tabData.licensing)
            return (
              <Section title="Contractor Licensing">
                <Row label="License Required" value={lic.stateLicenseRequired} />
                <Row label="License Classes" value={lic.licenseClasses} />
                <Row label="Licensing Authority" value={lic.authority} />
                <Row label="Authority URL" value={lic.authorityUrl} />
                <Row label="Exam Provider" value={lic.examProvider} />
                <Row
                  label="Bond Min (Residential)"
                  value={
                    lic.bondMinResidential ? `$${lic.bondMinResidential.toLocaleString()}` : null
                  }
                />
                <Row
                  label="Bond Min (Commercial)"
                  value={
                    lic.bondMinCommercial ? `$${lic.bondMinCommercial.toLocaleString()}` : null
                  }
                />
                <Row
                  label="GL Insurance Min"
                  value={lic.glInsuranceMin ? `$${lic.glInsuranceMin.toLocaleString()}` : null}
                />
                <Row label="Workers Comp Required" value={lic.workersCompRequired} />
                <Row label="Reciprocity States" value={lic.reciprocityStates} />
                <Row
                  label="License Renewal"
                  value={
                    lic.licenseRenewalYears ? `Every ${lic.licenseRenewalYears} year(s)` : null
                  }
                />
                <Row label="CE Hours Required" value={lic.ceHoursRequired} />
                <Row
                  label="Threshold Amount"
                  value={lic.thresholdAmount ? `$${lic.thresholdAmount.toLocaleString()}` : null}
                />
                <Row label="Notes" value={lic.notes} />
              </Section>
            )
          })()}

        {!loading &&
          activeTab === 'liens' &&
          liensData &&
          (() => {
            const lien = findStateRecord(liensData)
            const pay = findStateRecord(payData)
            return (
              <>
                <Section title="Mechanics Lien Laws">
                  <Row label="Preliminary Notice Required" value={lien.preliminaryNoticeRequired} />
                  <Row label="Preliminary Notice Deadline" value={lien.preliminaryNoticeDeadline} />
                  <Row label="Who Must Serve Notice" value={lien.preliminaryNoticeWho} />
                  <Row
                    label="Lien Filing Deadline"
                    value={
                      lien.lienFilingDeadlineDays
                        ? `${lien.lienFilingDeadlineDays} days from last work`
                        : null
                    }
                    citation={lien.citation}
                  />
                  <Row label="Filing Deadline Note" value={lien.lienFilingDeadlineNote} />
                  <Row
                    label="Foreclosure Deadline"
                    value={
                      lien.lienForeClosureDeadlineDays
                        ? `${lien.lienForeClosureDeadlineDays} days`
                        : null
                    }
                  />
                  <Row label="Notice of Intent Required" value={lien.noticeOfIntentRequired} />
                  <Row label="Claimant Types" value={lien.claimantTypes} />
                  <Row
                    label="Residential Exceptions"
                    value={lien.residentialOwnerOccupiedExceptions}
                  />
                  <Row label="Notes" value={lien.notes} />
                </Section>
                <Section title="Prompt Payment">
                  <Row
                    label="Owner to GC"
                    value={pay.ownerToGcDays ? `${pay.ownerToGcDays} days` : null}
                    citation={pay.citation}
                  />
                  <Row
                    label="GC to Sub"
                    value={pay.gcToSubDays ? `${pay.gcToSubDays} days` : null}
                  />
                  <Row label="Interest Rate" value={pay.interestRateNote} />
                  <Row
                    label="Retainage Max"
                    value={pay.retainageMaxPercent ? `${pay.retainageMaxPercent}%` : null}
                  />
                  <Row label="Retainage Release" value={pay.retainageReleaseNote} />
                  <Row label="Pay-if-Paid Enforceable" value={pay.payIfPaidEnforceable} />
                  <Row label="Pay-When-Paid Rule" value={pay.payWhenPaidRule} />
                  <Row label="Public Projects Covered" value={pay.publicProjectsCovered} />
                  <Row label="Private Projects Covered" value={pay.privateProjectsCovered} />
                </Section>
              </>
            )
          })()}

        {!loading &&
          activeTab === 'contracts' &&
          tabData.contracts &&
          (() => {
            const cl = findStateRecord(tabData.contracts)
            return (
              <Section title="Contract & Construction Law">
                <Row
                  label="Written Contract SOL"
                  value={
                    cl.statuteOfLimitationsWrittenYears
                      ? `${cl.statuteOfLimitationsWrittenYears} years`
                      : null
                  }
                  citation={cl.statSOLCitation}
                />
                <Row
                  label="Oral Contract SOL"
                  value={
                    cl.statuteOfLimitationsOralYears
                      ? `${cl.statuteOfLimitationsOralYears} years`
                      : null
                  }
                />
                <Row
                  label="Statute of Repose"
                  value={cl.statuteOfReposeYears ? `${cl.statuteOfReposeYears} years` : null}
                  citation={cl.statSORCitation}
                />
                <Row
                  label="Implied Warranty of Construction"
                  value={cl.impliedWarrantyConstruction}
                />
                <Row label="Implied Warranty Note" value={cl.impliedWarrantyNote} />
                <Row
                  label="Right to Repair Law"
                  value={cl.rightToRepairLaw}
                  citation={cl.rightToRepairCitation}
                />
                <Row
                  label="Anti-Indemnity Law"
                  value={cl.antiIndemnityLaw}
                  citation={cl.citation}
                />
                <Row label="Anti-Indemnity Note" value={cl.antiIndemnityNote} />
                <Row label="Pay-If-Paid Enforceable" value={cl.payIfPaidEnforceable} />
                <Row
                  label="Liquidated Damages Enforceable"
                  value={cl.liquidatedDamagesEnforceable}
                />
                <Row label="Force Majeure Codified" value={cl.forceMajeureCodified} />
                <Row label="Notes" value={cl.notes} />
              </Section>
            )
          })()}

        {!loading &&
          activeTab === 'utilities' &&
          tabData.utilities &&
          (() => {
            const util = findStateRecord(tabData.utilities)
            return (
              <Section title="811 / One-Call Utility Rules">
                <Row label="One-Call Center" value={util.oneCallCenterName} />
                <Row label="Phone" value={util.oneCallPhone} />
                <Row label="Website" value={util.oneCallUrl} />
                <Row label="Notice Period" value={util.noticePeriodNote} citation={util.citation} />
                <Row label="Marking Color Standard" value={util.markingColorStandard} />
                <Row
                  label="Tolerance Zone"
                  value={
                    util.toleranceZoneInches
                      ? `${util.toleranceZoneInches}" each side of mark`
                      : null
                  }
                />
                <Row label="Emergency Locate" value={util.emergencyLocateNote} />
                <Row label="Civil Penalty" value={util.penaltyCivil} />
                <Row label="Criminal Penalty" value={util.penaltyCriminal} />
                <Row label="White-Lining Required" value={util.whiteLiningRequired} />
                <Row label="Notes" value={util.notes} />
              </Section>
            )
          })()}

        {!loading &&
          activeTab === 'permits' &&
          tabData.permits &&
          (() => {
            const bp = findStateRecord(tabData.permits)
            return (
              <Section title="Building Codes & Permits">
                <Row label="IBC Edition" value={bp.ibcEditionAdopted} citation={bp.citation} />
                <Row label="IFC Edition" value={bp.ifcEditionAdopted} />
                <Row label="NEC Edition" value={bp.necEditionAdopted} />
                <Row label="Statewide Code" value={bp.statewideBuildingCode} />
                <Row label="Code Authority" value={bp.buildingCodeAuthority} />
                <Row label="Authority URL" value={bp.buildingCodeUrl} />
                <Row label="Local Amendments Allowed" value={bp.localAmendmentsAllowed} />
                <Row label="ADA Supplement" value={bp.adaStateSupplementNote} />
                <Row label="Third-Party Inspection" value={bp.thirdPartyInspectionAllowed} />
                <Row label="Fee Structure" value={bp.permitFeeStructure} />
                <Row label="Notes" value={bp.notes} />
              </Section>
            )
          })()}

        {!loading &&
          activeTab === 'safety' &&
          tabData.safety &&
          (() => {
            const sf = findStateRecord(tabData.safety)
            return (
              <Section title="OSHA & Worker Safety">
                <Row label="State OSHA Plan" value={sf.statePlanState} citation={sf.citation} />
                <Row label="Plan Agency" value={sf.oshAuthority} />
                <Row label="Agency URL" value={sf.oshUrl} />
                <Row
                  label="Fall Protection Threshold"
                  value={sf.fallProtectionThresholdFt ? `${sf.fallProtectionThresholdFt} ft` : null}
                />
                <Row label="Scaffolding Regulations" value={sf.scaffoldingRegulations} />
                <Row label="Excavation Safety" value={sf.excavationSafetyRegulations} />
                <Row label="Confined Space" value={sf.confinedSpaceRegulations} />
                <Row label="Hazard Communication" value={sf.hazardCommunicationStandard} />
                <Row label="Workers Comp Required" value={sf.workerCompProgramRequired} />
                <Row label="Notes" value={sf.notes} />
              </Section>
            )
          })()}

        {!loading &&
          activeTab === 'prevwage' &&
          tabData.prevwage &&
          (() => {
            const pw = findStateRecord(tabData.prevwage)
            return (
              <Section title="Prevailing Wage">
                <Row label="State Law Exists" value={pw.prevailingWageLaw} citation={pw.citation} />
                <Row label="Law Scope" value={pw.lawScope} />
                <Row label="Administered By" value={pw.administeredBy} />
                <Row label="Coverage Threshold" value={pw.thresholdForPublicWorks} />
                <Row label="Federal Davis-Bacon Applies" value={pw.davisBaconApplies} />
                <Row label="Notes" value={pw.notes} />
              </Section>
            )
          })()}

        {!loading &&
          activeTab === 'roads' &&
          tabData.roads &&
          (() => {
            const rd = findStateRecord(tabData.roads)
            return (
              <Section title="Roads & Paving Regulations">
                <Row
                  label="DOT Specs Publication"
                  value={rd.dotSpecsPublication}
                  citation={rd.citation}
                />
                <Row label="DOT URL" value={rd.dotUrl} />
                <Row label="Mix Design Standard" value={rd.mixDesignStandard} />
                <Row
                  label="Compaction Density"
                  value={
                    rd.compactionDensityPercent
                      ? `${rd.compactionDensityPercent}% max theoretical density`
                      : null
                  }
                />
                <Row label="Davis-Bacon Applicable" value={rd.davisBaconApplicable} />
                <Row label="State Prevailing Wage" value={rd.statePrevailingWageLaw} />
                <Row label="PROWAG Adopted" value={rd.prowagAdopted} />
                <Row label="ADA Curb Ramp Note" value={rd.adaCurbRampNote} />
                <Row
                  label="HMA Min Laydown Temp"
                  value={rd.hmaMinLaydownTempF ? `${rd.hmaMinLaydownTempF}°F` : null}
                />
                <Row
                  label="HMA Max Laydown Temp"
                  value={rd.hmaMaxLaydownTempF ? `${rd.hmaMaxLaydownTempF}°F` : null}
                />
                <Row label="Base Compaction Note" value={rd.aggregateBaseCompactionNote} />
              </Section>
            )
          })()}

        {!loading &&
          activeTab === 'env' &&
          tabData.env &&
          (() => {
            const env = findStateRecord(tabData.env)
            return (
              <Section title="Environmental Permits">
                <Row label="NPDES Authority" value={env.npdesAuthority} citation={env.citation} />
                <Row label="NPDES URL" value={env.npdesUrl} />
                <Row
                  label="Land Disturbance Threshold"
                  value={
                    env.landDisturbanceThresholdAcres
                      ? `${env.landDisturbanceThresholdAcres} acre(s)`
                      : null
                  }
                />
                <Row label="SWPPP Required" value={env.swpppRequired} />
                <Row label="SWPPP Note" value={env.swpppNote} />
                <Row label="Erosion Control Standard" value={env.erosionControlStandard} />
                <Row
                  label="Wetland Setback"
                  value={
                    env.wetlandSetbackFt ? `${env.wetlandSetbackFt} ft` : env.wetlandSetbackNote
                  }
                />
                <Row label="State Wetland Program" value={env.stateWetlandProgram} />
                <Row label="State Env Agency" value={env.stateEnvAgency} />
                <Row label="Agency URL" value={env.stateEnvUrl} />
              </Section>
            )
          })()}
      </div>
    </>
  )
}
