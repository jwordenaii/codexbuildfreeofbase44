import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const osContractPath = path.join(root, 'src', 'config', 'operatingSystemContract.json');
const siteManifestPath = path.join(root, 'src', 'config', 'siteFactoryManifest.json');
const allowedStatus = new Set(['active', 'trapped', 'planned']);
const allowedScopeMode = new Set(['full', 'partial']);
const semverPattern = /^\d+\.\d+\.\d+$/;

function fail(message) {
  console.error(`[operating-system-contract] FAIL: ${message}`);
  process.exit(1);
}

function isSemver(value) {
  return semverPattern.test(String(value || '').trim());
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing file: ${path.relative(root, filePath)}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in ${path.relative(root, filePath)}: ${error.message}`);
  }
}

const osContract = readJson(osContractPath);
const manifest = readJson(siteManifestPath);
const errors = [];

if (!isSemver(osContract.contractVersion)) {
  errors.push('contractVersion must be semver (x.y.z)');
}

const policy = osContract.compatibilityPolicy || {};
if (!isSemver(policy.policyVersion)) {
  errors.push('compatibilityPolicy.policyVersion must be semver (x.y.z)');
}
if (!Number.isInteger(policy.requiredManifestMajor) || policy.requiredManifestMajor < 1) {
  errors.push('compatibilityPolicy.requiredManifestMajor must be an integer >= 1');
}
if (!/^\d+\.\d+$/.test(String(policy.requiredSharedApiVersion || '').trim())) {
  errors.push('compatibilityPolicy.requiredSharedApiVersion must use major.minor format (e.g. 2026.1)');
}

const repositories = Array.isArray(osContract.repositories) ? osContract.repositories : [];
if (!repositories.length) {
  errors.push('repositories must contain at least one entry');
}

const seenRepos = new Set();
for (const repository of repositories) {
  const repo = String(repository.repo || '').trim().toLowerCase();
  if (!repo) {
    errors.push('repositories entry missing repo');
    continue;
  }
  if (seenRepos.has(repo)) {
    errors.push(`repositories contains duplicate repo ${repo}`);
  }
  seenRepos.add(repo);

  const status = String(repository.status || '').trim().toLowerCase();
  const scopeMode = String(repository.scopeMode || '').trim().toLowerCase();
  if (!allowedStatus.has(status)) {
    errors.push(`${repo}: status must be one of ${[...allowedStatus].join('|')}`);
  }
  if (!allowedScopeMode.has(scopeMode)) {
    errors.push(`${repo}: scopeMode must be one of ${[...allowedScopeMode].join('|')}`);
  }
  if (!isSemver(repository.contractVersion)) {
    errors.push(`${repo}: contractVersion must be semver`);
  }
  if (!isSemver(repository.minCompatiblePolicyVersion)) {
    errors.push(`${repo}: minCompatiblePolicyVersion must be semver`);
  }
  if (!isSemver(repository.maxCompatiblePolicyVersion)) {
    errors.push(`${repo}: maxCompatiblePolicyVersion must be semver`);
  }

  if (scopeMode === 'partial' && status === 'active') {
    errors.push(`${repo}: partial scope repositories cannot use status=active`);
  }
}

const integration = manifest.integration || {};
const requiredRepos = new Set();

const canonicalBackendRepo = String(integration?.canonicalBackend?.repo || '').trim().toLowerCase();
if (canonicalBackendRepo) requiredRepos.add(canonicalBackendRepo);

for (const surface of Array.isArray(integration.surfaces) ? integration.surfaces : []) {
  const repo = String(surface.repo || '').trim().toLowerCase();
  if (repo) requiredRepos.add(repo);
}

for (const source of Array.isArray(integration?.sharedContract?.expectedSources)
  ? integration.sharedContract.expectedSources
  : []) {
  const repo = String(source || '').trim().toLowerCase();
  if (repo) requiredRepos.add(repo);
}

const sourceRepo = String(integration?.dataSources?.sourceRepo || '').trim().toLowerCase();
if (sourceRepo) requiredRepos.add(sourceRepo);

for (const requiredRepo of requiredRepos) {
  if (!seenRepos.has(requiredRepo)) {
    errors.push(`repositories is missing required integration repo ${requiredRepo}`);
  }
}

if (!repositories.some((repository) => String(repository.scopeMode || '').toLowerCase() === 'partial')) {
  errors.push('repositories must include at least one partial-scope repo to track trapped/non-full-scope logic');
}

if (errors.length) {
  fail(errors.join('\n'));
}

console.log(
  `[operating-system-contract] PASS: contract=${osContract.contractVersion}, policy=${policy.policyVersion}, repos=${repositories.length}, required=${requiredRepos.size}`,
);
