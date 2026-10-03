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
