import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import { bedHistory, bedSummaries } from '../js/bedview.js';
import { addBed, createSite } from '../js/garden.js';
import { makeHarvest, makePlanting, makeQuestion, makeVariety } from '../js/model.js';
import { saveNote } from '../js/notes.js';

beforeEach(async () => { await db.clearAll(); });

const later = () => new Promise((r) => setTimeout(r, 5));

async function setup() {
  const site = await createSite({ name: 'Plot' });
  const gh = await addBed(site.id, { name: 'GH Bed 1', location_type: 'greenhouse' });
  const b7 = await addBed(site.id, { name: 'Bed 7' });
  const potato = makeVariety(site.id, { crop: 'Potato', variety: 'Charlotte' });
  const cucumber = makeVariety(site.id, { crop: 'Cucumber' });
  const spuds = makePlanting(site.id, { bed_id: b7.id, variety_id: potato.id, sown: '2026-04-01', planted: '2026-04-20', status: 'harvesting' });
  const old = makePlanting(site.id, { bed_id: b7.id, variety_id: cucumber.id, status: 'finished' });
  const cukes = makePlanting(site.id, { bed_id: gh.id, variety_id: cucumber.id });
  await db.putMany([['varieties', potato], ['varieties', cucumber], ['plantings', spuds], ['plantings', old], ['plantings', cukes]]);
  return { site, gh, b7, spuds, cukes };
}

test('each bed shows crops in the ground, last note and open questions', async () => {
  const { site, gh, b7, cukes } = await setup();
  await saveNote(site.id, { text: 'Older note', bed_ids: [gh.id] });
  await later();
  // Tagged only with the crop, still counts for the crop's bed.
  const latest = await saveNote(site.id, { text: 'Mite on leaves', planting_ids: [cukes.id] });
  await db.put('questions', makeQuestion(site.id, { bed_ids: [gh.id], text: 'Spider mite?' }));
  await db.put('questions', makeQuestion(site.id, { bed_ids: [gh.id], text: 'Done', status: 'resolved' }));

  const s = await bedSummaries(site.id);
  assert.deepEqual(s.get(gh.id).crops.map((c) => c.name), ['Cucumber']);
  assert.equal(s.get(gh.id).lastNote.id, latest.id);
  assert.deepEqual(s.get(gh.id).openQuestions.map((q) => q.text), ['Spider mite?']);
  // Finished plantings aren't "in the ground"; there's no cleared state.
  assert.deepEqual(s.get(b7.id).crops.map((c) => [c.name, c.status]), [['Potato Charlotte', 'harvesting']]);
  assert.equal(s.get(b7.id).lastNote, null);
});

test('a bed history has everything that happened there, newest first', async () => {
  const { site, gh, b7, spuds } = await setup();
  await db.put('harvests', makeHarvest(site.id, { date: '2026-07-10', bed_id: b7.id, planting_id: spuds.id, amount: 'a trug' }));
  await db.put('questions', makeQuestion(site.id, {
    bed_ids: [b7.id], text: 'Three sisters next?', created: '2026-08-01T09:00:00.000Z',
    status: 'resolved', resolved: '2026-08-20T09:00:00.000Z', resolution_note: 'Christmas potatoes',
  }));
  const note = await saveNote(site.id, { text: 'Lifted the last row', bed_ids: [b7.id] });
  await saveNote(site.id, { text: 'Elsewhere', bed_ids: [gh.id] });

  const { crops, openQuestions, events } = await bedHistory(site.id, b7.id);
  assert.deepEqual(crops.map((c) => c.name), ['Potato Charlotte']);
  assert.equal(openQuestions.length, 0);
  assert.deepEqual(events.map((e) => e.kind), ['note', 'resolved', 'asked', 'harvest', 'planted', 'sown']);
  assert.equal(events[0].note.id, note.id);
  assert.equal(events.find((e) => e.kind === 'harvest').crop, 'Potato Charlotte');
});
