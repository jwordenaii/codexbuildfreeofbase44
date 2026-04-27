import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'

const SITE_URL = 'https://jworden.netlify.app'

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

  return {
  plugins: [
    react(),
    sitemap({
      hostname: SITE_URL,
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
