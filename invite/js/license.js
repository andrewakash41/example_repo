// Premium licence keys.
//
// A key is `NY1.<payload>.<signature>` where payload is the UTF-8 text
// `phone|plan|issuedYYYYMMDD` and signature is ECDSA P-256 / SHA-256 over the
// payload bytes. The app only holds the public key, so keys cannot be forged
// in the browser. A key is tied to the RSVP WhatsApp number on the invitation,
// which makes a key copied out of a shared link useless for anyone else.

const PREFIX = 'NY1';
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIG = { name: 'ECDSA', hash: 'SHA-256' };
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64uEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Digits only. A bare 10-digit number gets the default country code.
export function normalizePhone(input, countryCode = '91') {
  let d = String(input ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10) d = countryCode + d;
  return d.length >= 8 && d.length <= 15 ? d : '';
}

export function prettyPhone(digits) {
  return digits ? '+' + digits : '';
}

export async function verifyLicense(key, publicKeyB64) {
  const fail = (reason) => ({ valid: false, reason });
  if (!publicKeyB64) return fail('not-configured');
  const parts = String(key ?? '').replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return fail('format');
  try {
    const payload = b64uDecode(parts[1]);
    const pub = await crypto.subtle.importKey('raw', b64uDecode(publicKeyB64), ALG, false, ['verify']);
    const ok = await crypto.subtle.verify(SIG, pub, b64uDecode(parts[2]), payload);
    if (!ok) return fail('signature');
    const [phone, plan, issued] = dec.decode(payload).split('|');
    if (!/^\d{8,15}$/.test(phone ?? '')) return fail('format');
    return { valid: true, phone, plan: plan || 'premium', issued: issued || '' };
  } catch {
    return fail('format');
  }
}

// True when `key` is genuine and was issued for this invitation's RSVP number.
export async function premiumFor(key, rsvpPhone, config) {
  if (!key) return { active: false, license: null };
  const license = await verifyLicense(key, config.licensePublicKey);
  const phone = normalizePhone(rsvpPhone, config.defaultCountryCode);
  return { active: license.valid && !!phone && license.phone === phone, license };
}

// ---- Seller side (seller.html and tools) ----

export async function generateSigningKey() {
  const pair = await crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { privateJwk, publicKey: publicKeyFromJwk(privateJwk) };
}

// Uncompressed P-256 point (0x04 || x || y), base64url. This is what goes in config.js.
export function publicKeyFromJwk(jwk) {
  const x = b64uDecode(jwk.x);
  const y = b64uDecode(jwk.y);
  const raw = new Uint8Array(65);
  raw[0] = 4;
  raw.set(x, 1);
  raw.set(y, 33);
  return b64uEncode(raw);
}

export async function issueLicense(privateJwk, phone, plan = 'premium', date = new Date()) {
  if (!/^\d{8,15}$/.test(phone)) throw new Error('Phone must be 8-15 digits including country code');
  const key = await crypto.subtle.importKey('jwk', privateJwk, ALG, false, ['sign']);
  const issued = date.toISOString().slice(0, 10).replace(/-/g, '');
  const payload = enc.encode(`${phone}|${plan}|${issued}`);
  const sig = new Uint8Array(await crypto.subtle.sign(SIG, key, payload));
  return `${PREFIX}.${b64uEncode(payload)}.${b64uEncode(sig)}`;
}
