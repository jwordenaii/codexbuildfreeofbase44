/**
 * ProposalsPanel — GPT-4o proposal generator.
 *
 * Fetches CRM leads, lets the operator pick one, generates a proposal,
 * previews the text, and sends it via email — all from the Command Center.
 */
import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { downloadPdf } from '../../lib/pdfUtils'

function Badge({ children, color = 'gray' }) {
  const cls = {
    red:    'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    blue:   'bg-blue-100 text-blue-700',
    gray:   'bg-gray-100 text-gray-600',
  }[color] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {children}
    </span>
  )
}

function scoreColor(score) {
  if (score === 'HOT')  return 'red'
  if (score === 'WARM') return 'orange'
  return 'blue'
}

export default function ProposalsPanel() {
  const [leads, setLeads]         = useState([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadsError, setLeadsError]     = useState('')

  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [generating, setGenerating]         = useState(false)
  const [proposal, setProposal]             = useState(null)   // { proposal_id, proposal_text, pdf_b64 }
  const [genError, setGenError]             = useState('')

  const [sending, setSending]       = useState(false)
  const [sendResult, setSendResult] = useState('')

  useEffect(() => {
    api.getCRMLeads({ limit: 100 })
      .then((d) => setLeads(d.leads || []))
      .catch((e) => setLeadsError(e.message))
      .finally(() => setLeadsLoading(false))
  }, [])

  const handleGenerate = async () => {
    if (!selectedLeadId) return
    setGenerating(true)
    setGenError('')
    setProposal(null)
    setSendResult('')
    try {
      const data = await api.generateProposal(Number(selectedLeadId))
      setProposal(data)
    } catch (e) {
      setGenError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!proposal?.proposal_id) return
    setSending(true)
    setSendResult('')
    try {
      const data = await api.sendProposal(proposal.proposal_id)
      setSendResult(data.message || data.detail || 'Proposal sent successfully!')
    } catch (e) {
      setSendResult(`Error: ${e.message}`)
    } finally {
      setSending(false)
    }
  }

  const handleDownload = () => {
    if (!proposal?.pdf_b64) return
    downloadPdf(proposal.pdf_b64, `proposal-lead-${selectedLeadId}.pdf`)
  }

  const selectedLead = leads.find((l) => String(l.id) === String(selectedLeadId))

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-display font-bold text-brand-navy text-xl mb-1">
          📄 Proposal Generator
        </h2>
        <p className="text-brand-navy/50 text-sm mb-5">
          Select a lead, generate a GPT-4o proposal, preview it, then download as PDF or email it directly.
        </p>

        {leadsLoading && (
          <div className="text-brand-navy/40 text-sm">Loading leads…</div>
        )}
        {leadsError && (
          <div className="text-red-500 text-sm">{leadsError}</div>
        )}

        {!leadsLoading && !leadsError && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-brand-navy mb-1.5">
                Select Lead
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => { setSelectedLeadId(e.target.value); setProposal(null); setSendResult('') }}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-amber/50 focus:border-brand-amber"
              >
                <option value="">— choose a lead —</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.id} · {l.name} · {l.email} ({l.score_label || '—'})
                  </option>
                ))}
              </select>
            </div>

            {selectedLead && (
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-brand-navy">{selectedLead.name}</span>
                  <Badge color={scoreColor(selectedLead.score_label)}>{selectedLead.score_label || 'N/A'}</Badge>
                </div>
                {[
                  ['Email',   selectedLead.email],
                  ['Phone',   selectedLead.phone],
                  ['Service', selectedLead.service_type],
                  ['Size',    selectedLead.project_size_sqft ? `${selectedLead.project_size_sqft} sqft` : null],
                  ['State',   selectedLead.state_code],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-brand-navy/40 w-20 flex-shrink-0">{k}</span>
                    <span className="text-brand-navy">{v}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!selectedLeadId || generating}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating…' : '✨ Generate Proposal'}
            </button>

            {genError && (
              <div className="text-red-500 text-sm">{genError}</div>
            )}
          </div>
        )}
      </div>

      {proposal && (
        <div className="card p-6 space-y-4">
          <h3 className="font-display font-bold text-brand-navy text-lg">Proposal Preview</h3>
          <pre className="bg-gray-50 rounded-xl p-4 text-sm text-brand-navy/80 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {proposal.proposal_text}
          </pre>

          <div className="flex flex-wrap gap-3">
            {proposal.pdf_b64 && (
              <button
                type="button"
                onClick={handleDownload}
                className="btn-outline flex items-center gap-2"
              >
                ⬇ Download PDF
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending…' : '📧 Email to Lead'}
            </button>
          </div>

          {sendResult && (
            <div className={`text-sm rounded-lg px-4 py-2 ${
              sendResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {sendResult}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
