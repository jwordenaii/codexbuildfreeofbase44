#!/usr/bin/env node
/**
 * ai-tech-radar.mjs
 *
 * Fetches AI/platform updates from a mix of RSS/Atom feeds and HTML pages,
 * normalizes entries, computes changes from the previous snapshot, and writes
 * machine-readable + human-readable reports under docs/tech-radar.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const OUTPUT_DIR = resolve(process.cwd(), 'docs/tech-radar')
const SNAPSHOT_PATH = resolve(OUTPUT_DIR, 'snapshot.json')
const LATEST_PATH = resolve(OUTPUT_DIR, 'latest.json')
const SOURCE_HEALTH_PATH = resolve(OUTPUT_DIR, 'source-health.json')
const REPORT_PATH = resolve(OUTPUT_DIR, 'latest-report.md')

// Repo URL in UA is informational only; override via REPO_URL env to match new host after migration.
const REPO_URL = process.env.REPO_URL || 'https://jwordenasphaltpaving.com'
const USER_AGENT = `jworden-ai-tech-radar/1.0 (+${REPO_URL})`

const SOURCES = [
  {
    id: 'openai-news',
    name: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
    mode: 'rss',
    maxItems: 80,
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'https://blog.google/innovation-and-ai/technology/ai/rss/',
    mode: 'rss',
    maxItems: 80,
  },
  {
    id: 'cloudflare-ai-blog',
    name: 'Cloudflare AI Blog',
    url: 'https://blog.cloudflare.com/tag/ai/rss/',
    mode: 'rss',
    maxItems: 80,
  },
  {
    id: 'microsoft-ai-blog',
    name: 'Microsoft AI Blog',
    url: 'https://blogs.microsoft.com/blog/tag/ai/feed/',
    mode: 'rss',
    maxItems: 80,
  },
  {
    id: 'anthropic-news',
    name: 'Anthropic News (HTML fallback)',
    url: 'https://www.anthropic.com/news',
    mode: 'html-links',
    linkPattern: /^https:\/\/www\.anthropic\.com\/news\/[a-z0-9-]+\/?$/i,
    maxItems: 80,
  },
  {
    id: 'vercel-changelog',
    name: 'Vercel Changelog (HTML fallback)',
    url: 'https://vercel.com/changelog',
    mode: 'html-links',
    linkPattern: /^https:\/\/vercel\.com\/changelog\/[a-z0-9-]+\/?$/i,
    maxItems: 80,
  },
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv cs.AI (Preprint Signals)',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    mode: 'rss',
    maxItems: 120,
  },
  {
    id: 'arxiv-cs-cv',
    name: 'arXiv cs.CV (Preprint Signals)',
    url: 'https://rss.arxiv.org/rss/cs.CV',
    mode: 'rss',
    maxItems: 120,
  },
]

const CAPABILITY_RULES = [
  {
    tag: 'agents-autonomy',
    keywords: ['agent', 'agents', 'autonomous', 'task automation', 'copilot tasks', 'multiagent', 'workflows'],
  },
  {
    tag: 'models-reasoning',
    keywords: ['model', 'reasoning', 'gpt', 'claude', 'gemini', 'opus', 'sonnet', 'haiku', 'frontier'],
  },
  {
    tag: 'multimodal-voice-vision',
    keywords: ['voice', 'audio', 'video', 'vision', 'image', 'multimodal', 'real-time'],
  },
  {
    tag: 'developer-platforms',
    keywords: ['sdk', 'api', 'developer', 'cli', 'tooling', 'framework', 'integration'],
  },
  {
    tag: 'infra-inference-edge',
    keywords: ['inference', 'datacenter', 'gpu', 'accelerator', 'latency', 'throughput', 'edge', 'runtime'],
  },
  {
    tag: 'security-governance',
    keywords: ['security', 'safety', 'governance', 'policy', 'compliance', 'guardrails', 'trust'],
  },
  {
    tag: 'memory-state-personalization',
    keywords: ['memory', 'state', 'context', 'history', 'personalization'],
  },
  {
    tag: 'search-retrieval',
    keywords: ['search', 'retrieval', 'rag', 'knowledge', 'index'],
  },
  {
    tag: 'pre-release-signals',
    keywords: [
      'preview',
      'private preview',
      'public preview',
      'beta',
      'alpha',
      'coming soon',
      'roadmap',
      'early access',
      'launching soon',
      'preprint',
      'arxiv',
      'forthcoming',
      'rfc',
    ],
  },
]

const argv = process.argv.slice(2)
const args = parseArgs(argv)

if (args.help) {
  printHelp()
  process.exit(0)
}

const previousSnapshot = await readJsonIfExists(SNAPSHOT_PATH)
const startedAt = new Date()

const sourceRuns = await Promise.all(SOURCES.map((source) => collectSource(source, args.timeoutMs)))

const allItems = sourceRuns
  .flatMap((run) => run.items)
  .filter(Boolean)

const deduped = dedupeByKey(allItems, (item) => item.url)
const sortedItems = sortByPublishedDesc(deduped)
const annotated = sortedItems.map((item) => ({
  ...item,
  capabilityTags: detectCapabilityTags(item),
  fingerprint: sha256(`${item.sourceId}|${item.url}|${item.title}`),
}))

const diff = buildDiff(previousSnapshot, annotated)
const health = sourceRuns.map((run) => ({
  sourceId: run.source.id,
  sourceName: run.source.name,
  url: run.source.url,
  mode: run.source.mode,
  status: run.error ? 'error' : 'ok',
  itemCount: run.items.length,
  durationMs: run.durationMs,
  error: run.error ? String(run.error) : null,
  fetchedAt: run.fetchedAt,
}))

const successCount = health.filter((h) => h.status === 'ok').length
if (successCount === 0) {
  console.error('[ai-tech-radar] All sources failed. Aborting.')
  process.exit(1)
}

const capabilitiesAll = countCapabilityTags(annotated)
const capabilitiesNew = countCapabilityTags(diff.newItems)

const latestPayload = {
  generatedAt: new Date().toISOString(),
  startedAt: startedAt.toISOString(),
  durationMs: Date.now() - startedAt.getTime(),
  sourceCount: SOURCES.length,
  sourcesHealthy: successCount,
  totalItems: annotated.length,
  newItemCount: diff.newItems.length,
  changedItemCount: diff.changedItems.length,
  capabilitiesAll,
  capabilitiesNew,
  newItems: diff.newItems,
  changedItems: diff.changedItems,
}

const snapshotPayload = {
  generatedAt: latestPayload.generatedAt,
  totalItems: annotated.length,
  items: annotated,
}

const report = buildReport({
  generatedAt: latestPayload.generatedAt,
  sourceHealth: health,
  totalItems: latestPayload.totalItems,
  newItems: diff.newItems,
  changedItems: diff.changedItems,
  capabilitiesAll,
  capabilitiesNew,
  latestBySource: groupLatestBySource(annotated),
})

if (!args.diffOnly && !args.noWrite) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await Promise.all([
    writeJson(SNAPSHOT_PATH, snapshotPayload),
    writeJson(LATEST_PATH, latestPayload),
    writeJson(SOURCE_HEALTH_PATH, { generatedAt: latestPayload.generatedAt, sources: health }),
    writeFile(REPORT_PATH, report, 'utf8'),
  ])
}

console.log(`[ai-tech-radar] Sources healthy: ${successCount}/${SOURCES.length}`)
console.log(`[ai-tech-radar] Total normalized items: ${annotated.length}`)
console.log(`[ai-tech-radar] New since last snapshot: ${diff.newItems.length}`)
console.log(`[ai-tech-radar] Changed since last snapshot: ${diff.changedItems.length}`)

if (diff.newItems.length > 0) {
  console.log('[ai-tech-radar] Top new signals:')
  for (const item of diff.newItems.slice(0, args.maxConsoleNewItems)) {
    console.log(`- [${item.sourceName}] ${item.title} :: ${item.url}`)
  }
}

if (args.diffOnly) {
  process.exit(diff.newItems.length > 0 ? 2 : 0)
}

function parseArgs(input) {
  const out = {
    help: false,
    diffOnly: false,
    noWrite: false,
    timeoutMs: 20000,
    maxConsoleNewItems: 10,
  }

  for (const arg of input) {
    if (arg === '--help' || arg === '-h') {
      out.help = true
    } else if (arg === '--diff-only') {
      out.diffOnly = true
      out.noWrite = true
    } else if (arg === '--no-write') {
      out.noWrite = true
    } else if (arg.startsWith('--timeout-ms=')) {
      const value = Number(arg.split('=')[1])
      if (!Number.isNaN(value) && value > 0) out.timeoutMs = value
    } else if (arg.startsWith('--max-console-new-items=')) {
      const value = Number(arg.split('=')[1])
      if (!Number.isNaN(value) && value > 0) out.maxConsoleNewItems = value
    }
  }

  return out
}

function printHelp() {
  console.log('Usage: node scripts/ai-tech-radar.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --diff-only                  Fetch + compare against snapshot without writing files.')
  console.log('  --no-write                   Fetch + analyze without writing files.')
  console.log('  --timeout-ms=<n>             HTTP timeout per source (default: 20000).')
  console.log('  --max-console-new-items=<n>  Max new items printed to console (default: 10).')
  console.log('  --help, -h                   Show this help text.')
}

async function collectSource(source, timeoutMs) {
  const started = Date.now()
  const fetchedAt = new Date().toISOString()
  try {
    const raw = await fetchText(source.url, timeoutMs)
    const items = normalizeItems(source, raw)
      .slice(0, source.maxItems)
      .map((item) => ({
        ...item,
        sourceId: source.id,
        sourceName: source.name,
      }))

    return {
      source,
      fetchedAt,
      durationMs: Date.now() - started,
      items,
      error: null,
    }
  } catch (error) {
    return {
      source,
      fetchedAt,
      durationMs: Date.now() - started,
      items: [],
      error: error?.message || error,
    }
  }
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, text/xml, application/xml, text/html;q=0.9, */*;q=0.8',
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeItems(source, raw) {
  if (source.mode === 'rss') {
    return normalizeFeedItems(raw, source.url)
  }
  if (source.mode === 'html-links') {
    return normalizeHtmlLinks(raw, source.url, source.linkPattern)
  }
  return []
}

function normalizeFeedItems(raw, baseUrl) {
  if (/<item\b/i.test(raw)) {
    return normalizeRssItems(raw, baseUrl)
  }
  if (/<entry\b/i.test(raw)) {
    return normalizeAtomItems(raw, baseUrl)
  }
  return []
}

function normalizeRssItems(xml, baseUrl) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || []
  const items = []

  for (const block of blocks) {
    const title = cleanText(extractFirstTag(block, 'title'))
    const linkFromTag = cleanText(extractFirstTag(block, 'link'))
    const guid = cleanText(extractFirstTag(block, 'guid'))
    const url = normalizeUrl(linkFromTag || guid, baseUrl)
    if (!title || !url) continue

    const publishedAt = normalizeDate(
      cleanText(extractFirstTag(block, 'pubDate')) ||
      cleanText(extractFirstTag(block, 'dc:date')) ||
      cleanText(extractFirstTag(block, 'published')) ||
      cleanText(extractFirstTag(block, 'updated'))
    )

    const summary = cleanText(
      extractFirstTag(block, 'description') ||
      extractFirstTag(block, 'content:encoded') ||
      ''
    )

    const categories = extractAllTags(block, 'category').map((value) => cleanText(value)).filter(Boolean)

    items.push({
      title,
      url,
      summary,
      categories,
      publishedAt,
    })
  }

  return sortByPublishedDesc(dedupeByKey(items, (item) => item.url))
}

function normalizeAtomItems(xml, baseUrl) {
  const blocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []
  const items = []

  for (const block of blocks) {
    const title = cleanText(extractFirstTag(block, 'title'))
    const hrefMatch = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)
    const linkTagText = cleanText(extractFirstTag(block, 'link'))
    const url = normalizeUrl(hrefMatch?.[1] || linkTagText, baseUrl)
    if (!title || !url) continue

    const publishedAt = normalizeDate(
      cleanText(extractFirstTag(block, 'updated')) ||
      cleanText(extractFirstTag(block, 'published'))
    )

    const summary = cleanText(
      extractFirstTag(block, 'summary') ||
      extractFirstTag(block, 'content') ||
      ''
    )

    const categoryTerms = [...block.matchAll(/<category\b[^>]*term=["']([^"']+)["'][^>]*\/?>(?:<\/category>)?/gi)]
      .map((match) => cleanText(match[1]))
      .filter(Boolean)

    items.push({
      title,
      url,
      summary,
      categories: categoryTerms,
      publishedAt,
    })
  }

  return sortByPublishedDesc(dedupeByKey(items, (item) => item.url))
}

function normalizeHtmlLinks(html, baseUrl, linkPattern) {
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  const items = []
  const seen = new Set()

  for (const anchor of anchors) {
    const href = anchor[1]
    const rawText = anchor[2]
    const resolved = normalizeUrl(href, baseUrl)
    if (!resolved) continue
    if (typeof linkPattern?.test === 'function' && !linkPattern.test(resolved)) continue
    if (seen.has(resolved)) continue

    const titleRaw = cleanText(rawText)
    let title = normalizeHtmlHeadline(titleRaw)
    if (looksNoisyHeadline(title)) {
      title = titleFromUrl(resolved)
    }
    if (!title || title.length < 8) continue

    const contextStart = Math.max(0, (anchor.index || 0) - 280)
    const contextEnd = Math.min(html.length, (anchor.index || 0) + 280)
    const context = html.slice(contextStart, contextEnd)
    const publishedAt = normalizeDate(extractPossibleDate(context) || extractPossibleDate(titleRaw))

    items.push({
      title,
      url: resolved,
      summary: '',
      categories: [],
      publishedAt,
    })

    seen.add(resolved)
  }

  return sortByPublishedDesc(items)
}

function normalizeHtmlHeadline(value) {
  if (!value) return ''
  let text = value.replace(/\s+/g, ' ').trim()

  text = text.replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/gi, ' ')
  text = text.replace(/^newsroom\s*/i, '')

  text = text.replace(
    /\b(?:Announcements?|Product|Research|Engineering|Security|Release)\b/gi,
    ' '
  )

  text = text.replace(/\s+/g, ' ').trim()
  return text
}

function looksNoisyHeadline(value) {
  if (!value) return true
  if (value.length > 150) return true
  if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(value)) return true
  if (/^(news|newsroom|see more)$/i.test(value)) return true
  return false
}

function titleFromUrl(urlValue) {
  try {
    const url = new URL(urlValue)
    const parts = url.pathname.split('/').filter(Boolean)
    const slug = parts[parts.length - 1] || ''
    if (!slug) return ''
    return slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .trim()
  } catch {
    return ''
  }
}

function extractPossibleDate(text) {
  if (!text) return null

  const datetimeMatch = text.match(/datetime=["']([^"']+)["']/i)
  if (datetimeMatch?.[1]) return datetimeMatch[1]

  const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/)
  if (isoMatch?.[0]) return isoMatch[0]

  const naturalMatch = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i)
  if (naturalMatch?.[0]) return naturalMatch[0]

  return null
}

function buildDiff(previousSnapshot, currentItems) {
  const previousItems = previousSnapshot?.items || []
  const prevByUrl = new Map(previousItems.map((item) => [item.url, item]))

  const newItems = []
  const changedItems = []

  for (const item of currentItems) {
    const prev = prevByUrl.get(item.url)
    if (!prev) {
      newItems.push(item)
      continue
    }

    if ((prev.title || '') !== (item.title || '') || (prev.publishedAt || '') !== (item.publishedAt || '')) {
      changedItems.push({
        ...item,
        previousTitle: prev.title || null,
        previousPublishedAt: prev.publishedAt || null,
      })
    }
  }

  return {
    newItems: sortByPublishedDesc(newItems),
    changedItems: sortByPublishedDesc(changedItems),
  }
}

function detectCapabilityTags(item) {
  const haystack = [item.title, item.summary, ...(item.categories || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const matches = []
  for (const rule of CAPABILITY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      matches.push(rule.tag)
    }
  }
  return matches
}

function countCapabilityTags(items) {
  const counts = {}
  for (const item of items) {
    for (const tag of item.capabilityTags || []) {
      counts[tag] = (counts[tag] || 0) + 1
    }
  }

  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  )
}

function groupLatestBySource(items) {
  const bySource = {}
  for (const item of items) {
    if (!bySource[item.sourceId]) {
      bySource[item.sourceId] = []
    }
    if (bySource[item.sourceId].length < 5) {
      bySource[item.sourceId].push(item)
    }
  }
  return bySource
}

function buildReport(data) {
  const lines = []
  lines.push('# AI Tech Radar Report')
  lines.push('')
  lines.push(`Generated: ${data.generatedAt}`)
  lines.push(`Total normalized items: ${data.totalItems}`)
  lines.push(`New since last snapshot: ${data.newItems.length}`)
  lines.push(`Changed since last snapshot: ${data.changedItems.length}`)
  lines.push('')
  lines.push('## Source Health')
  lines.push('')
  lines.push('| Source | Status | Items | Duration (ms) | Error |')
  lines.push('|---|---|---:|---:|---|')
  for (const source of data.sourceHealth) {
    lines.push(`| ${source.sourceName} | ${source.status} | ${source.itemCount} | ${source.durationMs} | ${source.error || ''} |`)
  }

  lines.push('')
  lines.push('## New Signals')
  lines.push('')
  if (data.newItems.length === 0) {
    lines.push('No new items detected compared to the previous snapshot.')
  } else {
    for (const item of data.newItems.slice(0, 40)) {
      const dateText = item.publishedAt ? ` (${item.publishedAt.slice(0, 10)})` : ''
      lines.push(`- [${item.sourceName}] ${item.title}${dateText} - ${item.url}`)
    }
  }

  lines.push('')
  lines.push('## Capability Trend (All Items)')
  lines.push('')
  lines.push('| Capability Tag | Count |')
  lines.push('|---|---:|')
  const allEntries = Object.entries(data.capabilitiesAll)
  if (allEntries.length === 0) {
    lines.push('| none | 0 |')
  } else {
    for (const [tag, count] of allEntries) {
      lines.push(`| ${tag} | ${count} |`)
    }
  }

  lines.push('')
  lines.push('## Capability Trend (New Items)')
  lines.push('')
  lines.push('| Capability Tag | Count |')
  lines.push('|---|---:|')
  const newEntries = Object.entries(data.capabilitiesNew)
  if (newEntries.length === 0) {
    lines.push('| none | 0 |')
  } else {
    for (const [tag, count] of newEntries) {
      lines.push(`| ${tag} | ${count} |`)
    }
  }

  lines.push('')
  lines.push('## Latest Per Source')
  lines.push('')
  for (const source of SOURCES) {
    lines.push(`### ${source.name}`)
    const latest = data.latestBySource[source.id] || []
    if (latest.length === 0) {
      lines.push('- No items normalized in this run.')
    } else {
      for (const item of latest) {
        const dateText = item.publishedAt ? ` (${item.publishedAt.slice(0, 10)})` : ''
        lines.push(`- ${item.title}${dateText} - ${item.url}`)
      }
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function extractFirstTag(text, tagName) {
  const escaped = escapeRegExp(tagName)
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i')
  const match = text.match(re)
  return match ? match[1] : null
}

function extractAllTags(text, tagName) {
  const escaped = escapeRegExp(tagName)
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'gi')
  return [...text.matchAll(re)].map((match) => match[1])
}

function cleanText(value) {
  if (!value) return ''
  let text = String(value)
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
  text = decodeHtmlEntities(text)
  text = text.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  text = text.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16)
      return Number.isNaN(code) ? _ : String.fromCodePoint(code)
    })
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number.parseInt(num, 10)
      return Number.isNaN(code) ? _ : String.fromCodePoint(code)
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function normalizeUrl(input, baseUrl) {
  if (!input) return null
  try {
    const url = new URL(input.trim(), baseUrl)
    url.hash = ''
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.href
  } catch {
    return null
  }
}

function normalizeDate(input) {
  if (!input) return null
  const trimmed = input.trim()
  const timestamp = Date.parse(trimmed)
  if (Number.isNaN(timestamp)) return null
  return new Date(timestamp).toISOString()
}

function sortByPublishedDesc(items) {
  return [...items].sort((a, b) => {
    const aTime = dateToSortableNumber(a.publishedAt)
    const bTime = dateToSortableNumber(b.publishedAt)
    if (bTime !== aTime) return bTime - aTime
    return (a.title || '').localeCompare(b.title || '')
  })
}

function dateToSortableNumber(value) {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function dedupeByKey(items, keyFn) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = keyFn(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null
    }
    return null
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
