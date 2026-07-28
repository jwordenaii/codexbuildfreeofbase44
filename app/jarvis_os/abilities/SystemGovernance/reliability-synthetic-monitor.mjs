#!/usr/bin/env node
/**
 * reliability-synthetic-monitor.mjs
 *
 * Lightweight synthetic uptime + latency monitor for 24/7 operations.
 *
 * Features:
 * - Probes core health endpoints with timeout + status checks
 * - Computes per-run availability and p95 latency snapshot
 * - Produces JSON + Markdown artifacts under docs/reliability/
 * - Supports optional admin probe for self-heal status
 * - Supports "allow-skip" mode when production base URL is not configured
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const OUTPUT_DIR = resolve(ROOT, 'docs/reliability')
const JSON_OUT = resolve(OUTPUT_DIR, 'latest-synthetic.json')
const MD_OUT = resolve(OUTPUT_DIR, 'latest-synthetic.md')

const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_BASE_URL = 'http://127.0.0.1:8003'

const BASE_CHECKS = [
  {
    name: 'liveness',
    path: '/health/live',
    expectedStatus: 200,
    sloMs: 500,
    critical: true,
  },
  {
    name: 'health',
    path: '/health',
    expectedStatus: 200,
    sloMs: 500,
    critical: true,
  },
  {
    name: 'monitoring-health',
    path: '/api/v1/monitoring/health',
    expectedStatus: 200,
    sloMs: 1500,
    critical: false,
  },
  {
    name: 'dashboard-preflight',
    path: '/api/v1/ops/dashboard-preflight',
    expectedStatus: 200,
    sloMs: 1800,
    critical: false,
  },
]

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}

const baseUrl = String(args.baseUrl || process.env.RELIABILITY_BASE_URL || DEFAULT_BASE_URL).trim()
const adminToken = String(process.env.RELIABILITY_ADMIN_TOKEN || '').trim()
const allowSkip = args.allowSkip
const softFail = args.softFail

const checks = [...BASE_CHECKS]
if (adminToken) {
  checks.push({
    name: 'self-heal-status',
    path: '/api/v1/ops/self-heal/status',
    expectedStatus: 200,
    sloMs: 1200,
    critical: false,
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  })
}

const started = new Date().toISOString()

if (!baseUrl || (!process.env.RELIABILITY_BASE_URL && args.requireBaseUrl)) {
  if (allowSkip) {
    const payload = {
      generatedAt: started,
      mode: 'synthetic-monitor',
      status: 'skipped',
      reason: 'RELIABILITY_BASE_URL not configured',
      summary: {
        checksTotal: 0,
        checksPassed: 0,
        checksFailed: 0,
        criticalFailures: 0,
        availabilityPct: 0,
        p95LatencyMs: null,
        latencyBreaches: 0,
      },
      checks: [],
      recommendations: [
        'Set RELIABILITY_BASE_URL secret/env to enable production synthetic monitoring.',
      ],
    }
    await writeOutputs(payload)
    console.log('[reliability] skipped: RELIABILITY_BASE_URL not configured')
    process.exit(0)
  }

  console.error('reliability monitor failed: base URL is not configured')
  console.error('Set RELIABILITY_BASE_URL or pass --base-url=https://your-api-host')
  process.exit(1)
}

const results = []
for (const check of checks) {
  results.push(await runCheck(baseUrl, check, args.timeoutMs))
}

const passed = results.filter((r) => r.statusOk).length
const failed = results.length - passed
const availabilityPct = results.length > 0 ? round2((passed / results.length) * 100) : 0

const successfulLatencies = results.filter((r) => typeof r.latencyMs === 'number').map((r) => r.latencyMs)
const p95LatencyMs = successfulLatencies.length > 0 ? percentile(successfulLatencies, 95) : null

const latencyBreaches = results.filter(
  (r) => typeof r.latencyMs === 'number' && typeof r.sloMs === 'number' && r.latencyMs > r.sloMs
)

const criticalFailures = results.filter((r) => r.critical && !r.statusOk)
const failedNames = results.filter((r) => !r.statusOk).map((r) => r.name)

const runStatus = criticalFailures.length > 0 ? 'fail' : failed > 0 ? 'warn' : 'pass'

const payload = {
  generatedAt: started,
  mode: 'synthetic-monitor',
  status: runStatus,
  baseUrl,
  summary: {
    checksTotal: results.length,
    checksPassed: passed,
    checksFailed: failed,
    criticalFailures: criticalFailures.length,
    availabilityPct,
    p95LatencyMs,
    latencyBreaches: latencyBreaches.length,
  },
  checks: results,
  recommendations: buildRecommendations({
    runStatus,
    failedNames,
    latencyBreaches,
    criticalFailures,
  }),
}

await writeOutputs(payload)

console.log(`[reliability] status=${runStatus} checks=${passed}/${results.length} availability=${availabilityPct}% p95=${p95LatencyMs ?? 'n/a'}ms`)
if (latencyBreaches.length > 0) {
  console.log(`[reliability] latency breaches=${latencyBreaches.length}`)
}

if (!softFail && runStatus === 'fail') {
  process.exit(1)
}

if (!softFail && runStatus === 'warn') {
  process.exit(1)
}

process.exit(0)

async function runCheck(base, check, timeoutMs) {
  const start = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const url = joinUrl(base, check.path)
  const result = {
    name: check.name,
    path: check.path,
    url,
    critical: Boolean(check.critical),
    expectedStatus: check.expectedStatus,
    statusCode: null,
    statusOk: false,
    latencyMs: null,
    sloMs: check.sloMs,
    error: null,
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: check.headers || {},
      signal: controller.signal,
    })
    result.statusCode = res.status
    result.statusOk = res.status === check.expectedStatus
    result.latencyMs = round2(performance.now() - start)
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    result.latencyMs = round2(performance.now() - start)
  } finally {
    clearTimeout(timer)
  }

  return result
}

function buildRecommendations({ runStatus, failedNames, latencyBreaches, criticalFailures }) {
  const recs = []

  if (runStatus === 'pass') {
    recs.push('Synthetic monitor checks are healthy for this run.')
  }

  if (criticalFailures.length > 0) {
    recs.push(`Critical failures detected: ${criticalFailures.map((r) => r.name).join(', ')}`)
    recs.push('Investigate service process health, ingress routing, and deploy events first.')
  }

  if (failedNames.length > 0 && criticalFailures.length === 0) {
    recs.push(`Non-critical endpoint failures detected: ${failedNames.join(', ')}`)
    recs.push('Investigate dependency degradation (Redis, search, optional integrations).')
  }

  if (latencyBreaches.length > 0) {
    recs.push(`Latency SLO breaches detected on: ${latencyBreaches.map((r) => r.name).join(', ')}`)
    recs.push('Review DB query latency and worker queue pressure, then scale as needed.')
  }

  recs.push('Use /api/v1/ops/self-heal/status to verify autonomous recovery state in production.')
  return recs
}

async function writeOutputs(payload) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await Promise.all([
    writeFile(JSON_OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
    writeFile(MD_OUT, renderMarkdown(payload), 'utf8'),
  ])
}

function renderMarkdown(data) {
  const lines = []
  const p95Text = data.summary.p95LatencyMs == null ? 'n/a' : `${data.summary.p95LatencyMs} ms`
  const latencyBreachCount = data.summary.latencyBreaches ?? 0

  lines.push('# Synthetic Reliability Report')
  lines.push('')
  lines.push(`Generated: ${data.generatedAt}`)
  lines.push(`Base URL: ${data.baseUrl || 'n/a'}`)
  lines.push(`Run status: ${data.status}`)
  lines.push('')

  lines.push('## Summary')
  lines.push('')
  lines.push(`- Checks total: ${data.summary.checksTotal}`)
  lines.push(`- Checks passed: ${data.summary.checksPassed}`)
  lines.push(`- Checks failed: ${data.summary.checksFailed}`)
  lines.push(`- Availability: ${data.summary.availabilityPct}%`)
  lines.push(`- p95 latency: ${p95Text}`)
  lines.push(`- Latency breaches: ${latencyBreachCount}`)
  lines.push('')

  lines.push('## Check Results')
  lines.push('')
  lines.push('| Name | Critical | Status | Expected | Actual | Latency (ms) | SLO (ms) | Error |')
  lines.push('|---|---|---|---:|---:|---:|---:|---|')

  for (const row of data.checks || []) {
    const status = row.statusOk ? 'pass' : 'fail'
    lines.push(
      `| ${row.name} | ${row.critical ? 'yes' : 'no'} | ${status} | ${row.expectedStatus} | ${row.statusCode ?? 'n/a'} | ${row.latencyMs ?? 'n/a'} | ${row.sloMs ?? 'n/a'} | ${row.error || ''} |`
    )
  }

  lines.push('')
  lines.push('## Recommendations')
  lines.push('')
  for (const rec of data.recommendations || []) {
    lines.push(`- ${rec}`)
  }
  lines.push('')

  return `${lines.join('\n')}\n`
}

function percentile(values, pct) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1))
  return round2(sorted[idx])
}

function round2(num) {
  return Math.round(num * 100) / 100
}

function joinUrl(base, path) {
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const safePath = path.startsWith('/') ? path : `/${path}`
  return `${trimmedBase}${safePath}`
}

function parseArgs(argv) {
  const out = {
    help: false,
    allowSkip: false,
    softFail: false,
    baseUrl: '',
    requireBaseUrl: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') out.help = true
    else if (raw === '--allow-skip') out.allowSkip = true
    else if (raw === '--soft-fail') out.softFail = true
    else if (raw === '--require-base-url') out.requireBaseUrl = true
    else if (raw.startsWith('--base-url=')) out.baseUrl = raw.split('=').slice(1).join('=').trim()
    else if (raw.startsWith('--timeout-ms=')) {
      const value = Number.parseInt(raw.split('=').slice(1).join('='), 10)
      if (Number.isFinite(value) && value > 0) {
        out.timeoutMs = value
      }
    }
  }

  return out
}

function printHelp() {
  console.log('Usage: node scripts/reliability-synthetic-monitor.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --base-url=<url>        Target API base URL (default: env RELIABILITY_BASE_URL or local)')
  console.log('  --timeout-ms=<n>        Request timeout in ms (default: 5000)')
  console.log('  --allow-skip            Exit 0 with status=skipped when base URL is missing')
  console.log('  --soft-fail             Exit 0 even when run status is warn/fail')
  console.log('  --require-base-url      Treat missing RELIABILITY_BASE_URL as hard failure')
  console.log('  -h, --help              Show this help')
}
