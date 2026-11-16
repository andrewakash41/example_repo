import { useRef, useState } from 'react';
import { BRAND, PLANS, formatPrice, type Plan } from '../../shared/plans.ts';
import { ApiError, buyPass, restorePass, type OrderResponse } from '../api.ts';
import { useApp, useUi } from '../store.ts';
import { Button, Icon, Input, Modal } from './ui.tsx';

export function daysLeft(exp: number): number {
  return Math.max(0, Math.ceil((exp * 1000 - Date.now()) / 86_400_000));
}

/** What the visitor can do with AI right now. */
export function useAllowance() {
  const pass = useApp((s) => s.pass);
  const config = useUi((s) => s.config);
  const active = Boolean(pass && pass.exp * 1000 > Date.now());
  const freeLeft = config ? Math.max(0, config.free.perDay - config.free.used) : 0;
  return { active, pass, freeLeft, freePerDay: config?.free.perDay ?? 0, aiOn: config?.ai ?? false, demo: config?.demo ?? false, loaded: Boolean(config) };
}

/** Small status line shown next to AI buttons. */
export function AiNote() {
  const a = useAllowance();
  const open = useUi((s) => s.openPaywall);
  if (!a.loaded) return null;
  if (!a.aiOn) return <span className="ai-note">AI features are not switched on for this site yet.</span>;
  if (a.active && a.pass) return <span className="ai-note ai-note-on">Pass active · {daysLeft(a.pass.exp)} days left</span>;
  return (
    <span className="ai-note">
      {a.freePerDay > 0 ? `${a.freeLeft} of ${a.freePerDay} free AI actions left today · ` : 'AI features need a pass · '}
      <button className="link-btn" onClick={() => open('')}>
        Get unlimited
      </button>
    </span>
  );
}

export function PassButton() {
  const a = useAllowance();
  const open = useUi((s) => s.openPaywall);
  if (a.active && a.pass) {
    return (
      <button className="pass-pill pass-pill-on" onClick={() => open('')} title="Your AI pass">
        <Icon name="check" size={14} /> Pass · {daysLeft(a.pass.exp)}d left
      </button>
    );
  }
  return (
    <button className="pass-pill" onClick={() => open('')}>
      <Icon name="spark" size={14} /> Unlock AI
    </button>
  );
}

const INCLUDED = [
  'Tailor your resume to any job description',
  'Rewrite bullets and summaries',
  'Cover letters in your own voice',
  'Likely interview questions with sample answers',
  'Mock interviews with honest feedback',
  'Company briefings and LinkedIn / Naukri headlines',
];

export function PlanCards({ onBought }: { onBought?(): void }) {
  const config = useUi((s) => s.config);
  const toast = useUi((s) => s.toast);
  const a = useAllowance();
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [busy, setBusy] = useState<string | null>(null);
  const [demoOrder, setDemoOrder] = useState<OrderResponse | null>(null);
  const demoResolve = useRef<((ok: boolean) => void) | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [restoring, setRestoring] = useState(false);

  const pay = async (plan: Plan) => {
    setBusy(plan.id);
    try {
      const ok = await buyPass(plan.id, currency, (order) => {
        setDemoOrder(order);
        return new Promise<boolean>((resolve) => {
          demoResolve.current = resolve;
        });
      });
      if (ok) {
        toast(`${plan.name} is active. Enjoy unlimited AI.`);
        onBought?.();
      }
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'The payment did not go through. You have not been charged.', 'error');
    } finally {
      setBusy(null);
      setDemoOrder(null);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      await restorePass(paymentId.trim());
      toast('Your pass has been restored.');
      onBought?.();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not restore that payment.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const off = config?.payments === 'off';

  return (
    <div className="plans-wrap">
      {a.active && a.pass ? (
        <div className="notice notice-ok">
          <Icon name="check" /> Your pass is active for {daysLeft(a.pass.exp)} more days. Buying another pass now starts a new period from today.
        </div>
      ) : null}
      {config?.usd ? (
        <div className="seg" role="tablist" aria-label="Currency">
          {(['INR', 'USD'] as const).map((c) => (
            <button key={c} role="tab" aria-selected={currency === c} className={currency === c ? 'on' : ''} onClick={() => setCurrency(c)}>
              {c === 'INR' ? '₹ INR' : '$ USD'}
            </button>
          ))}
        </div>
      ) : null}
      <div className="plans">
        {PLANS.map((p) => (
          <div key={p.id} className={`plan${p.popular ? ' plan-popular' : ''}`}>
            {p.popular ? <span className="plan-flag">Most popular</span> : null}
            <h3>{p.name}</h3>
            <p className="plan-blurb">{p.blurb}</p>
            <div className="plan-price">
              {formatPrice(p, currency)}
              <span> once</span>
            </div>
            <p className="plan-per">
              {currency === 'INR' ? `About ₹${(p.inr / 100 / p.days).toFixed(p.inr / 100 / p.days < 10 ? 1 : 0)} a day` : `About $${(p.usd / 100 / p.days).toFixed(2)} a day`}
            </p>
            <Button variant={p.popular ? 'primary' : 'secondary'} size="lg" busy={busy === p.id} disabled={off || Boolean(busy)} onClick={() => pay(p)} data-plan={p.id}>
              Get {p.days} days
            </Button>
          </div>
        ))}
      </div>
      {off ? <div className="notice">Payments are being set up on this site. Please check back soon.</div> : null}
      {demoOrder ? (
        <div className="notice notice-demo" role="alertdialog" aria-label="Demo payment">
          <strong>Demo mode.</strong> No real payment is taken on this test site.
          <div className="row">
            <Button variant="primary" onClick={() => demoResolve.current?.(true)}>
              Simulate successful payment
            </Button>
            <Button variant="ghost" onClick={() => demoResolve.current?.(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <ul className="included">
        {INCLUDED.map((x) => (
          <li key={x}>
            <Icon name="check" size={15} /> {x}
          </li>
        ))}
      </ul>
      <p className="fineprint">
        <Icon name="shield" size={14} /> One-time payment by UPI, card or netbanking through Razorpay. It never renews on its own, so there is nothing to cancel. Building,
        editing and downloading your resume stays free with or without a pass.
      </p>
      <div className="restore">
        <button className="link-btn" onClick={() => setRestoreOpen((v) => !v)}>
          Already paid on another device? Restore your pass
        </button>
        {restoreOpen ? (
          <div className="row restore-row">
            <Input value={paymentId} onChange={setPaymentId} placeholder="Payment ID from your Razorpay receipt (pay_…)" aria-label="Payment ID" />
            <Button busy={restoring} disabled={!paymentId.trim()} onClick={restore}>
              Restore
            </Button>
          </div>
        ) : null}
        {restoreOpen ? <p className="fineprint">The payment ID is in the receipt email or SMS from Razorpay. Need help? Write to {BRAND.supportEmail}.</p> : null}
      </div>
    </div>
  );
}

export function Paywall() {
  const paywall = useUi((s) => s.paywall);
  const close = useUi((s) => s.closePaywall);
  if (!paywall) return null;
  return (
    <Modal title="Unlimited AI for your job search" onClose={close} wide>
      {paywall.reason ? <p className="paywall-reason">{paywall.reason}</p> : null}
      <PlanCards onBought={close} />
    </Modal>
  );
}
