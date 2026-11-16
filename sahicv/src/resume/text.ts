import type { Resume } from '../../shared/types.ts';
import { dateRange, resumeSectionKeys, sectionTitle } from './templates.ts';

function clean(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Plain-text resume: the format job portals and ATS paste boxes accept. */
export function resumeToText(r: Resume): string {
  const b = r.basics;
  const out: string[] = [];
  out.push(b.name);
  if (b.headline) out.push(b.headline);
  const contact = [b.phone, b.email, b.location, ...b.links.map((l) => l.url)].filter(Boolean);
  if (contact.length) out.push(contact.join(' | '));
  for (const key of resumeSectionKeys(r)) {
    const body = sectionText(r, key, '- ');
    if (!body.length) continue;
    out.push('', sectionTitle(r, key).toUpperCase(), ...body);
  }
  return clean(out);
}

export function resumeToMarkdown(r: Resume): string {
  const b = r.basics;
  const out: string[] = [];
  out.push(`# ${b.name}`);
  if (b.headline) out.push(`**${b.headline}**`);
  const contact = [b.phone, b.email, b.location, ...b.links.map((l) => l.url)].filter(Boolean);
  if (contact.length) out.push('', contact.join(' · '));
  for (const key of resumeSectionKeys(r)) {
    const body = sectionText(r, key, '- ', true);
    if (!body.length) continue;
    out.push('', `## ${sectionTitle(r, key)}`, '', ...body);
  }
  return clean(out);
}

function sectionText(r: Resume, key: string, bullet: string, md = false): string[] {
  const bold = (s: string) => (md ? `**${s}**` : s);
  const out: string[] = [];
  const bullets = (items: string[]) => items.filter((x) => x.trim()).forEach((x) => out.push(bullet + x.trim()));
  switch (key) {
    case 'summary':
      if (r.basics.summary.trim()) out.push(r.basics.summary.trim());
      break;
    case 'experience':
      r.experience
        .filter((e) => e.title || e.company)
        .forEach((e, i) => {
          if (i) out.push('');
          const where = [e.company, e.location].filter(Boolean).join(', ');
          const dates = dateRange(e.start, e.end, e.current);
          out.push([bold(e.title || e.company), e.title ? where : e.location, dates].filter(Boolean).join(' | '));
          bullets(e.bullets);
        });
      break;
    case 'education':
      r.education
        .filter((e) => e.degree || e.school)
        .forEach((e) => {
          const where = [e.school, e.location].filter(Boolean).join(', ');
          out.push([bold(e.degree || e.school), e.degree ? where : '', dateRange(e.start, e.end), e.score].filter(Boolean).join(' | '));
        });
      break;
    case 'projects':
      r.projects
        .filter((p) => p.name)
        .forEach((p, i) => {
          if (i) out.push('');
          out.push([bold(p.name), p.tech, p.link, dateRange(p.start, p.end)].filter(Boolean).join(' | '));
          bullets(p.bullets);
        });
      break;
    case 'skills':
      r.skills
        .filter((g) => g.items.trim())
        .forEach((g) => out.push(g.name.trim() ? `${bold(g.name.trim() + ':')} ${g.items.trim()}` : g.items.trim()));
      break;
    case 'certifications':
      r.certifications
        .filter((c) => c.name)
        .forEach((c) => out.push(bullet + [c.name, c.issuer, c.date].filter(Boolean).join(', ')));
      break;
    case 'achievements':
      bullets(r.achievements);
      break;
    case 'languages':
      if (r.languages.trim()) out.push(r.languages.trim());
      break;
    default:
      if (key.startsWith('custom:')) {
        const c = r.custom.find((x) => `custom:${x.id}` === key);
        if (c) bullets(c.bullets);
      }
  }
  return out;
}

export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’+#.-]*/gu) ?? []).length;
}

export function fileSafe(name: string): string {
  return (name || 'resume').trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'resume';
}
