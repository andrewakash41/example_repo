// Renders the sample resume in every template to PDF (for visual checks).
// Usage: node scripts/render-samples.ts <output-dir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadNodeFont, JsPdf } from '../tests/helpers.ts';
import { sampleResume } from '../src/resume/model.ts';
import { buildResumeDoc, TEMPLATES } from '../src/resume/templates.ts';
import { layoutDocument } from '../src/resume/engine/layout.ts';
import { drawPdf } from '../src/resume/engine/pdf.ts';

const out = process.argv[2] ?? 'samples';
mkdirSync(out, { recursive: true });
for (const tpl of TEMPLATES) {
  const r = sampleResume();
  r.design = { ...r.design, template: tpl.id, font: tpl.font, accent: tpl.accent };
  const font = loadNodeFont(tpl.font);
  const t0 = performance.now();
  const layout = layoutDocument(buildResumeDoc(r), font.measurer);
  const ms = performance.now() - t0;
  const doc = drawPdf(JsPdf, layout, font.id, font.data, { title: `${r.basics.name} – Resume`, author: r.basics.name });
  const buf = Buffer.from(doc.output('arraybuffer'));
  writeFileSync(join(out, `${tpl.id}.pdf`), buf);
  console.log(`${tpl.id}: ${layout.pages.length} page(s), layout ${ms.toFixed(1)} ms, ${(buf.length / 1024).toFixed(0)} KB`);
}
