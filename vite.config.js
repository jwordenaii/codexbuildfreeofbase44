import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'
import { STATE_PAGE_ROUTES, WORDEN_ACTIVE_STATES } from './src/lib/states50.js'

const DEFAULT_SITE_URL = 'https://jworden.netlify.app'

// City slugs for service area pages — keep in sync with src/data/serviceAreas.js
const CITY_SLUGS = [
  'chester-va', 'richmond-va', 'chesterfield-va', 'colonial-heights-va',
  'hopewell-va', 'petersburg-va', 'henrico-va', 'midlothian-va',
  'mechanicsville-va', 'glen-allen-va', 'ashland-va', 'powhatan-va',
  'prince-george-va', 'dinwiddie-va', 'fredericksburg-va', 'williamsburg-va',
  'suffolk-va', 'virginia-beach-va', 'norfolk-va', 'charlottesville-va',
]

// Blog slugs — keep in sync with src/data/blogPosts.js
const BLOG_SLUGS = [
  'how-long-does-asphalt-paving-last',
  'when-to-sealcoat-virginia-guide',
  'commercial-parking-lot-maintenance-guide',
  'asphalt-crack-types-guide',
  'kfc-franchise-paving-standards',
  'best-time-pave-driveway-virginia',
]

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = env.VITE_SITE_URL || process.env.URL || DEFAULT_SITE_URL
  const includeAllStatePages = env.VITE_INCLUDE_ALL_STATE_PAGES === 'true'
  const activeStateRoutes = STATE_PAGE_ROUTES.filter((state) => WORDEN_ACTIVE_STATES.includes(state.abbr))
  const stateRoutes = includeAllStatePages ? STATE_PAGE_ROUTES : activeStateRoutes

  return {
  plugins: [
    react(),
    sitemap({
      hostname: siteUrl,
      generateRobotsTxt: false,
      routes: [
        // Core pages
        '/',
        '/services',
        '/about',
        '/contact',
        '/quote',
        '/reviews',
        '/projects',
        // Service areas
         '/service-areas',
         ...CITY_SLUGS.map((s) => `/service-areas/${s}`),
         ...stateRoutes.map((state) => state.path),
        // Blog
        '/blog',
        ...BLOG_SLUGS.map((s) => `/blog/${s}`),
        // Advisory Board top-level
        '/advisory',
        '/advisory/utilities',
        '/advisory/compare',
        '/advisory/legal-strategy',
        '/advisory/contractor-ranker',
        // Category hubs
        '/advisory/licensing',
        '/advisory/construction-law',
        '/advisory/safety',
        '/advisory/contracts',
        '/advisory/prevailing-wage',
        '/advisory/environmental',
        '/advisory/building-codes',
        '/advisory/roads-paving',
        // JWORDENAI™ public tech + customer tools
        '/jwordenai',
        '/jwordenai/scan',
      ],
    }),
  ],
  // Provide an empty fallback so the %VITE_GA4_ID% HTML replacement
  // resolves without a build warning when the env var is not set.
  define: {
    'import.meta.env.VITE_GA4_ID': JSON.stringify(env.VITE_GA4_ID || ''),
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // ── AI / MediaPipe — heavy WASM-adjacent library ───────────
          if (id.includes('/@mediapipe/') || id.includes('/mediapipe/'))
            return 'vendor-ai'

          // ── Maps / geo ─────────────────────────────────────────────
          if (
            id.includes('/@vis.gl/') ||
            id.includes('/@googlemaps/') ||
            id.includes('/google-maps/') ||
            id.includes('/leaflet/') ||
            id.includes('/leaflet-draw/')
          ) return 'vendor-maps'

          // ── Stripe / payments ──────────────────────────────────────
          if (id.includes('/@stripe/') || id.includes('/stripe/'))
            return 'vendor-payments'

          // ── PDF generation ─────────────────────────────────────────
          if (
            id.includes('/react-pdf/') ||
            id.includes('/pdfmake/') ||
            id.includes('/@react-pdf/')
          ) return 'vendor-pdf'

          // ── Charts / data-vis ──────────────────────────────────────
          if (
            id.includes('/recharts/') ||
            id.includes('/d3-') ||
            id.includes('/victory/')
          ) return 'vendor-charts'

          // ── Animation ─────────────────────────────────────────────
          if (id.includes('/framer-motion/') || id.includes('/motion-'))
            return 'vendor-motion'

          // ── Routing ────────────────────────────────────────────────
          if (id.includes('/react-router')) return 'vendor-router'

          // ── Data fetching ──────────────────────────────────────────
          if (id.includes('/@tanstack/')) return 'vendor-query'

          // ── State / utilities ──────────────────────────────────────
          if (id.includes('/zustand/') || id.includes('/jotai/'))
            return 'vendor-state'

          // ── React core — keep react + react-dom together to avoid
          //    circular chunk references ────────────────────────────
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-reconciler/') ||
            id.includes('/scheduler/')
          ) return 'vendor-react'

          // NOTE: three.js / @react-three / @react-spring are intentionally
          // NOT manually chunked here — they are only imported by the lazy-
          // loaded <Visualizer> page, so Rollup naturally places them in a
          // separate async chunk that is never downloaded on page load.

          // ── Everything else: let Rollup decide naturally.
          // Returning undefined lets three.js stay in the lazy Visualizer
          // async chunk instead of bloating the synchronous vendor bundle.
        },
      },
    },
  },
  }
})
