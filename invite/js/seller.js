// Seller desk: holds the private signing key on this device and issues
// Premium keys for buyers' WhatsApp numbers.

import config from '../config.js';
import { $, el, toast, copyText, downloadBlob, siteBase, applyBrand, store } from './ui.js';
import { generateSigningKey, publicKeyFromJwk, issueLicense, verifyLicense, normalizePhone, prettyPhone } from './license.js';

const PRIVATE = 'invite.seller.key';
const SALES = 'invite.seller.sales';

let privateJwk = store(PRIVATE);

function refreshKeyStatus() {
  const status = $('#keyStatus');
  $('#forgetBtn').hidden = !privateJwk;
  if (!privateJwk) {
    status.className = 'warn';
    status.textContent = 'No signing key on this device. Load your key file, or create a new key.';
  } else if (publicKeyFromJwk(privateJwk) === config.licensePublicKey) {
    status.className = 'ok';
    status.textContent = 'Signing key loaded and it matches this site. You can issue keys.';
  } else {
    status.className = 'warn';
    status.textContent = 'A signing key is loaded, but it does not match licensePublicKey in config.js. Keys you issue will not work until the site is updated.';
  }
}

function isSigningKey(jwk) {
  return jwk && jwk.kty === 'EC' && jwk.crv === 'P-256' && jwk.d && jwk.x && jwk.y;
}

async function onImport(file) {
  try {
    const jwk = JSON.parse(await file.text());
    if (!isSigningKey(jwk)) throw new Error('not a key');
    privateJwk = jwk;
    store(PRIVATE, jwk);
    toast('Signing key loaded');
  } catch {
    toast('That file is not a signing key');
  }
  refreshKeyStatus();
}

async function onCreate() {
  if (privateJwk && !confirm('Create a new signing key? Premium keys you issued with the current one will stop working once the site is updated.')) return;
  const { privateJwk: jwk, publicKey } = await generateSigningKey();
  privateJwk = jwk;
  store(PRIVATE, jwk);
  downloadBlob(new Blob([JSON.stringify(jwk, null, 2)], { type: 'application/json' }), 'seller-key.json');
  $('#newPublic').textContent = publicKey;
  $('#newKey').hidden = false;
  refreshKeyStatus();
}

function renderSales() {
  const sales = store(SALES) ?? [];
  $('#salesEmpty').hidden = sales.length > 0;
  $('#sales').hidden = sales.length === 0;
  $('#sales tbody').replaceChildren(...sales.slice().reverse().map((s) => el('tr', {}, [
    el('td', { text: s.date }),
    el('td', { text: prettyPhone(s.phone) }),
    el('td', {}, el('button', {
      class: 'btn ghost small', type: 'button', text: 'Copy key',
      onclick: async () => toast((await copyText(s.key)) ? 'Key copied' : 'Could not copy'),
    })),
  ])));
}

async function onIssue() {
  const error = $('#issueError');
  error.textContent = '';
  $('#issued').hidden = true;
  if (!privateJwk) { error.textContent = 'Load your signing key first.'; return; }
  const phone = normalizePhone($('#buyer').value, config.defaultCountryCode);
  if (!phone) { error.textContent = 'Enter the buyer’s WhatsApp number, including country code.'; return; }
  const key = await issueLicense(privateJwk, phone);
  const check = await verifyLicense(key, config.licensePublicKey);
  if (!check.valid) {
    error.textContent = 'This key will not work on the live site: the signing key does not match config.js.';
  }
  $('#issuedKey').textContent = key;
  $('#sendKey').href = `https://wa.me/${phone}?text=${encodeURIComponent(
    `Thank you for buying ${config.brand} Premium!\n\nYour key (copy the whole line):\n${key}\n\nOpen ${siteBase()} → Go Premium → paste the key → Activate. Keep ${prettyPhone(phone)} as the RSVP WhatsApp number on your invitation.`,
  )}`;
  $('#issued').hidden = false;
  const sales = store(SALES) ?? [];
  sales.push({ date: new Date().toISOString().slice(0, 10), phone, key });
  store(SALES, sales);
  renderSales();
}

applyBrand();
refreshKeyStatus();
renderSales();
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', (e) => { if (e.target.files[0]) onImport(e.target.files[0]); e.target.value = ''; });
$('#createBtn').addEventListener('click', onCreate);
$('#forgetBtn').addEventListener('click', () => {
  if (!confirm('Remove the signing key from this device? Make sure you still have your key file.')) return;
  privateJwk = null;
  store(PRIVATE, null);
  refreshKeyStatus();
});
$('#copyPublic').addEventListener('click', async () => toast((await copyText($('#newPublic').textContent)) ? 'Copied' : 'Could not copy'));
$('#copyKey').addEventListener('click', async () => toast((await copyText($('#issuedKey').textContent)) ? 'Key copied' : 'Could not copy'));
$('#issue').addEventListener('click', onIssue);
