import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import { SECTIONS, SHORTCUTS, loadLayout, move, resolve, saveLayout, toggle } from '../js/homelayout.js';

beforeEach(async () => { await db.clearAll(); });

const ids = (list) => list.map((i) => i.id);
const DEFAULTS = [['a', 'A', true], ['b', 'B', false], ['c', 'C', true]];

test('with nothing saved, the defaults are used', async () => {
  const { sections, shortcuts } = await loadLayout();
  assert.deepEqual(ids(sections), SECTIONS.map(([id]) => id));
  assert.deepEqual(sections.map((s) => s.on), SECTIONS.map(([, , on]) => on));
  assert.deepEqual(ids(shortcuts), SHORTCUTS.map(([id]) => id));
});

test('order and on/off choices are remembered', async () => {
  let { sections, shortcuts } = await loadLayout();
  sections = move(sections, 'beds', -1);
  sections = toggle(sections, 'recent');
  shortcuts = toggle(shortcuts, 'export');
  await saveLayout({ sections, shortcuts });

  const again = await loadLayout();
  assert.deepEqual(ids(again.sections), ids(sections));
  assert.equal(again.sections.find((s) => s.id === 'recent').on, true);
  assert.equal(again.shortcuts.find((s) => s.id === 'export').on, false);
});

test('a section added in a later version slots in at its default place', () => {
  // Saved before 'b' existed, with the order reversed.
  const out = resolve(DEFAULTS, [{ id: 'c', on: false }, { id: 'a', on: true }]);
  // 'b' goes straight after 'a', which comes before it in the defaults.
  assert.deepEqual(ids(out), ['c', 'a', 'b']);
  assert.deepEqual(out.map((i) => i.on), [false, true, false]);
  // With nothing before it saved, it goes first.
  assert.deepEqual(ids(resolve(DEFAULTS, [{ id: 'c', on: true }])), ['a', 'b', 'c']);
});

test('choices saved by the earlier dashboard carry over where they still apply', async () => {
  await db.setSetting('dashboard', {
    sections: [{ id: 'backup', on: true }, { id: 'recent', on: true }, { id: 'tidy', on: false }],
    shortcuts: [{ id: 'export', on: false }, { id: 'beds-home', on: true }],
  });
  const { sections, shortcuts } = await loadLayout();
  assert.equal(sections.some((s) => s.id === 'backup'), false, 'moved to Settings');
  assert.equal(sections.find((s) => s.id === 'recent').on, true);
  assert.equal(sections.find((s) => s.id === 'tidy').on, false);
  assert.equal(sections.find((s) => s.id === 'beds').on, true, 'new section on by default');
  assert.equal(shortcuts.find((s) => s.id === 'export').on, false);
  assert.equal(shortcuts.some((s) => s.id === 'beds-home'), false);
});

test('unknown or repeated saved entries are ignored', () => {
  const out = resolve(DEFAULTS, [{ id: 'zz', on: true }, { id: 'a', on: false }, { id: 'a', on: true }]);
  assert.deepEqual(ids(out), ['a', 'b', 'c']);
  assert.equal(out[0].on, false);
});

test('moving past either end does nothing', () => {
  const list = resolve(DEFAULTS, null);
  assert.deepEqual(ids(move(list, 'a', -1)), ['a', 'b', 'c']);
  assert.deepEqual(ids(move(list, 'c', 1)), ['a', 'b', 'c']);
  assert.deepEqual(ids(move(list, 'a', 1)), ['b', 'a', 'c']);
});
