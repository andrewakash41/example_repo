// Renders an invitation onto a canvas, with the free or preview watermark.

import { W, H, fontSpec } from './draw.js';
import { templateById, paintTemplate, templateFonts } from './templates.js';

export { W, H };

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);
}

// Canvas text silently falls back to a system font unless the web font is
// already loaded, so load every face the template needs for this exact text.
async function ensureFonts(tpl, text) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const loads = templateFonts(tpl).map((f) => document.fonts.load(fontSpec(f, 40), text));
  loads.push(document.fonts.load('400 40px "Tiro Devanagari Hindi"', text));
  loads.push(document.fonts.load('500 22px "Montserrat"', 'Made with'));
  await withTimeout(Promise.allSettled(loads), 4000);
}

function allText(data) {
  return ['bl', 'in', 'n1', 'jn', 'n2', 'ms', 'vn', 'va', 'ft'].map((k) => data[k] ?? '').join(' ') + ' 0123456789 APM';
}

function freeMark(ctx, line) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,14,10,.62)';
  ctx.fillRect(0, H - 52, W, 52);
  ctx.font = '500 22px "Montserrat", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(line, W / 2, H - 25, W - 80);
  ctx.restore();
}

function previewMark(ctx, word) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 5);
  ctx.font = '600 58px "Montserrat", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  for (let row = -5; row <= 5; row++) {
    for (let col = -2; col <= 2; col++) {
      const x = col * 620 + (row % 2) * 310, y = row * 190;
      ctx.strokeStyle = 'rgba(0,0,0,.16)';
      ctx.strokeText(word, x, y);
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.fillText(word, x, y);
    }
  }
  ctx.restore();
}

// mark: 'none' | 'free' (branding strip) | 'preview' (locked premium template)
export async function renderInvite(canvas, data, { scale = 1, mark = 'none', markText = '' } = {}) {
  const tpl = templateById(data.tl);
  await ensureFonts(tpl, allText(data));
  const w = Math.round(W * scale), h = Math.round(H * scale);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  paintTemplate(ctx, tpl, data);
  if (mark === 'free') freeMark(ctx, markText);
  if (mark === 'preview') previewMark(ctx, 'PREVIEW');
  return canvas;
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), type, quality);
  });
}
