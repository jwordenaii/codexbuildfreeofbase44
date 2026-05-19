// =====================================================================
// The Worden Standard — Anthropic Messages API thin client
//
// Single-purpose wrapper: send a system+user prompt, get text back.
// No SDK dependency — uses fetch() against api.anthropic.com directly
// so the bundle stays tiny and the Netlify function cold-starts fast.
//
// Env:
//   ANTHROPIC_API_KEY      — required for live calls (graceful no-key fallback)
//   ANTHROPIC_MODEL        — optional override, default claude-3-5-haiku
//
// Why Haiku as default: narrative generation is a small structured task
// where Haiku produces the same quality as Opus at ~10x lower cost.
// =====================================================================

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-haiku-latest';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  system?: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface AnthropicResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

/** True when ANTHROPIC_API_KEY is configured. */
export function isAnthropicEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Send one round-trip to the Messages API and return text + token counts.
 * Throws on missing key or non-2xx response — callers handle fallback.
 */
export async function callAnthropic(req: AnthropicRequest): Promise<AnthropicResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: req.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: req.maxTokens ?? 256,
      temperature: req.temperature ?? 0.4,
      system: req.system,
      messages: req.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json() as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    stop_reason?: string;
  };

  const text = (json.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('')
    .trim();

  return {
    text,
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
    stopReason: json.stop_reason || 'unknown',
  };
}
