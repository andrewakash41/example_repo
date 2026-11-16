import { BRAND, getPlan } from '../shared/plans.ts';
import type { AiTask } from '../shared/types.ts';
import { useApp, useUi, type PassInfo, type SiteConfig } from './store.ts';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = useApp.getState().passToken;
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', 'Could not reach the server. Check your internet connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string } & T;
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'Something went wrong. Please try again.');
  return data;
}

export async function loadConfig(): Promise<void> {
  try {
    const config = await request<SiteConfig>('/api/config');
    useUi.getState().setConfig(config);
    // The server is the authority on whether a stored pass is still valid.
    if (!config.pass && useApp.getState().passToken) useApp.getState().clearPass();
  } catch {
    useUi.getState().setConfig({ payments: 'off', usd: false, ai: false, demo: false, free: { perDay: 0, used: 0 }, pass: null });
  }
}

interface AiResponse<T> {
  result: T;
  quota: { plan: string; used: number; limit: number };
}

/**
 * Runs an AI feature. Opens the pricing dialog when the visitor has no pass
 * and no free actions left, and returns null in that case.
 */
export async function runAi<T>(task: AiTask, input: Record<string, unknown>): Promise<T | null> {
  const ui = useUi.getState();
  try {
    const res = await request<AiResponse<T>>('/api/ai', { method: 'POST', body: { task, input } });
    if (res.quota.plan === 'free') ui.setFreeUsed(res.quota.used);
    return res.result;
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'free_limit' || err.code === 'pass_required')) {
      ui.openPaywall(err.code === 'free_limit' ? "You've used today's free AI actions." : 'AI features need a pass.');
      return null;
    }
    ui.toast(err instanceof Error ? err.message : 'Something went wrong.', 'error');
    return null;
  }
}

// ---- Payments -----------------------------------------------------------

interface OrderResponse {
  mock?: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  plan: string;
}

interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: (r: unknown) => void): void };
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new ApiError(0, 'offline', 'Could not load the payment window. Check your connection and try again.'));
    document.head.appendChild(s);
  });
}

function openCheckout(order: OrderResponse, contact: { name: string; email: string; phone: string }): Promise<RazorpayResult | null> {
  const plan = getPlan(order.plan);
  return new Promise((resolve) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: BRAND.name,
      description: plan ? `${plan.name} (one-time payment)` : 'AI pass',
      prefill: { name: contact.name, email: contact.email, contact: contact.phone },
      theme: { color: '#0b8f5a' },
      handler: (result: RazorpayResult) => resolve(result),
      modal: { ondismiss: () => resolve(null) },
    });
    rzp.open();
  });
}

/** Buys a pass. Resolves true when the pass is active. `confirmDemo` is used only in demo mode. */
export async function buyPass(planId: string, currency: 'INR' | 'USD', confirmDemo: (order: OrderResponse) => Promise<boolean>): Promise<boolean> {
  const order = await request<OrderResponse>('/api/order', { method: 'POST', body: { plan: planId, currency } });
  let verifyBody: Record<string, unknown>;
  if (order.mock) {
    if (!(await confirmDemo(order))) return false;
    verifyBody = { orderId: order.orderId, plan: order.plan };
  } else {
    await loadCheckoutScript();
    const b = useApp.getState().resumes.find((r) => r.id === useApp.getState().activeResumeId)?.basics;
    const result = await openCheckout(order, { name: b?.name ?? '', email: b?.email ?? '', phone: b?.phone ?? '' });
    if (!result) return false;
    verifyBody = { ...result };
  }
  const res = await request<{ token: string; pass: PassInfo & { id: string } }>('/api/verify', { method: 'POST', body: verifyBody });
  useApp.getState().setPass(res.token, { plan: res.pass.plan, exp: res.pass.exp });
  // Keep the payment ID where the buyer can find it again.
  try {
    localStorage.setItem('sahicv:lastPayment', res.pass.id);
  } catch {
    /* storage may be unavailable */
  }
  await loadConfig();
  return true;
}

export async function restorePass(paymentId: string): Promise<void> {
  const res = await request<{ token: string; pass: PassInfo }>('/api/restore', { method: 'POST', body: { paymentId } });
  useApp.getState().setPass(res.token, { plan: res.pass.plan, exp: res.pass.exp });
  await loadConfig();
}

export type { OrderResponse };
