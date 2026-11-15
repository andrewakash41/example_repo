// Canvas drawing primitives shared by all templates: ornaments and text layout.
// Everything is drawn in a fixed 1080 x 1512 logical space (5:7 card).

export const W = 1080;
export const H = 1512;
const TAU = Math.PI * 2;

// Deterministic random numbers so a template looks the same on every render.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

export function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#f7e3a1');
  g.addColorStop(0.3, '#d6ab52');
  g.addColorStop(0.55, '#f5dd96');
  g.addColorStop(0.8, '#c4973d');
  g.addColorStop(1, '#ecd08a');
  return g;
}

export function fillBackground(ctx, stops, radial = false) {
  const g = radial
    ? ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H / 2, H * 0.78)
    : ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Rectangular frame with concave (scooped) corners.
export function scoopFrame(ctx, inset, r, lineWidth, stroke) {
  const x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0);
  ctx.arc(x1, y0, r, Math.PI, Math.PI / 2, true);
  ctx.lineTo(x1, y1 - r);
  ctx.arc(x1, y1, r, -Math.PI / 2, Math.PI, true);
  ctx.lineTo(x0 + r, y1);
  ctx.arc(x0, y1, r, 0, -Math.PI / 2, true);
  ctx.lineTo(x0, y0 + r);
  ctx.arc(x0, y0, r, Math.PI / 2, 0, true);
  ctx.closePath();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function petalRing(ctx, cx, cy, r0, r1, n, rot = 0) {
  const h = Math.PI / n;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const rc = r0 + (r1 - r0) * 0.72;
    ctx.moveTo(...polar(cx, cy, r0, a - h));
    ctx.quadraticCurveTo(...polar(cx, cy, rc, a - h * 0.82), ...polar(cx, cy, r1, a));
    ctx.quadraticCurveTo(...polar(cx, cy, rc, a + h * 0.82), ...polar(cx, cy, r0, a + h));
  }
}

// Line-art mandala. Clip the context first to draw a half or quarter.
export function mandala(ctx, cx, cy, r, stroke, { fill = null, lw = 2.5 } = {}) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  const ring = (r0, r1, n, rot) => {
    petalRing(ctx, cx, cy, r * r0, r * r1, n, rot);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.stroke();
  };
  ring(0.74, 1.0, 16, 0);
  ring(0.52, 0.8, 16, Math.PI / 16);
  ring(0.3, 0.56, 8, 0);
  ring(0.1, 0.32, 8, Math.PI / 8);
  for (const rr of [0.74, 0.52, 0.3]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * rr, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = stroke;
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.arc(...polar(cx, cy, r * 0.63, (i * TAU) / 16), r * 0.018, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.06, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function divider(ctx, cx, y, w, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - 26, y);
  ctx.moveTo(cx + 26, y); ctx.lineTo(cx + w / 2, y);
  ctx.stroke();
  const diamond = (x, s) => {
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();
  };
  diamond(cx, 9);
  diamond(cx - w / 2 - 8, 4);
  diamond(cx + w / 2 + 8, 4);
  ctx.restore();
}

export function leaf(ctx, x, y, len, angle, color, vein = 'rgba(255,255,255,.28)') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.3, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(len * 0.08, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.strokeStyle = vein;
  ctx.lineWidth = Math.max(1, len * 0.02);
  ctx.stroke();
  ctx.restore();
}

// Five-petal blossom with a soft two-tone petal.
export function blossom(ctx, x, y, r, petal, shade, center, rot = 0, n = 5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i * TAU) / n);
    const g = ctx.createRadialGradient(0, -r * 0.15, r * 0.05, 0, -r * 0.55, r * 0.6);
    g.addColorStop(0, shade);
    g.addColorStop(1, petal);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.42, r * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(...polar(0, 0, r * 0.26, (i * TAU) / 6 + 0.3), r * 0.035, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// A corner spray of blossoms and leaves. (x, y) is the corner; dir flips it.
export function floralCorner(ctx, x, y, dx, dy, pal, seed = 7, size = 1) {
  const rand = rng(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dx * size, dy * size);
  const leaves = [[150, 40, 150, 0.15], [40, 150, 150, 1.4], [230, 120, 120, 0.5], [120, 230, 120, 1.05],
    [300, 50, 110, 0.05], [50, 300, 110, 1.5], [200, 210, 110, 0.8], [360, 90, 80, 0.3], [90, 360, 80, 1.25]];
  for (const [lx, ly, len, a] of leaves) leaf(ctx, lx, ly, len, a, pal.leaves[Math.floor(rand() * pal.leaves.length)]);
  const flowers = [[120, 120, 105, 0], [270, 95, 68, 1], [95, 270, 68, 2], [215, 225, 52, 1], [385, 70, 44, 2],
    [70, 385, 44, 0], [330, 180, 34, 0], [180, 330, 34, 1]];
  for (const [fx, fy, r, ci] of flowers) {
    const [petal, shade] = pal.flowers[ci % pal.flowers.length];
    blossom(ctx, fx, fy, r, petal, shade, pal.center, rand() * TAU);
  }
  ctx.fillStyle = pal.center;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(60 + rand() * 380, 60 + rand() * 380, 4 + rand() * 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function marigold(ctx, x, y, r, tone = 0) {
  const pal = tone ? ['#d9480f', '#f08c00', '#ffb627', '#ffd166'] : ['#c2410c', '#ea7317', '#ff9f1c', '#ffc14d'];
  ctx.save();
  ctx.fillStyle = pal[0];
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  [[0.78, 12, 0.3, 1], [0.5, 9, 0.28, 2], [0.24, 6, 0.24, 3]].forEach(([rr, n, pr, ci], k) => {
    ctx.fillStyle = pal[ci];
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(...polar(x, y, r * rr, (i * TAU) / n + k * 0.4), r * pr, 0, TAU);
      ctx.fill();
    }
  });
  ctx.fillStyle = pal[3];
  ctx.beginPath();
  ctx.arc(x, y, r * 0.16, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Door hanging: a line of mango leaves and marigolds with strings of flowers.
export function toran(ctx, y, drops) {
  ctx.save();
  ctx.strokeStyle = '#8a5a14';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  const n = 15;
  for (let i = 0; i < n; i++) {
    const x = (W / n) * (i + 0.5);
    const g = ctx.createLinearGradient(x, y, x, y + 150);
    g.addColorStop(0, '#2f7d32');
    g.addColorStop(1, '#69a83a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.bezierCurveTo(x + 34, y + 40, x + 24, y + 110, x, y + 150);
    ctx.bezierCurveTo(x - 24, y + 110, x - 34, y + 40, x, y + 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x, y + 132);
    ctx.stroke();
  }
  for (let i = 0; i <= n; i++) marigold(ctx, (W / n) * i, y + 6, 30, i % 2);
  for (const [x, len] of drops) {
    ctx.strokeStyle = '#8a5a14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
    const count = Math.floor(len / 46);
    for (let k = 1; k <= count; k++) marigold(ctx, x, y + k * 46, 25, k % 2);
    leaf(ctx, x, y + count * 46 + 22, 46, Math.PI / 2, '#3d8b37');
  }
  ctx.restore();
}

export function diya(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const glow = ctx.createRadialGradient(0, -52, 2, 0, -52, 70);
  glow.addColorStop(0, 'rgba(255,196,64,.55)');
  glow.addColorStop(1, 'rgba(255,196,64,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -52, 70, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.moveTo(0, -84);
  ctx.bezierCurveTo(20, -52, 12, -30, 0, -28);
  ctx.bezierCurveTo(-12, -30, -20, -52, 0, -84);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.ellipse(0, -44, 5, 12, 0, 0, TAU);
  ctx.fill();
  const bowl = ctx.createLinearGradient(0, -28, 0, 22);
  bowl.addColorStop(0, '#c2571a');
  bowl.addColorStop(1, '#7c2d12');
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.moveTo(-58, -26);
  ctx.quadraticCurveTo(0, 46, 58, -26);
  ctx.quadraticCurveTo(0, -10, -58, -26);
  ctx.fill();
  ctx.strokeStyle = '#f4c95d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-58, -26);
  ctx.quadraticCurveTo(0, -10, 58, -26);
  ctx.stroke();
  ctx.restore();
}

export function sparkle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const [px, py] = polar(x, y, i % 2 ? r * 0.22 : r, (i * TAU) / 8);
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// `calm` is an [x, y, w, h] area (where the text sits) that only gets small dots.
export function starField(ctx, seed, count, color, calm = null) {
  const rand = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rand() * W, y = rand() * H;
    const inCalm = calm && x > calm[0] && x < calm[0] + calm[2] && y > calm[1] && y < calm[1] + calm[3];
    const big = rand() > 0.86 && !inCalm;
    ctx.globalAlpha = 0.35 + rand() * 0.65;
    if (big) sparkle(ctx, x, y, 9 + rand() * 12, color);
    else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 1 + rand() * 2.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function crescent(ctx, x, y, r, color) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.3);
  glow.addColorStop(0, 'rgba(246,221,150,.28)');
  glow.addColorStop(1, 'rgba(246,221,150,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0.35 * Math.PI, 1.65 * Math.PI);
  ctx.arc(x + r * 0.42, y, r * 0.82, 1.56 * Math.PI, 0.44 * Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// A sagging string between two points; returns points along it.
function catenary(x0, y0, x1, y1, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)]);
  }
  return pts;
}

export function fairyLights(ctx, x0, y0, x1, y1, sag, n, colors) {
  const pts = catenary(x0, y0, x1, y1, sag, n);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  pts.slice(1, -1).forEach(([x, y], i) => {
    const c = colors[i % colors.length];
    const g = ctx.createRadialGradient(x, y + 12, 1, x, y + 12, 30);
    g.addColorStop(0, c);
    g.addColorStop(0.3, c + 'aa');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y + 12, 30, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fffbe6';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 5, 8, 0, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

export function bunting(ctx, x0, y0, x1, y1, sag, n, colors) {
  const pts = catenary(x0, y0, x1, y1, sag, n);
  ctx.save();
  ctx.strokeStyle = '#3b3355';
  ctx.lineWidth = 3;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(ax + 3, ay);
    ctx.lineTo(bx - 3, by);
    ctx.lineTo((ax + bx) / 2, (ay + by) / 2 + 74);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function balloon(ctx, x, y, r, color, stringLen = 220, lean = 0) {
  ctx.save();
  ctx.strokeStyle = 'rgba(60,50,90,.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.22);
  ctx.bezierCurveTo(x + 22 + lean, y + r * 1.22 + stringLen * 0.35, x - 22 + lean, y + r * 1.22 + stringLen * 0.65, x + lean, y + r * 1.22 + stringLen);
  ctx.stroke();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.18, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.18, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.14);
  ctx.lineTo(x - 11, y + r * 1.14 + 18);
  ctx.lineTo(x + 11, y + r * 1.14 + 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.3, r * 0.62, r * 0.72, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function confetti(ctx, seed, count, colors, region = [0, 0, W, H]) {
  const rand = rng(seed);
  const [rx, ry, rw, rh] = region;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rx + rand() * rw, y = ry + rand() * rh;
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.75 + rand() * 0.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * TAU);
    const kind = rand();
    if (kind < 0.4) ctx.fillRect(-9, -4, 18, 8);
    else if (kind < 0.75) { ctx.beginPath(); ctx.arc(0, 0, 4 + rand() * 4, 0, TAU); ctx.fill(); }
    else {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.quadraticCurveTo(-4, -12, 0, 0);
      ctx.quadraticCurveTo(4, 12, 12, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export function peacockFeather(ctx, x, y, len, angle, bend = 0.18) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const tipX = len, tipY = 0, cX = len * 0.5, cY = -len * bend;
  const at = (t) => [
    (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * cX + t * t * tipX,
    2 * (1 - t) * t * cY + t * t * tipY,
  ];
  ctx.lineCap = 'round';
  for (let i = 4; i < 46; i++) {
    const t = i / 46;
    const [px, py] = at(t);
    const [qx, qy] = at(Math.min(1, t + 0.02));
    const a = Math.atan2(qy - py, qx - px);
    const barb = len * (0.07 + 0.11 * Math.sin(t * Math.PI));
    ctx.strokeStyle = i % 2 ? 'rgba(46,160,140,.55)' : 'rgba(120,180,90,.5)';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(
        px + Math.cos(a + side * 0.6) * barb * 0.6, py + Math.sin(a + side * 0.6) * barb * 0.6,
        px + Math.cos(a + side * 0.95) * barb, py + Math.sin(a + side * 0.95) * barb,
      );
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#d9c27a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(cX, cY, tipX, tipY);
  ctx.stroke();
  const e = len * 0.12;
  ctx.translate(tipX - e * 0.4, tipY);
  ctx.rotate(Math.atan2(tipY - cY, tipX - cX));
  [['#7fae3c', 1.35, 1], ['#d1a53a', 1.02, 0.78], ['#17b3ac', 0.78, 0.6], ['#1d2f8c', 0.48, 0.4]].forEach(([c, rx, ry], i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(e * 0.12 * i, 0, e * rx, e * ry, 0, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

// Diagonal lattice, used as a faint texture.
export function lattice(ctx, step, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = -H; i < W + H; i += step) {
    ctx.moveTo(i, 0); ctx.lineTo(i + H, H);
    ctx.moveTo(i, 0); ctx.lineTo(i - H, H);
  }
  ctx.stroke();
  ctx.restore();
}

// Pointed Mughal-style arch outline; the caller fills or strokes it.
export function archPath(ctx, x0, x1, top, bottom) {
  const cx = (x0 + x1) / 2, w = x1 - x0;
  const sh = top + w * 0.62;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  ctx.lineTo(x0, sh);
  ctx.bezierCurveTo(x0, sh - w * 0.12, x0 + w * 0.06, sh - w * 0.2, x0 + w * 0.05, sh - w * 0.27);
  ctx.bezierCurveTo(x0 + w * 0.04, sh - w * 0.48, cx - w * 0.2, top + w * 0.1, cx, top);
  ctx.bezierCurveTo(cx + w * 0.2, top + w * 0.1, x1 - w * 0.04, sh - w * 0.48, x1 - w * 0.05, sh - w * 0.27);
  ctx.bezierCurveTo(x1 - w * 0.06, sh - w * 0.2, x1, sh - w * 0.12, x1, sh);
  ctx.lineTo(x1, bottom);
  ctx.closePath();
}

// Curved stem with paired leaves, used as a botanical accent.
export function sprig(ctx, x, y, len, angle, color, pairs = 6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.1, len, 0);
  ctx.stroke();
  for (let i = 1; i <= pairs; i++) {
    const t = i / (pairs + 0.6);
    const px = len * t, py = -len * 0.2 * t * (1 - t) * 2;
    const size = len * (0.2 - 0.1 * t);
    leaf(ctx, px, py, size, -0.75, color, 'rgba(255,255,255,.22)');
    leaf(ctx, px, py, size, 0.75, color, 'rgba(255,255,255,.22)');
  }
  leaf(ctx, len, 0, len * 0.11, 0, color, 'rgba(255,255,255,.22)');
  ctx.restore();
}

// ---- Text layout ----

const FALLBACK = '"Tiro Devanagari Hindi", "Noto Serif", serif';

export function fontSpec(f, size) {
  return `${f.style ?? 'normal'} ${f.weight ?? 400} ${size}px "${f.family}", ${FALLBACK}`;
}

function setFont(ctx, block, size) {
  ctx.font = fontSpec(block.font, size);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(block.ls ?? 0) * size}px`;
}

function wrapLines(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function measureBlocks(ctx, blocks, box, k) {
  let total = 0;
  const out = [];
  for (const b of blocks) {
    if (b.kind === 'divider') {
      out.push({ b, h: 28 * k, mt: (b.mt ?? 0) * k });
      total += (28 + (b.mt ?? 0)) * k;
      continue;
    }
    const maxW = box.w * (b.maxW ?? 1);
    const text = b.upper ? b.text.toUpperCase() : b.text;
    let size = b.size * k;
    setFont(ctx, b, size);
    let lines;
    if (b.fit) {
      // Shrink a single line to fit before giving up and wrapping.
      const width = ctx.measureText(text).width;
      if (width > maxW) size = Math.max(size * 0.55, (size * maxW) / width);
      setFont(ctx, b, size);
      lines = ctx.measureText(text).width > maxW * 1.01 ? wrapLines(ctx, text, maxW) : [text];
    } else lines = wrapLines(ctx, text, maxW);
    const lh = size * (b.lh ?? 1.25);
    out.push({ b, size, lines, lh, h: lines.length * lh, mt: (b.mt ?? 0) * k });
    total += lines.length * lh + (b.mt ?? 0) * k;
  }
  return { rows: out, total };
}

// Stack text blocks, centred in `box`, shrinking everything until it fits.
export function drawBlocks(ctx, blocks, box) {
  let k = 1, m = measureBlocks(ctx, blocks, box, k);
  while (m.total > box.h && k > 0.5) {
    k -= 0.04;
    m = measureBlocks(ctx, blocks, box, k);
  }
  const cx = box.x + box.w / 2;
  let y = box.y + Math.max(0, (box.h - m.total) * (box.align ?? 0.5));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const row of m.rows) {
    y += row.mt;
    if (row.b.kind === 'divider') {
      divider(ctx, cx, y + row.h / 2, box.w * 0.42, row.b.color);
      y += row.h;
      continue;
    }
    setFont(ctx, row.b, row.size);
    ctx.fillStyle = typeof row.b.color === 'function' ? row.b.color(ctx, box) : row.b.color;
    for (const line of row.lines) {
      // Letter spacing trails the last glyph; nudge so the line stays centred.
      const nudge = ((row.b.ls ?? 0) * row.size) / 2;
      ctx.fillText(line, cx + nudge, y + row.lh / 2);
      y += row.lh;
    }
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}
