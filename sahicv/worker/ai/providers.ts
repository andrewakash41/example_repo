import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../env.ts';
import { isMock } from '../env.ts';
import { extractJson } from '../util.ts';
import { mockReply } from './mock.ts';

// Every AI task asks for a JSON reply. Providers are tried in order; if one is
// rate-limited, down or returns something unparseable, the next one is tried.
// That keeps the app working on free tiers, whose limits change without notice.

export interface AiRequest {
  task: string;
  system: string;
  user: string;
  maxTokens: number;
  /** Original task input, used only by the stand-in provider. */
  input: Record<string, unknown>;
}

export interface AiReply {
  data: Record<string, unknown>;
  provider: string;
}

type Provider = {
  name: string;
  ready(env: Env): boolean;
  run(env: Env, req: AiRequest): Promise<string>;
};

// Model defaults. Free-tier model names change often: check each provider's
// current model list and override with the *_MODEL variables when needed.
const DEFAULTS = {
  gemini: 'gemini-3.5-flash-lite',
  groq: 'openai/gpt-oss-120b',
  workersAi: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  anthropic: 'claude-opus-5-5',
};

async function failText(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  return `HTTP ${res.status} ${body.slice(0, 300)}`;
}

const gemini: Provider = {
  name: 'gemini',
  ready: (env) => Boolean(env.GEMINI_API_KEY),
  async run(env, req) {
    const model = env.GEMINI_MODEL || DEFAULTS.gemini;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: req.maxTokens, temperature: 0.5 },
      }),
    });
    if (!res.ok) throw new Error(await failText(res));
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Empty reply');
    return text;
  },
};

function openAiCompatible(
  name: string,
  url: string,
  key: (env: Env) => string | undefined,
  model: (env: Env) => string | undefined,
  jsonMode: boolean,
): Provider {
  return {
    name,
    ready: (env) => Boolean(key(env) && model(env)),
    async run(env, req) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key(env)}` },
        body: JSON.stringify({
          model: model(env),
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          max_tokens: req.maxTokens,
          temperature: 0.5,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      if (!res.ok) throw new Error(await failText(res));
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? '';
      if (!text) throw new Error('Empty reply');
      return text;
    },
  };
}

const groq = openAiCompatible(
  'groq',
  'https://api.groq.com/openai/v1/chat/completions',
  (env) => env.GROQ_API_KEY,
  (env) => env.GROQ_MODEL || DEFAULTS.groq,
  true,
);

const openrouter = openAiCompatible(
  'openrouter',
  'https://openrouter.ai/api/v1/chat/completions',
  (env) => env.OPENROUTER_API_KEY,
  (env) => env.OPENROUTER_MODEL,
  false,
);

const workersAi: Provider = {
  name: 'workers-ai',
  ready: (env) => Boolean(env.AI),
  async run(env, req) {
    const out = (await env.AI!.run(env.WORKERS_AI_MODEL || DEFAULTS.workersAi, {
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      max_tokens: Math.min(req.maxTokens, 4096),
    })) as { response?: unknown; choices?: { message?: { content?: string } }[] };
    const text = typeof out.response === 'string' ? out.response : out.response ? JSON.stringify(out.response) : out.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('Empty reply');
    return text;
  },
};

const anthropic: Provider = {
  name: 'anthropic',
  ready: (env) => Boolean(env.ANTHROPIC_API_KEY),
  async run(env, req) {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 120_000 });
    const effort = (['low', 'medium', 'high', 'xhigh', 'max'] as const).find((e) => e === env.ANTHROPIC_EFFORT) ?? 'low';
    const response = await client.beta.messages.create({
      model: env.ANTHROPIC_MODEL || DEFAULTS.anthropic,
      max_tokens: Math.max(req.maxTokens, 16000),
      // If the model declines a request for policy reasons, let the API retry on
      // its default fallback model within the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort },
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    });
    if (response.stop_reason === 'refusal') throw new Error('The model declined this request');
    if (response.stop_reason === 'max_tokens') throw new Error('Reply was cut off (max_tokens)');
    const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
    if (!text) throw new Error('Empty reply');
    return text;
  },
};

const mock: Provider = {
  name: 'mock',
  ready: (env) => isMock(env),
  async run(_env, req) {
    return JSON.stringify(mockReply(req));
  },
};

const ALL: Record<string, Provider> = { anthropic, gemini, groq, openrouter, 'workers-ai': workersAi, mock };
const DEFAULT_ORDER = ['anthropic', 'gemini', 'groq', 'openrouter', 'workers-ai'];

export function activeProviders(env: Env): Provider[] {
  const order = (env.AI_PROVIDERS || DEFAULT_ORDER.join(','))
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const list = order.map((n) => ALL[n]).filter((p): p is Provider => Boolean(p) && p.ready(env));
  // The stand-in is only a last resort, and only when explicitly allowed.
  if (!list.length && isMock(env)) list.push(mock);
  return list;
}

export function aiConfigured(env: Env): boolean {
  return activeProviders(env).length > 0;
}

export class AiUnavailable extends Error {
  attempts: string[];
  constructor(attempts: string[]) {
    super('All AI providers failed');
    this.attempts = attempts;
  }
}

export async function runAi(env: Env, req: AiRequest): Promise<AiReply> {
  const providers = activeProviders(env);
  const attempts: string[] = [];
  for (const p of providers) {
    try {
      const text = await p.run(env, req);
      return { data: extractJson(text), provider: p.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push(`${p.name}: ${msg.slice(0, 300)}`);
      console.error(`[ai] ${p.name} failed for ${req.task}: ${msg.slice(0, 500)}`);
    }
  }
  throw new AiUnavailable(attempts);
}

export function providerNames(env: Env): string[] {
  return activeProviders(env).map((p) => p.name);
}
