// Small DOM helpers shared by the editor, guest page and seller page.

import config from '../config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) {
    if (child != null && child !== false && child !== '') node.append(child);
  }
  return node;
}

let toastTimer;
export function toast(message) {
  let box = $('#toast');
  if (!box) {
    box = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 2600);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = el('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Base address of the site, ending in '/'.
export function siteBase() {
  if (config.siteUrl) return config.siteUrl.replace(/\/?$/, '/');
  return new URL('.', location.href).href;
}

// Human-readable address for watermarks, e.g. 'nyota.example/invite'.
export function siteLabel() {
  return siteBase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// Fill every [data-brand] / [data-price] placeholder from config.
export function applyBrand(root = document) {
  for (const node of $$('[data-brand]', root)) node.textContent = config.brand;
  for (const node of $$('[data-price]', root)) node.textContent = config.priceLabel;
}

export function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode or blocked storage: carry on without persistence */ }
  return null;
}
