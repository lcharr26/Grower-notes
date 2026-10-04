// Shared UI helpers: element builder, toast, busy buttons, formatting.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'value') el.value = value ?? '';
    else if (value === true) el.setAttribute(key, '');
    else if (value !== false && value != null) el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child != null && child !== false) el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

export async function busy(button, label, fn) {
  const old = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try { await fn(); }
  catch (err) { console.error(err); toast(err.message || 'Something went wrong.'); }
  finally { button.disabled = false; button.textContent = old; }
}

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export function sinceText(iso) {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

export function megabytes(bytes) {
  return (bytes / 1_048_576).toFixed(1) + ' MB';
}

// A row of single-choice chips. Returns { el, get value() }.
export function chips(options, selected, onchange) {
  let value = selected;
  const buttons = options.map(([key, label]) => h('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': String(key === value),
    onclick: () => {
      value = key;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.key === key));
      if (onchange) onchange(key);
    },
    'data-key': key,
  }, label));
  return { el: h('div', { class: 'chips', role: 'group' }, buttons), get value() { return value; } };
}

// Frost dates repeat every year, so they're stored as 'MM-DD'.
export function frostToInput(mmdd) {
  return mmdd ? `${new Date().getFullYear()}-${mmdd}` : '';
}

export function inputToFrost(value) {
  return value ? value.slice(5) : null;
}

export function frostText(mmdd) {
  if (!mmdd) return null;
  return new Date(`2001-${mmdd}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

// Chips where any number can be on (or none). Returns { el, get values() }.
export function multiChips(options, selected = [], onchange) {
  const values = new Set(selected);
  const el = h('div', { class: 'chips', role: 'group' }, options.map(([key, label]) => {
    const b = h('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(values.has(key)),
      onclick: () => {
        if (values.has(key)) values.delete(key); else values.add(key);
        b.setAttribute('aria-pressed', String(values.has(key)));
        if (onchange) onchange([...values]);
      },
    }, label);
    return b;
  }));
  return { el, get values() { return [...values]; } };
}

// Single choice that can also be switched off again. Returns { el, get value() }.
export function optionalChip(options, selected = null) {
  let value = selected;
  const buttons = options.map(([key, label]) => h('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': String(key === value),
    onclick: () => {
      value = value === key ? null : key;
      for (const [i, b] of buttons.entries()) b.setAttribute('aria-pressed', String(options[i][0] === value));
    },
  }, label));
  return { el: h('div', { class: 'chips', role: 'group' }, buttons), get value() { return value; } };
}

export function whenText(iso) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dayDiff = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86_400_000);
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Yesterday ${time}`;
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return `${d.toLocaleDateString('en-GB', opts)} ${time}`;
}

// Full-screen photo viewer; tap anywhere to close.
export function showPhoto(url) {
  const overlay = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'Photo', onclick: () => overlay.remove() },
    h('img', { src: url, alt: '' }));
  document.body.append(overlay);
}
