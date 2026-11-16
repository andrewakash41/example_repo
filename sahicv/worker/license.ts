import { getPlan, type PlanId } from '../shared/plans.ts';
import type { Env } from './env.ts';
import { b64url, b64urlDecode, hmac, HttpError, safeEqual } from './util.ts';

// A pass is a signed token: base64url(payload) + "." + base64url(HMAC).
// The server can check it without a database; the browser just stores it.

export interface Pass {
  v: 1;
  /** Payment id the pass was issued for. */
  id: string;
  plan: PlanId;
  /** Issue and expiry times, seconds since epoch. */
  iat: number;
  exp: number;
}

function secret(env: Env): string {
  if (!env.LICENSE_SECRET || env.LICENSE_SECRET.length < 16) {
    throw new HttpError(503, 'not_configured', 'Payments are not set up yet (LICENSE_SECRET is missing).');
  }
  return env.LICENSE_SECRET;
}

export async function issuePass(env: Env, id: string, planId: string, startSeconds?: number): Promise<{ token: string; pass: Pass }> {
  const plan = getPlan(planId);
  if (!plan) throw new HttpError(400, 'bad_plan', 'Unknown plan.');
  const iat = Math.floor(startSeconds ?? Date.now() / 1000);
  const pass: Pass = { v: 1, id, plan: plan.id, iat, exp: iat + plan.days * 86400 };
  const body = b64url(new TextEncoder().encode(JSON.stringify(pass)));
  const sig = b64url(await hmac(secret(env), body));
  return { token: `${body}.${sig}`, pass };
}

/** Returns the pass if the token is genuine and not expired, otherwise null. */
export async function verifyPass(env: Env, token: string | null | undefined): Promise<Pass | null> {
  if (!token || !env.LICENSE_SECRET) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = b64url(await hmac(env.LICENSE_SECRET, body));
  if (!safeEqual(sig, expected)) return null;
  try {
    const pass = JSON.parse(b64urlDecode(body)) as Pass;
    if (pass.v !== 1 || typeof pass.exp !== 'number' || pass.exp * 1000 < Date.now()) return null;
    return pass;
  } catch {
    return null;
  }
}

export function bearer(request: Request): string | null {
  const h = request.headers.get('authorization') ?? '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : null;
}
