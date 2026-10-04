// Add a crop to a bed, or edit one. Pick a variety (or add a new one on the
// spot), dates if you know them, method and status.

import * as db from '../db.js';
import { addVariety, deletePlanting, savePlanting, setPlantingStatus, varietiesForSite } from '../crops.js';
import { bedsForSite, currentSite } from '../garden.js';
import { PLANTING_METHODS, PLANTING_STATUSES } from '../model.js';
import { varietyName } from '../tags.js';
import { busy, chips, dateField, go, h, optionalChip, toast } from '../ui.js';

export const METHOD_LABELS = { direct: 'Direct sown', transplant: 'Transplanted', drilled: 'Drilled' };
export const STATUS_LABELS = { growing: 'Growing', harvesting: 'Harvesting', finished: 'Finished' };

export async function render(root, { id, bed: bedParam }) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const existing = id ? await db.get('plantings', id) : null;
  if (id && !existing) return go('#/');
  const [beds, varieties] = await Promise.all([bedsForSite(site.id), varietiesForSite(site.id)]);
  const startBed = existing?.bed_id || bedParam || null;
  const bedName = (bid) => beds.find((b) => b.id === bid)?.name;
  const backTo = () => {
    const bid = bed.value || startBed;
    return bid ? `#/bed?id=${encodeURIComponent(bid)}` : '#/';
  };

  const bed = optionalChip(beds.map((b) => [b.id, b.name]), startBed);
  const variety = optionalChip(varieties.map((v) => [v.id, varietyName(v)]), existing?.variety_id || null);

  // Adding a variety without leaving the form.
  const newCrop = h('input', { type: 'text', placeholder: 'Crop, e.g. Beetroot', 'aria-label': 'Crop', autocomplete: 'off' });
  const newVariety = h('input', { type: 'text', placeholder: 'Variety (optional), e.g. Boltardy', 'aria-label': 'Variety', autocomplete: 'off' });
  const newSupplier = h('input', { type: 'text', placeholder: 'Supplier (optional)', 'aria-label': 'Supplier', autocomplete: 'off' });
  const newPanel = h('div', { class: 'new-variety', hidden: true }, newCrop, newVariety, newSupplier);
  const newToggle = h('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': 'false',
    onclick: () => {
      newPanel.hidden = !newPanel.hidden;
      newToggle.setAttribute('aria-pressed', String(!newPanel.hidden));
      if (!newPanel.hidden) newCrop.focus();
    },
  }, '+ New variety');

  const sown = dateField('p-sown', 'Sown', existing?.sown);
  const planted = dateField('p-planted', 'Planted out', existing?.planted);
  const method = optionalChip(PLANTING_METHODS.map((m) => [m, METHOD_LABELS[m]]), existing?.method || null);
  const status = chips(PLANTING_STATUSES.map((s) => [s, STATUS_LABELS[s]]), existing?.status || 'growing');
  const notes = h('textarea', { placeholder: 'Notes (optional): spacing, where the seed came from, anything', value: existing?.notes });

  const save = h('button', {
    class: 'primary',
    onclick: () => busy(save, 'Saving…', async () => {
      let varietyId = variety.value;
      if (!newPanel.hidden && newCrop.value.trim()) {
        const v = await addVariety(site.id, { crop: newCrop.value, variety: newVariety.value, supplier: newSupplier.value });
        varietyId = v.id;
      }
      if (!varietyId) { toast('Pick a variety, or add a new one.'); return; }
      const planting = await savePlanting(site.id, {
        bed_id: bed.value,
        variety_id: varietyId,
        sown: sown.value || null,
        planted: planted.value || null,
        method: method.value,
        status: status.value,
        notes: notes.value,
      }, existing);
      const name = varietyName(await db.get('varieties', planting.variety_id));
      toast(existing ? 'Saved.' : `Added ${name}${planting.bed_id ? ` to ${bedName(planting.bed_id)}` : ''}.`);
      go(backTo());
    }),
  }, existing ? 'Save' : 'Add crop');

  const del = existing ? h('button', {
    class: 'danger',
    onclick: () => busy(del, 'Checking…', async () => {
      if (!confirm('Remove this crop? Only do this if it was added by mistake.')) return;
      await deletePlanting(existing);
      toast('Removed.');
      go(backTo());
    }),
  }, 'Remove (added by mistake)') : null;

  // Quick status buttons when editing, for the common "it's cropping now" / "it's done".
  const quick = existing && existing.status !== 'finished' ? h('div', { class: 'two' },
    existing.status === 'growing' ? h('button', {
      onclick: async () => { await setPlantingStatus(existing, 'harvesting'); toast('Marked as harvesting.'); go(backTo()); },
    }, 'Mark as harvesting') : h('a', { class: 'button', href: `#/harvest?planting=${encodeURIComponent(existing.id)}` }, 'Log a harvest'),
    h('button', {
      onclick: async () => {
        await setPlantingStatus(existing, 'finished');
        toast('Marked as finished.');
        go(`#/gap?bed=${encodeURIComponent(existing.bed_id || '')}`);
      },
    }, 'Mark as finished'),
  ) : null;

  const title = existing
    ? `${varietyName(varieties.find((v) => v.id === existing.variety_id))}${startBed ? ` in ${bedName(startBed)}` : ''}`
    : `Add a crop${startBed ? ` to ${bedName(startBed)}` : ''}`;

  root.replaceChildren(...[
    h('a', { class: 'back', href: backTo() }, '‹ Back'),
    h('h2', { class: 'site-title' }, title),
    quick,
    h('section', { class: 'card' },
      h('h3', {}, 'Variety'),
      varieties.length ? variety.el : h('p', { class: 'muted small' }, 'No varieties yet. Add one below.'),
      h('div', { class: 'chips' }, newToggle),
      newPanel,
      h('h3', {}, 'Bed'),
      bed.el,
    ),
    h('section', { class: 'card' },
      sown.el,
      planted.el,
      h('h3', {}, 'Method'),
      method.el,
      h('h3', {}, 'Status'),
      status.el,
      notes,
    ),
    save,
    del,
  ].filter(Boolean));
}
