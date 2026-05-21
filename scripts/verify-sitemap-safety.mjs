import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const XML_ENTITY_PATTERN = /&(?!amp;|lt;|gt;quot;|apos;|#[0-9]+;|#x[0-9a-fA-F]+;)/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const VALID_CHANGEFREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'])

const SITEMAPS = [
  {
    label: 'J. Worden Asphalt Paving',
    path: 'public/sitemap.xml',
    expectedOrigin: 'https://www.jwordenasphaltpaving.com',
    robotsPath: 'public/robots.txt',
    txtMirrorPath: 'public/sitemap.txt',
  },
  {
    label: 'J. Worden image sitemap',
    path: 'public/image-sitemap.xml',
    expectedOrigin: 'https://www.jwordenasphaltpaving.com',
    robotsPath: 'public/robots.txt',
    requireUrlMetadata: false,
  },
  {
    label: 'The Worden Standard',
    path: 'public/sitemap-thewordenstandard.xml',
    expectedOrigin: 'https://www.thewordenstandard.com',
  },
  {
    label: 'OBX Paving',
    path: 'obx-paving/public/sitemap.xml',
    expectedOrigin: 'https://www.obxpaving.com',
    robotsPath: 'obx-paving/public/robots.txt',
  },
]

const STATIC_ROUTE_EXPECTATIONS = [
  { file: 'netlify.toml', routes: ['/robots.txt', '/sitemap.xml', '/sitemap.txt', '/image-sitemap.xml'] },
  { file: 'public/_redirects', routes: ['/robots.txt', '/sitemap.xml', '/sitemap.txt', '/image-sitemap.xml'] },
  { file: 'obx-paving/netlify.toml', routes: ['/robots.txt', '/sitemap.xml'] },
]

function readFile(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${relativePath}: file missing`)
  }
  return fs.readFileSync(absolutePath, 'utf8')
}

function extractBlocks(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'g')
  return [...xml.matchAll(pattern)].map((match) => match[1])
}

function extractValues(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'g')
  return [...xml.matchAll(pattern)].map((match) => match[1].trim())
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function assertValidSitemap({
  label,
  path: sitemapPath,
  expectedOrigin,
  robotsPath,
  txtMirrorPath,
  requireUrlMetadata = true,
}) {
  const xml = readFile(sitemapPath)
  const failures = []

  if (!xml.trimStart().startsWith('<?xml')) {
    failures.push('missing XML declaration')
  }
  if (!xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
    failures.push('missing sitemap namespace')
  }
  if (XML_ENTITY_PATTERN.test(xml)) {
    failures.push('contains an unescaped XML entity')
  }

  const urlBlocks = extractBlocks(xml, 'url')
  const locs = extractValues(xml, 'loc').map(decodeXml)
  if (urlBlocks.length === 0 || locs.length === 0) {
    failures.push('contains no <url>/<loc> entries')
  }
  if (urlBlocks.length !== locs.length) {
    failures.push(`URL block count (${urlBlocks.length}) does not match loc count (${locs.length})`)
  }
  if (new Set(locs).size !== locs.length) {
    failures.push('contains duplicate <loc> entries')
  }

  for (const loc of locs) {
    let parsed
    try {
      parsed = new URL(loc)
    } catch {
      failures.push(`invalid URL: ${loc}`)
      continue
    }
    if (parsed.origin !== expectedOrigin) {
      failures.push(`unexpected URL origin: ${loc}`)
    }
    if (loc.length > 2048) {
      failures.push(`URL exceeds 2048 characters: ${loc}`)
    }
  }

  for (const block of urlBlocks) {
    const loc = decodeXml(extractValues(block, 'loc')[0] || '(missing loc)')
    const lastmod = extractValues(block, 'lastmod')[0]
    const changefreq = extractValues(block, 'changefreq')[0]
    const priority = extractValues(block, 'priority')[0]

    if (requireUrlMetadata) {
      if (!DATE_ONLY.test(lastmod || '')) {
        failures.push(`${loc}: invalid lastmod ${lastmod || '(missing)'}`)
      }
      if (!VALID_CHANGEFREQ.has(changefreq)) {
        failures.push(`${loc}: invalid changefreq ${changefreq || '(missing)'}`)
      }
      const numericPriority = Number(priority)
      if (!Number.isFinite(numericPriority) || numericPriority < 0 || numericPriority > 1) {
        failures.push(`${loc}: invalid priority ${priority || '(missing)'}`)
      }
    }
  }

  if (robotsPath) {
    const robots = readFile(robotsPath)
    const sitemapUrl = `${expectedOrigin}/${path.basename(sitemapPath)}`
    if (!robots.includes(`Sitemap: ${sitemapUrl}`)) {
      failures.push(`${robotsPath}: missing Sitemap: ${sitemapUrl}`)
    }
  }

  if (txtMirrorPath) {
    const txtUrls = readFile(txtMirrorPath).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (txtUrls.join('\n') !== locs.join('\n')) {
      failures.push(`${txtMirrorPath}: URL list does not match XML sitemap order`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`${label} (${sitemapPath}) failed:\n - ${failures.join('\n - ')}`)
  }

  console.log(`[sitemap-safety] ${label}: ${locs.length} URLs OK`)
}

function assertStaticRoutes() {
  for (const expectation of STATIC_ROUTE_EXPECTATIONS) {
    const content = readFile(expectation.file)
    for (const route of expectation.routes) {
      if (!content.includes(route)) {
        throw new Error(`${expectation.file}: missing static route protection for ${route}`)
      }
    }
  }
  console.log('[sitemap-safety] static sitemap/robots delivery rules OK')
}

try {
  for (const sitemap of SITEMAPS) {
    assertValidSitemap(sitemap)
  }
  assertStaticRoutes()
  console.log('[sitemap-safety] all sitemap safety checks passed')
} catch (error) {
  console.error(error.message || error)
  process.exit(1)
}
