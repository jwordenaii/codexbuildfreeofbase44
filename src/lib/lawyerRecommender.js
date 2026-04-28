/**
 * Lawyer / Negotiation Recommender
 *
 * Uses the existing legal data files to score each state's legal environment
 * from a contractor's perspective and produce actionable strategy recommendations.
 *
 * Scoring dimensions (0–100, higher = more contractor-favorable):
 *   lienScore    — based on mechanicsLienLaws: filing deadlines, notice simplicity
 *   paymentScore — based on promptPaymentLaws: private coverage, payment speed, interest
 *   contractScore — based on contractLaw: anti-indemnity, SOL, no-lien-waiver
 *
 * Public exports:
 *   scoreState(abbr, lienData, paymentData, contractData) → { lien, payment, contract, composite }
 *   recommendStrategy(abbr, disputeType, role, allData)   → recommendation object
 *   rankStatesByDispute(disputeType, allData)             → sorted array of states
 */

// ── Scoring helpers ───────────────────────────────────────────────────────────

/** Score a state's lien law favorability for a contractor (0–100). */
export function scoreLienLaw(lienEntry) {
  if (!lienEntry) return 50
  let score = 0

  // Filing deadline (longer = more time to act = better for contractor)
  const days = lienEntry.lienFilingDeadlineDays || 0
  if (days >= 180) score += 30
  else if (days >= 120) score += 25
  else if (days >= 90) score += 18
  else if (days >= 60) score += 12
  else score += 5

  // No preliminary notice required = simpler = better
  if (!lienEntry.preliminaryNoticeRequired) score += 25
  else score += 5

  // No notice of intent = simpler = better
  if (!lienEntry.noticeOfIntentRequired) score += 15
  else score += 5

  // No residential owner-occupied exceptions = stronger rights
  if (!lienEntry.residentialOwnerOccupiedExceptions) score += 15
  else score += 5

  // Foreclosure deadline (longer = more time to enforce)
  const fDays = lienEntry.lienForeClosureDeadlineDays || 0
  if (fDays >= 365) score += 15
  else if (fDays >= 180) score += 12
  else if (fDays >= 90) score += 8
  else score += 3

  return Math.min(score, 100)
}

/** Score a state's prompt payment law favorability (0–100). */
export function scorePaymentLaw(payEntry) {
  if (!payEntry) return 50
  let score = 0

  // Private projects covered = strongest protection
  if (payEntry.privateProjectsCovered) score += 30
  else if (payEntry.publicProjectsCovered) score += 15

  // Owner-to-GC payment speed (lower days = faster = better)
  const ownerDays = payEntry.ownerToGcDays || 30
  if (ownerDays <= 7) score += 20
  else if (ownerDays <= 14) score += 15
  else if (ownerDays <= 21) score += 10
  else if (ownerDays <= 30) score += 7
  else score += 3

  // GC-to-Sub payment speed
  const subDays = payEntry.gcToSubDays || 14
  if (subDays <= 7) score += 15
  else if (subDays <= 14) score += 10
  else score += 5

  // Interest rate on late payments (higher = more deterrent)
  const rate = payEntry.interestRatePercent || 0
  if (rate >= 2) score += 20
  else if (rate >= 1.5) score += 15
  else if (rate >= 1) score += 10
  else if (rate > 0) score += 5

  // Low retainage = better for contractor cash flow
  const retainage = payEntry.retainageMaxPercent || 10
  if (retainage <= 5) score += 15
  else if (retainage <= 7) score += 10
  else score += 5

  return Math.min(score, 100)
}

/** Score a state's contract law favorability (0–100). */
export function scoreContractLaw(contractEntry) {
  if (!contractEntry) return 50
  let score = 0

  // Anti-indemnity law = protects contractor from unfair blame-shifting
  if (contractEntry.antiIndemnityLaw) score += 25

  // No-lien-waiver until paid = prevents premature waiver
  if (contractEntry.noLienWaiverUntilPaid) score += 20

  // Pay-if-paid NOT enforceable = subs can't be stiffed
  if (contractEntry.payIfPaidEnforceable === false) score += 20

  // Long statute of limitations (written contracts)
  const sol = contractEntry.statuteOfLimitationsWrittenYears || 3
  if (sol >= 8) score += 20
  else if (sol >= 6) score += 15
  else if (sol >= 4) score += 10
  else score += 5

  // Long statute of repose
  const sor = contractEntry.statuteOfReposeYears || 8
  if (sor >= 15) score += 15
  else if (sor >= 10) score += 12
  else if (sor >= 8) score += 8
  else score += 4

  return Math.min(score, 100)
}

// ── State composite scoring ───────────────────────────────────────────────────

/**
 * Compute all three dimension scores + composite for one state.
 *
 * @param {string} abbr - 2-letter state abbreviation
 * @param {object} lienEntry - from mechanicsLienLaws.js
 * @param {object} payEntry  - from promptPaymentLaws.js
 * @param {object} contractEntry - from contractLaw.js
 * @returns {{ lien, payment, contract, composite, label, color }}
 */
export function scoreState(abbr, lienEntry, payEntry, contractEntry) {
  const lien = scoreLienLaw(lienEntry)
  const payment = scorePaymentLaw(payEntry)
  const contract = scoreContractLaw(contractEntry)
  const composite = Math.round((lien + payment + contract) / 3)

  return {
    abbr,
    lien,
    payment,
    contract,
    composite,
    label: composite >= 75 ? 'STRONG' : composite >= 55 ? 'MODERATE' : 'WEAK',
    color: composite >= 75 ? 'green' : composite >= 55 ? 'yellow' : 'red',
  }
}

// ── Dispute-specific composite ─────────────────────────────────────────────

/**
 * Return a composite score weighted for the given dispute type.
 * @param {{ lien, payment, contract }} scores
 * @param {string} disputeType - 'lien' | 'payment' | 'contract_breach' | 'general'
 */
export function weightedScore(scores, disputeType) {
  const { lien, payment, contract } = scores
  switch (disputeType) {
    case 'lien':
      return Math.round(lien * 0.7 + payment * 0.15 + contract * 0.15)
    case 'payment':
      return Math.round(payment * 0.7 + lien * 0.15 + contract * 0.15)
    case 'contract_breach':
      return Math.round(contract * 0.7 + lien * 0.15 + payment * 0.15)
    default:
      return Math.round((lien + payment + contract) / 3)
  }
}

// ── Strategy rules ────────────────────────────────────────────────────────────

const STRATEGY_RULES = {
  lien: {
    title: 'Mechanics Lien Dispute',
    description:
      "Mechanics liens cloud property title and force payment disputes to resolution before the owner can sell or refinance. A properly filed lien is one of a contractor's most powerful tools.",
    keyActions: [
      'File the lien immediately — deadlines are strict and missing them waives your rights entirely.',
      'Send preliminary notice as early as possible, even before the formal deadline.',
      'Document every date of first furnishing labor or materials with timestamped records.',
      'Use certified mail for all required notices and keep return receipt cards.',
      'Consult a construction attorney in the project state before the filing deadline.',
    ],
    gcLeverage: [
      'GCs generally have the strongest lien rights — no preliminary notice required in most states.',
      'A filed lien immediately creates negotiating pressure; the owner cannot sell or refinance.',
      'In states with no residential owner exceptions, lien rights are absolute.',
    ],
    subLeverage: [
      'File your preliminary notice the day you start work — never wait.',
      'Notice requirements are the #1 reason subs lose lien rights; perfect compliance is mandatory.',
      'Once a lien is filed, the GC and owner both have incentive to resolve quickly.',
    ],
    weakPositionAdvice:
      'If the filing deadline has passed, pursue prompt-payment interest claims and bond claims on public projects as alternative remedies.',
    citationNote: "See your state's mechanics lien statute and /advisory/construction-law.",
  },
  payment: {
    title: 'Payment / Prompt-Payment Dispute',
    description:
      'Prompt payment statutes enforce payment timelines and add mandatory interest penalties for late payment. Many states cover both public and private projects.',
    keyActions: [
      "Send a formal written demand referencing the state's prompt payment statute by citation.",
      'Calculate statutory interest from the exact due date and include it in your demand.',
      'On public projects, pursue both the payment bond and the owner simultaneously.',
      'Demand payment via certified mail to create a verifiable paper trail.',
      'If pay-if-paid is in your contract, challenge its enforceability — many states limit it.',
    ],
    gcLeverage: [
      'File a payment bond claim on public projects within the statutory window.',
      'Assert prompt payment interest — the penalty rate can be 1–2% per month.',
      'Suspend work after proper written notice for non-payment in most states.',
    ],
    subLeverage: [
      "Pay-if-paid clauses are unenforceable in several states — check your state's rule.",
      'Assert lien rights simultaneously with prompt payment claims for maximum pressure.',
      'Document all approved change orders and disputed invoices carefully.',
    ],
    weakPositionAdvice:
      'If your state only covers public projects, focus on bond claims and pursue breach of contract for private projects.',
    citationNote: "See your state's prompt payment statute and /advisory/construction-law.",
  },
  contract_breach: {
    title: 'Contract Breach / Dispute',
    description:
      "Contract breach disputes depend heavily on the written contract terms, statute of limitations, anti-indemnity protections, and whether the state's implied warranty law applies.",
    keyActions: [
      'File suit well before the statute of limitations expires — written contracts typically allow 3–10 years.',
      'Review all anti-indemnity statutes — indemnification clauses that shift fault may be void.',
      'Document all change orders, RFIs, and communications as evidence.',
      'Invoke any right-to-cure process if applicable before filing suit.',
      'Preserve all emails, texts, photos, and daily logs as evidence.',
    ],
    gcLeverage: [
      'Anti-indemnity laws in most states void clauses requiring you to indemnify for owner negligence.',
      'Liquidated damages clauses are enforced — ensure any delay was owner-caused.',
      'Implied warranty claims by owners must still prove deviation from workmanlike standard.',
    ],
    subLeverage: [
      'Pay-if-paid clauses may be unenforceable — the GC generally cannot withhold indefinitely.',
      'Document all approved and disputed scope changes in writing.',
      'Force majeure provisions and owner-caused delay give strong defenses.',
    ],
    weakPositionAdvice:
      'If the statute of limitations has run, investigate tolling grounds — fraud, discovery rule, or contractual SOL extension.',
    citationNote: "See your state's construction contract law and /advisory/contracts.",
  },
  general: {
    title: 'General Construction Law Inquiry',
    description: "Multi-factor analysis of the state's overall legal environment for contractors.",
    keyActions: [
      'Maintain a fully executed written contract before any work begins.',
      'Verify contractor license and bond are current in the project state.',
      'Send a preliminary notice of furnishing on every project as best practice.',
      'Document all work with daily logs, photos, and signed delivery receipts.',
      'Include a dispute resolution clause specifying governing law in all contracts.',
    ],
    gcLeverage: [
      'A valid license + bond is your first line of defense against owner counterclaims.',
      'Reciprocity licensing allows expansion to neighboring states without re-examination.',
    ],
    subLeverage: [
      'File preliminary notices on every project regardless of whether required.',
      'Ensure all supplier and labor agreements are in writing.',
    ],
    weakPositionAdvice:
      'Consult a licensed construction attorney in the project state before executing any contract.',
    citationNote: 'See /advisory for full state-by-state legal reference.',
  },
}

// ── Main recommendation function ──────────────────────────────────────────────

/**
 * Generate a full negotiation recommendation.
 *
 * @param {string} abbr - 2-letter state abbreviation
 * @param {string} disputeType - 'lien' | 'payment' | 'contract_breach' | 'general'
 * @param {string} role - 'gc' | 'sub' | 'supplier' | 'owner'
 * @param {{ lienEntry, payEntry, contractEntry }} stateData - pre-loaded entries
 * @param {Array} allStatesScored - output of rankStatesByDispute() for top-states list
 * @returns {object} recommendation
 */
export function recommendStrategy(abbr, disputeType, role, stateData, allStatesScored = []) {
  const { lienEntry, payEntry, contractEntry } = stateData || {}
  const scores = scoreState(abbr, lienEntry, payEntry, contractEntry)
  const composite = weightedScore(scores, disputeType)

  const dtype = STRATEGY_RULES[disputeType] ? disputeType : 'general'
  const rules = STRATEGY_RULES[dtype]

  const leverage = ['gc', 'owner'].includes(role) ? rules.gcLeverage : rules.subLeverage

  const topStates = allStatesScored
    .slice()
    .sort((a, b) => (b.weighted || b.composite) - (a.weighted || a.composite))
    .slice(0, 5)

  return {
    abbr,
    disputeType: dtype,
    role,
    scores,
    composite,
    strengthLabel: composite >= 75 ? 'STRONG' : composite >= 55 ? 'MODERATE' : 'WEAK',
    strengthColor: composite >= 75 ? 'green' : composite >= 55 ? 'yellow' : 'red',
    strategy: {
      title: rules.title,
      description: rules.description,
      keyActions: rules.keyActions,
      roleLeverage: leverage,
      weakPositionAdvice: rules.weakPositionAdvice,
      citationNote: rules.citationNote,
    },
    topStates,
  }
}

// ── State ranking function ────────────────────────────────────────────────────

/**
 * Rank all available states by contractor-favorability for a dispute type.
 *
 * @param {string} disputeType
 * @param {Array} lienData - full mechanicsLienLaws dataset
 * @param {Array} payData  - full promptPaymentLaws dataset
 * @param {Array} contractData - full contractLaw dataset
 * @returns {Array} sorted state objects with scores
 */
export function rankStatesByDispute(disputeType, lienData, payData, contractData) {
  const lienMap = Object.fromEntries((lienData || []).map((e) => [e.abbr, e]))
  const payMap = Object.fromEntries((payData || []).map((e) => [e.abbr, e]))
  const contractMap = Object.fromEntries((contractData || []).map((e) => [e.abbr, e]))

  const abbrs = [
    ...new Set([...Object.keys(lienMap), ...Object.keys(payMap), ...Object.keys(contractMap)]),
  ]

  return abbrs
    .map((abbr) => {
      const scores = scoreState(abbr, lienMap[abbr], payMap[abbr], contractMap[abbr])
      const weighted = weightedScore(scores, disputeType)
      return { ...scores, weighted, state: lienMap[abbr]?.state || payMap[abbr]?.state || abbr }
    })
    .sort((a, b) => b.weighted - a.weighted)
}

export const DISPUTE_TYPES = [
  { value: 'lien', label: 'Mechanics Lien Dispute' },
  { value: 'payment', label: 'Payment / Prompt-Payment' },
  { value: 'contract_breach', label: 'Contract Breach' },
  { value: 'general', label: 'General Construction Law' },
]

export const ROLES = [
  { value: 'gc', label: 'General Contractor' },
  { value: 'sub', label: 'Subcontractor' },
  { value: 'supplier', label: 'Material Supplier' },
  { value: 'owner', label: 'Property Owner' },
]
