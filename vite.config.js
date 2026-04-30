import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'
import { STATE_PAGE_ROUTES, WORDEN_ACTIVE_STATES } from './src/lib/states50.js'
import { SERVICE_AREAS } from './src/data/serviceAreas.js'
import { BLOG_POSTS } from './src/data/blogPosts.js'

const DEFAULT_SITE_URL = 'https://jworden.netlify.app'

// City and blog slugs are derived from the same data the React pages render
// from, so the sitemap can never drift out of sync with the actual routes.
const CITY_SLUGS = SERVICE_AREAS.map((a) => a.slug)
const BLOG_SLUGS = BLOG_POSTS.map((p) => p.slug)

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
      dynamicRoutes: [
        // Core pages
        '/',
        '/services',
        '/about',
        '/contact',
        '/quote',
        '/reviews',
        '/projects',
        '/visualizer',
        '/gallery',
        '/jwordenai',
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
      ],
    }),
  ],
  // Provide an empty fallback so the %VITE_GA4_ID% HTML replacement
  // resolves without a build warning when the env var is not set.
  define: {
    'import.meta.env.VITE_GA4_ID': JSON.stringify(env.VITE_GA4_ID || ''),
  },
  build: {
    rollupOptions: {
      output: {
        // Code-split by route for faster page loads
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion')) return 'framer'
            if (id.includes('react-router')) return 'router'
            if (id.includes('@tanstack')) return 'query'
            if (id.includes('@vis.gl') || id.includes('google-maps')) return 'maps'
            if (id.includes('react-pdf') || id.includes('pdfmake')) return 'pdf'
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts'
            return 'vendor'
          }
        },
      },
    },
  },
  }
})
