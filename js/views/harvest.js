// Log a harvest: when, which bed and crop, a rough amount, notes. Then on to
// "What's going in the gap?".

import * as db from '../db.js';
import { logHarvest } from '../crops.js';
import { bedsForSite, currentSite } from '../garden.js';
import { tagContext } from '../tags.js';
import { busy, dateField, go, h, optionalChip, todayIso, toast } from '../ui.js';

const AMOUNTS = ['a handful', 'a bowlful', 'a trug', 'a big trug', 'a barrow'];

export async function render(root, { bed: bedParam, planting: plantingParam }) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const [beds, plantings, tags] = await Promise.all([
    bedsForSite(site.id), db.getByIndex('plantings', 'site_id', site.id), tagContext(site.id),
  ]);
  const fromPlanting = plantingParam ? plantings.find((p) => p.id === plantingParam) : null;
  const startBed = fromPlanting?.bed_id || bedParam || null;
  const inGround = plantings.filter((p) => p.status !== 'finished');

  const date = dateField('h-date', 'Date', todayIso());
  const amount = h('input', { type: 'text', placeholder: 'Roughly how much? e.g. 2 kg, a trug', 'aria-label': 'Amount', autocomplete: 'off' });
  const amountChips = h('div', { class: 'chips' }, AMOUNTS.map((a) => h('button', {
    type: 'button', class: 'chip', onclick: () => { amount.value = a; },
  }, a)));
  const notes = h('textarea', { placeholder: 'Notes (optional): quality, pests, anything' });
  const lastOfIt = h('input', { type: 'checkbox', id: 'h-last' });
  const lastRow = h('label', { class: 'switch', for: 'h-last' }, lastOfIt, h('span', {}, 'That was the last of it (crop finished)'));

  // Crop choices follow the bed choice.
  const cropBox = h('div', {});
  let crop = { value: fromPlanting?.id || null };
  function drawCrops(bedId) {
    const list = inGround.filter((p) => !bedId || p.bed_id === bedId);
    if (fromPlanting && !list.includes(fromPlanting)) list.unshift(fromPlanting);
    const keep = list.some((p) => p.id === crop.value) ? crop.value : (list.length === 1 ? list[0].id : null);
    crop = optionalChip(list.map((p) => [p.id, tags.plantingLabel(p.id)]), keep);
    cropBox.replaceChildren(list.length
      ? crop.el
      : h('p', { class: 'muted small' }, bedId ? 'No crops logged in this bed. You can still save the harvest.' : 'Pick a bed first, or just save.'));
    lastRow.hidden = !list.length;
  }
  const bed = optionalChip(beds.map((b) => [b.id, b.name]), startBed, drawCrops);
  drawCrops(startBed);

  const save = h('button', {
    class: 'primary',
    onclick: () => busy(save, 'Saving…', async () => {
      const harvest = await logHarvest(site.id, {
        date: date.value || todayIso(),
        bed_id: bed.value,
        planting_id: crop.value,
        amount: amount.value,
        notes: notes.value,
        lastOfIt: lastOfIt.checked && Boolean(crop.value),
      });
      toast('Harvest logged.');
      go(harvest.bed_id ? `#/gap?bed=${encodeURIComponent(harvest.bed_id)}` : '#/harvests');
    }),
  }, 'Save harvest');

  root.replaceChildren(
    h('a', { class: 'back', href: startBed ? `#/bed?id=${encodeURIComponent(startBed)}` : '#/' }, '‹ Back'),
    h('h2', { class: 'site-title' }, 'Log a harvest'),
    h('section', { class: 'card' },
      h('h3', {}, 'Bed'), bed.el,
      h('h3', {}, 'Crop'), cropBox,
      lastRow,
    ),
    h('section', { class: 'card' },
      h('label', { class: 'field', for: 'h-amount' }, 'Amount'),
      amount, amountChips,
      date.el,
      notes,
    ),
    save,
  );
  amount.id = 'h-amount';
}
