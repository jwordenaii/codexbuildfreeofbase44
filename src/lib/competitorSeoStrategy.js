export const COMPETITOR_STRATEGY_REFERENCES = [
  {
    name: 'Rose Paving',
    pattern: 'national commercial authority',
    useFor:
      'multi-location trust, commercial maintenance language, deep service pages, property-manager CTAs, and proof-driven navigation',
  },
  {
    name: 'Sunland Asphalt & Construction',
    pattern: 'sector-specific positioning',
    useFor:
      'commercial, HOA, government, healthcare, education, residential, and community-focused landing-page logic',
  },
  {
    name: 'Asphalt Paving Systems',
    pattern: 'pavement preservation authority',
    useFor:
      'preservation-first education, resurfacing/recycling/reconstruction decision logic, regional coverage, and technical credibility',
  },
]

export const COMPETITOR_INSPIRED_SITE_LOGIC = [
  {
    title: 'Map every competitor strength to our own proof',
    logic:
      'Use competitor examples only as strategy prompts. Every page must convert the pattern into J Worden & Sons-specific proof: family history, VA Class A GC licensing, QSR work, pavement intelligence, service-area detail, and real project results.',
  },
  {
    title: 'Build pages around buyer type, not generic keywords',
    logic:
      'Commercial property managers, franchise/QSR operators, HOAs, churches, schools, municipalities, homeowners, and industrial owners each need different proof, pain points, FAQs, and CTAs.',
  },
  {
    title: 'Lead with preservation before replacement',
    logic:
      'Explain when to crack fill, sealcoat, patch, overlay, recycle, reconstruct, or replace so the site helps buyers protect pavement life instead of sounding like a one-size-fits-all sales page.',
  },
  {
    title: 'Turn technical capability into plain-English confidence',
    logic:
      'Translate 811 checks, GPR/EM locating, drainage review, asphalt temperature, pavement age-decay, traffic phasing, and lifecycle scoring into clear reasons the job will be safer and longer-lasting.',
  },
  {
    title: 'Make state and city expansion Google-safe',
    logic:
      'Use all-state page models as infrastructure, but only index pages when they have useful local proof, honest service capacity, state-specific climate/compliance guidance, and unique buyer value.',
  },
  {
    title: 'Use every page to create the next click',
    logic:
      'Connect service pages, city pages, state pages, project galleries, FAQs, quote forms, phone CTAs, and the Command Center so buyers always have a useful next step.',
  },
]

export const COMPETITOR_CONTENT_QUALITY_GATE = [
  'Original wording only; never copy competitor copy, claims, photos, testimonials, or brand phrasing.',
  'Each page needs a clear buyer, service, location, problem, proof, and CTA.',
  'Claims must be supported by J Worden & Sons facts, real capabilities, or clearly framed future-ready logic.',
  'Preservation guidance must compare options and explain tradeoffs, not push every buyer to replacement.',
  'Local/state pages must avoid doorway-page behavior by adding unique, helpful local content before broad indexing.',
]

export function buildCompetitorStrategySummary(context = 'site') {
  return {
    context,
    references: COMPETITOR_STRATEGY_REFERENCES.map((ref) => ref.name),
    actions: COMPETITOR_INSPIRED_SITE_LOGIC.map((item) => item.title),
    qualityGate: COMPETITOR_CONTENT_QUALITY_GATE,
  }
}
