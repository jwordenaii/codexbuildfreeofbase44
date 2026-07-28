import { promises as fs, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BLUEPRINT_DIR = path.join(ROOT, 'site-blueprints')
const BLOG_DIR = path.join(ROOT, 'src', 'pages', 'generated-blogs')
const REGISTRY_FILE = path.join(ROOT, 'src', 'generated', 'aiBlogRegistry.jsx')
const SITEMAP_FILE = path.join(ROOT, 'public', 'sitemap.xml')

const BLOCK_START = '  <!-- AI_BLOG_FACTORY:START -->'
const BLOCK_END = '  <!-- AI_BLOG_FACTORY:END -->'

function kebabCase(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
}

function pascalCase(str) {
  return kebabCase(str)
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function escapeSingleQuotes(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function blogComponentSource(keyword, blueprint) {
  const title = `Ultimate Guide to ${keyword.replace(/(^\w|\s\w)/g, m => m.toUpperCase())}`
  const description = `Learn everything you need to know about ${keyword} for your commercial properties. Expert insights from ${blueprint.brandName}.`
  const slug = kebabCase(keyword)
  const canonicalPath = `/blog/info/${slug}`
  const componentName = `${pascalCase(keyword)}Blog`
  const domainUrl = blueprint.domain || process.env.VITE_URL || 'https://www.jwordenasphaltpaving.com'

  return `import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SEO from '@/components/SEO'
import { Calendar, Clock, ArrowRight, ArrowLeft } from 'lucide-react'

export default function ${componentName}() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: '${escapeSingleQuotes(title)}',
    description: '${escapeSingleQuotes(description)}',
    author: {
      '@type': 'Organization',
      name: '${escapeSingleQuotes(blueprint.brandName)}'
    },
    url: '${domainUrl}${canonicalPath}',
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <SEO
        title={'${escapeSingleQuotes(title)} - ${escapeSingleQuotes(blueprint.brandName)}'}
        description={'${escapeSingleQuotes(description)}'}
        canonicalPath={'${canonicalPath}'}
        jsonLd={jsonLd}
      />
      <Navbar />

      <article className="pt-32 pb-16 md:pb-20 max-w-4xl mx-auto px-6 lg:px-8">
        <header className="mb-12 border-b border-border pb-10">
          <Link to="/blog" className="inline-flex items-center text-sm font-display uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Articles
          </Link>
          <div className="flex items-center gap-4 text-xs font-display tracking-widest text-muted-foreground uppercase mb-6">
            <span className="text-primary font-bold">Insights</span>
            <span>•</span>
            <div className="flex items-center"><Calendar className="w-3 h-3 mr-1.5" /> Programmatic SEO Post</div>
            <span>•</span>
            <div className="flex items-center"><Clock className="w-3 h-3 mr-1.5" /> 4 min read</div>
          </div>
          <h1 className="font-display font-black text-foreground text-4xl md:text-5xl uppercase tracking-tight leading-[0.95] mb-6">
            ${escapeSingleQuotes(title)}
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
            ${escapeSingleQuotes(description)}
          </p>
        </header>

        <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed space-y-6">
          <p>
            When it comes to <strong>${escapeSingleQuotes(keyword)}</strong>, understanding the foundational 
            aspects of ${escapeSingleQuotes(blueprint.market)} is essential for commercial property owners and managers. 
            At ${escapeSingleQuotes(blueprint.brandName)}, our core focus is delivering ${escapeSingleQuotes(blueprint.coreOffer)}.
          </p>
          
          <h2 className="font-display text-2xl text-foreground uppercase tracking-wide mt-10 mb-4 font-black">
            The Importance of ${escapeSingleQuotes(keyword)}
          </h2>
          <p>
            Implementing a sound ${escapeSingleQuotes(blueprint.contentPillars[0])} ensures you minimize lifelong 
            risks and mitigate recurring costs. As a premium contractor serving regions like ${escapeSingleQuotes(blueprint.regions.join(', '))}, 
            we recognize that each site requires tailored focus.
          </p>

          <h3 className="font-display text-xl text-foreground uppercase mt-8 mb-3 font-bold">
            Key Diagnostic Approaches
          </h3>
          <p>
            Whether the issue stems from foundational fatigue or surface-level weathering, leveraging strategies in 
            ${escapeSingleQuotes(blueprint.contentPillars[1] || 'drainage analysis')} makes a verifiable difference in longevity. 
            By addressing ${escapeSingleQuotes(keyword)} correctly the first time, our clients consistently avoid 
            catastrophic failures.
          </p>

          <div className="bg-card border border-border p-8 my-10 rounded-sm">
            <h4 className="font-display text-lg text-primary uppercase font-bold mb-2">Ready to Upgrade Your Infrastructure?</h4>
            <p className="mb-6 text-sm">Join top-tier facility managers who have already maximized their property uptime and lowered maintenance intervals.</p>
            <Link to="/quote" className="premium-cta inline-flex items-center gap-2 px-6 py-3 font-display font-bold text-xs tracking-[0.14em] uppercase text-primary-foreground">
              ${escapeSingleQuotes(blueprint.conversionModel.primaryCTA)} <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </article>

      <Footer />
    </div>
  )
}
`
}

function registrySource(blogPages) {
  const imports = blogPages
    .map(page => `const ${page.componentName} = lazy(() => import('@/pages/generated-blogs/${page.componentName}'))`)
    .join('\n')

  const routes = blogPages
    .map(page => `  { path: '${page.path}', Component: ${page.componentName} },`)
    .join('\n')

  return `import { lazy } from 'react'

// Auto-generated by scripts/ai-blog-factory.mjs

${imports || '// No generated blogs yet.'}

export const aiBlogRegistry = [
${routes}
]
`
}

function sitemapEntries(blogPages) {
  const now = new Date().toISOString().slice(0, 10)
  return blogPages
    .map(
      page => `  <url>\n    <loc>${page.domain || 'https://www.jwordenasphaltpaving.com'}${page.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
    )
    .join('\n')
}

async function updateSitemap(blogPages) {
  const raw = await fs.readFile(SITEMAP_FILE, 'utf8')
  const block = [BLOCK_START, sitemapEntries(blogPages), BLOCK_END].filter(Boolean).join('\n')

  const hasMarkers = raw.includes(BLOCK_START) && raw.includes(BLOCK_END)
  let updated

  if (hasMarkers) {
    updated = raw.replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`), block)
  } else {
    updated = raw.replace('</urlset>', `${block}\n\n</urlset>`)
  }

  await fs.writeFile(SITEMAP_FILE, updated, 'utf8')
}

async function processTenant(slug) {
  const bpPath = path.join(BLUEPRINT_DIR, `${slug}.json`)
  if (!existsSync(bpPath)) {
    throw new Error(`Blueprint ${slug}.json not found`)
  }
  
  const raw = await fs.readFile(bpPath, 'utf-8')
  const blueprint = JSON.parse(raw)

  const keywords = blueprint.targetKeywords || []
  if (!keywords.length) {
    console.log(`No targetKeywords found in ${slug}.json`)
    return []
  }

  const generatedPages = []
  const domainUrl = blueprint.domain || process.env.VITE_URL || 'https://www.jwordenasphaltpaving.com'
  
  for (const kw of keywords) {
    const componentName = `${pascalCase(kw)}Blog`
    const urlPath = `/blog/info/${kebabCase(kw)}`
    
    const source = blogComponentSource(kw, blueprint)
    await fs.writeFile(path.join(BLOG_DIR, `${componentName}.jsx`), source, 'utf-8')
    
    generatedPages.push({
      keyword: kw,
      componentName,
      path: urlPath,
      domain: domainUrl
    })
  }

  return generatedPages
}

async function run() {
  await fs.mkdir(BLOG_DIR, { recursive: true })
  
  // Automatically scoop all blueprints or just a specific one passed via ARGV
  const tenantSlugArg = process.argv[2]
  
  let pages = []
  if (tenantSlugArg) {
    console.log(`Generating SEO Blogs for tenant: ${tenantSlugArg}`)
    pages = await processTenant(tenantSlugArg)
  } else {
    const entries = await fs.readdir(BLUEPRINT_DIR, { withFileTypes: true })
    const files = entries.filter((e) => e.isFile() && e.name.endsWith('.json'))
    for (const f of files) {
      console.log(`Generating SEO Blogs for ${f.name}...`)
      const result = await processTenant(f.name.replace('.json', ''))
      pages = pages.concat(result)
    }
  }

  await fs.writeFile(REGISTRY_FILE, registrySource(pages), 'utf8')
  await updateSitemap(pages)

  console.log(`AI Blog Factory Complete: ${pages.length} Keyword Posts Generated.`)
}

run().catch((err) => {
  console.error("AI Blog Factory Fatal:", err)
  process.exitCode = 1
})