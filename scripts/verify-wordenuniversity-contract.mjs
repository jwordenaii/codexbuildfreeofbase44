#!/usr/bin/env node

/**
 * verify-wordenuniversity-contract.mjs
 *
 * Cross-repo contract guard for the external Worden University frontend.
 *
 * Default target:
 *   - repo: jwordenaii/wordenuniversity
 *   - branch: main
 *
 * Usage:
 *   node scripts/verify-wordenuniversity-contract.mjs
 *   node scripts/verify-wordenuniversity-contract.mjs --repo=jwordenaii/wordenuniversity --branch=main
 */

const argv = process.argv.slice(2);

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const repo = getArg("repo", process.env.WORDEN_UNIVERSITY_REPO || "jwordenaii/wordenuniversity");
const branch = getArg("branch", process.env.WORDEN_UNIVERSITY_BRANCH || "main");
const expectedContractVersion = Number(getArg("contract-version", "1"));

function fail(message) {
  console.error(`[wordenuniversity-contract] FAIL: ${message}`);
  process.exit(1);
}

async function fetchText(pathname) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${pathname}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "worden-contract-guard" },
  });
  if (!res.ok) {
    throw new Error(`${pathname} returned HTTP ${res.status}`);
  }
  return res.text();
}

async function fetchJson(pathname) {
  const text = await fetchText(pathname);
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${pathname} is not valid JSON: ${err.message}`);
  }
}

function expectIncludes(filePath, content, expected, errors) {
  for (const marker of expected) {
    if (!content.includes(marker)) {
      errors.push(`${filePath} is missing marker: ${JSON.stringify(marker)}`);
    }
  }
}

async function main() {
  const errors = [];
  const notes = [];

  let readme = "";
  let app = "";
  let mainJsx = "";
  let contract = null;

  try {
    [readme, app, mainJsx, contract] = await Promise.all([
      fetchText("README.md"),
      fetchText("src/App.jsx"),
      fetchText("src/main.jsx"),
      fetchJson(".well-known/worden-contract.json"),
    ]);
  } catch (err) {
    fail(`Could not fetch contract files from ${repo}@${branch}: ${err.message}`);
  }

  if (!contract || typeof contract !== "object") {
    errors.push(".well-known/worden-contract.json did not resolve to an object.");
  } else {
    if (Number(contract.contract_version) !== expectedContractVersion) {
      errors.push(`contract_version expected ${expectedContractVersion} but found ${JSON.stringify(contract.contract_version)}`);
    }

    if (String(contract.product || "").toLowerCase() !== "wordenuniversity") {
      errors.push(`contract product expected \"wordenuniversity\" but found ${JSON.stringify(contract.product)}`);
    }

    const contractRepo = contract.repository || {};
    const expectedRepoName = repo.split("/")[1] || repo;
    if (String(contractRepo.owner || "").toLowerCase() !== "jwordenaii") {
      errors.push(`contract repository.owner expected \"jwordenaii\" but found ${JSON.stringify(contractRepo.owner)}`);
    }
    if (String(contractRepo.name || "").toLowerCase() !== String(expectedRepoName).toLowerCase()) {
      errors.push(`contract repository.name expected ${JSON.stringify(expectedRepoName)} but found ${JSON.stringify(contractRepo.name)}`);
    }

    const capabilities = Array.isArray(contract.capabilities) ? contract.capabilities : [];
    for (const required of ["frontend_lms", "course_catalog", "quiz_and_certification"]) {
      if (!capabilities.includes(required)) {
        errors.push(`contract capabilities missing required value: ${JSON.stringify(required)}`);
      }
    }

    const progressKey = contract.storage?.progress_key;
    if (progressKey !== "wu-progress") {
      errors.push(`contract storage.progress_key expected \"wu-progress\" but found ${JSON.stringify(progressKey)}`);
    }

    const minVersion = Number(contract.compatibility?.minimum_supported_contract_version);
    const maxVersion = Number(contract.compatibility?.maximum_supported_contract_version);
    if (Number.isFinite(minVersion) && Number.isFinite(maxVersion)) {
      if (!(expectedContractVersion >= minVersion && expectedContractVersion <= maxVersion)) {
        errors.push(`expected contract version ${expectedContractVersion} outside compatibility range [${minVersion}, ${maxVersion}]`);
      }
    } else {
      errors.push("contract compatibility range is missing or invalid.");
    }
  }

  expectIncludes("src/App.jsx", app, [
    "WORDEN UNIVERSITY",
    "const COURSES = [",
    "wu-progress",
    "Worden University Certified",
  ], errors);

  expectIncludes("src/main.jsx", mainJsx, [
    "ReactDOM.createRoot",
    "import App from './App.jsx'",
  ], errors);

  // Weak signals used for integration assumptions.
  if (app.includes("window.storage")) {
    notes.push("Storage API pattern detected (window.storage). Treat user progress as app-local state contract.");
  } else {
    notes.push("window.storage pattern not found. Re-check persistence assumptions before cross-linking progress data.");
  }

  if (app.includes("/api/") || app.includes("fetch(")) {
    notes.push("Network/API usage detected in src/App.jsx. Review for new backend integration dependencies.");
  } else {
    notes.push("No obvious backend API usage in src/App.jsx (frontend-only LMS shape still likely).");
  }

  if (app.includes("thewordenstandard.com")) {
    notes.push("Cross-link to thewordenstandard.com detected (branding/integration anchor present).");
  }

  if (!readme.trim()) {
    errors.push("README.md is empty.");
  }

  if (errors.length > 0) {
    fail(`Contract drift detected:\n- ${errors.join("\n- ")}`);
  }

  console.log(`[wordenuniversity-contract] PASS: ${repo}@${branch}`);
  console.log(`[wordenuniversity-contract] CONTRACT: version=${contract.contract_version} capabilities=${(contract.capabilities || []).length}`);
  for (const note of notes) {
    console.log(`[wordenuniversity-contract] NOTE: ${note}`);
  }
}

main().catch((err) => {
  fail(err?.message || String(err));
});
