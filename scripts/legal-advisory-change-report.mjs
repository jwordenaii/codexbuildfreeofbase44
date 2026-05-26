#!/usr/bin/env node
/**
 * legal-advisory-change-report.mjs
 *
 * Builds a deterministic snapshot for legal advisory datasets and reports
 * operational impact when rows or fields change across jurisdictions.
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const LEGAL_DIR = resolve(ROOT, 'src/data/legal')
const STATES_PATH = resolve(ROOT, 'src/lib/states50.js')

const OUTPUT_DIR = resolve(ROOT, 'docs/legal-advisory')
const HISTORY_DIR = resolve(OUTPUT_DIR, 'history')
const BASELINE_PATH = resolve(OUTPUT_DIR, 'baseline.json')
const CURRENT_SNAPSHOT_PATH = resolve(OUTPUT_DIR, 'current-snapshot.json')
const LATEST_JSON_PATH = resolve(OUTPUT_DIR, 'latest.json')
const LATEST_REPORT_PATH = resolve(OUTPUT_DIR, 'latest-report.md')

const CRITICAL_FIELD_TOKENS = [
  'license',
  'licensing',
  'permit',
  'osha',
  'bond',
  'insurance',
  'retainage',
  'interest',
  'lien',
  'deadline',
  'notice',
  'threshold',
  'utility',
  '811',
  'swppp',
  'citation',
  'authority',
  'stateLicenseRequired',
  'payIfPaid',
  'payWhenPaid',
  'workersComp',
]

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

const startedAt = Date.now()
const nowIso = new Date().toISOString()

const currentSnapshot = await buildSnapshot(nowIso)
const jurisdictionCapability = buildJurisdictionCapability(currentSnapshot)

if (!args.noWrite) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeJson(CURRENT_SNAPSHOT_PATH, currentSnapshot)
}

let baselineSnapshot = null
const baselineExists = existsSync(BASELINE_PATH)
if (baselineExists) {
  baselineSnapshot = await readJson(BASELINE_PATH)
}

let reportPayload
if (args.refreshBaseline || !baselineSnapshot) {
  reportPayload = buildBootstrapPayload({
    generatedAt: nowIso,
    snapshot: currentSnapshot,
    jurisdictionCapability,
    baselineReason: args.refreshBaseline ? 'baseline refreshed by flag' : 'baseline initialized because none existed',
    durationMs: Date.now() - startedAt,
  })

  if (!args.noWrite) {
    await writeJson(BASELINE_PATH, currentSnapshot)
    await writeOutputs(reportPayload)
  }

  console.log('[legal-advisory] Baseline written.')
  console.log(`[legal-advisory] Jurisdictions tracked: ${currentSnapshot.jurisdictionCount}`)
  console.log(`[legal-advisory] Tables tracked: ${Object.keys(currentSnapshot.tables).length}`)
  if (!args.noWrite) {
    console.log('[legal-advisory] Wrote docs/legal-advisory/baseline.json')
    console.log('[legal-advisory] Wrote docs/legal-advisory/current-snapshot.json')
    console.log('[legal-advisory] Wrote docs/legal-advisory/latest.json')
    console.log('[legal-advisory] Wrote docs/legal-advisory/latest-report.md')
  }
  process.exit(0)
}

const diff = diffSnapshots(baselineSnapshot, currentSnapshot)
reportPayload = {
  mode: 'diff',
  generatedAt: nowIso,
  durationMs: Date.now() - startedAt,
  baselineGeneratedAt: baselineSnapshot.generatedAt || null,
  currentGeneratedAt: currentSnapshot.generatedAt,
  summary: diff.summary,
  coverage: currentSnapshot.coverage,
  jurisdictionCapability,
  tableChanges: diff.tableChanges,
  recommendations: buildRecommendations(diff.summary),
}

if (!args.noWrite) {
  await writeOutputs(reportPayload)
  if (args.updateBaseline) {
    await writeJson(BASELINE_PATH, currentSnapshot)
  }
}

console.log(`[legal-advisory] Tables changed: ${diff.summary.changedTables}`)
console.log(`[legal-advisory] High impact changes: ${diff.summary.highImpactChanges}`)
console.log(`[legal-advisory] Coverage regressions: ${diff.summary.coverageRegressions}`)
if (!args.noWrite) {
  console.log('[legal-advisory] Wrote docs/legal-advisory/latest.json')
  console.log('[legal-advisory] Wrote docs/legal-advisory/latest-report.md')
  if (args.updateBaseline) {
    console.log('[legal-advisory] Updated docs/legal-advisory/baseline.json')
  }
}

async function buildSnapshot(generatedAt) {
  const statesModule = await importFresh(STATES_PATH)
  const states = Array.isArray(statesModule.default) ? statesModule.default : []
  const jurisdictionAbbrs = [...new Set(states.map((row) => sanitizeAbbr(row?.abbr)).filter(Boolean))].sort()

  const files = (await readdir(LEGAL_DIR))
    .filter((name) => name.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b))

  const tables = {}
  for (const file of files) {
    const abs = resolve(LEGAL_DIR, file)
    const mod = await importFresh(abs)
    const data = Array.isArray(mod.default) ? mod.default : []

    const rowsByAbbr = {}
    const duplicates = new Set()
    let invalidRows = 0

    for (const rawRow of data) {
      const normalizedRow = normalizeValue(rawRow)
      const abbr = sanitizeAbbr(normalizedRow?.abbr)
      if (!abbr) {
        invalidRows += 1
        continue
      }
      if (rowsByAbbr[abbr]) {
        duplicates.add(abbr)
      }
      rowsByAbbr[abbr] = normalizedRow
    }

    const uniqueAbbrs = Object.keys(rowsByAbbr).sort()
    const missingJurisdictions = jurisdictionAbbrs.filter((abbr) => !uniqueAbbrs.includes(abbr))

    tables[file] = {
      rowCount: data.length,
      uniqueAbbrCount: uniqueAbbrs.length,
      invalidRows,
      duplicateAbbrs: [...duplicates].sort(),
      missingJurisdictions,
      hash: sha256(stableStringify(rowsByAbbr)),
      rowsByAbbr,
    }
  }

  const coverage = Object.entries(tables).map(([file, table]) => ({
    file,
    rowCount: table.rowCount,
    uniqueAbbrCount: table.uniqueAbbrCount,
    missingCount: table.missingJurisdictions.length,
    missingJurisdictions: table.missingJurisdictions,
    duplicateAbbrs: table.duplicateAbbrs,
  }))

  return {
    generatedAt,
    jurisdictionCount: jurisdictionAbbrs.length,
    jurisdictions: jurisdictionAbbrs,
    tableCount: Object.keys(tables).length,
    tables,
    coverage,
  }
}

function diffSnapshots(baseline, current) {
  const baselineTables = new Set(Object.keys(baseline.tables || {}))
  const currentTables = new Set(Object.keys(current.tables || {}))

  const allTableNames = [...new Set([...baselineTables, ...currentTables])].sort((a, b) => a.localeCompare(b))
  const tableChanges = []

  const severityCounts = { high: 0, medium: 0, low: 0 }
  const areaCounts = {}
  let changedTables = 0
  let highImpactChanges = 0
  let coverageRegressions = 0

  for (const file of allTableNames) {
    const before = baseline.tables?.[file] || null
    const after = current.tables?.[file] || null

    if (!before && after) {
      changedTables += 1
      highImpactChanges += 1
      severityCounts.high += 1
      bump(areaCounts, impactAreaForFile(file))
      tableChanges.push({
        file,
        type: 'table-added',
        severity: 'high',
        impactArea: impactAreaForFile(file),
        detail: 'New legal advisory table added.',
        rowAdds: Object.keys(after.rowsByAbbr || {}).sort(),
        rowRemovals: [],
        rowChanges: [],
        missingBefore: [],
        missingAfter: after.missingJurisdictions || [],
      })
      if ((after.missingJurisdictions || []).length > 0) {
        coverageRegressions += 1
      }
      continue
    }

    if (before && !after) {
      changedTables += 1
      highImpactChanges += 1
      severityCounts.high += 1
      bump(areaCounts, impactAreaForFile(file))
      coverageRegressions += 1
      tableChanges.push({
        file,
        type: 'table-removed',
        severity: 'high',
        impactArea: impactAreaForFile(file),
        detail: 'Legal advisory table removed.',
        rowAdds: [],
        rowRemovals: Object.keys(before.rowsByAbbr || {}).sort(),
        rowChanges: [],
        missingBefore: before.missingJurisdictions || [],
        missingAfter: ['ALL'],
      })
      continue
    }

    if (!before || !after) {
      continue
    }

    if (before.hash === after.hash) {
      continue
    }

    changedTables += 1

    const beforeRows = before.rowsByAbbr || {}
    const afterRows = after.rowsByAbbr || {}
    const beforeAbbrs = new Set(Object.keys(beforeRows))
    const afterAbbrs = new Set(Object.keys(afterRows))

    const rowAdds = [...afterAbbrs].filter((abbr) => !beforeAbbrs.has(abbr)).sort()
    const rowRemovals = [...beforeAbbrs].filter((abbr) => !afterAbbrs.has(abbr)).sort()

    const rowChanges = []
    for (const abbr of [...afterAbbrs].filter((x) => beforeAbbrs.has(x)).sort()) {
      const beforeRow = beforeRows[abbr]
      const afterRow = afterRows[abbr]
      const changedFields = diffRowFields(beforeRow, afterRow)
      if (changedFields.length === 0) continue

      const severity = severityForChange({ file, changedFields, rowAdded: false, rowRemoved: false })
      const impactArea = impactAreaForChange(file, changedFields)
      rowChanges.push({ abbr, changedFields, severity, impactArea })
      severityCounts[severity] += 1
      if (severity === 'high') {
        highImpactChanges += 1
      }
      bump(areaCounts, impactArea)
    }

    for (const _abbr of rowAdds) {
      const severity = severityForChange({ file, changedFields: [], rowAdded: true, rowRemoved: false })
      const impactArea = impactAreaForFile(file)
      severityCounts[severity] += 1
      if (severity === 'high') {
        highImpactChanges += 1
      }
      bump(areaCounts, impactArea)
    }

    for (const _abbr of rowRemovals) {
      const severity = severityForChange({ file, changedFields: [], rowAdded: false, rowRemoved: true })
      const impactArea = impactAreaForFile(file)
      severityCounts[severity] += 1
      if (severity === 'high') {
        highImpactChanges += 1
      }
      bump(areaCounts, impactArea)
    }

    const missingBefore = before.missingJurisdictions || []
    const missingAfter = after.missingJurisdictions || []
    if (missingAfter.length > missingBefore.length || (missingAfter.length > 0 && missingBefore.length === 0)) {
      coverageRegressions += 1
    }

    tableChanges.push({
      file,
      type: 'table-changed',
      severity: rowChanges.some((x) => x.severity === 'high') || rowRemovals.length > 0 ? 'high' : rowChanges.some((x) => x.severity === 'medium') || rowAdds.length > 0 ? 'medium' : 'low',
      impactArea: impactAreaForFile(file),
      detail: 'Rows and/or fields changed compared to baseline.',
      rowAdds,
      rowRemovals,
      rowChanges,
      missingBefore,
      missingAfter,
    })
  }

  const summary = {
    tableCount: Object.keys(current.tables || {}).length,
    changedTables,
    highImpactChanges,
    coverageRegressions,
    severityCounts,
    areaCounts,
  }

  return { summary, tableChanges }
}

function diffRowFields(beforeRow, afterRow) {
  const before = beforeRow && typeof beforeRow === 'object' ? beforeRow : {}
  const after = afterRow && typeof afterRow === 'object' ? afterRow : {}

  const fields = []
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort((a, b) => a.localeCompare(b))

  for (const key of keys) {
    const prev = before[key]
    const next = after[key]
    if (stableStringify(prev) !== stableStringify(next)) {
      fields.push(key)
    }
  }

  return fields
}

function severityForChange({ file, changedFields, rowAdded, rowRemoved }) {
  if (rowRemoved) return 'high'
  if (rowAdded) return 'medium'

  const lowerFile = file.toLowerCase()
  if (lowerFile.includes('licensing') || lowerFile.includes('permit') || lowerFile.includes('lien') || lowerFile.includes('workers') || lowerFile.includes('prompt')) {
    if (changedFields.some((field) => isCriticalField(field))) {
      return 'high'
    }
    return 'medium'
  }

  if (changedFields.some((field) => isCriticalField(field))) {
    return 'medium'
  }

  return 'low'
}

function isCriticalField(fieldName) {
  const field = String(fieldName || '')
  const lower = field.toLowerCase()
  return CRITICAL_FIELD_TOKENS.some((token) => lower.includes(token.toLowerCase()))
}

function impactAreaForChange(file, changedFields) {
  const fileArea = impactAreaForFile(file)
  if (fileArea !== 'general') return fileArea

  const joined = changedFields.join('|').toLowerCase()
  if (joined.includes('license') || joined.includes('bond') || joined.includes('insurance')) return 'licensing-insurance'
  if (joined.includes('lien') || joined.includes('pay') || joined.includes('retainage') || joined.includes('interest')) return 'payment-liability'
  if (joined.includes('osha') || joined.includes('safety') || joined.includes('workers')) return 'labor-safety'
  if (joined.includes('permit') || joined.includes('utility') || joined.includes('depth') || joined.includes('environment')) return 'permits-sitework'
  if (joined.includes('contract') || joined.includes('claim') || joined.includes('citation')) return 'contract-risk'
  return 'general'
}

function impactAreaForFile(file) {
  const lower = file.toLowerCase()
  if (lower.includes('licensing')) return 'licensing-insurance'
  if (lower.includes('lien') || lower.includes('prompt')) return 'payment-liability'
  if (lower.includes('workers') || lower.includes('safety')) return 'labor-safety'
  if (lower.includes('permit') || lower.includes('utility') || lower.includes('depth') || lower.includes('environmental') || lower.includes('roads')) {
    return 'permits-sitework'
  }
  if (lower.includes('contract')) return 'contract-risk'
  return 'general'
}

function buildBootstrapPayload({ generatedAt, snapshot, baselineReason, durationMs }) {
  return {
    mode: 'baseline-bootstrap',
    generatedAt,
    durationMs,
    baselineReason,
    summary: {
      tableCount: snapshot.tableCount,
      changedTables: 0,
      highImpactChanges: 0,
      coverageRegressions: snapshot.coverage.some((row) => row.missingCount > 0) ? 1 : 0,
      severityCounts: { high: 0, medium: 0, low: 0 },
      areaCounts: {},
    },
    coverage: snapshot.coverage,
    jurisdictionCapability,
    tableChanges: [],
    recommendations: [
      'Baseline initialized. Future runs will report legal advisory deltas and impact.',
      'Keep baseline in CI cache to compare each run against the previous snapshot.',
    ],
  }
}

function buildJurisdictionCapability(snapshot) {
  const jurisdictions = Array.isArray(snapshot.jurisdictions) ? snapshot.jurisdictions : []
  const tables = snapshot.tables && typeof snapshot.tables === 'object' ? snapshot.tables : {}
  const tableNames = Object.keys(tables)
  const tableCount = tableNames.length || 1

  const byJurisdiction = jurisdictions.map((abbr) => {
    let presentRows = 0
    let criticalTables = 0
    const missingTables = []

    for (const tableName of tableNames) {
      const row = tables[tableName]?.rowsByAbbr?.[abbr]
      if (!row || typeof row !== 'object') {
        missingTables.push(tableName)
        continue
      }
      presentRows += 1
      if (hasCriticalSignal(row)) {
        criticalTables += 1
      }
    }

    const coveragePct = round2((presentRows / tableCount) * 100)
    const criticalSignalPct = round2((criticalTables / tableCount) * 100)
    const capabilityScore = round2((coveragePct * 0.8) + (criticalSignalPct * 0.2))

    return {
      abbr,
      presentRows,
      missingRows: tableCount - presentRows,
      coveragePct,
      criticalSignalPct,
      capabilityScore,
      tier: capabilityTier(capabilityScore),
      missingTables,
    }
  })

  const sortedWeakest = [...byJurisdiction]
    .sort((a, b) => a.capabilityScore - b.capabilityScore)
    .slice(0, 10)

  const summary = {
    jurisdictionCount: byJurisdiction.length,
    tableCount,
    averageCapabilityScore: round2(byJurisdiction.reduce((sum, row) => sum + row.capabilityScore, 0) / Math.max(byJurisdiction.length, 1)),
    tierCounts: {
      high: byJurisdiction.filter((x) => x.tier === 'high').length,
      medium: byJurisdiction.filter((x) => x.tier === 'medium').length,
      baseline: byJurisdiction.filter((x) => x.tier === 'baseline').length,
    },
    weakestJurisdictions: sortedWeakest.map((row) => ({
      abbr: row.abbr,
      capabilityScore: row.capabilityScore,
      tier: row.tier,
      missingRows: row.missingRows,
    })),
  }

  return { summary, byJurisdiction }
}

function hasCriticalSignal(value) {
  if (!value || typeof value !== 'object') return false
  const stack = [value]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    for (const [key, val] of Object.entries(current)) {
      if (isCriticalField(key) && hasNonEmptyValue(val)) return true
      if (val && typeof val === 'object') stack.push(val)
    }
  }
  return false
}

function hasNonEmptyValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.some((item) => hasNonEmptyValue(item))
  if (typeof value === 'object') return Object.values(value).some((item) => hasNonEmptyValue(item))
  return false
}

function capabilityTier(score) {
  if (score >= 90) return 'high'
  if (score >= 75) return 'medium'
  return 'baseline'
}

function round2(value) {
  return Number(Number(value || 0).toFixed(2))
}

function buildRecommendations(summary) {
  const out = []
  if (summary.coverageRegressions > 0) {
    out.push('Coverage regression detected. Restore missing jurisdiction rows before relying on advisory output.')
  }
  if (summary.highImpactChanges > 0) {
    out.push('High-impact legal field changes detected. Review counsel-facing citations and update operational guardrails.')
  }
  if (summary.changedTables > 0 && summary.highImpactChanges === 0) {
    out.push('Changes detected with no high-impact flags. Review medium-impact updates for schedule and bid assumptions.')
  }
  if (summary.changedTables === 0) {
    out.push('No legal advisory changes detected compared to baseline.')
  }
  out.push('Treat this report as advisory operations intelligence, not legal advice.')
  return out
}

async function writeOutputs(payload) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await mkdir(HISTORY_DIR, { recursive: true })

  const report = buildMarkdownReport(payload)
  const stamp = toTimestamp(payload.generatedAt)
  const historyPath = resolve(HISTORY_DIR, `${stamp}.json`)

  await Promise.all([
    writeJson(LATEST_JSON_PATH, payload),
    writeFile(LATEST_REPORT_PATH, report, 'utf8'),
    writeJson(historyPath, payload),
  ])
}

function buildMarkdownReport(payload) {
  const lines = []
  lines.push('# Legal Advisory Change Report')
  lines.push('')
  lines.push(`Generated at: ${payload.generatedAt}`)
  if (payload.baselineGeneratedAt) {
    lines.push(`Baseline: ${payload.baselineGeneratedAt}`)
  }
  lines.push(`Mode: ${payload.mode}`)
  lines.push('')

  lines.push('## Summary')
  lines.push('')
  lines.push(`- Tables tracked: ${payload.summary.tableCount}`)
  lines.push(`- Tables changed: ${payload.summary.changedTables}`)
  lines.push(`- High-impact changes: ${payload.summary.highImpactChanges}`)
  lines.push(`- Coverage regressions: ${payload.summary.coverageRegressions}`)
  lines.push(`- Severity counts: high=${payload.summary.severityCounts.high}, medium=${payload.summary.severityCounts.medium}, low=${payload.summary.severityCounts.low}`)

  const areaPairs = Object.entries(payload.summary.areaCounts || {}).sort((a, b) => a[0].localeCompare(b[0]))
  if (areaPairs.length > 0) {
    lines.push(`- Impact areas: ${areaPairs.map(([k, v]) => `${k}:${v}`).join(', ')}`)
  }
  lines.push('')

  lines.push('## Coverage')
  lines.push('')
  lines.push('| Table | Rows | Unique Abbr | Missing | Duplicates |')
  lines.push('| --- | ---: | ---: | --- | --- |')
  for (const row of (payload.coverage || []).slice().sort((a, b) => a.file.localeCompare(b.file))) {
    const missing = row.missingJurisdictions?.length ? row.missingJurisdictions.join(', ') : 'none'
    const dupes = row.duplicateAbbrs?.length ? row.duplicateAbbrs.join(', ') : 'none'
    lines.push(`| ${row.file} | ${row.rowCount} | ${row.uniqueAbbrCount} | ${missing} | ${dupes} |`)
  }
  lines.push('')

  if (payload.jurisdictionCapability?.summary) {
    lines.push('## Jurisdiction Capability')
    lines.push('')
    lines.push(`- Jurisdictions scored: ${payload.jurisdictionCapability.summary.jurisdictionCount}`)
    lines.push(`- Average capability score: ${payload.jurisdictionCapability.summary.averageCapabilityScore}`)
    lines.push(`- Tier counts: high=${payload.jurisdictionCapability.summary.tierCounts.high}, medium=${payload.jurisdictionCapability.summary.tierCounts.medium}, baseline=${payload.jurisdictionCapability.summary.tierCounts.baseline}`)
    lines.push('')
    lines.push('| Jurisdiction | Capability Score | Tier | Missing Rows |')
    lines.push('| --- | ---: | --- | ---: |')
    for (const row of (payload.jurisdictionCapability.summary.weakestJurisdictions || [])) {
      lines.push(`| ${row.abbr} | ${row.capabilityScore} | ${row.tier} | ${row.missingRows} |`)
    }
    lines.push('')
  }

  lines.push('## Changes')
  lines.push('')
  if (!payload.tableChanges || payload.tableChanges.length === 0) {
    lines.push('- No table deltas detected against baseline.')
  } else {
    for (const item of payload.tableChanges) {
      lines.push(`- ${item.file} | type=${item.type} | severity=${item.severity} | area=${item.impactArea}`)
      if (item.rowAdds?.length) {
        lines.push(`  row adds: ${item.rowAdds.join(', ')}`)
      }
      if (item.rowRemovals?.length) {
        lines.push(`  row removals: ${item.rowRemovals.join(', ')}`)
      }
      if (item.rowChanges?.length) {
        const sample = item.rowChanges
          .slice(0, 8)
          .map((row) => `${row.abbr}(${row.severity}:${row.changedFields.join('/')})`)
          .join('; ')
        lines.push(`  row field changes (sample): ${sample}`)
      }
      if ((item.missingBefore?.length || 0) !== (item.missingAfter?.length || 0)) {
        const before = item.missingBefore?.length ? item.missingBefore.join(', ') : 'none'
        const after = item.missingAfter?.length ? item.missingAfter.join(', ') : 'none'
        lines.push(`  missing jurisdictions before->after: ${before} -> ${after}`)
      }
    }
  }
  lines.push('')

  lines.push('## Recommended Actions')
  lines.push('')
  for (const rec of payload.recommendations || []) {
    lines.push(`- ${rec}`)
  }
  lines.push('')

  lines.push('## Advisory Notice')
  lines.push('')
  lines.push('- This report supports operational legal/compliance advisory workflows and is not legal advice.')

  return `${lines.join('\n')}\n`
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeValue(item))
    const allPrimitive = normalized.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))
    if (allPrimitive) {
      return [...normalized].sort((a, b) => String(a).localeCompare(String(b)))
    }
    return normalized
  }

  if (value && typeof value === 'object') {
    const out = {}
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b))
    for (const key of keys) {
      out[key] = normalizeValue(value[key])
    }
    return out
  }

  return value
}

function sanitizeAbbr(value) {
  if (!value) return ''
  return String(value).trim().toUpperCase()
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b))
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
  return `{${pairs.join(',')}}`
}

function sha256(input) {
  return createHash('sha256').update(input).digest('hex')
}

function bump(map, key) {
  map[key] = (map[key] || 0) + 1
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(path, payload) {
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function importFresh(absPath) {
  const href = pathToFileURL(absPath).href
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return import(`${href}?v=${nonce}`)
}

function toTimestamp(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function parseArgs(argv) {
  const out = {
    help: false,
    noWrite: false,
    refreshBaseline: false,
    updateBaseline: false,
  }

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      out.help = true
      continue
    }
    if (arg === '--no-write') {
      out.noWrite = true
      continue
    }
    if (arg === '--refresh-baseline') {
      out.refreshBaseline = true
      continue
    }
    if (arg === '--update-baseline') {
      out.updateBaseline = true
    }
  }

  return out
}

function printHelp() {
  console.log('Usage: node scripts/legal-advisory-change-report.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --no-write          Run analysis without writing files')
  console.log('  --refresh-baseline  Replace baseline with current snapshot and exit')
  console.log('  --update-baseline   After diff run, write current snapshot as new baseline')
  console.log('  -h, --help          Show this help message')
}
