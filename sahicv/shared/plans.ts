// Single source of truth for the brand, prices and limits.
// Change values here and both the website and the payment server follow.

export const BRAND = {
  name: 'SahiCV',
  tagline: 'The resume that gets you shortlisted',
  /** Shown on policy pages and receipts. Replace before launch. */
  supportEmail: 'support@example.com',
  legalName: 'SahiCV',
  city: 'India',
};

export type PlanId = 'week' | 'month' | 'quarter';

export interface Plan {
  id: PlanId;
  name: string;
  days: number;
  /** Price in paise (INR) and cents (USD). */
  inr: number;
  usd: number;
  blurb: string;
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'week',
    name: '7-day pass',
    days: 7,
    inr: 9900,
    usd: 299,
    blurb: 'One application sprint',
  },
  {
    id: 'month',
    name: '30-day pass',
    days: 30,
    inr: 24900,
    usd: 599,
    blurb: 'A full job search',
    popular: true,
  },
  {
    id: 'quarter',
    name: '90-day pass',
    days: 90,
    inr: 49900,
    usd: 999,
    blurb: 'Placement season or a career switch',
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function formatPrice(plan: Plan, currency: 'INR' | 'USD'): string {
  if (currency === 'USD') return `$${(plan.usd / 100).toFixed(2)}`;
  return `₹${Math.round(plan.inr / 100)}`;
}

/** AI actions allowed per day. */
export const LIMITS = {
  /** Free AI actions per visitor per day (needs the usage database). */
  freePerDay: 3,
  /** Fair-use ceiling for pass holders. */
  passPerDay: 150,
  /** Largest text accepted for a resume or job description, in characters. */
  maxResumeChars: 24000,
  maxJdChars: 12000,
  maxAnswerChars: 4000,
};
