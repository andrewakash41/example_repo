// Invitation <-> share-link payload.
//
// The whole invitation travels in the URL fragment (after '#'), which browsers
// never send to a server. Format: 'z' + base64url(deflate-raw(JSON)) when the
// browser can compress, otherwise 'j' + base64url(JSON).

import { b64uEncode, b64uDecode } from './license.js';

const LIMITS = {
  tp: 20, tl: 20, lg: 10, bl: 80, in: 120, n1: 60, jn: 20, n2: 60, ms: 400,
  dt: 10, tm: 5, vn: 100, va: 240, ml: 400, ft: 140, hn: 60, ph: 15, lk: 400,
};
const EVENT_LIMITS = { n: 50, d: 10, t: 5, v: 100 };
const MAX_EVENTS = 6;

// Link data is untrusted input: keep known fields only, as bounded strings.
// `keepEmpty` preserves fields the user deliberately cleared (used for drafts).
export function sanitize(raw, { keepEmpty = false } = {}) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, max] of Object.entries(LIMITS)) {
    if (typeof raw[k] === 'string' && (raw[k] || keepEmpty)) out[k] = raw[k].slice(0, max);
  }
  if (out.dt && !/^\d{4}-\d{2}-\d{2}$/.test(out.dt)) delete out.dt;
  if (out.tm && !/^\d{2}:\d{2}$/.test(out.tm)) delete out.tm;
  if (out.ph) out.ph = out.ph.replace(/\D/g, '');
  if (out.ml && !/^https?:\/\//i.test(out.ml)) delete out.ml;
  if (Array.isArray(raw.ev)) {
    const ev = [];
    for (const e of raw.ev.slice(0, MAX_EVENTS)) {
      if (!e || typeof e !== 'object') continue;
      const row = {};
      for (const [k, max] of Object.entries(EVENT_LIMITS)) {
        if (typeof e[k] === 'string' && e[k]) row[k] = e[k].slice(0, max);
      }
      if (row.d && !/^\d{4}-\d{2}-\d{2}$/.test(row.d)) delete row.d;
      if (row.t && !/^\d{2}:\d{2}$/.test(row.t)) delete row.t;
      if (row.n) ev.push(row);
    }
    if (ev.length) out.ev = ev;
  }
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeInvite(data) {
  const json = new TextEncoder().encode(JSON.stringify(sanitize(data)));
  if (typeof CompressionStream === 'function') {
    try {
      return 'z' + b64uEncode(await pipe(json, new CompressionStream('deflate-raw')));
    } catch { /* fall through to plain */ }
  }
  return 'j' + b64uEncode(json);
}

export async function decodeInvite(payload) {
  try {
    const kind = payload[0];
    let bytes = b64uDecode(payload.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') return null;
    if (bytes.length > 20000) return null;
    const data = sanitize(JSON.parse(new TextDecoder().decode(bytes)));
    return Object.keys(data).length ? data : null;
  } catch {
    return null;
  }
}
