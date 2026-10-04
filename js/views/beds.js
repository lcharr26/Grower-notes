// Beds: the list first, with adding tucked behind a button. Used during
// first setup and later from Dashboard > Garden setup.

import {
  LOCATION_LABELS, NUMBERED_PREFIX, addBed, addNumberedBeds, bedsForSite, currentSite,
  deleteBed, groupBeds, updateBed,
} from '../garden.js';
import { LOCATION_TYPES } from '../model.js';
import { busy, chips, go, h, toast } from '../ui.js';

const TYPE_OPTIONS = LOCATION_TYPES.map((t) => [t, LOCATION_LABELS[t]]);

export async function render(root, { setup }) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const list = h('div', { class: 'bed-list' });
  let openEditor = null;

  const prefix = h('input', { type: 'text', class: 'prefix', value: NUMBERED_PREFIX.outdoor, 'aria-label': 'Name to number' });
  const type = chips(TYPE_OPTIONS, 'outdoor', (t) => { prefix.value = NUMBERED_PREFIX[t]; });

  const name = h('input', {
    type: 'text', placeholder: 'Bed name, e.g. Fruit cage', autocomplete: 'off', 'aria-label': 'Bed name',
    onkeydown: (e) => { if (e.key === 'Enter') addOne.click(); },
  });
  const addOne = h('button', {
    class: 'primary',
    onclick: () => busy(addOne, 'Adding…', async () => {
      const bed = await addBed(site.id, { name: name.value, location_type: type.value });
      name.value = '';
      toast(`Added ${bed.name}.`);
      await refresh();
    }),
  }, 'Add bed');

  const howMany = h('input', { type: 'number', min: 1, max: 50, value: 4, inputmode: 'numeric', class: 'count', 'aria-label': 'How many' });
  const addMany = h('button', {
    onclick: () => busy(addMany, 'Adding…', async () => {
      const n = Math.min(50, Math.max(1, parseInt(howMany.value, 10) || 0));
      const p = prefix.value.trim() || NUMBERED_PREFIX[type.value];
      const beds = await addNumberedBeds(site.id, type.value, p, n);
      toast(`Added ${beds[0].name}${beds.length > 1 ? ` to ${beds.at(-1).name}` : ''}.`);
      await refresh();
    }),
  }, 'Add numbered beds');

  function editor(bed) {
    const rename = h('input', { type: 'text', value: bed.name, 'aria-label': 'Bed name' });
    const kind = chips(TYPE_OPTIONS, bed.location_type);
    const notes = h('textarea', { placeholder: 'Notes about this bed (soil, aspect, anything)', value: bed.notes });
    const save = h('button', {
      class: 'primary',
      onclick: () => busy(save, 'Saving…', async () => {
        await updateBed(bed, { name: rename.value, location_type: kind.value, notes: notes.value.trim() });
        openEditor = null;
        toast('Saved.');
        await refresh();
      }),
    }, 'Save');
    const del = h('button', {
      class: 'danger',
      onclick: () => busy(del, 'Checking…', async () => {
        if (!confirm(`Delete ${bed.name}?`)) return;
        await deleteBed(bed.id);
        openEditor = null;
        toast(`${bed.name} deleted.`);
        await refresh();
      }),
    }, 'Delete bed');
    return h('div', { class: 'editor' }, rename, kind.el, notes, save, del);
  }

  async function refresh() {
    const beds = await bedsForSite(site.id);
    if (!beds.length) {
      list.replaceChildren(h('p', { class: 'muted' }, 'No beds yet. Tap “Add beds” above, or skip this and add them later.'));
      return;
    }
    list.replaceChildren(...groupBeds(beds).map(([t, group]) => h('div', { class: 'bed-group' },
      h('h3', {}, `${LOCATION_LABELS[t]} (${group.length})`),
      group.map((bed) => h('div', { class: 'bed-row' },
        h('button', {
          class: 'row-button',
          'aria-expanded': String(openEditor === bed.id),
          onclick: () => { openEditor = openEditor === bed.id ? null : bed.id; refresh(); },
        }, h('span', {}, bed.name), h('span', { class: 'muted small' }, openEditor === bed.id ? 'Close' : 'Edit')),
        openEditor === bed.id ? editor(bed) : null,
      )),
    )));
  }

  const addPanel = h('div', { class: 'add-panel', hidden: true },
    h('h3', {}, 'Kind of bed'),
    type.el,
    name,
    addOne,
    h('div', { class: 'numbered' },
      h('span', { class: 'muted small' }, 'Or add several at once:'),
      h('div', { class: 'numbered-row' }, howMany, prefix),
      addMany,
    ),
  );
  const addToggle = h('button', {
    'aria-expanded': 'false',
    onclick: () => {
      addPanel.hidden = !addPanel.hidden;
      addToggle.setAttribute('aria-expanded', String(!addPanel.hidden));
      addToggle.textContent = addPanel.hidden ? 'Add beds' : 'Finished adding';
      if (!addPanel.hidden) name.focus();
    },
  }, 'Add beds');

  root.replaceChildren(
    h('h2', { class: 'site-title' }, setup ? 'Your beds' : 'Beds'),
    h('p', { class: 'muted small' }, setup
      ? 'Anywhere you grow: beds, greenhouse borders, the strawberry patch. Add them now, or skip and add them later.'
      : `Beds in ${site.name}. Tap one to rename it, change its kind or add notes.`),
    h('section', { class: 'card' }, addToggle, addPanel),
    h('section', { class: 'card' }, list),
    h('button', { class: setup ? 'primary' : '', onclick: () => go(setup ? '#/' : '#/dashboard') },
      setup ? 'Done, take me to the garden' : 'Back to dashboard'),
  );
  await refresh();
}
