export const GOOGLE_SEO_POLICY_TRACKER = {
  lastReviewed: '2026-04-28',
  owner: 'J. Worden & Sons website content system',
  purpose:
    'Keep state/service-area expansion aligned with Google Search quality guidance, helpful content expectations, local SEO best practices, and future update reviews.',
  policyWatchItems: [
    {
      area: 'Helpful content',
      currentRule:
        'Every future state page must be useful for a real buyer, not a thin doorway page built only to rank.',
      implementation:
        'Require state-specific pricing, climate, service, compliance, trust, and CTA logic before adding state routes to the sitemap.',
    },
    {
      area: 'Local intent and doorway-page risk',
      currentRule:
        'Do not publish near-identical city or state pages that imply local presence where the company cannot reasonably serve.',
      implementation:
        'Keep all 50 state page models available, but only sitemap/index markets once service capacity, proof, and content depth exist.',
    },
    {
      area: 'E-E-A-T and trust',
      currentRule:
        'Show experience, expertise, authoritativeness, and trust through real project proof, reviews, licenses, insurance, process detail, and transparent estimates.',
      implementation:
        'State pages include trust requirements and service proof placeholders until real content is added.',
    },
    {
      area: 'Competitor reference adaptation',
      currentRule:
        'Use competitor research only for strategy patterns; never copy competitor wording, page structure verbatim, photos, claims, testimonials, or proprietary brand language.',
      implementation:
        'Adapt patterns from Rose Paving, Sunland Asphalt, Asphalt Paving Systems, and future references into original service depth, sector pages, preservation guidance, project proof, and localized CTAs.',
    },
    {
      area: 'Pavement preservation usefulness',
      currentRule:
        'Preservation content must help owners decide between maintenance, overlay, recycling, reconstruction, and replacement instead of using vague ranking copy.',
      implementation:
        'State and service pages require pavement condition, lifecycle, drainage, traffic, materials, and budget-timing guidance before broad indexing.',
    },
    {
      area: 'Structured data',
      currentRule:
        'Use accurate LocalBusiness, Service, FAQ, Breadcrumb, and areaServed schema without fake ratings, fake offices, or unsupported claims.',
      implementation: 'Schema helpers are data-driven from canonical state/service modules.',
    },
    {
      area: 'Future Google updates',
      currentRule:
        'Review Search Central guidance and major core/spam/helpful-content updates before large-scale page publishing.',
      implementation:
        'Update lastReviewed, add watch notes here, and only then expand sitemap coverage.',
    },
  ],
}

export function getStatePageIndexingReadiness(model) {
  if (!model) return { ready: false, reasons: ['Missing state page model.'] }
  const reasons = []
  if (!model.targetServices?.length) reasons.push('Missing service targets.')
  if (!model.climateNote) reasons.push('Missing climate or paving-season guidance.')
  if (!model.pricingSignal) reasons.push('Missing pricing/cost signal.')
  if (!model.contentRequirements?.length) reasons.push('Missing content quality requirements.')
  return {
    ready: reasons.length === 0,
    reasons,
    googleAlignedChecks: GOOGLE_SEO_POLICY_TRACKER.policyWatchItems.map((item) => item.area),
    lastPolicyReviewed: GOOGLE_SEO_POLICY_TRACKER.lastReviewed,
  }
}
