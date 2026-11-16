// Settings the server reads. On Cloudflare these are "Variables and Secrets";
// locally they come from the .dev.vars file.

export interface D1Result<T = unknown> {
  results?: T[];
}
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
export interface D1Like {
  prepare(query: string): D1Statement;
}

export interface WorkersAiLike {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  /** Order to try AI providers in, e.g. "gemini,groq". Only configured ones are used. */
  AI_PROVIDERS?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_EFFORT?: string;
  WORKERS_AI_MODEL?: string;
  /** Cloudflare Workers AI binding (optional). */
  AI?: WorkersAiLike;

  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  /** Long random string used to sign passes. */
  LICENSE_SECRET?: string;
  /** "true" to also offer USD prices (needs international payments on Razorpay). */
  ENABLE_USD?: string;

  /** "true" enables the stand-in AI and fake payments. Development only. */
  ALLOW_MOCK?: string;
  /** Protects /api/health. */
  ADMIN_TOKEN?: string;

  /** Cloudflare D1 database used to count daily AI usage (optional). */
  DB?: D1Like;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

export const isMock = (env: Env) => env.ALLOW_MOCK === 'true';
