import fs from 'node:fs'

const appPath = 'src/App.jsx'
const source = fs.readFileSync(appPath, 'utf8')

const internalRoutes = [
  '/command-center',
  '/dashboard',
  '/leads',
  '/voice-calls',
  '/revenue',
  '/crew-eta',
  '/crew-mode',
  '/admin/documents',
  '/admin/slack',
  '/consultant',
  '/autonomy',
  '/contractor-ai',
]

const publicRoutes = [
  '/',
  '/about',
  '/contact',
  '/quote',
  '/services',
  '/residential',
  '/parking-lots',
  '/blog',
]

function esc(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const failures = []

for (const route of internalRoutes) {
  const gatedPattern = new RegExp(
    `path="${esc(route)}"[\\s\\S]{0,320}element=\\{\\s*<RequireAuth>`,
    'm'
  )
  if (!gatedPattern.test(source)) {
    failures.push(`Internal route is not explicitly auth-gated: ${route}`)
  }
}

for (const route of publicRoutes) {
  const publicRoutePattern = new RegExp(
    `<Route\\s+path="${esc(route)}"\\s+element=\\{([\\s\\S]{0,220}?)\\}\\s*\\/?\\s*>`,
    'm'
  )
  const match = source.match(publicRoutePattern)
  if (!match) {
    failures.push(`Public route definition not found: ${route}`)
    continue
  }
  if ((match[1] || '').includes('<RequireAuth>')) {
    failures.push(`Public route is accidentally auth-gated: ${route}`)
  }
}

if (failures.length > 0) {
  console.error('Public/Core boundary guard failed:')
  for (const failure of failures) {
    console.error(` - ${failure}`)
  }
  process.exit(1)
}

console.log('Public/Core boundary guard passed.')
