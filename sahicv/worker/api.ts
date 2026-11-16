import { LIMITS, PLANS, getPlan } from '../shared/plans.ts';
import type { AiTask } from '../shared/types.ts';
import { AiUnavailable, aiConfigured, providerNames, runAi } from './ai/providers.ts';
import { prepare, TASKS } from './ai/tasks.ts';
import type { Env } from './env.ts';
import { isMock } from './env.ts';
import { bearer, issuePass, verifyPass } from './license.ts';
import { confirmPayment, createOrder, razorpayReady, signatureValid } from './razorpay.ts';
import { usageStore } from './usage.ts';
import { HttpError, json, randomId, readJson, sha256Hex, str } from './util.ts';

// The whole backend: a handful of JSON endpoints under /api.
// Written against web-standard Request/Response so it runs on Cloudflare
// Workers in production and inside the Vite dev server locally.

function paymentsMode(env: Env): 'razorpay' | 'mock' | 'off' {
  if (razorpayReady(env) && env.LICENSE_SECRET) return 'razorpay';
  if (isMock(env) && env.LICENSE_SECRET) return 'mock';
  return 'off';
}

async function visitorKey(request: Request, env: Env): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  // Store only a salted hash, never the IP address itself.
  return 'ip:' + (await sha256Hex(`${ip}|${env.LICENSE_SECRET ?? 'sahicv'}`)).slice(0, 24);
}

async function handleAi(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const task = str(body.task, 40) as AiTask;
  if (!TASKS.includes(task)) throw new HttpError(400, 'bad_task', 'Unknown task.');
  if (!aiConfigured(env)) throw new HttpError(503, 'ai_off', 'AI features are not switched on for this site yet.');
  const input = (body.input && typeof body.input === 'object' ? body.input : {}) as Record<string, unknown>;

  // Who is asking, and do they have allowance left?
  const pass = await verifyPass(env, bearer(request));
  const store = usageStore(env);
  let key: string;
  let limit: number;
  if (pass) {
    key = `pass:${pass.id}`;
    limit = LIMITS.passPerDay;
  } else {
    if (!store) throw new HttpError(402, 'pass_required', 'AI features need a pass.');
    key = await visitorKey(request, env);
    limit = LIMITS.freePerDay;
  }
  const used = store ? await store.get(key) : 0;
  if (used >= limit) {
    throw pass
      ? new HttpError(429, 'daily_limit', `You have reached today's fair-use limit of ${limit} AI actions. It resets at midnight UTC.`)
      : new HttpError(402, 'free_limit', `You have used today's ${limit} free AI actions. Get a pass for unlimited use.`);
  }

  const prepared = await prepare(task, input, env);
  let reply;
  try {
    reply = await runAi(env, prepared.req);
  } catch (err) {
    if (err instanceof AiUnavailable) {
      throw new HttpError(503, 'ai_busy', 'The AI service is busy right now. Please try again in a minute. This attempt was not counted.');
    }
    throw err;
  }
  const result = prepared.shape(reply.data);
  if (store) await store.add(key);
  return json({
    result,
    provider: reply.provider,
    quota: { plan: pass ? pass.plan : 'free', used: used + 1, limit },
  });
}

async function handleOrder(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const plan = getPlan(str(body.plan, 20));
  if (!plan) throw new HttpError(400, 'bad_plan', 'Unknown plan.');
  const currency = str(body.currency, 3) === 'USD' ? 'USD' : 'INR';
  const mode = paymentsMode(env);
  if (mode === 'off') throw new HttpError(503, 'payments_off', 'Payments are not set up yet.');
  if (mode === 'mock') {
    return json({ mock: true, orderId: `order_mock_${randomId()}`, amount: currency === 'USD' ? plan.usd : plan.inr, currency, plan: plan.id });
  }
  const order = await createOrder(env, plan.id, currency);
  return json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID, plan: plan.id });
}

async function handleVerify(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const mode = paymentsMode(env);
  if (mode === 'off') throw new HttpError(503, 'payments_off', 'Payments are not set up yet.');
  if (mode === 'mock') {
    if (!str(body.orderId, 80).startsWith('order_mock_')) throw new HttpError(400, 'bad_payment', 'Not a demo order.');
    const { token, pass } = await issuePass(env, `mock_${randomId()}`, str(body.plan, 20));
    return json({ token, pass });
  }
  const orderId = str(body.razorpay_order_id, 80);
  const paymentId = str(body.razorpay_payment_id, 80);
  const signature = str(body.razorpay_signature, 200);
  if (!orderId || !paymentId || !signature) throw new HttpError(400, 'bad_payment', 'Payment details are missing.');
  if (!(await signatureValid(env, orderId, paymentId, signature))) {
    throw new HttpError(400, 'bad_signature', 'This payment could not be verified.');
  }
  const { payment, plan } = await confirmPayment(env, paymentId);
  if (payment.order_id !== orderId) throw new HttpError(400, 'bad_payment', 'Payment and order do not match.');
  const { token, pass } = await issuePass(env, payment.id, plan, payment.created_at);
  return json({ token, pass });
}

/** Re-issues a pass from a Razorpay payment ID, e.g. on a new phone or after clearing the browser. */
async function handleRestore(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (paymentsMode(env) !== 'razorpay') throw new HttpError(503, 'payments_off', 'Restoring a pass is not available on this site yet.');
  const { payment, plan } = await confirmPayment(env, str(body.paymentId, 80).trim());
  const { token, pass } = await issuePass(env, payment.id, plan, payment.created_at);
  if (pass.exp * 1000 < Date.now()) throw new HttpError(410, 'expired', 'That pass has expired.');
  return json({ token, pass });
}

async function handleConfig(request: Request, env: Env): Promise<Response> {
  const pass = await verifyPass(env, bearer(request));
  const store = usageStore(env);
  let freeUsed = 0;
  if (!pass && store) freeUsed = await store.get(await visitorKey(request, env));
  return json({
    payments: paymentsMode(env),
    usd: env.ENABLE_USD === 'true',
    ai: aiConfigured(env),
    demo: providerNames(env).length === 1 && providerNames(env)[0] === 'mock',
    free: { perDay: store ? LIMITS.freePerDay : 0, used: freeUsed },
    pass: pass ? { plan: pass.plan, exp: pass.exp } : null,
    plans: PLANS.map((p) => p.id),
  });
}

/** Setup check for the site owner: which pieces are configured, and does each AI provider answer? */
async function handleHealth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!env.ADMIN_TOKEN || url.searchParams.get('token') !== env.ADMIN_TOKEN) {
    throw new HttpError(404, 'not_found', 'Not found.');
  }
  const report: Record<string, unknown> = {
    payments: paymentsMode(env),
    licenseSecret: Boolean(env.LICENSE_SECRET && env.LICENSE_SECRET.length >= 16),
    usageDatabase: Boolean(env.DB),
    mockMode: isMock(env),
    providers: providerNames(env),
  };
  if (url.searchParams.get('test') === '1') {
    const tests: Record<string, string> = {};
    for (const name of providerNames(env)) {
      try {
        const reply = await runAi(
          { ...env, AI_PROVIDERS: name },
          { task: 'health', system: 'Reply with one JSON object only.', user: 'Reply with {"ok":true}', maxTokens: 200, input: {} },
        );
        tests[name] = reply.data.ok === true ? 'ok' : 'answered, but not with the expected JSON';
      } catch (err) {
        tests[name] = err instanceof AiUnavailable ? err.attempts.join(' | ') : String(err);
      }
    }
    report.providerTests = tests;
  }
  return json(report);
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  try {
    const post = request.method === 'POST';
    if (pathname === '/api/config' && request.method === 'GET') return await handleConfig(request, env);
    if (pathname === '/api/health' && request.method === 'GET') return await handleHealth(request, env);
    if (pathname === '/api/ai' && post) return await handleAi(request, env);
    if (pathname === '/api/order' && post) return await handleOrder(request, env);
    if (pathname === '/api/verify' && post) return await handleVerify(request, env);
    if (pathname === '/api/restore' && post) return await handleRestore(request, env);
    return json({ error: 'not_found', message: 'Not found.' }, 404);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status);
    console.error('[api] unexpected error', err);
    return json({ error: 'server_error', message: 'Something went wrong on our side. Please try again.' }, 500);
  }
}
