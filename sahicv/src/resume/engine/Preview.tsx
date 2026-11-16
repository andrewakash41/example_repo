import { useEffect, useMemo, useState } from 'react';
import type { FontId, Resume } from '../../../shared/types.ts';
import { buildResumeDoc } from '../templates.ts';
import { fontCss, loadFont, type LoadedFont } from './fonts.ts';
import { layoutDocument, type DocSpec, type LayoutResult } from './layout.ts';

/** Loads a resume font (once) and re-renders when it is ready. */
export function useFont(id: FontId): LoadedFont | null {
  const [font, setFont] = useState<LoadedFont | null>(null);
  useEffect(() => {
    let alive = true;
    loadFont(id)
      .then((f) => alive && setFont(f))
      .catch(() => alive && setFont(null));
    return () => {
      alive = false;
    };
  }, [id]);
  return font && font.id === id ? font : null;
}

export function useResumeLayout(resume: Resume): { layout: LayoutResult | null; font: LoadedFont | null } {
  const font = useFont(resume.design.font);
  const layout = useMemo(() => (font ? layoutDocument(buildResumeDoc(resume), font.measurer) : null), [resume, font]);
  return { layout, font };
}

export function useDocLayout(spec: DocSpec | null, fontId: FontId): { layout: LayoutResult | null; font: LoadedFont | null } {
  const font = useFont(fontId);
  const layout = useMemo(() => (font && spec ? layoutDocument(spec, font.measurer) : null), [spec, font]);
  return { layout, font };
}

/** Draws a layout as SVG pages. The same drawing operations produce the PDF. */
export function PagesPreview({ layout, fontId }: { layout: LayoutResult | null; fontId: FontId }) {
  if (!layout) {
    return (
      <div className="page-skeleton" aria-busy="true">
        <span className="spinner" /> Preparing preview…
      </div>
    );
  }
  const family = fontCss(fontId);
  const { w, h } = layout.page;
  return (
    <div className="pages">
      {layout.pages.map((ops, i) => (
        <svg key={i} className="page" viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`Page ${i + 1} of ${layout.pages.length}`}>
          <rect x="0" y="0" width={w} height={h} fill="#ffffff" />
          {ops.map((op, j) => {
            if (op.t === 'rect') return <rect key={j} x={op.x} y={op.y} width={op.w} height={op.h} fill={op.fill} />;
            if (op.t === 'line') return <line key={j} x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} stroke={op.color} strokeWidth={op.width} />;
            const node = (
              <text
                key={j}
                x={op.x}
                y={op.y}
                fontFamily={family}
                fontSize={op.size}
                fontWeight={op.style === 'bold' ? 700 : 400}
                fontStyle={op.style === 'italic' ? 'italic' : 'normal'}
                fill={op.color}
                letterSpacing={op.tracking || undefined}
              >
                {op.text}
              </text>
            );
            return node;
          })}
        </svg>
      ))}
    </div>
  );
}
