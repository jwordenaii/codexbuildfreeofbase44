import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BLUEPRINT_DIR = path.join(ROOT, 'ai-page-blueprints')
const PAGE_DIR = path.join(ROOT, 'src', 'pages', 'ai')
const REGISTRY_FILE = path.join(ROOT, 'src', 'generated', 'aiPageRegistry.jsx')
const SITEMAP_FILE = path.join(ROOT, 'public', 'sitemap.xml')

const DOMAIN = 'https://www.jwordenasphaltpaving.com'
const BLOCK_START = '  <!-- AI_PAGE_FACTORY:START -->'
const BLOCK_END = '  <!-- AI_PAGE_FACTORY:END -->'

function slugToPascal(slug) {
  return slug
    .split('/')
    .filter(Boolean)
    .join('-')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function normalizePath(slug) {
  if (!slug) return ''
  const trimmed = String(slug).trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return `/${trimmed}`
}

function assertBlueprint(blueprint, fileName) {
  const required = ['slug', 'title', 'description']
  for (const key of required) {
    if (!blueprint[key] || typeof blueprint[key] !== 'string') {
      throw new Error(`${fileName}: missing required string field '${key}'`)
    }
  }
  if (blueprint.sections && !Array.isArray(blueprint.sections)) {
    throw new Error(`${fileName}: 'sections' must be an array when provided`)
  }
}

function assertPremiumQuality(blueprint, fileName) {
  if ((blueprint.public === true) && (!blueprint.sections || blueprint.sections.length < 3)) {
    throw new Error(`${fileName}: public pages require at least 3 sections for depth and authority`)
  }

  const description = String(blueprint.description || '').trim()
  if (description.length < 80 || description.length > 180) {
    throw new Error(`${fileName}: description should be 80-180 characters for SEO quality`)
  }

  const blockedPublicTerms = ['command center', 'admin', 'internal only', 'confidential']
  const bodyText = `${blueprint.title || ''} ${blueprint.description || ''} ${blueprint.intro || ''}`.toLowerCase()

  if (blueprint.public === true && blockedPublicTerms.some((term) => bodyText.includes(term))) {
    throw new Error(`${fileName}: public page contains internal-only language`)
  }

  const hasThinSection = (blueprint.sections || []).some((section) => String(section?.body || '').trim().length < 80)
  if (blueprint.public === true && hasThinSection) {
    throw new Error(`${fileName}: each public section body should be at least 80 characters`)
  }
}

function escapeSingleQuotes(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function pageComponentSource(page) {
  const sections = (page.sections || []).map((section) => ({
    heading: escapeSingleQuotes(section.heading || ''),
    body: escapeSingleQuotes(section.body || ''),
  }))

  const title = escapeSingleQuotes(page.title)
  const description = escapeSingleQuotes(page.description)
  const h1 = escapeSingleQuotes(page.h1 || page.title)
  const intro = escapeSingleQuotes(page.intro || page.description)
  const canonicalPath = page.path
  const ctaText = escapeSingleQuotes(page.ctaText || 'Request a Consultation')
  const ctaHref = escapeSingleQuotes(page.ctaHref || '/#quote')
  const domainUrl = page.domain || process.env.VITE_URL || 'https://www.jwordenasphaltpaving.com'

  return `import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'

const PAGE_SECTIONS = ${JSON.stringify(sections, null, 2)}

export default function ${page.componentName}() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '${title}',
    description: '${description}',
    url: '${domainUrl}${canonicalPath}',
  }

  // Liquid Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 }
    }
  }
  
  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring", stiffness: 100, damping: 20 }
    }
  }

  return (
    <div className="min-h-screen bg-background font-body relative overflow-hidden">
      {/* High-end ambient background mesh */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[50vh] bg-primary/5 blur-[120px] pointer-events-none" />

      <SEO
        title={'${title}'}
        description={'${description}'}
        canonicalPath={'${canonicalPath}'}
        jsonLd={jsonLd}
      />
      <Navbar />

      <motion.section 
        className="relative pt-40 pb-20 md:pb-32 overflow-hidden z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="max-w-5xl mx-auto px-6 lg:px-8 text-center md:text-left">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-display tracking-[0.2em] uppercase mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI SYNDICATE
          </motion.div>
          <h1 className="font-display font-black text-foreground text-5xl md:text-7xl lg:text-8xl uppercase tracking-tight leading-[0.9] flex flex-col gap-2">
            ${h1}
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl mt-8 max-w-3xl leading-relaxed">
            ${intro}
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-4 justify-center md:justify-start">
            <Link
              to={'${ctaHref}'}
              className="group relative inline-flex items-center justify-center px-8 py-5 font-display font-bold text-sm tracking-[0.2em] uppercase text-primary-foreground bg-primary overflow-hidden transition-all hover:scale-[1.02] active:scale-95"
            >
              <span className="absolute inset-0 w-full h-full -mt-1 opacity-20 bg-gradient-to-b from-transparent via-transparent to-black" />
              <span className="relative flex items-center gap-2">
                ${ctaText}
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </span>
            </Link>
          </div>
        </div>
      </motion.section>

      <section className="py-20 md:py-32 relative z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-5xl mx-auto px-6 lg:px-8 space-y-8"
        >
          {PAGE_SECTIONS.map((section, index) => (
            <motion.article 
              key={section.heading} 
              variants={itemVariants}
              className="group relative bg-card/60 backdrop-blur-xl border border-border/50 p-8 md:p-12 hover:bg-card hover:border-primary/30 transition-all overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/0 group-hover:bg-primary transition-colors duration-500" />
              <div className="flex flex-col md:flex-row items-start gap-6 md:gap-10">
                <span className="font-display text-5xl md:text-6xl text-primary/10 group-hover:text-primary/20 transition-colors font-black hidden md:block">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="font-display font-black text-foreground text-2xl md:text-4xl uppercase tracking-tight mb-4">
                    {section.heading}
                  </h2>
                  <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                    {section.body}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}
`
}

function registrySource(pages) {
  const imports = pages
    .map((page) => `const ${page.componentName} = lazy(() => import('@/pages/ai/${page.componentName}'))`)
    .join('\n')

  const publicPages = pages
    .filter((page) => page.public)
    .map((page) => `  { path: '${page.path}', Component: ${page.componentName} },`)
    .join('\n')

  const internalPages = pages
    .filter((page) => !page.public)
    .map((page) => `  { path: '${page.path}', Component: ${page.componentName} },`)
    .join('\n')

  return `import { lazy } from 'react'

// Auto-generated by scripts/ai-page-factory.mjs
// Do not edit manually.

${imports || '// No generated pages yet.'}

export const publicAIPages = [
${publicPages}
]

export const internalAIPages = [
${internalPages}
]
`
}

function sitemapEntries(pages, existingLocs) {
  const now = new Date().toISOString().slice(0, 10)
  return pages
    .filter((page) => page.public && page.includeInSitemap)
    .filter((page) => {
      const domain = page.domain || process.env.VITE_URL || 'https://www.jwordenasphaltpaving.com'
      const loc = `${domain}${page.path}`
      return !existingLocs.has(loc)
    })
    .map(
      (page) => `  <url>\n    <loc>${page.domain || process.env.VITE_URL || 'https://www.jwordenasphaltpaving.com'}${page.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`
    )
    .join('\n')
}

async function updateSitemap(pages) {
  const raw = await fs.readFile(SITEMAP_FILE, 'utf8')
  
  // Extract locs that exist outside of the AI page factory block to prevent duplicates
  const outsideXml = raw.includes(BLOCK_START) && raw.includes(BLOCK_END)
    ? raw.replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`), '')
    : raw
  const existingLocs = new Set([...outsideXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()))

  const block = [BLOCK_START, sitemapEntries(pages, existingLocs), BLOCK_END].filter(Boolean).join('\n')

  const hasMarkers = raw.includes(BLOCK_START) && raw.includes(BLOCK_END)
  let updated

  if (hasMarkers) {
    updated = raw.replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`), block)
  } else {
    updated = raw.replace('</urlset>', `${block}\n\n</urlset>`)
  }

  await fs.writeFile(SITEMAP_FILE, updated, 'utf8')

  // Update sitemap.txt mirror in perfect sync
  const locs = [...updated.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  const txtContent = locs.join('\n') + '\n'
  const txtFile = SITEMAP_FILE.replace(/\.xml$/, '.txt')
  await fs.writeFile(txtFile, txtContent, 'utf8')
  console.log(`[ai-page-factory] sitemap.xml and sitemap.txt updated and synchronized.`)
}

async function ensureDirs() {
  await fs.mkdir(BLUEPRINT_DIR, { recursive: true })
  await fs.mkdir(PAGE_DIR, { recursive: true })
  await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true })
}

async function loadBlueprints(tenantSlug) {
  let baseDomain = process.env.VITE_URL || 'https://www.jwordenasphaltpaving.com'
  if (tenantSlug) {
    try {
      const siteBpPath = path.join(ROOT, 'site-blueprints', `${tenantSlug}.json`)
      const siteBpRaw = await fs.readFile(siteBpPath, 'utf8')
      const siteBp = JSON.parse(siteBpRaw)
      if (siteBp.domain) baseDomain = siteBp.domain
    } catch (e) {}
  }

  const entries = await fs.readdir(BLUEPRINT_DIR, { withFileTypes: true })
  let files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))

  if (tenantSlug) {
    files = files.filter(f => f.name === `${tenantSlug}.json` || f.name.startsWith(`${tenantSlug}-`))
  }

  const pages = []

  for (const file of files) {
    const filePath = path.join(BLUEPRINT_DIR, file.name)
    const raw = await fs.readFile(filePath, 'utf8')
    const blueprint = JSON.parse(raw)

    if (blueprint.enabled === false) continue

    assertBlueprint(blueprint, file.name)
    assertPremiumQuality(blueprint, file.name)

    const pagePath = normalizePath(blueprint.slug)
    const componentName = `${slugToPascal(pagePath)}AIPage`

    pages.push({
      ...blueprint,
      path: pagePath,
      componentName,
      domain: baseDomain,
      public: blueprint.public === true,
      includeInSitemap: blueprint.includeInSitemap !== false,
      changefreq: blueprint.changefreq || 'monthly',
      priority: blueprint.priority || '0.6',
    })
  }

  const seen = new Set()
  for (const page of pages) {
    if (seen.has(page.path)) {
      throw new Error(`Duplicate generated page path: ${page.path}`)
    }
    seen.add(page.path)
  }

  return pages
}

async function writePages(pages) {
  for (const page of pages) {
    const filePath = path.join(PAGE_DIR, `${page.componentName}.jsx`)
    await fs.writeFile(filePath, pageComponentSource(page), 'utf8')
  }
}

async function run() {
  await ensureDirs()
  const tenantSlugArg = process.argv[2]
  
  if (tenantSlugArg) {
    console.log(`Generating AI Pages for tenant: ${tenantSlugArg}`)
  }

  const pages = await loadBlueprints(tenantSlugArg)
  await writePages(pages)
  await fs.writeFile(REGISTRY_FILE, registrySource(pages), 'utf8')
  await updateSitemap(pages)

  console.log(`AI Page Factory complete: generated ${pages.length} page(s).`)
}

run().catch((error) => {
  console.error('AI Page Factory failed:', error)
  process.exitCode = 1
})
