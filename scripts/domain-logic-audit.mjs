#!/usr/bin/env node
/**
 * domain-logic-audit.mjs
 *
 * Audits current repository logic coverage for high-value operating domains:
 * interior, exterior, civil, general contracting (GC), scanning/vision,
 * and legal/compliance.
 *
 * Output:
 *   - docs/domain-logic/latest.json
 *   - docs/domain-logic/latest-report.md
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, extname, relative } from 'node:path'

const ROOT = process.cwd()
const OUTPUT_DIR = resolve(ROOT, 'docs/domain-logic')
const OUTPUT_JSON = resolve(OUTPUT_DIR, 'latest.json')
const OUTPUT_MD = resolve(OUTPUT_DIR, 'latest-report.md')
const SELF_FILE = resolve(ROOT, 'scripts/domain-logic-audit.mjs')

const SOURCE_ROOTS = [
  resolve(ROOT, 'app'),
  resolve(ROOT, 'src'),
  resolve(ROOT, 'scripts'),
]

const EXTRA_FILES = [
  resolve(ROOT, 'package.json'),
]

const ALLOWED_EXTENSIONS = new Set(['.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.json'])

const DOMAINS = [
  {
    id: 'interior',
    label: 'Interior',
    discovery: [
      /interior/i,
      /floor[\s_-]?plan/i,
      /remodel/i,
      /adu/i,
    ],
    requiredCapabilities: [
      {
        id: 'interior-estimation-surface',
        label: 'Interior estimation/service surface',
        patterns: [/interior_design/i, /interior/i],
      },
      {
        id: 'floor-plan-ui-route',
        label: 'Floor plan route or module',
        patterns: [/floor-plan-studio/i, /FloorPlanStudio/i],
      },
    ],
    tomorrowIdeas: [
      'Room-level scope packs that convert floor-plan geometry to finish schedules and labor bands.',
      'Permit-ready interior remodel packet generator with jurisdiction-specific checklists.',
    ],
  },
  {
    id: 'exterior',
    label: 'Exterior',
    discovery: [
      /exterior/i,
      /build\s*config/i,
      /roof/i,
      /paving/i,
      /driveway/i,
    ],
    requiredCapabilities: [
      {
        id: 'exterior-material-config',
        label: 'Exterior material configurator',
        patterns: [/EXTERIOR_MATERIALS/i, /exteriorMaterial/i],
      },
      {
        id: 'property-visualization',
        label: 'Exterior/parcel visualization route',
        patterns: [/\/visualizer/i, /PropertyVisualizer/i, /parcel/i],
      },
    ],
    tomorrowIdeas: [
      'Auto-select exterior assemblies by climate zone, freeze-thaw profile, and local code pressure.',
      'Change-order simulator that predicts lifecycle cost before material swaps are approved.',
    ],
  },
  {
    id: 'civil',
    label: 'Civil',
    discovery: [
      /civil/i,
      /ground[\s_-]?scan/i,
      /utility/i,
      /swppp/i,
      /drainage/i,
      /pavement[\s_-]?decay/i,
    ],
    requiredCapabilities: [
      {
        id: 'premium-civil-stack-api',
        label: 'Premium civil stack endpoint/client',
        patterns: [/premium-civil-stack/i],
      },
      {
        id: 'ground-scan-endpoint',
        label: 'Ground scan risk endpoint',
        patterns: [/\/ground-scan/i, /GroundScanReport/i],
      },
      {
        id: 'pavement-decay-model',
        label: 'Pavement decay simulation',
        patterns: [/pavement-decay/i, /PavementDecayRequest/i],
      },
    ],
    tomorrowIdeas: [
      'Probabilistic utility conflict map combining 811, GPR confidence, and historical strike incidents.',
      'Climate-adjusted decay twins that auto-trigger maintenance windows by weather forecasts and traffic load.',
    ],
  },
  {
    id: 'gc',
    label: 'General Contracting',
    discovery: [
      /general[\s_-]?contract/i,
      /gc/i,
      /subcontract/i,
      /workforce/i,
      /dispatch/i,
      /cost catalog/i,
      /estimate/i,
    ],
    requiredCapabilities: [
      {
        id: 'gc-estimation-models',
        label: 'GC cost catalog / estimate models',
        patterns: [/GC Cost Catalog/i, /Project Estimate/i, /markup_pct/i],
      },
      {
        id: 'subcontractor-management',
        label: 'Subcontractor management surface',
        patterns: [/SubcontractorRoster/i, /\/subcontractors/i],
      },
      {
        id: 'workforce-dispatch-surface',
        label: 'Workforce/dispatch APIs or routes',
        patterns: [/\/workforce/i, /dispatch_router/i, /crew/i],
      },
    ],
    tomorrowIdeas: [
      'Autonomous crew allocator that balances labor availability, route distance, and compliance constraints.',
      'GC margin guardian that predicts overrun risk before schedule commits and purchase orders are approved.',
    ],
  },
  {
    id: 'scanning',
    label: 'Scanning and Vision',
    discovery: [
      /scan/i,
      /photo-inspect/i,
      /vision/i,
      /drone/i,
      /lidar/i,
      /takeoff/i,
      /aerial/i,
    ],
    requiredCapabilities: [
      {
        id: 'photo-inspection',
        label: 'Photo inspection endpoint',
        patterns: [/\/photo-inspect/i, /_openai_analysis/i],
      },
      {
        id: 'drone-scan-ingest',
        label: 'Drone scan ingest/list APIs',
        patterns: [/\/drone-scan/i, /DroneScan/i],
      },
      {
        id: 'lidar-ingest',
        label: 'LiDAR ingest route wiring',
        patterns: [/lidar_ingest_router/i, /\/lidar/i],
      },
      {
        id: 'takeoff-stack',
        label: 'Takeoff APIs (solar, measure, aerial)',
        patterns: [/\/takeoff\/solar/i, /\/takeoff\/measure/i, /\/takeoff\/aerial/i],
      },
    ],
    tomorrowIdeas: [
      'Multi-sensor fusion graph (photo + drone + LiDAR + thermal) with confidence-weighted defect consensus.',
      'Continuous site twin where each new scan updates risk, quantity, and schedule in one timeline.',
    ],
  },
  {
    id: 'compliance',
    label: 'Legal and Compliance',
    discovery: [
      /compliance/i,
      /license/i,
      /permit/i,
      /lien/i,
      /osha/i,
      /prevailing/i,
      /811/i,
      /state_data/i,
    ],
    requiredCapabilities: [
      {
        id: '51-state-parity',
        label: '51-jurisdiction parity checks',
        patterns: [/TOTAL_US_JURISDICTIONS\s*=\s*51/i, /verify_state_logic_integrity/i],
      },
      {
        id: 'supremecourt-compliance-engine',
        label: 'SupremeCourtAI compliance engine',
        patterns: [/SupremeCourtAI/i, /_STATE_COMPLIANCE/i],
      },
      {
        id: 'legal-table-change-monitoring',
        label: 'Legal advisory change monitoring',
        patterns: [/legal-advisory-change-report/i],
      },
    ],
    tomorrowIdeas: [
      'Auto-citation drift detector that flags stale statutes/codes by source age and confidence.',
      'Permit and lien SLA engine with deadline escalations tied to project and jurisdiction context.',
    ],
  },
]

main().catch((err) => {
  console.error('[domain-logic] audit failed:', err)
  process.exit(1)
})

async function main() {
  const files = await collectSourceFiles(SOURCE_ROOTS)
  const corpus = await buildCorpus(files)

  const domains = DOMAINS.map((domain) => analyzeDomain(domain, corpus))
  const summary = summarize(domains)
  const report = {
    generatedAt: new Date().toISOString(),
    sourceFileCount: files.length,
    summary,
    domains,
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUTPUT_MD, renderMarkdown(report), 'utf8')

  console.log(`[domain-logic] audited files: ${files.length}`)
  console.log(`[domain-logic] domains: ${domains.length}`)
  console.log(`[domain-logic] missing capabilities: ${summary.totalMissingCapabilities}`)
  console.log('[domain-logic] wrote docs/domain-logic/latest.json')
  console.log('[domain-logic] wrote docs/domain-logic/latest-report.md')
}

async function collectSourceFiles(roots) {
  const all = []
  for (const root of roots) {
    const entries = await walk(root)
    all.push(...entries)
  }

  all.push(...EXTRA_FILES)

  return [...new Set(all)]
    .filter((filePath) => filePath !== SELF_FILE)
    .filter((filePath) => ALLOWED_EXTENSIONS.has(extname(filePath).toLowerCase()))
}

async function walk(dir) {
  const out = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
      continue
    }
    out.push(full)
  }
  return out
}

async function buildCorpus(files) {
  const corpus = []
  for (const file of files) {
    let text = ''
    try {
      text = await readFile(file, 'utf8')
    } catch {
      continue
    }
    corpus.push({
      file,
      relativePath: normalizePath(relative(ROOT, file)),
      text,
    })
  }
  return corpus
}

function analyzeDomain(domain, corpus) {
  const discoveryMatches = []

  for (const file of corpus) {
    if (!domain.discovery.some((regex) => regex.test(file.text))) continue
    const hitCount = domain.discovery.reduce((count, regex) => count + countMatches(file.text, regex), 0)
    if (hitCount <= 0) continue
    discoveryMatches.push({
      file: file.relativePath,
      hitCount,
    })
  }

  discoveryMatches.sort((a, b) => b.hitCount - a.hitCount)

  const capabilities = domain.requiredCapabilities.map((capability) => {
    const matches = []
    for (const file of corpus) {
      const patternHits = capability.patterns.reduce((sum, regex) => sum + countMatches(file.text, regex), 0)
      if (patternHits <= 0) continue
      matches.push({ file: file.relativePath, hitCount: patternHits })
    }
    matches.sort((a, b) => b.hitCount - a.hitCount)
    return {
      id: capability.id,
      label: capability.label,
      status: matches.length > 0 ? 'present' : 'missing',
      evidence: matches.slice(0, 5),
    }
  })

  const missingCapabilities = capabilities.filter((c) => c.status === 'missing')
  const presentCount = capabilities.length - missingCapabilities.length
  const coveragePct = capabilities.length === 0 ? 100 : Number(((presentCount / capabilities.length) * 100).toFixed(2))

  return {
    id: domain.id,
    label: domain.label,
    discoveryFileCount: discoveryMatches.length,
    topDiscoveryFiles: discoveryMatches.slice(0, 10),
    capabilityCoveragePct: coveragePct,
    capabilities,
    missingCapabilities,
    tomorrowIdeas: domain.tomorrowIdeas,
  }
}

function summarize(domains) {
  const totalCapabilities = domains.reduce((sum, d) => sum + d.capabilities.length, 0)
  const totalMissingCapabilities = domains.reduce((sum, d) => sum + d.missingCapabilities.length, 0)
  const averageCoveragePct = domains.length
    ? Number((domains.reduce((sum, d) => sum + d.capabilityCoveragePct, 0) / domains.length).toFixed(2))
    : 100

  return {
    totalDomains: domains.length,
    totalCapabilities,
    totalMissingCapabilities,
    averageCoveragePct,
    weakestDomains: [...domains]
      .sort((a, b) => a.capabilityCoveragePct - b.capabilityCoveragePct)
      .slice(0, 3)
      .map((d) => ({ id: d.id, label: d.label, coveragePct: d.capabilityCoveragePct })),
  }
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# Domain Logic Audit')
  lines.push('')
  lines.push(`Generated at: ${report.generatedAt}`)
  lines.push(`Scanned source files: ${report.sourceFileCount}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Domains: ${report.summary.totalDomains}`)
  lines.push(`- Capabilities tracked: ${report.summary.totalCapabilities}`)
  lines.push(`- Missing capabilities: ${report.summary.totalMissingCapabilities}`)
  lines.push(`- Average capability coverage: ${report.summary.averageCoveragePct}%`)
  lines.push('')
  lines.push('## Coverage by Domain')
  lines.push('')
  lines.push('| Domain | Discovery Files | Coverage | Missing |')
  lines.push('| --- | ---: | ---: | ---: |')
  for (const domain of report.domains) {
    lines.push(`| ${domain.label} | ${domain.discoveryFileCount} | ${domain.capabilityCoveragePct}% | ${domain.missingCapabilities.length} |`)
  }
  lines.push('')

  for (const domain of report.domains) {
    lines.push(`## ${domain.label}`)
    lines.push('')
    lines.push(`- Coverage: ${domain.capabilityCoveragePct}%`)
    lines.push(`- Missing capabilities: ${domain.missingCapabilities.length}`)
    lines.push('')
    lines.push('### Capabilities')
    lines.push('')
    for (const capability of domain.capabilities) {
      lines.push(`- ${capability.status === 'present' ? 'PASS' : 'MISSING'} ${capability.label}`)
      if (capability.evidence.length > 0) {
        const evidence = capability.evidence
          .slice(0, 3)
          .map((item) => `${item.file} (${item.hitCount})`)
          .join(', ')
        lines.push(`  evidence: ${evidence}`)
      }
    }
    lines.push('')
    lines.push('### Tomorrow Ideas')
    lines.push('')
    for (const idea of domain.tomorrowIdeas) {
      lines.push(`- ${idea}`)
    }
    lines.push('')
  }

  lines.push('## Notes')
  lines.push('')
  lines.push('- This report is a capability presence audit (code surface + wiring evidence), not a legal or engineering correctness proof.')
  lines.push('- Use this as a fast gap detector to prioritize what to add next without destabilizing existing production flows.')
  lines.push('')

  return `${lines.join('\n')}\n`
}

function countMatches(text, regex) {
  if (!regex.global) {
    return regex.test(text) ? 1 : 0
  }

  let count = 0
  regex.lastIndex = 0
  while (regex.exec(text)) count += 1
  regex.lastIndex = 0
  return count
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
}