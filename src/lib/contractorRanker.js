/**
 * Contractor Quality Ranker
 *
 * Scores and ranks contractor bids by:
 *   1. Bid price relative to project estimate (value score)
 *   2. Licensing tier / class breadth
 *   3. Bonding adequacy relative to project size
 *   4. Years of experience
 *   5. Compliance (insurance + workers comp)
 *
 * Also provides a state license optimizer that uses constructionLicensing.js
 * to surface:
 *   - Which states offer the broadest reciprocity networks
 *   - Which license classes give the widest scope of work
 *   - Composite "optimal base license state" ranking
 *
 * Public exports:
 *   scoreContractorBid(bid, estimateLow, estimateHigh)    → scored bid
 *   rankContractorBids(bids, estimateLow, estimateHigh)   → sorted ranked array
 *   optimizeLicenseStates(licensingData)                  → sorted state profiles
 *   getLienLeverageByState(lienData)                      → contractor lien leverage ranking
 */

// ── License class scope scoring ───────────────────────────────────────────────

const LICENSE_CLASS_WEIGHTS = [
  { keyword: 'general engineering', score: 100 },
  { keyword: 'class a', score: 100 },
  { keyword: 'general building', score: 90 },
  { keyword: 'class b', score: 85 },
  { keyword: 'unlimited', score: 95 },
  { keyword: 'master', score: 80 },
  { keyword: 'specialty', score: 50 },
  { keyword: 'class c', score: 50 },
  { keyword: 'residential', score: 40 },
  { keyword: 'class cr', score: 40 },
  { keyword: 'subcontractor', score: 35 },
]

export function scoreLicenseClasses(classes = []) {
  if (!classes || classes.length === 0) return 0
  const combined = classes.join(' ').toLowerCase()
  let best = 0
  for (const { keyword, score } of LICENSE_CLASS_WEIGHTS) {
    if (combined.includes(keyword)) best = Math.max(best, score)
  }
  return best
}

// ── Bid price scoring ─────────────────────────────────────────────────────────

export function scoreBidPrice(bidAmount, estimateLow, estimateHigh) {
  if (!estimateLow || !estimateHigh || estimateLow <= 0 || estimateHigh <= 0) return 70
  if (bidAmount >= estimateLow && bidAmount <= estimateHigh) {
    const ratio = (bidAmount - estimateLow) / Math.max(estimateHigh - estimateLow, 1)
    return Math.round(90 - ratio * 15) // 75–90
  }
  if (bidAmount < estimateLow) {
    const pctBelow = (estimateLow - bidAmount) / estimateLow
    if (pctBelow > 0.3) return 55 // suspiciously low
    return Math.round(95 - pctBelow * 50)
  }
  // above range
  const pctAbove = (bidAmount - estimateHigh) / estimateHigh
  if (pctAbove > 0.5) return 20
  return Math.max(20, Math.round(70 - pctAbove * 100))
}

// ── Bond adequacy ─────────────────────────────────────────────────────────────

export function scoreBond(bondAmount, bidAmount) {
  if (!bidAmount || bidAmount <= 0) return 50
  const ratio = bondAmount / bidAmount
  if (ratio >= 1.0) return 100
  if (ratio >= 0.5) return 85
  if (ratio >= 0.25) return 70
  if (ratio >= 0.1) return 50
  if (bondAmount > 0) return 35
  return 0
}

// ── Experience ────────────────────────────────────────────────────────────────

export function scoreExperience(years = 0) {
  if (years >= 20) return 100
  if (years >= 10) return 85
  if (years >= 5) return 70
  if (years >= 2) return 50
  return 30
}

// ── Compliance ────────────────────────────────────────────────────────────────

export function scoreCompliance(hasInsurance, workersComp) {
  if (hasInsurance && workersComp) return 100
  if (hasInsurance) return 60
  return 30
}

// ── Warning flags ─────────────────────────────────────────────────────────────

export function buildFlags(bid, estimateLow) {
  const flags = []
  if (!bid.hasInsurance) flags.push('⚠️ No general liability insurance confirmed')
  if (!bid.workersComp) flags.push('⚠️ No workers comp insurance confirmed')
  if (!bid.bondAmount || bid.bondAmount <= 0) flags.push('⚠️ No surety bond on file')
  if (!bid.yearsExperience || bid.yearsExperience < 2) flags.push('⚠️ Less than 2 years experience')
  if (estimateLow > 0 && bid.bidAmount < estimateLow * 0.7) {
    flags.push('⚠️ Bid is more than 30% below estimate — verify scope and materials')
  }
  if (!bid.licenseState) flags.push('⚠️ License state not provided')
  return flags
}

// ── Rank label + recommendation ───────────────────────────────────────────────

export function rankLabel(score) {
  if (score >= 85) return 'BEST VALUE'
  if (score >= 70) return 'STRONG'
  if (score >= 50) return 'ACCEPTABLE'
  return 'HIGH RISK'
}

export function rankColor(score) {
  if (score >= 85) return 'green'
  if (score >= 70) return 'blue'
  if (score >= 50) return 'yellow'
  return 'red'
}

export function buildRecommendation(score, flags) {
  const riskFlags = flags.filter((f) => f.startsWith('⚠️'))
  if (riskFlags.length > 0) {
    return `Proceed with caution. Resolve ${riskFlags.length} risk flag(s) before awarding.`
  }
  if (score >= 85) return 'Recommended — competitive bid with strong qualifications.'
  if (score >= 70) return 'Qualified — review scope and references before awarding.'
  if (score >= 50) return 'Marginal — requires additional vetting or bond increase.'
  return 'Not recommended without significant additional qualification.'
}

// ── Main scoring function ─────────────────────────────────────────────────────

/**
 * Score a single contractor bid.
 *
 * @param {object} bid - { name, bidAmount, licenseState, licenseClasses, bondAmount,
 *                          yearsExperience, hasInsurance, workersComp, notes }
 * @param {number} estimateLow
 * @param {number} estimateHigh
 * @returns {object} scored bid with dimension scores + composite
 */
export function scoreContractorBid(bid, estimateLow = 0, estimateHigh = 0) {
  const bidS = scoreBidPrice(bid.bidAmount, estimateLow, estimateHigh)
  const licS = scoreLicenseClasses(bid.licenseClasses || [])
  const bondS = scoreBond(bid.bondAmount || 0, bid.bidAmount)
  const expS = scoreExperience(bid.yearsExperience || 0)
  const compS = scoreCompliance(bid.hasInsurance !== false, bid.workersComp !== false)
  const flags = buildFlags(bid, estimateLow)

  const composite = Math.round(bidS * 0.35 + licS * 0.2 + bondS * 0.2 + expS * 0.15 + compS * 0.1)

  return {
    ...bid,
    scores: {
      bid: bidS,
      license: licS,
      bond: bondS,
      experience: expS,
      compliance: compS,
      composite,
    },
    rankLabel: rankLabel(composite),
    rankColor: rankColor(composite),
    recommendation: buildRecommendation(composite, flags),
    flags,
    rank: 0, // set by rankContractorBids
  }
}

/**
 * Score and rank a list of contractor bids.
 *
 * @param {Array}  bids
 * @param {number} estimateLow
 * @param {number} estimateHigh
 * @returns {Array} sorted by composite score descending, with rank property set
 */
export function rankContractorBids(bids = [], estimateLow = 0, estimateHigh = 0) {
  const scored = bids.map((b) => scoreContractorBid(b, estimateLow, estimateHigh))
  scored.sort((a, b) => b.scores.composite - a.scores.composite)
  scored.forEach((s, i) => {
    s.rank = i + 1
  })
  return scored
}

// ── State license optimizer ───────────────────────────────────────────────────

/**
 * Rank all states by how beneficial a contractor license there is.
 *
 * Weights:
 *   Reciprocity breadth  40% — how many partner states accept it
 *   License class scope  40% — how broad the work authorization is
 *   Low bond requirement 20% — lower barriers to entry (inverted)
 *
 * @param {Array} licensingData - from constructionLicensing.js
 * @returns {Array} sorted state profiles with optimizer score
 */
export function optimizeLicenseStates(licensingData = []) {
  return licensingData
    .map((entry) => {
      const reciprocity = (entry.reciprocityStates || []).length
      const recipNorm = Math.min(reciprocity * 25, 100) // 0–4 states → 0–100
      const classScope = scoreLicenseClasses(entry.licenseClasses || [])
      const bond = entry.bondMinCommercial || 0
      const bondNorm =
        bond === 0
          ? 100
          : bond <= 10_000
            ? 85
            : bond <= 25_000
              ? 70
              : bond <= 50_000
                ? 55
                : bond <= 100_000
                  ? 40
                  : 20

      const optimizerScore = Math.round(recipNorm * 0.4 + classScope * 0.4 + bondNorm * 0.2)

      const optimizerLabel =
        optimizerScore >= 80
          ? 'OPTIMAL'
          : optimizerScore >= 60
            ? 'GOOD'
            : optimizerScore >= 40
              ? 'AVERAGE'
              : 'LIMITED'

      return {
        abbr: entry.abbr,
        state: entry.state,
        reciprocityCount: reciprocity,
        reciprocityStates: entry.reciprocityStates || [],
        classScope,
        licenseClasses: entry.licenseClasses || [],
        bondMinCommercial: bond,
        stateLicenseRequired: entry.stateLicenseRequired,
        optimizerScore,
        optimizerLabel,
      }
    })
    .sort((a, b) => b.optimizerScore - a.optimizerScore)
}

// ── Lien leverage by state ────────────────────────────────────────────────────

/**
 * Rank states by contractor lien leverage strength.
 * Uses mechanicsLienLaws.js data.
 *
 * @param {Array} lienData - from mechanicsLienLaws.js
 * @returns {Array} sorted by lien score descending
 */
export function getLienLeverageByState(lienData = []) {
  return lienData
    .map((entry) => {
      let score = 0

      const days = entry.lienFilingDeadlineDays || 0
      if (days >= 180) score += 30
      else if (days >= 120) score += 25
      else if (days >= 90) score += 18
      else if (days >= 60) score += 12
      else score += 5

      if (!entry.preliminaryNoticeRequired) score += 25
      else score += 5

      if (!entry.noticeOfIntentRequired) score += 15
      else score += 5

      if (!entry.residentialOwnerOccupiedExceptions) score += 15
      else score += 5

      const fDays = entry.lienForeClosureDeadlineDays || 0
      if (fDays >= 365) score += 15
      else if (fDays >= 180) score += 12
      else if (fDays >= 90) score += 8
      else score += 3

      score = Math.min(score, 100)

      return {
        abbr: entry.abbr,
        state: entry.state,
        lienScore: score,
        lienLabel: score >= 75 ? 'STRONG' : score >= 55 ? 'MODERATE' : 'WEAK',
        lienFilingDeadlineDays: entry.lienFilingDeadlineDays,
        preliminaryNoticeRequired: entry.preliminaryNoticeRequired,
        noticeOfIntentRequired: entry.noticeOfIntentRequired,
        residentialExceptions: entry.residentialOwnerOccupiedExceptions,
        citation: entry.citation,
      }
    })
    .sort((a, b) => b.lienScore - a.lienScore)
}
