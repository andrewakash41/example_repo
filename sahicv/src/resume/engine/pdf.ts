import type { jsPDF as JsPDF } from 'jspdf';
import type { FontId } from '../../../shared/types.ts';
import { registerFonts, type FontData } from './fonts.ts';
import type { LayoutResult } from './layout.ts';

export interface PdfMeta {
  title: string;
  author: string;
  subject?: string;
  keywords?: string;
}

type JsPdfCtor = new (options?: Record<string, unknown>) => JsPDF;

/** Draws a layout as a text-based PDF and returns the document. */
export function drawPdf(
  JsPdf: JsPdfCtor,
  layout: LayoutResult,
  fontId: FontId,
  fontData: FontData,
  meta: PdfMeta,
): JsPDF {
  const { w, h } = layout.page;
  const doc = new JsPdf({ unit: 'pt', format: [w, h], compress: true, putOnlyUsedFonts: true });
  registerFonts(doc, fontId, fontData);
  doc.setProperties({
    title: meta.title,
    author: meta.author,
    subject: meta.subject ?? '',
    keywords: meta.keywords ?? '',
    creator: 'SahiCV',
  });

  layout.pages.forEach((ops, i) => {
    if (i > 0) doc.addPage([w, h]);
    for (const op of ops) {
      if (op.t === 'rect') {
        doc.setFillColor(op.fill);
        doc.rect(op.x, op.y, op.w, op.h, 'F');
      } else if (op.t === 'line') {
        doc.setDrawColor(op.color);
        doc.setLineWidth(op.width);
        doc.line(op.x1, op.y1, op.x2, op.y2);
      } else {
        doc.setFont(fontId, op.style);
        doc.setFontSize(op.size);
        doc.setTextColor(op.color);
        doc.text(op.text, op.x, op.y, op.tracking ? { charSpace: op.tracking } : undefined);
        if (op.link) {
          doc.link(op.x, op.y - op.size * 0.85, op.w, op.size * 1.15, { url: op.link });
        }
      }
    }
  });
  return doc;
}

export async function layoutToPdfBlob(
  layout: LayoutResult,
  fontId: FontId,
  fontData: FontData,
  meta: PdfMeta,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = drawPdf(jsPDF as unknown as JsPdfCtor, layout, fontId, fontData, meta);
  return doc.output('blob');
}
