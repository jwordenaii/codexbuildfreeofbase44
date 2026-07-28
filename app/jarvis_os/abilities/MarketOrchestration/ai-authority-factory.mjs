/**
 * ai-authority-factory.mjs — J. Worden | Authority build-time content generator.
 *
 * Reads the VA city grid from src/lib/locations.js, calls the FastAPI Authority
 * endpoint for each city, and writes per-tenant cache files to
 * src/generated/authorityContent.{tenant}.json. The Vite prerender step then
 * bakes the content into static HTML so Google indexes it directly.
 *
 * Architecture:
 *   LOCATIONS (src/lib/locations.js)
 *     → filter by stateAbbr=='VA' (or --cities=...)
 *       → fetch  GET ${VITE_API_BASE_URL}/api/v1/authority/local-proof?tenant=...&city=...
 *         → write src/generated/authorityContent.{tenant}.json
 *
 * Cache-aware: skips cities whose cached entry is younger than --ttl-days
 * (default 30). Use --force to ignore the cache. Failures are non-fatal —
 * stale entries are kept and the build continues.
 *
 * Usage:
 *   node scripts/ai-authority-factory.mjs                    # all VA cities, default tenant
 *   node scripts/ai-authority-factory.mjs --dry-run          # plan only
 *   node scripts/ai-authority-factory.mjs --cities=richmond-va,chester-va
 *   node scripts/ai-authority-factory.mjs --force            # regenerate everything
 *   node scripts/ai-authority-factory.mjs --tenant=acme      # different customer
 *   node scripts/ai-authority-factory.mjs --ttl-days=7       # tighter freshness
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const DEFAULT_TENANT = 'jworden'
const DEFAULT_TTL_DAYS = 30
const DEFAULT_PROJECT_TYPE = 'commercial parking lot repaving'
const DEFAULT_EQUIPMENT = 'Mauldin 690, LeeBoy'
const REQUEST_TIMEOUT_MS = 30_000
const INTER_REQUEST_DELAY_MS = 200 // be gentle with the LLM provider

// ── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _flags: new Set() }
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue
    const [key, ...rest] = raw.slice(2).split('=')
    const value = rest.join('=').trim()
    if (value === '') args._flags.add(key)
    else args[key] = value
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const tenant = args.tenant || DEFAULT_TENANT
const isDryRun = args._flags.has('dry-run') || args['dry-run'] === 'true'
const isForce = args._flags.has('force') || args.force === 'true'
const ttlDays = Number.isFinite(parseInt(args['ttl-days'], 10))
  ? parseInt(args['ttl-days'], 10)
  : DEFAULT_TTL_DAYS
const apiBase = (args['api-base'] || process.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const onlyCitiesArg = args.cities ? args.cities.split(',').map((s) => s.trim()).filter(Boolean) : null
const projectType = args['project-type'] || DEFAULT_PROJECT_TYPE
const equipment = args.equipment || DEFAULT_EQUIPMENT

// ── Load city grid (dynamic import — locations.js uses ESM exports) ──────────

async function loadCities() {
  const url = pathToFileURL(path.join(root, 'src', 'lib', 'locations.js')).href
  const mod = await import(url)
  const all = mod.LOCATIONS || []
  let list = all.filter((l) => l && l.slug && l.city)

  if (onlyCitiesArg) {
    const want = new Set(onlyCitiesArg)
    list = list.filter((l) => want.has(l.slug))
    const missing = [...want].filter((s) => !list.find((l) => l.slug === s))
    if (missing.length) {
      console.warn(`[authority-factory] warning: --cities included unknown slugs: ${missing.join(', ')}`)
    }
  } else {
    // Default: all Virginia entries (the Authority engine's home market).
    list = list.filter((l) => l.stateAbbr === 'VA')
  }
  return list
}

// ── Cache file ───────────────────────────────────────────────────────────────

const generatedDir = path.join(root, 'src', 'generated')
const cacheFile = path.join(generatedDir, `authorityContent.${tenant}.json`)

function readCache() {
  if (!fs.existsSync(cacheFile)) return {}
  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8')) || {}
  } catch (err) {
    console.warn(`[authority-factory] cache file is corrupt, ignoring (${err.message})`)
    return {}
  }
}

function writeCache(cache) {
  if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true })
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2) + '\n', 'utf8')
}

function isFresh(entry) {
  if (!entry || !entry.generated_at) return false
  const ageMs = Date.now() - new Date(entry.generated_at).getTime()
  if (!Number.isFinite(ageMs) || ageMs < 0) return false
  return ageMs < ttlDays * 24 * 60 * 60 * 1000
}

// ── Single-city call ─────────────────────────────────────────────────────────

async function fetchProof(city) {
  if (!apiBase) throw new Error('VITE_API_BASE_URL (or --api-base) is not set')
  const url =
    `${apiBase}/api/v1/authority/local-proof` +
    `?tenant=${encodeURIComponent(tenant)}` +
    `&city=${encodeURIComponent(city.city)}` +
    `&project_type=${encodeURIComponent(projectType)}` +
    `&equipment=${encodeURIComponent(equipment)}` +
    (city.stateAbbr && city.stateAbbr !== 'VA' ? `&state=${encodeURIComponent(city.stateAbbr)}` : '')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    const data = await res.json()
    if (!data || !data.verified_content) throw new Error('empty response body')
    return data
  } finally {
    clearTimeout(timer)
  }
}

// ── Sleep helper ─────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[authority-factory] tenant=${tenant} ttl=${ttlDays}d force=${isForce} dry-run=${isDryRun}`)
  const cities = await loadCities()
  console.log(`[authority-factory] target cities: ${cities.length}`)
  if (cities.length === 0) {
    console.log('[authority-factory] nothing to do.')
    return
  }

  const cache = readCache()
  const summary = { generated: 0, cached: 0, failed: 0, skipped: 0 }

  for (const city of cities) {
    const slug = city.slug
    const existing = cache[slug]

    if (!isForce && isFresh(existing)) {
      summary.cached++
      console.log(`  · ${slug.padEnd(28)} cached (age OK)`)
      continue
    }

    if (isDryRun) {
      summary.skipped++
      console.log(`  · ${slug.padEnd(28)} would generate (dry-run)`)
      continue
    }

    try {
      const data = await fetchProof(city)
      cache[slug] = {
        tenant,
        city: city.city,
        state: city.stateAbbr || 'VA',
        verified_content: data.verified_content,
        model: data.model,
        provider: data.provider,
        fallback_used: !!data.fallback_used,
        latency_ms: data.latency_ms,
        project_type: projectType,
        equipment: equipment.split(',').map((s) => s.trim()).filter(Boolean),
        generated_at: new Date().toISOString(),
      }
      summary.generated++
      console.log(`  ✓ ${slug.padEnd(28)} ${data.model} (${data.latency_ms}ms)`)
      await sleep(INTER_REQUEST_DELAY_MS)
    } catch (err) {
      summary.failed++
      console.warn(`  ✗ ${slug.padEnd(28)} ${err.message} — keeping prior cache`)
      // existing entry (if any) stays in `cache` untouched
    }
  }

  if (!isDryRun) writeCache(cache)

  console.log(
    `[authority-factory] done: generated=${summary.generated} cached=${summary.cached} ` +
    `failed=${summary.failed} skipped=${summary.skipped} → ${path.relative(root, cacheFile)}`,
  )
}

main().catch((err) => {
  console.error('[authority-factory] fatal:', err)
  // Exit 0 even on fatal — never block the Netlify build over content generation.
  // Use --strict to opt into a non-zero exit code for CI gating.
  process.exit(args._flags.has('strict') ? 1 : 0)
})
