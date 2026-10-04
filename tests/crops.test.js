import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import {
  GAP_QUESTION, addGapQuestion, addVariety, deletePlanting, deleteVariety, harvestsForSite, logHarvest,
  savePlanting, setPlantingStatus, suppliersForSite, updateVariety, varietiesForSite,
} from '../js/crops.js';
import { addBed, createSite } from '../js/garden.js';
import { saveNote } from '../js/notes.js';

beforeEach(async () => { await db.clearAll(); });

async function setup() {
  const site = await createSite({ name: 'Plot' });
  const bed = await addBed(site.id, { name: 'Bed 7' });
  const potato = await addVariety(site.id, { crop: ' Potato ', variety: 'Charlotte', supplier: "Mr Fothergill's" });
  return { site, bed, potato };
}

test('seed library: add, sort, edit; a crop name is the only thing needed', async () => {
  const { site, potato } = await setup();
  assert.equal(potato.crop, 'Potato');
  await addVariety(site.id, { crop: 'Lettuce', variety: 'Salad Bowl', supplier: 'Real Seeds', stock: '' });
  await assert.rejects(addVariety(site.id, { variety: 'Mystery' }), /crop/);
  assert.deepEqual((await varietiesForSite(site.id)).map((v) => v.crop), ['Lettuce', 'Potato']);
  await updateVariety(potato, { supplier: 'Real Seeds', stock: '2 kg' });
  const saved = await db.get('varieties', potato.id);
  assert.equal(saved.supplier, 'Real Seeds');
  assert.equal(saved.stock, '2 kg');
  assert.deepEqual(await suppliersForSite(site.id), ['Real Seeds']);
});

test('a variety that has been planted cannot be deleted', async () => {
  const { site, bed, potato } = await setup();
  const spare = await addVariety(site.id, { crop: 'Radish' });
  await savePlanting(site.id, { bed_id: bed.id, variety_id: potato.id });
  await assert.rejects(deleteVariety(potato.id), /planted/);
  await deleteVariety(spare.id);
  assert.equal((await varietiesForSite(site.id)).length, 1);
});

test('logging a harvest moves a growing crop to harvesting, or finished if it was the last', async () => {
  const { site, bed, potato } = await setup();
  const p = await savePlanting(site.id, { bed_id: bed.id, variety_id: potato.id, planted: '2026-07-01', method: 'transplant' });
  assert.equal(p.status, 'growing');

  const h1 = await logHarvest(site.id, { planting_id: p.id, amount: ' a trug ', date: '2026-09-01' });
  assert.equal(h1.bed_id, bed.id, 'bed filled in from the crop');
  assert.equal(h1.amount, 'a trug');
  assert.equal((await db.get('plantings', p.id)).status, 'harvesting');

  await logHarvest(site.id, { bed_id: bed.id, planting_id: p.id, amount: 'the rest', date: '2026-09-20', lastOfIt: true });
  assert.equal((await db.get('plantings', p.id)).status, 'finished');
  assert.deepEqual((await harvestsForSite(site.id)).map((h) => h.amount), ['the rest', 'a trug']);
});

test('a harvest with no crop picked still saves', async () => {
  const { site, bed } = await setup();
  const h = await logHarvest(site.id, { bed_id: bed.id, amount: 'a handful of herbs' });
  assert.ok(h.date);
  assert.equal(h.planting_id, null);
});

test('"decide later" on the gap prompt leaves one open question on the bed', async () => {
  const { site, bed } = await setup();
  const q1 = await addGapQuestion(site.id, bed.id);
  const q2 = await addGapQuestion(site.id, bed.id);
  assert.equal(q1.id, q2.id);
  assert.equal(q1.text, GAP_QUESTION);
  assert.equal(q1.status, 'open');
  assert.deepEqual(q1.bed_ids, [bed.id]);
});

test('a crop with history is kept; status changes instead', async () => {
  const { site, bed, potato } = await setup();
  const p = await savePlanting(site.id, { bed_id: bed.id, variety_id: potato.id });
  await saveNote(site.id, { text: 'Blight?', planting_ids: [p.id] });
  await assert.rejects(deletePlanting(p), /finished/);
  await setPlantingStatus(p, 'finished');
  assert.equal((await db.get('plantings', p.id)).status, 'finished');
  const empty = await savePlanting(site.id, { bed_id: bed.id, variety_id: potato.id });
  await deletePlanting(empty);
  assert.equal(await db.get('plantings', empty.id), undefined);
});
