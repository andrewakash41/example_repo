import type { Resume } from '../../../shared/types.ts';
import { dateRange, resumeSectionKeys, sectionTitle } from '../templates.ts';

// Word export. Deliberately plain: one column, real headings and real bullet
// lists, which is what applicant tracking systems parse most reliably.

const WORD_FONT: Record<string, string> = {
  inter: 'Calibri',
  lato: 'Calibri',
  'source-serif-4': 'Cambria',
  'eb-garamond': 'Garamond',
};

export async function resumeToDocx(r: Resume): Promise<Blob> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, TabStopType, BorderStyle, ExternalHyperlink, AlignmentType, LevelFormat } = docx;

  const font = WORD_FONT[r.design.font] ?? 'Calibri';
  const base = Math.round(r.design.fontSize * 2 + 1); // half-points; Word reads slightly small
  const accent = r.design.accent.replace('#', '');
  const page = r.design.page === 'Letter' ? { width: 12240, height: 15840 } : { width: 11906, height: 16838 };
  const margin = 900;
  const rightTab = page.width - margin * 2;
  const b = r.basics;
  const centered = r.design.template === 'classic' || r.design.template === 'executive';
  const align = centered ? AlignmentType.CENTER : AlignmentType.LEFT;

  type Para = InstanceType<typeof Paragraph>;
  const children: Para[] = [];
  const run = (text: string, opts: Record<string, unknown> = {}) => new TextRun({ text, font, size: base, ...opts });

  children.push(
    new Paragraph({
      alignment: align,
      spacing: { after: 40 },
      children: [run(b.name || 'Your Name', { bold: true, size: base * 2.2, color: accent })],
    }),
  );
  if (b.headline) {
    children.push(new Paragraph({ alignment: align, spacing: { after: 40 }, children: [run(b.headline, { size: base + 3 })] }));
  }
  const contactParts: (InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>)[] = [];
  const pushSep = () => contactParts.length && contactParts.push(run('  |  ', { color: '6b7280' }));
  if (b.phone) {
    pushSep();
    contactParts.push(run(b.phone));
  }
  if (b.email) {
    pushSep();
    contactParts.push(new ExternalHyperlink({ link: `mailto:${b.email}`, children: [run(b.email)] }));
  }
  if (b.location) {
    pushSep();
    contactParts.push(run(b.location));
  }
  for (const l of b.links) {
    if (!l.url.trim()) continue;
    pushSep();
    const url = /^https?:/i.test(l.url) ? l.url : `https://${l.url}`;
    contactParts.push(new ExternalHyperlink({ link: url, children: [run(l.url.replace(/^https?:\/\//i, ''), { color: accent })] }));
  }
  if (contactParts.length) children.push(new Paragraph({ alignment: align, spacing: { after: 80 }, children: contactParts }));

  const heading = (title: string) =>
    new Paragraph({
      spacing: { before: 220, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '9ca3af', space: 2 } },
      children: [run(title.toUpperCase(), { bold: true, color: accent, size: base + 1, characterSpacing: 12 })],
    });
  const bullet = (text: string) =>
    new Paragraph({ numbering: { reference: 'cv-bullets', level: 0 }, spacing: { after: 30 }, children: [run(text)] });
  const rowLine = (left: InstanceType<typeof TextRun>[], right: string, before = 0) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
      spacing: { before, after: 20 },
      children: right ? [...left, run(`\t${right}`, { color: '4b5563' })] : left,
    });

  for (const key of resumeSectionKeys(r)) {
    const body: Para[] = [];
    if (key === 'summary' && b.summary.trim()) {
      b.summary.split(/\n+/).filter((p) => p.trim()).forEach((p) => body.push(new Paragraph({ spacing: { after: 60 }, children: [run(p.trim())] })));
    } else if (key === 'experience') {
      r.experience.filter((e) => e.title || e.company).forEach((e, i) => {
        body.push(rowLine([run(e.title || e.company, { bold: true })], dateRange(e.start, e.end, e.current), i ? 120 : 0));
        const where = [e.title ? e.company : '', e.location].filter(Boolean).join(', ');
        if (where) body.push(new Paragraph({ spacing: { after: 30 }, children: [run(where, { italics: true, color: '4b5563' })] }));
        e.bullets.filter((x) => x.trim()).forEach((x) => body.push(bullet(x.trim())));
      });
    } else if (key === 'education') {
      r.education.filter((e) => e.degree || e.school).forEach((e, i) => {
        body.push(rowLine([run(e.degree || e.school, { bold: true })], dateRange(e.start, e.end), i ? 100 : 0));
        const where = [e.degree ? e.school : '', e.location, e.score].filter(Boolean).join(', ');
        if (where) body.push(new Paragraph({ spacing: { after: 30 }, children: [run(where, { color: '4b5563' })] }));
      });
    } else if (key === 'projects') {
      r.projects.filter((p) => p.name).forEach((p, i) => {
        const left = [run(p.name, { bold: true })];
        if (p.link) left.push(run(`  ${p.link.replace(/^https?:\/\//i, '')}`, { color: accent }));
        body.push(rowLine(left, dateRange(p.start, p.end), i ? 120 : 0));
        if (p.tech) body.push(new Paragraph({ spacing: { after: 30 }, children: [run(p.tech, { italics: true, color: '4b5563' })] }));
        p.bullets.filter((x) => x.trim()).forEach((x) => body.push(bullet(x.trim())));
      });
    } else if (key === 'skills') {
      r.skills.filter((g) => g.items.trim()).forEach((g) => {
        const runs = g.name.trim() ? [run(`${g.name.trim()}: `, { bold: true }), run(g.items.trim())] : [run(g.items.trim())];
        body.push(new Paragraph({ spacing: { after: 40 }, children: runs }));
      });
    } else if (key === 'certifications') {
      r.certifications.filter((c) => c.name).forEach((c) => {
        const left = [run(c.name, { bold: true })];
        if (c.issuer) left.push(run(` — ${c.issuer}`));
        body.push(rowLine(left, c.date));
      });
    } else if (key === 'achievements') {
      r.achievements.filter((x) => x.trim()).forEach((x) => body.push(bullet(x.trim())));
    } else if (key === 'languages' && r.languages.trim()) {
      body.push(new Paragraph({ children: [run(r.languages.trim())] }));
    } else if (key.startsWith('custom:')) {
      const c = r.custom.find((x) => `custom:${x.id}` === key);
      c?.bullets.filter((x) => x.trim()).forEach((x) => body.push(bullet(x.trim())));
    }
    if (body.length) children.push(heading(sectionTitle(r, key)), ...body);
  }

  const doc = new Document({
    creator: 'SahiCV',
    title: `${b.name} – Resume`,
    numbering: {
      config: [
        {
          reference: 'cv-bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 200 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { size: page, margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children }],
  });
  return Packer.toBlob(doc);
}

/** A cover letter as a Word document. */
export async function letterToDocx(name: string, contact: string, date: string, body: string, fontId: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const font = WORD_FONT[fontId] ?? 'Calibri';
  const p = (text: string, opts: Record<string, unknown> = {}, after = 160) =>
    new Paragraph({ spacing: { after }, children: [new TextRun({ text, font, size: 22, ...opts })] });
  const children = [p(name, { bold: true, size: 36 }, 40), p(contact, { color: '4b5563', size: 20 }, 240), p(date, { color: '4b5563' })];
  for (const para of body.split(/\n\s*\n/)) {
    const lines = para.split('\n').filter((x) => x.trim());
    lines.forEach((line, i) => children.push(p(line.trim(), {}, i === lines.length - 1 ? 160 : 0)));
  }
  const doc = new Document({ creator: 'SahiCV', title: `${name} – Cover letter`, sections: [{ children }] });
  return Packer.toBlob(doc);
}
