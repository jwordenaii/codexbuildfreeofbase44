import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BLUEPRINT_DIR = path.join(ROOT, 'site-blueprints')
const OUTPUT_DIR = path.join(ROOT, 'generated', 'site-studio')

const REQUIRED_STRING_FIELDS = [
  'slug',
  'brandName',
  'market',
  'positioning',
  'primaryAudience',
  'coreOffer',
  'tone',
  'visualDirection',
]

function assertRequiredStrings(blueprint, fileName) {
  for (const key of REQUIRED_STRING_FIELDS) {
    if (!blueprint[key] || typeof blueprint[key] !== 'string') {
      throw new Error(`${fileName}: missing required string field '${key}'`)
    }
  }
}

function assertObjectShape(blueprint, fileName, key, fields) {
  if (!blueprint[key] || typeof blueprint[key] !== 'object' || Array.isArray(blueprint[key])) {
    throw new Error(`${fileName}: missing required object field '${key}'`)
  }
  for (const field of fields) {
    if (!blueprint[key][field] || typeof blueprint[key][field] !== 'string') {
      throw new Error(`${fileName}: missing required string field '${key}.${field}'`)
    }
  }
}

function normalizeSlug(slug) {
  return String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function uniqueList(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]
}

function scoreBlueprint(blueprint) {
  let score = 50
  if (blueprint.proofStack?.length >= 3) score += 10
  if (blueprint.contentPillars?.length >= 3) score += 10
  if (blueprint.regions?.length >= 3) score += 10
  if (blueprint.conversionModel?.leadMagnet) score += 10
  if (blueprint.visualDirection && blueprint.visualDirection.length > 18) score += 10
  return Math.min(100, score)
}

function tokensCss(blueprint) {
  return `:root {
  --studio-bg: ${blueprint.colorSystem.background};
  --studio-fg: ${blueprint.colorSystem.foreground};
  --studio-primary: ${blueprint.colorSystem.primary};
  --studio-accent: ${blueprint.colorSystem.accent};

  --studio-font-display: ${blueprint.typography.display};
  --studio-font-body: ${blueprint.typography.body};

  --studio-radius-card: 18px;
  --studio-radius-pill: 999px;

  --studio-shadow-soft: 0 16px 42px rgba(0, 0, 0, 0.22);
  --studio-shadow-hard: 0 24px 56px rgba(0, 0, 0, 0.34);

  --studio-space-1: 0.25rem;
  --studio-space-2: 0.5rem;
  --studio-space-3: 0.75rem;
  --studio-space-4: 1rem;
  --studio-space-6: 1.5rem;
  --studio-space-8: 2rem;
  --studio-space-12: 3rem;
  --studio-space-16: 4rem;
}
`
}

function architectureJson(blueprint) {
  const regions = uniqueList(blueprint.regions)
  const pillars = uniqueList(blueprint.contentPillars)

  const architecture = {
    homepage: [
      'Hero with hard-offer CTA',
      'Proof strip (logos, quantified outcomes, trust claims)',
      'Failure-cost explainer section',
      'Offer ladder (audit, plan, execution)',
      'Case-study rail by segment',
      'FAQ and objection handling',
      'Final CTA with scheduling options',
    ],
    navigationModel: {
      primary: ['Services', 'Commercial', 'Locations', 'Resources', 'Contact'],
      utility: ['Call', 'Book Assessment', 'Download Guide'],
    },
    contentPillars: pillars,
    regionalClusters: regions,
    conversionSequence: {
      primaryCTA: blueprint.conversionModel.primaryCTA,
      secondaryCTA: blueprint.conversionModel.secondaryCTA,
      leadMagnet: blueprint.conversionModel.leadMagnet,
    },
  }

  return JSON.stringify(architecture, null, 2)
}

function strategyDoc(blueprint) {
  const proof = uniqueList(blueprint.proofStack)
  const pillars = uniqueList(blueprint.contentPillars)
  const keywords = uniqueList(blueprint.targetKeywords)
  const qualityScore = scoreBlueprint(blueprint)

  return `# ${blueprint.brandName} - Site Strategy Blueprint

## Build Intent

- Market: ${blueprint.market}
- Positioning: ${blueprint.positioning}
- Audience: ${blueprint.primaryAudience}
- Core Offer: ${blueprint.coreOffer}
- Tone: ${blueprint.tone}
- Visual Direction: ${blueprint.visualDirection}

## Visual Logic

- Display Typography: ${blueprint.typography.display}
- Body Typography: ${blueprint.typography.body}
- Primary Color: ${blueprint.colorSystem.primary}
- Accent Color: ${blueprint.colorSystem.accent}
- Base Surface: ${blueprint.colorSystem.background}

## Conversion Logic

- Primary CTA: ${blueprint.conversionModel.primaryCTA}
- Secondary CTA: ${blueprint.conversionModel.secondaryCTA}
- Lead Magnet: ${blueprint.conversionModel.leadMagnet}

## Trust Stack

${proof.length ? proof.map((item) => `- ${item}`).join('\n') : '- Add at least 3 proof signals for stronger conversion confidence.'}

## Target Keywords

${keywords.length ? keywords.map((item) => `- ${item}`).join('\n') : '- Define key local targets to build programmatic SEO foundation.'}

## Content Pillars

${pillars.length ? pillars.map((item) => `- ${item}`).join('\n') : '- Add 3 strategic content pillars for topical authority.'}

## Region Clusters

${regions.length ? regions.map((item) => `- ${item}`).join('\n') : '- Add region clusters for localized expansion.'}

## Quality Score

- Studio readiness score: ${qualityScore}/100
- Notes: score rises with strong proof, clear pillars, regional structure, and lead-magnet depth.
`
}

async function ensureDirs() {
  await fs.mkdir(BLUEPRINT_DIR, { recursive: true })
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
}

async function loadBlueprints() {
  const entries = await fs.readdir(BLUEPRINT_DIR, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))

  const blueprints = []
  for (const file of files) {
    const filePath = path.join(BLUEPRINT_DIR, file.name)
    const raw = await fs.readFile(filePath, 'utf8')
    const blueprint = JSON.parse(raw)

    if (blueprint.enabled === false) continue

    assertRequiredStrings(blueprint, file.name)
    assertObjectShape(blueprint, file.name, 'colorSystem', ['background', 'foreground', 'primary', 'accent'])
    assertObjectShape(blueprint, file.name, 'typography', ['display', 'body'])
    assertObjectShape(blueprint, file.name, 'conversionModel', ['primaryCTA', 'secondaryCTA', 'leadMagnet'])

    blueprints.push({
      ...blueprint,
      slug: normalizeSlug(blueprint.slug),
    })
  }

  const seen = new Set()
  for (const blueprint of blueprints) {
    if (seen.has(blueprint.slug)) {
      throw new Error(`Duplicate blueprint slug: ${blueprint.slug}`)
    }
    seen.add(blueprint.slug)
  }

  return blueprints
}

async function writeOutputs(blueprints) {
  for (const blueprint of blueprints) {
    const targetDir = path.join(OUTPUT_DIR, blueprint.slug)
    await fs.mkdir(targetDir, { recursive: true })

    await fs.writeFile(path.join(targetDir, 'README.md'), strategyDoc(blueprint), 'utf8')
    await fs.writeFile(path.join(targetDir, 'tokens.css'), tokensCss(blueprint), 'utf8')
    await fs.writeFile(path.join(targetDir, 'page-architecture.json'), architectureJson(blueprint), 'utf8')
  }
}

async function run() {
  await ensureDirs()
  const blueprints = await loadBlueprints()
  await writeOutputs(blueprints)
  console.log(`Site Blueprint Studio complete: generated ${blueprints.length} studio package(s).`)
}

run().catch((error) => {
  console.error('Site Blueprint Studio failed:', error)
  process.exitCode = 1
})
