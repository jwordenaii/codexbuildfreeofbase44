import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const strictMode = String(process.env.PREMIUM_GATE_STRICT || '1').trim() !== '0';
const reportPath = path.join(root, 'test-results', 'premium-quality-report.json');

function fail(message) {
  console.error(`[premium-quality-gate] FAIL: ${message}`);
  process.exit(1);
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

if (!fs.existsSync(distDir)) {
  fail('dist directory not found. Run build before quality gate.');
}

const expectedCanonicalBase = (process.env.VITE_SITE_URL || 'https://www.jwordenasphaltpaving.com').replace(/\/+$/, '');

const htmlFiles = listFilesRecursive(distDir).filter((f) => f.endsWith('.html'));
if (htmlFiles.length === 0) {
  fail('No HTML files found in dist output.');
}

let canonicalOk = 0;
let schemaOk = 0;
let titleOk = 0;
let descriptionOk = 0;

const byTenant = new Map();

function ensureTenant(host) {
  if (!byTenant.has(host)) {
    byTenant.set(host, {
      htmlFiles: 0,
      canonicalOk: 0,
      schemaOk: 0,
      titleOk: 0,
      descriptionOk: 0,
    });
  }
  return byTenant.get(host);
}

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, 'utf8');

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  let tenantHost = 'unknown';
  if (canonicalMatch && canonicalMatch[1]) {
    try {
      tenantHost = new URL(canonicalMatch[1]).hostname.toLowerCase();
    } catch {
      tenantHost = 'invalid-canonical';
    }
  }
  const tenant = ensureTenant(tenantHost);
  tenant.htmlFiles += 1;

  if (canonicalMatch && canonicalMatch[1].startsWith(expectedCanonicalBase)) canonicalOk += 1;
  if (canonicalMatch) tenant.canonicalOk += 1;

  if (/application\/ld\+json/i.test(html) && /"@context"\s*:\s*"https:\/\/schema\.org"/i.test(html)) {
    schemaOk += 1;
    tenant.schemaOk += 1;
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const len = titleMatch[1].trim().length;
    if (len >= 20 && len <= 70) {
      titleOk += 1;
      tenant.titleOk += 1;
    }
  }

  const descriptionMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (descriptionMatch) {
    const len = descriptionMatch[1].trim().length;
    if (len >= 70 && len <= 180) {
      descriptionOk += 1;
      tenant.descriptionOk += 1;
    }
  }
}

const assetsDir = path.join(distDir, 'assets');
const assetFiles = listFilesRecursive(assetsDir);
const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));
const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));
const jsSizes = jsFiles.map((f) => fs.statSync(f).size);
const cssSizes = cssFiles.map((f) => fs.statSync(f).size);

const largestJs = jsSizes.length ? Math.max(...jsSizes) : 0;
const largestCss = cssSizes.length ? Math.max(...cssSizes) : 0;

const canonicalRate = canonicalOk / htmlFiles.length;
const schemaRate = schemaOk / htmlFiles.length;
const titleRate = titleOk / htmlFiles.length;
const descriptionRate = descriptionOk / htmlFiles.length;

const score = Math.round(
  100 * (
    canonicalRate * 0.35 +
    schemaRate * 0.30 +
    titleRate * 0.15 +
    descriptionRate * 0.20
  ),
);

const tenantScores = Object.fromEntries(
  [...byTenant.entries()].map(([tenantHost, stats]) => {
    const canonicalRateTenant = stats.htmlFiles ? stats.canonicalOk / stats.htmlFiles : 0;
    const schemaRateTenant = stats.htmlFiles ? stats.schemaOk / stats.htmlFiles : 0;
    const titleRateTenant = stats.htmlFiles ? stats.titleOk / stats.htmlFiles : 0;
    const descriptionRateTenant = stats.htmlFiles ? stats.descriptionOk / stats.htmlFiles : 0;
    const tenantScore = Math.round(
      100 * (
        canonicalRateTenant * 0.35 +
        schemaRateTenant * 0.30 +
        titleRateTenant * 0.15 +
        descriptionRateTenant * 0.20
      ),
    );
    return [tenantHost, {
      htmlFiles: stats.htmlFiles,
      canonicalRate: Number((canonicalRateTenant * 100).toFixed(2)),
      schemaRate: Number((schemaRateTenant * 100).toFixed(2)),
      titleRate: Number((titleRateTenant * 100).toFixed(2)),
      descriptionRate: Number((descriptionRateTenant * 100).toFixed(2)),
      score: tenantScore,
    }];
  }),
);

console.log('[premium-quality-gate] Summary');
console.log(`- HTML files: ${htmlFiles.length}`);
console.log(`- Canonical consistency: ${(canonicalRate * 100).toFixed(1)}%`);
console.log(`- Schema completeness: ${(schemaRate * 100).toFixed(1)}%`);
console.log(`- Title quality: ${(titleRate * 100).toFixed(1)}%`);
console.log(`- Meta description quality: ${(descriptionRate * 100).toFixed(1)}%`);
console.log(`- Largest JS asset: ${(largestJs / 1024).toFixed(1)} KB`);
console.log(`- Largest CSS asset: ${(largestCss / 1024).toFixed(1)} KB`);
console.log(`- Premium score: ${score}/100`);
console.log('- Per-tenant scores:');
for (const [tenantHost, stats] of Object.entries(tenantScores)) {
  console.log(`  - ${tenantHost}: ${stats.score}/100 (title ${stats.titleRate}%, description ${stats.descriptionRate}%)`);
}

const errors = [];
const thresholds = strictMode
  ? {
      canonicalRate: 0.98,
      schemaRate: 0.95,
      titleRate: 0.95,
      descriptionRate: 0.90,
      largestJs: 1100 * 1024,
      largestCss: 280 * 1024,
      score: 92,
    }
  : {
      canonicalRate: 0.95,
      schemaRate: 0.90,
      titleRate: 0.60,
      descriptionRate: 0.60,
      largestJs: 1250 * 1024,
      largestCss: 320 * 1024,
      score: 82,
    };

if (canonicalRate < thresholds.canonicalRate) {
  errors.push(`Canonical consistency below ${(thresholds.canonicalRate * 100).toFixed(0)}%`);
}
if (schemaRate < thresholds.schemaRate) {
  errors.push(`Schema completeness below ${(thresholds.schemaRate * 100).toFixed(0)}%`);
}
if (titleRate < thresholds.titleRate) {
  errors.push(`Title quality below ${(thresholds.titleRate * 100).toFixed(0)}%`);
}
if (descriptionRate < thresholds.descriptionRate) {
  errors.push(`Meta description quality below ${(thresholds.descriptionRate * 100).toFixed(0)}%`);
}
if (largestJs > thresholds.largestJs) {
  errors.push(`Largest JS asset exceeds ${(thresholds.largestJs / 1024).toFixed(0)}KB budget`);
}
if (largestCss > thresholds.largestCss) {
  errors.push(`Largest CSS asset exceeds ${(thresholds.largestCss / 1024).toFixed(0)}KB budget`);
}
if (score < thresholds.score) {
  errors.push(`Premium quality score below ${thresholds.score}`);
}

for (const [tenantHost, stats] of Object.entries(tenantScores)) {
  if (stats.score < thresholds.score) {
    errors.push(`Tenant ${tenantHost} quality score below ${thresholds.score}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: strictMode ? 'strict' : 'baseline',
  overall: {
    htmlFiles: htmlFiles.length,
    canonicalRate: Number((canonicalRate * 100).toFixed(2)),
    schemaRate: Number((schemaRate * 100).toFixed(2)),
    titleRate: Number((titleRate * 100).toFixed(2)),
    descriptionRate: Number((descriptionRate * 100).toFixed(2)),
    largestJsKb: Number((largestJs / 1024).toFixed(2)),
    largestCssKb: Number((largestCss / 1024).toFixed(2)),
    score,
  },
  tenants: tenantScores,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`[premium-quality-gate] wrote report: ${path.relative(root, reportPath)}`);

if (errors.length > 0) {
  fail(errors.join('; '));
}

console.log(`[premium-quality-gate] PASS (${strictMode ? 'strict' : 'baseline'} mode)`);
