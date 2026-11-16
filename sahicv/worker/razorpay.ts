import { getPlan } from '../shared/plans.ts';
import type { Env } from './env.ts';
import { hex, hmac, HttpError, safeEqual } from './util.ts';

const API = 'https://api.razorpay.com/v1';

export function razorpayReady(env: Env): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

async function call<T>(env: Env, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? 'GET',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
  if (!res.ok) {
    throw new HttpError(502, 'payment_provider', data.error?.description ?? 'The payment provider returned an error.');
  }
  return data;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: number;
}

export async function createOrder(env: Env, planId: string, currency: 'INR' | 'USD'): Promise<RazorpayOrder> {
  const plan = getPlan(planId);
  if (!plan) throw new HttpError(400, 'bad_plan', 'Unknown plan.');
  if (currency === 'USD' && env.ENABLE_USD !== 'true') throw new HttpError(400, 'bad_currency', 'USD payments are not enabled.');
  return call<RazorpayOrder>(env, '/orders', {
    method: 'POST',
    body: {
      amount: currency === 'USD' ? plan.usd : plan.inr,
      currency,
      receipt: `cv_${Date.now().toString(36)}`,
      notes: { plan: plan.id },
    },
  });
}

/** Checks the signature Razorpay Checkout hands to the browser after a payment. */
export async function signatureValid(env: Env, orderId: string, paymentId: string, signature: string): Promise<boolean> {
  const expected = hex(await hmac(env.RAZORPAY_KEY_SECRET ?? '', `${orderId}|${paymentId}`));
  return safeEqual(expected, signature);
}

/**
 * Confirms a payment really went through and returns the plan it paid for.
 * Captures the payment if the account is set to manual capture.
 */
export async function confirmPayment(env: Env, paymentId: string): Promise<{ payment: RazorpayPayment; plan: string }> {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new HttpError(400, 'bad_payment', 'That does not look like a payment ID.');
  let payment = await call<RazorpayPayment>(env, `/payments/${paymentId}`);
  if (payment.status === 'authorized') {
    payment = await call<RazorpayPayment>(env, `/payments/${paymentId}/capture`, {
      method: 'POST',
      body: { amount: payment.amount, currency: payment.currency },
    });
  }
  if (payment.status !== 'captured') throw new HttpError(402, 'not_paid', 'This payment has not been completed.');
  const order = await call<RazorpayOrder>(env, `/orders/${payment.order_id}`);
  const planId = order.notes?.plan ?? '';
  const plan = getPlan(planId);
  if (!plan) throw new HttpError(400, 'bad_plan', 'This payment is not for a SahiCV pass.');
  const expected = payment.currency === 'USD' ? plan.usd : plan.inr;
  if (payment.amount < expected) throw new HttpError(402, 'not_paid', 'The amount paid does not match the plan.');
  return { payment, plan: plan.id };
}
