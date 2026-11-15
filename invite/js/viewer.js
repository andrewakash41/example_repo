// Guest page: decodes the invitation from the link and shows the card with
// a countdown, RSVP, map and calendar actions.

import config from '../config.js';
import { $, el, downloadBlob, siteBase, siteLabel } from './ui.js';
import { decodeInvite } from './codec.js';
import { premiumFor, normalizePhone } from './license.js';
import { templateById } from './templates.js';
import { renderInvite, W } from './render.js';
import { headline, eventStart, mapUrl, buildIcs, fileSlug, formatDate, formatTime } from './model.js';

const app = $('#app');

function showEmpty() {
  app.replaceChildren(el('div', { class: 'empty' }, [
    el('h1', { text: 'This invitation link is incomplete' }),
    el('p', { text: 'Ask the host to send the link again, or make your own invitation.' }),
    el('a', { class: 'btn theme', href: siteBase(), text: `Create an invitation with ${config.brand}` }),
  ]));
  setTheme(templateById('royal').page);
}

function setTheme(page) {
  const s = document.body.style;
  s.setProperty('--page-bg', page.bg);
  s.setProperty('--page-fg', page.fg);
  s.setProperty('--page-btn', page.btn);
  s.setProperty('--page-btn-text', page.btnText);
  $('meta[name="theme-color"]')?.remove();
  document.head.append(el('meta', { name: 'theme-color', content: page.bg }));
}

function countdown(start) {
  const cells = ['Days', 'Hours', 'Mins', 'Secs'].map((label) => {
    const value = el('b', { text: '0' });
    return { value, node: el('div', {}, [value, el('span', { text: label })]) };
  });
  const box = el('div', { class: 'countdown', role: 'timer', 'aria-label': 'Time until the event' }, cells.map((c) => c.node));
  const note = el('p', { class: 'note', hidden: true });
  const tick = () => {
    const left = start.getTime() - Date.now();
    if (left <= 0) {
      box.hidden = true;
      note.hidden = false;
      note.textContent = left > -86400000 ? 'It’s happening today!' : 'Thank you for celebrating with us';
      return false;
    }
    const s = Math.floor(left / 1000);
    [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
      .forEach((n, i) => { cells[i].value.textContent = String(n); });
    return true;
  };
  if (tick()) {
    const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);
  }
  return [box, note];
}

function rsvpButtons(data) {
  const phone = normalizePhone(data.ph, config.defaultCountryCode);
  if (!phone) return null;
  const link = (reply) => `https://wa.me/${phone}?text=${encodeURIComponent(`${reply}\n(${headline(data)})\nName: \nNumber of guests: `)}`;
  return el('div', {}, [
    el('p', { class: 'note', text: data.hn ? `RSVP to ${data.hn}` : 'Will you join us?' }),
    el('div', { class: 'two', style: 'margin-top:12px' }, [
      el('a', { class: 'btn whatsapp', href: link('Yes, I will be there! 🎉'), target: '_blank', rel: 'noopener', text: 'Yes, I’ll be there' }),
      el('a', { class: 'btn outline', href: link('Sorry, I will not be able to make it.'), target: '_blank', rel: 'noopener', text: 'Can’t make it' }),
    ]),
  ]);
}

function schedule(data) {
  const rows = (data.ev ?? []).map((e) => {
    const when = [formatDate(e.d, data.lg), formatTime(e.t, data.lg)].filter(Boolean).join(' · ');
    return el('li', {}, [el('b', { text: e.n }), when && el('span', { text: when }), e.v && el('span', { text: e.v })]);
  });
  return rows.length ? [el('h2', { text: 'Functions' }), el('ul', { class: 'schedule' }, rows)] : [];
}

async function show(data) {
  const { active } = await premiumFor(data.lk, data.ph, config);
  const tpl = templateById(data.tl);
  // A premium design without a valid key falls back to a free one.
  if (tpl.premium && !active) data.tl = 'royal';
  if (!active) delete data.ev;
  const page = templateById(data.tl).page;
  setTheme(page);
  document.title = `${headline(data)} · Invitation`;

  const canvas = el('canvas', { role: 'img', 'aria-label': `Invitation: ${headline(data)}. ${data.ms ?? ''}` });
  const start = eventStart(data);
  const map = mapUrl(data);
  const ics = buildIcs(data);

  app.replaceChildren(
    canvas,
    ...(start ? countdown(start) : []),
    rsvpButtons(data) ?? '',
    el('div', { class: 'buttons' }, [
      map && el('a', { class: 'btn theme', href: map, target: '_blank', rel: 'noopener', text: 'Open venue in Maps' }),
      ics && el('button', {
        class: 'btn outline', type: 'button', text: 'Add to calendar',
        onclick: () => downloadBlob(new Blob([ics], { type: 'text/calendar' }), `${fileSlug(data)}.ics`),
      }),
    ]),
    ...schedule(data),
    active ? '' : el('p', { class: 'made' }, [
      'Made with ', el('a', { href: siteBase(), text: config.brand }), '. Create your own invitation free.',
    ]),
  );

  const scale = Math.max(0.5, Math.min(1, (canvas.clientWidth * (window.devicePixelRatio || 1)) / W));
  await renderInvite(canvas, data, {
    scale, mark: active ? 'none' : 'free',
    markText: `Made with ${config.brand} · free invitations at ${siteLabel()}`,
  });
}

async function start() {
  const data = await decodeInvite(location.hash.slice(1));
  if (data) await show(data); else showEmpty();
}

window.addEventListener('hashchange', start);
start();
