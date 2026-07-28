#!/usr/bin/env node
/**
 * logic-preserve-snapshot.mjs
 *
 * Captures a deterministic snapshot of logic-bearing files so behavior can be
 * preserved while cleanup and restructuring work happens in safe batches.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { extname, join, relative, resolve } from 'node:path'

const ROOT = process.cwd()
const OUTPUT_DIR = resolve(ROOT, 'docs/logic-preservation')
const HISTORY_DIR = resolve(OUTPUT_DIR, 'history')
const SNAPSHOT_PATH = resolve(OUTPUT_DIR, 'latest-snapshot.json')
const SUMMARY_PATH = resolve(OUTPUT_DIR, 'latest-summary.md')
const CATALOG_JSON_PATH = resolve(OUTPUT_DIR, 'logic-catalog.json')
const CATALOG_MD_PATH = resolve(OUTPUT_DIR, 'logic-catalog.md')
const NEW_LIST_PATH = resolve(OUTPUT_DIR, 'new-logic-files.txt')
const OLD_LIST_PATH = resolve(OUTPUT_DIR, 'old-logic-files.txt')
const MODIFIED_OLD_LIST_PATH = resolve(OUTPUT_DIR, 'modified-old-logic-files.txt')

const INCLUDE_ROOTS = ['app', 'src', 'scripts', 'tests', 'alembic', 'docs/dev-notebook']
const INCLUDE_FILES = [
  'package.json',
  'requirements.txt',
  'netlify.toml',
  'railway.json',
  'docker-compose.yml',
  'Dockerfile',
  'alembic.ini',
  'vite.config.js',
  'eslint.config.js',
  'tailwind.config.js',
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

const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'test-results',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
])

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

const startedAt = Date.now()
const statusOutput = safeGitRaw(['status', '--porcelain'])
const trackedPaths = buildPathSet(safeGit(['ls-files']))
const statusMap = parseStatusMap(statusOutput)

const files = await collectSnapshotFiles()
const baseRecords = await Promise.all(files.map((file) => buildRecord(file)))
const records = baseRecords
  .map((record) => {
    const status = statusMap.get(record.path)
    const tracked = trackedPaths.has(record.path)
    return {
      ...record,
      tracked,
      logicAge: tracked ? 'old' : 'new',
      gitStatus: status ? status.kind : 'clean',
    }
  })
  .sort((a, b) => a.path.localeCompare(b.path))

const oldLogicFiles = records.filter((record) => record.logicAge === 'old')
const newLogicFiles = records.filter((record) => record.logicAge === 'new')
const modifiedOldLogicFiles = oldLogicFiles.filter((record) => record.gitStatus !== 'clean')

const totalBytes = records.reduce((sum, item) => sum + item.bytes, 0)
const generatedAt = new Date().toISOString()
const timestamp = toTimestamp(generatedAt)

const gitMeta = {
  branch: safeGit(['branch', '--show-current']),
  head: safeGit(['rev-parse', '--short', 'HEAD']),
  remoteOrigin: safeGit(['remote', 'get-url', 'origin']),
  dirtyPaths: parseDirtyPaths(statusOutput),
}

const logicAgeCounts = countBy(records, (file) => file.logicAge)
const gitStatusCounts = countBy(records, (file) => file.gitStatus)

const payload = {
  generatedAt,
  durationMs: Date.now() - startedAt,
  root: ROOT,
  includeRoots: INCLUDE_ROOTS,
  includeFiles: INCLUDE_FILES,
  fileCount: records.length,
  oldLogicCount: oldLogicFiles.length,
  newLogicCount: newLogicFiles.length,
  totalBytes,
  logicAgeCounts,
  gitStatusCounts,
  files: records,
  git: {
    branch: gitMeta.branch,
    head: gitMeta.head,
    remoteOrigin: gitMeta.remoteOrigin,
    dirtyCount: gitMeta.dirtyPaths.length,
    dirtyPaths: gitMeta.dirtyPaths,
  },
}

const catalogPayload = {
  generatedAt,
  branch: gitMeta.branch,
  head: gitMeta.head,
  remoteOrigin: gitMeta.remoteOrigin,
  totals: {
    allLogicFiles: records.length,
    oldLogicFiles: oldLogicFiles.length,
    newLogicFiles: newLogicFiles.length,
    modifiedOldLogicFiles: modifiedOldLogicFiles.length,
    byGitStatus: gitStatusCounts,
  },
  newLogicFiles,
  oldLogicFiles,
  modifiedOldLogicFiles,
}

const summary = buildSummary(payload)
const catalogMarkdown = buildCatalogMarkdown(catalogPayload)
const newListText = buildPathList(newLogicFiles)
const oldListText = buildPathList(oldLogicFiles)
const modifiedOldListText = buildPathList(modifiedOldLogicFiles)

if (!args.noWrite) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  if (!args.noHistory) {
    await mkdir(HISTORY_DIR, { recursive: true })
  }

  await Promise.all([
    writeJson(SNAPSHOT_PATH, payload),
    writeFile(SUMMARY_PATH, summary, 'utf8'),
    writeJson(CATALOG_JSON_PATH, catalogPayload),
    writeFile(CATALOG_MD_PATH, catalogMarkdown, 'utf8'),
    writeFile(NEW_LIST_PATH, newListText, 'utf8'),
    writeFile(OLD_LIST_PATH, oldListText, 'utf8'),
    writeFile(MODIFIED_OLD_LIST_PATH, modifiedOldListText, 'utf8'),
    args.noHistory
      ? Promise.resolve()
      : writeJson(resolve(HISTORY_DIR, `${timestamp}.json`), payload),
  ])
}

console.log(`[logic-snapshot] Files captured: ${records.length}`)
console.log(`[logic-snapshot] Old logic files: ${oldLogicFiles.length}`)
console.log(`[logic-snapshot] New logic files: ${newLogicFiles.length}`)
console.log(`[logic-snapshot] Total bytes: ${totalBytes}`)
console.log(`[logic-snapshot] Dirty paths in git status: ${gitMeta.dirtyPaths.length}`)
if (!args.noWrite) {
  console.log(`[logic-snapshot] Wrote ${relativePath(SNAPSHOT_PATH)}`)
  console.log(`[logic-snapshot] Wrote ${relativePath(SUMMARY_PATH)}`)
  console.log(`[logic-snapshot] Wrote ${relativePath(CATALOG_JSON_PATH)}`)
  console.log(`[logic-snapshot] Wrote ${relativePath(CATALOG_MD_PATH)}`)
  console.log(`[logic-snapshot] Wrote ${relativePath(NEW_LIST_PATH)}`)
  console.log(`[logic-snapshot] Wrote ${relativePath(OLD_LIST_PATH)}`)
  console.log(`[logic-snapshot] Wrote ${relativePath(MODIFIED_OLD_LIST_PATH)}`)
  if (!args.noHistory) {
    console.log(`[logic-snapshot] Wrote ${relativePath(resolve(HISTORY_DIR, `${timestamp}.json`))}`)
  }
}

function parseArgs(input) {
  const out = {
    help: false,
    noWrite: false,
    noHistory: false,
  }

  for (const arg of input) {
    if (arg === '--help' || arg === '-h') {
      out.help = true
    } else if (arg === '--no-write') {
      out.noWrite = true
    } else if (arg === '--no-history') {
      out.noHistory = true
    }
  }

  return out
}

function printHelp() {
  console.log(`Usage: node scripts/logic-preserve-snapshot.mjs [options]\n\nOptions:\n  --no-write     Run analysis without writing files\n  --no-history   Write only latest files, skip timestamped history\n  -h, --help     Show this help message`) 
}

async function collectSnapshotFiles() {
  const paths = []

  for (const root of INCLUDE_ROOTS) {
    const absRoot = resolve(ROOT, root)
    if (!(await exists(absRoot))) continue
    const rootStats = await stat(absRoot)

    if (rootStats.isFile()) {
      if (shouldIncludeFile(root)) {
        paths.push(absRoot)
      }
      continue
    }

    const walked = await walkDirectory(absRoot)
    paths.push(...walked)
  }

  for (const file of INCLUDE_FILES) {
    const absFile = resolve(ROOT, file)
    if (await exists(absFile)) {
      paths.push(absFile)
    }
  }

  return dedupe(paths)
}

async function walkDirectory(dir) {
  const found = []
  const entries = await readdir(dir, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const absPath = join(dir, entry.name)
    const rel = relativePath(absPath)

    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue
      found.push(...(await walkDirectory(absPath)))
      continue
    }

    if (entry.isFile() && shouldIncludeFile(rel)) {
      found.push(absPath)
    }
  }

  return found
}

function shouldIncludeFile(relPath) {
  const ext = extname(relPath).toLowerCase()
  if (TEXT_EXTENSIONS.has(ext)) return true
  return INCLUDE_FILES.includes(normalizePath(relPath))
}

async function buildRecord(absPath) {
  const rel = relativePath(absPath)
  const bytes = (await stat(absPath)).size
  const content = await readFile(absPath)
  const hash = createHash('sha256').update(content).digest('hex')
  const lineCount = countLines(content)

  return {
    path: rel,
    bytes,
    lines: lineCount,
    sha256: hash,
  }
}

function countLines(buffer) {
  if (!buffer || buffer.length === 0) return 0
  const text = buffer.toString('utf8')
  const matches = text.match(/\n/g)
  return (matches ? matches.length : 0) + 1
}

function buildSummary(payload) {
  const sectionCounts = countBy(payload.files, (file) => file.path.split('/')[0] || 'root')
  const largest = [...payload.files]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 20)

  const lines = []
  lines.push('# Logic Preservation Snapshot')
  lines.push('')
  lines.push(`Generated: ${payload.generatedAt}`)
  lines.push(`Branch: ${payload.git.branch || 'unknown'}`)
  lines.push(`HEAD: ${payload.git.head || 'unknown'}`)
  lines.push(`Logic files captured: ${payload.fileCount}`)
  lines.push(`Old logic files: ${payload.oldLogicCount}`)
  lines.push(`New logic files: ${payload.newLogicCount}`)
  lines.push(`Total bytes: ${payload.totalBytes}`)
  lines.push(`Dirty paths: ${payload.git.dirtyCount}`)
  lines.push('')
  lines.push('## Logic Age Counts')
  lines.push('')
  lines.push('| Age | Files |')
  lines.push('|---|---:|')
  lines.push(`| old | ${payload.logicAgeCounts.old || 0} |`)
  lines.push(`| new | ${payload.logicAgeCounts.new || 0} |`)
  lines.push('')
  lines.push('## Git Status Counts (Captured Logic Files)')
  lines.push('')
  lines.push('| Status | Files |')
  lines.push('|---|---:|')
  for (const [status, count] of Object.entries(payload.gitStatusCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${status} | ${count} |`)
  }
  lines.push('')
  lines.push('## By Area')
  lines.push('')
  lines.push('| Area | Files |')
  lines.push('|---|---:|')

  for (const [area, count] of Object.entries(sectionCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${area} | ${count} |`)
  }

  lines.push('')
  lines.push('## Largest Files (Top 20)')
  lines.push('')
  lines.push('| File | Bytes | Lines |')
  lines.push('|---|---:|---:|')

  for (const file of largest) {
    lines.push(`| ${file.path} | ${file.bytes} | ${file.lines} |`)
  }

  lines.push('')
  lines.push('## Current Dirty Paths')
  lines.push('')
  if (payload.git.dirtyPaths.length === 0) {
    lines.push('Working tree is clean.')
  } else {
    for (const path of payload.git.dirtyPaths.slice(0, 200)) {
      lines.push(`- ${path}`)
    }
    if (payload.git.dirtyPaths.length > 200) {
      lines.push(`- ... (${payload.git.dirtyPaths.length - 200} more)`)
    }
  }

  lines.push('')
  lines.push('## Restore Strategy')
  lines.push('')
  lines.push('1. Run this snapshot before large refactors.')
  lines.push('2. If behavior drifts, compare current file hashes against latest-snapshot.json.')
  lines.push('3. Restore only the mismatched files, then re-run validation commands.')
  lines.push('4. Review the complete old/new logic list in docs/logic-preservation/logic-catalog.md.')

  return lines.join('\n')
}

function buildCatalogMarkdown(payload) {
  const lines = []
  lines.push('# Logic Catalog (New vs Old)')
  lines.push('')
  lines.push(`Generated: ${payload.generatedAt}`)
  lines.push(`Branch: ${payload.branch || 'unknown'}`)
  lines.push(`HEAD: ${payload.head || 'unknown'}`)
  lines.push(`All logic files: ${payload.totals.allLogicFiles}`)
  lines.push(`Old logic files: ${payload.totals.oldLogicFiles}`)
  lines.push(`New logic files: ${payload.totals.newLogicFiles}`)
  lines.push(`Modified old logic files: ${payload.totals.modifiedOldLogicFiles}`)
  lines.push('')
  lines.push('## New Logic Files (All)')
  lines.push('')

  if (payload.newLogicFiles.length === 0) {
    lines.push('None.')
  } else {
    for (const file of payload.newLogicFiles) {
      lines.push(`- ${file.path} | status=${file.gitStatus} | bytes=${file.bytes} | lines=${file.lines}`)
    }
  }

  lines.push('')
  lines.push('## Old Logic Files (All)')
  lines.push('')

  if (payload.oldLogicFiles.length === 0) {
    lines.push('None.')
  } else {
    for (const file of payload.oldLogicFiles) {
      lines.push(`- ${file.path} | status=${file.gitStatus} | bytes=${file.bytes} | lines=${file.lines}`)
    }
  }

  lines.push('')
  lines.push('## Modified Old Logic Files')
  lines.push('')

  if (payload.modifiedOldLogicFiles.length === 0) {
    lines.push('None.')
  } else {
    for (const file of payload.modifiedOldLogicFiles) {
      lines.push(`- ${file.path} | status=${file.gitStatus} | bytes=${file.bytes} | lines=${file.lines}`)
    }
  }

  return lines.join('\n')
}

function buildPathList(files) {
  if (files.length === 0) {
    return ''
  }

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))
  return `${sorted.map((file) => file.path).join('\n')}\n`
}

function countBy(items, keyFn) {
  const out = {}
  for (const item of items) {
    const key = keyFn(item)
    out[key] = (out[key] || 0) + 1
  }
  return out
}

function parseDirtyPaths(statusOutput) {
  if (!statusOutput) return []

  return statusOutput
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const rawPath = line.length >= 3 ? line.slice(3).trim() : line.trim()
      if (rawPath.includes(' -> ')) {
        return normalizePath(rawPath.split(' -> ')[1].trim())
      }
      return normalizePath(rawPath)
    })
    .filter(Boolean)
}

function buildPathSet(lsFilesOutput) {
  if (!lsFilesOutput) return new Set()
  const list = lsFilesOutput
    .split(/\r?\n/)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean)

  return new Set(list)
}

function parseStatusMap(statusOutput) {
  const map = new Map()
  if (!statusOutput) return map

  const lines = statusOutput
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)

  for (const line of lines) {
    const x = line[0]
    const y = line[1]
    const rawPath = line.slice(3).trim()
    const normalizedPath = rawPath.includes(' -> ')
      ? normalizePath(rawPath.split(' -> ')[1].trim())
      : normalizePath(rawPath)

    map.set(normalizedPath, {
      x,
      y,
      kind: classifyStatusKind(x, y),
      raw: line,
    })
  }

  return map
}

function classifyStatusKind(x, y) {
  if (x === '?' && y === '?') return 'untracked'
  if (x === 'U' || y === 'U') return 'conflict'
  if (x === 'D' || y === 'D') return 'deleted'
  if (x === 'R' || y === 'R') return 'renamed'
  if (x === 'A' || y === 'A') return 'added'
  if (x === 'M' || y === 'M') return 'modified'
  return 'other'
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

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function dedupe(paths) {
  return [...new Set(paths)]
}

function relativePath(absPath) {
  return normalizePath(relative(ROOT, absPath))
}

function normalizePath(input) {
  return input.replaceAll('\\', '/')
}

function toTimestamp(isoDate) {
  return isoDate
    .replaceAll(':', '-')
    .replaceAll('.', '-')
}
