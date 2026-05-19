/**
 * create-standalone-site-repo.mjs
 *
 * Scaffolds a complete, self-contained React + Vite market-landing site as its
 * own git repository.  The generated repo has no dependency on the monorepo —
 * it can be pushed to a new GitHub remote and deployed on Netlify independently.
 *
 * Usage:
 *   node scripts/create-standalone-site-repo.mjs \
 *     --site-key=texas \
 *     --domain=texasasphaltpaving.com \
 *     --label="Texas Asphalt Paving" \
 *     --brand="Texas Asphalt Paving" \
 *     --city=Dallas \
 *     --region=Texas \
 *     [--metro="Dallas-Fort Worth"] \
 *     [--phone=8044461296] \
 *     [--hero-headline="Custom Headline"] \
 *     [--hero-body="Custom body copy"] \
 *     [--primary-color=#13283a] \
 *     [--accent-color=#f0b429] \
 *     [--api-base-url=https://api.example.com] \
 *     [--ga-id=G-XXXXXXXXXX] \
 *     [--out-dir=../sites/texas] \
 *     [--dry-run=true]
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')

// ─────────────────────────────────────────────────────────────────────────────
// Arg parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {}
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue
    const [key, ...rest] = raw.slice(2).split('=')
    args[key] = rest.join('=').trim()
  }
  return args
}

function requireArg(args, key) {
  const v = String(args[key] || '').trim()
  if (!v) throw new Error(`Missing required argument: --${key}=...`)
  return v
}

function optArg(args, key, fallback = '') {
  return String(args[key] ?? fallback).trim()
}

function normalizeDomain(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.+$/, '')
}

function toKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function ensureHex(value, fallback) {
  const c = String(value || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback
}

// Convert hex #rrggbb → "h s% l%" string suitable for CSS HSL variables.
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

// ─────────────────────────────────────────────────────────────────────────────
// File templates
// ─────────────────────────────────────────────────────────────────────────────

function renderPackageJson(siteKey, label) {
  return JSON.stringify(
    {
      name: `${toKey(siteKey)}-market-site`,
      description: `${label} — standalone market-landing site`,
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        lint: 'eslint . --quiet',
      },
      dependencies: {
        'lucide-react': '^0.468.0',
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@tailwindcss/typography': '^0.5.15',
        '@vitejs/plugin-react': '^4.3.4',
        autoprefixer: '^10.4.20',
        eslint: '^9.21.0',
        postcss: '^8.5.1',
        tailwindcss: '^3.4.17',
        'tailwindcss-animate': '^1.0.7',
        vite: '^6.0.11',
      },
    },
    null,
    2
  ) + '\n'
}

function renderViteConfig() {
  return `import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
`
}

function renderTailwindConfig() {
  return `import animate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Bebas Neue', 'sans-serif'],
        body: ['var(--font-body)', 'Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        border: 'hsl(var(--border))',
      },
    },
  },
  plugins: [animate, typography],
}
`
}

function renderPostcssConfig() {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`
}

function renderIndexCss(primaryHsl, accentHsl) {
  return `/* Google Fonts loaded via <link> in index.html */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --font-display: 'Bebas Neue', sans-serif;
    --font-body: 'Plus Jakarta Sans', sans-serif;
    --radius: 0.5rem;

    --background: 0 0% 100%;
    --foreground: 0 0% 10%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 10%;
    --primary: ${primaryHsl};
    --primary-foreground: 0 0% 8%;
    --muted: 30 12% 93%;
    --muted-foreground: 0 0% 35%;
    --accent: ${accentHsl};
    --accent-foreground: 0 0% 100%;
    --border: 24 18% 84%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    background-color: #ffffff;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
  h1, h2, h3, h4, h5, h6 { font-family: 'Bebas Neue', sans-serif; }
}

.premium-panel {
  @apply relative overflow-hidden rounded-lg border border-border bg-card
    shadow-[0_20px_50px_-36px_rgba(17,24,39,0.36)]
    transition-all duration-300 hover:border-accent/55;
}

.premium-cta {
  @apply relative overflow-hidden rounded-md bg-primary px-10 py-5
    font-display text-sm tracking-[0.16em] uppercase text-primary-foreground
    shadow-[0_16px_32px_-22px_rgba(17,24,39,0.8)]
    transition-all duration-300 hover:bg-accent active:scale-[0.98];
}

.premium-cta::after {
  content: '';
  @apply absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
    -translate-x-full transition-transform duration-1000 ease-in-out;
}

.premium-cta:hover::after { @apply translate-x-full; }
`
}

function renderIndexHtml(label, domain, canonicalUrl, primaryColor, geo, gaId) {
  const geoRegion = geo.region || 'US-VA'
  const geoPlacename = geo.placename || 'Chester, Virginia'
  const geoPosition = geo.position || '37.3563;-77.4411'
  const geoIcbm = geo.icbm || '37.3563, -77.4411'
  const gaScript = gaId
    ? `
    <!-- Google tag (gtag.js) -->
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', '${gaId}');
      (function(){
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=${gaId}';
        document.head.appendChild(s);
      })();
    </script>`
    : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />
${gaScript}
    <title>${label} | Verified Asphalt Paving</title>
    <link rel="canonical" href="${canonicalUrl}/" />
    <meta name="description" content="${label} — commercial lots and residential drives with verified job photos, clear scope, and practical scheduling." />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="${primaryColor}" />

    <meta name="geo.region" content="${geoRegion}" />
    <meta name="geo.placename" content="${geoPlacename}" />
    <meta name="geo.position" content="${geoPosition}" />
    <meta name="ICBM" content="${geoIcbm}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${label}" />
    <meta property="og:title" content="${label} | Verified Asphalt Paving" />
    <meta property="og:description" content="${label} — commercial lots and residential drives with verified job photos, clear scope, and practical scheduling." />
    <meta property="og:url" content="${canonicalUrl}/" />
    <meta property="og:image" content="/og-default.jpg" />
    <meta property="og:locale" content="en_US" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${label} | Verified Asphalt Paving" />
    <meta name="twitter:description" content="${label} — commercial lots and residential drives with verified job photos." />
    <meta name="twitter:image" content="/og-default.jpg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`
}

function renderNetlifyToml(domain) {
  return `[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
`
}

function renderGitignore() {
  return `# dependencies
node_modules/

# build output
dist/

# env files
.env
.env.local
.env.production

# editor
.DS_Store
*.local
`
}

function renderEnvExample(canonicalUrl, apiBaseUrl, gaId) {
  return `# Required: URL of the shared backend API
VITE_API_BASE_URL=${apiBaseUrl || 'https://api.jwordenasphaltpaving.com'}

# Optional: canonical site URL (used for SEO)
VITE_CANONICAL_URL=${canonicalUrl}

# Optional: Google Analytics 4 measurement ID
VITE_GA_ID=${gaId || ''}
`
}

function renderSiteConfig(profile) {
  return `/**
 * siteConfig.js — baked-in site configuration for this standalone market site.
 * Edit this file to update branding, copy, and geo metadata.
 */

export const SITE_CONFIG = ${JSON.stringify(profile, null, 2)}
`
}

function renderMainJsx() {
  return `import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`
}

function renderAppJsx() {
  return `import MarketLanding from './pages/MarketLanding.jsx'

export default function App() {
  return <MarketLanding />
}
`
}

function renderSeoComponent() {
  return `import { useEffect } from 'react'
import { SITE_CONFIG } from '../config/siteConfig.js'

/**
 * SEO — manages document head: title, description, canonical, OG, Twitter,
 * robots, geo meta, and JSON-LD structured data.
 */
export default function SEO({
  title,
  description,
  canonicalPath = '/',
  ogImage = '/og-default.jpg',
  ogType = 'website',
  jsonLd,
  noindex = false,
  geo,
}) {
  useEffect(() => {
    if (title) document.title = title

    const setMeta = (selector, attr, value) => {
      if (value === undefined || value === null || value === '') return
      let el = document.head.querySelector(selector)
      if (!el) {
        el = document.createElement('meta')
        const [, key, val] = selector.match(/\\[(.+?)="(.+?)"\\]/) || []
        if (key && val) el.setAttribute(key, val)
        document.head.appendChild(el)
      }
      el.setAttribute(attr, value)
    }

    const rawPath = canonicalPath || '/'
    const normalizedPath = rawPath !== '/' ? rawPath.replace(/\\/+$/, '') : '/'
    const canonicalBase = SITE_CONFIG.canonicalUrl.replace(/\\/$/, '')
    const canonicalUrl = \`\${canonicalBase}\${normalizedPath === '/' ? '' : normalizedPath}\`
    const siteName = SITE_CONFIG.label

    setMeta('meta[name="description"]', 'content', description)
    setMeta(
      'meta[name="robots"]',
      'content',
      noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    )

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', canonicalUrl)

    setMeta('meta[property="og:title"]', 'content', title || '')
    setMeta('meta[property="og:description"]', 'content', description || '')
    setMeta('meta[property="og:url"]', 'content', canonicalUrl)
    setMeta('meta[property="og:image"]', 'content', ogImage)
    setMeta('meta[property="og:image:width"]', 'content', '1200')
    setMeta('meta[property="og:image:height"]', 'content', '630')
    setMeta('meta[property="og:type"]', 'content', ogType)
    setMeta('meta[property="og:site_name"]', 'content', siteName)

    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', 'content', title || '')
    setMeta('meta[name="twitter:description"]', 'content', description || '')
    setMeta('meta[name="twitter:image"]', 'content', ogImage)

    const geoDefaults = SITE_CONFIG.market?.geo || {}
    const geoMeta = { ...geoDefaults, ...(geo || {}) }
    if (geoMeta.region) setMeta('meta[name="geo.region"]', 'content', geoMeta.region)
    if (geoMeta.placename) setMeta('meta[name="geo.placename"]', 'content', geoMeta.placename)
    if (geoMeta.position) setMeta('meta[name="geo.position"]', 'content', geoMeta.position)
    if (geoMeta.icbm) setMeta('meta[name="ICBM"]', 'content', geoMeta.icbm)

    const existingLd = document.head.querySelector('script[data-seo-jsonld="true"]')
    if (existingLd) existingLd.remove()
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-seo-jsonld', 'true')
      script.text = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
  }, [title, description, canonicalPath, ogImage, ogType, jsonLd, noindex, geo])

  return null
}
`
}

function renderMarketLanding() {
  return `import React from 'react'
import { ArrowRight, CheckCircle2, Phone, ShieldCheck, Snowflake } from 'lucide-react'
import SEO from '../components/SEO.jsx'
import { SITE_CONFIG } from '../config/siteConfig.js'

const DELIVERY_STANDARDS = [
  'Scope and sequencing defined before mobilization',
  'Compaction and lift planning matched to traffic load',
  'Cold-weather protocols for shoulder-season paving',
  'Photo-verified closeout package for every project',
]

const SERVICE_MIX = [
  'Commercial parking lots and retail access lanes',
  'Drive-thru and franchise remodel paving scopes',
  'Private driveways and long-lane resurfacing',
  'Repair, overlay, and preservation planning',
]

const PROOF_IMAGES = [
  {
    id: 'portfolio-010',
    src: '/work/portfolio-010.jpg',
    title: 'Large-lot resurfacing sequence',
    body: 'Production workflow with documented prep, lift placement, and final finish checks.',
  },
  {
    id: 'portfolio-019',
    src: '/work/portfolio-019.jpg',
    title: 'Drive lane and apron restoration',
    body: 'High-traffic entry lanes restored with practical scheduling and clean turnover.',
  },
  {
    id: 'portfolio-030',
    src: '/work/portfolio-030.jpg',
    title: 'Commercial lot reimage',
    body: 'Surface renewal and layout prep to support tenant traffic and curb-appeal upgrades.',
  },
]

function toTelHref(phoneDisplay) {
  const digits = String(phoneDisplay || '').replace(/\\D/g, '')
  if (!digits) return 'tel:+18044461296'
  return digits.startsWith('1') ? \`tel:+\${digits}\` : \`tel:+1\${digits}\`
}

function trackPhoneClick(location) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'phone_click', { event_label: location })
  }
}

export default function MarketLanding() {
  const market = SITE_CONFIG.market || {}
  const phoneDisplay = market.phoneDisplay || '804-446-1296'
  const phoneHref = toTelHref(phoneDisplay)

  const title = \`\${market.marketName} | Verified Asphalt Paving\`
  const description = \`\${market.marketName} serving \${market.primaryRegion}. Verified job photos, clear scope, and asphalt work built for local weather cycles.\`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        name: market.marketName,
        areaServed: {
          '@type': 'AdministrativeArea',
          name: market.primaryRegion,
        },
        telephone: \`+1\${String(phoneDisplay).replace(/\\D/g, '')}\`,
        url: SITE_CONFIG.canonicalUrl,
      },
      {
        '@type': 'Service',
        name: \`\${market.marketName} Asphalt Services\`,
        provider: {
          '@type': 'Organization',
          name: market.marketName,
          url: SITE_CONFIG.canonicalUrl,
        },
        areaServed: {
          '@type': 'AdministrativeArea',
          name: market.primaryRegion,
        },
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <SEO title={title} description={description} canonicalPath="/" geo={market.geo} jsonLd={jsonLd} />

      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-primary">
              {market.primaryRegion} Asphalt Paving
            </p>
            <p className="font-display text-lg uppercase leading-none">{market.marketName}</p>
          </div>
          <a
            href={phoneHref}
            onClick={() => trackPhoneClick('market_landing_header')}
            className="premium-cta inline-flex items-center gap-2 px-4 py-3 text-xs font-display font-bold uppercase tracking-[0.14em] text-primary-foreground"
          >
            <Phone className="w-4 h-4" />
            {phoneDisplay}
          </a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(15,76,129,0.12),transparent_50%),radial-gradient(circle_at_90%_90%,rgba(249,115,22,0.15),transparent_45%)]" />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-24">
            <p className="font-display text-primary text-xs tracking-[0.24em] uppercase mb-4">
              {market.heroKicker}
            </p>
            <h1 className="font-display text-4xl md:text-6xl uppercase tracking-tight leading-[0.94] max-w-5xl">
              {market.heroHeadline}
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-3xl leading-relaxed">
              {market.heroBody}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={phoneHref}
                onClick={() => trackPhoneClick('market_landing_hero')}
                className="premium-cta inline-flex items-center gap-2 px-6 py-4 text-sm font-display font-bold uppercase tracking-[0.14em] text-primary-foreground"
              >
                <Phone className="w-4 h-4" />
                {market.ctaLabel}
              </a>
              <a
                href="#proof"
                className="inline-flex items-center gap-2 px-6 py-4 border border-primary/40 text-primary text-sm font-display font-bold uppercase tracking-[0.14em] hover:bg-primary/10 transition-colors"
              >
                See Verified Photos
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Primary Region</p>
                <p className="font-display text-2xl uppercase mt-2">{market.primaryRegion}</p>
              </div>
              <div className="border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Core Metro</p>
                <p className="font-display text-2xl uppercase mt-2">{market.primaryMetro}</p>
              </div>
              <div className="border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operating Standard</p>
                <p className="font-display text-2xl uppercase mt-2">Verified Documentation</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 border-b border-border">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <p className="font-display text-primary text-xs tracking-[0.22em] uppercase mb-3">
                Delivery Standards
              </p>
              <div className="space-y-3">
                {DELIVERY_STANDARDS.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/90 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="premium-panel rounded-2xl p-6 md:p-8">
              <p className="font-display text-primary text-xs tracking-[0.22em] uppercase mb-3">
                Service Mix
              </p>
              <div className="space-y-3">
                {SERVICE_MIX.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <Snowflake className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/90 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Standalone site — independent deploy, own git repo.
              </div>
            </div>
          </div>
        </section>

        <section id="proof" className="py-14 md:py-18 border-b border-border">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <p className="font-display text-primary text-xs tracking-[0.24em] uppercase mb-2">
              {market.proofHeadline}
            </p>
            <h2 className="font-display text-3xl md:text-5xl uppercase tracking-tight leading-[0.95] mb-8">
              Field photos used for estimate confidence
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {PROOF_IMAGES.map((item) => (
                <article key={item.id} className="border border-border bg-card overflow-hidden">
                  <img
                    src={item.src}
                    alt={item.title}
                    width="900"
                    height="600"
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-[4/3] object-cover bg-muted"
                  />
                  <div className="p-5">
                    <h3 className="font-display text-xl uppercase tracking-tight">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-3">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 border border-border bg-card p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="font-display text-primary text-xs tracking-[0.22em] uppercase mb-1">
                  Ready to Start?
                </p>
                <p className="font-display text-2xl md:text-3xl uppercase tracking-tight">
                  Get A Free Estimate
                </p>
              </div>
              <a
                href={phoneHref}
                onClick={() => trackPhoneClick('market_landing_cta_bottom')}
                className="premium-cta inline-flex items-center gap-2 px-6 py-4 text-sm font-display font-bold uppercase tracking-[0.14em] text-primary-foreground shrink-0"
              >
                <Phone className="w-4 h-4" />
                {market.ctaLabel}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <p>{market.marketName}</p>
          <p>© {new Date().getFullYear()} {market.marketName}</p>
        </div>
      </footer>
    </div>
  )
}
`
}

function renderReadme(label, domain, siteKey, canonicalUrl, region, metro) {
  return `# ${label} — Standalone Market Site

Domain: [${canonicalUrl}](${canonicalUrl})
Region: ${region} | Metro: ${metro}

Generated by the [JWordenAI Website Factory](https://github.com/jworden/jworden-luxury-paving) using
\`node scripts/create-standalone-site-repo.mjs\`.

## Stack

| Layer | Tool |
|-------|------|
| UI | React 18 + Vite 6 |
| Styles | Tailwind CSS 3 |
| Deploy | Netlify |

## Development

\`\`\`bash
npm install
cp .env.example .env.local   # fill in VITE_API_BASE_URL
npm run dev
\`\`\`

## Build & Deploy

\`\`\`bash
npm run build   # outputs to dist/
\`\`\`

Connect to Netlify:
1. Push this repo to GitHub
2. New site → Import from Git → select this repo
3. Build command: \`npm run build\`  |  Publish dir: \`dist\`
4. Add environment variables from \`.env.example\`

## Customization

All site copy, colors, and geo metadata live in \`src/config/siteConfig.js\`.
Edit that file to update:
- Hero headline / body / CTA label
- Phone number
- Primary and accent colors (hex values drive the CSS variables)
- JSON-LD LocalBusiness structured data

## Adding Portfolio Photos

Drop JPEG/WebP images into \`public/work/\`:
- \`public/work/portfolio-010.jpg\`
- \`public/work/portfolio-019.jpg\`
- \`public/work/portfolio-030.jpg\`

Update the \`PROOF_IMAGES\` array in \`src/pages/MarketLanding.jsx\` to change captions.

## API

Lead submissions point to the shared backend specified by \`VITE_API_BASE_URL\`.
Set this to your own API or the existing J. Worden backend.
`
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

try {
  const rawArgs = parseArgs(process.argv.slice(2))

  const siteKey = toKey(requireArg(rawArgs, 'site-key'))
  const domain = normalizeDomain(requireArg(rawArgs, 'domain'))
  const label = requireArg(rawArgs, 'label')
  const brand = optArg(rawArgs, 'brand', label)
  const city = requireArg(rawArgs, 'city')
  const region = requireArg(rawArgs, 'region')
  const metro = optArg(rawArgs, 'metro', city)
  const phone = optArg(rawArgs, 'phone', '804-446-1296')
  const heroHeadline = optArg(rawArgs, 'hero-headline', `${brand} Built For Local Conditions`)
  const heroBody = optArg(
    rawArgs,
    'hero-body',
    'Commercial lots and residential drives with documented prep, clear scope, and practical scheduling.'
  )
  const primaryColor = ensureHex(rawArgs['primary-color'], '#13283a')
  const accentColor = ensureHex(rawArgs['accent-color'], '#f0b429')
  const apiBaseUrl = optArg(rawArgs, 'api-base-url', 'https://api.jwordenasphaltpaving.com')
  const gaId = optArg(rawArgs, 'ga-id', '')
  const isDryRun = String(rawArgs['dry-run'] || 'false').toLowerCase() === 'true'

  const defaultOutDir = path.resolve(REPO_ROOT, '..', `${siteKey}-market-site`)
  const outDir = path.resolve(optArg(rawArgs, 'out-dir', defaultOutDir))

  const canonicalUrl = `https://www.${domain}`
  const primaryHsl = hexToHsl(primaryColor)
  const accentHsl = hexToHsl(accentColor)

  const geoRegionCode = `US-${region.slice(0, 2).toUpperCase()}`
  const geo = {
    region: optArg(rawArgs, 'geo-region', geoRegionCode),
    placename: optArg(rawArgs, 'geo-placename', `${city}, ${region}`),
    position: optArg(rawArgs, 'geo-position', '37.3563;-77.4411'),
    icbm: optArg(rawArgs, 'geo-icbm', '37.3563, -77.4411'),
  }

  const siteProfile = {
    key: siteKey,
    label,
    canonicalUrl,
    primaryColor,
    accentColor,
    market: {
      marketName: brand,
      primaryRegion: region,
      primaryMetro: metro,
      heroKicker: 'Verified Job Photos',
      heroHeadline,
      heroBody,
      ctaLabel: `Call For ${region} Estimate`,
      phoneDisplay: phone,
      proofHeadline: 'Recent Verified Work',
      geo,
    },
  }

  if (isDryRun) {
    console.log('create-standalone-site-repo — dry run preview:')
    console.log(`  site-key      : ${siteKey}`)
    console.log(`  domain        : ${domain}`)
    console.log(`  label         : ${label}`)
    console.log(`  brand         : ${brand}`)
    console.log(`  region        : ${region}`)
    console.log(`  metro         : ${metro}`)
    console.log(`  primaryColor  : ${primaryColor}  → hsl(${primaryHsl})`)
    console.log(`  accentColor   : ${accentColor}  → hsl(${accentHsl})`)
    console.log(`  output dir    : ${outDir}`)
    process.exit(0)
  }

  if (fs.existsSync(outDir)) {
    throw new Error(`Output directory already exists: ${outDir}\nRemove it first or use a different --out-dir.`)
  }

  // ── Scaffold directory tree ──────────────────────────────────────────────

  const dirs = [
    outDir,
    path.join(outDir, 'src'),
    path.join(outDir, 'src', 'config'),
    path.join(outDir, 'src', 'components'),
    path.join(outDir, 'src', 'pages'),
    path.join(outDir, 'public'),
    path.join(outDir, 'public', 'work'),
  ]
  for (const d of dirs) fs.mkdirSync(d, { recursive: true })

  const write = (relPath, content) => {
    fs.writeFileSync(path.join(outDir, relPath), content)
    console.log(`  created  ${relPath}`)
  }

  console.log(`\nScaffolding standalone repo → ${outDir}\n`)

  write('package.json', renderPackageJson(siteKey, label))
  write('vite.config.js', renderViteConfig())
  write('tailwind.config.js', renderTailwindConfig())
  write('postcss.config.js', renderPostcssConfig())
  write('index.html', renderIndexHtml(label, domain, canonicalUrl, primaryColor, geo, gaId))
  write('netlify.toml', renderNetlifyToml(domain))
  write('.gitignore', renderGitignore())
  write('.env.example', renderEnvExample(canonicalUrl, apiBaseUrl, gaId))
  write('README.md', renderReadme(label, domain, siteKey, canonicalUrl, region, metro))
  write('src/index.css', renderIndexCss(primaryHsl, accentHsl))
  write('src/main.jsx', renderMainJsx())
  write('src/App.jsx', renderAppJsx())
  write('src/config/siteConfig.js', renderSiteConfig(siteProfile))
  write('src/components/SEO.jsx', renderSeoComponent())
  write('src/pages/MarketLanding.jsx', renderMarketLanding())

  // Placeholder OG image note (real projects should add actual images)
  write(
    'public/og-default.jpg.placeholder',
    'Replace this placeholder with a real og-default.jpg (1200×630) for social sharing.\n'
  )
  write(
    'public/work/README.md',
    '# Portfolio Photos\n\nAdd your job photos here:\n- portfolio-010.jpg\n- portfolio-019.jpg\n- portfolio-030.jpg\n\nRecommended size: 900×600px JPEG.\n'
  )

  // ── git init + initial commit ─────────────────────────────────────────────

  console.log('\nInitializing git repository...')
  execSync('git init', { cwd: outDir, stdio: 'inherit' })
  execSync('git add -A', { cwd: outDir, stdio: 'inherit' })
  execSync(`git commit -m "init: scaffold ${label} standalone market site"`, {
    cwd: outDir,
    stdio: 'inherit',
  })

  console.log('\n✓ Standalone repo created successfully.')
  console.log(`\nLocation: ${outDir}`)
  console.log('\nNext steps:')
  console.log(`  1. cd "${outDir}"`)
  console.log('  2. npm install')
  console.log('  3. cp .env.example .env.local  # set VITE_API_BASE_URL')
  console.log('  4. npm run dev')
  console.log('  5. Create a new GitHub repo, then:')
  console.log(`     git remote add origin https://github.com/YOUR_ORG/${siteKey}-market-site.git`)
  console.log('     git push -u origin main')
  console.log('  6. Connect to Netlify and deploy.')
} catch (err) {
  console.error(`create-standalone-site-repo failed: ${err.message}`)
  process.exit(1)
}
