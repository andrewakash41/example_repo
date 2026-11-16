import { describe, expect, it } from 'vitest';
import { layoutDocument, layoutText } from '../src/resume/engine/layout.ts';
import { drawPdf } from '../src/resume/engine/pdf.ts';
import { emptyResume, normalizeResume, sampleResume } from '../src/resume/model.ts';
import { buildLetterDoc, buildResumeDoc, TEMPLATES } from '../src/resume/templates.ts';
import { resumeToMarkdown, resumeToText } from '../src/resume/text.ts';
import { JsPdf, loadNodeFont } from './helpers.ts';

const squash = (s: string) => s.replace(/\s+/g, ' ');

describe('layout engine', () => {
  for (const tpl of TEMPLATES) {
    it(`lays out the sample resume in the ${tpl.name} template without losing text or leaving the page`, () => {
      const r = sampleResume();
      r.design = { ...r.design, template: tpl.id, font: tpl.font, accent: tpl.accent };
      const font = loadNodeFont(tpl.font);
      const layout = layoutDocument(buildResumeDoc(r), font.measurer);
      expect(layout.pages.length).toBeGreaterThanOrEqual(1);
      expect(layout.pages.length).toBeLessThanOrEqual(2);

      const text = squash(layoutText(layout));
      expect(text.toLowerCase()).toContain(r.basics.name.toLowerCase());
      for (const e of r.experience) for (const b of e.bullets) expect(text).toContain(squash(b.replace('₹', font.measurer.supports?.('₹') === false ? 'Rs. ' : '₹')));
      expect(text).toContain('Anna University');

      const { w, h } = layout.page;
      for (const ops of layout.pages) {
        for (const op of ops) {
          if (op.t !== 'text') continue;
          expect(op.x).toBeGreaterThanOrEqual(0);
          expect(op.y).toBeGreaterThan(0);
          expect(op.y).toBeLessThanOrEqual(h);
          expect(op.x + font.measurer.width(op.text, op.style) * op.size).toBeLessThanOrEqual(w + 0.5);
        }
      }
    });
  }

  it('keeps the default sample on one page, so new visitors see a finished resume', () => {
    const r = sampleResume();
    expect(layoutDocument(buildResumeDoc(r), loadNodeFont(r.design.font).measurer).pages.length).toBe(1);
  });

  it('flows a long resume onto more pages instead of clipping it', () => {
    const r = sampleResume();
    for (let i = 0; i < 14; i++) r.experience.push({ ...r.experience[0], id: `x${i}`, title: `Role ${i}` });
    const layout = layoutDocument(buildResumeDoc(r), loadNodeFont('inter').measurer);
    expect(layout.pages.length).toBeGreaterThan(2);
    const text = layoutText(layout);
    for (let i = 0; i < 14; i++) expect(text).toContain(`Role ${i}`);
  });

  it('handles an empty resume', () => {
    const layout = layoutDocument(buildResumeDoc(emptyResume()), loadNodeFont('inter').measurer);
    expect(layout.pages.length).toBe(1);
  });

  it('writes a real, text-based PDF', () => {
    const r = sampleResume();
    const font = loadNodeFont(r.design.font);
    const layout = layoutDocument(buildResumeDoc(r), font.measurer);
    const doc = drawPdf(JsPdf, layout, font.id, font.data, { title: 'Test', author: r.basics.name });
    const bytes = Buffer.from(doc.output('arraybuffer'));
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(20_000);
    expect(bytes.includes(Buffer.from('/Subtype /Image'))).toBe(false);
  });

  it('lays out a cover letter', () => {
    const r = sampleResume();
    const spec = buildLetterDoc({ name: r.basics.name, contact: r.basics.email, date: '16 November 2026', body: 'Dear Hiring Manager,\n\nFirst paragraph.\n\nSincerely,\nAnanya', design: r.design });
    const text = layoutText(layoutDocument(spec, loadNodeFont(r.design.font).measurer));
    expect(text).toContain('Dear Hiring Manager,');
    expect(text).toContain('16 November 2026');
  });
});

describe('resume data', () => {
  it('repairs incomplete or malformed data instead of crashing', () => {
    const r = normalizeResume({ basics: { name: 'Test User' }, experience: [{ title: 'Dev', bullets: 'not-a-list' }], skills: 'x', languages: ['English', 'Hindi'] });
    expect(r.basics.name).toBe('Test User');
    expect(r.experience[0].bullets).toEqual([]);
    expect(Array.isArray(r.skills)).toBe(true);
    expect(r.languages).toBe('English, Hindi');
    expect(r.design.template).toBeTruthy();
    expect(() => layoutDocument(buildResumeDoc(r), loadNodeFont(r.design.font).measurer)).not.toThrow();
  });

  it('exports plain text and Markdown with every section', () => {
    const r = sampleResume();
    const txt = resumeToText(r);
    const md = resumeToMarkdown(r);
    for (const s of ['Kaveri Payments', 'LedgerLite', 'Anna University', 'AWS Certified', 'GopherCon']) {
      expect(txt).toContain(s);
      expect(md).toContain(s);
    }
    expect(md.startsWith('# Ananya Iyer')).toBe(true);
  });
});
