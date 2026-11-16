// A small document layout engine.
//
// Templates describe a resume as a list of blocks (paragraphs, rows, bullets,
// rules, boxes). This engine wraps the text using real font metrics, flows it
// across pages and returns a flat list of drawing operations per page.
//
// The same operations are drawn twice: as SVG for the on-screen preview and as
// real text in the PDF. That is what keeps the download identical to the
// preview, and keeps the PDF text-based so applicant tracking systems can read it.

export type FontStyle = 'normal' | 'bold' | 'italic';
export type Align = 'left' | 'center' | 'right';

export interface Run {
  text: string;
  style?: FontStyle;
  color?: string;
  link?: string;
  /** A separator (e.g. " | "). Dropped when it would start or end a line. */
  sep?: boolean;
}

interface Spaced {
  before?: number;
  after?: number;
}

export type Block =
  | ({
      type: 'para';
      runs: Run[];
      size: number;
      color: string;
      align?: Align;
      lineHeight?: number;
      tracking?: number;
    } & Spaced)
  | ({
      type: 'row';
      left: Run[];
      right: Run[];
      size: number;
      color: string;
      rightSize?: number;
      rightColor?: string;
      lineHeight?: number;
    } & Spaced)
  | ({
      type: 'bullet';
      runs: Run[];
      size: number;
      color: string;
      marker?: string;
      markerColor?: string;
      indent?: number;
      lineHeight?: number;
    } & Spaced)
  | ({ type: 'rule'; color: string; thickness: number } & Spaced)
  | { type: 'space'; h: number }
  | { type: 'group'; blocks: Block[] }
  | ({
      type: 'box';
      blocks: Block[];
      fill?: string;
      padX?: number;
      padY?: number;
      /** Extend the fill to the page edges (and to the top edge when first on a page). */
      bleed?: boolean;
      bar?: { w: number; color: string };
    } & Spaced);

export interface TextOp {
  t: 'text';
  x: number;
  y: number;
  text: string;
  style: FontStyle;
  size: number;
  color: string;
  w: number;
  link?: string;
  tracking?: number;
}
export interface RectOp {
  t: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}
export interface LineOp {
  t: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
}
export type Op = TextOp | RectOp | LineOp;

export interface Measurer {
  /** Width of `text` at 1pt font size. */
  width(text: string, style: FontStyle): number;
  /** Ascent and descent as a fraction of the font size. */
  metrics(style: FontStyle): { ascent: number; descent: number };
  /** Whether the font has a glyph for this character. Optional. */
  supports?(ch: string): boolean;
}

export interface Flow {
  x: number;
  w: number;
  top: number;
  /** Top of the first page only (e.g. 0 so a header band can touch the page edge). */
  firstTop?: number;
  bottom: number;
  blocks: Block[];
}

export interface DocSpec {
  page: { w: number; h: number };
  flows: Flow[];
  /** Background decoration drawn under the text of every page. */
  decorate?: (pageIndex: number) => Op[];
}

export interface LayoutResult {
  page: { w: number; h: number };
  pages: Op[][];
}

const DEFAULT_LH = 1.38;

interface Token {
  text: string;
  run: number;
  spaceBefore: boolean;
}

interface Segment {
  text: string;
  run: number;
  x: number;
  w: number;
}

interface Line {
  segments: Segment[];
  width: number;
}

/** Replaces characters the font cannot draw, so the PDF never shows empty boxes. */
function cleanText(text: string, m: Measurer): string {
  if (!m.supports) return text;
  let out = '';
  for (const ch of text) {
    if (ch === ' ' || ch === '\n' || ch === '\t' || m.supports(ch)) out += ch;
    else if (ch === '₹') out += 'Rs. ';
    else if (ch === '–' || ch === '—') out += '-';
    else if (ch === '•' || ch === '·') out += '-';
    else if (ch === '’' || ch === '‘') out += "'";
    else if (ch === '“' || ch === '”') out += '"';
  }
  return out;
}

function tokenize(runs: Run[], m: Measurer): Token[] {
  const tokens: Token[] = [];
  let pendingSpace = false;
  runs.forEach((run, ri) => {
    const text = cleanText(run.text ?? '', m);
    if (!text) return;
    const parts = text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        pendingSpace = true;
        continue;
      }
      tokens.push({ text: part, run: ri, spaceBefore: pendingSpace && tokens.length > 0 });
      pendingSpace = false;
    }
  });
  return tokens;
}

class Wrapper {
  private m: Measurer;
  constructor(m: Measurer) {
    this.m = m;
  }

  textWidth(text: string, style: FontStyle, size: number, tracking = 0): number {
    return this.m.width(text, style) * size + tracking * text.length;
  }

  /** Greedy line breaking. `firstWidth` lets the first line be narrower (rows). */
  wrap(runs: Run[], size: number, width: number, firstWidth = width, tracking = 0): Line[] {
    const tokens = tokenize(runs, this.m);
    const lines: Line[] = [];
    let segs: Segment[] = [];
    let x = 0;
    const limit = () => (lines.length === 0 ? firstWidth : width);
    const flush = () => {
      while (segs.length && runs[segs[segs.length - 1].run].sep) {
        segs.pop();
        const prev = segs[segs.length - 1];
        x = prev ? prev.x + prev.w : 0;
      }
      if (!segs.length) {
        x = 0;
        return;
      }
      lines.push({ segments: segs, width: x });
      segs = [];
      x = 0;
    };
    const styleOf = (ri: number) => runs[ri].style ?? 'normal';

    const place = (tok: Token, text: string, withSpace: boolean) => {
      const style = styleOf(tok.run);
      const space = withSpace ? this.textWidth(' ', style, size, tracking) : 0;
      const w = this.textWidth(text, style, size, tracking);
      const last = segs[segs.length - 1];
      if (last && last.run === tok.run && withSpace) {
        last.text += ' ' + text;
        last.w += space + w;
      } else if (last && last.run === tok.run && !withSpace) {
        last.text += text;
        last.w += w;
      } else {
        segs.push({ text, run: tok.run, x: x + space, w });
      }
      x += space + w;
    };

    for (const tok of tokens) {
      const style = styleOf(tok.run);
      const w = this.textWidth(tok.text, style, size, tracking);
      const space = tok.spaceBefore && segs.length ? this.textWidth(' ', style, size, tracking) : 0;
      if (segs.length && x + space + w > limit() + 0.01) flush();
      if (runs[tok.run].sep && !segs.length) continue;
      if (w > limit() + 0.01 && !segs.length) {
        // A single word wider than the line (long URL): break by characters.
        let chunk = '';
        for (const ch of tok.text) {
          const cw = this.textWidth(chunk + ch, style, size, tracking);
          if (chunk && cw > limit()) {
            place(tok, chunk, false);
            flush();
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        if (chunk) place(tok, chunk, false);
        continue;
      }
      place(tok, tok.text, tok.spaceBefore && segs.length > 0);
    }
    if (segs.length) flush();
    return lines;
  }
}

interface Cursor {
  page: number;
  y: number;
  /** True when nothing has been placed on the current page of this flow yet. */
  atTop: boolean;
}

interface Ctx {
  pages: Op[][];
  pageW: number;
  top: number;
  bottom: number;
  cur: Cursor;
  wrapper: Wrapper;
  m: Measurer;
  /** When measuring, pages never break. */
  measuring: boolean;
}

function newPage(ctx: Ctx) {
  ctx.cur.page += 1;
  ctx.cur.y = ctx.top;
  ctx.cur.atTop = true;
  while (ctx.pages.length <= ctx.cur.page) ctx.pages.push([]);
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.measuring) return;
  if (ctx.cur.y + h > ctx.bottom + 0.01 && !ctx.cur.atTop) newPage(ctx);
}

function emit(ctx: Ctx, op: Op) {
  while (ctx.pages.length <= ctx.cur.page) ctx.pages.push([]);
  ctx.pages[ctx.cur.page].push(op);
}

function addSpace(ctx: Ctx, h: number | undefined) {
  if (!h || ctx.cur.atTop) return;
  ctx.cur.y += h;
}

function baselineOffset(m: Measurer, size: number, lh: number): number {
  const { ascent, descent } = m.metrics('normal');
  return (lh - (ascent + descent) * size) / 2 + ascent * size;
}

function drawLine(
  ctx: Ctx,
  line: Line,
  runs: Run[],
  x: number,
  size: number,
  color: string,
  lh: number,
  tracking?: number,
) {
  const y = ctx.cur.y + baselineOffset(ctx.m, size, lh);
  for (const seg of line.segments) {
    const run = runs[seg.run];
    emit(ctx, {
      t: 'text',
      x: x + seg.x,
      y,
      text: seg.text,
      style: run.style ?? 'normal',
      size,
      color: run.color ?? color,
      w: seg.w,
      link: run.link,
      tracking: tracking || undefined,
    });
  }
}

function placeLines(
  ctx: Ctx,
  lines: Line[],
  runs: Run[],
  x: number,
  w: number,
  size: number,
  color: string,
  lh: number,
  align: Align = 'left',
  tracking?: number,
) {
  for (const line of lines) {
    ensure(ctx, lh);
    const dx = align === 'center' ? (w - line.width) / 2 : align === 'right' ? w - line.width : 0;
    drawLine(ctx, line, runs, x + dx, size, color, lh, tracking);
    ctx.cur.y += lh;
    ctx.cur.atTop = false;
  }
}

function measureBlocks(ctx: Ctx, blocks: Block[], w: number, atTop = true): number {
  const scratch: Ctx = {
    ...ctx,
    pages: [[]],
    cur: { page: 0, y: 0, atTop },
    top: 0,
    bottom: Number.POSITIVE_INFINITY,
    measuring: true,
  };
  placeBlocks(scratch, blocks, 0, w);
  return scratch.cur.y;
}

function placeBlocks(ctx: Ctx, blocks: Block[], x: number, w: number) {
  for (const b of blocks) placeBlock(ctx, b, x, w);
}

function placeBlock(ctx: Ctx, b: Block, x: number, w: number) {
  switch (b.type) {
    case 'space':
      addSpace(ctx, b.h);
      return;

    case 'rule': {
      addSpace(ctx, b.before);
      ensure(ctx, b.thickness);
      const y = ctx.cur.y + b.thickness / 2;
      emit(ctx, { t: 'line', x1: x, y1: y, x2: x + w, y2: y, width: b.thickness, color: b.color });
      ctx.cur.y += b.thickness;
      ctx.cur.atTop = false;
      ctx.cur.y += b.after ?? 0;
      return;
    }

    case 'para': {
      if (!b.runs.some((r) => r.text && r.text.trim())) return;
      addSpace(ctx, b.before);
      const lh = b.size * (b.lineHeight ?? DEFAULT_LH);
      const lines = ctx.wrapper.wrap(b.runs, b.size, w, w, b.tracking);
      placeLines(ctx, lines, b.runs, x, w, b.size, b.color, lh, b.align, b.tracking);
      ctx.cur.y += b.after ?? 0;
      return;
    }

    case 'row': {
      const hasLeft = b.left.some((r) => r.text && r.text.trim());
      const hasRight = b.right.some((r) => r.text && r.text.trim());
      if (!hasLeft && !hasRight) return;
      addSpace(ctx, b.before);
      const lh = b.size * (b.lineHeight ?? DEFAULT_LH);
      const rSize = b.rightSize ?? b.size;
      const rightLines = hasRight ? ctx.wrapper.wrap(b.right, rSize, Number.POSITIVE_INFINITY) : [];
      const rw = rightLines[0]?.width ?? 0;
      const gap = hasRight ? 14 : 0;
      const leftW = Math.max(w * 0.35, w - rw - gap);
      const lines = hasLeft ? ctx.wrapper.wrap(b.left, b.size, leftW) : [];
      ensure(ctx, lh);
      if (hasRight) {
        // Right text sits on the first line's baseline.
        const y = ctx.cur.y + baselineOffset(ctx.m, b.size, lh);
        for (const seg of rightLines[0].segments) {
          const run = b.right[seg.run];
          emit(ctx, {
            t: 'text',
            x: x + w - rw + seg.x,
            y,
            text: seg.text,
            style: run.style ?? 'normal',
            size: rSize,
            color: run.color ?? b.rightColor ?? b.color,
            w: seg.w,
            link: run.link,
          });
        }
      }
      if (lines.length) {
        placeLines(ctx, lines, b.left, x, leftW, b.size, b.color, lh);
      } else {
        ctx.cur.y += lh;
        ctx.cur.atTop = false;
      }
      ctx.cur.y += b.after ?? 0;
      return;
    }

    case 'bullet': {
      if (!b.runs.some((r) => r.text && r.text.trim())) return;
      addSpace(ctx, b.before);
      const lh = b.size * (b.lineHeight ?? DEFAULT_LH);
      const indent = b.indent ?? b.size * 1.1;
      const marker = cleanText(b.marker ?? '•', ctx.m) || '-';
      const lines = ctx.wrapper.wrap(b.runs, b.size, w - indent);
      ensure(ctx, lh);
      emit(ctx, {
        t: 'text',
        x: x + indent * 0.15,
        y: ctx.cur.y + baselineOffset(ctx.m, b.size, lh),
        text: marker,
        style: 'normal',
        size: b.size,
        color: b.markerColor ?? b.color,
        w: ctx.wrapper.textWidth(marker, 'normal', b.size),
      });
      placeLines(ctx, lines, b.runs, x + indent, w - indent, b.size, b.color, lh);
      ctx.cur.y += b.after ?? 0;
      return;
    }

    case 'group': {
      if (!ctx.measuring) {
        const h = measureBlocks(ctx, b.blocks, w, false);
        const room = ctx.bottom - ctx.cur.y;
        const full = ctx.bottom - ctx.top;
        if (h > room + 0.01 && h <= full && !ctx.cur.atTop) newPage(ctx);
      }
      placeBlocks(ctx, b.blocks, x, w);
      return;
    }

    case 'box': {
      const padX = b.padX ?? 0;
      const padY = b.padY ?? 0;
      const barW = b.bar?.w ?? 0;
      const innerX = x + padX + (barW ? barW + 6 : 0);
      const innerW = w - 2 * padX - (barW ? barW + 6 : 0);
      const inner = measureBlocks(ctx, b.blocks, innerW);
      if (inner <= 0) return;
      const total = inner + 2 * padY;
      addSpace(ctx, b.before);
      ensure(ctx, total);
      const wasTop = ctx.cur.atTop;
      const y0 = ctx.cur.y;
      if (b.fill) {
        if (b.bleed) {
          const top = wasTop ? 0 : y0;
          emit(ctx, { t: 'rect', x: 0, y: top, w: ctx.pageW, h: y0 + total - top, fill: b.fill });
        } else {
          emit(ctx, { t: 'rect', x, y: y0, w, h: total, fill: b.fill });
        }
      }
      if (b.bar) {
        emit(ctx, { t: 'rect', x, y: y0, w: b.bar.w, h: total, fill: b.bar.color });
      }
      // Lay out the children inside the box without letting them break pages.
      const saved = { top: ctx.top, bottom: ctx.bottom, measuring: ctx.measuring };
      ctx.measuring = true;
      ctx.cur.y = y0 + padY;
      ctx.cur.atTop = true;
      placeBlocks(ctx, b.blocks, innerX, innerW);
      ctx.measuring = saved.measuring;
      ctx.cur.y = y0 + total;
      ctx.cur.atTop = false;
      ctx.cur.y += b.after ?? 0;
      return;
    }
  }
}

export function layoutDocument(spec: DocSpec, m: Measurer): LayoutResult {
  const pages: Op[][] = [[]];
  const wrapper = new Wrapper(m);
  for (const flow of spec.flows) {
    const ctx: Ctx = {
      pages,
      pageW: spec.page.w,
      top: flow.top,
      bottom: flow.bottom,
      cur: { page: 0, y: flow.firstTop ?? flow.top, atTop: true },
      wrapper,
      m,
      measuring: false,
    };
    placeBlocks(ctx, flow.blocks, flow.x, flow.w);
  }
  // Drop trailing empty pages (a flow may have opened one without filling it).
  while (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop();
  if (spec.decorate) {
    pages.forEach((ops, i) => ops.unshift(...spec.decorate!(i)));
  }
  return { page: spec.page, pages };
}

/** Plain text of a layout, in drawing order. Used by tests and the ATS preview. */
export function layoutText(result: LayoutResult): string {
  const out: string[] = [];
  for (const ops of result.pages) {
    let lastY = -1;
    let line: string[] = [];
    for (const op of ops) {
      if (op.t !== 'text') continue;
      if (Math.abs(op.y - lastY) > 0.5 && line.length) {
        out.push(line.join(' '));
        line = [];
      }
      line.push(op.text);
      lastY = op.y;
    }
    if (line.length) out.push(line.join(' '));
  }
  return out.join('\n');
}
