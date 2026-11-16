import type { Design, Resume, TemplateId, FontId } from '../../shared/types.ts';
import type { Block, DocSpec, Flow, Op, Run } from './engine/layout.ts';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  /** Single-column templates are the safest for applicant tracking systems. */
  atsSafe: boolean;
  font: FontId;
  accent: string;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean sans-serif with a colour accent. A safe default for most roles.',
    atsSafe: true,
    font: 'inter',
    accent: '#1d4ed8',
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Centred serif layout used by consulting, finance and academia.',
    atsSafe: true,
    font: 'source-serif-4',
    accent: '#111827',
  },
  {
    id: 'crisp',
    name: 'Crisp',
    description: 'Bold colour header band that stands out in a pile.',
    atsSafe: true,
    font: 'lato',
    accent: '#0f766e',
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'Elegant Garamond with shaded headings for senior profiles.',
    atsSafe: true,
    font: 'eb-garamond',
    accent: '#7c2d12',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Tight spacing that fits a long career on one page.',
    atsSafe: true,
    font: 'inter',
    accent: '#334155',
  },
  {
    id: 'sidebar',
    name: 'Sidebar',
    description: 'Two columns. Looks great to people; some older ATS read columns out of order.',
    atsSafe: false,
    font: 'lato',
    accent: '#4338ca',
  },
];

export const ACCENTS = [
  '#111827',
  '#334155',
  '#1d4ed8',
  '#4338ca',
  '#7c3aed',
  '#be185d',
  '#b91c1c',
  '#7c2d12',
  '#b45309',
  '#15803d',
  '#0f766e',
  '#0369a1',
];

export const SECTION_TITLES: Record<string, string> = {
  summary: 'Summary',
  experience: 'Work Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
  achievements: 'Achievements',
  languages: 'Languages',
};

export const PAGE_SIZES = {
  A4: { w: 595.28, h: 841.89 },
  Letter: { w: 612, h: 792 },
};

const INK = '#1f2937';
const MUTED = '#4b5563';
const HAIR = '#d1d5db';

function mix(hex: string, target: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex);
  const b = p(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function stripUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : `https://${u}`;
}

export function dateRange(start: string, end: string, current?: boolean): string {
  const e = current ? 'Present' : end;
  if (start && e) return `${start} – ${e}`;
  return start || e || '';
}

interface Theme {
  d: Design;
  base: number;
  s: number; // spacing factor
  lh: number;
  accent: string;
}

function theme(d: Design): Theme {
  const s = d.spacing === 'compact' ? 0.8 : d.spacing === 'relaxed' ? 1.2 : 1;
  const lh = d.spacing === 'compact' ? 1.3 : d.spacing === 'relaxed' ? 1.5 : 1.4;
  return { d, base: d.fontSize, s, lh, accent: d.accent };
}

interface Entry {
  head: Block[];
  rest: Block[];
}

function bulletBlocks(t: Theme, bullets: string[], color = INK, markerColor?: string): Block[] {
  return bullets
    .filter((b) => b && b.trim())
    .map((b) => ({
      type: 'bullet' as const,
      runs: [{ text: b.trim() }],
      size: t.base,
      color,
      markerColor,
      lineHeight: t.lh,
      before: 1.5 * t.s,
    }));
}

function splitEntry(head: Block[], bullets: Block[]): Entry {
  // Keep the entry heading together with its first bullet.
  return { head: [...head, ...bullets.slice(0, 1)], rest: bullets.slice(1) };
}

type HeadingStyle = 'rule' | 'accent-rule' | 'bar' | 'shaded' | 'side';

function heading(t: Theme, title: string, style: HeadingStyle): Block[] {
  const size = t.base * 1.06;
  const text = title.toUpperCase();
  const before = 11 * t.s;
  switch (style) {
    case 'rule':
      return [
        { type: 'para', runs: [{ text, style: 'bold' }], size, color: INK, tracking: 0.7, before },
        { type: 'rule', color: INK, thickness: 0.7, before: 1.5, after: 4.5 * t.s },
      ];
    case 'accent-rule':
      return [
        { type: 'para', runs: [{ text, style: 'bold' }], size, color: t.accent, tracking: 0.8, before },
        { type: 'rule', color: HAIR, thickness: 0.7, before: 1.5, after: 4.5 * t.s },
      ];
    case 'bar':
      return [
        {
          type: 'box',
          bar: { w: 3, color: t.accent },
          padY: 1,
          before,
          after: 5 * t.s,
          blocks: [{ type: 'para', runs: [{ text, style: 'bold' }], size, color: INK, tracking: 0.8 }],
        },
      ];
    case 'shaded':
      return [
        {
          type: 'box',
          fill: mix(t.accent, '#ffffff', 0.9),
          padX: 6,
          padY: 2.5,
          before,
          after: 5.5 * t.s,
          blocks: [
            { type: 'para', runs: [{ text, style: 'bold' }], size, color: t.accent, tracking: 1.2, align: 'center' },
          ],
        },
      ];
    case 'side':
      return [
        { type: 'para', runs: [{ text, style: 'bold' }], size: t.base, color: t.accent, tracking: 0.9, before: 12 * t.s },
        { type: 'rule', color: mix(t.accent, '#ffffff', 0.55), thickness: 0.7, before: 1.5, after: 4 * t.s },
      ];
  }
}

function sectionEntries(t: Theme, r: Resume, key: string, opts: { oneLine?: boolean; sub?: string } = {}): Entry[] {
  const sub = opts.sub ?? MUTED;
  const gap = 7 * t.s;
  const first = (i: number) => (i === 0 ? 0 : gap);

  if (key === 'summary') {
    return r.basics.summary
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p, i) => ({
        head: [
          { type: 'para', runs: [{ text: p.trim() }], size: t.base, color: INK, lineHeight: t.lh, before: i ? 3 : 0 },
        ],
        rest: [],
      }));
  }

  if (key === 'experience') {
    return r.experience
      .filter((e) => e.title || e.company)
      .map((e, i) => {
        const dates = dateRange(e.start, e.end, e.current);
        const head: Block[] = [];
        if (opts.oneLine) {
          const left: Run[] = [{ text: e.title || e.company, style: 'bold' }];
          const extra = [e.title ? e.company : '', e.location].filter(Boolean).join(', ');
          if (extra) left.push({ text: ` — ${extra}` });
          head.push({ type: 'row', left, right: [{ text: dates }], size: t.base * 1.02, color: INK, rightColor: sub, rightSize: t.base * 0.95, before: first(i) });
        } else {
          head.push({
            type: 'row',
            left: [{ text: e.title || e.company, style: 'bold' }],
            right: [{ text: dates }],
            size: t.base * 1.05,
            color: INK,
            rightColor: sub,
            rightSize: t.base * 0.95,
            before: first(i),
          });
          const line2 = [e.title ? e.company : '', e.location].filter(Boolean).join(', ');
          if (line2) head.push({ type: 'para', runs: [{ text: line2, style: 'italic' }], size: t.base, color: sub, after: 1 });
        }
        return splitEntry(head, bulletBlocks(t, e.bullets));
      });
  }

  if (key === 'education') {
    return r.education
      .filter((e) => e.degree || e.school)
      .map((e, i) => {
        const dates = dateRange(e.start, e.end);
        const head: Block[] = [
          {
            type: 'row',
            left: [{ text: e.degree || e.school, style: 'bold' }],
            right: [{ text: dates }],
            size: t.base * 1.03,
            color: INK,
            rightColor: sub,
            rightSize: t.base * 0.95,
            before: first(i),
          },
        ];
        const where = [e.degree ? e.school : '', e.location].filter(Boolean).join(', ');
        const runs: Run[] = [];
        if (where) runs.push({ text: where, style: 'italic', color: sub });
        if (e.score) runs.push({ text: (where ? '  ·  ' : '') + e.score, color: INK });
        if (runs.length) head.push({ type: 'para', runs, size: t.base, color: sub });
        return { head, rest: [] };
      });
  }

  if (key === 'projects') {
    return r.projects
      .filter((p) => p.name)
      .map((p, i) => {
        const left: Run[] = [{ text: p.name, style: 'bold' }];
        if (p.link) left.push({ text: `  ${stripUrl(p.link)}`, color: t.accent, link: normalizeUrl(p.link) });
        const head: Block[] = [
          {
            type: 'row',
            left,
            right: [{ text: dateRange(p.start, p.end) }],
            size: t.base * 1.03,
            color: INK,
            rightColor: sub,
            rightSize: t.base * 0.95,
            before: first(i),
          },
        ];
        if (p.tech) head.push({ type: 'para', runs: [{ text: p.tech, style: 'italic' }], size: t.base, color: sub, after: 1 });
        return splitEntry(head, bulletBlocks(t, p.bullets));
      });
  }

  if (key === 'skills') {
    return r.skills
      .filter((g) => g.items.trim())
      .map((g, i) => {
        const runs: Run[] = [];
        if (g.name.trim()) runs.push({ text: `${g.name.trim()}: `, style: 'bold' });
        runs.push({ text: g.items.trim() });
        return { head: [{ type: 'para', runs, size: t.base, color: INK, lineHeight: t.lh, before: i ? 2 * t.s : 0 }], rest: [] };
      });
  }

  if (key === 'certifications') {
    return r.certifications
      .filter((c) => c.name)
      .map((c, i) => {
        const left: Run[] = [{ text: c.name, style: 'bold' }];
        if (c.issuer) left.push({ text: ` — ${c.issuer}` });
        return {
          head: [{ type: 'row', left, right: [{ text: c.date }], size: t.base, color: INK, rightColor: sub, rightSize: t.base * 0.95, before: i ? 2 * t.s : 0 }],
          rest: [],
        };
      });
  }

  if (key === 'achievements') {
    const b = bulletBlocks(t, r.achievements);
    return b.length ? [{ head: b.slice(0, 1), rest: b.slice(1) }] : [];
  }

  if (key === 'languages') {
    return r.languages.trim()
      ? [{ head: [{ type: 'para', runs: [{ text: r.languages.trim() }], size: t.base, color: INK, lineHeight: t.lh }], rest: [] }]
      : [];
  }

  if (key.startsWith('custom:')) {
    const c = r.custom.find((x) => `custom:${x.id}` === key);
    if (!c) return [];
    const b = bulletBlocks(t, c.bullets);
    return b.length ? [{ head: b.slice(0, 1), rest: b.slice(1) }] : [];
  }
  return [];
}

export function sectionTitle(r: Resume, key: string): string {
  if (key.startsWith('custom:')) {
    return r.custom.find((x) => `custom:${x.id}` === key)?.title || 'Additional';
  }
  return SECTION_TITLES[key] ?? key;
}

function sectionBlocks(t: Theme, r: Resume, key: string, style: HeadingStyle, opts?: { oneLine?: boolean; sub?: string }): Block[] {
  const entries = sectionEntries(t, r, key, opts);
  if (!entries.length) return [];
  const out: Block[] = [];
  entries.forEach((e, i) => {
    if (i === 0) out.push({ type: 'group', blocks: [...heading(t, sectionTitle(r, key), style), ...e.head] });
    else out.push({ type: 'group', blocks: e.head });
    out.push(...e.rest);
  });
  return out;
}

function contactRuns(r: Resume, color: string, linkColor: string, sep = '  |  '): Run[] {
  const b = r.basics;
  const items: Run[] = [];
  if (b.phone) items.push({ text: b.phone, link: `tel:${b.phone.replace(/[^\d+]/g, '')}` });
  if (b.email) items.push({ text: b.email, link: `mailto:${b.email}` });
  if (b.location) items.push({ text: b.location });
  for (const l of b.links) {
    if (l.url.trim()) items.push({ text: stripUrl(l.url.trim()), link: normalizeUrl(l.url), color: linkColor });
  }
  const runs: Run[] = [];
  items.forEach((it, i) => {
    if (i) runs.push({ text: sep, color, sep: true });
    runs.push(it);
  });
  return runs;
}

function orderedKeys(r: Resume): string[] {
  const known = new Set([
    'summary',
    'experience',
    'education',
    'projects',
    'skills',
    'certifications',
    'achievements',
    'languages',
    ...r.custom.map((c) => `custom:${c.id}`),
  ]);
  const seen = new Set<string>();
  const keys = r.order.filter((k) => known.has(k) && !seen.has(k) && seen.add(k));
  for (const k of known) if (!seen.has(k)) keys.push(k);
  return keys;
}

export function resumeSectionKeys(r: Resume): string[] {
  return orderedKeys(r);
}

function singleColumn(r: Resume, t: Theme): DocSpec {
  const page = PAGE_SIZES[t.d.page];
  const tpl = t.d.template;
  const margin = tpl === 'compact' ? 34 : tpl === 'executive' ? 50 : 44;
  const x = margin;
  const w = page.w - margin * 2;
  const b = r.basics;
  const blocks: Block[] = [];

  if (tpl === 'classic') {
    blocks.push({ type: 'para', runs: [{ text: b.name || 'Your Name', style: 'bold' }], size: t.base * 2.3, color: t.accent, align: 'center', lineHeight: 1.2 });
    if (b.headline) blocks.push({ type: 'para', runs: [{ text: b.headline }], size: t.base * 1.1, color: MUTED, align: 'center', before: 1 });
    blocks.push({ type: 'para', runs: contactRuns(r, MUTED, INK), size: t.base * 0.95, color: INK, align: 'center', before: 4 });
    blocks.push({ type: 'space', h: 2 });
  } else if (tpl === 'modern') {
    blocks.push({ type: 'para', runs: [{ text: b.name || 'Your Name', style: 'bold' }], size: t.base * 2.5, color: t.accent, lineHeight: 1.15 });
    if (b.headline) blocks.push({ type: 'para', runs: [{ text: b.headline }], size: t.base * 1.2, color: INK, before: 2 });
    blocks.push({ type: 'para', runs: contactRuns(r, HAIR, t.accent), size: t.base * 0.95, color: MUTED, before: 5 });
    blocks.push({ type: 'space', h: 2 });
  } else if (tpl === 'crisp') {
    const soft = mix(t.accent, '#ffffff', 0.82);
    blocks.push({
      type: 'box',
      fill: t.accent,
      bleed: true,
      padY: 20,
      after: 6,
      blocks: [
        { type: 'para', runs: [{ text: b.name || 'Your Name', style: 'bold' }], size: t.base * 2.5, color: '#ffffff', lineHeight: 1.15 },
        ...(b.headline ? [{ type: 'para' as const, runs: [{ text: b.headline }], size: t.base * 1.2, color: soft, before: 2 }] : []),
        { type: 'para', runs: contactRuns(r, soft, '#ffffff'), size: t.base * 0.95, color: '#ffffff', before: 7 },
      ],
    });
  } else if (tpl === 'executive') {
    blocks.push({ type: 'para', runs: [{ text: (b.name || 'Your Name').toUpperCase(), style: 'bold' }], size: t.base * 2.2, color: t.accent, align: 'center', tracking: 2.2, lineHeight: 1.2 });
    if (b.headline) blocks.push({ type: 'para', runs: [{ text: b.headline, style: 'italic' }], size: t.base * 1.2, color: MUTED, align: 'center', before: 2 });
    blocks.push({ type: 'rule', color: t.accent, thickness: 0.8, before: 6, after: 4 });
    blocks.push({ type: 'para', runs: contactRuns(r, MUTED, INK, '   •   '), size: t.base * 0.98, color: INK, align: 'center' });
    blocks.push({ type: 'rule', color: t.accent, thickness: 0.8, before: 4, after: 2 });
  } else {
    // compact
    blocks.push({
      type: 'row',
      left: [{ text: b.name || 'Your Name', style: 'bold', color: t.accent }],
      right: [{ text: b.headline }],
      size: t.base * 2,
      rightSize: t.base * 1.05,
      color: INK,
      rightColor: MUTED,
      lineHeight: 1.2,
    });
    blocks.push({ type: 'para', runs: contactRuns(r, HAIR, t.accent), size: t.base * 0.93, color: MUTED, before: 3 });
    blocks.push({ type: 'rule', color: t.accent, thickness: 1.2, before: 5 });
  }

  const style: HeadingStyle =
    tpl === 'classic' ? 'rule' : tpl === 'crisp' ? 'bar' : tpl === 'executive' ? 'shaded' : 'accent-rule';
  for (const key of orderedKeys(r)) {
    blocks.push(...sectionBlocks(t, r, key, style, { oneLine: tpl === 'compact' }));
  }

  const top = margin - 4;
  const flow: Flow = { x, w, top, firstTop: tpl === 'crisp' ? 0 : top, bottom: page.h - margin + 6, blocks };
  return { page, flows: [flow] };
}

function sidebarLayout(r: Resume, t: Theme): DocSpec {
  const page = PAGE_SIZES[t.d.page];
  const sideW = 182;
  const pad = 20;
  const tint = mix(t.accent, '#ffffff', 0.9);
  const b = r.basics;
  const sideKeys = new Set(['skills', 'languages', 'certifications']);

  const side: Block[] = [];
  side.push(...heading(t, 'Contact', 'side').map((h, i) => (i === 0 && h.type === 'para' ? { ...h, before: 0 } : h)));
  const contact: Run[] = [];
  if (b.phone) contact.push({ text: b.phone, link: `tel:${b.phone.replace(/[^\d+]/g, '')}` });
  if (b.email) contact.push({ text: b.email, link: `mailto:${b.email}` });
  if (b.location) contact.push({ text: b.location });
  for (const l of b.links) if (l.url.trim()) contact.push({ text: stripUrl(l.url.trim()), link: normalizeUrl(l.url), color: t.accent });
  contact.forEach((run, i) => side.push({ type: 'para', runs: [run], size: t.base * 0.93, color: INK, before: i ? 3 : 0 }));

  const small: Theme = { ...t, base: t.base * 0.95 };
  for (const key of orderedKeys(r)) {
    if (!sideKeys.has(key)) continue;
    if (key === 'skills') {
      const groups = r.skills.filter((g) => g.items.trim());
      if (!groups.length) continue;
      side.push(...heading(t, 'Skills', 'side'));
      groups.forEach((g, i) => {
        if (g.name.trim()) side.push({ type: 'para', runs: [{ text: g.name.trim(), style: 'bold' }], size: small.base, color: INK, before: i ? 5 * t.s : 0 });
        side.push({ type: 'para', runs: [{ text: g.items.trim() }], size: small.base, color: INK, lineHeight: t.lh });
      });
    } else if (key === 'certifications') {
      const certs = r.certifications.filter((c) => c.name);
      if (!certs.length) continue;
      side.push(...heading(t, 'Certifications', 'side'));
      certs.forEach((c, i) => {
        side.push({ type: 'para', runs: [{ text: c.name, style: 'bold' }], size: small.base, color: INK, before: i ? 5 * t.s : 0 });
        const meta = [c.issuer, c.date].filter(Boolean).join(', ');
        if (meta) side.push({ type: 'para', runs: [{ text: meta }], size: small.base * 0.97, color: MUTED });
      });
    } else {
      side.push(...sectionBlocks(small, r, key, 'side'));
    }
  }

  const main: Block[] = [];
  main.push({ type: 'para', runs: [{ text: b.name || 'Your Name', style: 'bold' }], size: t.base * 2.4, color: t.accent, lineHeight: 1.15 });
  if (b.headline) main.push({ type: 'para', runs: [{ text: b.headline }], size: t.base * 1.2, color: INK, before: 2 });
  main.push({ type: 'space', h: 2 });
  for (const key of orderedKeys(r)) {
    if (sideKeys.has(key)) continue;
    main.push(...sectionBlocks(t, r, key, 'accent-rule'));
  }

  const top = 40;
  const bottom = page.h - 36;
  const mainX = sideW + 26;
  return {
    page,
    // Main column first so text-extraction order starts with name and experience.
    flows: [
      { x: mainX, w: page.w - mainX - 38, top, bottom, blocks: main },
      { x: pad, w: sideW - pad * 2 + 6, top, bottom, blocks: side },
    ],
    decorate: (): Op[] => [{ t: 'rect', x: 0, y: 0, w: sideW, h: page.h, fill: tint }],
  };
}

export function buildResumeDoc(r: Resume): DocSpec {
  const t = theme(r.design);
  if (r.design.template === 'sidebar') return sidebarLayout(r, t);
  return singleColumn(r, t);
}

export interface LetterInput {
  name: string;
  contact: string;
  date: string;
  body: string;
  design: Design;
}

/** A simple one-column letter that matches the resume's font and accent. */
export function buildLetterDoc(l: LetterInput): DocSpec {
  const t = theme(l.design);
  const page = PAGE_SIZES[l.design.page];
  const margin = 56;
  const size = Math.max(t.base, 10.5);
  const blocks: Block[] = [
    { type: 'para', runs: [{ text: l.name, style: 'bold' }], size: size * 1.8, color: t.accent, lineHeight: 1.2 },
    { type: 'para', runs: [{ text: l.contact }], size: size * 0.95, color: MUTED, before: 3 },
    { type: 'rule', color: HAIR, thickness: 0.8, before: 8, after: 14 },
    { type: 'para', runs: [{ text: l.date }], size, color: MUTED, after: 10 },
  ];
  for (const p of l.body.split(/\n\s*\n/)) {
    const lines = p.split('\n').filter((x) => x.trim());
    lines.forEach((line, i) =>
      blocks.push({ type: 'para', runs: [{ text: line.trim() }], size, color: INK, lineHeight: 1.5, before: i === 0 ? 9 : 0 }),
    );
  }
  return { page, flows: [{ x: margin, w: page.w - margin * 2, top: margin, bottom: page.h - margin, blocks }] };
}
