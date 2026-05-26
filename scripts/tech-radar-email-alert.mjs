#!/usr/bin/env node
/**
 * tech-radar-email-alert.mjs
 *
 * Sends email alerts from imported tech-radar intelligence payload.
 *
 * Modes:
 *  - urgent: sends when NEW high/critical signals are detected (deduped)
 *  - daily: sends at most once every 24h as a digest
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const INTELLIGENCE_PATH = resolve(ROOT, 'docs/tech-radar/intelligence/latest.json')
const STATE_PATH = resolve(ROOT, 'docs/tech-radar/intelligence/email-alert-state.json')

const SENDGRID_API_KEY = String(process.env.SENDGRID_API_KEY || '').trim()
const SENDGRID_FROM_EMAIL = String(process.env.SENDGRID_FROM_EMAIL || '').trim()
const SENDGRID_FROM_NAME = String(process.env.SENDGRID_FROM_NAME || 'JWordenAI Tech Radar').trim()
const ALERT_TO = String(process.env.TECH_RADAR_ALERT_TO_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || '').trim()

const PRIORITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 }

main().catch((err) => {
  console.error('[tech-radar-email-alert] failed:', err)
  process.exit(1)
})

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const intelligence = await readJson(INTELLIGENCE_PATH)
  const state = await readJsonIfExists(STATE_PATH) || {
    sentSignalKeys: [],
    lastDailySentAt: null,
  }

  const minPriority = args.minPriority
  const signals = Array.isArray(intelligence.prioritizedSignals) ? intelligence.prioritizedSignals : []

  const filtered = signals.filter((item) => (PRIORITY_RANK[item.priority] || 0) >= (PRIORITY_RANK[minPriority] || 0))
  const recipients = ALERT_TO
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL || recipients.length === 0) {
    console.log('[tech-radar-email-alert] skipped: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, and TECH_RADAR_ALERT_TO_EMAIL/ADMIN_NOTIFY_EMAIL are required')
    process.exit(0)
  }

  let payload = null
  if (args.mode === 'urgent') {
    payload = buildUrgentPayload(filtered, state, args.maxItems)
    if (!payload) {
      console.log('[tech-radar-email-alert] urgent: no new matching signals to send')
      process.exit(0)
    }
  } else {
    payload = buildDailyPayload(filtered, intelligence, state, args.maxItems)
    if (!payload) {
      console.log('[tech-radar-email-alert] daily: digest already sent in last 24h or no matching signals')
      process.exit(0)
    }
  }

  await sendSendGridEmail({
    to: recipients,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  })

  const nextState = {
    sentSignalKeys: dedupe([...state.sentSignalKeys || [], ...payload.signalKeys]).slice(-2000),
    lastDailySentAt: args.mode === 'daily' ? new Date().toISOString() : state.lastDailySentAt || null,
    lastRunAt: new Date().toISOString(),
  }
  await mkdir(resolve(ROOT, 'docs/tech-radar/intelligence'), { recursive: true })
  await writeFile(STATE_PATH, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8')

  console.log(`[tech-radar-email-alert] sent ${args.mode} alert to ${recipients.length} recipient(s) with ${payload.signalKeys.length} signal(s)`) 
}

function buildUrgentPayload(signals, state, maxItems) {
  const sent = new Set(Array.isArray(state.sentSignalKeys) ? state.sentSignalKeys : [])
  const fresh = signals
    .map((item) => ({ item, key: signalKey(item) }))
    .filter(({ key }) => !sent.has(key))
    .slice(0, maxItems)

  if (fresh.length === 0) return null

  const entries = fresh.map((row) => row.item)
  const keys = fresh.map((row) => row.key)

  return {
    signalKeys: keys,
    subject: `[Tech Radar][Urgent] ${entries.length} new high-priority technology signal${entries.length === 1 ? '' : 's'}`,
    html: renderHtml({ mode: 'urgent', entries }),
    text: renderText({ mode: 'urgent', entries }),
  }
}

function buildDailyPayload(signals, intelligence, state, maxItems) {
  const lastSent = state.lastDailySentAt ? Date.parse(state.lastDailySentAt) : 0
  if (lastSent && !Number.isNaN(lastSent)) {
    const hoursSince = (Date.now() - lastSent) / 36e5
    if (hoursSince < 24) return null
  }

  const entries = signals.slice(0, maxItems)
  if (entries.length === 0) return null

  const keys = entries.map((item) => signalKey(item))
  const generated = intelligence.generatedAt ? String(intelligence.generatedAt).slice(0, 10) : new Date().toISOString().slice(0, 10)

  return {
    signalKeys: keys,
    subject: `[Tech Radar][Daily] ${entries.length} prioritized signals (${generated})`,
    html: renderHtml({ mode: 'daily', entries }),
    text: renderText({ mode: 'daily', entries }),
  }
}

function renderHtml({ mode, entries }) {
  const rows = entries.map((item) => {
    const domains = Array.isArray(item.topDomains)
      ? item.topDomains.map((d) => `${escapeHtml(d.domainId)}(${d.score})`).join(', ')
      : 'n/a'
    return `<li style="margin-bottom:10px;"><strong>[${escapeHtml(item.priority || 'n/a')}] ${escapeHtml(item.title || 'Untitled')}</strong><br/><span style="color:#666;">${escapeHtml(item.sourceName || 'source')} · ${escapeHtml(item.publishedAt || 'date n/a')} · score ${escapeHtml(String(item.overallScore ?? 'n/a'))}</span><br/><span style="color:#444;">Domains: ${domains}</span><br/><a href="${escapeHtml(item.url || '#')}">${escapeHtml(item.url || 'n/a')}</a></li>`
  }).join('')

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.4;color:#111;">
      <h2 style="margin-bottom:6px;">Tech Radar ${mode === 'urgent' ? 'Urgent Alert' : 'Daily Digest'}</h2>
      <p style="margin-top:0;color:#555;">Auto-generated by JWordenAI 24/7 technology monitoring.</p>
      <ul style="padding-left:18px;">${rows}</ul>
    </div>
  `
}

function renderText({ mode, entries }) {
  const header = `Tech Radar ${mode === 'urgent' ? 'Urgent Alert' : 'Daily Digest'}`
  const lines = [header, '', 'Auto-generated by JWordenAI 24/7 technology monitoring.', '']
  for (const item of entries) {
    const domains = Array.isArray(item.topDomains) ? item.topDomains.map((d) => `${d.domainId}(${d.score})`).join(', ') : 'n/a'
    lines.push(`[${item.priority || 'n/a'}] ${item.title || 'Untitled'}`)
    lines.push(`Source: ${item.sourceName || 'source'} | Date: ${item.publishedAt || 'n/a'} | Score: ${item.overallScore ?? 'n/a'}`)
    lines.push(`Domains: ${domains}`)
    lines.push(`URL: ${item.url || 'n/a'}`)
    lines.push('')
  }
  return lines.join('\n')
}

async function sendSendGridEmail({ to, subject, html, text }) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: to.map((email) => ({ email })) }],
      from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`SendGrid mail send failed (${response.status}): ${errBody}`)
  }
}

function parseArgs(argv) {
  const out = {
    mode: 'urgent',
    minPriority: 'high',
    maxItems: 20,
    help: false,
  }

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      out.help = true
    } else if (arg.startsWith('--mode=')) {
      const val = String(arg.split('=')[1] || '').trim().toLowerCase()
      if (val === 'urgent' || val === 'daily') out.mode = val
    } else if (arg.startsWith('--min-priority=')) {
      const val = String(arg.split('=')[1] || '').trim().toLowerCase()
      if (PRIORITY_RANK[val]) out.minPriority = val
    } else if (arg.startsWith('--max-items=')) {
      const val = Number(arg.split('=')[1])
      if (!Number.isNaN(val) && val > 0) out.maxItems = Math.min(val, 100)
    }
  }
  return out
}

function printHelp() {
  console.log('Usage: node scripts/tech-radar-email-alert.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --mode=urgent|daily          Alert mode (default: urgent)')
  console.log('  --min-priority=high|critical|medium|low   Minimum priority to include (default: high)')
  console.log('  --max-items=<n>              Max signals to include (default: 20, max: 100)')
  console.log('  --help, -h                   Show help')
}

function signalKey(item) {
  return `${item.url || 'n/a'}|${item.priority || 'n/a'}`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function dedupe(items) {
  return [...new Set(items.filter(Boolean))]
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw)
}

async function readJsonIfExists(path) {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}
