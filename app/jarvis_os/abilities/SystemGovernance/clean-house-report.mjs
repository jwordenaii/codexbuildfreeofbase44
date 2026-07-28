#!/usr/bin/env node
/**
 * clean-house-report.mjs
 *
 * Generates a non-destructive cleanup report from current git status so work
 * can be grouped into safe commits without losing legacy logic.
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { extname, resolve } from 'node:path'

const ROOT = process.cwd()
const OUTPUT_DIR = resolve(ROOT, 'docs/clean-house')
const REPORT_PATH = resolve(OUTPUT_DIR, 'latest-report.md')
const JSON_PATH = resolve(OUTPUT_DIR, 'latest.json')

const HIGH_RISK_PATTERNS = [
  /^app\/main\.py$/,
  /^src\/App\.jsx$/,
  /^src\/main\.jsx$/,
  /^package\.json$/,
  /^requirements\.txt$/,
  /^netlify\.toml$/,
  /^\.github\/workflows\/.+\.ya?ml$/,
]

const MEDIUM_RISK_PATTERNS = [
  /^app\/(routers|services|tasks|core)\//,
  /^src\/(pages|lib|components|hooks)\//,
  /^scripts\//,
  /^tests\//,
]

const TEXT_EXTENSIONS = new Set([
  '.py',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.toml',
  '.yml',
  '.yaml',
  '.md',
  '.txt',
  '.ini',
  '.cfg',
  '.ps1',
  '.sh',
  '.sql',
  '.html',
  '.css',
  '.xml',
])

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

const generatedAt = new Date().toISOString()
const statusOutput = safeGitRaw(['status', '--porcelain'])
const rows = parseStatusRows(statusOutput)
const enriched = await Promise.all(rows.map((row) => enrichRow(row)))

const byArea = countBy(enriched, (row) => row.area)
const byRisk = countBy(enriched, (row) => row.risk)
const byKind = countBy(enriched, (row) => row.kind)

const conflictMarkers = await findConflictMarkers(enriched)
const largeFiles = enriched
  .filter((row) => typeof row.bytes === 'number')
  .filter((row) => row.bytes >= args.largeFileThresholdBytes)
  .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))

const payload = {
  generatedAt,
  branch: safeGit(['branch', '--show-current']),
  head: safeGit(['rev-parse', '--short', 'HEAD']),
  remoteOrigin: safeGit(['remote', 'get-url', 'origin']),
  totals: {
    changedPaths: enriched.length,
    byArea,
    byRisk,
    byKind,
    conflictMarkerFiles: conflictMarkers.length,
    largeChangedFiles: largeFiles.length,
  },
  conflictMarkers,
  largeFiles,
  entries: enriched,
}

const report = buildReport(payload, args.largeFileThresholdBytes)

if (!args.noWrite) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await Promise.all([
    writeFile(REPORT_PATH, report, 'utf8'),
    writeFile(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
  ])
}

console.log(`[clean-house] Changed paths: ${enriched.length}`)
console.log(`[clean-house] High-risk paths: ${byRisk.high || 0}`)
console.log(`[clean-house] Conflict marker files: ${conflictMarkers.length}`)
console.log(`[clean-house] Large changed files (>= ${args.largeFileThresholdBytes} bytes): ${largeFiles.length}`)
if (!args.noWrite) {
  console.log('[clean-house] Wrote docs/clean-house/latest-report.md')
  console.log('[clean-house] Wrote docs/clean-house/latest.json')
}

function parseArgs(input) {
  const out = {
    help: false,
    noWrite: false,
    largeFileThresholdBytes: 1_000_000,
  }

  for (const arg of input) {
    if (arg === '--help' || arg === '-h') {
      out.help = true
      continue
    }
    if (arg === '--no-write') {
      out.noWrite = true
      continue
    }
    if (arg.startsWith('--large-bytes=')) {
      const value = Number.parseInt(arg.split('=')[1], 10)
      if (Number.isFinite(value) && value > 0) {
        out.largeFileThresholdBytes = value
      }
    }
  }

  return out
}

function printHelp() {
  console.log(`Usage: node scripts/clean-house-report.mjs [options]\n\nOptions:\n  --no-write            Run analysis without writing files\n  --large-bytes=<n>     Threshold for large changed files (default: 1000000)\n  -h, --help            Show this help message`)
}

function parseStatusRows(output) {
  if (!output) return []

  const lines = output.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean)
  return lines.map((line) => {
    const x = line[0]
    const y = line[1]
    const rawPath = line.slice(3).trim()
    const path = rawPath.includes(' -> ') ? rawPath.split(' -> ')[1].trim() : rawPath

    return {
      raw: line,
      x,
      y,
      path: normalizePath(path),
      kind: classifyKind(x, y),
      area: classifyArea(path),
      risk: classifyRisk(path),
      staged: x !== ' ' && x !== '?',
      unstaged: y !== ' ' && y !== '?',
    }
  })
}

function classifyKind(x, y) {
  if (x === '?' && y === '?') return 'untracked'
  if (x === 'U' || y === 'U') return 'conflict'
  if (x === 'D' || y === 'D') return 'deleted'
  if (x === 'R' || y === 'R') return 'renamed'
  if (x === 'A' || y === 'A') return 'added'
  if (x === 'M' || y === 'M') return 'modified'
  return 'other'
}

function classifyArea(path) {
  const normalized = normalizePath(path)
  if (normalized.startsWith('app/')) return 'backend'
  if (normalized.startsWith('src/')) return 'frontend'
  if (normalized.startsWith('scripts/')) return 'tooling'
  if (normalized.startsWith('docs/')) return 'docs'
  if (normalized.startsWith('.github/workflows/')) return 'ci'
  if (normalized.startsWith('tests/')) return 'tests'
  if (normalized.startsWith('public/')) return 'public'
  return 'root-or-other'
}

function classifyRisk(path) {
  const normalized = normalizePath(path)
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'high'
  }
  if (MEDIUM_RISK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'medium'
  }
  return 'low'
}

async function enrichRow(row) {
  const abs = resolve(ROOT, row.path)
  const withMeta = { ...row, bytes: null, exists: false }

  try {
    const info = await stat(abs)
    withMeta.exists = info.isFile()
    if (info.isFile()) {
      withMeta.bytes = info.size
      withMeta.extension = extname(row.path).toLowerCase()
    }
  } catch {
    withMeta.exists = false
  }

  return withMeta
}

async function findConflictMarkers(rows) {
  const candidates = rows
    .filter((row) => row.exists)
    .filter((row) => row.bytes !== null && row.bytes <= 1_000_000)
    .filter((row) => TEXT_EXTENSIONS.has((row.extension || '').toLowerCase()))

  const results = []
  for (const row of candidates) {
    try {
      const raw = await readFile(resolve(ROOT, row.path), 'utf8')
      if (hasMergeConflictMarkers(raw)) {
        results.push(row.path)
      }
    } catch {
      // Ignore unreadable files.
    }
  }

  return results
}

function hasMergeConflictMarkers(content) {
  const lines = content.split(/\r?\n/)
  let hasStart = false
  let hasMiddle = false
  let hasEnd = false

  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('<<<<<<< ')) {
      hasStart = true
      continue
    }
    if (trimmed === '=======') {
      hasMiddle = true
      continue
    }
    if (trimmed.startsWith('>>>>>>> ')) {
      hasEnd = true
      continue
    }
  }

  return hasStart && hasMiddle && hasEnd
}

function countBy(items, keyFn) {
  const out = {}
  for (const item of items) {
    const key = keyFn(item)
    out[key] = (out[key] || 0) + 1
  }
  return out
}

function buildReport(payload, largeThreshold) {
  const lines = []
  lines.push('# Clean House Report')
  lines.push('')
  lines.push(`Generated: ${payload.generatedAt}`)
  lines.push(`Branch: ${payload.branch || 'unknown'}`)
  lines.push(`HEAD: ${payload.head || 'unknown'}`)
  lines.push(`Changed paths: ${payload.totals.changedPaths}`)
  lines.push('')

  lines.push('## Counts By Area')
  lines.push('')
  lines.push('| Area | Count |')
  lines.push('|---|---:|')
  for (const [area, count] of Object.entries(payload.totals.byArea).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${area} | ${count} |`)
  }
  lines.push('')

  lines.push('## Counts By Risk')
  lines.push('')
  lines.push('| Risk | Count |')
  lines.push('|---|---:|')
  for (const [risk, count] of Object.entries(payload.totals.byRisk).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${risk} | ${count} |`)
  }
  lines.push('')

  lines.push('## Counts By Change Kind')
  lines.push('')
  lines.push('| Kind | Count |')
  lines.push('|---|---:|')
  for (const [kind, count] of Object.entries(payload.totals.byKind).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${kind} | ${count} |`)
  }
  lines.push('')

  lines.push('## High-Risk Changed Paths')
  lines.push('')
  const highRisk = payload.entries.filter((entry) => entry.risk === 'high')
  if (highRisk.length === 0) {
    lines.push('No high-risk paths are currently changed.')
  } else {
    for (const entry of highRisk) {
      lines.push(`- ${entry.path} (${entry.kind})`)
    }
  }
  lines.push('')

  lines.push('## Conflict Markers')
  lines.push('')
  if (payload.conflictMarkers.length === 0) {
    lines.push('No merge conflict markers detected in changed text files.')
  } else {
    for (const path of payload.conflictMarkers) {
      lines.push(`- ${path}`)
    }
  }
  lines.push('')

  lines.push(`## Large Changed Files (>= ${largeThreshold} bytes)`)
  lines.push('')
  if (payload.largeFiles.length === 0) {
    lines.push('No changed files exceed the large-file threshold.')
  } else {
    lines.push('| File | Bytes | Kind | Area |')
    lines.push('|---|---:|---|---|')
    for (const file of payload.largeFiles.slice(0, 50)) {
      lines.push(`| ${file.path} | ${file.bytes} | ${file.kind} | ${file.area} |`)
    }
  }
  lines.push('')

  lines.push('## Safe Batch Commit Sequence')
  lines.push('')
  lines.push('1. Commit CI and root config changes separately (high-risk first).')
  lines.push('2. Commit backend changes by domain (routers/services/tasks) with tests per batch.')
  lines.push('3. Commit frontend changes by route area (App/router, shared components, feature pages).')
  lines.push('4. Commit tooling and docs after code changes are validated.')
  lines.push('5. Keep generated files and local database files out of logic commits.')
  lines.push('')

  lines.push('## Preserve-Legacy Rule')
  lines.push('')
  lines.push('Before deleting any older logic path, map replacement files and run feature-level smoke tests.')
  lines.push('If behavior is uncertain, keep old path behind a feature flag until replacement is verified.')

  return lines.join('\n')
}

function safeGit(args) {
  return safeGitRaw(args).trim()
}

function safeGitRaw(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    })
  } catch {
    return ''
  }
}

function normalizePath(input) {
  return input.replaceAll('\\', '/')
}
