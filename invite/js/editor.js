// Editor page: form <-> invitation data, live preview, export, share, unlock.

import config from '../config.js';
import { $, $$, el, toast, copyText, downloadBlob, siteBase, siteLabel, applyBrand, store } from './ui.js';
import { EVENT_TYPES, WORD_FIELDS, BLESSINGS, DATE_LANGS, eventType, defaultInvite, shareText, fileSlug } from './model.js';
import { TEMPLATES, templateById } from './templates.js';
import { renderInvite, canvasToBlob, W } from './render.js';
import { encodeInvite, sanitize } from './codec.js';
import { premiumFor, verifyLicense, normalizePhone, prettyPhone } from './license.js';

const DRAFT = 'invite.draft';
const KEY = 'invite.key';
const MAX_EVENTS = 6;

const state = {
  data: { ...defaultInvite('wedding'), ...sanitize(store(DRAFT), { keepEmpty: true }) },
  key: store(KEY) || '',
  premium: false,
  license: null,
};
if (!Array.isArray(state.data.ev)) state.data.ev = [];

const preview = $('#preview');
const markText = `Made with ${config.brand} · free invitations at ${siteLabel()}`;

// ---- Rendering ----

let rendering = false, dirty = false, thumbTimer;

async function render() {
  if (rendering) { dirty = true; return; }
  rendering = true;
  do {
    dirty = false;
    const { active, license } = await premiumFor(state.key, state.data.ph, config);
    state.premium = active;
    state.license = license;
    const scale = Math.max(0.4, Math.min(1, (preview.clientWidth * (window.devicePixelRatio || 1)) / W));
    await renderInvite(preview, state.data, { scale, mark: markFor(state.data.tl), markText });
    updateStatus();
  } while (dirty);
  rendering = false;
}

function isLocked(templateId = state.data.tl) {
  return templateById(templateId).premium && !state.premium;
}

function markFor(templateId) {
  if (isLocked(templateId)) return 'preview';
  return state.premium ? 'none' : 'free';
}

function changed() {
  store(DRAFT, state.data);
  render();
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(renderThumbs, 450);
}

async function renderThumbs() {
  for (const btn of $$('#templates button')) {
    await renderInvite($('canvas', btn), { ...state.data, tl: btn.dataset.id }, { scale: 0.2 });
  }
}

function updateStatus() {
  const status = $('#status');
  const licensedPhone = state.license?.valid ? state.license.phone : '';
  if (isLocked()) {
    status.textContent = `This is a Premium design. Unlock it for ${config.priceLabel} to download and share.`;
  } else if (state.premium) {
    status.textContent = 'Premium is active: no branding, HD download.';
  } else if (licensedPhone) {
    status.textContent = `Your Premium key is for ${prettyPhone(licensedPhone)}. Use that as the RSVP WhatsApp number to switch Premium on.`;
  } else {
    status.textContent = 'Free card with a small “Made with” strip at the bottom.';
  }
  $('#download').textContent = isLocked() ? `Unlock · ${config.priceLabel}` : state.premium ? 'Download HD' : 'Download';
  const pill = $('#premiumBtn');
  pill.textContent = state.premium ? 'Premium ✓' : 'Go Premium';
  pill.classList.toggle('on', state.premium);
  for (const btn of $$('#templates button')) {
    const tpl = templateById(btn.dataset.id);
    $('.badge', btn).textContent = !tpl.premium ? 'Free' : state.premium ? 'Premium' : '🔒 Premium';
  }
}

// ---- Pickers ----

function buildTypes() {
  const box = $('#types');
  for (const t of EVENT_TYPES) {
    box.append(el('button', {
      type: 'button', class: 'chip', role: 'radio', 'data-id': t.id,
      onclick: () => setType(t.id),
    }, [el('span', { 'aria-hidden': 'true', text: t.emoji }), ` ${t.label}`]));
  }
}

function buildTemplates() {
  const box = $('#templates');
  for (const t of TEMPLATES) {
    box.append(el('button', {
      type: 'button', class: 'tpl', role: 'radio', 'data-id': t.id,
      onclick: () => { state.data.tl = t.id; syncPickers(); changed(); },
    }, [
      el('canvas', { width: 216, height: 302, 'aria-hidden': 'true' }),
      el('span', { class: 'name', text: t.name }),
      el('span', { class: 'badge' }),
    ]));
  }
}

function syncPickers() {
  for (const b of $$('#types .chip')) b.setAttribute('aria-checked', String(b.dataset.id === state.data.tp));
  for (const b of $$('#templates .tpl')) b.setAttribute('aria-checked', String(b.dataset.id === state.data.tl));
  const type = eventType(state.data.tp);
  $('#n1Label').textContent = type.pair ? 'Name' : 'Title';
  for (const node of $$('.pair-only')) node.hidden = !type.pair;
}

// Switching event type swaps in that type's wording, but never overwrites
// text the user has typed themselves.
function setType(id) {
  const from = eventType(state.data.tp), to = eventType(id);
  if (from.id === to.id) return;
  for (const f of WORD_FIELDS) {
    const current = state.data[f] ?? '';
    if (current === '' || current === from.words[f]) state.data[f] = to.words[f];
  }
  if (!to.pair) { state.data.jn = ''; state.data.n2 = ''; }
  if (state.data.tl === from.template) state.data.tl = to.template;
  state.data.tp = to.id;
  fillForm();
  syncPickers();
  changed();
}

// ---- Form ----

function fillForm() {
  for (const input of $$('[data-f]')) input.value = state.data[input.dataset.f] ?? '';
}

function bindForm() {
  for (const lang of DATE_LANGS) $('#lang').append(el('option', { value: lang[0], text: lang[1] }));
  for (const b of BLESSINGS) $('#blessings').append(el('option', { value: b }));
  $('#form').addEventListener('input', (e) => {
    const f = e.target.dataset?.f;
    if (!f) return;
    state.data[f] = e.target.value;
    changed();
  });
}

function buildEvents() {
  const box = $('#events');
  box.replaceChildren();
  state.data.ev.forEach((row, i) => {
    const field = (key, props) => el('input', {
      ...props, value: row[key] ?? '',
      oninput: (e) => { row[key] = e.target.value; store(DRAFT, state.data); },
    });
    box.append(el('div', { class: 'event' }, [
      field('n', { placeholder: 'Function, e.g. Sangeet', maxlength: 50, 'aria-label': 'Function name' }),
      field('d', { type: 'date', 'aria-label': 'Date' }),
      field('t', { type: 'time', 'aria-label': 'Time' }),
      field('v', { placeholder: 'Venue (optional)', maxlength: 100, 'aria-label': 'Venue' }),
      el('button', {
        type: 'button', class: 'remove', 'aria-label': 'Remove function', text: '×',
        onclick: () => { state.data.ev.splice(i, 1); buildEvents(); store(DRAFT, state.data); },
      }),
    ]));
  });
  $('#addEvent').hidden = state.data.ev.length >= MAX_EVENTS;
}

// ---- Export & share ----

async function inviteLink() {
  const data = { ...state.data };
  if (state.premium) data.lk = state.key; else delete data.ev;
  return `${siteBase()}view.html#${await encodeInvite(data)}`;
}

async function cardBlob() {
  const canvas = document.createElement('canvas');
  await renderInvite(canvas, state.data, { scale: state.premium ? 2 : 1, mark: state.premium ? 'none' : 'free', markText });
  return canvasToBlob(canvas);
}

function gate() {
  if (!isLocked()) return true;
  openUnlock();
  return false;
}

async function busy(button, fn) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    await fn();
  } catch (err) {
    if (err?.name !== 'AbortError') toast('Something went wrong. Please try again.');
  } finally {
    button.disabled = false;
  }
}

async function onDownload() {
  if (!gate()) return;
  downloadBlob(await cardBlob(), `${fileSlug(state.data)}.png`);
  toast('Card saved to your downloads');
}

async function onShare() {
  if (!gate()) return;
  const link = await inviteLink();
  const text = shareText(state.data, link);
  const file = new File([await cardBlob()], `${fileSlug(state.data)}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text });
  } else if (navigator.share) {
    await navigator.share({ text });
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
}

async function onCopyLink() {
  if (!gate()) return;
  toast((await copyText(await inviteLink())) ? 'Invitation link copied' : 'Could not copy the link');
}

// ---- Unlock Premium ----

function buyerPhone() {
  return normalizePhone($('#unlockPhone').value, config.defaultCountryCode);
}

function buildPayOptions() {
  const box = $('#payOptions');
  box.replaceChildren();
  if (config.checkoutUrl) {
    box.append(el('a', { class: 'btn primary', href: config.checkoutUrl, target: '_blank', rel: 'noopener', text: `Pay ${config.priceLabel} online` }));
  }
  if (config.upiId) {
    // UPI apps expect %20 for spaces and a literal '@' in the payee address.
    const q = (s) => encodeURIComponent(s).replace(/%40/g, '@');
    const uri = `upi://pay?pa=${q(config.upiId)}&pn=${q(config.upiName || config.brand)}`
      + `&am=${config.price}.00&cu=INR&tn=${q(`${config.brand} Premium`)}`;
    const qr = window.qrcode(0, 'M');
    qr.addData(uri);
    qr.make();
    const code = el('div', { class: 'qr', role: 'img', 'aria-label': 'UPI payment QR code' });
    code.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    box.append(el('div', { class: 'upi' }, [
      code,
      el('div', {}, [
        el('p', { class: 'hint', text: 'Scan with any UPI app, or pay to this UPI ID:' }),
        el('button', {
          type: 'button', class: 'upi-id', text: config.upiId,
          onclick: async () => toast((await copyText(config.upiId)) ? 'UPI ID copied' : config.upiId),
        }),
        el('a', { class: 'btn ghost small', href: uri, text: 'Open UPI app' }),
      ]),
    ]));
  }
  if (!box.children.length) {
    box.append(el('p', { class: 'hint', text: 'Online payment is not set up on this site yet. Please contact us to buy Premium.' }));
  }
}

function updateConfirmLink() {
  const phone = buyerPhone();
  const text = `Hi! I paid ${config.priceLabel} for ${config.brand} Premium.\nPlease send my key for RSVP number: ${prettyPhone(phone) || '(my number)'}\nPayment screenshot attached.`;
  const a = $('#confirmPay');
  if (config.sellerWhatsApp) {
    a.href = `https://wa.me/${config.sellerWhatsApp}?text=${encodeURIComponent(text)}`;
    a.textContent = 'Send on WhatsApp';
  } else if (config.supportEmail) {
    a.href = `mailto:${config.supportEmail}?subject=${encodeURIComponent(`${config.brand} Premium`)}&body=${encodeURIComponent(text)}`;
    a.textContent = 'Send by email';
  } else {
    a.hidden = true;
  }
}

function openUnlock() {
  $('#unlockPhone').value = state.data.ph ?? '';
  $('#keyInput').value = state.key;
  $('#keyError').textContent = '';
  updateConfirmLink();
  $('#unlock').showModal();
}

async function onActivate() {
  const key = $('#keyInput').value.replace(/\s+/g, '');
  const error = $('#keyError');
  const license = await verifyLicense(key, config.licensePublicKey);
  if (!license.valid) {
    error.textContent = license.reason === 'not-configured'
      ? 'Premium keys are not set up on this site yet.'
      : 'That key is not valid. Copy the whole key from our message and try again.';
    return;
  }
  const phone = buyerPhone();
  if (phone && phone !== license.phone) {
    error.textContent = `This key is for ${prettyPhone(license.phone)}. Change the RSVP number above to that number to use it.`;
    return;
  }
  state.key = key;
  store(KEY, key);
  state.data.ph = license.phone;
  fillForm();
  $('#unlock').close();
  changed();
  toast('Premium unlocked. Thank you!');
}

function bindUnlock() {
  buildPayOptions();
  $('#unlockPhone').addEventListener('input', (e) => {
    state.data.ph = e.target.value;
    $('[data-f="ph"]').value = e.target.value;
    updateConfirmLink();
    changed();
  });
  $('#activate').addEventListener('click', onActivate);
  $('#premiumBtn').addEventListener('click', openUnlock);
  for (const b of $$('[data-unlock]')) b.addEventListener('click', openUnlock);
  // Close when the backdrop is tapped.
  $('#unlock').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
}

// ---- Start ----

applyBrand();
buildTypes();
buildTemplates();
bindForm();
bindUnlock();
fillForm();
buildEvents();
syncPickers();

$('#download').addEventListener('click', (e) => busy(e.currentTarget, onDownload));
$('#share').addEventListener('click', (e) => busy(e.currentTarget, onShare));
$('#copyLink').addEventListener('click', (e) => busy(e.currentTarget, onCopyLink));
$('#addEvent').addEventListener('click', () => {
  if (!state.premium) { openUnlock(); return; }
  state.data.ev.push({ n: '', d: state.data.dt ?? '', t: '', v: '' });
  buildEvents();
  $('#events .event:last-child input')?.focus();
});
window.addEventListener('resize', render);

render().then(renderThumbs);
