// What the home screen shows, and in what order. The user picks; we remember.
// New sections added in later versions slot in at their default place
// without disturbing choices already made. (Stored per device for now; with
// accounts in a later version it becomes per person.)

import * as db from './db.js';

// [id, label, shown by default]. Cards with nothing to report stay hidden
// even when switched on, so Home only shows what matters right now.
export const SECTIONS = [
  ['notes', 'Notes', true], // new note, all notes, and notes to tidy
  ['questions', 'Open questions', true],
  ['shortcuts', 'Shortcuts', true],
  ['beds', 'Beds', true],
  ['recent', 'Recent notes', false],
];

// [id, label, shown by default]
export const SHORTCUTS = [
  ['harvest', 'Log a harvest', true],
  ['seeds', 'Seed library', true],
  ['tasks', 'Tasks', true],
  ['export', 'Export backup', true],
  ['harvests', 'Harvest log', false],
  ['beds', 'Add or edit beds', false],
  ['site', 'Garden details', false],
  ['settings', 'Settings', false],
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
  // Choices from the old Dashboard (an earlier build) aren't carried over:
  // that screen no longer exists, and its order doesn't fit Home.
  const { home_layout: saved } = await db.getSettings();
  return {
    sections: resolve(SECTIONS, saved?.sections),
    shortcuts: resolve(SHORTCUTS, saved?.shortcuts),
  };
}

export async function saveLayout({ sections, shortcuts }) {
  await db.setSetting('home_layout', { sections: strip(sections), shortcuts: strip(shortcuts) });
}
