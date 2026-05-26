import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Activity, AlertTriangle, CalendarDays, CircleCheckBig, Gauge, Loader2, Mail, Phone, ShieldCheck, UserRound, Upload, Bot, Sparkles, RefreshCw, Layers, Globe, Box, Layout, ArrowRight, FileText, Scale, HardHat, Power, Send, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { api, trackEvent } from '@/api/client'
import OwnerConfirmModal from '../components/OwnerConfirmModal'
import SessionUnlockModal from '../components/SessionUnlockModal'
import { voiceService } from '../lib/ElevenLabsService'
import { Link } from 'react-router-dom'
import states from '../data/legal/states'
import constructionLicensing from '../data/legal/constructionLicensing'
import mechanicsLienLaws from '../data/legal/mechanicsLienLaws'
import promptPaymentLaws from '../data/legal/promptPaymentLaws'
import contractLaw from '../data/legal/contractLaw'
import roadsAndPavingRegulations from '../data/legal/roadsAndPavingRegulations'
import { recommendStrategy, rankStatesByDispute, DISPUTE_TYPES, ROLES } from '../lib/lawyerRecommender'
import { optimizeLicenseStates, getLienLeverageByState, rankContractorBids } from '../lib/contractorRanker'

const RichmondGrid = lazy(() => import('../components/RichmondGrid'))
const INTERNAL_STRATEGY_ENABLED = true

function isCommandCenterPath() {
  if (typeof window === 'undefined') return false
  const path = String(window.location.pathname || '')
  return path === '/command-center' || path.startsWith('/command-center/')
}

const TABS = [
  { id: 'jarvis', label: 'Jarvis' },
  { id: 'richmond-grid', label: 'Richmond Grid' },
  { id: 'kpi', label: 'KPI Wall' },
  { id: 'crm', label: 'CRM Leads' },
  { id: 'ops', label: 'Ops Pipeline' },
  { id: 'civil-intel', label: 'Civil Intel' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'search-pulse', label: 'Search Pulse' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'thermal', label: 'Thermal' },
  { id: 'drone', label: 'Drone' },
  { id: 'lidar', label: 'LiDAR' },
  { id: 'roller', label: 'Roller' },
]

const WEATHER_RADAR_AREAS = [
  { id: 'richmond-va', label: 'Richmond, VA', lat: 37.5407, lng: -77.4360, zoom: 8 },
  { id: 'chesterfield-va', label: 'Chesterfield, VA', lat: 37.3789, lng: -77.5040, zoom: 9 },
  { id: 'hampton-roads-va', label: 'Hampton Roads, VA', lat: 36.8508, lng: -76.2859, zoom: 8 },
  { id: 'fredericksburg-va', label: 'Fredericksburg, VA', lat: 38.3032, lng: -77.4605, zoom: 8 },
  { id: 'northern-va', label: 'Northern Virginia', lat: 38.9072, lng: -77.0369, zoom: 8 },
  { id: 'charlottesville-va', label: 'Charlottesville, VA', lat: 38.0293, lng: -78.4767, zoom: 8 },
  { id: 'statewide-va', label: 'Virginia Statewide', lat: 37.4316, lng: -78.6569, zoom: 7 },
]

const WEATHER_RADAR_PROVIDERS = [
  { id: 'windy', label: 'Windy HD Radar' },
  { id: 'noaa', label: 'NOAA Radar (NWS)' },
]

function windyRadarUrl(areaId) {
  const area = WEATHER_RADAR_AREAS.find((row) => row.id === areaId) || WEATHER_RADAR_AREAS[0]
  return `https://www.windy.com/-Weather-radar-radar?radar,${area.lat},${area.lng},${area.zoom}`
}

function noaaRadarUrl(areaId) {
  const area = WEATHER_RADAR_AREAS.find((row) => row.id === areaId) || WEATHER_RADAR_AREAS[0]
  return `https://radar.weather.gov/?settings=v1_${area.lng}_${area.lat}`
}

function buildRadarUrl(providerId, areaId) {
  return providerId === 'noaa' ? noaaRadarUrl(areaId) : windyRadarUrl(areaId)
}

function normalizeText(value) {
  return String(value || '').toLowerCase()
}

function inferRadarAreaFromJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) return null
  const candidates = WEATHER_RADAR_AREAS.map((row) => ({ ...row, score: 0 }))

  const weightMatch = (text, tokens, points) => {
    if (!text) return 0
    const lower = normalizeText(text)
    return tokens.some((token) => lower.includes(token)) ? points : 0
  }

  for (const job of jobs.slice(0, 120)) {
    const haystack = [
      job?.address,
      job?.city,
      job?.state,
      job?.state_code,
      job?.location,
      job?.market,
      job?.site_name,
      job?.project_name,
      job?.name,
      job?.description,
    ]

    for (const area of candidates) {
      if (area.id === 'richmond-va') {
        area.score += haystack.reduce((sum, text) => sum + weightMatch(text, ['richmond', 'henrico', 'short pump', 'glen allen', 'bon air', 'lakeside'], 3), 0)
      }
      if (area.id === 'chesterfield-va') {
        area.score += haystack.reduce((sum, text) => sum + weightMatch(text, ['chesterfield', 'chester', 'midlothian', 'powhatan', 'amelia', 'dinwiddie'], 3), 0)
      }
      if (area.id === 'hampton-roads-va') {
        area.score += haystack.reduce((sum, text) => sum + weightMatch(text, ['hampton roads', 'norfolk', 'chesapeake', 'virginia beach', 'newport news', 'hampton', 'portsmouth', 'suffolk'], 3), 0)
      }
      if (area.id === 'fredericksburg-va') {
        area.score += haystack.reduce((sum, text) => sum + weightMatch(text, ['fredericksburg', 'spotsylvania', 'stafford', 'caroline', 'king george'], 3), 0)
      }
      if (area.id === 'northern-va') {
        area.score += haystack.reduce((sum, text) => sum + weightMatch(text, ['northern virginia', 'fairfax', 'arlington', 'alexandria', 'loudoun', 'prince william', 'mclean'], 3), 0)
      }
      if (area.id === 'charlottesville-va') {
        area.score += haystack.reduce((sum, text) => sum + weightMatch(text, ['charlottesville', 'albemarle', 'louisa', 'fluvanna', 'orange'], 3), 0)
      }
      area.score += haystack.reduce((sum, text) => sum + weightMatch(text, ['virginia', 'va'], 1), 0)
    }
  }

  const best = [...candidates].sort((a, b) => b.score - a.score)[0]
  if (!best || best.score <= 0) return null
  return best.id
}

// ── Autonomy master controls (you decide what runs on its own) ────────────
const AUTONOMY_KEY = 'cc_autonomy_master_v1'
const AUTONOMY_DOMAINS = [
  { id: 'leadReplies',     label: 'Auto Lead Replies',       desc: 'Jarvis answers new lead messages without waiting for you.' },
  { id: 'followUps',       label: 'Auto Follow-Ups',         desc: 'Schedule next-step nudges to warm leads on its own.' },
  { id: 'weatherAlerts',   label: 'Weather-Based Reschedule',desc: 'Move jobs when storms threaten without asking.' },
  { id: 'auditRemediation',label: 'Auto Audit Remediation',  desc: 'Run safe self-heal actions when audits flag issues.' },
  { id: 'adBudget',        label: 'Auto Ad Budget Tuning',   desc: 'Shift Google Ads spend across campaigns automatically.' },
  { id: 'twinSnapshots',   label: 'Auto Digital Twin Snapshots', desc: 'Take cognitive twin snapshots on schedule.' },
]
function readAutonomyState() {
  if (typeof window === 'undefined') return { master: false, domains: {}, frozen: false, frozenAt: null }
  try {
    const raw = window.localStorage.getItem(AUTONOMY_KEY)
    if (!raw) return { master: false, domains: {}, frozen: false, frozenAt: null }
    const parsed = JSON.parse(raw)
    return {
      master:   Boolean(parsed.master),
      domains:  parsed.domains || {},
      frozen:   Boolean(parsed.frozen),
      frozenAt: parsed.frozenAt || null,
    }
  } catch {
    return { master: false, domains: {}, frozen: false, frozenAt: null }
  }
}
function writeAutonomyState(state) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(AUTONOMY_KEY, JSON.stringify(state)) } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('cc:autonomy-changed', { detail: state })) } catch { /* ignore */ }
}
// PANIC: hard freeze. Forces master OFF, clears all domains, sets frozen=true.
// Frozen state survives page reload. Use unfreeze() to clear.
function triggerPanic(reason = 'manual') {
  const next = { master: false, domains: {}, frozen: true, frozenAt: new Date().toISOString(), reason }
  writeAutonomyState(next)
  // Defense-in-depth: also tell the backend so server-side autonomy stops too.
  // Best-effort, never throws — UI freeze succeeds even if network fails.
  try {
    api.freezeAutonomy?.(reason)?.catch?.(() => { /* ignore */ })
  } catch { /* ignore */ }
  return next
}
function unfreeze() {
  const next = { master: false, domains: {}, frozen: false, frozenAt: null }
  writeAutonomyState(next)
  try {
    api.unfreezeAutonomy?.()?.catch?.(() => { /* ignore */ })
  } catch { /* ignore */ }
  return next
}

const KPI_CARDS = [
  { label: 'Inbound Leads (7d)', value: '42', delta: '+18%', tone: 'good', icon: UserRound },
  { label: 'Booked Site Visits', value: '19', delta: '+9%', tone: 'good', icon: CalendarDays },
  { label: 'Close Rate', value: '37%', delta: '+4.2%', tone: 'good', icon: Gauge },
  { label: 'Avg. First Reply', value: '5m 12s', delta: '-21%', tone: 'good', icon: Phone },
]

const CRM_LEADS = [
  { name: 'Carter Family', city: 'Chester', service: 'Driveway replacement', score: 92, status: 'Hot', next: 'Call at 5:30 PM' },
  { name: 'Maple Ridge HOA', city: 'Midlothian', service: 'Private lane resurfacing', score: 84, status: 'Warm', next: 'Send proposal PDF' },
  { name: 'Jenkins Auto', city: 'Richmond', service: 'Parking lot patch + seal', score: 76, status: 'Warm', next: 'Schedule site visit' },
  { name: 'Talbot Residence', city: 'Mechanicsville', service: 'Extension + apron', score: 66, status: 'Nurture', next: 'Follow up Thursday' },
]

const OPERATIONS_FEED = [
  { time: '09:42', text: 'New high-intent lead captured from Chester landing page', tone: 'good' },
  { time: '09:27', text: 'Proposal delivered to Maple Ridge HOA', tone: 'neutral' },
  { time: '08:58', text: 'Weather check flagged rain window for afternoon crew', tone: 'warn' },
  { time: '08:31', text: 'Review request automation sent for completed driveway job', tone: 'neutral' },
]

const AUTOMATION_LOG_KEY = 'cc_automation_run_log_v1'
const WEEKEND_SPRINT_STATE_KEY = 'cc_weekend_sprint_state_v1'
const HUMAN_CHECKS_STATE_KEY = 'cc_human_checks_state_v1'
const GOOGLE_ADS_BUDGET_STATE_KEY = 'cc_google_ads_budget_state_v1'
const JARVIS_ACTIVITY_KEY = 'cc_jarvis_activity_v1'
const SLA_ALARMED_KEY = 'cc_sla_alarmed_v1'

function readAutomationRuns() {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(AUTOMATION_LOG_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function appendAutomationRun(run) {
  try {
    if (typeof window === 'undefined') return
    const next = [run, ...readAutomationRuns()].slice(0, 80)
    localStorage.setItem(AUTOMATION_LOG_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('cc:automation-run-updated'))
  } catch {
    // Keep UI resilient even if storage fails.
  }
}

// ── Jarvis live-activity feed (shared across CRM + dashboard panels) ───────
function readJarvisActivity() {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(JARVIS_ACTIVITY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function appendJarvisActivity(entry) {
  try {
    if (typeof window === 'undefined') return
    const stamped = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      ...entry,
    }
    const next = [stamped, ...readJarvisActivity()].slice(0, 60)
    localStorage.setItem(JARVIS_ACTIVITY_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('cc:jarvis-activity', { detail: stamped }))
  } catch {
    // best-effort logger
  }
}

function readWeekendSprintState() {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(WEEKEND_SPRINT_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeWeekendSprintState(payload) {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(WEEKEND_SPRINT_STATE_KEY, JSON.stringify(payload))
  } catch {
    // Keep dashboard usable if localStorage is unavailable.
  }
}

function parseBoolLike(input) {
  const value = String(input || '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'up', 'ready', 'ok', 'healthy', 'configured'].includes(value)
}

// ── Shared UI Components ───────────────────────────────────────────────────

function HubLinkPanel() {
  const hubs = [
    {
      title: 'Level 4 Autonomy',
      desc: 'Cognitive Digital Twin & Drift Remediation',
      path: '/autonomy',
      icon: Layers,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
    },
    {
      title: 'Virginia Statewide Hub',
      desc: 'SCC Verifier & VDOT Bid Board',
      path: '/virginia-statewide',
      icon: Globe,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      title: '3D Floor Plan Studio',
      desc: 'Houzz-style Visualizer & Cost Catalog',
      path: '/floor-plan-studio',
      icon: Box,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      title: 'Enterprise AI Platform',
      desc: 'Licensed L4 Controls & Agent Registry',
      path: '/jwordenai',
      icon: Layout,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {hubs.map((hub) => (
        <Link
          key={hub.path}
          to={hub.path}
          className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/20 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${hub.bg} ${hub.color}`}>
              <hub.icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-white text-base group-hover:text-brand-amber transition-colors">
                {hub.title}
              </h3>
              <p className="text-white/40 text-xs mt-0.5 truncate">{hub.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-brand-amber group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      ))}
    </div>
  )
}

// Owner confirmation modal mounted for CRM actions
// Uses local state `pendingOwnerAction` and `performPendingOwnerAction` defined above
{/** placeholder for OwnerConfirmModal mount - injected in component scope via JSX below */}


function statusTone(score) {
  if (score >= 85) return 'text-emerald-300 border-emerald-300/50 bg-emerald-300/10'
  if (score >= 70) return 'text-amber-300 border-amber-300/50 bg-amber-300/10'
  return 'text-sky-300 border-sky-300/50 bg-sky-300/10'
}

function KpiCard({ label, value, delta, tone, icon: Icon }) {
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-white/70'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5 shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white/55 text-xs uppercase tracking-[0.14em]">{label}</p>
          <p className="text-white text-2xl md:text-3xl font-black mt-2 leading-none">{value}</p>
          <p className={`text-xs font-semibold mt-3 ${toneClass}`}>{delta} vs previous period</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
          <Icon className="w-5 h-5 text-brand-amber" />
        </div>
      </div>
      <OwnerConfirmModal
        open={Boolean(pendingOwnerAction)}
        title={pendingOwnerAction ? (pendingOwnerAction.kind === 'call' ? 'Confirm Call' : 'Confirm Email') : ''}
        message={pendingOwnerAction ? `Authorize Jarvis to ${pendingOwnerAction.kind} ${pendingOwnerAction.lead?.name || pendingOwnerAction.lead?.phone || pendingOwnerAction.lead?.email}? This requires operator approval.` : ''}
        defaultToken={typeof window !== 'undefined' ? window.sessionStorage.getItem('OWNER_TOKEN') || '' : ''}
        onCancel={() => setPendingOwnerAction(null)}
        onConfirm={(opts) => performPendingOwnerAction(opts)}
      />
      <SessionUnlockModal open={showUnlockModal} defaultPin="" defaultToken={typeof window !== 'undefined' ? sessionStorage.getItem('OWNER_TOKEN') || '' : ''} onCancel={() => setShowUnlockModal(false)} onUnlock={handleUnlock} />
    </div>
  )
}

function SystemHealth() {
  const checks = [
    { label: 'Command Center PIN', ok: Boolean(import.meta.env.VITE_CC_PASSWORD) },
    { label: 'Google Maps key', ok: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY) },
    { label: 'Avatar model override', ok: Boolean(import.meta.env.VITE_CONCIERGE_AVATAR_MODEL_URL || import.meta.env.VITE_CONCIERGE_AVATAR_MODEL_URLS) },
    { label: 'Auth mode set', ok: Boolean(import.meta.env.VITE_AUTH_MODE) },
  ]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-4 h-4 text-brand-amber" />
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">System Health</h3>
      </div>
      <div className="space-y-2.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/15 px-3 py-2">
            <span className="text-white/75 text-sm">{check.label}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${check.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
              {check.ok ? <CircleCheckBig className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {check.ok ? 'Ready' : 'Needs setup'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApiKeysPanel() {
  const publicVars = [
    {
      keyName: 'VITE_CC_PASSWORD',
      required: true,
      valuePresent: Boolean(import.meta.env.VITE_CC_PASSWORD),
      purpose: 'Command Center unlock gate',
    },
    {
      keyName: 'VITE_GOOGLE_MAPS_API_KEY',
      required: true,
      valuePresent: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
      purpose: 'Maps + location visuals',
    },
    {
      keyName: 'VITE_CONCIERGE_AVATAR_MODEL_URL / VITE_CONCIERGE_AVATAR_MODEL_URLS',
      required: false,
      valuePresent: Boolean(import.meta.env.VITE_CONCIERGE_AVATAR_MODEL_URL || import.meta.env.VITE_CONCIERGE_AVATAR_MODEL_URLS),
      purpose: 'Custom avatar model',
    },
    {
      keyName: 'VITE_AUTH_MODE',
      required: true,
      valuePresent: Boolean(import.meta.env.VITE_AUTH_MODE),
      purpose: 'Public/internal auth behavior',
    },
  ]

  const privateSecrets = [
    {
      keyName: 'OPENAI_API_KEY',
      required: true,
      purpose: 'AI chat + vision backend',
      location: 'Backend secret env only',
    },
    {
      keyName: 'GEMINI_API_KEY',
      required: false,
      purpose: 'Google Gemini provider for Google-aligned research/content workflows',
      location: 'Backend/automation secret env only',
    },
    {
      keyName: 'PERPLEXITY_API_KEY',
      required: false,
      purpose: 'Perplexity provider for web-grounded research workflows',
      location: 'Backend/automation secret env only',
    },
    {
      keyName: 'ANTHROPIC_API_KEY',
      required: false,
      purpose: 'Claude provider for math-heavy and long-context reasoning',
      location: 'Backend/automation secret env only',
    },
    {
      keyName: 'OPENAI_CODEX_MODEL',
      required: false,
      purpose: 'Codex model target for file/code task routing',
      location: 'Backend/automation env config',
    },
    {
      keyName: 'XAI_API_KEY (Grok)',
      required: false,
      purpose: 'Grok (xAI) model calls for X workflow automation',
      location: 'Backend/automation secret env only',
    },
    {
      keyName: 'X_BEARER_TOKEN',
      required: false,
      purpose: 'Read/listen operations for X APIs',
      location: 'Backend/automation secret env only',
    },
    {
      keyName: 'X_API_KEY + X_API_SECRET',
      required: false,
      purpose: 'X app authentication for posting and account actions',
      location: 'Backend/automation secret env only',
    },
    {
      keyName: 'X_ACCESS_TOKEN + X_ACCESS_TOKEN_SECRET',
      required: false,
      purpose: 'User-context posting/actions on X account',
      location: 'Backend/automation secret env only',
    },
    {
      keyName: 'DROPBOX_ACCESS_TOKEN',
      required: false,
      purpose: 'Dropbox media pull for gallery ingest CLI',
      location: 'CLI terminal/runner env only',
    },
    {
      keyName: 'DROPBOX_PATH',
      required: false,
      purpose: 'Optional Dropbox import folder path',
      location: 'CLI terminal/runner env only',
    },
    {
      keyName: 'GOOGLE_PHOTOS_ACCESS_TOKEN',
      required: false,
      purpose: 'Google Photos media pull for gallery ingest CLI',
      location: 'CLI terminal/runner env only',
    },
    {
      keyName: 'GOOGLE_PHOTOS_ALBUM_ID',
      required: false,
      purpose: 'Optional Google Photos album scope',
      location: 'CLI terminal/runner env only',
    },
    {
      keyName: 'SENTRY_DSN',
      required: false,
      purpose: 'Error monitoring + performance tracing backend integration',
      location: 'Backend secret env only',
    },
  ]

  const publicReadyCount = publicVars.filter((v) => v.valuePresent).length
  const publicRequiredCount = publicVars.filter((v) => v.required).length
  const publicRequiredReady = publicVars.filter((v) => v.required && v.valuePresent).length

  const modelRouting = [
    { task: 'Google workflows', provider: 'Gemini', envKey: 'GEMINI_API_KEY' },
    { task: 'Research briefs', provider: 'Perplexity', envKey: 'PERPLEXITY_API_KEY' },
    { task: 'Math reasoning', provider: 'Claude', envKey: 'ANTHROPIC_API_KEY' },
    { task: 'File/code ops', provider: 'Codex', envKey: 'OPENAI_API_KEY + OPENAI_CODEX_MODEL' },
  ]

  const keySources = [
    {
      envKey: 'OPENAI_API_KEY',
      provider: 'OpenAI',
      portalUrl: 'https://platform.openai.com/api-keys',
      note: 'Create secret key for AI chat/vision + Codex routing baseline.',
    },
    {
      envKey: 'GEMINI_API_KEY',
      provider: 'Google AI Studio',
      portalUrl: 'https://aistudio.google.com/app/apikey',
      note: 'Create Gemini key for Google-aligned workflows.',
    },
    {
      envKey: 'PERPLEXITY_API_KEY',
      provider: 'Perplexity',
      portalUrl: 'https://www.perplexity.ai/settings/api',
      note: 'Create API key for research briefs and web-grounded tasks.',
    },
    {
      envKey: 'ANTHROPIC_API_KEY',
      provider: 'Anthropic Console',
      portalUrl: 'https://console.anthropic.com/settings/keys',
      note: 'Create Claude key for math + long-context reasoning.',
    },
    {
      envKey: 'XAI_API_KEY',
      provider: 'xAI Console',
      portalUrl: 'https://console.x.ai/',
      note: 'Create Grok API key for X automation workflows.',
    },
    {
      envKey: 'X_BEARER_TOKEN / X_* tokens',
      provider: 'X Developer Portal',
      portalUrl: 'https://developer.x.com/en/portal/dashboard',
      note: 'Create app + user tokens for X posting/listening automations.',
    },
    {
      envKey: 'DROPBOX_ACCESS_TOKEN',
      provider: 'Dropbox App Console',
      portalUrl: 'https://www.dropbox.com/developers/apps',
      note: 'Generate access token for media ingest CLI.',
    },
    {
      envKey: 'GOOGLE_PHOTOS_ACCESS_TOKEN',
      provider: 'Google Cloud Console',
      portalUrl: 'https://console.cloud.google.com/apis/credentials',
      note: 'Create OAuth client + token for Google Photos ingest.',
    },
    {
      envKey: 'SENTRY_DSN',
      provider: 'Sentry',
      portalUrl: 'https://sentry.io/settings/',
      note: 'Create project DSN for backend error + performance monitoring.',
    },
  ]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">
          API Keys + Secrets Checklist
        </h3>
        <span className="text-xs text-white/45">
          Public ready: {publicReadyCount}/{publicVars.length} · Required: {publicRequiredReady}/{publicRequiredCount}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Public App Variables (VITE)</p>
          <div className="space-y-2">
            {publicVars.map((item) => (
              <div key={item.keyName} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white text-xs font-semibold break-all">{item.keyName}</p>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${item.valuePresent ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {item.valuePresent ? 'Set' : 'Missing'}
                  </span>
                </div>
                <p className="text-white/55 text-[11px] mt-1">{item.purpose}{item.required ? ' (required)' : ' (optional)'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Private Ops Secrets (Do Not Use VITE)</p>
          <div className="space-y-2">
            {privateSecrets.map((item) => (
              <div key={item.keyName} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white text-xs font-semibold break-all">{item.keyName}</p>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${item.required ? 'text-amber-300' : 'text-sky-300'}`}>
                    {item.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <p className="text-white/55 text-[11px] mt-1">{item.purpose}</p>
                <p className="text-brand-amber text-[11px] mt-1">{item.location}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Model Routing Policy</p>
        <div className="space-y-2">
          {modelRouting.map((row) => (
            <div key={row.task} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-xs font-semibold">{row.task}</p>
                <p className="text-white/55 text-[11px] mt-0.5">Env: {row.envKey}</p>
              </div>
              <span className="text-brand-amber text-xs font-bold uppercase tracking-[0.12em]">{row.provider}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Get Keys Fast</p>
        <div className="space-y-2">
          {keySources.map((row) => (
            <div key={row.envKey} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                <div>
                  <p className="text-white text-xs font-semibold break-all">{row.envKey}</p>
                  <p className="text-white/55 text-[11px] mt-0.5">{row.note}</p>
                  <p className="text-brand-amber text-[11px] mt-0.5">{row.provider}</p>
                </div>

                <a
                  href={row.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-brand-amber/40 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-brand-amber hover:bg-brand-amber/10"
                >
                  Open Portal
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActivityFeed() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-brand-amber" />
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Operations Feed</h3>
      </div>
      <div className="space-y-2.5">
        {OPERATIONS_FEED.map((item) => (
          <div key={`${item.time}-${item.text}`} className="rounded-lg border border-white/10 bg-black/15 px-3 py-2.5">
            <p className="text-[11px] text-white/45 font-semibold tracking-wide">{item.time}</p>
            <p className={`text-sm mt-1 ${item.tone === 'warn' ? 'text-amber-200' : item.tone === 'good' ? 'text-emerald-200' : 'text-white/80'}`}>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CrmTable() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)
  const [actionKind, setActionKind] = useState(null) // 'call' | 'email'
  const [note, setNote] = useState('')
  const [errorNote, setErrorNote] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await api.entities.Lead.list('-created_date', 25)
      setLeads(Array.isArray(rows) ? rows : [])
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    const off = api.entities.Lead.subscribe?.(() => reload())
    return () => { try { off?.() } catch { /* noop */ } }
  }, [reload])

  const callLead = useCallback(async (lead) => {
    // open confirm modal
    if (!lead?.phone) { setErrorNote(`No phone on file for ${lead.name || 'lead'}`); return }
    setPendingOwnerAction({ kind: 'call', lead })
  }, [])

  const emailLead = useCallback(async (lead) => {
    if (!lead?.email) { setErrorNote(`No email on file for ${lead.name || 'lead'}`); return }
    setPendingOwnerAction({ kind: 'email', lead })
  }, [])

  // pending owner modal state
  const [pendingOwnerAction, setPendingOwnerAction] = useState(null)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [sessionUnlocked, setSessionUnlocked] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem('OWNER_PIN_HASH'))
    } catch {
      return false
    }
  })

  const performPendingOwnerAction = useCallback(async ({ token = null } = {}) => {
    if (!pendingOwnerAction) return
    const { kind, lead } = pendingOwnerAction
    // persist token to session if provided
    try { if (token) window.sessionStorage.setItem('OWNER_TOKEN', token) } catch { /* noop */ }
    setActingId(lead.id); setActionKind(kind); setErrorNote(''); setNote('')
    try {
      if (kind === 'call') {
        const res = await api.jarvisCall(
          lead.phone,
          `Reach ${lead.name || 'lead'} about ${lead.service_type || lead.surface_type || 'their estimate'}`,
          `Hi this is Jarvis calling on behalf of J. Worden & Sons about your ${lead.service_type || 'paving'} request. Is now a good time?`
        )
        const ok = res?.status === 'queued' || res?.status === 'success' || res?.call_id
        setNote(ok ? `☎️ Jarvis is calling ${lead.name || lead.phone}…` : (res?.message || 'Call request sent.'))
        appendJarvisActivity({ kind: 'call', leadId: lead.id, leadName: lead.name, phone: lead.phone, status: ok ? 'queued' : 'unknown', detail: res?.message || '' })
        try { trackEvent('jarvis_call_lead', { lead_id: lead.id, source: 'crm_table' }) } catch { /* noop */ }
      } else if (kind === 'email') {
        const subject = `Following up on your ${lead.service_type || 'paving'} request — J. Worden & Sons`
        const body = `Hi ${lead.name || 'there'},\n\nThanks for reaching out to J. Worden & Sons about your ${lead.service_type || 'project'}${lead.address ? ` at ${lead.address}` : ''}. We'd love to put together a free estimate. What's the best time for a quick call this week?\n\nWe're a 3rd-generation family business and every estimate is reviewed by Jeremy personally.\n\nReply to this email or text us at 804-446-1296.\n\n— J. Worden & Sons`
        const res = await api.jarvisEmail(subject, body, lead.email)
        const ok = res?.status === 'sent' || res?.status === 'queued' || res?.message_id
        setNote(ok ? `✉️ Email sent to ${lead.email}` : (res?.message || 'Email request sent.'))
        appendJarvisActivity({ kind: 'email', leadId: lead.id, leadName: lead.name, email: lead.email, status: ok ? 'sent' : 'unknown', detail: res?.message || '' })
        try { trackEvent('jarvis_email_lead', { lead_id: lead.id, source: 'crm_table' }) } catch { /* noop */ }
      }
    } catch (err) {
      setErrorNote(err?.message || `Could not perform ${pendingOwnerAction.kind}.`)
      appendJarvisActivity({ kind: pendingOwnerAction.kind, leadId: lead.id, leadName: lead.name, status: 'failed', detail: err?.message || '' })
    } finally {
      setActingId(null); setActionKind(null); setPendingOwnerAction(null)
    }
  }, [pendingOwnerAction])

  const handleUnlock = useCallback(({ pin, token }) => {
    setShowUnlockModal(false)
    setSessionUnlocked(true)
    try { if (token) sessionStorage.setItem('OWNER_TOKEN', token) } catch { /* noop */ }
    alert('Session unlocked for this tab.')
  }, [])

  const askJarvisDraft = useCallback((lead) => {
    if (typeof window === 'undefined') return
    const prompt = `Draft a reply for lead #${lead.id} — ${lead.name || 'unknown'} — about ${lead.service_type || 'their request'}. Then summarize next 3 steps to close them.`
    window.dispatchEvent(new CustomEvent('cc:jarvis-prefill', { detail: { prompt } }))
  }, [])

  const rows = leads.length > 0 ? leads : null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
      <div className="px-4 md:px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Active Leads Queue</h3>
          <p className="text-white/45 text-xs mt-0.5">Tap Call or Email and Jarvis takes the action immediately.</p>
        </div>
          <div className="ml-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUnlockModal(true)}
              className="text-xs px-2 py-1.5 rounded bg-white/[0.06] border border-white/10 text-white/70 hover:text-white"
            >Unlock</button>
            <button
              type="button"
              onClick={() => { try { sessionStorage.removeItem('OWNER_PIN_HASH'); sessionStorage.removeItem('OWNER_TOKEN'); setSessionUnlocked(false); alert('Session locked.'); } catch { alert('Could not lock session.'); } }}
              className="text-xs px-2 py-1.5 rounded bg-white/[0.03] border border-white/10 text-white/70 hover:text-white"
            >Lock</button>
          </div>
          <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-white/45 border-b border-white/10">
              <th className="px-4 md:px-5 py-3">Lead</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 md:px-5 py-3">Jarvis Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-white/55 text-sm">Loading leads…</td></tr>
            ) : rows ? (
              rows.map((lead) => {
                const score = Number(lead.score || 0)
                const tier = String(lead.score_tier || (score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : 'Nurture'))
                const busyCall = actingId === lead.id && actionKind === 'call'
                const busyEmail = actingId === lead.id && actionKind === 'email'
                return (
                  <tr key={lead.id} className="border-b border-white/10 last:border-b-0">
                    <td className="px-4 md:px-5 py-3.5">
                      <p className="text-white text-sm font-semibold">{lead.name || 'Website Visitor'}</p>
                      <p className="text-white/50 text-xs mt-0.5">{lead.address || lead.city || '—'}</p>
                      {lead.phone ? <p className="text-white/40 text-[11px] mt-0.5">{lead.phone}</p> : null}
                    </td>
                    <td className="px-4 py-3.5 text-white/75 text-sm">{lead.service_type || lead.surface_type || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone(score)}`}>{score || tier}</span>
                    </td>
                    <td className="px-4 py-3.5 text-white/75 text-sm capitalize">{lead.status || 'new'}</td>
                    <td className="px-4 md:px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => callLead(lead)}
                          disabled={busyCall || !lead.phone}
                          title={lead.phone ? `Have Jarvis call ${lead.phone}` : 'No phone on file'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-300/15 disabled:opacity-40"
                        >
                          {busyCall ? <Loader2 className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />} Call
                        </button>
                        <button
                          type="button"
                          onClick={() => emailLead(lead)}
                          disabled={busyEmail || !lead.email}
                          title={lead.email ? `Have Jarvis email ${lead.email}` : 'No email on file'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-300/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 hover:bg-amber-300/15 disabled:opacity-40"
                        >
                          {busyEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Email
                        </button>
                        <button
                          type="button"
                          onClick={() => askJarvisDraft(lead)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                        >
                          <Bot className="w-3 h-3" /> Ask Jarvis
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              CRM_LEADS.map((lead) => (
                <tr key={lead.name} className="border-b border-white/10 last:border-b-0">
                  <td className="px-4 md:px-5 py-3.5">
                    <p className="text-white text-sm font-semibold">{lead.name}</p>
                    <p className="text-white/50 text-xs mt-0.5">{lead.city}</p>
                  </td>
                  <td className="px-4 py-3.5 text-white/75 text-sm">{lead.service}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone(lead.score)}`}>{lead.score}</span>
                  </td>
                  <td className="px-4 py-3.5 text-white/75 text-sm">{lead.status}</td>
                  <td className="px-4 md:px-5 py-3.5 text-brand-amber text-sm font-semibold">{lead.next}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function OperationsPipelinePanel() {
  const [loading, setLoading] = useState(true)
  const [creatingEstimateId, setCreatingEstimateId] = useState(null)
  const [creatingJobId, setCreatingJobId] = useState(null)
  const [creatingWorkOrderId, setCreatingWorkOrderId] = useState(null)
  const [error, setError] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [recentLeads, setRecentLeads] = useState([])
  const [estimates, setEstimates] = useState([])
  const [jobs, setJobs] = useState([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [leadData, estimateData, jobData] = await Promise.all([
        api.listRecentOperationalLeads(8),
        api.listEstimates(),
        api.listJobs(),
      ])
      setRecentLeads(Array.isArray(leadData?.leads) ? leadData.leads : [])
      setEstimates(Array.isArray(estimateData?.estimates) ? estimateData.estimates : [])
      setJobs(Array.isArray(jobData?.jobs) ? jobData.jobs : [])
    } catch (loadError) {
      setError(loadError?.message || 'Could not load operations pipeline.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateEstimate = useCallback(async (lead) => {
    setCreatingEstimateId(lead.id)
    setStatusNote('')
    setError('')
    try {
      await api.createEstimateFromLead(lead.id, lead.address ? `Operational estimate for ${lead.address}` : undefined)
      setStatusNote(`Estimate created from lead #${lead.id}.`)
      await loadData()
    } catch (createError) {
      setError(createError?.message || 'Could not create estimate.')
    } finally {
      setCreatingEstimateId(null)
    }
  }, [loadData])

  const handleCreateJob = useCallback(async (estimate) => {
    setCreatingJobId(estimate.id)
    setStatusNote('')
    setError('')
    try {
      await api.createJobFromEstimate(estimate.id, {
        name: `${estimate.service_type || 'Project'} execution ${estimate.estimate_number}`,
      })
      setStatusNote(`Job created from ${estimate.estimate_number}.`)
      await loadData()
    } catch (createError) {
      setError(createError?.message || 'Could not create job.')
    } finally {
      setCreatingJobId(null)
    }
  }, [loadData])

  const handleCreateWorkOrder = useCallback(async (job) => {
    setCreatingWorkOrderId(job.id)
    setStatusNote('')
    setError('')
    try {
      await api.createWorkOrder({
        job_id: job.id,
        title: `Dispatch ${job.job_number}`,
        assigned_crew: 'Crew A',
      })
      setStatusNote(`Work order created for ${job.job_number}.`)
      await loadData()
    } catch (createError) {
      setError(createError?.message || 'Could not create work order.')
    } finally {
      setCreatingWorkOrderId(null)
    }
  }, [loadData])

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Operations Pipeline</h3>
            <p className="text-white/55 text-sm mt-1">Turn fresh leads into estimates, jobs, and work orders from one protected flow.</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/75 hover:border-brand-amber/40 hover:text-brand-amber"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {error ? <div className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
        {statusNote ? <div className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{statusNote}</div> : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-3">Recent Leads</p>
            <div className="space-y-2.5">
              {loading ? <p className="text-sm text-white/50">Loading leads…</p> : recentLeads.map((lead) => (
                <div key={lead.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
                  <p className="text-white text-sm font-semibold">#{lead.id} {lead.name || 'Lead'}</p>
                  <p className="text-white/55 text-xs mt-0.5">{lead.service_type || 'Service TBD'} · {lead.address || lead.state_code || 'No address yet'}</p>
                  <p className="text-white/35 text-[11px] mt-1">{formatTimestamp(lead.created_at)}</p>
                  <button
                    type="button"
                    onClick={() => handleCreateEstimate(lead)}
                    disabled={creatingEstimateId === lead.id}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-amber px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-brand-navy disabled:opacity-50"
                  >
                    {creatingEstimateId === lead.id ? 'Creating…' : 'Create Estimate'}
                  </button>
                </div>
              ))}
              {!loading && recentLeads.length === 0 ? <p className="text-sm text-white/50">No recent leads available.</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-3">Estimates</p>
            <div className="space-y-2.5">
              {loading ? <p className="text-sm text-white/50">Loading estimates…</p> : estimates.slice(0, 8).map((estimate) => (
                <div key={estimate.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-semibold">{estimate.estimate_number}</p>
                      <p className="text-white/55 text-xs mt-0.5">Lead #{estimate.lead_id} · {estimate.status}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${estimate.status === 'converted' ? 'text-emerald-300 border-emerald-300/50 bg-emerald-300/10' : 'text-amber-300 border-amber-300/50 bg-amber-300/10'}`}>
                      {estimate.status}
                    </span>
                  </div>
                  <p className="text-brand-amber text-xs mt-2">${Math.round(Number(estimate.amount_low || 0)).toLocaleString()} - ${Math.round(Number(estimate.amount_high || 0)).toLocaleString()}</p>
                  <button
                    type="button"
                    onClick={() => handleCreateJob(estimate)}
                    disabled={creatingJobId === estimate.id || estimate.status === 'converted'}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-brand-amber/40 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-brand-amber disabled:opacity-50"
                  >
                    {creatingJobId === estimate.id ? 'Creating…' : estimate.status === 'converted' ? 'Converted' : 'Create Job'}
                  </button>
                </div>
              ))}
              {!loading && estimates.length === 0 ? <p className="text-sm text-white/50">No estimates created yet.</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-3">Jobs Ready For Dispatch</p>
            <div className="space-y-2.5">
              {loading ? <p className="text-sm text-white/50">Loading jobs…</p> : jobs.slice(0, 8).map((job) => (
                <div key={job.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
                  <p className="text-white text-sm font-semibold">{job.job_number}</p>
                  <p className="text-white/55 text-xs mt-0.5">{job.name}</p>
                  <p className="text-white/35 text-[11px] mt-1">Estimate #{job.estimate_id} · {job.status}</p>
                  <button
                    type="button"
                    onClick={() => handleCreateWorkOrder(job)}
                    disabled={creatingWorkOrderId === job.id}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sky-300/40 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-sky-300 disabled:opacity-50"
                  >
                    {creatingWorkOrderId === job.id ? 'Creating…' : 'Create Work Order'}
                  </button>
                </div>
              ))}
              {!loading && jobs.length === 0 ? <p className="text-sm text-white/50">No jobs created yet.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuditFeedPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [events, setEvents] = useState([])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.listAuditEvents({ limit: 12 })
      setEvents(Array.isArray(data?.events) ? data.events : [])
    } catch (loadError) {
      setError(loadError?.message || 'Could not load audit feed.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Audit Feed</h3>
          <p className="text-white/55 text-sm mt-1">Live operational evidence from the protected backend audit stream.</p>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/75 hover:border-brand-amber/40 hover:text-brand-amber"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error ? <div className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

      <div className="space-y-2.5">
        {loading ? <p className="text-sm text-white/50">Loading audit feed…</p> : events.map((event) => (
          <div key={event.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white text-sm font-semibold">{event.event_type}</p>
                <p className="text-white/55 text-xs mt-0.5">{event.summary}</p>
              </div>
              <span className="text-[11px] text-white/35">{formatTimestamp(event.created_at)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/45">
              <span className="rounded-full border border-white/10 px-2 py-1">Actor: {event.actor_type}</span>
              <span className="rounded-full border border-white/10 px-2 py-1">Entity: {event.entity_type || '—'} {event.entity_id || ''}</span>
            </div>
          </div>
        ))}
        {!loading && events.length === 0 ? <p className="text-sm text-white/50">No audit events available.</p> : null}
      </div>
    </div>
  )
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function toTier(score) {
  const s = Number(score || 0)
  if (s >= 85) return 'hot'
  if (s >= 65) return 'warm'
  if (s >= 40) return 'cool'
  return 'cold'
}

function MrWordenAutopilotPanel() {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [autopiloting, setAutopiloting] = useState(false)
  const [syncNote, setSyncNote] = useState('')
  const [leads, setLeads] = useState([])

  const loadLeads = useCallback(async () => {
    const all = await api.entities.Lead.list('-created_date', 300)
    setLeads(Array.isArray(all) ? all : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const ranked = useMemo(() => {
    return [...leads]
      .filter((lead) => lead.status !== 'won' && lead.status !== 'lost' && lead.score != null)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 8)
  }, [leads])

  const autopilotQueue = useMemo(() => {
    return ranked.filter((lead) => ['hot', 'warm'].includes(String(lead.score_tier || toTier(lead.score))))
  }, [ranked])

  const applyAutopilot = useCallback(async () => {
    if (autopilotQueue.length === 0) {
      setSyncNote('No hot/warm leads to autopilot right now.')
      appendAutomationRun({
        id: `run_${Date.now()}`,
        type: 'autopilot-followup',
        status: 'skipped',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        detail: 'No hot/warm leads available for follow-up.',
      })
      return
    }

    const started = new Date().toISOString()
    setAutopiloting(true)
    try {
      let updated = 0
      const now = new Date().toISOString()

      for (const lead of autopilotQueue) {
        const existingNotes = String(lead.notes || '')
        const nextAction = `Autopilot follow-up queued (${now}): Call now and send estimate intake link.`
        await api.entities.Lead.update(lead.id, {
          status: 'contacted',
          sms_followup_sent: true,
          sms_followup_sent_at: now,
          notes: [existingNotes, nextAction].filter(Boolean).join('\n\n'),
        })
        updated += 1
      }

      setSyncNote(`Autopilot queued follow-up on ${updated} high-priority lead(s).`)
      appendAutomationRun({
        id: `run_${Date.now()}`,
        type: 'autopilot-followup',
        status: 'success',
        started_at: started,
        ended_at: new Date().toISOString(),
        detail: `Queued follow-up for ${updated} lead(s).`,
      })
      await loadLeads()
    } catch (error) {
      appendAutomationRun({
        id: `run_${Date.now()}`,
        type: 'autopilot-followup',
        status: 'failed',
        started_at: started,
        ended_at: new Date().toISOString(),
        detail: `Autopilot failed: ${error?.message || 'unknown error'}`,
      })
      throw error
    } finally {
      setAutopiloting(false)
    }
  }, [autopilotQueue, loadLeads])

  useEffect(() => {
    const retryHandler = () => {
      applyAutopilot().catch(() => {
        // Error is already logged in automation run log.
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('cc:retry-autopilot', retryHandler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cc:retry-autopilot', retryHandler)
      }
    }
  }, [applyAutopilot])

  const handleSyncCliFile = useCallback(async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSyncing(true)
    setSyncNote('')
    const started = new Date().toISOString()
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const records = Array.isArray(parsed?.autopilot_queue)
        ? parsed.autopilot_queue
        : Array.isArray(parsed?.top_priority)
          ? parsed.top_priority
          : []

      if (records.length === 0) {
        setSyncNote('No syncable records found in uploaded file.')
        return
      }

      const existing = await api.entities.Lead.list('-created_date', 500)
      const pool = Array.isArray(existing) ? existing : []

      let created = 0
      let updated = 0

      for (const item of records) {
        const signals = item?.signals || {}
        const intent = item?.intent || {}

        const phone = signals.phone || null
        const email = signals.email || null
        const address = signals.address || null

        if (!phone && !email && !address) continue

        const match = pool.find((lead) => {
          const samePhone = phone && normalizePhone(lead.phone) === normalizePhone(phone)
          const sameEmail = email && String(lead.email || '').toLowerCase() === String(email).toLowerCase()
          const sameAddress = address && String(lead.address || '').toLowerCase() === String(address).toLowerCase()
          return samePhone || sameEmail || sameAddress
        })

        const tier = intent.tier || toTier(intent.score)
        const score = Number(intent.score || 0)
        const statusTarget = item.status_target || (['hot', 'warm'].includes(tier) ? 'contacted' : 'new')
        const note = `CLI sync (${new Date().toISOString()}): ${item.next_action || item.recommended_followup || 'Follow-up required.'}`

        const payload = {
          name: signals.name || 'Website Visitor',
          phone: phone || 'Not provided',
          email,
          address,
          sqft: signals.sqft || undefined,
          surface_type: signals.surface_type || undefined,
          urgency: signals.urgency || undefined,
          score,
          score_tier: tier,
          status: statusTarget,
          conversion_source: 'voice_ai',
          score_reasoning: `Mr. Worden CLI ranked this lead as ${tier} (${score}/100).`,
          scored_at: new Date().toISOString(),
          notes: note,
        }

        if (match?.id) {
          await api.entities.Lead.update(match.id, {
            ...payload,
            notes: [String(match.notes || ''), note].filter(Boolean).join('\n\n'),
          })
          updated += 1
        } else {
          const createdLead = await api.entities.Lead.create(payload)
          if (createdLead?.id) pool.unshift(createdLead)
          created += 1
        }
      }

      setSyncNote(`CLI sync complete: ${created} created, ${updated} updated.`)
      appendAutomationRun({
        id: `run_${Date.now()}`,
        type: 'cli-sync',
        status: 'success',
        started_at: started,
        ended_at: new Date().toISOString(),
        detail: `CLI sync finished (${created} created, ${updated} updated).`,
      })
      await loadLeads()
    } catch (error) {
      setSyncNote('Could not parse JSON file. Use mrworden batch export JSON.')
      appendAutomationRun({
        id: `run_${Date.now()}`,
        type: 'cli-sync',
        status: 'failed',
        started_at: started,
        ended_at: new Date().toISOString(),
        detail: `CLI sync failed: ${error?.message || 'invalid JSON or read issue'}`,
      })
    } finally {
      event.target.value = ''
      setSyncing(false)
    }
  }, [loadLeads])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-brand-amber mb-1">
            <Bot className="w-3.5 h-3.5" />
            Mr. Worden Autopilot
          </div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">
            Priority Leaderboard + CLI Sync
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 cursor-pointer hover:border-brand-amber/50">
            <Upload className="w-3.5 h-3.5" />
            {syncing ? 'Syncing...' : 'Import CLI JSON'}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleSyncCliFile}
              disabled={syncing}
            />
          </label>

          <button
            type="button"
            onClick={applyAutopilot}
            disabled={autopiloting || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-amber text-brand-navy px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {autopiloting ? 'Applying...' : 'Run Autopilot Follow-up'}
          </button>
        </div>
      </div>

      {syncNote ? (
        <div className="mb-3 rounded-lg border border-brand-amber/40 bg-brand-amber/10 px-3 py-2 text-xs text-brand-amber">
          {syncNote}
        </div>
      ) : null}

      {loading ? (
        <div className="h-28 flex items-center justify-center text-white/50 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading priority queue...
        </div>
      ) : ranked.length === 0 ? (
        <p className="text-sm text-white/60">No scored leads yet. Import a CLI JSON export or let live chat generate scored leads.</p>
      ) : (
        <div className="space-y-2.5">
          {ranked.map((lead) => {
            const tier = String(lead.score_tier || toTier(lead.score))
            return (
              <div key={lead.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{lead.name || 'Website Visitor'}</p>
                  <p className="text-white/55 text-xs truncate">
                    {lead.phone || lead.email || lead.address || 'No contact detail'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/65 uppercase tracking-[0.1em]">{lead.status || 'new'}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone(Number(lead.score || 0))}`}>
                    {Number(lead.score || 0)} · {tier}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OperationsNerveCenterPanel() {
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState([])
  const [leadBreaches, setLeadBreaches] = useState([])
  const [runs, setRuns] = useState([])
  const [lastRefreshAt, setLastRefreshAt] = useState(null)

  const loadRuns = useCallback(() => {
    setRuns(readAutomationRuns())
  }, [])

  const loadProviderHealth = useCallback(async () => {
    const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

    const fallbackProviders = [
      { id: 'openai', label: 'OpenAI', up: false, note: 'Metrics endpoint unavailable', latency: null, errorRate: null },
      { id: 'gemini', label: 'Gemini', up: parseBoolLike(import.meta.env.VITE_PROVIDER_GEMINI_STATUS), note: 'Google workflows' },
      { id: 'perplexity', label: 'Perplexity', up: parseBoolLike(import.meta.env.VITE_PROVIDER_PERPLEXITY_STATUS), note: 'Research briefs' },
      { id: 'claude', label: 'Claude', up: parseBoolLike(import.meta.env.VITE_PROVIDER_CLAUDE_STATUS), note: 'Math + long context' },
      { id: 'codex', label: 'Codex', up: parseBoolLike(import.meta.env.VITE_PROVIDER_CODEX_STATUS), note: 'File/code tasks' },
      { id: 'grok', label: 'Grok', up: parseBoolLike(import.meta.env.VITE_PROVIDER_GROK_STATUS), note: 'X automation workflows' },
      { id: 'dropbox', label: 'Dropbox', up: parseBoolLike(import.meta.env.VITE_PROVIDER_DROPBOX_STATUS), note: 'Media ingest' },
      { id: 'gphotos', label: 'Google Photos', up: parseBoolLike(import.meta.env.VITE_PROVIDER_GPHOTOS_STATUS), note: 'Media ingest' },
      { id: 'x', label: 'X API', up: parseBoolLike(import.meta.env.VITE_PROVIDER_X_STATUS), note: 'X posting/listening' },
      { id: 'sentry', label: 'Sentry', up: parseBoolLike(import.meta.env.VITE_PROVIDER_SENTRY_STATUS), note: 'Monitoring + error tracking' },
    ]

    if (!apiBase) {
      setProviders(fallbackProviders)
      return
    }

    const started = new Date().toISOString()
    try {
      const response = await fetch(`${apiBase}/api/v1/metrics/providers`)
      if (response.ok) {
        const data = await response.json()
        const rows = Array.isArray(data.providers)
          ? data.providers.map((provider) => ({
              id: provider.id,
              label: provider.label,
              up: Boolean(provider.up),
              note: provider.detail || (provider.configured ? 'Configured' : 'Not configured'),
              latency: provider.latency_ms ?? null,
              errorRate: null,
            }))
          : fallbackProviders
        setProviders(rows)
        appendAutomationRun({
          id: `run_${Date.now()}`,
          type: 'provider-health-check',
          status: 'success',
          started_at: started,
          ended_at: new Date().toISOString(),
          detail: `Provider health check succeeded (${rows.filter((p) => p.up).length} up).`,
        })
      } else {
        setProviders(fallbackProviders)
        appendAutomationRun({
          id: `run_${Date.now()}`,
          type: 'provider-health-check',
          status: 'failed',
          started_at: started,
          ended_at: new Date().toISOString(),
          detail: `Provider health check failed with status ${response.status}.`,
        })
      }
    } catch {
      setProviders(fallbackProviders)
      appendAutomationRun({
        id: `run_${Date.now()}`,
        type: 'provider-health-check',
        status: 'failed',
        started_at: started,
        ended_at: new Date().toISOString(),
        detail: 'Provider health check failed (network/API unavailable).',
      })
    }
  }, [])

  const loadLeadBreaches = useCallback(async () => {
    const all = await api.entities.Lead.list('-created_date', 400)
    const now = Date.now()
    const rows = (Array.isArray(all) ? all : [])
      .map((lead) => {
        const tier = String(lead.score_tier || toTier(lead.score))
        const createdAt = new Date(lead.created_date || lead.created_at || 0)
        if (createdAt.toString() === 'Invalid Date') return null
        const ageMin = Math.floor((now - createdAt.getTime()) / 60000)
        const breachThreshold = tier === 'hot' ? 15 : tier === 'warm' ? 60 : null
        if (!breachThreshold) return null
        const isOpen = !['won', 'lost', 'contacted'].includes(String(lead.status || '').toLowerCase())
        if (!isOpen) return null
        if (ageMin <= breachThreshold) return null

        return {
          id: lead.id,
          name: lead.name || 'Website Visitor',
          tier,
          status: lead.status || 'new',
          ageMin,
          phone: lead.phone || null,
          breachBy: ageMin - breachThreshold,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.breachBy - a.breachBy)

    setLeadBreaches(rows)
  }, [])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadProviderHealth(), loadLeadBreaches()])
    loadRuns()
    setLastRefreshAt(new Date())
    setLoading(false)
  }, [loadLeadBreaches, loadProviderHealth, loadRuns])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  useEffect(() => {
    const onRunUpdated = () => loadRuns()
    if (typeof window !== 'undefined') {
      window.addEventListener('cc:automation-run-updated', onRunUpdated)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cc:automation-run-updated', onRunUpdated)
      }
    }
  }, [loadRuns])

  const retryLastFailed = useCallback(() => {
    const failed = runs.find((run) => run.status === 'failed')
    if (!failed) return

    if (failed.type === 'autopilot-followup') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cc:retry-autopilot'))
      }
      return
    }

    if (failed.type === 'provider-health-check') {
      refreshAll()
      return
    }

    if (failed.type === 'cli-sync') {
      if (typeof window !== 'undefined') {
        window.alert('Retry CLI sync by importing the JSON file again in Mr. Worden Autopilot panel.')
      }
    }
  }, [runs, refreshAll])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-brand-amber mb-1">Operations Nerve Center</p>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Provider Health + Run Telemetry + SLA Alerts</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 hover:border-brand-amber/40 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={retryLastFailed}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-amber text-brand-navy px-3 py-2 text-xs font-black uppercase tracking-[0.12em]"
          >
            Retry Last Failed
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Provider Status</p>
          <div className="space-y-2">
            {providers.map((row) => (
              <div key={row.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-white text-xs font-semibold">{row.label}</p>
                  <p className="text-white/55 text-[11px]">{row.note}</p>
                  {row.latency != null || row.errorRate != null ? (
                    <p className="text-white/45 text-[10px] mt-0.5">
                      {row.latency != null ? `Latency ${row.latency}ms` : ''}
                      {row.latency != null && row.errorRate != null ? ' · ' : ''}
                      {row.errorRate != null ? `Error ${row.errorRate}%` : ''}
                    </p>
                  ) : null}
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${row.up ? 'border-emerald-300/50 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/50 bg-amber-300/10 text-amber-200'}`}>
                  {row.up ? 'Up' : 'Check'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Automation Run Log</p>
          {runs.length === 0 ? (
            <p className="text-sm text-white/55">No automation runs recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {runs.slice(0, 12).map((run) => (
                <div key={run.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-white text-xs font-semibold uppercase tracking-[0.08em]">{run.type}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${run.status === 'success' ? 'text-emerald-300' : run.status === 'failed' ? 'text-red-300' : 'text-amber-300'}`}>
                      {run.status}
                    </span>
                  </div>
                  <p className="text-white/55 text-[11px] mt-1">{run.detail}</p>
                  <p className="text-white/40 text-[10px] mt-1">{run.ended_at ? new Date(run.ended_at).toLocaleString() : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Hot/Warm SLA Breaches</p>
          {leadBreaches.length === 0 ? (
            <p className="text-sm text-emerald-300">No open SLA breaches right now.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {leadBreaches.slice(0, 10).map((lead) => (
                <div key={lead.id} className="rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-red-100 text-xs font-semibold truncate">{lead.name}</p>
                    <span className="text-[10px] text-red-200 uppercase tracking-[0.12em] font-bold">{lead.tier}</span>
                  </div>
                  <p className="text-red-200/85 text-[11px] mt-1">{lead.phone || 'No phone on file'}</p>
                  <p className="text-red-200/75 text-[10px] mt-1">{lead.ageMin} min old · {lead.breachBy} min beyond SLA</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-white/45">
        Last refresh: {lastRefreshAt ? lastRefreshAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'Not yet'}
      </p>
    </div>
  )
}

function ChannelPerformancePanel() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const all = await api.entities.Lead.list('-created_date', 300)
        if (active) setLeads(Array.isArray(all) ? all : [])
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const inWindow = useMemo(() => {
    const since = new Date()
    since.setDate(since.getDate() - 30)

    return leads.filter((lead) => {
      const created = new Date(lead.created_date || lead.created_at || 0)
      return created.toString() !== 'Invalid Date' && created >= since
    })
  }, [leads])

  const parsedRows = useMemo(() => {
    return inWindow.map((lead) => {
      let attribution = {}
      try {
        const parsed = lead.attribution_snapshot ? JSON.parse(lead.attribution_snapshot) : {}
        attribution = parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        attribution = {}
      }

      return {
        lead,
        source: String(attribution.utm_source || '').trim().toLowerCase() || String(lead.conversion_source || 'direct').toLowerCase(),
        medium: String(attribution.utm_medium || '').trim().toLowerCase() || 'none',
        campaign: String(attribution.utm_campaign || lead.geofence_campaign || '').trim() || 'none',
        term: String(attribution.utm_term || '').trim() || 'none',
        domain: String(lead.backlink_domain || '').trim().toLowerCase(),
      }
    })
  }, [inWindow])

  const channelRows = useMemo(() => {
    const buckets = {
      google_ads: { leads: 0, won: 0, pipeline: 0 },
      google_organic: { leads: 0, won: 0, pipeline: 0 },
      geofencing: { leads: 0, won: 0, pipeline: 0 },
      backlink_partner: { leads: 0, won: 0, pipeline: 0 },
      referral: { leads: 0, won: 0, pipeline: 0 },
      direct: { leads: 0, won: 0, pipeline: 0 },
    }

    inWindow.forEach((lead) => {
      const source = String(lead.conversion_source || 'direct')
      if (!buckets[source]) return
      buckets[source].leads += 1
      if (lead.status === 'won') buckets[source].won += 1
      if (lead.status !== 'won' && lead.status !== 'lost') {
        buckets[source].pipeline += Number(lead.estimated_value) || 0
      }
    })

    return Object.entries(buckets).map(([source, stats]) => ({
      source,
      ...stats,
      closeRate: stats.leads > 0 ? Math.round((stats.won / stats.leads) * 100) : 0,
    }))
  }, [inWindow])

  const countTop = useCallback((rows, extractor, limit = 6) => {
    const map = {}
    rows.forEach((row) => {
      const key = extractor(row)
      if (!key || key === 'none') return
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
  }, [])

  const topTrafficSources = useMemo(() => countTop(parsedRows, (row) => row.source), [countTop, parsedRows])
  const topTrafficMediums = useMemo(() => countTop(parsedRows, (row) => row.medium), [countTop, parsedRows])
  const topCampaigns = useMemo(() => countTop(parsedRows, (row) => row.campaign), [countTop, parsedRows])
  const topSearchTerms = useMemo(() => countTop(parsedRows, (row) => row.term), [countTop, parsedRows])

  const topBacklinkDomains = useMemo(() => {
    const domains = {}
    leads.forEach((lead) => {
      if (lead.conversion_source !== 'backlink_partner' || !lead.backlink_domain) return
      const d = String(lead.backlink_domain).toLowerCase()
      domains[d] = (domains[d] || 0) + 1
    })

    return Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [leads])

  const topGeofenceCampaigns = useMemo(() => {
    const campaigns = {}
    leads.forEach((lead) => {
      if (lead.conversion_source !== 'geofencing' || !lead.geofence_campaign) return
      const c = String(lead.geofence_campaign)
      campaigns[c] = (campaigns[c] || 0) + 1
    })

    return Object.entries(campaigns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [leads])

  const domainPerformanceRows = useMemo(() => {
    const map = {}
    inWindow.forEach((lead) => {
      const fallbackSource = String(lead.conversion_source || 'unknown')
      const row = parsedRows.find((r) => r.lead.id === lead.id)
      const sourceHint = row?.source || fallbackSource
      const derivedDomain = lead.backlink_domain
        ? String(lead.backlink_domain).toLowerCase()
        : sourceHint.includes('.')
          ? sourceHint
          : null

      if (!derivedDomain) return

      if (!map[derivedDomain]) {
        map[derivedDomain] = { domain: derivedDomain, leads: 0, won: 0, pipeline: 0 }
      }

      map[derivedDomain].leads += 1
      if (lead.status === 'won') map[derivedDomain].won += 1
      if (lead.status !== 'won' && lead.status !== 'lost') {
        map[derivedDomain].pipeline += Number(lead.estimated_value) || 0
      }
    })

    return Object.values(map)
      .map((item) => ({
        ...item,
        closeRate: item.leads > 0 ? Math.round((item.won / item.leads) * 100) : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 8)
  }, [inWindow, parsedRows])

  const label = (source) => {
    if (source === 'google_ads') return 'Google Ads'
    if (source === 'google_organic') return 'Google Organic'
    if (source === 'geofencing') return 'Geofencing'
    if (source === 'backlink_partner') return 'Backlink Partner'
    if (source === 'referral') return 'Referral'
    if (source === 'direct') return 'Direct'
    return source
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">
          Traffic + Search + Domain Intelligence (30d)
        </h3>
        <span className="text-xs text-white/45">Live from Lead records</span>
      </div>

      {loading ? (
        <div className="h-28 flex items-center justify-center text-white/50 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading source intelligence...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
            {channelRows.map((row) => (
              <div key={row.source} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">{label(row.source)}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-white text-lg font-black leading-none">{row.leads}</p>
                    <p className="text-[10px] text-white/45 uppercase mt-1">Leads</p>
                  </div>
                  <div>
                    <p className="text-emerald-300 text-lg font-black leading-none">{row.closeRate}%</p>
                    <p className="text-[10px] text-white/45 uppercase mt-1">Close</p>
                  </div>
                  <div>
                    <p className="text-brand-amber text-lg font-black leading-none">${Math.round(row.pipeline / 1000)}k</p>
                    <p className="text-[10px] text-white/45 uppercase mt-1">Pipeline</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Top Traffic Sources</p>
              {topTrafficSources.length === 0 ? (
                <p className="text-sm text-white/55">No source attribution data yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {topTrafficSources.map(([source, count]) => (
                    <li key={source} className="text-sm text-white/80 flex items-center justify-between gap-3">
                      <span className="truncate">{source}</span>
                      <span className="text-brand-amber font-semibold">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Top Traffic Mediums</p>
              {topTrafficMediums.length === 0 ? (
                <p className="text-sm text-white/55">No medium attribution data yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {topTrafficMediums.map(([medium, count]) => (
                    <li key={medium} className="text-sm text-white/80 flex items-center justify-between gap-3">
                      <span className="truncate">{medium}</span>
                      <span className="text-brand-amber font-semibold">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Top Campaigns</p>
              {topCampaigns.length === 0 ? (
                <p className="text-sm text-white/55">No campaign attribution data yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {topCampaigns.map(([campaign, count]) => (
                    <li key={campaign} className="text-sm text-white/80 flex items-center justify-between gap-3">
                      <span className="truncate">{campaign}</span>
                      <span className="text-brand-amber font-semibold">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Top Search Terms</p>
              {topSearchTerms.length === 0 ? (
                <p className="text-sm text-white/55">No search-term attribution data yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {topSearchTerms.map(([term, count]) => (
                    <li key={term} className="text-sm text-white/80 flex items-center justify-between gap-3">
                      <span className="truncate">{term}</span>
                      <span className="text-brand-amber font-semibold">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3 mt-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Domain Performance Matrix</p>
            {domainPerformanceRows.length === 0 ? (
              <p className="text-sm text-white/55">No domain-level attribution records yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {domainPerformanceRows.map((item) => (
                  <div key={item.domain} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-white text-sm font-semibold truncate">{item.domain}</p>
                      <span className="text-[10px] text-emerald-200 uppercase tracking-[0.12em] font-bold">
                        Close {item.closeRate}%
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-1">Leads: {item.leads} · Won: {item.won} · Pipeline: ${Math.round(item.pipeline / 1000)}k</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(topBacklinkDomains.length > 0 || topGeofenceCampaigns.length > 0) ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Top Backlink Domains</p>
                {topBacklinkDomains.length === 0 ? (
                  <p className="text-sm text-white/55">No backlink domain data yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {topBacklinkDomains.map(([domain, count]) => (
                      <li key={domain} className="text-sm text-white/80 flex items-center justify-between gap-3">
                        <span className="truncate">{domain}</span>
                        <span className="text-brand-amber font-semibold">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Top Geofence Campaigns</p>
                {topGeofenceCampaigns.length === 0 ? (
                  <p className="text-sm text-white/55">No geofence campaign tags yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {topGeofenceCampaigns.map(([campaign, count]) => (
                      <li key={campaign} className="text-sm text-white/80 flex items-center justify-between gap-3">
                        <span className="truncate">{campaign}</span>
                        <span className="text-brand-amber font-semibold">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function TechOpportunityQueuePanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getTechIntelligenceQueue({ limit: 12, min_priority: 'medium' })
      setPayload(res)
    } catch (err) {
      setError(err?.message || 'Unable to load technology intelligence queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await api.getTechIntelligenceQueue({ limit: 12, min_priority: 'medium' })
        if (active) setPayload(res)
      } catch (err) {
        if (active) setError(err?.message || 'Unable to load technology intelligence queue.')
      } finally {
        if (active) setLoading(false)
      }
    })()

    const id = setInterval(() => {
      load()
    }, 60_000)

    return () => {
      active = false
      clearInterval(id)
    }
  }, [load])

  const queue = useMemo(() => {
    const list = payload?.queue
    return Array.isArray(list) ? list : []
  }, [payload])

  const domainSummary = useMemo(() => {
    const list = payload?.domain_summary
    return Array.isArray(list) ? list.slice(0, 4) : []
  }, [payload])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">
          Technology Opportunity Queue
        </h3>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:border-brand-amber/40"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="h-20 flex items-center justify-center text-white/55 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading technology queue...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-300/40 bg-red-300/10 px-3 py-2.5 text-sm text-red-100">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Queue Size</p>
              <p className="text-white text-2xl font-black mt-2">{payload?.queue_count ?? queue.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Signals Analyzed</p>
              <p className="text-white text-2xl font-black mt-2">{payload?.signals_analyzed ?? 'n/a'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Data Staleness (hrs)</p>
              <p className="text-white text-2xl font-black mt-2">{payload?.staleness_hours ?? 'n/a'}</p>
            </div>
          </div>

          {domainSummary.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 mb-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Top Domain Pressure</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                {domainSummary.map((item) => (
                  <div key={item.domainId || item.domainLabel} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <p className="text-white text-xs font-semibold truncate">{item.domainLabel || item.domainId}</p>
                    <p className="text-brand-amber text-[11px] mt-1">Signals {item.signalCount || 0} · Score {item.totalScore || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {queue.length === 0 ? (
            <p className="text-sm text-white/55">No medium/high/critical opportunities currently queued.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {queue.map((item, index) => (
                <div key={`${item.url || item.title}-${index}`} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white text-sm font-semibold line-clamp-1">{item.title || 'Untitled signal'}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                      item.priority === 'critical'
                        ? 'text-red-200'
                        : item.priority === 'high'
                          ? 'text-amber-200'
                          : 'text-emerald-200'
                    }`}>
                      {item.priority || 'unknown'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/55 mt-1">
                    {item.sourceName || 'source'} · Score {item.overallScore ?? 'n/a'} · {item.publishedAt ? String(item.publishedAt).slice(0, 10) : 'date n/a'}
                  </p>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-brand-amber hover:text-brand-amber/80 mt-1 inline-block break-all"
                    >
                      {item.url}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function HumanChecksControlPanel() {
  const requiredChecks = useMemo(
    () => [
      {
        id: 'claims_qa',
        title: 'Claims + legal copy reviewed',
        owner: 'Brand / Legal',
      },
      {
        id: 'pricing_qa',
        title: 'Pricing + discount changes verified',
        owner: 'Owner / GM',
      },
      {
        id: 'ad_spend_qa',
        title: 'Ad budget shift approved (>20% delta)',
        owner: 'Marketing Lead',
      },
      {
        id: 'publish_qa',
        title: 'Public-facing publish authorization',
        owner: 'Growth + Brand',
      },
      {
        id: 'crm_qa',
        title: 'Hot/Warm lead SLA on-call owner confirmed',
        owner: 'Sales Ops',
      },
    ],
    [],
  )

  const [checks, setChecks] = useState(() => {
    try {
      if (typeof window === 'undefined') return {}
      const raw = localStorage.getItem(HUMAN_CHECKS_STATE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed?.checks && typeof parsed.checks === 'object' ? parsed.checks : {}
    } catch {
      return {}
    }
  })
  const [approver, setApprover] = useState(() => {
    try {
      if (typeof window === 'undefined') return ''
      const raw = localStorage.getItem(HUMAN_CHECKS_STATE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed?.approver || ''
    } catch {
      return ''
    }
  })
  const [lastApprovedAt, setLastApprovedAt] = useState(() => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem(HUMAN_CHECKS_STATE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed?.lastApprovedAt || null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(
        HUMAN_CHECKS_STATE_KEY,
        JSON.stringify({
          checks,
          approver,
          lastApprovedAt,
        }),
      )
    } catch {
      // Keep panel functional even if persistence fails.
    }
  }, [checks, approver, lastApprovedAt])

  const completedCount = requiredChecks.filter((item) => Boolean(checks[item.id])).length
  const blockerCount = requiredChecks.length - completedCount
  const readyForPublicActions = blockerCount === 0 && approver.trim().length > 0

  const exportHumanChecks = useCallback(() => {
    if (typeof window === 'undefined') return
    const payload = {
      generated_at: new Date().toISOString(),
      approver: approver.trim() || null,
      last_approved_at: lastApprovedAt,
      ready_for_public_actions: readyForPublicActions,
      checks: requiredChecks.map((item) => ({
        id: item.id,
        title: item.title,
        owner: item.owner,
        status: checks[item.id] ? 'approved' : 'blocked',
      })),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'command-center-human-checks.json'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [approver, checks, lastApprovedAt, readyForPublicActions, requiredChecks])

  const markApprovedNow = useCallback(() => {
    setLastApprovedAt(new Date().toISOString())
  }, [])

  const resetChecks = useCallback(() => {
    setChecks({})
    setApprover('')
    setLastApprovedAt(null)
  }, [])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">
            Human Checks Control Tower
          </h3>
          <p className="text-xs text-white/50 mt-1">Explicit human approvals before irreversible public actions.</p>
        </div>

        <span
          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
            readyForPublicActions
              ? 'border-emerald-300/60 bg-emerald-300/10 text-emerald-200'
              : 'border-red-300/60 bg-red-300/10 text-red-200'
          }`}
        >
          {readyForPublicActions ? 'Human Check: Cleared' : `Human Check: ${blockerCount} Blocker${blockerCount === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-3">
        <div className="lg:col-span-3 rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
          {requiredChecks.map((item) => (
            <label key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 cursor-pointer">
              <div>
                <p className="text-sm text-white font-semibold">{item.title}</p>
                <p className="text-[11px] text-brand-amber mt-0.5">Owner: {item.owner}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(checks[item.id])}
                onChange={(e) => {
                  setChecks((prev) => ({ ...prev, [item.id]: e.target.checked }))
                }}
                className="h-4 w-4 accent-brand-amber"
              />
            </label>
          ))}
        </div>

        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Approver initials</p>
            <input
              type="text"
              value={approver}
              maxLength={18}
              onChange={(e) => setApprover(e.target.value.toUpperCase())}
              placeholder="EX: JW"
              className="mt-1.5 w-full rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand-amber/50"
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
            <p>Checks complete: {completedCount}/{requiredChecks.length}</p>
            <p className="mt-1">Last approval timestamp: {lastApprovedAt ? new Date(lastApprovedAt).toLocaleString() : 'Not recorded'}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={markApprovedNow}
              className="rounded-lg bg-brand-amber text-brand-navy px-3 py-2 text-xs font-black uppercase tracking-[0.12em]"
            >
              Stamp Human Approval
            </button>
            <button
              type="button"
              onClick={exportHumanChecks}
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 hover:border-brand-amber/40"
            >
              Export Approval Log
            </button>
            <button
              type="button"
              onClick={resetChecks}
              className="rounded-lg border border-red-300/35 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-300/10"
            >
              Reset Human Checks
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleAdsBudgetControlPanel() {
  const [budgetIndex, setBudgetIndex] = useState(() => {
    try {
      if (typeof window === 'undefined') return 100
      const raw = localStorage.getItem(GOOGLE_ADS_BUDGET_STATE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return Number(parsed?.budgetIndex || 100)
    } catch {
      return 100
    }
  })
  const [status, setStatus] = useState(() => {
    try {
      if (typeof window === 'undefined') return 'active'
      const raw = localStorage.getItem(GOOGLE_ADS_BUDGET_STATE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed?.status || 'active'
    } catch {
      return 'active'
    }
  })
  const [lastAction, setLastAction] = useState(() => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem(GOOGLE_ADS_BUDGET_STATE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed?.lastAction || null
    } catch {
      return null
    }
  })
  const [note, setNote] = useState('')

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(
        GOOGLE_ADS_BUDGET_STATE_KEY,
        JSON.stringify({
          budgetIndex,
          status,
          lastAction,
        }),
      )
    } catch {
      // Keep controls usable when localStorage is unavailable.
    }
  }, [budgetIndex, status, lastAction])

  const humanChecksState = useMemo(() => {
    try {
      if (typeof window === 'undefined') return { checks: {}, approver: '' }
      const raw = localStorage.getItem(HUMAN_CHECKS_STATE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return {
        checks: parsed?.checks && typeof parsed.checks === 'object' ? parsed.checks : {},
        approver: String(parsed?.approver || '').trim(),
      }
    } catch {
      return { checks: {}, approver: '' }
    }
  }, [lastAction])

  const adSpendApproved = Boolean(humanChecksState.checks?.ad_spend_qa) && humanChecksState.approver.length > 0

  const runBudgetAction = useCallback(
    (action) => {
      const now = new Date().toISOString()
      if (!adSpendApproved) {
        const msg = 'Blocked: complete Human Checks > Ad budget shift approval and set approver initials first.'
        setNote(msg)
        appendAutomationRun({
          id: `run_${Date.now()}`,
          type: 'google-ads-budget-control',
          status: 'blocked',
          started_at: now,
          ended_at: now,
          detail: msg,
        })
        return
      }

      if (action.kind === 'off') {
        setStatus('paused')
        setLastAction({ at: now, label: 'Set Google Ads to OFF', delta: 0 })
        setNote('Google Ads status set to OFF (paused).')
        appendAutomationRun({
          id: `run_${Date.now()}`,
          type: 'google-ads-budget-control',
          status: 'success',
          started_at: now,
          ended_at: now,
          detail: 'Google Ads paused (OFF).',
        })
        return
      }

      if (action.kind === 'resume') {
        setStatus('active')
        setLastAction({ at: now, label: 'Resumed Google Ads', delta: 0 })
        setNote('Google Ads resumed.')
        appendAutomationRun({
          id: `run_${Date.now()}`,
          type: 'google-ads-budget-control',
          status: 'success',
          started_at: now,
          ended_at: now,
          detail: 'Google Ads resumed (active).',
        })
        return
      }

      const next = Math.max(20, Math.min(300, budgetIndex + action.delta))
      setBudgetIndex(next)
      setStatus('active')
      setLastAction({ at: now, label: action.label, delta: action.delta })
      setNote(`Applied: ${action.label}. New budget index: ${next}% of baseline.`)
      appendAutomationRun({
        id: `run_${Date.now()}`,
        type: 'google-ads-budget-control',
        status: 'success',
        started_at: now,
        ended_at: now,
        detail: `${action.label}; budget index now ${next}% of baseline.`,
      })
    },
    [adSpendApproved, budgetIndex],
  )

  const controls = [
    { label: 'Budget +10%', delta: 10, kind: 'adjust' },
    { label: 'Budget +20%', delta: 20, kind: 'adjust' },
    { label: 'Budget -10%', delta: -10, kind: 'adjust' },
    { label: 'Budget -20%', delta: -20, kind: 'adjust' },
    { label: 'OFF', delta: 0, kind: 'off' },
    { label: 'Resume', delta: 0, kind: 'resume' },
  ]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Google Ads Budget Control</h3>
          <p className="text-xs text-white/50 mt-1">Operator controls: up, down, off, resume with human approval gate.</p>
        </div>

        <span
          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
            status === 'active'
              ? 'border-emerald-300/60 bg-emerald-300/10 text-emerald-200'
              : 'border-red-300/60 bg-red-300/10 text-red-200'
          }`}
        >
          {status === 'active' ? 'Active' : 'OFF / Paused'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Current budget index</p>
          <p className="text-white font-black text-3xl leading-none mt-2">{budgetIndex}%</p>
          <p className="text-[11px] text-white/55 mt-2">Baseline = 100%. Clamp range: 20% to 300%.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 lg:col-span-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/45 mb-2">Quick Actions</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {controls.map((control) => (
              <button
                key={control.label}
                type="button"
                onClick={() => runBudgetAction(control)}
                className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                  control.kind === 'off'
                    ? 'bg-red-300/20 border border-red-300/40 text-red-100'
                    : control.kind === 'resume'
                      ? 'bg-emerald-300/20 border border-emerald-300/40 text-emerald-100'
                      : 'bg-brand-amber text-brand-navy'
                }`}
              >
                {control.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
        <p>Human approval gate: {adSpendApproved ? 'Cleared' : 'Blocked'}</p>
        <p className="mt-1">Approver: {humanChecksState.approver || 'Not set'} · Ad budget check: {humanChecksState.checks?.ad_spend_qa ? 'approved' : 'not approved'}</p>
        <p className="mt-1">Last action: {lastAction?.label ? `${lastAction.label} (${new Date(lastAction.at).toLocaleString()})` : 'None'}</p>
      </div>

      {note ? (
        <div className="mt-3 rounded-lg border border-brand-amber/35 bg-brand-amber/10 px-3 py-2 text-xs text-brand-amber">
          {note}
        </div>
      ) : null}
    </div>
  )
}

function HumanApprovalPolicyPanel() {
  const policyRules = [
    {
      rule: 'Ad Budget Change > 20% day-over-day',
      level: 'Human Required',
      reason: 'Protect spend volatility and prevent runaway CAC',
      owner: 'Marketing Lead',
    },
    {
      rule: 'Any new public landing page publish',
      level: 'Human Required',
      reason: 'Claim/legal/brand QA before public indexation',
      owner: 'Growth + Brand',
    },
    {
      rule: 'Price or discount policy modification',
      level: 'Human Required',
      reason: 'Margin protection and offer consistency',
      owner: 'Owner/GM',
    },
    {
      rule: 'Auto-reply with comparative competitor claims',
      level: 'Human Required',
      reason: 'Reduce legal and reputational risk',
      owner: 'Reputation Lead',
    },
    {
      rule: 'Automated low-risk bid optimizations within thresholds',
      level: 'Auto Allowed',
      reason: 'Fast optimization under bounded controls',
      owner: 'AI Optimizer',
    },
  ]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">
          Human Approval Policy
        </h3>
        <span className="text-xs text-white/45">Hard stops for irreversible actions</span>
      </div>

      <div className="space-y-2.5">
        {policyRules.map((item) => {
          const requiresHuman = item.level === 'Human Required'
          return (
            <div key={item.rule} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white font-semibold">{item.rule}</p>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    requiresHuman
                      ? 'border-amber-300/50 bg-amber-300/10 text-amber-200'
                      : 'border-emerald-300/50 bg-emerald-300/10 text-emerald-200'
                  }`}
                >
                  {item.level}
                </span>
              </div>
              <p className="text-xs text-white/60 mt-1.5">{item.reason}</p>
              <p className="text-[11px] text-brand-amber mt-1.5">Owner: {item.owner}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2.5">
        <p className="text-xs text-amber-100 leading-relaxed">
          Governance standard: monitor and draft automatically, but require a human approval event for budget jumps, public publishing, pricing changes, and legal-risk messaging.
        </p>
      </div>
    </div>
  )
}

function TempInAppOpsFallbackPanel() {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [providerSummary, setProviderSummary] = useState(null)

  const downloadJson = useCallback((filename, payload) => {
    if (typeof window === 'undefined') return
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [])

  const downloadBatchTemplate = useCallback(() => {
    const template = {
      generated_at: new Date().toISOString(),
      source: 'command-center-temp-fallback',
      results: [
        {
          lead_id: 'lead_demo_001',
          signals: {
            name: 'Sample Lead',
            phone: '+1-804-555-0101',
            email: 'sample@example.com',
            address: '1601 Ware Bottom Spring Rd, Chester, VA',
            sqft: '1200',
            urgency: 'this week',
            surface_type: 'parking_lot',
          },
          intent: {
            score: 82,
            tier: 'warm',
            reason: 'Requested estimate and shared site details.',
          },
          status_target: 'contacted',
          next_action: 'Call within 15 minutes to confirm site visit.',
        },
      ],
    }

    downloadJson('mrworden-batch-template.json', template)
    setNote('Downloaded CLI-compatible batch template JSON.')
  }, [downloadJson])

  const exportLeadsAsCliJson = useCallback(async () => {
    setBusy(true)
    setNote('')
    try {
      const leads = await api.entities.Lead.list('-created_date', 300)
      const rows = (Array.isArray(leads) ? leads : []).map((lead) => {
        const score = Number(lead.score || 0)
        const tier = String(lead.score_tier || toTier(score))
        return {
          lead_id: lead.id,
          signals: {
            name: lead.name || 'Website Visitor',
            phone: lead.phone || null,
            email: lead.email || null,
            address: lead.address || null,
            sqft: lead.sqft || null,
            urgency: lead.urgency || null,
            surface_type: lead.surface_type || null,
          },
          intent: {
            score,
            tier,
            reason: lead.score_reasoning || `Exported from Command Center with ${tier} tier.`,
          },
          status_target: lead.status || 'new',
          next_action: 'Follow-up by phone/SMS and schedule site visit.',
        }
      })

      downloadJson('mrworden-export-from-command-center.json', {
        generated_at: new Date().toISOString(),
        source: 'command-center-temp-fallback',
        results: rows,
      })

      setNote(`Exported ${rows.length} lead(s) as CLI-compatible JSON.`)
    } catch {
      setNote('Could not export leads right now. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }, [downloadJson])

  const runProviderSetupDoctor = useCallback(async () => {
    setBusy(true)
    setNote('')
    setProviderSummary(null)
    try {
      const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
      if (!apiBase) {
        setNote('VITE_API_BASE_URL is not set. Cannot run provider doctor.')
        return
      }

      const response = await fetch(`${apiBase}/api/v1/metrics/providers`)
      if (!response.ok) {
        setNote(`Provider doctor failed with status ${response.status}.`)
        return
      }

      const data = await response.json()
      const providers = Array.isArray(data.providers) ? data.providers : []
      const missing = providers.filter((p) => !p.configured).map((p) => p.label)
      const down = providers.filter((p) => p.configured && !p.up).map((p) => p.label)
      setProviderSummary({ missing, down, total: providers.length })
      setNote('Provider setup doctor completed.')
    } catch {
      setNote('Provider doctor could not reach backend metrics endpoint.')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">
          Temporary In-App CLI Replacements
        </h3>
        <span className="text-xs text-white/45">Use until permanent wiring is live</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={downloadBatchTemplate}
          className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 hover:border-brand-amber/40"
        >
          Download Batch Template
        </button>

        <button
          type="button"
          onClick={exportLeadsAsCliJson}
          disabled={busy}
          className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 hover:border-brand-amber/40 disabled:opacity-50"
        >
          Export Leads as CLI JSON
        </button>

        <button
          type="button"
          onClick={runProviderSetupDoctor}
          disabled={busy}
          className="rounded-lg bg-brand-amber text-brand-navy px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50"
        >
          Run Provider Setup Doctor
        </button>
      </div>

      {note ? (
        <div className="mt-3 rounded-lg border border-brand-amber/35 bg-brand-amber/10 px-3 py-2 text-xs text-brand-amber">
          {note}
        </div>
      ) : null}

      {providerSummary ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-xs text-white/70">Providers checked: {providerSummary.total}</p>
          <p className="text-xs text-amber-200 mt-1">Missing config: {providerSummary.missing.length ? providerSummary.missing.join(', ') : 'None'}</p>
          <p className="text-xs text-red-200 mt-1">Configured but down: {providerSummary.down.length ? providerSummary.down.join(', ') : 'None'}</p>
        </div>
      ) : null}
    </div>
  )
}

function LaunchReadinessAuditPanel({ strategyVisible, onAudit }) {
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState(null)

  const runAudit = useCallback(async () => {
    setRunning(true)

    const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
    const runs = readAutomationRuns()

    let providerRows = []
    let providerSource = 'fallback'
    if (apiBase) {
      try {
        const response = await fetch(`${apiBase}/api/v1/metrics/providers`)
        if (response.ok) {
          const data = await response.json()
          providerRows = Array.isArray(data.providers) ? data.providers : []
          providerSource = 'api'
        }
      } catch {
        providerRows = []
      }
    }

    if (providerRows.length === 0) {
      providerRows = [
        { label: 'Gemini', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_GEMINI_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_GEMINI_STATUS) },
        { label: 'Perplexity', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_PERPLEXITY_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_PERPLEXITY_STATUS) },
        { label: 'Claude', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_CLAUDE_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_CLAUDE_STATUS) },
        { label: 'Codex', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_CODEX_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_CODEX_STATUS) },
        { label: 'Grok', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_GROK_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_GROK_STATUS) },
        { label: 'Dropbox', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_DROPBOX_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_DROPBOX_STATUS) },
        { label: 'Google Photos', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_GPHOTOS_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_GPHOTOS_STATUS) },
        { label: 'X API', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_X_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_X_STATUS) },
        { label: 'Sentry', configured: parseBoolLike(import.meta.env.VITE_PROVIDER_SENTRY_STATUS), up: parseBoolLike(import.meta.env.VITE_PROVIDER_SENTRY_STATUS) },
      ]
    }

    const configuredProviders = providerRows.filter((p) => p.configured)
    const providerUp = providerRows.filter((p) => p.up)
    const providerBase = Math.max(configuredProviders.length, 1)
    const providerScore = Math.round((providerUp.length / providerBase) * 30)

    const securityChecks = [
      { label: 'CC password set', ok: Boolean(import.meta.env.VITE_CC_PASSWORD) },
      { label: 'Auth mode declared', ok: Boolean(import.meta.env.VITE_AUTH_MODE) },
      { label: 'Internal strategy mode on', ok: INTERNAL_STRATEGY_ENABLED },
      { label: 'Strategy panels path-guarded', ok: strategyVisible },
    ]
    const securityScore = Math.round((securityChecks.filter((c) => c.ok).length / securityChecks.length) * 25)

    const coreUrls = [
      '/',
      '/blog',
      '/robots.txt',
      '/sitemap.xml',
      '/image-sitemap.xml',
    ]
    const indexChecks = await Promise.all(
      coreUrls.map(async (path) => {
        try {
          const response = await fetch(path, { method: 'HEAD' })
          return { path, ok: response.ok, status: response.status }
        } catch {
          return { path, ok: false, status: 0 }
        }
      }),
    )
    let commandCenterRouteOk = false
    try {
      const routeResponse = await fetch('/command-center', { method: 'GET' })
      const routeHtml = await routeResponse.text()
      const hasNotFoundMarker = /Page Not Found|could not be found in this application/i.test(routeHtml)
      const hasCommandCenterMarker = /JWordenAI Command Center/i.test(routeHtml)
      commandCenterRouteOk = routeResponse.ok && hasCommandCenterMarker && !hasNotFoundMarker
    } catch {
      commandCenterRouteOk = false
    }

    const indexedPasses = indexChecks.filter((c) => c.ok).length
    const indexingScore = Math.round((((indexedPasses) + (commandCenterRouteOk ? 1 : 0)) / (indexChecks.length + 1)) * 25)

    const successfulRuns = runs.filter((r) => r.status === 'success')
    const recentSuccess = successfulRuns.some((r) => {
      const ended = new Date(r.ended_at || r.started_at || 0)
      if (ended.toString() === 'Invalid Date') return false
      return Date.now() - ended.getTime() < 7 * 24 * 60 * 60 * 1000
    })
    const automationScore = recentSuccess ? 20 : successfulRuns.length > 0 ? 12 : 6

    const total = Math.min(100, providerScore + securityScore + indexingScore + automationScore)
    const grade = total >= 95 ? '10/10' : total >= 90 ? '9/10' : total >= 80 ? '8/10' : `${Math.max(6, Math.round(total / 10))}/10`

    const nextActions = []
    if (providerScore < 24) nextActions.push('Stabilize provider uptime/config for all required AI channels.')
    if (securityScore < 20) nextActions.push('Ensure strict internal strategy mode remains on for command-center only visibility.')
    if (indexingScore < 25) nextActions.push('Restore 200 status on any failed crawl URL before next indexing wave.')
    if (!commandCenterRouteOk) nextActions.push('Fix /command-center runtime route: deployment appears to be serving a React Not Found view.')
    if (!recentSuccess) nextActions.push('Run at least one successful automation cycle every 24h for reliability confidence.')

    const nextReport = {
      generatedAt: new Date().toISOString(),
      total,
      grade,
      providerScore,
      securityScore,
      indexingScore,
      automationScore,
      providerSource,
      providerUpCount: providerUp.length,
      providerConfiguredCount: configuredProviders.length,
      indexChecks,
      commandCenterRouteOk,
      nextActions,
    }

    setReport(nextReport)
    if (typeof onAudit === 'function') {
      onAudit(nextReport)
    }

    setRunning(false)
  }, [onAudit, strategyVisible])

  useEffect(() => {
    runAudit()
  }, [runAudit])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-brand-amber mb-1">Launch Readiness</p>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">10/10 Audit Scorecard</h3>
        </div>
        <button
          type="button"
          onClick={runAudit}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 hover:border-brand-amber/40 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
          Run Audit
        </button>
      </div>

      {!report ? (
        <p className="text-sm text-white/60">Building launch scorecard...</p>
      ) : (
        <>
          <div className="rounded-xl border border-brand-amber/35 bg-brand-amber/10 px-3 py-3 mb-3">
            <p className="text-xs text-brand-amber uppercase tracking-[0.12em]">Current launch rating</p>
            <p className="text-white font-display font-black text-2xl mt-1">{report.total}/100 · {report.grade}</p>
            <p className="text-[11px] text-white/65 mt-1">Generated {new Date(report.generatedAt).toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mb-3">
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Providers</p>
              <p className="text-white font-bold text-sm mt-1">{report.providerScore}/30</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Security</p>
              <p className="text-white font-bold text-sm mt-1">{report.securityScore}/25</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Indexing</p>
              <p className="text-white font-bold text-sm mt-1">{report.indexingScore}/25</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Automation</p>
              <p className="text-white font-bold text-sm mt-1">{report.automationScore}/20</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
            <p className="text-xs text-white/70">Provider source: {report.providerSource.toUpperCase()} · Up {report.providerUpCount} / Configured {report.providerConfiguredCount}</p>
            <p className="text-xs text-white/70 mt-1">Core crawl URLs healthy: {report.indexChecks.filter((row) => row.ok).length}/{report.indexChecks.length}</p>
            <p className={`text-xs mt-1 ${report.commandCenterRouteOk ? 'text-emerald-300' : 'text-red-300'}`}>
              Command Center route integrity: {report.commandCenterRouteOk ? 'PASS' : 'FAIL'}
            </p>
          </div>

          {report.nextActions.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-amber-100 mb-1">Fastest path to 10/10</p>
              <ul className="space-y-1.5">
                {report.nextActions.map((item) => (
                  <li key={item} className="text-xs text-amber-100/90">• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function WeekendExecutionSprintPanel({ latestAudit }) {
  const defaultTasks = useMemo(
    () => [
      { id: 'provider-hardening', title: 'Provider failover + latency budgets', owner: 'Platform' },
      { id: 'ad-ops-rules', title: 'Ad guardrails + approval policies', owner: 'Growth' },
      { id: 'lead-sla', title: 'Hot/Warm SLA auto-escalation', owner: 'Sales Ops' },
      { id: 'content-engine', title: 'Blog pipeline and internal briefs', owner: 'Content' },
      { id: 'review-flywheel', title: 'Review request cadence tuning', owner: 'CX' },
      { id: 'reporting', title: 'Weekly executive ops digest', owner: 'Analytics' },
    ],
    [],
  )

  const [taskState, setTaskState] = useState(() => {
    const saved = readWeekendSprintState()
    if (saved?.taskState && typeof saved.taskState === 'object') return saved.taskState
    return {}
  })

  useEffect(() => {
    writeWeekendSprintState({ taskState, updated_at: new Date().toISOString() })
  }, [taskState])

  const completedCount = defaultTasks.filter((task) => taskState[task.id]).length

  const downloadJson = useCallback((filename, payload) => {
    if (typeof window === 'undefined') return
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [])

  const exportWeekendRunbook = useCallback(() => {
    const payload = {
      generated_at: new Date().toISOString(),
      source: 'command-center-weekend-sprint',
      readiness_snapshot: latestAudit || null,
      tasks: defaultTasks.map((task) => ({
        ...task,
        status: taskState[task.id] ? 'completed' : 'pending',
      })),
    }
    downloadJson('weekend-sprint-runbook.json', payload)
  }, [defaultTasks, downloadJson, latestAudit, taskState])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-brand-amber mb-1">Weekend Build</p>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Premium Execution Sprint</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/65">{completedCount}/{defaultTasks.length} complete</span>
          <button
            type="button"
            onClick={exportWeekendRunbook}
            className="rounded-lg bg-brand-amber text-brand-navy px-3 py-2 text-xs font-black uppercase tracking-[0.12em]"
          >
            Export Runbook
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {defaultTasks.map((task) => (
          <label key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 cursor-pointer">
            <div>
              <p className="text-sm text-white font-semibold">{task.title}</p>
              <p className="text-[11px] text-white/50 mt-0.5">Owner: {task.owner}</p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(taskState[task.id])}
              onChange={(e) => {
                setTaskState((prev) => ({ ...prev, [task.id]: e.target.checked }))
              }}
              className="h-4 w-4 accent-brand-amber"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function CivilContractorIntelligencePanel() {
  const [selectedState, setSelectedState] = useState('VA')
  const [stateCodeInput, setStateCodeInput] = useState('VA')
  const [market, setMarket] = useState('Richmond, VA')
  const [disputeType, setDisputeType] = useState('general')
  const [role, setRole] = useState('gc')
  const [advisorData, setAdvisorData] = useState(null)
  const [advisorStatus, setAdvisorStatus] = useState('idle')
  const [utilityRisk, setUtilityRisk] = useState(null)
  const [legalQuestion, setLegalQuestion] = useState('What notice and payment terms should we enforce before mobilization?')
  const [legalQaStatus, setLegalQaStatus] = useState('idle')
  const [legalQaResult, setLegalQaResult] = useState(null)
  const [projectName, setProjectName] = useState('Sample Retail Parking Lot')
  const [projectStatus, setProjectStatus] = useState('bid')
  const [projectScope, setProjectScope] = useState('2.3-acre commercial parking lot mill and overlay with utility conflict exposure near existing service lines.')
  const [projectValue, setProjectValue] = useState(385000)
  const [projectPublicFunding, setProjectPublicFunding] = useState(false)
  const [projectScoreStatus, setProjectScoreStatus] = useState('idle')
  const [projectScoreResult, setProjectScoreResult] = useState(null)

  const validStateCodes = useMemo(() => new Set(states.map((stateRow) => stateRow.abbr)), [])
  const stateCodeValid = validStateCodes.has(stateCodeInput)
  const stateName = states.find((stateRow) => stateRow.abbr === selectedState)?.state || selectedState
  const licensingEntry = constructionLicensing.find((entry) => entry.abbr === selectedState)
  const lienEntry = mechanicsLienLaws.find((entry) => entry.abbr === selectedState)
  const payEntry = promptPaymentLaws.find((entry) => entry.abbr === selectedState)
  const contractEntry = contractLaw.find((entry) => entry.abbr === selectedState)
  const roadsEntry = roadsAndPavingRegulations.find((entry) => entry.abbr === selectedState)

  const localRankedStates = useMemo(
    () => rankStatesByDispute(disputeType, mechanicsLienLaws, promptPaymentLaws, contractLaw).slice(0, 6),
    [disputeType],
  )

  const localRecommendation = useMemo(
    () => recommendStrategy(
      selectedState,
      disputeType,
      role,
      { lienEntry, payEntry, contractEntry },
      localRankedStates,
    ),
    [contractEntry, disputeType, lienEntry, localRankedStates, payEntry, role, selectedState],
  )

  const licenseLeaders = useMemo(() => optimizeLicenseStates(constructionLicensing).slice(0, 6), [])
  const lienLeaders = useMemo(() => getLienLeverageByState(mechanicsLienLaws).slice(0, 6), [])
  const rankedBidDemo = useMemo(
    () => rankContractorBids(
      [
        {
          name: 'J. Worden & Sons Operating Model',
          bidAmount: 128000,
          licenseState: selectedState,
          licenseClasses: licensingEntry?.licenseClasses || ['General contractor', 'Paving specialty'],
          bondAmount: licensingEntry?.bondMinCommercial || 50000,
          yearsExperience: 25,
          hasInsurance: true,
          workersComp: true,
        },
        {
          name: 'Low-bid competitor model',
          bidAmount: 91000,
          licenseState: selectedState,
          licenseClasses: ['Specialty'],
          bondAmount: 0,
          yearsExperience: 3,
          hasInsurance: true,
          workersComp: false,
        },
      ],
      115000,
      145000,
    ),
    [licensingEntry, selectedState],
  )

  const runAdvisor = useCallback(async () => {
    setAdvisorStatus('loading')
    try {
      const [legalStrategy, topStates, licenseOptimizer, utility] = await Promise.all([
        api.getLegalStrategy({ state: selectedState, dispute_type: disputeType, role }),
        api.getTopStates(disputeType, 6),
        api.getLicenseOptimizer(6),
        api.evaluateUtilityRisk({ has_septic: false, has_well: false, has_detached_structures: true, has_pool: false }),
      ])
      setAdvisorData({ legalStrategy, topStates, licenseOptimizer })
      setUtilityRisk(utility)
      setAdvisorStatus('live')
    } catch {
      setAdvisorData(null)
      setUtilityRisk(null)
      setAdvisorStatus('fallback')
    }
  }, [disputeType, role, selectedState])

  const askLegalQuestion = useCallback(async () => {
    if (!legalQuestion.trim()) return
    setLegalQaStatus('loading')
    try {
      const result = await api.askLegalQuestion({
        state: selectedState,
        question: legalQuestion.trim(),
        role,
      })
      setLegalQaResult(result)
      setLegalQaStatus('live')
    } catch {
      setLegalQaResult(null)
      setLegalQaStatus('fallback')
    }
  }, [legalQuestion, role, selectedState])

  const scoreProjectLegal = useCallback(async () => {
    if (!projectName.trim() || !projectScope.trim()) return
    setProjectScoreStatus('loading')
    try {
      const result = await api.scoreProjectLegal({
        project_name: projectName.trim(),
        state: selectedState,
        status: projectStatus,
        scope_summary: projectScope.trim(),
        contract_value_usd: Number(projectValue || 0),
        has_public_funding: Boolean(projectPublicFunding),
      })
      setProjectScoreResult(result)
      setProjectScoreStatus('live')
    } catch {
      setProjectScoreResult(null)
      setProjectScoreStatus('fallback')
    }
  }, [projectName, projectPublicFunding, projectScope, projectStatus, projectValue, selectedState])

  useEffect(() => {
    runAdvisor()
  }, [runAdvisor])

  const activeStrategy = advisorData?.legalStrategy
  const activeScores = activeStrategy?.scores || {
    lien: localRecommendation.scores.lien,
    payment: localRecommendation.scores.payment,
    contract: localRecommendation.scores.contract,
    composite: localRecommendation.composite,
    label: localRecommendation.strengthLabel,
  }
  const activeActions = activeStrategy?.strategy?.key_actions || localRecommendation.strategy.keyActions
  const activeTopStates = advisorData?.topStates?.states || localRankedStates
  const activeLicenseLeaders = advisorData?.licenseOptimizer?.results || licenseLeaders
  const legalQaPayload = legalQaResult?.status === 'success' ? legalQaResult : null
  const legalProjectPayload = projectScoreResult?.status === 'success' ? projectScoreResult : null

  const applyStateCode = useCallback((nextValue) => {
    const nextCode = String(nextValue || '').replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2)
    setStateCodeInput(nextCode)
    if (validStateCodes.has(nextCode)) {
      setSelectedState(nextCode)
      const nextStateName = states.find((stateRow) => stateRow.abbr === nextCode)?.state || nextCode
      setMarket((currentMarket) => currentMarket || `${nextStateName} operating market`)
    }
  }, [validStateCodes])

  const planReadiness = [
    { label: 'Plan upload intake', value: 'PDF/CAD/photos/documents', ready: true },
    { label: 'Quantity takeoff', value: 'Area, depth, tonnage, edges, striping', ready: true },
    { label: 'Cost catalog pricing', value: 'Labor, materials, trucking, equipment', ready: true },
    { label: 'State law overlay', value: 'License, lien, prompt pay, DOT, utility rules', ready: true },
    { label: 'Human bid approval', value: 'Estimator signs off before sending', ready: true },
  ]

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="rounded-2xl border border-brand-amber/30 bg-brand-amber/10 p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-brand-amber mb-1">In-house prep system</p>
            <h2 className="font-display font-black text-white text-2xl leading-tight">50-State Civil Contractor Intelligence</h2>
            <p className="text-white/65 text-sm mt-2 max-w-3xl">
              Same operating brain for all 50 states plus DC: state law, GC risk, paving rules, utility exposure, plan-to-bid prep, and award controls.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/advisory/legal-strategy" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 hover:border-brand-amber/40">
              Legal Advisor
            </Link>
            <Link to="/advisory/contractor-ranker" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 hover:border-brand-amber/40">
              Ranker
            </Link>
            <Link to={`/advisory/state/${selectedState}`} className="rounded-lg bg-brand-amber px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-brand-navy">
              State File
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5 xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-brand-amber" />
            <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Market Selector</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Operating market</label>
              <input
                type="text"
                value={market}
                onChange={(event) => setMarket(event.target.value)}
                placeholder="Detroit, MI"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
              />
              <p className="mt-1 text-[11px] text-white/45">Type the city or territory label operators use internally.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">State jurisdiction code</label>
              <input
                type="text"
                value={stateCodeInput}
                onChange={(event) => applyStateCode(event.target.value)}
                placeholder="VA"
                maxLength={2}
                className={`w-full rounded-lg border bg-black/30 px-3 py-2 text-sm uppercase text-white focus:outline-none focus:ring-2 ${stateCodeValid ? 'border-white/15 focus:ring-brand-amber' : 'border-red-300/50 focus:ring-red-300'}`}
              />
              <p className={`mt-1 text-[11px] ${stateCodeValid ? 'text-white/45' : 'text-red-200'}`}>
                {stateCodeValid ? `${stateName} loaded. Use any state abbreviation or DC.` : 'Enter a valid 2-letter state code or DC.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Situation</label>
              <select
                value={disputeType}
                onChange={(event) => setDisputeType(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
              >
                {DISPUTE_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Role</label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
              >
                {ROLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <button
              type="button"
              onClick={runAdvisor}
              className="w-full rounded-lg bg-brand-amber px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-brand-navy"
            >
              Refresh Intelligence
            </button>

            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65">
              Source: {advisorStatus === 'live' ? 'Backend advisor live' : advisorStatus === 'loading' ? 'Loading backend advisor' : 'Local 50-state fallback'}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5 xl:col-span-3">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-4 h-4 text-brand-amber" />
                <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">{stateName} Strategy Snapshot</h3>
              </div>
              <p className="text-white/55 text-sm">Legal strength, licensing posture, and paving regulation prep for {market}.</p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusTone(activeScores.composite || 0)}`}>
              {activeScores.composite || 0}/100 · {activeScores.label || localRecommendation.strengthLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Lien', value: activeScores.lien },
              { label: 'Prompt Pay', value: activeScores.payment },
              { label: 'Contract', value: activeScores.contract },
              { label: 'Composite', value: activeScores.composite },
            ].map((scoreRow) => (
              <div key={scoreRow.label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">{scoreRow.label}</p>
                <p className="text-white font-black text-2xl mt-1">{scoreRow.value || 0}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber mb-2">Action checklist</p>
              <div className="space-y-2">
                {activeActions.slice(0, 5).map((action) => (
                  <div key={action} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/75">
                    {action}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber mb-2">State rule file</p>
              <div className="space-y-2 text-xs text-white/70">
                <p>License required: {licensingEntry?.stateLicenseRequired ? 'Yes' : 'Local or category-specific'}</p>
                <p>License classes: {(licensingEntry?.licenseClasses || []).slice(0, 3).join(', ') || 'Review state file'}</p>
                <p>Commercial bond minimum: {licensingEntry?.bondMinCommercial ? `$${Number(licensingEntry.bondMinCommercial).toLocaleString()}` : 'No statewide value captured'}</p>
                <p>Lien filing window: {lienEntry?.lienFilingDeadlineDays ? `${lienEntry.lienFilingDeadlineDays} days` : 'Review state lien file'}</p>
                <p>Owner-to-GC pay clock: {payEntry?.ownerToGcDays ? `${payEntry.ownerToGcDays} days` : 'Review prompt-pay file'}</p>
                <p>Road/paving file: {roadsEntry ? 'Loaded for DOT, encroachment, restoration and overweight rules' : 'State road file pending'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5 xl:col-span-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber">Legal Q&A</p>
                <span className="text-[10px] text-white/50">
                  {legalQaStatus === 'live' ? 'Live' : legalQaStatus === 'loading' ? 'Loading' : 'Idle'}
                </span>
              </div>
              <textarea
                value={legalQuestion}
                onChange={(event) => setLegalQuestion(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
                placeholder="Ask anything legal/compliance related for this state..."
              />
              <button
                type="button"
                onClick={askLegalQuestion}
                className="mt-2 w-full rounded-lg border border-brand-amber/40 bg-brand-amber/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-amber"
              >
                Ask Legal Question
              </button>
              {legalQaPayload && (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/75 space-y-2">
                  <p className="text-white/90">{legalQaPayload.answer}</p>
                  <p>Strategy: {legalQaPayload.strategy?.title}</p>
                  <p>Composite: {legalQaPayload.scores?.composite}/100 · Liability: {legalQaPayload.compliance?.liability_risk}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber">Project Legal Score</p>
                <span className="text-[10px] text-white/50">
                  {projectScoreStatus === 'live' ? 'Live' : projectScoreStatus === 'loading' ? 'Loading' : 'Idle'}
                </span>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
                  placeholder="Project name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={projectStatus}
                    onChange={(event) => setProjectStatus(event.target.value)}
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
                  >
                    <option value="bid">Bid</option>
                    <option value="awarded">Awarded</option>
                  </select>
                  <input
                    type="number"
                    value={projectValue}
                    onChange={(event) => setProjectValue(event.target.value)}
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
                    placeholder="Contract value"
                  />
                </div>
                <textarea
                  value={projectScope}
                  onChange={(event) => setProjectScope(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-amber"
                  placeholder="Scope summary"
                />
                <label className="flex items-center gap-2 text-xs text-white/75">
                  <input
                    type="checkbox"
                    checked={projectPublicFunding}
                    onChange={(event) => setProjectPublicFunding(event.target.checked)}
                  />
                  Public funding applies
                </label>
              </div>
              <button
                type="button"
                onClick={scoreProjectLegal}
                className="mt-2 w-full rounded-lg border border-brand-amber/40 bg-brand-amber/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-amber"
              >
                Score Legal Risk
              </button>
              {legalProjectPayload && (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/75 space-y-2">
                  <p className="text-white/90">Score: {legalProjectPayload.legal_score?.value}/100 ({legalProjectPayload.legal_score?.risk_band})</p>
                  <p>Liability: {legalProjectPayload.legal_score?.liability_risk}</p>
                  <p>{legalProjectPayload.checklist?.[0]}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-brand-amber" />
            <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Plan-to-Bid Readiness</h3>
          </div>
          <div className="space-y-2.5">
            {planReadiness.map((row) => (
              <div key={row.label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{row.label}</p>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">Ready</span>
                </div>
                <p className="text-xs text-white/55 mt-1">{row.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2.5 text-xs text-amber-100">
            Final bid flow: upload plans, extract quantities, price from catalog, overlay local rules, then require estimator approval before release.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <HardHat className="w-4 h-4 text-brand-amber" />
            <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Contractor Award Model</h3>
          </div>
          <div className="space-y-2.5">
            {rankedBidDemo.map((bidRow) => (
              <div key={bidRow.name} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">#{bidRow.rank} {bidRow.name}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${statusTone(bidRow.scores.composite)}`}>
                    {bidRow.scores.composite}
                  </span>
                </div>
                <p className="text-xs text-white/55 mt-1">{bidRow.rankLabel} · ${Number(bidRow.bidAmount).toLocaleString()}</p>
                <p className="text-xs text-white/45 mt-1">{bidRow.recommendation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em] mb-3">Expansion Signals</h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber mb-2">Best base licenses</p>
              <div className="flex flex-wrap gap-2">
                {activeLicenseLeaders.slice(0, 6).map((stateRow) => (
                  <span key={stateRow.abbr} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/70">
                    {stateRow.abbr} {stateRow.optimizer_score || stateRow.optimizerScore}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber mb-2">Strong lien leverage</p>
              <div className="flex flex-wrap gap-2">
                {lienLeaders.map((stateRow) => (
                  <span key={stateRow.abbr} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/70">
                    {stateRow.abbr} {stateRow.lienScore}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber mb-2">Top dispute states</p>
              <div className="flex flex-wrap gap-2">
                {activeTopStates.slice(0, 6).map((stateRow) => (
                  <span key={stateRow.abbr} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/70">
                    {stateRow.abbr} {stateRow.weighted || stateRow.composite || stateRow.score}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65">
              Utility risk sample: {utilityRisk?.risk_level || 'Local fallback'}. Private lines, 811 notices, and restoration rules stay inside the bid packet.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 md:px-5 py-4 text-xs text-white/55 leading-relaxed">
        Advisory output is internal prep, not legal advice. For plan-based bids, the system should produce a draft estimate, risk sheet, and bid package, then require human estimator and legal review before customer release.
      </div>
    </div>
  )
}

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()
      if (pin === CC_PASSWORD) {
        onUnlock()
      } else {
        setError(true)
        setPin('')
      }
    },
    [pin, onUnlock],
  )

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-brand-navy/10 bg-white p-8 shadow-xl text-center">
        <div className="w-14 h-14 rounded-xl bg-brand-navy flex items-center justify-center text-brand-amber text-2xl mx-auto mb-6">
          🔒
        </div>
        <h2 className="font-display font-bold text-2xl text-brand-navy mb-2">Command Center</h2>
        <p className="text-brand-navy/55 text-sm mb-6">Enter your access PIN to continue.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value)
              setError(false)
            }}
            className="w-full rounded-lg border border-brand-navy/20 px-4 py-3 text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-brand-amber"
          />
          {error && (
            <p className="text-red-500 text-sm">Incorrect PIN. Try again.</p>
          )}
          <button type="submit" className="btn-primary py-3">
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}

function DisabledNotice() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-white/40 text-2xl mx-auto mb-6">
          🚫
        </div>
        <h2 className="font-display font-bold text-xl text-white mb-2">Not Available</h2>
        <p className="text-white/50 text-sm">
          Command Center is not configured in this environment.
          <br />
          Set <code className="bg-white/10 px-1 rounded text-xs">VITE_CC_PASSWORD</code> to enable access.
        </p>
      </div>
    </div>
  )
}

function InternalStrategyNotice() {
  return (
    <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 px-4 py-3.5 text-sm text-amber-100">
      Internal strategy panels are hidden in this environment. Set <code className="bg-amber-100/15 px-1 rounded text-xs">VITE_INTERNAL_STRATEGY_MODE=on</code> and access only from <code className="bg-amber-100/15 px-1 rounded text-xs">/command-center</code>.
    </div>
  )
}

// ── Jarvis chat + autonomy controls panel ───────────────────────────────────
function JarvisChat({ compact = false }) {
  const [messages, setMessages] = useState(() => ([
    { role: 'jarvis', text: 'Online. Ask me anything about the business, or hit a quick prompt below.' },
  ]))
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [statusOk, setStatusOk] = useState(null)
  const [engine, setEngine] = useState(null)        // 'anthropic-claude' | 'heuristic-fallback'
  const [backendFrozen, setBackendFrozen] = useState(false)
  const [tools, setTools] = useState({ web_search: false, make_phone_call: false, send_email: false, tts: false })
  const scrollerRef = useRef(null)
  // ── Voice I/O (Web Speech API) ────────────────────────────────────────────
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [speakReplies, setSpeakReplies] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage?.getItem('cc:jarvis:speak') === '1'
  })
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setVoiceSupported(false); return }
    setVoiceSupported(true)
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim()
      if (transcript) {
        // Auto-send the transcript so the user doesn't need to click Send.
        setListening(false)
        // Defer to next tick so React state updates before send fires.
        setTimeout(() => { sendRef.current?.(transcript) }, 0)
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    return () => { try { rec.stop() } catch { /* noop */ } }
  }, [])

  const toggleListen = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    if (listening) {
      try { rec.stop() } catch { /* noop */ }
      setListening(false)
    } else {
      try { rec.start(); setListening(true) } catch { setListening(false) }
    }
  }, [listening])

  const speak = useCallback((text) => {
    if (!text) return
    try { voiceService.play(text.slice(0, 600)) } catch { /* fallback in service */ }
  }, [])

  const toggleSpeakReplies = useCallback(() => {
    setSpeakReplies((v) => {
      const next = !v
      try { window.localStorage?.setItem('cc:jarvis:speak', next ? '1' : '0') } catch { /* noop */ }
      if (!next) { try { voiceService.stop() } catch { /* noop */ } }
      return next
    })
  }, [])

  // sendRef lets the recognition callback call the latest `send` without
  // re-binding the recognition listener every render.
  const sendRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const applyStatus = (r) => {
      if (cancelled) return
      const ok = Boolean(r && (r.status === 'ONLINE' || r.identity === 'JARVIS' || r.ok === true))
      setStatusOk(ok)
      setEngine(r?.engine || null)
      setBackendFrozen(Boolean(r?.autonomy?.frozen))
      setTools({
        web_search:      Boolean(r?.tools?.web_search),
        make_phone_call: Boolean(r?.tools?.make_phone_call),
        send_email:      Boolean(r?.tools?.send_email),
        tts:             Boolean(r?.tools?.tts),
      })
    }

    api.jarvisReadiness()
      .then((r) => applyStatus(r))
      .catch(() => {
        api.jarvisStatus()
          .then((r) => applyStatus(r))
          .catch(() => { if (!cancelled) setStatusOk(false) })
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [messages])

  const send = useCallback(async (text, opts = {}) => {
    const query = (text ?? input).trim()
    if (!query || sending) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'you', text: query }])
    setSending(true)
    try {
      // confirmed=true when operator clicked a button (not free-typing)
      const res = await api.jarvisCommand(query, 'JARVIS', { confirmed: Boolean(opts.confirmed) })
      const reply = res?.response || res?.message || res?.reply || JSON.stringify(res)
      const toolNote = Array.isArray(res?.tool_calls) && res.tool_calls.length
        ? `\n\n[used ${res.tool_calls.length} tool${res.tool_calls.length > 1 ? 's' : ''}: ${res.tool_calls.map(t => t.name).join(', ')}]`
        : ''
      const replyText = String(reply) + toolNote
      setMessages((prev) => [...prev, { role: 'jarvis', text: replyText }])
      if (speakReplies) speak(String(reply))
    } catch (err) {
      const errText = `Error: ${err?.message || 'Jarvis unreachable'}`
      setMessages((prev) => [...prev, { role: 'jarvis', text: errText }])
      if (speakReplies) speak(errText)
    } finally {
      setSending(false)
    }
  }, [input, sending, speakReplies, speak])

  // Keep the latest `send` accessible to the SpeechRecognition callback.
  useEffect(() => { sendRef.current = send }, [send])

  // Listen for prefill events from other panels (e.g. CRM "Ask Jarvis" button)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPrefill = (ev) => {
      const prompt = ev?.detail?.prompt
      if (!prompt) return
      setInput(prompt)
      // Scroll into view if compact drawer is closed; user can hit Send.
    }
    window.addEventListener('cc:jarvis-prefill', onPrefill)
    return () => window.removeEventListener('cc:jarvis-prefill', onPrefill)
  }, [])

  const quickPrompts = [
    'Status report on the business right now',
    'Top 3 leads to call today and why',
    'What\u2019s the weather forecast for Richmond this week?',
    'Find me top-rated steakhouses in Richmond open tonight',
  ]

  return (
    <div className={['rounded-2xl border border-white/10 bg-white/[0.04] flex flex-col', compact ? 'h-full' : 'min-h-[560px]'].join(' ')}>
      <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-amber/15 border border-brand-amber/40 flex items-center justify-center">
            <Bot className="w-4 h-4 text-brand-amber" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-white text-base leading-tight">Jarvis</h3>
              <span className="inline-flex items-center rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-100">
                Stark Mode Premium
              </span>
            </div>
            <p className="text-white/40 text-xs">
              {engine === 'anthropic-claude'
                ? 'Powered by Claude · live brain'
                : engine === 'heuristic-fallback'
                  ? 'Heuristic mode · add ANTHROPIC_API_KEY to unlock Claude'
                  : 'Your private AI ops officer'}
            </p>
            <p className="text-white/30 text-[11px]">Voice-first ops: press mic, speak naturally, execute fast.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tools.web_search ? (
            <span title="Web search via Tavily — ready" className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-2 py-0.5 border border-sky-300/40 text-sky-100 bg-sky-300/10">
              <Globe className="w-3 h-3" /> Web
            </span>
          ) : null}
          {tools.make_phone_call ? (
            <span title="Outbound calls via Vapi — ready" className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-2 py-0.5 border border-emerald-300/40 text-emerald-100 bg-emerald-300/10">
              <Phone className="w-3 h-3" /> Call
            </span>
          ) : null}
          {tools.send_email ? (
            <span title="Email via SendGrid — ready" className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-2 py-0.5 border border-amber-300/40 text-amber-100 bg-amber-300/10">
              <Mail className="w-3 h-3" /> Email
            </span>
          ) : null}
          {tools.tts ? (
            <span title="Neural voice synthesis — ready" className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-2 py-0.5 border border-violet-300/40 text-violet-100 bg-violet-300/10">
              <Volume2 className="w-3 h-3" /> TTS
            </span>
          ) : null}
          {backendFrozen ? (
            <span className="inline-flex items-center gap-1.5 rounded-full text-[10px] font-bold px-2 py-0.5 border border-red-400/50 text-red-100 bg-red-500/15">
              BACKEND FROZEN
            </span>
          ) : null}
          <span className={[
            'inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 border',
            statusOk == null ? 'border-white/20 text-white/50 bg-white/5' :
            statusOk ? 'border-emerald-300/40 text-emerald-200 bg-emerald-300/10' :
                       'border-red-300/40 text-red-200 bg-red-300/10',
          ].join(' ')}>
            <span className={['w-1.5 h-1.5 rounded-full',
              statusOk == null ? 'bg-white/30' : statusOk ? 'bg-emerald-300 animate-pulse' : 'bg-red-300'
            ].join(' ')} />
            {statusOk == null ? 'Checking…' : statusOk ? 'ONLINE' : 'OFFLINE'}
          </span>
          {/* Owner token input — used by operator to authorize actions */}
          <div className="ml-3 flex items-center gap-2">
            <input
              type="password"
              id="owner_token_input"
              placeholder="Owner token"
              defaultValue={typeof window !== 'undefined' ? window.sessionStorage.getItem('OWNER_TOKEN') || '' : ''}
              onBlur={(e) => { try { window.sessionStorage.setItem('OWNER_TOKEN', e.target.value || '') } catch { /* noop */ } }}
              className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 text-white/80"
            />
            <button
              type="button"
              onClick={() => { try { const v = (document.getElementById('owner_token_input')||{}).value || ''; window.sessionStorage.setItem('OWNER_TOKEN', v); alert('Owner token saved for this session.'); } catch { alert('Could not save token.'); } }}
              className="text-xs px-2 py-1 rounded bg-white/[0.06] border border-white/10 text-white/70 hover:text-white"
            >Set</button>
          </div>
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={['flex', m.role === 'you' ? 'justify-end' : 'justify-start'].join(' ')}>
            <div className={[
              'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap',
              m.role === 'you'
                ? 'bg-brand-amber/15 border border-brand-amber/40 text-amber-100'
                : 'bg-white/[0.06] border border-white/10 text-white/90',
            ].join(' ')}>{m.text}</div>
          </div>
        ))}
        {sending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3.5 py-2.5 text-sm bg-white/[0.06] border border-white/10 text-white/60 inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Jarvis is thinking…
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-4 md:px-5 pt-2 pb-3 border-t border-white/10">
        <div className="flex flex-wrap gap-2 mb-2">
          {quickPrompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              disabled={sending}
              className="text-xs px-2.5 py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-white/70 hover:text-white hover:border-white/30 disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2">
          {voiceSupported ? (
            <button
              type="button"
              onClick={toggleListen}
              disabled={sending}
              title={listening ? 'Stop listening' : 'Hold to talk — click then speak'}
              aria-pressed={listening}
              className={[
                'inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors',
                listening
                  ? 'border-red-300/60 bg-red-300/15 text-red-200 animate-pulse'
                  : 'border-white/15 bg-white/[0.05] text-white/70 hover:text-white hover:border-white/30',
                sending ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleSpeakReplies}
            title={speakReplies ? 'Mute Jarvis voice' : 'Hear Jarvis speak replies'}
            aria-pressed={speakReplies}
            className={[
              'inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors',
              speakReplies
                ? 'border-emerald-300/60 bg-emerald-300/15 text-emerald-200'
                : 'border-white/15 bg-white/[0.05] text-white/70 hover:text-white hover:border-white/30',
            ].join(' ')}
          >
            {speakReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? 'Listening… speak now' : 'Tell Jarvis what to do…'}
            className="flex-1 bg-white/[0.05] border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/35 focus:outline-none focus:border-brand-amber/60"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 bg-brand-amber text-brand-navy font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-40"
          >
            <Send className="w-4 h-4" /> Send
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Live Jarvis Activity Feed ──────────────────────────────────────────────
function JarvisActivityFeed({ compact = false }) {
  const [items, setItems] = useState(() => readJarvisActivity())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onUpdate = () => setItems(readJarvisActivity())
    window.addEventListener('cc:jarvis-activity', onUpdate)
    window.addEventListener('storage', (e) => { if (e.key === JARVIS_ACTIVITY_KEY) onUpdate() })
    return () => window.removeEventListener('cc:jarvis-activity', onUpdate)
  }, [])

  const clear = useCallback(() => {
    try { localStorage.removeItem(JARVIS_ACTIVITY_KEY) } catch { /* noop */ }
    setItems([])
  }, [])

  const iconFor = (kind) => {
    if (kind === 'call') return <Phone className="w-3.5 h-3.5 text-emerald-300" />
    if (kind === 'email') return <Mail className="w-3.5 h-3.5 text-amber-300" />
    if (kind === 'sla-alarm') return <AlertTriangle className="w-3.5 h-3.5 text-red-300" />
    if (kind === 'wake') return <Mic className="w-3.5 h-3.5 text-sky-300" />
    return <Bot className="w-3.5 h-3.5 text-white/70" />
  }

  return (
    <div className={['rounded-2xl border border-white/10 bg-white/[0.04]', compact ? 'p-3' : 'p-4 md:p-5'].join(' ')}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Jarvis Activity</h3>
          <p className="text-white/45 text-xs mt-0.5">Live feed of every action Jarvis takes for you.</p>
        </div>
        <button type="button" onClick={clear} className="text-[11px] text-white/55 hover:text-white">Clear</button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-white/55">No Jarvis activity yet. Tap Call or Email on a lead to see it stream in here.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              <div className="flex items-center gap-2">
                {iconFor(item.kind)}
                <p className="text-white text-xs font-semibold uppercase tracking-[0.08em]">{item.kind}</p>
                <span className={[
                  'ml-auto text-[10px] font-bold uppercase tracking-[0.12em]',
                  item.status === 'failed' ? 'text-red-300' : item.status === 'sent' || item.status === 'queued' ? 'text-emerald-300' : 'text-amber-200',
                ].join(' ')}>{item.status || ''}</span>
              </div>
              <p className="text-white/70 text-[12px] mt-1">
                {item.leadName ? `${item.leadName} · ` : ''}{item.phone || item.email || item.detail || ''}
              </p>
              <p className="text-white/40 text-[10px] mt-0.5">{item.ts ? new Date(item.ts).toLocaleString() : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SLA Breach Alarm (auto-detect hot leads past SLA, voice-notify owner) ──
function SLABreachAlarmPanel() {
  const [breaches, setBreaches] = useState([])
  const [armed, setArmed] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage?.getItem('cc:sla:armed') !== '0'
  })
  const [autoCall, setAutoCall] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage?.getItem('cc:sla:autocall') === '1'
  })
  const [lastCheck, setLastCheck] = useState(null)

  const speakAlarm = useCallback((text) => {
    if (!armed || !text) return
    try { voiceService.play(text) } catch { /* fallback in service */ }
  }, [armed])

  const readAlarmed = () => {
    try { return JSON.parse(localStorage.getItem(SLA_ALARMED_KEY) || '[]') } catch { return [] }
  }
  const writeAlarmed = (ids) => {
    try { localStorage.setItem(SLA_ALARMED_KEY, JSON.stringify(ids.slice(0, 200))) } catch { /* noop */ }
  }

  const check = useCallback(async () => {
    try {
      const all = await api.entities.Lead.list('-created_date', 100)
      const now = Date.now()
      const rows = (Array.isArray(all) ? all : []).map((lead) => {
        const score = Number(lead.score || 0)
        const tier = String(lead.score_tier || (score >= 80 ? 'hot' : score >= 60 ? 'warm' : 'nurture')).toLowerCase()
        const created = new Date(lead.created_date || lead.created_at || 0).getTime()
        if (!created) return null
        const ageMin = Math.floor((now - created) / 60000)
        const sla = tier === 'hot' ? 15 : tier === 'warm' ? 60 : null
        if (!sla) return null
        const status = String(lead.status || 'new').toLowerCase()
        if (['won', 'lost', 'contacted'].includes(status)) return null
        if (ageMin <= sla) return null
        return { id: lead.id, name: lead.name || 'Website Visitor', phone: lead.phone, tier, ageMin, breachBy: ageMin - sla }
      }).filter(Boolean).sort((a, b) => b.breachBy - a.breachBy)

      setBreaches(rows)
      setLastCheck(new Date())

      // Trigger alarm only for newly breached leads (avoid repeat noise)
      const alarmed = new Set(readAlarmed())
      const fresh = rows.filter((r) => !alarmed.has(String(r.id)))
      if (armed && fresh.length > 0) {
        const top = fresh[0]
        const msg = `Sir, ${fresh.length} hot lead${fresh.length > 1 ? 's are' : ' is'} past S L A. ${top.name}, ${top.breachBy} minutes overdue.`
        speakAlarm(msg)
        appendJarvisActivity({ kind: 'sla-alarm', leadId: top.id, leadName: top.name, phone: top.phone, status: 'alarmed', detail: msg })
        if (autoCall && top.phone) {
          try {
            await api.jarvisCall(top.phone, `URGENT SLA breach \u2014 ${top.name}`, 'This is Jarvis from J. Worden & Sons following up on your recent paving estimate request. Do you have a quick minute?')
            appendJarvisActivity({ kind: 'call', leadId: top.id, leadName: top.name, phone: top.phone, status: 'queued', detail: 'auto-call (SLA)' })
          } catch (err) {
            appendJarvisActivity({ kind: 'call', leadId: top.id, leadName: top.name, phone: top.phone, status: 'failed', detail: `auto-call failed: ${err?.message || ''}` })
          }
        }
        // Mark all current breaches as alarmed (so we don't re-fire next tick).
        const next = Array.from(new Set([...alarmed, ...rows.map((r) => String(r.id))]))
        writeAlarmed(next)
      }
    } catch {
      // backend may be cold; silently retry next tick
    }
  }, [armed, autoCall, speakAlarm])

  useEffect(() => {
    check()
    const interval = setInterval(check, 60_000) // every minute
    return () => clearInterval(interval)
  }, [check])

  const toggleArmed = () => setArmed((v) => {
    const next = !v
    try { localStorage.setItem('cc:sla:armed', next ? '1' : '0') } catch { /* noop */ }
    return next
  })
  const toggleAutoCall = () => setAutoCall((v) => {
    const next = !v
    try { localStorage.setItem('cc:sla:autocall', next ? '1' : '0') } catch { /* noop */ }
    return next
  })

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em] inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-300" /> SLA Breach Alarm
          </h3>
          <p className="text-white/45 text-xs mt-0.5">Hot lead unanswered &gt;15 min triggers a voice alert.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleArmed} className={`text-[11px] font-bold rounded-full px-3 py-1.5 border ${armed ? 'border-red-300/40 bg-red-300/10 text-red-200' : 'border-white/15 text-white/55'}`}>
            {armed ? 'ARMED' : 'Disarmed'}
          </button>
          <button type="button" onClick={toggleAutoCall} className={`text-[11px] font-bold rounded-full px-3 py-1.5 border ${autoCall ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-white/15 text-white/55'}`}>
            Auto-Call: {autoCall ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      {breaches.length === 0 ? (
        <p className="text-sm text-emerald-300">All clear. No leads past SLA right now.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {breaches.slice(0, 8).map((b) => (
            <div key={b.id} className="rounded-lg border border-red-300/30 bg-red-300/10 px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-red-100 text-sm font-semibold">{b.name}</p>
                <p className="text-red-200/80 text-[11px] mt-0.5">{b.phone || 'no phone'} · {b.ageMin} min old · <span className="font-bold">{b.breachBy} min beyond SLA</span></p>
              </div>
              {b.phone ? (
                <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 rounded-lg border border-red-200/40 bg-red-200/10 px-2.5 py-1.5 text-[11px] font-bold text-red-100 hover:bg-red-200/20">
                  <Phone className="w-3 h-3" /> Call
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-white/40 mt-3">Last check: {lastCheck ? lastCheck.toLocaleTimeString() : 'pending'}. Polls every 60s.</p>
    </div>
  )
}

// ── "Hey Jarvis" Wake Word listener (always-on, opt-in) ────────────────────
function HeyJarvisWakeWord() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage?.getItem('cc:wakeword') === '1'
  })
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [lastHeard, setLastHeard] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    setSupported(Boolean(SR))
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    let stopped = false
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const text = (last?.[0]?.transcript || '').toLowerCase().trim()
      if (!text) return
      setLastHeard(text)
      if (text.includes('hey jarvis') || text.includes('hey, jarvis') || text.includes('jarvis')) {
        // Strip wake phrase, dispatch the rest as a prefilled prompt + open drawer
        const cleaned = text.replace(/.*jarvis[,]?\s*/i, '').trim()
        const prompt = cleaned || 'Status report.'
        appendJarvisActivity({ kind: 'wake', status: 'heard', detail: `\u201C${text}\u201D \u2192 ${prompt}` })
        try {
          window.dispatchEvent(new CustomEvent('cc:jarvis-prefill', { detail: { prompt } }))
          window.dispatchEvent(new CustomEvent('cc:open-jarvis-drawer'))
        } catch { /* noop */ }
        // Brief audio confirmation (neural)
        try { voiceService.play('Yes, sir.') } catch { /* noop */ }
      }
    }
    rec.onend = () => {
      if (!stopped && enabled) {
        // Auto-restart so it stays "always on"
        try { rec.start(); setListening(true) } catch { setListening(false) }
      } else {
        setListening(false)
      }
    }
    rec.onerror = () => { /* swallow; onend will restart */ }

    try { rec.start(); setListening(true) } catch { setListening(false) }
    recognitionRef.current = rec

    return () => {
      stopped = true
      try { rec.stop() } catch { /* noop */ }
      setListening(false)
    }
  }, [enabled])

  const toggle = () => setEnabled((v) => {
    const next = !v
    try { localStorage.setItem('cc:wakeword', next ? '1' : '0') } catch { /* noop */ }
    return next
  })

  if (!supported) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em] inline-flex items-center gap-2">
          <Mic className="w-4 h-4" /> Hey Jarvis Wake Word
        </h3>
        <p className="text-white/55 text-sm mt-2">Wake word requires Chrome, Edge, or Safari. Open the dashboard in one of those browsers.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em] inline-flex items-center gap-2">
            <Mic className={`w-4 h-4 ${listening ? 'text-red-300 animate-pulse' : 'text-white/60'}`} /> Hey Jarvis Wake Word
          </h3>
          <p className="text-white/45 text-xs mt-0.5">Just say <span className="text-white/80 font-semibold">"Hey Jarvis, [your command]"</span> from anywhere on the dashboard.</p>
        </div>
        <button type="button" onClick={toggle} className={`text-[11px] font-bold rounded-full px-3 py-1.5 border ${enabled ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-white/15 text-white/55'}`}>
          {enabled ? (listening ? 'LISTENING' : 'STARTING\u2026') : 'OFF'}
        </button>
      </div>
      {enabled && lastHeard ? (
        <p className="text-[11px] text-white/45 mt-2 italic">Heard: "{lastHeard.slice(0, 80)}"</p>
      ) : null}
      <p className="text-[10px] text-white/40 mt-2">Tip: Microphone must stay allowed in browser settings. Drains battery faster on mobile \u2014 toggle off when done.</p>
    </div>
  )
}

function JarvisAutonomy() {
  const [autonomy, setAutonomy] = useState(readAutonomyState)

  // Listen for panic/unfreeze events from anywhere (header button, etc.)
  useEffect(() => {
    const onChange = () => setAutonomy(readAutonomyState())
    if (typeof window !== 'undefined') window.addEventListener('cc:autonomy-changed', onChange)
    return () => { if (typeof window !== 'undefined') window.removeEventListener('cc:autonomy-changed', onChange) }
  }, [])

  const toggleMaster = useCallback(() => {
    setAutonomy((prev) => {
      if (prev.frozen) return prev // hard guard: cannot enable while frozen
      const next = { ...prev, master: !prev.master }
      writeAutonomyState(next)
      return next
    })
  }, [])

  const toggleDomain = useCallback((id) => {
    setAutonomy((prev) => {
      if (prev.frozen || !prev.master) return prev
      const next = { ...prev, domains: { ...prev.domains, [id]: !prev.domains?.[id] } }
      writeAutonomyState(next)
      return next
    })
  }, [])

  const masterDisabled = autonomy.frozen
  const domainsDisabled = autonomy.frozen || !autonomy.master

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Power className={['w-4 h-4', autonomy.master && !autonomy.frozen ? 'text-emerald-300' : 'text-white/40'].join(' ')} />
            <h3 className="font-display font-bold text-white text-base">Autonomy</h3>
          </div>
          <p className="text-white/45 text-xs mt-1">Master switch. Off = Jarvis only acts when you ask.</p>
        </div>
        <button
          type="button"
          onClick={toggleMaster}
          disabled={masterDisabled}
          aria-pressed={autonomy.master && !autonomy.frozen}
          className={[
            'relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors',
            masterDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
            autonomy.master && !autonomy.frozen ? 'border-emerald-300/50 bg-emerald-300/30' : 'border-white/20 bg-white/10',
          ].join(' ')}
        >
          <span className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5',
            autonomy.master && !autonomy.frozen ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')} />
        </button>
      </div>

      {autonomy.frozen ? (
        <div className="rounded-xl border border-red-300/50 bg-red-300/10 px-3 py-2 text-xs text-red-100">
          <span className="font-bold">FROZEN</span> · Jarvis is locked out of all autonomous action since {autonomy.frozenAt ? new Date(autonomy.frozenAt).toLocaleString() : 'manual trigger'}. Use the red header button to unfreeze.
        </div>
      ) : (
        <div className={['rounded-xl border px-3 py-2 text-xs',
          autonomy.master
            ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100'
            : 'border-white/10 bg-white/5 text-white/55',
        ].join(' ')}>
          {autonomy.master
            ? 'Autonomy is ON. Per-domain switches below decide exactly what Jarvis runs by itself.'
            : 'Autonomy is OFF. Everything waits for your approval.'}
        </div>
      )}

      <div className="space-y-2">
        {AUTONOMY_DOMAINS.map((d) => {
          const enabled = !autonomy.frozen && autonomy.master && Boolean(autonomy.domains?.[d.id])
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleDomain(d.id)}
              disabled={domainsDisabled}
              className={[
                'w-full text-left flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                enabled
                  ? 'border-emerald-300/40 bg-emerald-300/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                domainsDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{d.label}</p>
                <p className="text-xs text-white/45 mt-0.5">{d.desc}</p>
              </div>
              <span className={[
                'shrink-0 mt-0.5 inline-flex h-5 w-9 rounded-full border',
                enabled ? 'border-emerald-300/60 bg-emerald-300/40' : 'border-white/20 bg-white/10',
              ].join(' ')}>
                <span className={[
                  'inline-block h-3.5 w-3.5 mt-0.5 rounded-full bg-white transition-transform',
                  enabled ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')} />
              </span>
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] text-white/45 leading-relaxed">
        Settings save instantly to this device. Jarvis reads them on every action. Backend mirror endpoint coming next so toggles sync across your phone &amp; laptop.
      </div>
    </div>
  )
}

function JarvisMissionControl() {
  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState(null)

  const dispatchJarvisPrompt = useCallback((prompt) => {
    try {
      window.dispatchEvent(new CustomEvent('cc:jarvis-prefill', { detail: { prompt } }))
      window.dispatchEvent(new CustomEvent('cc:open-jarvis-drawer'))
    } catch {
      // no-op
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [
        readiness,
        preflight,
        autonomy,
        intelMap,
        metrics,
        techQueue,
        legalScore,
      ] = await Promise.allSettled([
        api.jarvisReadiness(),
        api.dashboardPreflight(),
        api.autonomyStatus(),
        api.autonomyIntelligenceMap(),
        api.jarvisMetrics(),
        api.getTechIntelligenceQueue({ limit: 6, min_priority: 'high' }),
        api.scoreProjectLegal({
          project_name: 'Premium Sample Operations Project',
          state: 'VA',
          status: 'awarded',
          scope_summary: 'Commercial paving with utility conflict risk and public-access traffic controls.',
          contract_value_usd: 625000,
          has_public_funding: false,
        }),
      ])

      const readinessData = readiness.status === 'fulfilled' ? readiness.value : null
      const preflightData = preflight.status === 'fulfilled' ? preflight.value : null
      const autonomyData = autonomy.status === 'fulfilled' ? autonomy.value : null
      const mapData = intelMap.status === 'fulfilled' ? intelMap.value : null
      const metricsData = metrics.status === 'fulfilled' ? metrics.value : null
      const techData = techQueue.status === 'fulfilled' ? techQueue.value : null
      const legalData = legalScore.status === 'fulfilled' ? legalScore.value : null

      const blockers = [
        ...(Array.isArray(readinessData?.blockers) ? readinessData.blockers : []),
        ...(Array.isArray(preflightData?.jarvis?.blockers) ? preflightData.jarvis.blockers : []),
      ]

      const capabilityCoverage = (() => {
        if (!mapData?.levels) return null
        const l1 = Array.isArray(mapData.levels?.L1_descriptive?.capabilities) ? mapData.levels.L1_descriptive.capabilities.length : 0
        const l2 = Array.isArray(mapData.levels?.L2_predictive?.capabilities) ? mapData.levels.L2_predictive.capabilities.length : 0
        const l3 = Array.isArray(mapData.levels?.L3_prescriptive?.capabilities) ? mapData.levels.L3_prescriptive.capabilities.length : 0
        const l4 = Array.isArray(mapData.levels?.L4_autonomous?.capabilities) ? mapData.levels.L4_autonomous.capabilities.length : 0
        return { l1, l2, l3, l4, total: l1 + l2 + l3 + l4 }
      })()

      const legalScoreValue = Number(legalData?.legal_score?.value || 0)
      const techHighCount = Number(techData?.queue_count || 0)
      const readinessScore = readinessData?.full_capacity ? 40 : 18
      const autonomyScore = String(autonomyData?.autonomy_level || '').toUpperCase() === 'L4' ? 20 : 10
      const legalScoreContribution = Math.round((legalScoreValue / 100) * 20)
      const techScore = techHighCount >= 4 ? 20 : techHighCount >= 2 ? 14 : 8
      const blockerPenalty = Math.min(20, blockers.length * 4)
      const missionScore = Math.max(0, Math.min(100, readinessScore + autonomyScore + legalScoreContribution + techScore - blockerPenalty))

      setPayload({
        readiness: readinessData,
        preflight: preflightData,
        autonomy: autonomyData,
        intelMap: mapData,
        metrics: metricsData,
        techQueue: techData,
        legalScore: legalData,
        blockers,
        capabilityCoverage,
        missionScore,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 120000)
    return () => clearInterval(timer)
  }, [load])

  const tone = payload?.missionScore >= 85 ? 'good' : payload?.missionScore >= 65 ? 'warn' : 'bad'
  const toneClass = tone === 'good'
    ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100'
    : tone === 'warn'
      ? 'border-amber-300/40 bg-amber-300/10 text-amber-100'
      : 'border-red-300/40 bg-red-300/10 text-red-100'

  const quickOpsPrompts = [
    'Give me an executive briefing now: revenue, legal risk, lead bottlenecks, and actions for the next 4 hours.',
    'Build a same-day strike plan for hot leads, late jobs, and legal risk with owners and deadlines.',
    'Scan for hidden risks across operations and propose automatic remediations ranked by impact.',
  ]

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5 xl:col-span-3 2xl:col-span-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-brand-amber">Premium Mission Control</p>
          <h3 className="font-display font-black text-white text-xl leading-tight mt-1">Jarvis Executive Intelligence Cockpit</h3>
          <p className="text-white/55 text-sm mt-1">Live fusion of readiness, autonomy, legal posture, intelligence coverage, and tool reliability.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/80 hover:text-white"
        >
          <RefreshCw className={["w-3.5 h-3.5", loading ? 'animate-spin' : ''].join(' ')} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
        <div className={["rounded-xl border px-3 py-3", toneClass].join(' ')}>
          <p className="text-[10px] uppercase tracking-[0.12em] opacity-75">Mission Score</p>
          <p className="text-2xl font-black mt-1">{payload?.missionScore ?? '—'}/100</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Jarvis Brain</p>
          <p className="text-sm font-bold mt-1">{payload?.readiness?.engine || 'unknown'}</p>
          <p className="text-xs text-white/55 mt-0.5">{payload?.readiness?.full_capacity ? 'Full capacity' : 'Reduced capacity'}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Autonomy Level</p>
          <p className="text-sm font-bold mt-1">{payload?.autonomy?.autonomy_level || 'L?'}</p>
          <p className="text-xs text-white/55 mt-0.5">{payload?.autonomy?.autonomy_label || 'No protected status yet'}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Legal Readiness</p>
          <p className="text-sm font-bold mt-1">{payload?.legalScore?.legal_score?.value ?? '—'}/100</p>
          <p className="text-xs text-white/55 mt-0.5">{payload?.legalScore?.legal_score?.risk_band || 'pending'} risk band</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Tech Queue</p>
          <p className="text-sm font-bold mt-1">{payload?.techQueue?.queue_count ?? '—'} high priority</p>
          <p className="text-xs text-white/55 mt-0.5">{payload?.techQueue?.staleness_hours != null ? `${payload.techQueue.staleness_hours}h stale` : 'staleness unknown'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-3">
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber">Coverage Map</p>
          <p className="text-xs text-white/65 mt-1">
            {payload?.capabilityCoverage
              ? `L1 ${payload.capabilityCoverage.l1} · L2 ${payload.capabilityCoverage.l2} · L3 ${payload.capabilityCoverage.l3} · L4 ${payload.capabilityCoverage.l4} (${payload.capabilityCoverage.total} total capabilities)`
              : 'Protected intelligence map unavailable in this session.'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber">Reliability</p>
          <p className="text-xs text-white/65 mt-1">
            {payload?.metrics?.jarvis?.latency?.p95_ms != null
              ? `p95 latency ${payload.metrics.jarvis.latency.p95_ms}ms · tool failure ${(payload.metrics.jarvis.tool_calls?.failure_rate_pct ?? 0).toFixed(1)}%`
              : 'Jarvis metrics require protected auth.'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-amber">Blockers</p>
          {Array.isArray(payload?.blockers) && payload.blockers.length > 0 ? (
            <div className="mt-1 space-y-1">
              {payload.blockers.slice(0, 3).map((b) => (
                <p key={b} className="text-xs text-red-200">• {b}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-200 mt-1">No blockers detected.</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickOpsPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => dispatchJarvisPrompt(prompt)}
            className="rounded-full border border-brand-amber/35 bg-brand-amber/10 px-3 py-1.5 text-xs font-semibold text-brand-amber hover:bg-brand-amber/20"
          >
            {prompt.slice(0, 60)}...
          </button>
        ))}
      </div>
    </div>
  )
}

function PremiumIntelRibbon({ activeTab }) {
  const [loading, setLoading] = useState(false)
  const [intel, setIntel] = useState(null)

  const openJarvisWithPrompt = useCallback((prompt) => {
    try {
      window.dispatchEvent(new CustomEvent('cc:jarvis-prefill', { detail: { prompt } }))
      window.dispatchEvent(new CustomEvent('cc:open-jarvis-drawer'))
    } catch {
      // no-op
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [preflight, readiness, leads, jobs, estimates, tech, anomalies] = await Promise.allSettled([
        api.dashboardPreflight(),
        api.jarvisReadiness(),
        api.listRecentOperationalLeads(80),
        api.listJobs(),
        api.listEstimates(),
        api.getTechIntelligenceQueue({ limit: 8, min_priority: 'high' }),
        api.getAnomalies(false),
      ])

      const preflightData = preflight.status === 'fulfilled' ? preflight.value : null
      const readinessData = readiness.status === 'fulfilled' ? readiness.value : null
      const leadsCount = leads.status === 'fulfilled' && Array.isArray(leads.value) ? leads.value.length : null
      const jobsCount = jobs.status === 'fulfilled' && Array.isArray(jobs.value) ? jobs.value.length : null
      const estimatesCount = estimates.status === 'fulfilled' && Array.isArray(estimates.value) ? estimates.value.length : null
      const techCount = tech.status === 'fulfilled' ? Number(tech.value?.queue_count || 0) : null
      const anomaliesCount = anomalies.status === 'fulfilled' && Array.isArray(anomalies.value?.anomalies) ? anomalies.value.anomalies.length : null

      const score = (() => {
        let s = 100
        if (!readinessData?.full_capacity) s -= 18
        if (Array.isArray(readinessData?.blockers)) s -= Math.min(18, readinessData.blockers.length * 4)
        if (preflightData?.jarvis?.full_capacity === false) s -= 12
        if ((techCount ?? 0) > 5) s -= 8
        if ((anomaliesCount ?? 0) > 0) s -= 8
        return Math.max(0, s)
      })()

      setIntel({
        preflight: preflightData,
        readiness: readinessData,
        leadsCount,
        jobsCount,
        estimatesCount,
        techCount,
        anomaliesCount,
        score,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 90000)
    return () => clearInterval(timer)
  }, [refresh])

  const tabPrompts = {
    jarvis: 'Give me the highest-priority executive briefing and assign actions for the next 4 hours.',
    'richmond-grid': 'Analyze geospatial priorities and tell me where we should deploy crews first.',
    kpi: 'Audit KPI anomalies and give me exact actions to improve close rate and response time today.',
    crm: 'Prioritize leads by urgency and produce a call/email attack plan with scripts.',
    ops: 'Find bottlenecks across jobs and dispatch, then propose a same-day recovery plan.',
    'civil-intel': 'Evaluate legal and contractor risk across active projects and rank exposure by severity.',
    integrations: 'Identify integration blockers and output the minimum steps to full Jarvis capacity.',
    'search-pulse': 'Summarize search and ads opportunities likely to generate qualified leads this week.',
    dispatch: 'Optimize dispatch order and travel efficiency for current routes and job windows.',
    thermal: 'Assess thermal risk for active paving windows and recommend schedule adjustments.',
    drone: 'Summarize drone intelligence gaps and suggest inspections with highest ROI first.',
    lidar: 'Prioritize LiDAR scan opportunities that will improve estimate accuracy this week.',
    roller: 'Assess compaction telemetry risk and propose proactive QC interventions.',
  }

  const scoreTone = (intel?.score ?? 0) >= 85 ? 'text-emerald-200 border-emerald-300/40 bg-emerald-300/10' : (intel?.score ?? 0) >= 65 ? 'text-amber-100 border-amber-300/40 bg-amber-300/10' : 'text-red-100 border-red-300/40 bg-red-300/10'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-brand-amber">Premium Intelligence Layer</p>
          <h3 className="font-display font-bold text-white text-base mt-1">Elite Ops Ribbon</h3>
          <p className="text-white/55 text-xs mt-1">Every tab now runs with live strategic scoring plus an instant Jarvis action bridge.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openJarvisWithPrompt(tabPrompts[activeTab] || tabPrompts.jarvis)}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-amber/35 bg-brand-amber/10 px-3 py-2 text-xs font-semibold text-brand-amber hover:bg-brand-amber/20"
          >
            <Bot className="w-3.5 h-3.5" /> Deploy Elite Briefing
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/80 hover:text-white"
          >
            <RefreshCw className={["w-3.5 h-3.5", loading ? 'animate-spin' : ''].join(' ')} /> Sync
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mt-3">
        <div className={["rounded-lg border px-2.5 py-2", scoreTone].join(' ')}>
          <p className="text-[10px] uppercase tracking-[0.12em] opacity-80">Ops Score</p>
          <p className="text-base font-black mt-0.5">{intel?.score ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Leads</p>
          <p className="text-base font-black text-white mt-0.5">{intel?.leadsCount ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Jobs</p>
          <p className="text-base font-black text-white mt-0.5">{intel?.jobsCount ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Estimates</p>
          <p className="text-base font-black text-white mt-0.5">{intel?.estimatesCount ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Tech Queue</p>
          <p className="text-base font-black text-white mt-0.5">{intel?.techCount ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Ads Alerts</p>
          <p className="text-base font-black text-white mt-0.5">{intel?.anomaliesCount ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">Jarvis</p>
          <p className="text-sm font-black text-white mt-1">{intel?.readiness?.full_capacity ? 'Full' : 'Reduced'}</p>
        </div>
      </div>
    </div>
  )
}

function JarvisPanel() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
      <JarvisMissionControl />
      {/* Chat — biggest panel, takes 2 cols on xl, 2 cols on 2xl */}
      <div className="xl:col-span-2 2xl:col-span-2 space-y-4 md:space-y-5">
        <JarvisChat />
      </div>
      {/* Voice ops column */}
      <div className="space-y-4 md:space-y-5">
        <HeyJarvisWakeWord />
        <SLABreachAlarmPanel />
      </div>
      {/* Autonomy + Activity column (collapses under chat at xl) */}
      <div className="space-y-4 md:space-y-5">
        <JarvisAutonomy />
        <JarvisActivityFeed />
      </div>
    </div>
  )
}

// ── Integrations Panel: owner-only key paste UI ─────────────────────────────
// Groups managed keys by provider, masks sensitive values, supports inline
// edit + save + live "test connection" probes against the runtime store.
const INTEGRATION_GROUPS = [
  {
    id: 'jarvis',
    title: 'Jarvis Brain (Claude)',
    desc: 'Anthropic Claude powers Jarvis chat + tool use.',
    provider: 'anthropic',
    keys: [
      { name: 'ANTHROPIC_API_KEY', label: 'Anthropic API key', placeholder: 'sk-ant-…' },
      { name: 'ANTHROPIC_MODEL',   label: 'Model (optional)',  placeholder: 'claude-3-5-sonnet-latest' },
    ],
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'tavily',
    title: 'Web Search (Tavily)',
    desc: 'Free 1k searches/mo. Powers Jarvis live web look-ups.',
    provider: 'tavily',
    keys: [
      { name: 'TAVILY_API_KEY',     label: 'Tavily API key',  placeholder: 'tvly-…' },
      { name: 'TAVILY_MAX_RESULTS', label: 'Max results',     placeholder: '5' },
    ],
    helpUrl: 'https://app.tavily.com/',
  },
  {
    id: 'vapi',
    title: 'Voice Calling (Vapi)',
    desc: 'Lets Jarvis place real outbound phone calls.',
    provider: 'vapi',
    keys: [
      { name: 'VAPI_API_KEY',          label: 'Vapi API key',         placeholder: '…' },
      { name: 'VAPI_PHONE_NUMBER_ID',  label: 'Phone Number ID' },
      { name: 'VAPI_ASSISTANT_ID',     label: 'Assistant ID' },
    ],
    helpUrl: 'https://dashboard.vapi.ai/',
  },
  {
    id: 'twilio',
    title: 'SMS Verify (Twilio)',
    desc: 'Lead phone verification + admin 2FA fallback. Rotate token from Twilio Console after pasting.',
    provider: 'twilio',
    keys: [
      { name: 'TWILIO_ACCOUNT_SID',         label: 'Account SID',  placeholder: 'AC…' },
      { name: 'TWILIO_AUTH_TOKEN',          label: 'Auth token' },
      { name: 'TWILIO_VERIFY_SERVICE_SID',  label: 'Verify Service SID', placeholder: 'VA…' },
      { name: 'ADMIN_2FA_PHONE',            label: 'Admin 2FA phone (E.164)', placeholder: '+18045550100' },
    ],
    helpUrl: 'https://console.twilio.com/',
  },
  {
    id: 'sendgrid',
    title: 'Email (SendGrid)',
    desc: 'Transactional email — admin lead alerts, customer follow-ups.',
    provider: 'sendgrid',
    keys: [
      { name: 'SENDGRID_API_KEY',   label: 'SendGrid API key', placeholder: 'SG.…' },
      { name: 'SENDGRID_FROM_EMAIL',label: 'From email (verified sender)' },
      { name: 'SENDGRID_FROM_NAME', label: 'From name' },
      { name: 'ADMIN_NOTIFY_EMAIL', label: 'Admin notification recipient' },
    ],
    helpUrl: 'https://app.sendgrid.com/settings/api_keys',
  },
  {
    id: 'google',
    title: 'Google Suite (Ads / Search Console / GA4 / Maps)',
    desc: 'Ads tuning, organic-search insight, analytics, geocoding, Trends, PageSpeed. Used by Live Search Pulse + ad budget logic.',
    provider: 'google',
    keys: [
      { name: 'GA4_PROPERTY_ID',              label: 'GA4 Property ID' },
      { name: 'GA4_SERVICE_ACCOUNT_JSON',     label: 'GA4 service-account JSON', placeholder: 'paste raw JSON or base64' },
      { name: 'GSC_SITE_URL',                 label: 'Search Console site URL', placeholder: 'sc-domain:jwordenasphaltpaving.com' },
      { name: 'GSC_SERVICE_ACCOUNT_JSON',     label: 'GSC service-account JSON', placeholder: 'paste raw JSON or base64' },
      { name: 'GOOGLE_ADS_DEVELOPER_TOKEN',   label: 'Google Ads developer token' },
      { name: 'GOOGLE_ADS_REFRESH_TOKEN',     label: 'Google Ads OAuth refresh token' },
      { name: 'GOOGLE_ADS_CUSTOMER_ID',       label: 'Google Ads customer ID', placeholder: '123-456-7890' },
      { name: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', label: 'Login customer ID (MCC, optional)' },
      { name: 'GOOGLE_ADS_SITE_DOMAIN',       label: 'Ads site domain' },
      { name: 'GOOGLE_MAPS_API_KEY',          label: 'Google Maps Platform key' },
      { name: 'GOOGLE_PAGESPEED_API_KEY',     label: 'PageSpeed Insights key' },
      { name: 'SERPAPI_KEY',                  label: 'SerpAPI key (live SERP + heatmap)' },
      { name: 'GOOGLE_TRENDS_GEO',            label: 'Trends geo (default US-VA)', placeholder: 'US-VA' },
      { name: 'SEARCH_PULSE_TERMS',           label: 'Tracked terms (comma)', placeholder: 'asphalt paving richmond, sealcoating midlothian' },
    ],
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'company',
    title: 'Company Info',
    desc: 'Used in emails, schema.org, sitemaps.',
    provider: null,
    keys: [
      { name: 'COMPANY_PHONE',   label: 'Phone' },
      { name: 'COMPANY_EMAIL',   label: 'Email' },
      { name: 'COMPANY_WEBSITE', label: 'Website' },
      { name: 'COMPANY_ADDRESS', label: 'Address' },
    ],
  },
  {
    id: 'wearables',
    title: 'Crew Wearables (Health Monitoring)',
    desc: 'Per-provider HMAC secrets + alert thresholds. Webhook URL: POST /api/v1/wearables/{provider}/webhook with X-Wearable-Signature: sha256=...',
    provider: null,
    keys: [
      { name: 'WEARABLE_APPLE_HEALTH_SECRET', label: 'Apple HealthKit secret' },
      { name: 'WEARABLE_FITBIT_SECRET',       label: 'Fitbit secret' },
      { name: 'WEARABLE_GARMIN_SECRET',       label: 'Garmin secret' },
      { name: 'WEARABLE_WHOOP_SECRET',        label: 'Whoop secret' },
      { name: 'WEARABLE_OURA_SECRET',         label: 'Oura secret' },
      { name: 'WEARABLE_HR_SPIKE_BPM',        label: 'HR spike (bpm)', placeholder: '165' },
      { name: 'WEARABLE_HR_SUSTAINED_BPM',    label: 'HR sustained 5min (bpm)', placeholder: '145' },
      { name: 'WEARABLE_SPO2_LOW',            label: 'SpO₂ warning (%)', placeholder: '92' },
      { name: 'WEARABLE_SPO2_CRITICAL',       label: 'SpO₂ critical (%)', placeholder: '88' },
      { name: 'WEARABLE_SKIN_TEMP_HIGH_F',    label: 'Skin temp high (°F)', placeholder: '100.4' },
      { name: 'WEARABLE_HRV_LOW_MS',          label: 'HRV low (ms)', placeholder: '25' },
    ],
    helpUrl: null,
  },
  {
    id: 'license',
    title: 'License Tier (Owner-only)',
    desc: 'Controls which premium features are visible. owner = master deployment, premium = licensee, lite = stripped-down.',
    provider: null,
    keys: [
      { name: 'LICENSE_TIER', label: 'Tier (owner | premium | lite)', placeholder: 'owner' },
    ],
  },
]

function SearchPulsePanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const refresh = async (force = false) => {
    setLoading(true); setErr(null)
    try {
      const res = await api.searchPulseSnapshot(force)
      setData(res)
    } catch (e) {
      setErr(e?.message || 'Failed to load')
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh(false) }, [])

  const cells = data?.hotspots || []
  const W = 720, H = 360
  const lat = { min: 36.7, max: 38.5 }
  const lng = { min: -78.6, max: -75.8 }
  const xy = (la, ln) => ({
    x: ((ln - lng.min) / (lng.max - lng.min)) * W,
    y: H - ((la - lat.min) / (lat.max - lat.min)) * H,
  })
  const heatColor = (h) => {
    const r = Math.round(255 * Math.min(1, h * 1.4))
    const g = Math.round(180 * (1 - h))
    return `rgba(${r},${g},40,0.75)`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-brand-navy">Live Search Pulse — Virginia</h2>
          <p className="text-sm text-brand-charcoal/70">SerpAPI snapshot of paid + organic competition by metro. Heat = ad density × organic count. 5-min cache.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refresh(false)} disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-navy text-white text-sm hover:bg-brand-navy/90 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => refresh(true)} disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-brand-navy/20 text-sm hover:bg-brand-navy/5">Force</button>
        </div>
      </div>

      {err && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{err}</div>}
      {data && data.ok === false && (
        <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200">
          {data.reason || 'SerpAPI not configured'} — paste SERPAPI_KEY in the Integrations tab.
        </div>
      )}

      <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
        <div className="text-xs text-brand-charcoal/60 mb-2">Tracked terms: {(data?.terms || []).join(' · ') || '—'}</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
          <text x="10" y="20" className="fill-slate-400 text-[10px]">VA hotspots</text>
          {cells.map((c) => {
            const p = xy(c.lat, c.lng)
            const r = 14 + (c.heat || 0) * 28
            return (
              <g key={c.id}>
                <circle cx={p.x} cy={p.y} r={r} fill={heatColor(c.heat || 0)} stroke="#0f1f3d" strokeWidth="1" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" className="fill-white text-[10px] font-bold">
                  {Math.round((c.heat || 0) * 100)}
                </text>
                <text x={p.x} y={p.y + r + 12} textAnchor="middle" className="fill-slate-700 text-[10px]">
                  {c.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cells.map((c) => (
          <div key={c.id} className="rounded-lg border border-brand-navy/10 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-brand-navy">{c.name}</div>
              <div className="text-xs px-2 py-0.5 rounded-full"
                   style={{ background: heatColor(c.heat || 0), color: '#fff' }}>
                heat {Math.round((c.heat || 0) * 100)}
              </div>
            </div>
            <ul className="mt-2 space-y-1">
              {(c.terms || []).map((t, i) => (
                <li key={i} className="text-xs text-brand-charcoal/80">
                  <span className="font-medium">{t.term}</span>
                  {t.ok
                    ? <> — ads {t.ads}, organic {t.organic}{t.top_title ? ` · ${t.top_title.slice(0,60)}` : ''}</>
                    : <span className="text-red-600"> — {t.detail || 'error'}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function RollerPanel() {
  const [snap, setSnap] = useState(null)
  const [activeId, setActiveId] = useState('')
  const [detail, setDetail] = useState(null)
  const [err, setErr] = useState('')

  const reload = async () => {
    try { setSnap(await api.rollerSnapshot()) } catch (e) { setErr(e.message || 'failed') }
  }
  useEffect(() => {
    reload()
    const t = setInterval(reload, 5000)
    return () => clearInterval(t)
  }, [])

  const open = async (sid) => {
    setActiveId(sid)
    try { setDetail(await api.rollerSession(sid)) } catch (e) { setErr(e.message || 'failed') }
  }

  const cells = detail?.cells ? Object.entries(detail.cells) : []
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Roller Compaction Telemetry</h2>
        <p className="text-white/60 text-sm">
          State: <code className="text-white/80">{snap?.state_path || '—'}</code> · Cell size: ~{snap?.cell_meters || 3} m · Live polling 5s
        </p>
        <p className="text-white/50 text-xs">Phone POSTs to <code>/api/v1/roller/start|sample|end</code> with a <code>session_id</code>; if <code>ROLLER_INGEST_KEY</code> is set, include header <code>X-Roller-Key</code>.</p>
      </div>
      {err && <div className="text-red-300 text-sm">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="font-semibold text-white text-sm mb-2">Sessions ({snap?.sessions?.length || 0})</div>
          <div className="space-y-1">
            {(snap?.sessions||[]).map(s => (
              <button key={s.session_id} type="button" onClick={()=>open(s.session_id)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${activeId===s.session_id?'bg-brand-amber text-brand-navy font-bold':'bg-white/5 text-white/80 hover:bg-white/10'}`}>
                <div>{s.session_id} {s.ended_at && <span className="text-white/40">(ended)</span>}</div>
                <div className="text-[10px] opacity-70">{s.samples} samples · {s.cells} cells {s.operator?`· ${s.operator}`:''}</div>
              </button>
            ))}
            {(!snap?.sessions||snap.sessions.length===0) && <div className="text-white/40 text-xs">No active sessions.</div>}
          </div>
        </div>
        <div className="md:col-span-2">
          {detail ? (
            <div className="space-y-3">
              <div className="bg-white/5 rounded p-3 text-sm text-white">
                <div className="font-semibold">{detail.session_id}</div>
                <div className="text-white/70 text-xs">job: {detail.job_id || '—'} · operator: {detail.operator || '—'} · mix: {detail.mix || '—'}</div>
                {detail.summary && (
                  <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                    <div className="bg-white/5 rounded p-2"><div className="text-white/50">Cells</div><div className="text-white font-bold text-base">{detail.summary.cells}</div></div>
                    <div className="bg-white/5 rounded p-2"><div className="text-white/50">Max pass</div><div className="text-white font-bold text-base">{detail.summary.max_pass}</div></div>
                    <div className="bg-white/5 rounded p-2"><div className="text-white/50">Avg pass</div><div className="text-white font-bold text-base">{detail.summary.avg_pass}</div></div>
                    <div className="bg-white/5 rounded p-2"><div className="text-white/50">Avg IRI</div><div className="text-white font-bold text-base">{detail.summary.avg_iri}</div></div>
                  </div>
                )}
              </div>
              <div className="font-semibold text-white text-sm">Cells ({cells.length})</div>
              <div className="space-y-1 max-h-96 overflow-auto">
                {cells.slice(0, 200).map(([cellKey, c]) => (
                  <div key={cellKey} className="bg-white/5 rounded px-3 py-1.5 text-xs text-white/80 flex items-center justify-between">
                    <span className="font-mono">{cellKey}</span>
                    <span>passes <b className="text-white">{c.passes}</b> · iri {c.iri_proxy ?? 0} · g {c.last_g ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-white/40 text-xs">Select a session to inspect compaction state.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function LidarPanel() {
  const [snap, setSnap] = useState(null)
  const [activeBucket, setActiveBucket] = useState('')
  const [scans, setScans] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState({ job_id: '', parcel_id: '', operator: '', gps_lat: '', gps_lng: '', notes: '' })
  const [files, setFiles] = useState([])
  const [matchProbe, setMatchProbe] = useState(null)

  const reload = async () => {
    try { setSnap(await api.lidarSnapshot()) } catch (e) { setErr(e.message || 'failed') }
  }
  useEffect(() => { reload() }, [])

  const loadScans = async (bucket) => {
    setActiveBucket(bucket)
    try { const r = await api.lidarScans(bucket); setScans(r.scans || []) } catch (e) { setErr(e.message || 'failed') }
  }

  const probe = async () => {
    if (!draft.gps_lat || !draft.gps_lng) return
    try { const r = await api.lidarMatch(draft.gps_lat, draft.gps_lng); setMatchProbe(r.match) } catch (e) { setErr(e.message || 'failed') }
  }

  const upload = async () => {
    if (files.length === 0) { setErr('attach at least one scan'); return }
    setBusy(true); setErr('')
    try {
      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        if (draft.job_id) fd.append('job_id', draft.job_id)
        if (draft.parcel_id) fd.append('parcel_id', draft.parcel_id)
        if (draft.operator) fd.append('operator', draft.operator)
        if (draft.gps_lat) fd.append('gps_lat', draft.gps_lat)
        if (draft.gps_lng) fd.append('gps_lng', draft.gps_lng)
        if (draft.notes) fd.append('notes', draft.notes)
        await api.lidarUpload(fd)
      }
      setFiles([])
      await reload()
      if (activeBucket) await loadScans(activeBucket)
    } catch (e) { setErr(e.message || 'upload failed') } finally { setBusy(false) }
  }

  const remove = async (sid) => {
    if (!window.confirm('Delete scan?')) return
    try { await api.lidarDeleteScan(activeBucket, sid); await reload(); await loadScans(activeBucket) }
    catch (e) { setErr(e.message || 'delete failed') }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">iPhone LiDAR Ingestion</h2>
        <p className="text-white/60 text-sm">
          Storage: <code className="text-white/80">{snap?.storage_path || '—'}</code> · Max {snap ? Math.round(snap.max_bytes / 1024 / 1024) : '?'} MB · Parcels loaded: {snap?.parcels_loaded ?? 0} · {snap?.total_scans || 0} scans total
        </p>
        {!snap?.parcel_registry && <p className="text-amber-300/80 text-xs">Set <code>PARCEL_REGISTRY_PATH</code> to a CSV (parcel_id,owner,address,lat,lng,acres) to auto-match GPS to parcel.</p>}
      </div>
      {err && <div className="text-red-300 text-sm">{err}</div>}

      <div className="bg-white/5 rounded-lg p-3 space-y-2">
        <div className="font-semibold text-white text-sm">Upload scan (USDZ / OBJ / PLY / GLB)</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <input value={draft.job_id} onChange={e=>setDraft(d=>({...d,job_id:e.target.value}))} placeholder="Job ID (opt)" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <input value={draft.parcel_id} onChange={e=>setDraft(d=>({...d,parcel_id:e.target.value}))} placeholder="Parcel ID (opt)" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <input value={draft.operator} onChange={e=>setDraft(d=>({...d,operator:e.target.value}))} placeholder="Operator" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <input value={draft.gps_lat} onChange={e=>setDraft(d=>({...d,gps_lat:e.target.value}))} placeholder="GPS lat" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <input value={draft.gps_lng} onChange={e=>setDraft(d=>({...d,gps_lng:e.target.value}))} placeholder="GPS lng" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <button type="button" onClick={probe} className="px-2 py-1.5 rounded bg-white/10 text-white text-xs hover:bg-white/20">Probe parcel</button>
        </div>
        {matchProbe && <div className="text-emerald-300 text-xs">Match: {matchProbe.parcel_id} · {matchProbe.address || matchProbe.owner} · {matchProbe.distance_mi} mi</div>}
        <input value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))} placeholder="Notes" className="bg-white/10 text-white text-sm rounded px-2 py-1.5 w-full" />
        <input type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))} className="text-white text-xs" />
        <div className="text-white/60 text-xs">{files.length} file(s) staged</div>
        <button type="button" onClick={upload} disabled={busy || files.length===0} className="px-4 py-1.5 rounded bg-brand-amber text-brand-navy font-semibold text-sm hover:opacity-90 disabled:opacity-50">{busy?'Uploading…':'Upload scan'}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="font-semibold text-white text-sm mb-2">Buckets ({snap?.buckets?.length || 0})</div>
          <div className="space-y-1">
            {(snap?.buckets||[]).map(b => (
              <button key={b.bucket} type="button" onClick={()=>loadScans(b.bucket)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${activeBucket===b.bucket?'bg-brand-amber text-brand-navy font-bold':'bg-white/5 text-white/80 hover:bg-white/10'}`}>
                {b.bucket} · {b.count||0}
              </button>
            ))}
            {(!snap?.buckets||snap.buckets.length===0) && <div className="text-white/40 text-xs">No scans yet.</div>}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="font-semibold text-white text-sm mb-2">Scans{activeBucket?` for ${activeBucket}`:''} ({scans.length})</div>
          <div className="space-y-1">
            {scans.map(s=>(
              <div key={s.id} className="bg-white/5 rounded px-3 py-2 text-xs text-white/80 flex items-center justify-between">
                <div>
                  <span className="font-mono">{s.id}</span> · {s.filename} · {Math.round(s.bytes/1024)} KB
                  {s.gps_lat!=null && s.gps_lng!=null && <> · {s.gps_lat.toFixed(4)},{s.gps_lng.toFixed(4)}</>}
                  {s.matched_parcel && <span className="text-emerald-300"> · matched {s.matched_parcel.parcel_id}</span>}
                </div>
                <button type="button" onClick={()=>remove(s.id)} className="text-red-300 hover:text-red-200">Delete</button>
              </div>
            ))}
            {activeBucket && scans.length===0 && <div className="text-white/40 text-xs">No scans.</div>}
            {!activeBucket && <div className="text-white/40 text-xs">Select a bucket.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function DronePanel() {
  const [snap, setSnap] = useState(null)
  const [activeJob, setActiveJob] = useState('')
  const [captures, setCaptures] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState({ job_id: '', pilot: '', gps_lat: '', gps_lng: '', altitude_m: '', notes: '' })
  const [files, setFiles] = useState([])

  const reload = async () => {
    try {
      const s = await api.droneSnapshot()
      setSnap(s)
    } catch (e) { setErr(e.message || 'failed') }
  }
  useEffect(() => { reload() }, [])

  const loadCaps = async (jid) => {
    setActiveJob(jid)
    try {
      const r = await api.droneCaptures(jid)
      setCaptures(r.captures || [])
    } catch (e) { setErr(e.message || 'failed') }
  }

  const upload = async () => {
    if (!draft.job_id || files.length === 0) { setErr('job_id + at least one file required'); return }
    setBusy(true); setErr('')
    try {
      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        fd.append('job_id', draft.job_id)
        if (draft.pilot) fd.append('pilot', draft.pilot)
        if (draft.gps_lat) fd.append('gps_lat', draft.gps_lat)
        if (draft.gps_lng) fd.append('gps_lng', draft.gps_lng)
        if (draft.altitude_m) fd.append('altitude_m', draft.altitude_m)
        if (draft.notes) fd.append('notes', draft.notes)
        await api.droneUpload(fd)
      }
      setFiles([])
      await reload()
      if (activeJob === draft.job_id) await loadCaps(draft.job_id)
    } catch (e) {
      setErr(e.message || 'upload failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (cid) => {
    if (!window.confirm('Delete this capture?')) return
    try {
      await api.droneDeleteCapture(activeJob, cid)
      await reload()
      await loadCaps(activeJob)
    } catch (e) { setErr(e.message || 'delete failed') }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Drone Capture Pipeline</h2>
        <p className="text-white/60 text-sm">
          Storage: <code className="text-white/80">{snap?.storage_path || '—'}</code> · Max {snap ? Math.round(snap.max_bytes / 1024 / 1024) : '?'} MB / file · {snap?.total_captures || 0} captures total
        </p>
      </div>
      {err && <div className="text-red-300 text-sm">{err}</div>}

      <div className="bg-white/5 rounded-lg p-3 space-y-2">
        <div className="font-semibold text-white text-sm">Upload new capture</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <input value={draft.job_id} onChange={e=>setDraft(d=>({...d,job_id:e.target.value}))} placeholder="Job ID" className="bg-white/10 text-white text-sm rounded px-2 py-1.5 col-span-2" />
          <input value={draft.pilot} onChange={e=>setDraft(d=>({...d,pilot:e.target.value}))} placeholder="Pilot" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <input value={draft.gps_lat} onChange={e=>setDraft(d=>({...d,gps_lat:e.target.value}))} placeholder="Lat" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <input value={draft.gps_lng} onChange={e=>setDraft(d=>({...d,gps_lng:e.target.value}))} placeholder="Lng" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <input value={draft.altitude_m} onChange={e=>setDraft(d=>({...d,altitude_m:e.target.value}))} placeholder="Alt (m)" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          <input value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))} placeholder="Notes" className="bg-white/10 text-white text-sm rounded px-2 py-1.5 col-span-2 md:col-span-6" />
        </div>
        <input type="file" multiple accept="image/*,video/*" onChange={e=>setFiles(Array.from(e.target.files||[]))} className="text-white text-xs" />
        <div className="text-white/60 text-xs">{files.length} file(s) staged</div>
        <button type="button" onClick={upload} disabled={busy || !draft.job_id || files.length===0} className="px-4 py-1.5 rounded bg-brand-amber text-brand-navy font-semibold text-sm hover:opacity-90 disabled:opacity-50">{busy?'Uploading…':'Upload'}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="font-semibold text-white text-sm mb-2">Jobs ({snap?.jobs?.length || 0})</div>
          <div className="space-y-1">
            {(snap?.jobs||[]).map(j => (
              <button key={j.job_id} type="button" onClick={()=>loadCaps(j.job_id)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${activeJob===j.job_id?'bg-brand-amber text-brand-navy font-bold':'bg-white/5 text-white/80 hover:bg-white/10'}`}>
                {j.job_id} · {j.count||0}
              </button>
            ))}
            {(!snap?.jobs||snap.jobs.length===0) && <div className="text-white/40 text-xs">No drone jobs yet.</div>}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="font-semibold text-white text-sm mb-2">Captures{activeJob?` for ${activeJob}`:''} ({captures.length})</div>
          <div className="space-y-1">
            {captures.map(c=>(
              <div key={c.id} className="bg-white/5 rounded px-3 py-2 text-xs text-white/80 flex items-center justify-between">
                <div>
                  <span className="font-mono">{c.id}</span> · {c.filename} · {Math.round(c.bytes/1024)} KB · {c.content_type}
                  {c.gps_lat!=null && c.gps_lng!=null && <> · {c.gps_lat.toFixed(4)},{c.gps_lng.toFixed(4)}</>}
                  {c.altitude_m!=null && <> · {c.altitude_m}m</>}
                </div>
                <button type="button" onClick={()=>remove(c.id)} className="text-red-300 hover:text-red-200">Delete</button>
              </div>
            ))}
            {activeJob && captures.length===0 && <div className="text-white/40 text-xs">No captures.</div>}
            {!activeJob && <div className="text-white/40 text-xs">Select a job to view captures.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ThermalPanel() {
  const [params, setParams] = useState({ lat: 37.5407, lng: -77.4360, mix_temp_f: 290, lift_in: 2, target_breakdown_f: 240, target_finish_f: 175 })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const fetchWindow = async () => {
    setLoading(true); setErr('')
    try {
      const r = await api.thermalWindow(params)
      setData(r)
    } catch (e) {
      setErr(e.message || 'failed')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchWindow() }, [])

  const setP = (k, v) => setParams(p => ({ ...p, [k]: Number(v) || v }))
  const statusColor = (s) => s === 'good' ? 'bg-emerald-500/20 text-emerald-200' : s === 'tight' ? 'bg-amber-500/20 text-amber-200' : 'bg-red-500/20 text-red-200'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Asphalt Lay-Down Window</h2>
          <p className="text-white/60 text-sm">NOAA hourly forecast + Chadbourn-style cooling model. Tells you when the mat will hit 175°F.</p>
        </div>
        <button type="button" onClick={fetchWindow} disabled={loading} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/20">{loading?'Loading…':'Refresh'}</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-white/5 rounded-lg p-3">
        {[
          ['lat','Latitude'],['lng','Longitude'],
          ['mix_temp_f','Mix °F'],['lift_in','Lift in'],
          ['target_breakdown_f','Breakdown °F'],['target_finish_f','Finish °F'],
        ].map(([k,label])=>(
          <label key={k} className="text-xs text-white/60">
            {label}
            <input type="number" step="0.0001" value={params[k]} onChange={e=>setP(k,e.target.value)} className="mt-0.5 w-full bg-white/10 text-white text-sm rounded px-2 py-1.5" />
          </label>
        ))}
      </div>

      {err && <div className="text-red-300 text-sm">{err}</div>}

      {data?.ok === false && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-red-200 text-sm">{data.error}</div>
      )}

      {data?.ok && (
        <>
          {data.best_window ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-3 text-emerald-100">
              <div className="font-bold">Recommended pour window</div>
              <div className="text-sm">{new Date(data.best_window.start).toLocaleString()} → {new Date(data.best_window.end).toLocaleString()}</div>
              <div className="text-xs text-white/60 mt-1">avg air {data.best_window.avg_air_f}°F · avg wind {data.best_window.avg_wind_mph} mph</div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-amber-100 text-sm">No 3-hour "good" window in the next 48h. Consider warming the mix or thicker lift.</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-white/80">
              <thead className="text-white/50">
                <tr>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Air °F</th>
                  <th className="text-left p-2">Wind</th>
                  <th className="text-left p-2">Sky</th>
                  <th className="text-left p-2">Min → Breakdown</th>
                  <th className="text-left p-2">Min → Finish</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.hourly.slice(0, 24).map((h, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="p-2">{new Date(h.startTime).toLocaleString([], { weekday: 'short', hour: 'numeric' })}</td>
                    <td className="p-2">{h.air_temp_f}</td>
                    <td className="p-2">{h.wind_mph} mph</td>
                    <td className="p-2 text-white/60">{h.sky}</td>
                    <td className="p-2">{h.minutes_to_breakdown ?? '—'}</td>
                    <td className="p-2 font-semibold">{h.minutes_to_finish ?? '—'}</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded ${statusColor(h.status)}`}>{h.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function DispatchPanel() {
  const [snap, setSnap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('jobs')
  const [drafts, setDrafts] = useState({ truck: {}, driver: {}, job: {} })
  const [busy, setBusy] = useState(false)
  const [assignFor, setAssignFor] = useState(null)
  const [assignResult, setAssignResult] = useState(null)

  const reload = async () => {
    setLoading(true); setErr('')
    try {
      const data = await api.dispatchSnapshot()
      setSnap(data)
    } catch (e) {
      setErr(e.message || 'failed to load')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [])

  const submit = async (kind) => {
    const payload = drafts[kind]
    if (!payload || Object.keys(payload).length === 0) return
    setBusy(true)
    try {
      if (kind === 'truck')  await api.dispatchUpsertTruck(payload)
      if (kind === 'driver') await api.dispatchUpsertDriver(payload)
      if (kind === 'job')    await api.dispatchUpsertJob(payload)
      setDrafts(d => ({ ...d, [kind]: {} }))
      await reload()
    } catch (e) {
      setErr(e.message || 'save failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (kind, id) => {
    if (!window.confirm(`Delete this ${kind}?`)) return
    setBusy(true)
    try {
      if (kind === 'truck')  await api.dispatchDeleteTruck(id)
      if (kind === 'driver') await api.dispatchDeleteDriver(id)
      if (kind === 'job')    await api.dispatchDeleteJob(id)
      await reload()
    } catch (e) {
      setErr(e.message || 'delete failed')
    } finally {
      setBusy(false)
    }
  }

  const runAssign = async (jobId) => {
    setAssignFor(jobId); setAssignResult(null)
    try {
      const r = await api.dispatchAssign(jobId)
      setAssignResult(r)
    } catch (e) {
      setAssignResult({ error: e.message || 'failed' })
    }
  }

  const setDraft = (kind, k, v) =>
    setDrafts(d => ({ ...d, [kind]: { ...d[kind], [k]: v } }))

  if (loading && !snap) {
    return <div className="text-white/70 p-6">Loading dispatch board…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dump-Truck Dispatch</h2>
          <p className="text-white/60 text-sm">
            {snap?.maps_configured
              ? 'Google Maps drive-time enabled — assignments use real road distance.'
              : 'Google Maps key missing — assignments use straight-line distance fallback.'}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/20"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {err && <div className="text-red-300 text-sm">{err}</div>}

      <div className="flex gap-2 border-b border-white/10">
        {['jobs', 'trucks', 'drivers'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold ${tab === t ? 'text-brand-amber border-b-2 border-brand-amber' : 'text-white/60 hover:text-white'}`}
          >
            {t.toUpperCase()} ({snap?.[t]?.length || 0})
          </button>
        ))}
      </div>

      {tab === 'trucks' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-white/5 rounded-lg p-3">
            <input value={drafts.truck.name||''} onChange={e=>setDraft('truck','name',e.target.value)} placeholder="Truck name (T-101)" className="bg-white/10 text-white text-sm rounded px-2 py-1.5 col-span-2" />
            <input value={drafts.truck.plate||''} onChange={e=>setDraft('truck','plate',e.target.value)} placeholder="Plate" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.truck.capacity_tons||''} onChange={e=>setDraft('truck','capacity_tons',Number(e.target.value)||0)} placeholder="Tons" type="number" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.truck.lat||''} onChange={e=>setDraft('truck','lat',Number(e.target.value)||0)} placeholder="Lat" type="number" step="0.0001" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.truck.lng||''} onChange={e=>setDraft('truck','lng',Number(e.target.value)||0)} placeholder="Lng" type="number" step="0.0001" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <button type="button" onClick={()=>submit('truck')} disabled={busy} className="md:col-span-6 px-3 py-1.5 rounded bg-brand-amber text-brand-navy font-semibold text-sm hover:opacity-90 disabled:opacity-50">Add Truck</button>
          </div>
          <div className="space-y-1">
            {(snap?.trucks||[]).map(t=>(
              <div key={t.id} className="bg-white/5 rounded px-3 py-2 flex items-center justify-between text-sm text-white/90">
                <div><span className="font-semibold">{t.name}</span> · {t.plate||'no plate'} · {t.capacity_tons}T · status {t.status}</div>
                <button type="button" onClick={()=>remove('truck',t.id)} className="text-red-300 hover:text-red-200 text-xs">Delete</button>
              </div>
            ))}
            {(!snap?.trucks||snap.trucks.length===0) && <div className="text-white/50 text-sm">No trucks yet.</div>}
          </div>
        </div>
      )}

      {tab === 'drivers' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 bg-white/5 rounded-lg p-3">
            <input value={drafts.driver.name||''} onChange={e=>setDraft('driver','name',e.target.value)} placeholder="Driver name" className="bg-white/10 text-white text-sm rounded px-2 py-1.5 col-span-2" />
            <input value={drafts.driver.phone||''} onChange={e=>setDraft('driver','phone',e.target.value)} placeholder="Phone" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.driver.cdl_class||''} onChange={e=>setDraft('driver','cdl_class',e.target.value)} placeholder="CDL Class" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.driver.preferred_truck_id||''} onChange={e=>setDraft('driver','preferred_truck_id',e.target.value)} placeholder="Preferred truck id" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <button type="button" onClick={()=>submit('driver')} disabled={busy} className="md:col-span-5 px-3 py-1.5 rounded bg-brand-amber text-brand-navy font-semibold text-sm hover:opacity-90 disabled:opacity-50">Add Driver</button>
          </div>
          <div className="space-y-1">
            {(snap?.drivers||[]).map(d=>(
              <div key={d.id} className="bg-white/5 rounded px-3 py-2 flex items-center justify-between text-sm text-white/90">
                <div><span className="font-semibold">{d.name}</span> · {d.phone||'—'} · CDL {d.cdl_class||'?'} · status {d.status}</div>
                <button type="button" onClick={()=>remove('driver',d.id)} className="text-red-300 hover:text-red-200 text-xs">Delete</button>
              </div>
            ))}
            {(!snap?.drivers||snap.drivers.length===0) && <div className="text-white/50 text-sm">No drivers yet.</div>}
          </div>
        </div>
      )}

      {tab === 'jobs' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-white/5 rounded-lg p-3">
            <input value={drafts.job.site_name||''} onChange={e=>setDraft('job','site_name',e.target.value)} placeholder="Site name" className="bg-white/10 text-white text-sm rounded px-2 py-1.5 col-span-2" />
            <input value={drafts.job.address||''} onChange={e=>setDraft('job','address',e.target.value)} placeholder="Address" className="bg-white/10 text-white text-sm rounded px-2 py-1.5 col-span-2" />
            <input value={drafts.job.tons_needed||''} onChange={e=>setDraft('job','tons_needed',Number(e.target.value)||0)} placeholder="Tons needed" type="number" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.job.priority||''} onChange={e=>setDraft('job','priority',e.target.value)} placeholder="Priority (low/normal/high)" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.job.lat||''} onChange={e=>setDraft('job','lat',Number(e.target.value)||0)} placeholder="Lat" type="number" step="0.0001" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.job.lng||''} onChange={e=>setDraft('job','lng',Number(e.target.value)||0)} placeholder="Lng" type="number" step="0.0001" className="bg-white/10 text-white text-sm rounded px-2 py-1.5" />
            <input value={drafts.job.scheduled_start||''} onChange={e=>setDraft('job','scheduled_start',e.target.value)} placeholder="Start (YYYY-MM-DD HH:MM)" className="bg-white/10 text-white text-sm rounded px-2 py-1.5 col-span-2" />
            <button type="button" onClick={()=>submit('job')} disabled={busy} className="md:col-span-6 px-3 py-1.5 rounded bg-brand-amber text-brand-navy font-semibold text-sm hover:opacity-90 disabled:opacity-50">Add Job</button>
          </div>
          <div className="space-y-1">
            {(snap?.jobs||[]).map(j=>(
              <div key={j.id} className="bg-white/5 rounded px-3 py-2 text-sm text-white/90">
                <div className="flex items-center justify-between">
                  <div><span className="font-semibold">{j.site_name}</span> · {j.tons_needed}T · {j.priority} · {j.scheduled_start||'no time'}</div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={()=>runAssign(j.id)} className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/30">Recommend Crew</button>
                    <button type="button" onClick={()=>remove('job',j.id)} className="text-red-300 hover:text-red-200 text-xs">Delete</button>
                  </div>
                </div>
                {assignFor === j.id && assignResult && (
                  <div className="mt-2 ml-2 border-l-2 border-brand-amber/50 pl-3 space-y-1">
                    {assignResult.error && <div className="text-red-300 text-xs">{assignResult.error}</div>}
                    {(assignResult.ranked||[]).slice(0,3).map((r,idx)=>(
                      <div key={idx} className="text-xs">
                        <span className="font-bold text-brand-amber">#{idx+1}</span>{' '}
                        {r.truck.name} ({r.truck.capacity_tons}T) ·{' '}
                        driver: {r.driver?.name||'—'} ·{' '}
                        {r.drive_minutes!=null ? `${r.drive_minutes} min drive` : (r.miles!=null ? `${r.miles} mi` : 'no location')} ·{' '}
                        score {r.score}
                      </div>
                    ))}
                    {(!assignResult.ranked||assignResult.ranked.length===0) && !assignResult.error && (
                      <div className="text-white/50 text-xs">No active trucks available.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {(!snap?.jobs||snap.jobs.length===0) && <div className="text-white/50 text-sm">No jobs scheduled.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function IntegrationsPanel() {
  const [statusMap, setStatusMap] = useState({})
  const [tier, setTier] = useState('owner')
  const [features, setFeatures] = useState({})
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState({}) // {KEY_NAME: 'value being typed'}
  const [busy, setBusy] = useState({})     // {KEY_NAME: true}
  const [testResults, setTestResults] = useState({})  // {provider: {ok, detail}}
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [s, f] = await Promise.all([api.integrationsStatus(), api.getFeatures()])
      setStatusMap(s.keys || {})
      setTier(f.tier || 'owner')
      setFeatures(f.features || {})
    } catch (e) {
      setError(e.message || 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const onSave = async (name) => {
    const value = drafts[name] ?? ''
    setBusy((b) => ({ ...b, [name]: true }))
    try {
      const res = await api.integrationsPutKey(name, value)
      setStatusMap((m) => ({ ...m, [name]: res.status }))
      setDrafts((d) => { const n = { ...d }; delete n[name]; return n })
    } catch (e) {
      setError(`${name}: ${e.message}`)
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[name]; return n })
    }
  }

  const onClear = async (name) => {
    if (!window.confirm(`Clear ${name}? It will fall back to the env var (if any).`)) return
    setBusy((b) => ({ ...b, [name]: true }))
    try {
      const res = await api.integrationsPutKey(name, '')
      setStatusMap((m) => ({ ...m, [name]: res.status }))
    } catch (e) {
      setError(`${name}: ${e.message}`)
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[name]; return n })
    }
  }

  const onTest = async (provider) => {
    setTestResults((t) => ({ ...t, [provider]: { loading: true } }))
    try {
      const res = await api.integrationsTest(provider)
      setTestResults((t) => ({ ...t, [provider]: res }))
    } catch (e) {
      setTestResults((t) => ({ ...t, [provider]: { ok: false, error: e.message } }))
    }
  }

  if (loading && Object.keys(statusMap).length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-white/70 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading integrations…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="rounded-2xl border border-brand-amber/30 bg-gradient-to-br from-brand-navy to-[#0a1628] p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display font-bold text-xl">Integrations</h3>
            <p className="text-white/70 text-sm">
              Owner-only. Paste API keys here — services pick them up live, no redeploy.
              Sensitive values are stored on the server and shown masked.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              tier === 'owner' ? 'bg-brand-amber text-brand-navy' :
              tier === 'premium' ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/40' :
              'bg-white/10 text-white/70 border border-white/20'
            }`}>
              Tier: {tier}
            </span>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 border border-white/15"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-200 bg-red-500/10 border border-red-300/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Group cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {INTEGRATION_GROUPS.map((g) => {
          const tr = testResults[g.provider]
          return (
            <div key={g.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h4 className="font-display font-bold text-white text-lg">{g.title}</h4>
                  <p className="text-white/60 text-xs mt-1">{g.desc}</p>
                </div>
                {g.helpUrl && (
                  <a href={g.helpUrl} target="_blank" rel="noreferrer"
                     className="text-xs text-brand-amber hover:underline shrink-0">Get keys ↗</a>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {g.keys.map((k) => {
                  const meta = statusMap[k.name] || {}
                  const isSensitive = meta.sensitive
                  const draft = drafts[k.name]
                  const isDirty = draft !== undefined
                  const placeholder = isSensitive && meta.set
                    ? meta.preview || '••••'
                    : (k.placeholder || '')
                  return (
                    <div key={k.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-white/80 font-medium">
                          {k.label}
                          {meta.set && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                              meta.source === 'runtime' ? 'bg-emerald-500/20 text-emerald-200' :
                              meta.source === 'env'     ? 'bg-blue-500/20 text-blue-200' :
                              'bg-white/10 text-white/60'
                            }`}>
                              {meta.source}
                            </span>
                          )}
                        </label>
                        <code className="text-white/40 text-[10px]">{k.name}</code>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type={isSensitive ? 'password' : 'text'}
                          value={isDirty ? draft : (isSensitive ? '' : (meta.preview || ''))}
                          onChange={(e) => setDrafts((d) => ({ ...d, [k.name]: e.target.value }))}
                          placeholder={placeholder}
                          className="flex-1 px-3 py-2 rounded-md bg-black/30 border border-white/15 text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-amber"
                        />
                        <button
                          type="button"
                          onClick={() => onSave(k.name)}
                          disabled={!isDirty || busy[k.name]}
                          className="px-3 py-2 rounded-md bg-brand-amber text-brand-navy text-xs font-bold disabled:opacity-40 hover:brightness-110"
                        >
                          {busy[k.name] ? '…' : 'Save'}
                        </button>
                        {meta.source === 'runtime' && (
                          <button
                            type="button"
                            onClick={() => onClear(k.name)}
                            disabled={busy[k.name]}
                            className="px-2 py-2 rounded-md bg-red-500/20 text-red-200 text-xs border border-red-300/30 hover:bg-red-500/30 disabled:opacity-40"
                            title="Clear runtime value (env fallback remains)"
                          >Clear</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {g.provider && (
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => onTest(g.provider)}
                    disabled={tr?.loading}
                    className="text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 border border-white/15 inline-flex items-center gap-1"
                  >
                    {tr?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Test connection
                  </button>
                  {tr && !tr.loading && (
                    <span className={`text-xs ${tr.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                      {tr.ok ? '✓ ' : '✗ '}{tr.detail || tr.error || (tr.ok ? 'OK' : 'Failed')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Feature flag matrix */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h4 className="font-display font-bold text-white text-lg mb-3">Feature tier matrix</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(features).map(([name, enabled]) => (
            <div key={name} className={`px-3 py-2 rounded-md border text-xs flex items-center justify-between ${
              enabled ? 'bg-emerald-500/10 border-emerald-300/30 text-emerald-200'
                      : 'bg-white/5 border-white/10 text-white/50'
            }`}>
              <span>{name}</span>
              <span>{enabled ? '✓' : '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── PulseBar: 6-tile health strip across the top of every tab ───────────────
function PulseTile({ label, value, tone, icon: Icon, onClick }) {
  const toneRing = tone === 'good' ? 'border-emerald-300/40' : tone === 'warn' ? 'border-amber-300/40' : tone === 'bad' ? 'border-red-300/40' : 'border-white/15'
  const toneText = tone === 'good' ? 'text-emerald-200' : tone === 'warn' ? 'text-amber-200' : tone === 'bad' ? 'text-red-200' : 'text-white/70'
  return (
    <button
      type="button"
      onClick={onClick}
      className={['shrink-0 text-left rounded-xl border bg-white/[0.04] px-3 py-2 hover:bg-white/[0.07] transition-colors', toneRing].join(' ')}
    >
      <div className="flex items-center gap-2">
        <Icon className={['w-3.5 h-3.5', toneText].join(' ')} />
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</span>
      </div>
      <div className={['text-sm font-bold mt-0.5', toneText].join(' ')}>{value}</div>
    </button>
  )
}

function PulseBar({ onTabChange, onOpenJarvis }) {
  const [pulse, setPulse] = useState({
    jarvis: { label: 'Jarvis', value: '…', tone: 'idle' },
    leads:  { label: 'Today\u2019s Leads', value: '…', tone: 'idle' },
    jobs:   { label: 'Active Jobs', value: '…', tone: 'idle' },
    estim:  { label: 'Open Estimates', value: '…', tone: 'idle' },
    audit:  { label: 'Audit', value: '…', tone: 'idle' },
    auto:   { label: 'Autonomy', value: 'OFF', tone: 'idle' },
  })

  useEffect(() => {
    let cancelled = false
    const refreshAuto = () => {
      const s = readAutonomyState()
      const enabledCount = Object.values(s.domains || {}).filter(Boolean).length
      setPulse((p) => ({ ...p, auto: { label: 'Autonomy', value: s.master ? `ON · ${enabledCount}` : 'OFF', tone: s.master ? 'good' : 'idle' } }))
    }
    refreshAuto()
    const onAuto = () => refreshAuto()
    if (typeof window !== 'undefined') window.addEventListener('cc:autonomy-changed', onAuto)

    Promise.allSettled([
      api.jarvisStatus().catch(() => null),
      api.listRecentOperationalLeads(50).catch(() => null),
      api.listJobs().catch(() => null),
      api.listEstimates().catch(() => null),
      api.listAuditEvents({ limit: 5 }).catch(() => null),
    ]).then((results) => {
      if (cancelled) return
      const [j, leads, jobs, est, audit] = results
      const jarvisOk = j.status === 'fulfilled' && j.value && (j.value.status === 'ONLINE' || j.value.identity === 'JARVIS')
      const leadCount = leads.status === 'fulfilled' && Array.isArray(leads.value) ? leads.value.length : null
      const jobCount  = jobs.status === 'fulfilled' && Array.isArray(jobs.value) ? jobs.value.length : null
      const estCount  = est.status === 'fulfilled' && Array.isArray(est.value) ? est.value.length : null
      const auditOk   = audit.status === 'fulfilled' && audit.value
      setPulse((p) => ({
        ...p,
        jarvis: { label: 'Jarvis', value: jarvisOk ? 'ONLINE' : 'OFFLINE', tone: jarvisOk ? 'good' : 'bad' },
        leads:  { label: 'Recent Leads', value: leadCount == null ? 'auth' : String(leadCount), tone: leadCount == null ? 'warn' : leadCount > 0 ? 'good' : 'idle' },
        jobs:   { label: 'Active Jobs', value: jobCount == null ? 'auth' : String(jobCount), tone: jobCount == null ? 'warn' : 'idle' },
        estim:  { label: 'Open Estimates', value: estCount == null ? 'auth' : String(estCount), tone: estCount == null ? 'warn' : 'idle' },
        audit:  { label: 'Audit', value: auditOk ? 'OK' : 'auth', tone: auditOk ? 'good' : 'warn' },
      }))
    })
    return () => {
      cancelled = true
      if (typeof window !== 'undefined') window.removeEventListener('cc:autonomy-changed', onAuto)
    }
  }, [])

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-3 pt-2 flex items-center gap-2 overflow-x-auto">
      <PulseTile {...pulse.jarvis} icon={Bot}        onClick={onOpenJarvis} />
      <PulseTile {...pulse.leads}  icon={UserRound}  onClick={() => onTabChange('crm')} />
      <PulseTile {...pulse.jobs}   icon={HardHat}    onClick={() => onTabChange('ops')} />
      <PulseTile {...pulse.estim}  icon={FileText}   onClick={() => onTabChange('ops')} />
      <PulseTile {...pulse.audit}  icon={ShieldCheck} onClick={() => onTabChange('ops')} />
      <PulseTile {...pulse.auto}   icon={Power}      onClick={onOpenJarvis} />
    </div>
  )
}

// ── Jarvis side drawer (opens on any tab) ───────────────────────────────────
function JarvisDrawer({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div
        className={[
          'fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />
      <aside
        className={[
          'fixed top-0 right-0 h-full w-full sm:w-[440px] xl:w-[560px] bg-brand-navy border-l border-white/10 z-50 transition-transform shadow-2xl',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-brand-amber" />
              <span className="font-display font-bold text-white text-sm">Jarvis</span>
              <span className="text-[10px] text-white/40 ml-1">Press J to toggle · Esc to close</span>
            </div>
            <button type="button" onClick={onClose} className="text-white/50 hover:text-white text-sm px-2 py-1">Close</button>
          </div>
          <div className="flex-1 overflow-hidden p-3">
            {open ? <JarvisChat compact /> : null}
          </div>
        </div>
      </aside>
    </>
  )
}

// ── Panic / kill switch ─────────────────────────────────────────────────────
// One-tap freeze of all Jarvis autonomy. Persists across reloads.
// Two-tap to confirm so accidental clicks don't fire.
function PanicButton() {
  const [autonomy, setAutonomy] = useState(readAutonomyState)
  const [confirming, setConfirming] = useState(false)
  const confirmTimer = useRef(null)

  useEffect(() => {
    const onChange = () => setAutonomy(readAutonomyState())
    if (typeof window !== 'undefined') window.addEventListener('cc:autonomy-changed', onChange)
    return () => { if (typeof window !== 'undefined') window.removeEventListener('cc:autonomy-changed', onChange) }
  }, [])

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }, [])

  const handleClick = useCallback(() => {
    if (autonomy.frozen) {
      // Already frozen → this button now means "unfreeze"
      unfreeze()
      setConfirming(false)
      return
    }
    if (!confirming) {
      setConfirming(true)
      // Auto-cancel confirm after 4s
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000)
      return
    }
    triggerPanic('header-button')
    setConfirming(false)
  }, [autonomy.frozen, confirming])

  if (autonomy.frozen) {
    return (
      <button
        type="button"
        onClick={handleClick}
        title="Unfreeze: re-enable Autonomy controls"
        className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-400/60 text-red-100 text-xs font-bold px-3 py-1.5 hover:bg-red-500/30 transition-colors animate-pulse"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        FROZEN — Tap to Unfreeze
      </button>
    )
  }

  if (confirming) {
    return (
      <button
        type="button"
        onClick={handleClick}
        title="Tap again to freeze Jarvis"
        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 border-2 border-red-300 text-white text-xs font-bold px-3 py-1.5 hover:bg-red-500 shadow-lg animate-pulse"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Confirm PANIC?
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Panic: freeze all Jarvis autonomy instantly"
      className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-red-400/30 text-red-200 text-xs font-bold px-3 py-1.5 hover:bg-red-500/15 hover:border-red-400/60 transition-colors"
    >
      <AlertTriangle className="w-3.5 h-3.5" />
      PANIC
    </button>
  )
}

function FrozenBanner() {
  const [autonomy, setAutonomy] = useState(readAutonomyState)
  useEffect(() => {
    const onChange = () => setAutonomy(readAutonomyState())
    if (typeof window !== 'undefined') window.addEventListener('cc:autonomy-changed', onChange)
    return () => { if (typeof window !== 'undefined') window.removeEventListener('cc:autonomy-changed', onChange) }
  }, [])
  if (!autonomy.frozen) return null
  return (
    <div className="bg-red-600/90 text-white text-sm text-center py-2 px-4 border-b border-red-300/50">
      <AlertTriangle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
      <span className="font-bold">Jarvis is FROZEN.</span> All autonomous action is blocked.
      {autonomy.frozenAt ? <span className="opacity-80 ml-2 hidden sm:inline">Since {new Date(autonomy.frozenAt).toLocaleString()}</span> : null}
    </div>
  )
}

// ── Deep-link bar: each tab maps to a full standalone page (when one exists) ─
const TAB_DEEP_LINKS = {
  jarvis:       { to: '/voice-calls',     label: 'Voice Calls Log' },
  ops:          { to: '/dashboard',       label: 'Operations Dashboard' },
  crm:          { to: '/leads',           label: 'Lead Inbox' },
  'civil-intel':{ to: '/contractor-ai',   label: 'Contractor AI Platform' },
  integrations: { to: '/admin/documents', label: 'Admin Documents' },
  dispatch:     { to: '/crew-eta',        label: 'Crew ETA Map' },
  thermal:      { to: '/autonomy',        label: 'Autonomy Dashboard' },
  drone:        { to: '/floor-plan-studio', label: 'Floor Plan Studio' },
  lidar:        { to: '/jwordenai',       label: 'JWordenAI Scan' },
  roller:       { to: '/crew-reporting',  label: 'Crew Reporting' },
  'search-pulse': { to: '/revenue',       label: 'Revenue Dashboard' },
}

function TabDeepLinkBar({ activeTab }) {
  const link = TAB_DEEP_LINKS[activeTab]
  if (!link) return null
  return (
    <div className="mb-4 flex justify-end">
      <Link
        to={link.to}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-brand-amber hover:border-brand-amber/40"
      >
        <ArrowRight className="w-3 h-3" /> Open {link.label} (full page)
      </Link>
    </div>
  )
}

function StrategicOpsPilotPanel() {
  const [predictiveLoading, setPredictiveLoading] = useState(false)
  const [predictiveError, setPredictiveError] = useState('')
  const [predictive, setPredictive] = useState(null)

  const [queueLoading, setQueueLoading] = useState(false)
  const [queueError, setQueueError] = useState('')
  const [queue, setQueue] = useState([])

  const [voiceProjectId, setVoiceProjectId] = useState('ops-shadow-project')
  const [voiceSiteId, setVoiceSiteId] = useState('site-alpha')
  const [voiceTranscript, setVoiceTranscript] = useState('Crew reports safety cones missing near active lane and milling delay at station 11.')
  const [voiceSubmitting, setVoiceSubmitting] = useState(false)

  const [maskSubmitting, setMaskSubmitting] = useState(false)
  const [maskEstimate, setMaskEstimate] = useState(null)
  const [maskError, setMaskError] = useState('')

  const [campaignSubmitting, setCampaignSubmitting] = useState(false)
  const [campaignResult, setCampaignResult] = useState(null)
  const [campaignError, setCampaignError] = useState('')

  const loadPredictive = useCallback(async () => {
    setPredictiveLoading(true)
    setPredictiveError('')
    try {
      const data = await api.getPredictiveCapitalShadowForecast({
        project_id: 'ops-shadow-project',
        budget_usd: 125000,
        projected_duration_days: 21,
      })
      setPredictive(data)
    } catch (error) {
      setPredictiveError(String(error?.message || 'Could not load predictive forecast'))
    } finally {
      setPredictiveLoading(false)
    }
  }, [])

  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    setQueueError('')
    try {
      const data = await api.getVoiceOpsReviewQueue({ status: 'pending_review', limit: 25 })
      setQueue(Array.isArray(data?.queue) ? data.queue : [])
    } catch (error) {
      setQueueError(String(error?.message || 'Could not load voice review queue'))
      setQueue([])
    } finally {
      setQueueLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPredictive()
    loadQueue()
  }, [loadPredictive, loadQueue])

  async function submitVoiceIngest() {
    if (!voiceTranscript.trim()) return
    setVoiceSubmitting(true)
    setQueueError('')
    try {
      await api.ingestAmbientVoiceEvent({
        project_id: voiceProjectId,
        site_id: voiceSiteId,
        transcript_text: voiceTranscript,
        speaker_role: 'foreman',
        source: 'standup',
      })
      await loadQueue()
    } catch (error) {
      setQueueError(String(error?.message || 'Could not ingest voice event'))
    } finally {
      setVoiceSubmitting(false)
    }
  }

  async function verifyVoiceEvent(eventId, status) {
    try {
      await api.verifyVoiceOpsReviewItem(eventId, {
        status,
        reviewed_by: 'command-center-ops',
        review_note: status === 'verified' ? 'Verified from Command Center queue' : 'Dismissed from Command Center queue',
      })
      await loadQueue()
    } catch (error) {
      setQueueError(String(error?.message || 'Could not update review item'))
    }
  }

  async function runMaskEstimate() {
    setMaskSubmitting(true)
    setMaskError('')
    try {
      const data = await api.drivewayCvMaskEstimate({
        project_id: 'driveway-shadow-001',
        address: '123 Main St',
        state: 'VA',
        service_type: 'driveway',
        model_name: 'yolo11-seg',
        model_version: 'v1',
        imagery_source: 'nearmap',
        mask_pixel_count: 220000,
        gsd_sqft_per_pixel: 0.03,
        segmentation_confidence: 0.87,
      })
      setMaskEstimate(data)
    } catch (error) {
      setMaskError(String(error?.message || 'Could not run CV mask estimate'))
      setMaskEstimate(null)
    } finally {
      setMaskSubmitting(false)
    }
  }

  async function draftCampaign() {
    setCampaignSubmitting(true)
    setCampaignError('')
    try {
      const idem = `cc-${Date.now()}`
      const data = await api.draftDrivewayDirectMailCampaign(
        {
          campaign_name: 'Command Center Pilot Batch',
          source: 'manual',
          targets: [
            {
              property_id: 'pilot-001',
              address: '123 Main St',
              owner_name: 'Pilot Owner',
              mailing_address: 'PO Box 101',
              state: 'VA',
              estimated_total_usd: 5600,
            },
          ],
        },
        { headers: { 'Idempotency-Key': idem } },
      )
      setCampaignResult(data)
    } catch (error) {
      setCampaignError(String(error?.message || 'Could not draft direct-mail campaign'))
      setCampaignResult(null)
    } finally {
      setCampaignSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em]">Predictive Capital</h3>
          <button type="button" onClick={loadPredictive} className="text-xs text-brand-amber hover:text-brand-amber/80" disabled={predictiveLoading}>
            {predictiveLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {predictiveError ? <p className="text-rose-300 text-xs">{predictiveError}</p> : null}
        {!predictiveError && predictive ? (
          <div className="space-y-2 text-sm text-white/80">
            <div className="flex items-center justify-between"><span className="text-white/55">Risk band</span><span className="font-semibold">{predictive.risk_band || 'n/a'}</span></div>
            <div className="flex items-center justify-between"><span className="text-white/55">Projected overrun</span><span className="font-semibold">{predictive.projected_overrun_usd != null ? `$${Number(predictive.projected_overrun_usd).toLocaleString()}` : 'n/a'}</span></div>
            <div className="flex items-center justify-between"><span className="text-white/55">Days risk</span><span className="font-semibold">{predictive.projected_delay_days != null ? String(predictive.projected_delay_days) : 'n/a'}</span></div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em] mb-3">Ambient Voice Review</h3>
        <div className="space-y-2 mb-3">
          <input value={voiceProjectId} onChange={(e) => setVoiceProjectId(e.target.value)} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-xs text-white" placeholder="Project ID" />
          <input value={voiceSiteId} onChange={(e) => setVoiceSiteId(e.target.value)} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-xs text-white" placeholder="Site ID" />
          <textarea value={voiceTranscript} onChange={(e) => setVoiceTranscript(e.target.value)} rows={3} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-xs text-white" placeholder="Transcript text" />
        </div>
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={submitVoiceIngest} disabled={voiceSubmitting} className="rounded-lg bg-brand-amber text-brand-navy text-xs font-bold px-3 py-1.5">{voiceSubmitting ? 'Submitting…' : 'Ingest'}</button>
          <button type="button" onClick={loadQueue} disabled={queueLoading} className="rounded-lg border border-white/20 text-white/80 text-xs font-semibold px-3 py-1.5">{queueLoading ? 'Loading…' : 'Reload Queue'}</button>
        </div>
        {queueError ? <p className="text-rose-300 text-xs mb-2">{queueError}</p> : null}
        <div className="max-h-40 overflow-auto space-y-2">
          {queue.slice(0, 4).map((item) => (
            <div key={item.event_id} className="rounded-lg border border-white/10 bg-black/20 p-2">
              <p className="text-[11px] text-white/80 line-clamp-2">{item.transcript_text}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => verifyVoiceEvent(item.event_id, 'verified')} className="rounded border border-emerald-300/40 text-emerald-200 text-[10px] px-2 py-0.5">Verify</button>
                <button type="button" onClick={() => verifyVoiceEvent(item.event_id, 'dismissed')} className="rounded border border-rose-300/40 text-rose-200 text-[10px] px-2 py-0.5">Dismiss</button>
              </div>
            </div>
          ))}
          {queue.length === 0 ? <p className="text-xs text-white/45">No pending review items.</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
        <h3 className="font-display font-bold text-white text-sm uppercase tracking-[0.12em] mb-3">Driveway CV + Mail</h3>
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={runMaskEstimate} disabled={maskSubmitting} className="rounded-lg border border-white/20 text-white/80 text-xs font-semibold px-3 py-1.5">{maskSubmitting ? 'Estimating…' : 'Run CV Estimate'}</button>
          <button type="button" onClick={draftCampaign} disabled={campaignSubmitting} className="rounded-lg bg-brand-amber text-brand-navy text-xs font-bold px-3 py-1.5">{campaignSubmitting ? 'Drafting…' : 'Draft Mail Batch'}</button>
        </div>
        {maskError ? <p className="text-rose-300 text-xs mb-2">{maskError}</p> : null}
        {maskEstimate?.geometry?.driveway_sqft ? (
          <p className="text-xs text-white/75 mb-2">CV area: <span className="text-white">{Number(maskEstimate.geometry.driveway_sqft).toLocaleString()} sqft</span> | Mid est: <span className="text-white">${Number(maskEstimate?.estimate?.mid_usd || 0).toLocaleString()}</span></p>
        ) : null}
        {campaignError ? <p className="text-rose-300 text-xs mb-2">{campaignError}</p> : null}
        {campaignResult?.campaign_id ? (
          <p className="text-xs text-white/75">Campaign <span className="text-white">{campaignResult.campaign_id}</span> drafted ({campaignResult.piece_count || 0} piece).</p>
        ) : null}
      </div>
    </div>
  )
}

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState('jarvis')
  const [radarAreaId, setRadarAreaId] = useState('richmond-va')
  const [radarProviderId, setRadarProviderId] = useState('windy')
  const [radarAreaMode, setRadarAreaMode] = useState('manual')
  const [radarLastAutoSource, setRadarLastAutoSource] = useState('')
  const strategyVisible = INTERNAL_STRATEGY_ENABLED && isCommandCenterPath()
  const [latestAudit, setLatestAudit] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const now = new Date()

  const radarHref = useMemo(
    () => buildRadarUrl(radarProviderId, radarAreaId),
    [radarAreaId, radarProviderId],
  )

  const autoSelectRadarArea = useCallback(async () => {
    try {
      const jobs = await api.listJobs()
      const inferred = inferRadarAreaFromJobs(jobs)
      if (inferred) {
        setRadarAreaId(inferred)
        setRadarAreaMode('auto')
        setRadarLastAutoSource('active jobs')
      }
    } catch {
      // Protected endpoint may be unavailable in some sessions.
    }
  }, [])

  // Keyboard shortcuts: J = Jarvis drawer, 1-6 = tabs (when not typing in an input)
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (inField) return
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        setDrawerOpen((v) => !v)
        return
      }
      const idx = '123456'.indexOf(e.key)
      if (idx >= 0 && TABS[idx]) {
        e.preventDefault()
        setActiveTab(TABS[idx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Wake word ("Hey Jarvis") and CRM "Ask Jarvis" buttons can request the drawer
  useEffect(() => {
    const onOpen = () => setDrawerOpen(true)
    window.addEventListener('cc:open-jarvis-drawer', onOpen)
    return () => window.removeEventListener('cc:open-jarvis-drawer', onOpen)
  }, [])

  // Sync local autonomy state with backend on mount.
  // If backend says frozen, mirror it locally; if backend is OK but local is
  // frozen we leave local frozen (operator's last word wins).
  useEffect(() => {
    let cancelled = false
    api.getAutonomyState?.()
      .then((server) => {
        if (cancelled || !server) return
        if (server.frozen) {
          const cur = readAutonomyState()
          if (!cur.frozen) {
            writeAutonomyState({
              master: false, domains: {},
              frozen: true,
              frozenAt: server.frozenAt || new Date().toISOString(),
              reason: server.reason || 'backend',
            })
          }
        }
      })
      .catch(() => { /* silent — UI still has its local state */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    autoSelectRadarArea()
  }, [autoSelectRadarArea])

  return (
    <div className="min-h-screen bg-brand-navy text-white">
      <FrozenBanner />
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-brand-navy/95 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-xl sm:text-2xl text-white leading-tight">
              Tony Stark's Dashboard
            </h1>
            <p className="text-white/40 text-xs mt-0.5">JWordenAI Command Center — internal operations</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="hidden lg:flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-2.5 py-1 text-[11px] text-sky-100">
              <span className="uppercase tracking-[0.1em] font-bold">Radar</span>
              <select
                value={radarProviderId}
                onChange={(event) => setRadarProviderId(event.target.value)}
                className="rounded bg-black/30 px-2 py-0.5 text-[11px] text-sky-100 border border-sky-300/20"
              >
                {WEATHER_RADAR_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.label}</option>
                ))}
              </select>
            </label>
            <label className="hidden lg:flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-2.5 py-1 text-[11px] text-sky-100">
              <span className="uppercase tracking-[0.1em] font-bold">Radar Area</span>
              <select
                value={radarAreaId}
                onChange={(event) => {
                  setRadarAreaId(event.target.value)
                  setRadarAreaMode('manual')
                }}
                className="rounded bg-black/30 px-2 py-0.5 text-[11px] text-sky-100 border border-sky-300/20"
              >
                {WEATHER_RADAR_AREAS.map((area) => (
                  <option key={area.id} value={area.id}>{area.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={autoSelectRadarArea}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-sky-300/35 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/20"
              title="Auto-select best radar area from active jobs"
            >
              Auto Radar
            </button>
            <a
              href={radarHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 border border-sky-300/45 text-sky-100 text-xs font-bold px-3 py-1.5 hover:bg-sky-500/30"
              title="Open high-resolution live weather radar"
            >
              <Globe className="w-3.5 h-3.5" /> Weather Radar HQ
              <span className="hidden sm:inline text-[10px] opacity-80">
                {radarAreaMode === 'auto' ? `AUTO${radarLastAutoSource ? ` (${radarLastAutoSource})` : ''}` : 'MANUAL'}
              </span>
            </a>
            <PanicButton />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 text-white/60 text-xs font-semibold px-3 py-1">
              Internal
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand-amber/20 border border-brand-amber/40 text-brand-amber text-xs font-semibold px-3 py-1">
              Live {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* ── PulseBar (one-glance vitals) ─────────────────────────────────── */}
        <PulseBar onTabChange={setActiveTab} onOpenJarvis={() => setDrawerOpen(true)} />

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              title={`Press ${i + 1} to switch`}
              className={[
                'shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-brand-amber text-brand-amber'
                  : 'border-transparent text-white/50 hover:text-white/80',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        <>
          {!strategyVisible ? <InternalStrategyNotice /> : null}
          <PremiumIntelRibbon activeTab={activeTab} />
          <TabDeepLinkBar activeTab={activeTab} />
          {strategyVisible ? <HubLinkPanel /> : null}

          {activeTab === 'jarvis' && <JarvisPanel />}

          {activeTab === 'richmond-grid' && (
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-96 text-white/50">
                  Loading map…
                </div>
              }
            >
              <RichmondGrid />
            </Suspense>
          )}

          {activeTab === 'kpi' && (
            <div className="space-y-4 md:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                {KPI_CARDS.map((card) => (
                  <KpiCard key={card.label} {...card} />
                ))}
              </div>

              {strategyVisible ? <OperationsNerveCenterPanel /> : null}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
                  <div className="xl:col-span-2">
                    <ActivityFeed />
                  </div>
                  <div>
                    <SystemHealth />
                  </div>
                </div>

                {strategyVisible ? <HumanChecksControlPanel /> : null}
                {strategyVisible ? <GoogleAdsBudgetControlPanel /> : null}
                {strategyVisible ? <ApiKeysPanel /> : null}
                {strategyVisible ? <HumanApprovalPolicyPanel /> : null}
                {strategyVisible ? <LaunchReadinessAuditPanel strategyVisible={strategyVisible} onAudit={setLatestAudit} /> : null}
                {strategyVisible ? <WeekendExecutionSprintPanel latestAudit={latestAudit} /> : null}
              </div>
            )}

            {activeTab === 'crm' && (
              <div className="space-y-4 md:space-y-5">
                <CrmTable />
                <JarvisActivityFeed />
                {strategyVisible ? <MrWordenAutopilotPanel /> : null}
                {strategyVisible ? <ChannelPerformancePanel /> : null}
                {strategyVisible ? <TempInAppOpsFallbackPanel /> : null}
                {strategyVisible ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 md:px-5 py-4 text-sm text-white/70">
                    Priority Playbook: Focus calls on leads above 80 first, schedule site visits before 6 PM, and send proposal PDFs within 30 minutes of each visit.
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === 'ops' && (
              <div className="space-y-4 md:space-y-5">
                <OperationsPipelinePanel />
                <AuditFeedPanel />
                {strategyVisible ? <TechOpportunityQueuePanel /> : null}
                {strategyVisible ? <StrategicOpsPilotPanel /> : null}
              </div>
            )}

            {activeTab === 'civil-intel' && (
              <CivilContractorIntelligencePanel />
            )}

            {activeTab === 'integrations' && (
              <IntegrationsPanel />
            )}

            {activeTab === 'search-pulse' && (
              <SearchPulsePanel />
            )}

            {activeTab === 'dispatch' && (
              <DispatchPanel />
            )}

            {activeTab === 'thermal' && (
              <ThermalPanel />
            )}

            {activeTab === 'drone' && (
              <DronePanel />
            )}

            {activeTab === 'lidar' && (
              <LidarPanel />
            )}

            {activeTab === 'roller' && (
              <RollerPanel />
            )}
          </>
      </div>

      {/* ── Floating Jarvis button (always available on every tab) ───────── */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        title="Open Jarvis (J)"
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-brand-amber text-brand-navy font-bold px-4 py-3 shadow-2xl hover:scale-105 transition-transform"
      >
        <Bot className="w-5 h-5" />
        <span className="hidden sm:inline">Ask Jarvis</span>
      </button>

      <JarvisDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

