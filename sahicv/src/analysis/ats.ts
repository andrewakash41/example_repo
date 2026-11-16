import type { Resume } from '../../shared/types.ts';
import { resumeToText, wordCount } from '../resume/text.ts';
import { TEMPLATES } from '../resume/templates.ts';

// Resume health check. Rule-based, runs in the browser, free for everyone.

export type Status = 'pass' | 'warn' | 'fail';

export interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
  /** Specific lines to fix, when the check points at particular bullets. */
  examples?: string[];
  weight: number;
}

export interface AtsReport {
  score: number;
  checks: Check[];
  stats: { words: number; bullets: number; quantified: number; pages: number };
}

const ACTION_VERBS = new Set(
  `achieved accelerated administered advised analysed analyzed architected assembled assessed audited automated boosted built
  centralised centralized championed closed coached collaborated completed conducted consolidated constructed converted coordinated created
  cut debugged decreased defined delivered deployed designed developed devised directed doubled drafted drove earned eliminated enabled
  engineered enhanced established evaluated exceeded executed expanded expedited facilitated forecast forecasted formulated founded generated
  grew guided handled headed identified implemented improved increased influenced initiated instituted integrated introduced investigated
  launched led leveraged lowered maintained managed mapped maximised maximized mentored migrated minimised minimized modelled modeled
  modernised modernized monitored negotiated onboarded operated optimised optimized orchestrated organised organized overhauled oversaw
  partnered performed piloted pioneered planned prepared presented prioritised prioritized processed produced programmed published
  raised ran rebuilt recommended reconciled recruited redesigned reduced refactored refined released reorganised reorganized replaced
  reported researched resolved restructured revamped reviewed saved scaled secured served shipped simplified sold solved spearheaded
  standardised standardized streamlined strengthened supervised supported taught tested tracked trained transformed translated tripled
  troubleshot unified upgraded validated won wrote`
    .split(/\s+/)
    .filter(Boolean),
);

const WEAK_STARTS = [
  'responsible for',
  'worked on',
  'worked with',
  'worked as',
  'helped',
  'helping',
  'assisted',
  'duties included',
  'tasked with',
  'involved in',
  'participated in',
  'in charge of',
  'working on',
  'handling',
];

const CLICHES = [
  'hard working',
  'hardworking',
  'hard-working',
  'team player',
  'detail oriented',
  'detail-oriented',
  'go-getter',
  'self starter',
  'self-starter',
  'results driven',
  'results-driven',
  'think outside the box',
  'synergy',
  'dynamic individual',
  'quick learner',
  'passionate about',
  'highly motivated',
  'excellent communication skills',
];

function allBullets(r: Resume): string[] {
  return [
    ...r.experience.flatMap((e) => e.bullets),
    ...r.projects.flatMap((p) => p.bullets),
  ]
    .map((b) => b.trim())
    .filter(Boolean);
}

const hasNumber = (s: string) => /\d|₹|\$|%|\b(lakh|crore|million|billion|thousand)\b/i.test(s);

export function checkResume(r: Resume, pages = 1): AtsReport {
  const b = r.basics;
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const text = resumeToText(r);
  const words = wordCount(text);
  const bullets = allBullets(r);

  // --- Contact ---
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email.trim());
  const phoneDigits = b.phone.replace(/\D/g, '').length;
  const missing = [!b.name.trim() && 'name', !emailOk && 'a valid email', phoneDigits < 10 && 'a phone number', !b.location.trim() && 'city'].filter(Boolean);
  add({
    id: 'contact',
    label: 'Contact details',
    weight: 14,
    status: !b.name.trim() || !emailOk || phoneDigits < 10 ? 'fail' : missing.length ? 'warn' : 'pass',
    detail: missing.length ? `Add ${missing.join(', ')}. Recruiters cannot shortlist a resume they cannot reply to.` : 'Name, email, phone and city are all present.',
  });

  const hasLinkedIn = b.links.some((l) => /linkedin\.com/i.test(l.url));
  add({
    id: 'linkedin',
    label: 'LinkedIn link',
    weight: 4,
    status: hasLinkedIn ? 'pass' : 'warn',
    detail: hasLinkedIn ? 'LinkedIn profile linked.' : 'Add your LinkedIn URL. Most recruiters look you up before calling.',
  });

  // --- Summary ---
  const sw = wordCount(b.summary);
  add({
    id: 'summary',
    label: 'Summary',
    weight: 8,
    status: sw === 0 ? 'fail' : sw < 25 || sw > 90 ? 'warn' : 'pass',
    detail:
      sw === 0
        ? 'Add a 2–4 line summary: who you are, your strongest skills and one result.'
        : sw < 25
          ? `Your summary is ${sw} words. Aim for 30–70 so it says something concrete.`
          : sw > 90
            ? `Your summary is ${sw} words. Trim it to 30–70; recruiters skim it in seconds.`
            : `Good length (${sw} words).`,
  });

  // --- Core sections ---
  const expCount = r.experience.filter((e) => e.title || e.company).length;
  const projCount = r.projects.filter((p) => p.name).length;
  add({
    id: 'experience',
    label: 'Experience or projects',
    weight: 12,
    status: expCount + projCount === 0 ? 'fail' : 'pass',
    detail:
      expCount + projCount === 0
        ? 'Add work experience, internships or projects. Freshers: 2–3 projects with what you built and the result.'
        : `${expCount} role${expCount === 1 ? '' : 's'} and ${projCount} project${projCount === 1 ? '' : 's'} listed.`,
  });

  const eduCount = r.education.filter((e) => e.degree || e.school).length;
  add({
    id: 'education',
    label: 'Education',
    weight: 6,
    status: eduCount ? 'pass' : 'fail',
    detail: eduCount ? 'Education listed.' : 'Add your highest qualification with the year and score.',
  });

  const skillItems = r.skills.flatMap((g) => g.items.split(',')).map((s) => s.trim()).filter(Boolean);
  add({
    id: 'skills',
    label: 'Skills section',
    weight: 8,
    status: skillItems.length === 0 ? 'fail' : skillItems.length < 6 ? 'warn' : 'pass',
    detail:
      skillItems.length === 0
        ? 'Add a skills section. ATS keyword filters read it first.'
        : skillItems.length < 6
          ? `Only ${skillItems.length} skills listed. Add the tools and methods you actually use (aim for 8–20).`
          : `${skillItems.length} skills listed.`,
  });

  // --- Bullets ---
  const thin = r.experience.filter((e) => (e.title || e.company) && e.bullets.filter((x) => x.trim()).length < 2);
  add({
    id: 'bullets-count',
    label: 'Bullet points per role',
    weight: 7,
    status: expCount === 0 ? 'pass' : thin.length ? 'warn' : 'pass',
    detail: thin.length
      ? `${thin.map((e) => e.title || e.company).join(', ')}: add at least 2–3 bullets describing what you did and the result.`
      : 'Every role has enough bullet points.',
  });

  if (bullets.length) {
    const firstWord = (s: string) => s.replace(/^[^A-Za-z]+/, '').split(/\s+/)[0]?.toLowerCase() ?? '';
    const weak = bullets.filter((x) => WEAK_STARTS.some((w) => x.toLowerCase().startsWith(w)));
    const strong = bullets.filter((x) => ACTION_VERBS.has(firstWord(x)));
    const ratio = strong.length / bullets.length;
    add({
      id: 'verbs',
      label: 'Strong action verbs',
      weight: 10,
      status: weak.length > 0 || ratio < 0.5 ? (ratio < 0.3 ? 'fail' : 'warn') : 'pass',
      detail:
        weak.length > 0
          ? `${weak.length} bullet${weak.length === 1 ? ' starts' : 's start'} with a weak phrase like "Responsible for". Start with what you did: Built, Led, Reduced, Increased.`
          : ratio < 0.5
            ? `${strong.length} of ${bullets.length} bullets start with an action verb. Start each one with a verb such as Built, Led, Analysed or Delivered.`
            : `${strong.length} of ${bullets.length} bullets start with a strong verb.`,
      examples: weak.slice(0, 3),
    });

    const quantified = bullets.filter(hasNumber);
    const qr = quantified.length / bullets.length;
    add({
      id: 'numbers',
      label: 'Results with numbers',
      weight: 12,
      status: qr >= 0.4 ? 'pass' : qr >= 0.2 ? 'warn' : 'fail',
      detail:
        qr >= 0.4
          ? `${quantified.length} of ${bullets.length} bullets include a number. Recruiters trust measurable results.`
          : `Only ${quantified.length} of ${bullets.length} bullets include a number. Add how much, how many or how fast: %, ₹, users, hours saved, team size.`,
      examples: bullets.filter((x) => !hasNumber(x)).slice(0, 3),
    });

    const long = bullets.filter((x) => wordCount(x) > 34);
    const short = bullets.filter((x) => wordCount(x) < 6);
    add({
      id: 'length-bullets',
      label: 'Bullet length',
      weight: 5,
      status: long.length || short.length ? 'warn' : 'pass',
      detail:
        long.length || short.length
          ? `${long.length ? `${long.length} bullet${long.length === 1 ? ' is' : 's are'} over 34 words (split or trim). ` : ''}${short.length ? `${short.length} ${short.length === 1 ? 'is' : 'are'} under 6 words (add the result).` : ''}`.trim()
          : 'Bullets are a readable length.',
      examples: [...long, ...short].slice(0, 3),
    });

    const pronouns = bullets.filter((x) => /\b(I|my|me|myself)\b/.test(x));
    add({
      id: 'pronouns',
      label: 'No "I" or "my"',
      weight: 3,
      status: pronouns.length ? 'warn' : 'pass',
      detail: pronouns.length ? `${pronouns.length} bullet${pronouns.length === 1 ? ' uses' : 's use'} "I" or "my". Resumes drop the pronoun: "Led a team of 5", not "I led a team of 5".` : 'No first-person pronouns in bullets.',
      examples: pronouns.slice(0, 3),
    });

    const starts = new Map<string, number>();
    bullets.forEach((x) => {
      const w = firstWord(x);
      if (w) starts.set(w, (starts.get(w) ?? 0) + 1);
    });
    const repeated = [...starts.entries()].filter(([, n]) => n >= 4).map(([w]) => w);
    add({
      id: 'variety',
      label: 'Verb variety',
      weight: 3,
      status: repeated.length ? 'warn' : 'pass',
      detail: repeated.length ? `"${repeated.join('", "')}" starts 4 or more bullets. Vary the verbs.` : 'Good variety of opening verbs.',
    });
  }

  const lower = text.toLowerCase();
  const cliches = CLICHES.filter((c) => lower.includes(c));
  add({
    id: 'cliches',
    label: 'No empty buzzwords',
    weight: 3,
    status: cliches.length ? 'warn' : 'pass',
    detail: cliches.length ? `Replace "${cliches.slice(0, 3).join('", "')}" with proof. Show the result instead of claiming the trait.` : 'No overused buzzwords found.',
  });

  // --- Dates ---
  const undated = r.experience.filter((e) => (e.title || e.company) && (!e.start.trim() || (!e.end.trim() && !e.current)));
  add({
    id: 'dates',
    label: 'Dates on every role',
    weight: 5,
    status: undated.length ? 'warn' : 'pass',
    detail: undated.length ? `Add start and end dates for: ${undated.map((e) => e.title || e.company).join(', ')}. Missing dates look like hidden gaps.` : 'All roles have dates.',
  });

  // --- Length ---
  add({
    id: 'length',
    label: 'Length',
    weight: 6,
    status: pages > 2 || words > 900 ? 'warn' : words < 150 ? 'warn' : 'pass',
    detail:
      pages > 2
        ? `${pages} pages. Keep it to 1 page (under 5 years' experience) or 2 pages. Try compact spacing or the Compact template.`
        : words < 150
          ? `Only ${words} words. Add detail to your experience and projects.`
          : `${pages} page${pages === 1 ? '' : 's'}, ${words} words.`,
  });

  // --- Layout ---
  const tpl = TEMPLATES.find((t) => t.id === r.design.template);
  add({
    id: 'layout',
    label: 'ATS-safe layout',
    weight: 6,
    status: tpl?.atsSafe ? 'pass' : 'warn',
    detail: tpl?.atsSafe
      ? 'Single column, standard headings and real text: the layout ATS software reads most reliably.'
      : 'Two-column layouts can be read out of order by older ATS (for example Workday or Taleo). Use a single-column template for online applications.',
  });

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + c.weight * (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);
  const order: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };
  checks.sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight);
  return {
    score: Math.round((earned / total) * 100),
    checks,
    stats: { words, bullets: bullets.length, quantified: bullets.filter(hasNumber).length, pages },
  };
}
