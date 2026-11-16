import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIMITS } from '../shared/plans.ts';
import type { TailorResult } from '../shared/types.ts';
import { sampleResume } from '../src/resume/model.ts';
import { prepare } from '../worker/ai/tasks.ts';
import { handleApi } from '../worker/api.ts';
import type { Env } from '../worker/env.ts';
import { issuePass, verifyPass } from '../worker/license.ts';
import { signatureValid } from '../worker/razorpay.ts';
import { resetMemoryUsage } from '../worker/usage.ts';
import { extractJson, hex, hmac } from '../worker/util.ts';

const SECRET = 'test-secret-that-is-long-enough-123456';
const mockEnv: Env = { ALLOW_MOCK: 'true', LICENSE_SECRET: SECRET };
const liveEnv: Env = { LICENSE_SECRET: SECRET, RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 'rzp-secret' };

const call = (env: Env, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handleApi(
    new Request(`https://example.test${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
const ai = (env: Env, task: string, input: unknown, headers?: Record<string, string>) => call(env, '/api/ai', { task, input }, headers);

beforeEach(() => resetMemoryUsage());
afterEach(() => vi.unstubAllGlobals());

describe('passes', () => {
  it('issues a pass that verifies, with the right length', async () => {
    const { token, pass } = await issuePass(mockEnv, 'pay_1', 'month');
    expect(pass.exp - pass.iat).toBe(30 * 86400);
    expect((await verifyPass(mockEnv, token))?.id).toBe('pay_1');
  });

  it('rejects tampered, foreign and expired passes', async () => {
    const { token } = await issuePass(mockEnv, 'pay_1', 'week');
    const [body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, id: 'pay_1', plan: 'quarter', iat: 1, exp: 9999999999 })).toString('base64url');
    expect(await verifyPass(mockEnv, `${forged}.${sig}`)).toBeNull();
    expect(await verifyPass(mockEnv, `${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(await verifyPass({ ...mockEnv, LICENSE_SECRET: 'another-secret-entirely-000000' }, token)).toBeNull();
    expect(await verifyPass(mockEnv, 'garbage')).toBeNull();
    const old = await issuePass(mockEnv, 'pay_2', 'week', Math.floor(Date.now() / 1000) - 8 * 86400);
    expect(await verifyPass(mockEnv, old.token)).toBeNull();
  });

  it('refuses to issue passes without a proper signing secret', async () => {
    await expect(issuePass({ LICENSE_SECRET: 'short' }, 'pay_1', 'week')).rejects.toThrow();
  });
});

describe('api: configuration', () => {
  it('reports demo mode', async () => {
    const c = await (await call(mockEnv, '/api/config')).json();
    expect(c).toMatchObject({ payments: 'mock', ai: true, demo: true, free: { perDay: LIMITS.freePerDay, used: 0 }, pass: null });
  });

  it('reports everything off when nothing is configured', async () => {
    const c = await (await call({}, '/api/config')).json();
    expect(c).toMatchObject({ payments: 'off', ai: false, demo: false });
    expect((await ai({}, 'summary', {})).status).toBe(503);
    expect((await call({}, '/api/order', { plan: 'week' })).status).toBe(503);
  });

  it('never enables fake payments or fake AI unless ALLOW_MOCK is set', async () => {
    const env: Env = { LICENSE_SECRET: SECRET };
    expect((await call(env, '/api/order', { plan: 'week' })).status).toBe(503);
    expect((await call(env, '/api/verify', { orderId: 'order_mock_x', plan: 'quarter' })).status).toBe(503);
    expect((await ai(env, 'summary', { resume: sampleResume() })).status).toBe(503);
  });

  it('hides the health check without the admin token', async () => {
    expect((await call({ ...mockEnv, ADMIN_TOKEN: 'abc' }, '/api/health')).status).toBe(404);
    expect((await call(mockEnv, '/api/health?token=')).status).toBe(404);
    const ok = await call({ ...mockEnv, ADMIN_TOKEN: 'abc' }, '/api/health?token=abc&test=1');
    expect(await ok.json()).toMatchObject({ payments: 'mock', providers: ['mock'], providerTests: { mock: 'ok' } });
  });

  it('returns 404 for unknown routes and 400 for unknown tasks', async () => {
    expect((await call(mockEnv, '/api/nope')).status).toBe(404);
    expect((await ai(mockEnv, 'hack', {})).status).toBe(400);
  });
});

describe('api: AI allowance', () => {
  it('runs every task with the stand-in AI', async () => {
    const resume = sampleResume();
    const env = { ...mockEnv };
    const { token } = await issuePass(env, 'pay_all', 'month');
    const auth = { authorization: `Bearer ${token}` };
    const job = { resume, jd: 'Backend engineer with Java, Kafka and Prometheus experience for a payments team.', role: 'Backend Engineer', company: 'Acme' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const inputs: Record<string, unknown> = {
      'parse-resume': { text: 'Ananya Iyer\nSoftware Engineer\nananya@example.com\nBackend engineer with six years of experience.\nKaveri Payments, 2022 to present\nBuilt payment services in Java and Go.' },
      summary: job,
      'improve-bullet': { bullet: 'Worked on payment APIs', context: 'Engineer at Kaveri' },
      tailor: job,
      'cover-letter': job,
      'interview-questions': job,
      'mock-question': { ...job, asked: [] },
      'mock-feedback': { ...job, question: 'Tell me about yourself', answer: 'I am a backend engineer.', asked: [] },
      'company-brief': job,
      'job-kit': job,
    };
    for (const [task, input] of Object.entries(inputs)) {
      const res = await ai(env, task, input, auth);
      expect(res.status, task).toBe(200);
      const body = (await res.json()) as { result: Record<string, unknown>; provider: string };
      expect(body.provider).toBe('mock');
      expect(Object.keys(body.result).length, task).toBeGreaterThan(0);
    }
  });

  it('gives visitors a small free allowance, then asks for a pass', async () => {
    const input = { resume: sampleResume() };
    for (let i = 0; i < LIMITS.freePerDay; i++) {
      const res = await ai(mockEnv, 'summary', input);
      expect(res.status).toBe(200);
      expect(((await res.json()) as { quota: { used: number } }).quota.used).toBe(i + 1);
    }
    const blocked = await ai(mockEnv, 'summary', input);
    expect(blocked.status).toBe(402);
    expect(((await blocked.json()) as { error: string }).error).toBe('free_limit');
    // A different visitor is counted separately.
    expect((await ai(mockEnv, 'summary', input, { 'cf-connecting-ip': '203.0.113.9' })).status).toBe(200);
    // The config endpoint reflects the usage.
    expect(((await (await call(mockEnv, '/api/config')).json()) as { free: { used: number } }).free.used).toBe(LIMITS.freePerDay);
  });

  it('lets a pass holder continue past the free limit, and ignores a forged pass', async () => {
    const input = { resume: sampleResume() };
    for (let i = 0; i < LIMITS.freePerDay; i++) await ai(mockEnv, 'summary', input);
    const { token } = await issuePass(mockEnv, 'pay_9', 'week');
    expect((await ai(mockEnv, 'summary', input, { authorization: `Bearer ${token}` })).status).toBe(200);
    expect((await ai(mockEnv, 'summary', input, { authorization: 'Bearer forged.token' })).status).toBe(402);
  });

  it('requires a pass when no usage database is configured', async () => {
    const env: Env = { LICENSE_SECRET: SECRET, GEMINI_API_KEY: 'k' };
    const res = await ai(env, 'summary', { resume: sampleResume() });
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: string }).error).toBe('pass_required');
  });
});

describe('api: payments', () => {
  it('completes a demo purchase and activates the pass', async () => {
    const order = (await (await call(mockEnv, '/api/order', { plan: 'month', currency: 'INR' })).json()) as { orderId: string; amount: number; mock: boolean };
    expect(order).toMatchObject({ mock: true, amount: 24900 });
    const bought = (await (await call(mockEnv, '/api/verify', { orderId: order.orderId, plan: 'month' })).json()) as { token: string; pass: { plan: string } };
    expect(bought.pass.plan).toBe('month');
    const cfg = (await (await call(mockEnv, '/api/config', undefined, { authorization: `Bearer ${bought.token}` })).json()) as { pass: { plan: string } };
    expect(cfg.pass.plan).toBe('month');
    expect((await call(mockEnv, '/api/order', { plan: 'lifetime' })).status).toBe(400);
  });

  it('checks the Razorpay signature the same way Razorpay documents it', async () => {
    const good = hex(await hmac('rzp-secret', 'order_1|pay_1'));
    expect(await signatureValid(liveEnv, 'order_1', 'pay_1', good)).toBe(true);
    expect(await signatureValid(liveEnv, 'order_1', 'pay_2', good)).toBe(false);
    expect(await signatureValid(liveEnv, 'order_1', 'pay_1', good.replace(/.$/, good.endsWith('0') ? '1' : '0'))).toBe(false);
  });

  const razorpay = (payment: Record<string, unknown>, order: Record<string, unknown>) =>
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      expect(String((init?.headers as Record<string, string>).authorization)).toMatch(/^Basic /);
      if (u.endsWith('/orders') && init?.method === 'POST') return Response.json({ id: 'order_1', amount: 24900, currency: 'INR', status: 'created' });
      if (u.endsWith('/capture')) return Response.json({ ...payment, status: 'captured' });
      if (u.includes('/payments/')) return Response.json(payment);
      if (u.includes('/orders/')) return Response.json(order);
      return new Response('{}', { status: 404 });
    });

  it('issues a pass only for a verified, fully paid Razorpay payment', async () => {
    const created = Math.floor(Date.now() / 1000) - 60;
    const payment = { id: 'pay_1', order_id: 'order_1', amount: 24900, currency: 'INR', status: 'captured', created_at: created };
    const order = { id: 'order_1', amount: 24900, currency: 'INR', status: 'paid', notes: { plan: 'month' } };
    vi.stubGlobal('fetch', razorpay(payment, order));

    const o = (await (await call(liveEnv, '/api/order', { plan: 'month' })).json()) as { orderId: string; keyId: string };
    expect(o).toMatchObject({ orderId: 'order_1', keyId: 'rzp_test_abc' });

    const sig = hex(await hmac('rzp-secret', 'order_1|pay_1'));
    const bad = await call(liveEnv, '/api/verify', { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'f'.repeat(64) });
    expect(bad.status).toBe(400);

    const ok = await call(liveEnv, '/api/verify', { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sig });
    expect(ok.status).toBe(200);
    const { token, pass } = (await ok.json()) as { token: string; pass: { plan: string; iat: number; exp: number } };
    expect(pass).toMatchObject({ plan: 'month', iat: created, exp: created + 30 * 86400 });
    expect(await verifyPass(liveEnv, token)).not.toBeNull();

    // The same payment can restore the pass on another device, with the same expiry.
    const restored = (await (await call(liveEnv, '/api/restore', { paymentId: 'pay_1' })).json()) as { pass: { exp: number } };
    expect(restored.pass.exp).toBe(pass.exp);
    expect((await call(liveEnv, '/api/restore', { paymentId: 'not-a-payment' })).status).toBe(400);
  });

  it('captures an authorised payment before issuing the pass', async () => {
    const payment = { id: 'pay_1', order_id: 'order_1', amount: 9900, currency: 'INR', status: 'authorized', created_at: Math.floor(Date.now() / 1000) };
    const fetchMock = razorpay(payment, { id: 'order_1', notes: { plan: 'week' } });
    vi.stubGlobal('fetch', fetchMock);
    const res = await call(liveEnv, '/api/restore', { paymentId: 'pay_1' });
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/capture'))).toBe(true);
  });

  it('refuses underpaid, unpaid and expired payments', async () => {
    const now = Math.floor(Date.now() / 1000);
    const base = { id: 'pay_1', order_id: 'order_1', currency: 'INR', created_at: now };
    const quarter = { id: 'order_1', notes: { plan: 'quarter' } };

    vi.stubGlobal('fetch', razorpay({ ...base, amount: 9900, status: 'captured' }, quarter));
    expect((await call(liveEnv, '/api/restore', { paymentId: 'pay_1' })).status).toBe(402);

    vi.stubGlobal('fetch', razorpay({ ...base, amount: 49900, status: 'failed' }, quarter));
    expect((await call(liveEnv, '/api/restore', { paymentId: 'pay_1' })).status).toBe(402);

    vi.stubGlobal('fetch', razorpay({ ...base, amount: 9900, status: 'captured', created_at: now - 30 * 86400 }, { id: 'order_1', notes: { plan: 'week' } }));
    expect((await call(liveEnv, '/api/restore', { paymentId: 'pay_1' })).status).toBe(410);

    vi.stubGlobal('fetch', razorpay({ ...base, amount: 9900, status: 'captured' }, { id: 'order_1', notes: {} }));
    expect((await call(liveEnv, '/api/restore', { paymentId: 'pay_1' })).status).toBe(400);
  });
});

describe('tailoring safeguards', () => {
  it('drops invented skills and edits to things that do not exist, and flags new numbers', async () => {
    const resume = sampleResume();
    const exp = resume.experience[0];
    const group = resume.skills[0];
    const { shape } = await prepare('tailor', { resume, jd: 'Backend engineer with Java, Kafka and Rust.', role: 'Backend Engineer' }, mockEnv);
    const result = shape({
      summary: 'Backend engineer with 12 years building payment systems.',
      bullets: [
        { entryId: exp.id, index: 0, text: 'Led a team of 5 to split the payments monolith into 9 Kafka services.', reason: 'Kafka first' },
        { entryId: exp.id, index: 99, text: 'Out of range' },
        { entryId: 'no-such-entry', index: 0, text: 'Invented role' },
      ],
      skills: [{ id: group.id, items: 'Go, Java, Rust, COBOL, Python, SQL' }],
      missingKeywords: ['Rust'],
    }) as unknown as TailorResult;

    const summary = result.changes.find((c) => c.target === 'summary');
    expect(summary?.warning).toBeTruthy();
    const bullets = result.changes.filter((c) => c.target === 'experience');
    expect(bullets).toHaveLength(1);
    expect(bullets[0].warning).toBeUndefined();
    const skills = result.changes.find((c) => c.target === 'skills');
    expect(skills?.after).not.toMatch(/Rust|COBOL/);
    expect(skills?.after).toMatch(/Go/);
    expect(result.missingKeywords).toContain('Rust');
  });
});

describe('model output parsing', () => {
  it('reads JSON even when the model wraps it in prose or code fences', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Here you go:\n```json\n{"a":{"b":[1,2]}}\n```\nHope it helps')).toEqual({ a: { b: [1, 2] } });
    expect(() => extractJson('no json here')).toThrow();
  });
});
