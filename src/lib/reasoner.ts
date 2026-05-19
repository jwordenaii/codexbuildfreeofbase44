// =====================================================================
// The Worden Standard — Reasoner
//
// Converts a fusion result (score + per-signal contributions) into a
// 2-3 sentence executive narrative. Uses Anthropic when ANTHROPIC_API_KEY
// is set; falls back to a deterministic template otherwise so every
// score always carries a narrative regardless of LLM availability.
//
// The deterministic fallback is intentionally honest — it cites the
// top contributing signals and the score band, never inventing data.
// =====================================================================

import { callAnthropic, isAnthropicEnabled } from './anthropic';
import type {
  NarrativeRequest,
  NarrativeResponse,
} from '../types/narrative.types';
import type { EvaluatedSignal } from '../types/fusion.types';

// ---------------------------------------------------------------------
// Score band labels — used by both deterministic fallback + LLM prompt
// ---------------------------------------------------------------------

function scoreBand(score: number): { label: string; tone: string } {
  if (score >= 80) return { label: 'strong boom', tone: 'aggressive' };
  if (score >= 65) return { label: 'expansion', tone: 'constructive' };
  if (score >= 50) return { label: 'steady',    tone: 'neutral' };
  if (score >= 35) return { label: 'softening', tone: 'cautious' };
  if (score >= 20) return { label: 'contraction', tone: 'defensive' };
  return { label: 'recession risk', tone: 'preserve capital' };
}

function horizonLabel(days: number): string {
  if (days <= 30) return 'next 30 days';
  if (days <= 90) return 'next quarter';
  if (days <= 180) return 'next 6 months';
  return 'next 12 months';
}

/** Top N signals by absolute contribution, excluding cold-start. */
function topDrivers(components: EvaluatedSignal[], n: number): EvaluatedSignal[] {
  return [...components]
    .filter((c) => !c.isSynthetic)
    .sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib))
    .slice(0, n);
}

function signalLabel(id: string): string {
  return ({
    permits:         'building permits',
    sam_spending:    'federal construction awards',
    yield_curve:     'the yield curve',
    jolts_openings:  'construction job openings',
    aia_abi:         'private residential construction spend',
    material_cost:   'diesel input costs',
    pavement_cond:   'housing-stock value',
    demographics:    'population growth',
    jolts_hires:     'construction hiring',
    diesel:          'diesel prices',
    asphalt_ppi:     'ready-mix material prices',
    wages_eci:       'construction wages',
    crude_wti:       'crude oil prices',
    lumber_ppi:      'lumber prices',
    private_nonres:  'private non-residential construction',
    total_construction: 'total construction spend',
  } as Record<string, string>)[id] || id.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------
// Deterministic fallback — never throws, never invents
// ---------------------------------------------------------------------

export function deterministicNarrative(req: NarrativeRequest): string {
  const band = scoreBand(req.score);
  const place = req.geoLabel || `geography ${req.geo}`;
  const window = horizonLabel(req.horizon);
  const drivers = topDrivers(req.components, 3);

  if (drivers.length === 0) {
    return `${place} score ${req.score.toFixed(0)}/100 over the ${window} reflects ${band.label} conditions, but every signal is in cold-start — backfill source data to firm up the read.`;
  }

  const driverPhrases = drivers.map((d) => {
    const dir = d.contrib >= 0 ? 'lifting' : 'pulling down';
    return `${signalLabel(d.signal)} ${dir} the score (z=${d.z.toFixed(1)})`;
  });

  return `${place} reads ${req.score.toFixed(0)}/100 over the ${window} — ${band.label} regime. Top drivers: ${driverPhrases.join('; ')}. Posture: ${band.tone}.`;
}

// ---------------------------------------------------------------------
// LLM-powered narrative
// ---------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the analyst voice of The Worden Standard, a construction-economics intelligence platform. You explain WBP boom-probability scores to contractors and capital allocators.

Rules:
- 2-3 sentences. No filler, no hedging adverbs ("very", "quite", "somewhat").
- Cite the strongest 1-2 signals by name and direction.
- End with a single posture word: aggressive | constructive | neutral | cautious | defensive | preserve.
- Never invent numbers — work only from what the user provides.
- Never apologize for cold-start data; if a signal is synthetic, simply omit it.`;

function buildUserPrompt(req: NarrativeRequest): string {
  const band = scoreBand(req.score);
  const drivers = topDrivers(req.components, 4);
  const place = req.geoLabel || `geography ${req.geo}`;
  const window = horizonLabel(req.horizon);

  const driverLines = drivers.map(
    (d) => `- ${signalLabel(d.signal)}: z=${d.z.toFixed(2)}, contribution=${d.contrib.toFixed(3)}`,
  ).join('\n') || '- (all signals in cold-start)';

  return `Model: ${req.model}
Geography: ${place}
Horizon: ${window}
Score: ${req.score.toFixed(1)}/100 (${band.label})

Top drivers (sorted by absolute contribution):
${driverLines}

Write the narrative.`;
}

/**
 * Generate a narrative for a fusion result. Falls back to a deterministic
 * template if ANTHROPIC_API_KEY is missing or the API call fails.
 */
export async function generateNarrative(req: NarrativeRequest): Promise<NarrativeResponse> {
  const generatedAt = new Date().toISOString();

  if (!isAnthropicEnabled()) {
    return {
      narrative: deterministicNarrative(req),
      source: 'deterministic',
      generatedAt,
    };
  }

  try {
    const out = await callAnthropic({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(req) }],
      maxTokens: req.style === 'analyst' ? 320 : 160,
      temperature: 0.4,
    });
    const text = out.text || deterministicNarrative(req);
    return {
      narrative: text,
      source: out.text ? 'anthropic' : 'deterministic',
      tokensIn: out.inputTokens,
      tokensOut: out.outputTokens,
      generatedAt,
    };
  } catch {
    return {
      narrative: deterministicNarrative(req),
      source: 'deterministic',
      generatedAt,
    };
  }
}
