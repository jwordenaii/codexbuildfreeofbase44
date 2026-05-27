#!/usr/bin/env node
/**
 * generate-sitemap.mjs
 * ---------------------------------------------------------------
 * Builds public/sitemap.xml + public/sitemap.txt from real route
 * data so the sitemap can never drift from what the app serves.
 *
 * Sources:
 *   - STATIC_ROUTES (below) for hand-curated public pages
 *   - src/lib/locations.js          (LOCATIONS array)
 *   - src/data/serviceAreas.js      (SERVICE_AREAS array)
 *   - src/lib/states50.js           (WORDEN_ACTIVE_STATES + stateSlug)
 *
 * Run:  node scripts/generate-sitemap.mjs
 * Hooked into npm run build via "prebuild" in package.json.
 * ---------------------------------------------------------------
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_SITE = 'https://www.jwordenasphaltpaving.com';
const SITE = String(process.env.SITEMAP_SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE)
  .trim()
  .replace(/\/$/, '');
const INCLUDE_ALL_STATES =
  process.argv.includes('--all-states') ||
  /^(1|true|yes)$/i.test(String(process.env.SITEMAP_INCLUDE_ALL_STATES || '').trim());

const VALID_CHANGEFREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function assertValidSitemapEntries(entries) {
  const seenLocs = new Set();

  for (const entry of entries) {
    if (!entry?.loc) throw new Error('[sitemap] missing <loc> value');
    if (seenLocs.has(entry.loc)) throw new Error(`[sitemap] duplicate URL: ${entry.loc}`);
    seenLocs.add(entry.loc);

    let parsed;
    try {
      parsed = new URL(entry.loc);
    } catch {
      throw new Error(`[sitemap] invalid URL: ${entry.loc}`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`[sitemap] unsupported URL protocol: ${entry.loc}`);
    }
    if (entry.loc.length > 2048) {
      throw new Error(`[sitemap] URL exceeds 2048 characters: ${entry.loc}`);
    }
    if (!DATE_ONLY.test(String(entry.lastmod || ''))) {
      throw new Error(`[sitemap] invalid lastmod for ${entry.loc}: ${entry.lastmod}`);
    }
    if (!VALID_CHANGEFREQ.has(entry.changefreq)) {
      throw new Error(`[sitemap] invalid changefreq for ${entry.loc}: ${entry.changefreq}`);
    }

    const priority = Number(entry.priority);
    if (!Number.isFinite(priority) || priority < 0 || priority > 1) {
      throw new Error(`[sitemap] invalid priority for ${entry.loc}: ${entry.priority}`);
    }
  }
}

// ── 1. Hand-curated public routes (priority + changefreq tuned for local-pack) ─
const STATIC_ROUTES = [
  { path: '/',                              priority: '1.0', changefreq: 'weekly' },
  { path: '/contact',                       priority: '0.95', changefreq: 'monthly' },
  { path: '/quote',                         priority: '0.95', changefreq: 'monthly' },
  { path: '/services',                      priority: '0.9',  changefreq: 'monthly' },
  { path: '/paving',                        priority: '0.9',  changefreq: 'monthly' },
  { path: '/sealcoating',                   priority: '0.9',  changefreq: 'monthly' },
  { path: '/concrete',                      priority: '0.85', changefreq: 'monthly' },
  { path: '/crack-repair',                  priority: '0.85', changefreq: 'monthly' },
  { path: '/parking-lots',                  priority: '0.9',  changefreq: 'monthly' },
  { path: '/residential',                   priority: '0.9',  changefreq: 'monthly' },
  { path: '/general-contracting',           priority: '0.8',  changefreq: 'monthly' },
  { path: '/hardscapes',                    priority: '0.8',  changefreq: 'monthly' },
  { path: '/shingles',                      priority: '0.8',  changefreq: 'monthly' },
  { path: '/tar-and-chip',                  priority: '0.8',  changefreq: 'monthly' },
  { path: '/millings-fines',                priority: '0.75', changefreq: 'monthly' },
  { path: '/about',                         priority: '0.85', changefreq: 'monthly' },
  { path: '/gallery',                       priority: '0.75', changefreq: 'monthly' },
  { path: '/projects',                      priority: '0.75', changefreq: 'monthly' },
  { path: '/reviews',                       priority: '0.85', changefreq: 'weekly' },
  { path: '/blog',                          priority: '0.85', changefreq: 'weekly' },
  { path: '/locations',                     priority: '0.9',  changefreq: 'monthly' },
  { path: '/service-areas',                 priority: '0.9',  changefreq: 'monthly' },
  { path: '/jwordenai',                     priority: '0.85', changefreq: 'monthly' },
  { path: '/ai-research',                   priority: '0.8',  changefreq: 'daily' },
  // Regional landing pages (high local-pack value)
  { path: '/richmond-paving',               priority: '0.95', changefreq: 'monthly' },
  { path: '/chesterfield-paving',           priority: '0.95', changefreq: 'monthly' },
  { path: '/hampton-roads-paving',          priority: '0.9',  changefreq: 'monthly' },
  { path: '/fredericksburg-paving',         priority: '0.9',  changefreq: 'monthly' },
  { path: '/northern-virginia-paving',      priority: '0.9',  changefreq: 'monthly' },
  { path: '/shenandoah-valley-paving',      priority: '0.9',  changefreq: 'monthly' },
  { path: '/commercial/richmond-va',        priority: '0.9',  changefreq: 'monthly' },
];

// ── 2. Pull dynamic city / location / state slugs from the actual data ────────
async function importDataModule(relPath) {
  const url = pathToFileURL(resolve(ROOT, relPath)).href;
  return import(url);
}

let LOCATIONS = [];
let SERVICE_AREAS = [];
let WORDEN_ACTIVE_STATES = [];
let STATE_MAP = {};
let LANDING_PAGES = [];
let BLOG_POSTS = [];
let stateSlug = (s) => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

try {
  ({ LOCATIONS } = await importDataModule('src/lib/locations.js'));
} catch (e) {
  console.warn('[sitemap] could not load src/lib/locations.js:', e.message);
}
try {
  ({ SERVICE_AREAS } = await importDataModule('src/data/serviceAreas.js'));
} catch (e) {
  console.warn('[sitemap] could not load src/data/serviceAreas.js:', e.message);
}
try {
  const mod = await importDataModule('src/lib/states50.js');
  WORDEN_ACTIVE_STATES = mod.WORDEN_ACTIVE_STATES || [];
  STATE_MAP = mod.STATE_MAP || {};
  if (mod.stateSlug) stateSlug = mod.stateSlug;
} catch (e) {
  console.warn('[sitemap] could not load src/lib/states50.js:', e.message);
}
try {
  ({ LANDING_PAGES } = await importDataModule('src/lib/landingPages.js'));
} catch (e) {
  console.warn('[sitemap] could not load src/lib/landingPages.js:', e.message);
}
try {
  const blogsMod = await importDataModule('src/data/blogPosts.js');
  BLOG_POSTS = blogsMod.default || [];
} catch (e) {
  console.warn('[sitemap] could not load src/data/blogPosts.js:', e.message);
}

// ── 3. Build URL list ─────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const urls = [];

for (const r of STATIC_ROUTES) {
  urls.push({ loc: SITE + r.path, lastmod: today, changefreq: r.changefreq, priority: r.priority });
}

for (const loc of LOCATIONS) {
  if (!loc?.slug) continue;
  urls.push({
    loc: `${SITE}/locations/${loc.slug}`,
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.9',
  });
}

for (const a of SERVICE_AREAS) {
  if (!a?.slug) continue;
  urls.push({
    loc: `${SITE}/service-areas/${a.slug}`,
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.85',
  });
}

for (const lp of LANDING_PAGES) {
  if (!lp?.slug) continue;
  urls.push({
    loc: `${SITE}/lp/${lp.slug}`,
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.9',
  });
}

for (const bp of BLOG_POSTS) {
  if (!bp?.slug) continue;
  urls.push({
    loc: `${SITE}/blog/${bp.slug}`,
    lastmod: bp.date || today,
    changefreq: 'monthly',
    priority: '0.75',
  });
}

const stateCodesForSitemap = INCLUDE_ALL_STATES
  ? Object.keys(STATE_MAP).sort()
  : WORDEN_ACTIVE_STATES;

for (const abbr of stateCodesForSitemap) {
  const st = STATE_MAP[abbr];
  if (!st) continue;
  urls.push({
    loc: `${SITE}/states/${stateSlug(st)}`,
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.7',
  });
}

// Dedupe (in case static and dynamic overlap)
const seen = new Set();
const deduped = urls.filter((u) => {
  if (seen.has(u.loc)) return false;
  seen.add(u.loc);
  return true;
});
assertValidSitemapEntries(deduped);

// ── 4. Emit sitemap.xml ───────────────────────────────────────────────────────
const xmlBody = deduped
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
    <changefreq>${escapeXml(u.changefreq)}</changefreq>
    <priority>${escapeXml(u.priority)}</priority>
  </url>`
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlBody}
</urlset>
`;

writeFileSync(resolve(ROOT, 'public/sitemap.xml'), xml, 'utf8');
writeFileSync(
  resolve(ROOT, 'public/sitemap.txt'),
  deduped.map((u) => u.loc).join('\n') + '\n',
  'utf8'
);

console.log(
  `[sitemap] wrote ${deduped.length} URLs ` +
    `(${STATIC_ROUTES.length} static, ${LOCATIONS.length} locations, ` +
    `${SERVICE_AREAS.length} service-areas, ${LANDING_PAGES.length} landing pages, ${BLOG_POSTS.length} blogs, ${stateCodesForSitemap.length} states, mode=${INCLUDE_ALL_STATES ? 'all_51' : 'active_only'})`
);
