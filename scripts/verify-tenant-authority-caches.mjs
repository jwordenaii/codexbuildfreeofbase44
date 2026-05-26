import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'src', 'config', 'siteFactoryManifest.json');
const generatedDir = path.join(root, 'src', 'generated');

function fail(message) {
  console.error(`[tenant-authority-guard] FAIL: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`Could not parse JSON: ${filePath} (${err.message})`);
  }
}

if (!fs.existsSync(manifestPath)) {
  fail('Missing src/config/siteFactoryManifest.json');
}

const manifest = readJson(manifestPath);
const profiles = Array.isArray(manifest.profiles) ? manifest.profiles : [];
const profileByKey = new Map();
for (const p of profiles) {
  if (p?.key) profileByKey.set(String(p.key).toLowerCase(), p);
}

const hostnames = manifest.hostnames && typeof manifest.hostnames === 'object' ? manifest.hostnames : {};
const mappedTenants = [...new Set(Object.values(hostnames).map((k) => String(k).toLowerCase()))];

if (mappedTenants.length === 0) {
  fail('No hostnames are mapped to tenants in siteFactoryManifest.json');
}

const authorityRouteModes = new Set(['full-site', 'market-landing']);
const missing = [];
const checked = [];

for (const tenantKey of mappedTenants) {
  const profile = profileByKey.get(tenantKey);
  if (!profile) {
    missing.push(`${tenantKey} (hostname mapped but missing profile)`);
    continue;
  }

  if (!authorityRouteModes.has(String(profile.routeMode || '').toLowerCase())) {
    continue;
  }

  const cacheFile = path.join(generatedDir, `authorityContent.${tenantKey}.json`);
  checked.push(cacheFile);
  if (!fs.existsSync(cacheFile)) {
    missing.push(`${tenantKey} -> ${path.relative(root, cacheFile)}`);
  }
}

if (missing.length > 0) {
  fail(`Missing authority cache files for mapped tenant hosts:\n- ${missing.join('\n- ')}`);
}

console.log(`[tenant-authority-guard] PASS: checked ${checked.length} tenant authority cache files.`);
