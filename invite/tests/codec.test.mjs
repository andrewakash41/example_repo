import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeInvite, decodeInvite, sanitize } from '../js/codec.js';
import { defaultInvite, formatDate, formatTime, headline, buildIcs, mapUrl, eventStart, shareText, fileSlug } from '../js/model.js';

test('an invitation survives the round trip through a link', async () => {
  const data = { ...defaultInvite('wedding', new Date(2026, 10, 15)), ph: '919876543210', ev: [{ n: 'Sangeet', d: '2026-12-18', t: '18:30', v: 'Lawn' }] };
  const payload = await encodeInvite(data);
  assert.match(payload, /^z[A-Za-z0-9_-]+$/);
  const back = await decodeInvite(payload);
  assert.equal(back.n1, 'Aarav');
  assert.equal(back.bl, '॥ श्री गणेशाय नमः ॥');
  assert.equal(back.dt, '2026-12-19');
  assert.deepEqual(back.ev, data.ev);
  assert.ok(payload.length < 600, `link payload is ${payload.length} chars`);
});

test('uncompressed payloads decode too', async () => {
  const json = Buffer.from(JSON.stringify({ n1: 'Zoya', tl: 'ivory' })).toString('base64url');
  assert.deepEqual(await decodeInvite('j' + json), { n1: 'Zoya', tl: 'ivory' });
});

test('garbage links decode to null instead of throwing', async () => {
  for (const bad of ['', 'z', 'zzzz', 'j!!!', 'x' + 'A'.repeat(20), 'j' + Buffer.from('[1,2]').toString('base64url')]) {
    assert.equal(await decodeInvite(bad), null);
  }
});

test('sanitize bounds and filters untrusted fields', () => {
  const out = sanitize({
    n1: 'A'.repeat(500), ml: 'javascript:alert(1)', dt: '19/12/2026', tm: '7pm', ph: '+91 98765-43210',
    evil: '<script>', ms: 42, ev: [{ n: 'Haldi', d: 'bad' }, { d: '2026-12-18' }, 'x', ...Array(10).fill({ n: 'More' })],
  });
  assert.equal(out.n1.length, 60);
  assert.equal(out.ml, undefined);
  assert.equal(out.dt, undefined);
  assert.equal(out.tm, undefined);
  assert.equal(out.ph, '919876543210');
  assert.equal(out.evil, undefined);
  assert.equal(out.ms, undefined);
  assert.deepEqual(out.ev[0], { n: 'Haldi' });
  assert.ok(out.ev.length <= 6);
  assert.equal(sanitize({ bl: '' }).bl, undefined);
  assert.equal(sanitize({ bl: '' }, { keepEmpty: true }).bl, '');
});

test('date, time and headline formatting', () => {
  assert.equal(formatDate('2026-12-19', 'en-IN'), 'Saturday 19 December 2026'.replace('Saturday ', 'Saturday, '));
  assert.match(formatDate('2026-12-19', 'hi-IN'), /दिसंबर/);
  assert.equal(formatDate('nope'), '');
  assert.equal(formatTime('19:00', 'en-IN'), '7:00 PM');
  assert.equal(formatTime('', 'en-IN'), '');
  assert.equal(headline({ n1: 'Aarav', jn: 'weds', n2: 'Meera' }), 'Aarav weds Meera');
  assert.equal(headline({ n1: 'Griha Pravesh' }), 'Griha Pravesh');
  assert.equal(headline({}), 'Invitation');
  assert.equal(fileSlug({ n1: 'Aarav', n2: 'Meera' }), 'invitation-aarav-meera');
});

test('sample date is a Saturday at least four weeks out', () => {
  const d = eventStart(defaultInvite('birthday', new Date(2026, 10, 15)));
  assert.equal(d.getDay(), 6);
  assert.ok(d - new Date(2026, 10, 15) >= 28 * 86400000);
});

test('calendar file and map link', () => {
  const data = { n1: 'Aarav', n2: 'Meera', jn: 'weds', dt: '2026-12-19', tm: '19:00', vn: 'Grand, Hall; A', va: 'MG Road' };
  const ics = buildIcs(data);
  assert.match(ics, /DTSTART:20261219T190000\r\n/);
  assert.match(ics, /DTEND:20261219T220000\r\n/);
  assert.ok(ics.includes(String.raw`LOCATION:Grand\, Hall\; A\, MG Road`));
  assert.match(buildIcs({ ...data, tm: '' }), /DTSTART;VALUE=DATE:20261219\r\nDTEND;VALUE=DATE:20261220/);
  assert.equal(buildIcs({ n1: 'x' }), '');
  assert.match(mapUrl(data), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Grand/);
  assert.equal(mapUrl({ ml: 'https://maps.app.goo.gl/x' }), 'https://maps.app.goo.gl/x');
  assert.match(shareText(data, 'https://x/view.html#z'), /Aarav weds Meera[\s\S]*https:\/\/x\/view\.html#z/);
});
