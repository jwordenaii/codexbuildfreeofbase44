#!/usr/bin/env node
/**
 * tech-radar-watch.mjs
 *
 * Continuous watcher for 24/7 tech monitoring.
 * Runs radar collection + intelligence import on a fixed interval.
 */

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const RADAR_SCRIPT = resolve(ROOT, 'scripts/ai-tech-radar.mjs')
const IMPORT_SCRIPT = resolve(ROOT, 'scripts/tech-radar-import.mjs')
const EMAIL_ALERT_SCRIPT = resolve(ROOT, 'scripts/tech-radar-email-alert.mjs')

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  printHelp()
  process.exit(0)
}

run().catch((error) => {
  console.error('[tech-radar-watch] fatal error:', error)
  process.exit(1)
})

async function run() {
  console.log(`[tech-radar-watch] started at ${new Date().toISOString()}`)
  console.log(`[tech-radar-watch] interval minutes: ${args.intervalMinutes}`)
  console.log(`[tech-radar-watch] mode: ${args.once ? 'once' : 'continuous'}`)

  do {
    const cycleStarted = Date.now()
    console.log(`[tech-radar-watch] cycle begin ${new Date().toISOString()}`)

    const radarCode = await runNodeScript(RADAR_SCRIPT)
    if (radarCode !== 0) {
      console.error(`[tech-radar-watch] radar run failed with exit code ${radarCode}`)
    } else {
      const importCode = await runNodeScript(IMPORT_SCRIPT)
      if (importCode !== 0) {
        console.error(`[tech-radar-watch] import run failed with exit code ${importCode}`)
      } else {
        const urgentAlertCode = await runNodeScript(EMAIL_ALERT_SCRIPT, ['--mode=urgent', '--min-priority=high'])
        if (urgentAlertCode !== 0) {
          console.error(`[tech-radar-watch] urgent email alert run failed with exit code ${urgentAlertCode}`)
        }
        const dailyAlertCode = await runNodeScript(EMAIL_ALERT_SCRIPT, ['--mode=daily', '--min-priority=medium'])
        if (dailyAlertCode !== 0) {
          console.error(`[tech-radar-watch] daily email alert run failed with exit code ${dailyAlertCode}`)
        }
      }
    }

    const elapsedMs = Date.now() - cycleStarted
    console.log(`[tech-radar-watch] cycle end ${new Date().toISOString()} (${elapsedMs}ms)`)

    if (args.once) break

    const waitMs = Math.max(0, args.intervalMinutes * 60_000 - elapsedMs)
    console.log(`[tech-radar-watch] sleeping ${Math.round(waitMs / 1000)}s`)
    await delay(waitMs)
  } while (true)
}

function runNodeScript(scriptPath, extraArgs = []) {
  return new Promise((resolveCode) => {
    const child = spawn(process.execPath, [scriptPath, ...extraArgs], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    })

    child.on('close', (code) => resolveCode(code ?? 1))
    child.on('error', () => resolveCode(1))
  })
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

function parseArgs(input) {
  const out = {
    once: false,
    help: false,
    intervalMinutes: 60,
  }

  for (const arg of input) {
    if (arg === '--once') {
      out.once = true
    } else if (arg === '--help' || arg === '-h') {
      out.help = true
    } else if (arg.startsWith('--interval-minutes=')) {
      const value = Number(arg.split('=')[1])
      if (!Number.isNaN(value) && value >= 5) {
        out.intervalMinutes = value
      }
    }
  }

  return out
}

function printHelp() {
  console.log('Usage: node scripts/tech-radar-watch.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --once                        Run one cycle only and exit.')
  console.log('  --interval-minutes=<n>        Minutes between cycles (default: 60, min: 5).')
  console.log('  --help, -h                    Show this help text.')
}