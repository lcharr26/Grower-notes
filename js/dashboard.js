// What the dashboard shows, and in what order. The user picks; we remember.
// New sections added in later versions slot in at their default place
// without disturbing choices already made.

import * as db from './db.js';

// [id, label, shown by default]
export const SECTIONS = [
  ['shortcuts', 'Shortcuts', true],
  ['tidy', 'Notes to tidy', true],
  ['questions', 'Open questions', true],
  ['recent', 'Recent notes', false],
  ['backup', 'Backup', true],
  ['garden', 'Garden setup', true],
  ['storage', 'Storage on this phone', false],
];

// [id, label, shown by default]
export const SHORTCUTS = [
  ['note', 'New note', true],
  ['tasks', 'Tasks', true],
  ['notes', 'All notes', true],
  ['export', 'Export backup', true],
  ['beds-home', 'Beds', false],
  ['beds', 'Add or edit beds', false],
  ['site', 'Garden details', false],
];

// Turns saved choices into a full ordered list: [{ id, label, on }].
export function resolve(defaults, saved) {
  const known = new Map(defaults.map(([id, label, on]) => [id, { id, label, on }]));
  const out = [];
  for (const item of Array.isArray(saved) ? saved : []) {
    const base = known.get(item.id);
    if (!base || out.some((o) => o.id === item.id)) continue; // dropped or duplicate
    out.push({ ...base, on: Boolean(item.on) });
  }
  // Anything not in the saved list goes back at its default position.
  defaults.forEach(([id], index) => {
    if (out.some((o) => o.id === id)) return;
    const before = defaults.slice(0, index).map(([d]) => d).reverse().find((d) => out.some((o) => o.id === d));
    const at = before ? out.findIndex((o) => o.id === before) + 1 : 0;
    out.splice(at, 0, { ...known.get(id) });
  });
  return out;
}

export function move(list, id, step) {
  const from = list.findIndex((item) => item.id === id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function toggle(list, id) {
  return list.map((item) => (item.id === id ? { ...item, on: !item.on } : item));
}

const strip = (list) => list.map(({ id, on }) => ({ id, on }));

export async function loadLayout() {
  const { dashboard } = await db.getSettings();
  return {
    sections: resolve(SECTIONS, dashboard?.sections),
    shortcuts: resolve(SHORTCUTS, dashboard?.shortcuts),
  };
}

export async function saveLayout({ sections, shortcuts }) {
  await db.setSetting('dashboard', { sections: strip(sections), shortcuts: strip(shortcuts) });
}
