import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, '..')
const manifestPath = path.join(root, 'src', 'config', 'siteFactoryManifest.json')
const blueprintsDir = path.join(root, 'site-blueprints')
const aiFactoryPath = path.join(root, 'scripts', 'ai-blog-factory.mjs')

function parseArgs(argv) {
  const args = {}
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue
    const [key, ...rest] = raw.slice(2).split('=')
    args[key] = rest.join('=').trim()
  }
  return args
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.+$/, '')
}

function csvKeywords(filePath) {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const keywordCol = headers.indexOf('keyword')
  if (keywordCol < 0) return []

  const result = []
  for (const line of lines.slice(1)) {
    const cols = line.split(',')
    const value = String(cols[keywordCol] || '').trim()
    if (!value || value === 'keyword') continue
    result.push(value)
  }
  return [...new Set(result)]
}

function defaultKeywords(profile) {
  const region = String(profile?.market?.primaryRegion || profile?.label || 'local').toLowerCase()
  const marketName = String(profile?.market?.marketName || profile?.label || 'asphalt paving').toLowerCase()
  return [
    `${region} asphalt paving`,
    `${region} parking lot paving`,
    `${region} sealcoating`,
    `${marketName} contractor`,
    `${region} commercial asphalt repair`,
  ]
}

function loadManifest() {
  const raw = fs.readFileSync(manifestPath, 'utf8')
  const parsed = JSON.parse(raw)
  const profiles = Array.isArray(parsed?.profiles) ? parsed.profiles : []
  return { profiles }
}

function buildBlueprint(siteKey, profile, keywords) {
  const marketName = profile?.market?.marketName || profile?.label || siteKey
  const region = profile?.market?.primaryRegion || marketName
  const metro = profile?.market?.primaryMetro || region

  return {
    enabled: true,
    slug: siteKey,
    domain: profile.canonicalUrl,
    brandName: profile.label,
    market: region,
    positioning: `${marketName} market authority with verified project proof`,
    primaryAudience: 'Commercial owners, property managers, and residential buyers',
    coreOffer: `High-accountability ${marketName} execution and maintenance planning`,
    tone: 'confident, technical, practical',
    visualDirection: 'premium-industrial',
    regions: [region, metro],
    proofStack: [
      'Documented project workflows',
      'Keyword-aligned content publishing cadence',
      'Conversion-focused service intent pages',
    ],
    contentPillars: [
      'commercial asphalt planning',
      'drainage and longevity diagnostics',
      'maintenance and resurfacing strategy',
    ],
    targetKeywords: keywords,
    conversionModel: {
      primaryCTA: profile?.market?.ctaLabel || 'Request Estimate',
      secondaryCTA: 'Schedule Site Review',
      leadMagnet: `${marketName} planning checklist`,
    },
  }
}

function runAiBlogFactory(slug) {
  const result = spawnSync(process.execPath, [aiFactoryPath, slug], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`ai-blog-factory exited with code ${result.status}`)
  }
}

try {
  const args = parseArgs(process.argv.slice(2))
  const siteKey = normalizeSlug(args['site-key'])
  if (!siteKey) {
    throw new Error('Missing required argument --site-key=<profile-key>')
  }

  const { profiles } = loadManifest()
  const profile = profiles.find((item) => String(item.key).toLowerCase() === siteKey)
  if (!profile) {
    throw new Error(`Site key not found in src/config/siteFactoryManifest.json: ${siteKey}`)
  }

  const domain = normalizeDomain(profile.canonicalUrl)
  const autoCsv = path.join(root, 'docs', 'seo-growth-kits', normalizeSlug(domain), 'keyword-rank-tracker.csv')
  const csvPath = args['keywords-csv'] ? path.resolve(root, args['keywords-csv']) : autoCsv

  let keywords = []
  if (args.keywords) {
    keywords = String(args.keywords)
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (!keywords.length) {
    keywords = csvKeywords(csvPath)
  }

  if (!keywords.length) {
    keywords = defaultKeywords(profile)
  }

  const isDryRun = String(args['dry-run'] || '').toLowerCase() === 'true'

  if (isDryRun) {
    console.log('Factory blog writer dry run')
    console.log(`Site key: ${siteKey}`)
    console.log(`Detected domain: ${domain}`)
    console.log(`Keyword source: ${fs.existsSync(csvPath) ? csvPath : 'fallback defaults'}`)
    console.log(`Keywords (${keywords.length}): ${keywords.join(' | ')}`)
    process.exit(0)
  }

  const tempSlug = `${siteKey}-autogen`
  const tempBlueprintPath = path.join(blueprintsDir, `${tempSlug}.json`)
  const blueprint = buildBlueprint(tempSlug, profile, keywords)

  fs.writeFileSync(tempBlueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`)

  try {
    runAiBlogFactory(tempSlug)
  } finally {
    if (String(args.keep || '').toLowerCase() !== 'true' && fs.existsSync(tempBlueprintPath)) {
      fs.unlinkSync(tempBlueprintPath)
    }
  }

  console.log(`Factory blog writer complete for site key: ${siteKey}`)
  console.log(`Keywords generated: ${keywords.length}`)
  console.log('Tip: pass --keep=true to retain the generated temporary blueprint file.')
} catch (error) {
  console.error(`factory-blog-writer failed: ${error.message}`)
  process.exit(1)
}
