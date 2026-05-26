import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const manifestPath = path.join(root, 'src', 'config', 'siteFactoryManifest.json');

const defaultTenant = {
  key: 'jworden',
  label: 'J. Worden Asphalt Paving',
  canonicalUrl: 'https://www.jwordenasphaltpaving.com',
  market: { primaryRegion: 'Virginia' },
};

const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { profiles: [defaultTenant], hostnames: {} };

const profilesByKey = new Map(
  (manifest.profiles || [])
    .filter((p) => p && p.key)
    .map((p) => [String(p.key).toLowerCase(), p]),
);

if (!profilesByKey.has(defaultTenant.key)) {
  profilesByKey.set(defaultTenant.key, defaultTenant);
}

const hostToTenant = Object.fromEntries(
  Object.entries(manifest.hostnames || {}).map(([host, key]) => [
    String(host).toLowerCase(),
    String(key).toLowerCase(),
  ]),
);

function tenantForHost(host) {
  const key = hostToTenant[String(host || '').toLowerCase()] || defaultTenant.key;
  return profilesByKey.get(key) || profilesByKey.get(defaultTenant.key);
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

function routeFromPath(filePath) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  return `/${rel.replace(/index\.html$/, '').replace(/\.html$/, '')}`.replace(/\/$/, '') || '/';
}

function normalizeWhitespace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function fitRange(text, min, max, fallback) {
  let out = normalizeWhitespace(text);
  if (!out) out = fallback;
  if (out.length < min) {
    const suffix = ' | Premium Asphalt Services';
    while (out.length < min) {
      out = `${out}${suffix}`;
      if (out.length > max) break;
    }
  }
  if (out.length > max) {
    out = out.slice(0, max + 1);
    const lastSpace = out.lastIndexOf(' ');
    if (lastSpace > min) out = out.slice(0, lastSpace);
    out = out.slice(0, max).trim();
  }
  return out;
}

function routeLabel(route) {
  const slug = route.split('/').filter(Boolean).slice(-1)[0] || 'Service';
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function servicePhrase(tenant) {
  const region = tenant?.market?.primaryRegion || 'regional';
  if (tenant?.key === 'wordenstandard') {
    return 'Operations systems, compliance, and execution advisory';
  }
  return `Premium asphalt paving, sealcoating, and repair in ${region}`;
}

function titleFallback(route, tenant) {
  const brand = tenant?.label || defaultTenant.label;
  if (route === '/') {
    return `${servicePhrase(tenant)} | ${brand}`;
  }
  const label = routeLabel(route);
  return `${label} | ${brand}`;
}

function descriptionFallback(route, tenant) {
  const brand = tenant?.label || defaultTenant.label;
  const region = tenant?.market?.primaryRegion || 'your market';
  const opsPhrase = tenant?.key === 'wordenstandard'
    ? 'operator playbooks, onboarding systems, and compliance-led execution'
    : 'verified project proof, technical scope clarity, and high-accountability field execution';
  const base = `${brand} delivers enterprise-grade outcomes with ${opsPhrase} across ${region}.`;
  if (route === '/') {
    return `${base} Request a premium estimate and launch your project with production-level confidence.`;
  }
  return `${base} Explore ${route} and request a project estimate backed by a measurable delivery standard.`;
}

function detectCanonicalHost(html) {
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  if (!canonicalMatch || !canonicalMatch[1]) return null;
  try {
    return new URL(canonicalMatch[1]).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function upsertTitle(html, newTitle) {
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${newTitle}</title>`);
  }
  return html.replace(/<head[^>]*>/i, (m) => `${m}\n<title>${newTitle}</title>`);
}

function upsertDescription(html, description) {
  const metaRegex = /<meta[^>]+name=["']description["'][^>]*>/i;
  const newTag = `<meta name="description" content="${description.replace(/"/g, '&quot;')}">`;
  if (metaRegex.test(html)) {
    return html.replace(metaRegex, newTag);
  }
  return html.replace(/<head[^>]*>/i, (m) => `${m}\n${newTag}`);
}

if (!fs.existsSync(distDir)) {
  console.log('[meta-normalizer] dist not found, skipping.');
  process.exit(0);
}

const htmlFiles = listFilesRecursive(distDir).filter((f) => f.endsWith('.html'));
let updated = 0;

for (const filePath of htmlFiles) {
  const route = routeFromPath(filePath);
  let html = fs.readFileSync(filePath, 'utf8');
  const canonicalHost = detectCanonicalHost(html) || new URL(defaultTenant.canonicalUrl).hostname;
  const tenant = tenantForHost(canonicalHost);

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const existingTitle = normalizeWhitespace(titleMatch?.[1] || '');
  const nextTitle = fitRange(existingTitle, 20, 70, titleFallback(route, tenant));

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i);
  const existingDesc = normalizeWhitespace(descMatch?.[1] || '');
  const nextDesc = fitRange(existingDesc, 70, 180, descriptionFallback(route, tenant));

  const nextHtml = upsertDescription(upsertTitle(html, nextTitle), nextDesc);
  if (nextHtml !== html) {
    fs.writeFileSync(filePath, nextHtml, 'utf8');
    updated += 1;
  }
}

console.log(`[meta-normalizer] processed ${htmlFiles.length} HTML files; updated ${updated}.`);
