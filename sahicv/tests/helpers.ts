import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import type { FontId } from '../shared/types.ts';
import { createMeasurer, STYLES, type FontData, type LoadedFont } from '../src/resume/engine/fonts.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const JsPdf = jsPDF as unknown as new (o?: Record<string, unknown>) => jsPDF;

/** Loads a font family from public/fonts for tests that run in Node. */
export function loadNodeFont(id: FontId): LoadedFont {
  const data = {} as FontData;
  for (const style of STYLES) {
    data[style] = readFileSync(join(root, 'public', 'fonts', `${id}-${style}.ttf`)).toString('base64');
  }
  return { id, data, measurer: createMeasurer(JsPdf, id, data) };
}
