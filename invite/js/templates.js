// Invitation templates. Each one paints a background and ornaments, then lays
// out the invitation text inside a content box using its own type and colours.

import {
  W, H, fillBackground, goldGradient, scoopFrame, mandala, lattice, sprig, bunting, balloon,
  confetti, archPath, sparkle, toran, diya, starField, crescent, fairyLights, floralCorner,
  peacockFeather, roundRect, drawBlocks,
} from './draw.js';
import { formatDate, formatTime } from './model.js';

const F = {
  script: { family: 'Great Vibes', weight: 400 },
  serif: { family: 'Cormorant Garamond', weight: 500 },
  serifBold: { family: 'Cormorant Garamond', weight: 600 },
  serifItalic: { family: 'Cormorant Garamond', weight: 500, style: 'italic' },
  caps: { family: 'Cinzel', weight: 500 },
  capsBold: { family: 'Cinzel', weight: 700 },
  sans: { family: 'Montserrat', weight: 500 },
  sansBold: { family: 'Montserrat', weight: 600 },
  round: { family: 'Baloo 2', weight: 600 },
  roundBold: { family: 'Baloo 2', weight: 800 },
};

const CLASSIC = { name: F.script, caps: F.caps, body: F.serif, italic: F.serifItalic, strong: F.serifBold };
const gold = (ctx, box) => goldGradient(ctx, box.x, 0, box.x + box.w, 0);

// Turn invitation data into a stack of text blocks for drawBlocks().
function contentBlocks(d, S) {
  const B = [];
  const f = S.fonts, c = S.colors;
  if (d.bl) B.push({ text: d.bl, font: f.body, size: 32, color: c.accent });
  if (d.in) B.push({ text: d.in, font: f.caps, size: 24, ls: 0.2, upper: true, color: c.muted, mt: d.bl ? 28 : 0, lh: 1.5, maxW: 0.92 });
  const first = (d.n1 ?? '').trim(), second = (d.n2 ?? '').trim();
  if (first && second) {
    B.push({ text: first, font: f.name, size: S.nameSize, color: c.name, fit: true, mt: 30, lh: S.nameLh });
    B.push({ text: (d.jn ?? '').trim() || '&', font: f.italic, size: 42, color: c.accent, mt: 2 });
    B.push({ text: second, font: f.name, size: S.nameSize, color: c.name, fit: true, mt: 2, lh: S.nameLh });
  } else if (first || second) {
    B.push({ text: first || second, font: f.title ?? f.name, size: S.titleSize, color: c.name, mt: 30, lh: S.titleLh ?? S.nameLh });
  }
  if (d.ms) B.push({ text: d.ms, font: f.italic, size: 34, color: c.text, mt: 30, lh: 1.35 });
  B.push({ kind: 'divider', color: c.accent, mt: 34 });
  const date = formatDate(d.dt, d.lg), time = formatTime(d.tm, d.lg);
  if (date) B.push({ text: date, font: f.caps, size: 33, ls: 0.08, upper: true, color: c.strong, mt: 34, fit: true });
  if (time) B.push({ text: time, font: f.caps, size: 27, ls: 0.14, color: c.text, mt: 10 });
  if (d.vn) B.push({ text: d.vn, font: f.strong, size: 38, color: c.strong, mt: 32, lh: 1.2 });
  if (d.va) B.push({ text: d.va, font: f.body, size: 28, color: c.muted, mt: 6, lh: 1.3, maxW: 0.86 });
  if (d.ft) B.push({ text: d.ft, font: f.italic, size: 27, color: c.accent, mt: 34, lh: 1.3, maxW: 0.9 });
  return B;
}

function cornerMandalas(ctx, inset, r, stroke) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.clip();
  for (const [x, y] of [[inset, inset], [W - inset, inset], [inset, H - inset], [W - inset, H - inset]]) {
    mandala(ctx, x, y, r, stroke);
  }
  ctx.restore();
}

function mirrored(ctx, fn) {
  fn();
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  fn();
  ctx.restore();
}

function cake(ctx, cx, base) {
  ctx.save();
  ctx.fillStyle = 'rgba(59,51,85,.12)';
  ctx.beginPath();
  ctx.ellipse(cx, base + 6, 190, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  const tier = (w, h, y, color, icing) => {
    ctx.fillStyle = color;
    roundRect(ctx, cx - w / 2, y - h, w, h, 14);
    ctx.fill();
    ctx.fillStyle = icing;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y - h + 12);
    const n = Math.round(w / 40);
    for (let i = 0; i < n; i++) {
      const x0 = cx - w / 2 + (w / n) * i, x1 = x0 + w / n;
      ctx.quadraticCurveTo((x0 + x1) / 2, y - h + 40 + (i % 2) * 14, x1, y - h + 12);
    }
    ctx.lineTo(cx + w / 2, y - h + 14);
    ctx.arcTo(cx + w / 2, y - h, cx + w / 2 - 14, y - h, 14);
    ctx.lineTo(cx - w / 2 + 14, y - h);
    ctx.arcTo(cx - w / 2, y - h, cx - w / 2, y - h + 14, 14);
    ctx.closePath();
    ctx.fill();
  };
  tier(300, 96, base, '#ff8fab', '#fff0f3');
  tier(210, 84, base - 96, '#7bdff2', '#f1fbff');
  [-56, 0, 56].forEach((dx, i) => {
    ctx.fillStyle = ['#ffd166', '#b388ff', '#ff6b6b'][i];
    ctx.fillRect(cx + dx - 6, base - 232, 12, 52);
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.ellipse(cx + dx, base - 246, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

const PARTY = ['#ff4d6d', '#3ac4c9', '#ffc93c', '#7a5cff', '#58c26a'];

export const TEMPLATES = [
  {
    id: 'royal', name: 'Royal Maroon', premium: false,
    page: { bg: '#2b060d', fg: '#f7ecd6', btn: '#d6ab52', btnText: '#2b060d' },
    style: {
      fonts: CLASSIC, nameSize: 138, titleSize: 104, nameLh: 1.12,
      colors: { name: gold, accent: '#e2bd6c', text: '#f7ecd6', muted: '#d9c4a0', strong: '#f5dd96' },
    },
    box: { x: 170, y: 250, w: 740, h: 1010 },
    paint(ctx) {
      fillBackground(ctx, ['#84172b', '#5c0d1c', '#30050d'], true);
      lattice(ctx, 60, 'rgba(255,215,130,.04)');
      const g = goldGradient(ctx, 0, 0, W, H);
      scoopFrame(ctx, 36, 44, 5, g);
      scoopFrame(ctx, 54, 44, 2, g);
      cornerMandalas(ctx, 58, 200, 'rgba(226,189,108,.85)');
      ctx.save();
      ctx.beginPath();
      ctx.rect(58, 58, W - 116, H - 116);
      ctx.clip();
      mandala(ctx, W / 2, 58, 118, 'rgba(226,189,108,.8)');
      mandala(ctx, W / 2, H - 58, 118, 'rgba(226,189,108,.8)');
      ctx.restore();
    },
  },
  {
    id: 'ivory', name: 'Ivory Garden', premium: false,
    page: { bg: '#f3ecdd', fg: '#2f2a22', btn: '#3f5a45', btnText: '#ffffff' },
    style: {
      fonts: CLASSIC, nameSize: 132, titleSize: 100, nameLh: 1.12,
      colors: { name: '#3f5a45', accent: '#a97c2f', text: '#3b352c', muted: '#8a7a5e', strong: '#2f2a22' },
    },
    box: { x: 150, y: 310, w: 780, h: 890 },
    paint(ctx) {
      fillBackground(ctx, ['#fdf9f0', '#f6eedc']);
      ctx.strokeStyle = '#b8924a';
      ctx.lineWidth = 3;
      ctx.strokeRect(44, 44, W - 88, H - 88);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(58, 58, W - 116, H - 116);
      for (const [y, flip] of [[236, 1], [H - 236, -1]]) {
        mirrored(ctx, () => {
          ctx.save();
          ctx.translate(W / 2 - 16, y);
          ctx.scale(1, flip);
          sprig(ctx, 0, 0, 250, Math.PI + 0.32, '#6f8553', 7);
          ctx.restore();
        });
        ctx.fillStyle = '#b8924a';
        ctx.beginPath();
        ctx.arc(W / 2, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'confetti', name: 'Confetti Pop', premium: false,
    page: { bg: '#fff3d6', fg: '#3b3355', btn: '#ff4d6d', btnText: '#ffffff' },
    style: {
      fonts: { name: F.roundBold, title: F.roundBold, caps: F.sansBold, body: F.sans, italic: F.sans, strong: F.round },
      nameSize: 104, titleSize: 92, nameLh: 1.08,
      colors: { name: '#ff4d6d', accent: '#7a5cff', text: '#3b3355', muted: '#6b6486', strong: '#2a2440' },
    },
    box: { x: 160, y: 262, w: 760, h: 840 },
    paint(ctx) {
      fillBackground(ctx, ['#fff6d9', '#ffe6ee']);
      confetti(ctx, 5, 90, PARTY);
      bunting(ctx, -20, 50, W + 20, 50, 96, 11, PARTY);
      ctx.fillStyle = 'rgba(255,255,255,.86)';
      roundRect(ctx, 110, 226, 860, 912, 44);
      ctx.fill();
      cake(ctx, W / 2, H - 92);
      mirrored(ctx, () => {
        balloon(ctx, 104, 1296, 70, PARTY[0], 260, -10);
        balloon(ctx, 216, 1238, 62, PARTY[1], 300, 14);
        balloon(ctx, 300, 1330, 54, PARTY[2], 220, 0);
      });
    },
  },
  {
    id: 'arch', name: 'Mughal Arch', premium: true,
    page: { bg: '#062522', fg: '#f6ecd2', btn: '#d6ab52', btnText: '#062522' },
    style: {
      fonts: CLASSIC, nameSize: 124, titleSize: 96, nameLh: 1.12,
      colors: { name: '#0f4a44', accent: '#a9812d', text: '#2b3a36', muted: '#86713f', strong: '#0f4a44' },
    },
    box: { x: 232, y: 392, w: 616, h: 950 },
    paint(ctx) {
      fillBackground(ctx, ['#12564f', '#0a3531', '#051f1d'], true);
      lattice(ctx, 48, 'rgba(240,212,136,.07)');
      const g = goldGradient(ctx, 0, 0, W, H);
      scoopFrame(ctx, 36, 40, 4, g);
      cornerMandalas(ctx, 40, 150, 'rgba(226,189,108,.7)');
      archPath(ctx, 124, W - 124, 150, H - 118);
      const panel = ctx.createLinearGradient(0, 150, 0, H);
      panel.addColorStop(0, '#fffaf0');
      panel.addColorStop(1, '#f5e9cf');
      ctx.fillStyle = panel;
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = 40;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 7;
      ctx.strokeStyle = g;
      ctx.stroke();
      archPath(ctx, 150, W - 150, 186, H - 144);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#c4973d';
      ctx.stroke();
      sparkle(ctx, W / 2, 104, 30, '#f0d488');
      sparkle(ctx, W / 2, 286, 20, '#c4973d');
    },
  },
  {
    id: 'marigold', name: 'Marigold Toran', premium: true,
    page: { bg: '#fff1c9', fg: '#4a2c17', btn: '#d9480f', btnText: '#ffffff' },
    style: {
      fonts: CLASSIC, nameSize: 128, titleSize: 100, nameLh: 1.12,
      colors: { name: '#8f1d1d', accent: '#d9480f', text: '#4a2c17', muted: '#96601f', strong: '#8f1d1d' },
    },
    box: { x: 226, y: 256, w: 628, h: 960 },
    paint(ctx) {
      fillBackground(ctx, ['#fffaea', '#ffefc4']);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, H - 300, W, 300);
      ctx.clip();
      mandala(ctx, W / 2, H + 6, 270, '#c2410c', { fill: 'rgba(255,159,28,.16)', lw: 3 });
      ctx.restore();
      diya(ctx, W / 2 - 372, H - 76, 1.05);
      diya(ctx, W / 2 + 372, H - 76, 1.05);
      toran(ctx, 34, [[64, 600], [146, 420], [W - 146, 420], [W - 64, 600]]);
    },
  },
  {
    id: 'midnight', name: 'Midnight Lights', premium: true,
    page: { bg: '#0a0f2e', fg: '#eef0ff', btn: '#f6dd96', btnText: '#141a4a' },
    style: {
      fonts: { name: F.script, caps: F.sans, body: F.serif, italic: F.serifItalic, strong: F.serifBold },
      nameSize: 138, titleSize: 104, nameLh: 1.12,
      colors: { name: gold, accent: '#f6dd96', text: '#eef0ff', muted: '#b9c0ff', strong: '#ffffff' },
    },
    box: { x: 150, y: 330, w: 780, h: 1010 },
    paint(ctx) {
      fillBackground(ctx, ['#080c26', '#151b4d', '#2a1c58']);
      starField(ctx, 11, 170, '#f6dd96', [200, 380, 680, 900]);
      crescent(ctx, 880, 262, 62, '#f6e3a6');
      fairyLights(ctx, -30, 20, W + 30, 20, 150, 14, ['#ffd166', '#ff9fb2', '#9be7ff']);
      fairyLights(ctx, -30, 10, W + 30, 10, 70, 11, ['#9be7ff', '#ffd166', '#ff9fb2']);
      scoopFrame(ctx, 36, 40, 2, 'rgba(246,221,150,.55)');
    },
  },
  {
    id: 'blush', name: 'Blush Blossom', premium: true,
    page: { bg: '#fbe6e6', fg: '#5b3a44', btn: '#a2475f', btnText: '#ffffff' },
    style: {
      fonts: CLASSIC, nameSize: 130, titleSize: 100, nameLh: 1.12,
      colors: { name: '#a2475f', accent: '#b76e79', text: '#5b3a44', muted: '#9b7a80', strong: '#7d3550' },
    },
    box: { x: 190, y: 350, w: 700, h: 830 },
    paint(ctx) {
      fillBackground(ctx, ['#fff7f4', '#fde3e3']);
      ctx.strokeStyle = '#c98b93';
      ctx.lineWidth = 3;
      ctx.strokeRect(42, 42, W - 84, H - 84);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(56, 56, W - 112, H - 112);
      const pal = {
        flowers: [['#f4a6b8', '#fde4ea'], ['#ee8aa4', '#fbd0da'], ['#fbe3d4', '#fff6ef']],
        leaves: ['#8fae8b', '#6f9a78', '#a9c4a0'],
        center: '#d4a24c',
      };
      floralCorner(ctx, 0, 0, 1, 1, pal, 3, 1.05);
      floralCorner(ctx, W, H, -1, -1, pal, 9, 1.05);
      floralCorner(ctx, W, 0, -1, 1, pal, 5, 0.5);
      floralCorner(ctx, 0, H, 1, -1, pal, 8, 0.5);
    },
  },
  {
    id: 'peacock', name: 'Peacock Royale', premium: true,
    page: { bg: '#042a31', fg: '#eafaf6', btn: '#f0d488', btnText: '#042a31' },
    style: {
      fonts: CLASSIC, nameSize: 134, titleSize: 102, nameLh: 1.12,
      colors: { name: gold, accent: '#f0d488', text: '#eafaf6', muted: '#a9d6cf', strong: '#fbeec2' },
    },
    box: { x: 170, y: 200, w: 740, h: 800 },
    paint(ctx) {
      fillBackground(ctx, ['#0d6a72', '#07424a', '#03242a'], true);
      lattice(ctx, 56, 'rgba(240,212,136,.04)');
      const g = goldGradient(ctx, 0, 0, W, H);
      scoopFrame(ctx, 36, 44, 5, g);
      scoopFrame(ctx, 54, 44, 2, g);
      ctx.save();
      ctx.beginPath();
      ctx.rect(58, 58, W - 116, H - 116);
      ctx.clip();
      mandala(ctx, W / 2, 58, 124, 'rgba(240,212,136,.8)');
      mirrored(ctx, () => {
        const deg = Math.PI / 180;
        [[-84, 330], [-70, 400], [-56, 400], [-42, 360], [-28, 300], [-12, 260]].forEach(([a, len]) => {
          peacockFeather(ctx, 70, H - 70, len, a * deg, 0.1);
        });
      });
      ctx.restore();
    },
  },
];

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function paintTemplate(ctx, tpl, data) {
  tpl.paint(ctx);
  drawBlocks(ctx, contentBlocks(data, tpl.style), tpl.box);
}

export function templateFonts(tpl) {
  return Object.values(tpl.style.fonts);
}
