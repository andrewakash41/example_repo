import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSigningKey, issueLicense, verifyLicense, premiumFor, normalizePhone, publicKeyFromJwk } from '../js/license.js';

const seller = await generateSigningKey();
const config = { licensePublicKey: seller.publicKey, defaultCountryCode: '91' };

test('normalizePhone adds the country code to bare 10-digit numbers', () => {
  assert.equal(normalizePhone('98765 43210'), '919876543210');
  assert.equal(normalizePhone('+91 98765-43210'), '919876543210');
  assert.equal(normalizePhone('09876543210'), '919876543210');
  assert.equal(normalizePhone('+1 (415) 555 0100'), '14155550100');
  assert.equal(normalizePhone('123'), '');
  assert.equal(normalizePhone(''), '');
});

test('an issued key verifies and carries the phone', async () => {
  const key = await issueLicense(seller.privateJwk, '919876543210');
  const res = await verifyLicense(key, seller.publicKey);
  assert.equal(res.valid, true);
  assert.equal(res.phone, '919876543210');
  assert.equal(res.plan, 'premium');
});

test('whitespace pasted into a key is ignored', async () => {
  const key = await issueLicense(seller.privateJwk, '919876543210');
  const messy = ` ${key.slice(0, 30)}\n${key.slice(30)}  `;
  assert.equal((await verifyLicense(messy, seller.publicKey)).valid, true);
});

test('tampered, foreign and malformed keys are rejected', async () => {
  const key = await issueLicense(seller.privateJwk, '919876543210');
  const [prefix, payload, sig] = key.split('.');
  const otherPayload = (await issueLicense(seller.privateJwk, '919999999999')).split('.')[1];
  assert.equal((await verifyLicense(`${prefix}.${otherPayload}.${sig}`, seller.publicKey)).valid, false);
  const stranger = await generateSigningKey();
  const forged = await issueLicense(stranger.privateJwk, '919876543210');
  assert.equal((await verifyLicense(forged, seller.publicKey)).valid, false);
  for (const bad of ['', 'hello', 'NY1.a.b', `XX1.${payload}.${sig}`, null]) {
    assert.equal((await verifyLicense(bad, seller.publicKey)).valid, false);
  }
  assert.equal((await verifyLicense(key, '')).reason, 'not-configured');
});

test('premium is active only for the RSVP number the key was issued to', async () => {
  const key = await issueLicense(seller.privateJwk, '919876543210');
  assert.equal((await premiumFor(key, '98765 43210', config)).active, true);
  assert.equal((await premiumFor(key, '+91 98765 43210', config)).active, true);
  assert.equal((await premiumFor(key, '9999999999', config)).active, false);
  assert.equal((await premiumFor(key, '', config)).active, false);
  assert.equal((await premiumFor('', '9876543210', config)).active, false);
});

test('publicKeyFromJwk matches the generated public key', () => {
  assert.equal(publicKeyFromJwk(seller.privateJwk), seller.publicKey);
});

test('the public key committed in config.js is a valid P-256 point', async () => {
  const { default: live } = await import('../config.js');
  assert.match(live.licensePublicKey, /^[A-Za-z0-9_-]{87}$/);
  assert.equal((await verifyLicense('NY1.YQ.YQ', live.licensePublicKey)).reason, 'signature');
});
