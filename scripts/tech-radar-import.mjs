#!/usr/bin/env node
/**
 * tech-radar-import.mjs
 *
 * Imports AI tech radar signals into a stable intelligence payload that the
 * rest of the system can consume for analysis and prioritization.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const RADAR_DIR = resolve(ROOT, 'docs/tech-radar')
const LATEST_RADAR_PATH = resolve(RADAR_DIR, 'latest.json')
const SNAPSHOT_PATH = resolve(RADAR_DIR, 'snapshot.json')

const OUTPUT_DOCS_DIR = resolve(RADAR_DIR, 'intelligence')
const OUTPUT_DOCS_JSON = resolve(OUTPUT_DOCS_DIR, 'latest.json')
const OUTPUT_DOCS_MD = resolve(OUTPUT_DOCS_DIR, 'latest-report.md')

const OUTPUT_SYSTEM_DIR = resolve(ROOT, 'app/data/tech-intelligence')
const OUTPUT_SYSTEM_JSON = resolve(OUTPUT_SYSTEM_DIR, 'latest.json')

const DOMAIN_RULES = [
  {
    id: 'interior',
    label: 'Interior Build Intelligence',
    keywords: ['interior', 'floor plan', 'room', 'remodel', 'fitout', 'layout'],
  },
  {
    id: 'exterior',
    label: 'Exterior and Visualizer Intelligence',
    keywords: ['exterior', 'roof', 'facade', 'parcel', 'material', 'property'],
  },
  {
    id: 'civil',
    label: 'Civil and Pavement Intelligence',
    keywords: ['civil', 'pavement', 'asphalt', 'decay', 'utility', '811', 'drainage', 'infrastructure'],
  },
  {
    id: 'gc',
    label: 'General Contracting Intelligence',
    keywords: ['general contractor', 'project controls', 'schedule', 'crew', 'workforce', 'procurement', 'subcontractor'],
  },
  {
    id: 'scanning',
    label: 'Scanning and Computer Vision Intelligence',
    keywords: ['scan', 'scanning', 'vision', 'lidar', 'drone', 'photo', 'image', 'multimodal', 'video', 'sensor'],
  },
  {
    id: 'compliance',
    label: 'Compliance and Governance Intelligence',
    keywords: ['compliance', 'governance', 'security', 'policy', 'audit', 'regulation', 'legal', 'safety'],
  },
]

const CAPABILITY_TO_DOMAIN = {
  'multimodal-voice-vision': ['scanning'],
  'security-governance': ['compliance'],
  'agents-autonomy': ['gc', 'civil', 'scanning'],
  'infra-inference-edge': ['scanning', 'civil'],
  'developer-platforms': ['gc', 'scanning', 'compliance'],
  'memory-state-personalization': ['gc', 'compliance'],
  'search-retrieval': ['compliance', 'gc'],
}

main().catch((err) => {
  console.error('[tech-radar-import] failed:', err)
  process.exit(1)
})

async function main() {
  const latest = await readJson(LATEST_RADAR_PATH)
  const snapshot = await readJson(SNAPSHOT_PATH)

  const candidateItems = selectCandidates(latest, snapshot)
  const scored = candidateItems.map((item) => scoreItem(item))
  const prioritized = scored
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 40)

  const domainSummary = summarizeByDomain(prioritized)
  const payload = {
    generatedAt: new Date().toISOString(),
    radarGeneratedAt: latest.generatedAt || null,
    sourceCount: latest.sourceCount || null,
    signalsAnalyzed: candidateItems.length,
    prioritizedSignals: prioritized,
    domainSummary,
    notes: [
      'This intelligence payload is optimized for system ingestion and planning, not legal or production guarantees.',
      'Use high score signals to drive feature spikes, pilot rollouts, and architecture updates.',
    ],
  }

  await mkdir(OUTPUT_DOCS_DIR, { recursive: true })
  await mkdir(OUTPUT_SYSTEM_DIR, { recursive: true })

  await Promise.all([
    writeFile(OUTPUT_DOCS_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
    writeFile(OUTPUT_SYSTEM_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
    writeFile(OUTPUT_DOCS_MD, renderMarkdown(payload), 'utf8'),
  ])

  console.log(`[tech-radar-import] signals analyzed: ${candidateItems.length}`)
  console.log(`[tech-radar-import] prioritized signals: ${prioritized.length}`)
  console.log('[tech-radar-import] wrote docs/tech-radar/intelligence/latest.json')
  console.log('[tech-radar-import] wrote docs/tech-radar/intelligence/latest-report.md')
  console.log('[tech-radar-import] wrote app/data/tech-intelligence/latest.json')
}

function selectCandidates(latest, snapshot) {
  const fromLatest = [
    ...(Array.isArray(latest.newItems) ? latest.newItems : []),
    ...(Array.isArray(latest.changedItems) ? latest.changedItems : []),
  ]

  if (fromLatest.length > 0) return dedupeByUrl(fromLatest)

  const snapshotItems = Array.isArray(snapshot.items) ? snapshot.items : []
  return dedupeByUrl(snapshotItems.slice(0, 100))
}

function scoreItem(item) {
  const title = String(item.title || '')
  const summary = String(item.summary || '')
  const capabilityTags = Array.isArray(item.capabilityTags) ? item.capabilityTags : []
  const haystack = `${title} ${summary}`.toLowerCase()

  const domainScores = []
  for (const domain of DOMAIN_RULES) {
    let score = 0
    let matches = 0
    for (const keyword of domain.keywords) {
      if (haystack.includes(keyword.toLowerCase())) {
        score += 2
        matches += 1
      }
    }

    for (const tag of capabilityTags) {
      const mapped = CAPABILITY_TO_DOMAIN[tag] || []
      if (mapped.includes(domain.id)) {
        score += 3
      }
    }

    if (matches > 0 || score > 0) {
      domainScores.push({
        domainId: domain.id,
        domainLabel: domain.label,
        score,
        keywordMatches: matches,
      })
    }
  }

  domainScores.sort((a, b) => b.score - a.score)
  const overallScore = domainScores.reduce((sum, d) => sum + d.score, 0)

  return {
    sourceId: item.sourceId || null,
    sourceName: item.sourceName || null,
    title,
    url: item.url || null,
    publishedAt: item.publishedAt || null,
    capabilityTags,
    overallScore,
    priority: priorityForScore(overallScore),
    topDomains: domainScores.slice(0, 3),
  }
}

function summarizeByDomain(items) {
  const map = new Map(DOMAIN_RULES.map((d) => [d.id, {
    domainId: d.id,
    domainLabel: d.label,
    signalCount: 0,
    totalScore: 0,
    topSignals: [],
  }]))

  for (const item of items) {
    for (const ds of item.topDomains) {
      const bucket = map.get(ds.domainId)
      if (!bucket) continue
      bucket.signalCount += 1
      bucket.totalScore += ds.score
      bucket.topSignals.push({
        title: item.title,
        url: item.url,
        score: ds.score,
        priority: item.priority,
      })
    }
  }

  const summary = Array.from(map.values())
    .map((entry) => ({
      ...entry,
      topSignals: entry.topSignals
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)

  return summary
}

function renderMarkdown(payload) {
  const lines = []
  lines.push('# Tech Radar Intelligence Import')
  lines.push('')
  lines.push(`Generated at: ${payload.generatedAt}`)
  lines.push(`Radar snapshot at: ${payload.radarGeneratedAt || 'unknown'}`)
  lines.push(`Signals analyzed: ${payload.signalsAnalyzed}`)
  lines.push('')
  lines.push('## Domain Priority Summary')
  lines.push('')
  lines.push('| Domain | Signals | Total Score |')
  lines.push('| --- | ---: | ---: |')
  for (const d of payload.domainSummary) {
    lines.push(`| ${d.domainLabel} | ${d.signalCount} | ${d.totalScore} |`)
  }
  lines.push('')
  lines.push('## Top Signals')
  lines.push('')
  for (const signal of payload.prioritizedSignals.slice(0, 20)) {
    lines.push(`- [${signal.priority}] ${signal.title} (${signal.sourceName || 'source'})`)
    lines.push(`  ${signal.url || 'n/a'}`)
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

function priorityForScore(score) {
  if (score >= 12) return 'critical'
  if (score >= 8) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

function dedupeByUrl(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = String(item.url || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw)
}