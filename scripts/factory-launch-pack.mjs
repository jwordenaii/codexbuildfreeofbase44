import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const addSiteScript = path.join(root, 'scripts', 'add-site-to-factory.mjs')
const seoKitScript = path.join(root, 'scripts', 'create-seo-growth-kit.mjs')
const blogWriterScript = path.join(root, 'scripts', 'factory-blog-writer.mjs')
const standaloneRepoScript = path.join(root, 'scripts', 'create-standalone-site-repo.mjs')
const authorityScript = path.join(root, 'scripts', 'ai-authority-factory.mjs')

function parseArgs(argv) {
  const args = {}
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue
    const [key, ...rest] = raw.slice(2).split('=')
    args[key] = rest.join('=').trim()
  }
  return args
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return fallback
}

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`Command failed: node ${path.relative(root, scriptPath)} ${args.join(' ')}`)
  }
}

function normalizeDomain(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.+$/, '')
}

try {
  const args = parseArgs(process.argv.slice(2))

  const siteKey = String(args['site-key'] || '').trim().toLowerCase()
  const domain = normalizeDomain(args.domain)
  const label = String(args.label || '').trim()
  const brand = String(args.brand || label || '').trim()
  const city = String(args.city || '').trim()
  const region = String(args.region || '').trim()

  if (!siteKey) throw new Error('Missing --site-key=<value>')
  if (!domain) throw new Error('Missing --domain=<value>')
  if (!label) throw new Error('Missing --label=<value>')
  if (!brand) throw new Error('Missing --brand=<value>')
  if (!city) throw new Error('Missing --city=<value>')
  if (!region) throw new Error('Missing --region=<value>')

  const createSite = toBool(args['create-site'], true)
  const buildSeoKit = toBool(args['seo-kit'], true)
  const buildBlogs = toBool(args['blog-writer'], true)
  const buildStandaloneRepo = toBool(args['standalone-repo'], false)
  const buildAuthority = toBool(args['authority'], true)
  const isDryRun = toBool(args['dry-run'], false)

  console.log('Factory Launch Pack starting...')

  if (isDryRun) {
    console.log('Factory Launch Pack dry run summary:')
    console.log(` - site key: ${siteKey}`)
    console.log(` - domain: ${domain}`)
    console.log(` - label: ${label}`)
    console.log(` - brand: ${brand}`)
    console.log(` - create-site: ${createSite}`)
    console.log(` - seo-kit: ${buildSeoKit}`)
    console.log(` - blog-writer: ${buildBlogs}`)
    console.log(` - standalone-repo: ${buildStandaloneRepo}`)
    console.log(` - authority: ${buildAuthority}`)
    process.exit(0)
  }

  if (createSite) {
    const addSiteArgs = [
      `--key=${siteKey}`,
      `--label=${label}`,
      `--domain=${domain}`,
      `--mode=${args.mode || 'market-landing'}`,
      `--region=${region}`,
      `--metro=${args.metro || city}`,
      `--marketName=${args.marketName || label}`,
      `--phone=${args.phone || '804-446-1296'}`,
    ]
    runNodeScript(addSiteScript, addSiteArgs)
  }

  if (buildSeoKit) {
    const seoArgs = [
      `--domain=${domain}`,
      `--brand=${brand}`,
      `--city=${city}`,
      `--region=${region}`,
    ]
    runNodeScript(seoKitScript, seoArgs)
  }

  if (buildBlogs) {
    const blogArgs = [`--site-key=${siteKey}`]
    if (args['keywords-csv']) blogArgs.push(`--keywords-csv=${args['keywords-csv']}`)
    if (args.keywords) blogArgs.push(`--keywords=${args.keywords}`)
    runNodeScript(blogWriterScript, blogArgs)
  }

  if (buildStandaloneRepo) {
    const repoArgs = [
      `--site-key=${siteKey}`,
      `--domain=${domain}`,
      `--label=${label}`,
      `--brand=${brand}`,
      `--city=${city}`,
      `--region=${region}`,
      `--metro=${args.metro || city}`,
      `--phone=${args.phone || '804-446-1296'}`,
    ]
    if (args['primary-color']) repoArgs.push(`--primary-color=${args['primary-color']}`)
    if (args['accent-color']) repoArgs.push(`--accent-color=${args['accent-color']}`)
    if (args['api-base-url']) repoArgs.push(`--api-base-url=${args['api-base-url']}`)
    if (args['ga-id']) repoArgs.push(`--ga-id=${args['ga-id']}`)
    if (args['out-dir']) repoArgs.push(`--out-dir=${args['out-dir']}`)
    runNodeScript(standaloneRepoScript, repoArgs)
  }

  if (buildAuthority) {
    const authorityArgs = [`--tenant=${siteKey}`]
    if (args.cities) authorityArgs.push(`--cities=${args.cities}`)
    if (args['authority-equipment']) authorityArgs.push(`--equipment=${args['authority-equipment']}`)
    if (args['authority-project-type']) authorityArgs.push(`--project-type=${args['authority-project-type']}`)
    // Authority script is itself non-fatal (degrades to cached content on error),
    // but the launch pack should keep going regardless.
    try {
      runNodeScript(authorityScript, authorityArgs)
    } catch (err) {
      console.warn(`authority generation step warned: ${err.message} — continuing launch.`)
    }
  }

  console.log('Factory Launch Pack complete.')
  if (!buildStandaloneRepo) {
    console.log('Next recommended command: npm run guard:public-core && npm run guard:site-isolation && npm run build && npm run guard:seo-readiness')
  }
} catch (error) {
  console.error(`factory-launch-pack failed: ${error.message}`)
  process.exit(1)
}
