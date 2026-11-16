import type { jsPDF as JsPDF } from 'jspdf';
import type { FontId } from '../../../shared/types.ts';
import type { FontStyle, Measurer } from './layout.ts';

export interface FontFamily {
  id: FontId;
  label: string;
  kind: 'Sans-serif' | 'Serif';
  /** CSS font-family name used by the on-screen preview. */
  css: string;
}

export const FONT_FAMILIES: FontFamily[] = [
  { id: 'inter', label: 'Inter', kind: 'Sans-serif', css: 'cv-inter' },
  { id: 'lato', label: 'Lato', kind: 'Sans-serif', css: 'cv-lato' },
  { id: 'source-serif-4', label: 'Source Serif', kind: 'Serif', css: 'cv-source-serif-4' },
  { id: 'eb-garamond', label: 'Garamond', kind: 'Serif', css: 'cv-eb-garamond' },
];

export const STYLES: FontStyle[] = ['normal', 'bold', 'italic'];

export function fontCss(id: FontId): string {
  return FONT_FAMILIES.find((f) => f.id === id)?.css ?? 'cv-inter';
}

export type FontData = Record<FontStyle, string>; // base64 TTF per style

export interface LoadedFont {
  id: FontId;
  data: FontData;
  measurer: Measurer;
}

type JsPdfCtor = new (options?: Record<string, unknown>) => JsPDF;

/** Registers the three styles of a family on a jsPDF document. */
export function registerFonts(doc: JsPDF, id: FontId, data: FontData) {
  for (const style of STYLES) {
    const file = `${id}-${style}.ttf`;
    doc.addFileToVFS(file, data[style]);
    doc.addFont(file, id, style);
  }
}

/** Builds a text measurer backed by the real font metrics in the TTF files. */
export function createMeasurer(JsPdf: JsPdfCtor, id: FontId, data: FontData): Measurer {
  const doc = new JsPdf({ unit: 'pt', format: 'a4' });
  registerFonts(doc, id, data);
  const cache: Record<FontStyle, Map<string, number>> = {
    normal: new Map(),
    bold: new Map(),
    italic: new Map(),
  };
  const metricsCache = new Map<FontStyle, { ascent: number; descent: number }>();
  doc.setFont(id, 'normal');
  const codeMap =
    (doc.getFont() as unknown as { metadata?: { cmap?: { unicode?: { codeMap?: Record<number, number> } } } })
      .metadata?.cmap?.unicode?.codeMap ?? null;
  return {
    supports(ch) {
      if (!codeMap) return true;
      const cp = ch.codePointAt(0) ?? 0;
      return Boolean(codeMap[cp]);
    },
    width(text, style) {
      const c = cache[style];
      let w = c.get(text);
      if (w === undefined) {
        doc.setFont(id, style);
        w = doc.getStringUnitWidth(text);
        if (c.size > 20000) c.clear();
        c.set(text, w);
      }
      return w;
    },
    metrics(style) {
      let m = metricsCache.get(style);
      if (!m) {
        doc.setFont(id, style);
        const meta = (doc.getFont() as unknown as { metadata?: { ascender?: number; decender?: number } })
          .metadata;
        const ascent = (meta?.ascender ?? 950) / 1000;
        const descent = Math.abs(meta?.decender ?? -250) / 1000;
        m = { ascent, descent };
        metricsCache.set(style, m);
      }
      return m;
    },
  };
}

// ---- Browser loading ---------------------------------------------------

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const loaded = new Map<FontId, Promise<LoadedFont>>();

/** Fetches a font family, registers it for the preview and returns a measurer. */
export function loadFont(id: FontId): Promise<LoadedFont> {
  let p = loaded.get(id);
  if (!p) {
    p = (async () => {
      const [{ jsPDF }, buffers] = await Promise.all([
        import('jspdf'),
        Promise.all(
          STYLES.map(async (style) => {
            const res = await fetch(`/fonts/${id}-${style}.ttf`);
            if (!res.ok) throw new Error(`Could not load font ${id} (${style})`);
            return res.arrayBuffer();
          }),
        ),
      ]);
      const css = fontCss(id);
      const data = {} as FontData;
      await Promise.all(
        STYLES.map(async (style, i) => {
          data[style] = toBase64(buffers[i]);
          const face = new FontFace(css, buffers[i], {
            weight: style === 'bold' ? '700' : '400',
            style: style === 'italic' ? 'italic' : 'normal',
          });
          await face.load();
          document.fonts.add(face);
        }),
      );
      return { id, data, measurer: createMeasurer(jsPDF as unknown as JsPdfCtor, id, data) };
    })();
    p.catch(() => loaded.delete(id));
    loaded.set(id, p);
  }
  return p;
}
