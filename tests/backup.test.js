import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import { buildExport, parseBackup, restore } from '../js/backup.js';
import { readZip } from '../js/zip.js';
import {
  STORES, isUntagged, makeBed, makeHarvest, makeNote, makePhoto, makePlanting,
  makeQuestion, makeSite, makeVariety,
} from '../js/model.js';

beforeEach(async () => { await db.clearAll(); });

async function seed() {
  const site = makeSite({ name: 'Walled garden', last_frost: '2026-05-10' });
  const bed = makeBed(site.id, { name: 'GH Bed 2', location_type: 'greenhouse' });
  const variety = makeVariety(site.id, { crop: 'Potato', variety: 'Charlotte', supplier: 'Real Seeds' });
  const planting = makePlanting(site.id, { bed_id: bed.id, variety_id: variety.id, method: 'transplant' });
  const note = makeNote(site.id, { text: 'Comfrey feed', type: 'feed', bed_ids: [bed.id] });
  const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 0xff, 0xd9]);
  const photo = makePhoto(site.id, new Blob([photoBytes], { type: 'image/jpeg' }), { note_id: note.id });
  note.photos.push(photo.id);
  const harvest = makeHarvest(site.id, { bed_id: bed.id, planting_id: planting.id, amount: 'a trug full' });
  const question = makeQuestion(site.id, { bed_ids: [bed.id], text: 'Broken-stem tomato: will it recover?' });
  await db.putMany([
    ['sites', site], ['beds', bed], ['varieties', variety], ['plantings', planting],
    ['photos', photo], ['notes', note], ['harvests', harvest], ['questions', question],
  ]);
  await db.setSetting('current_site_id', site.id);
  return { site, bed, note, photo, photoBytes, question };
}

test('every record carries a site_id and capture needs no details', () => {
  const note = makeNote('site-1');
  assert.equal(note.site_id, 'site-1');
  assert.equal(note.type, null);
  assert.ok(isUntagged(note));
  for (const make of [makeBed, makeVariety, makePlanting, makeHarvest, makeQuestion]) {
    assert.equal(make('site-1').site_id, 'site-1');
  }
});

test('there is no "cleared" planting status', () => {
  assert.equal(makePlanting('s', { status: 'cleared' }).status, 'growing');
});

test('indexes find notes and questions by bed', async () => {
  const { bed, note, question } = await seed();
  assert.deepEqual((await db.getByIndex('notes', 'bed_ids', bed.id)).map((n) => n.id), [note.id]);
  assert.deepEqual((await db.getByIndex('questions', 'status', 'open')).map((q) => q.id), [question.id]);
});

test('export holds every record and the photo as a real image file', async () => {
  const { photo, photoBytes } = await seed();
  const { blob, filename, counts } = await buildExport();
  assert.match(filename, /^growers-notebook-\d{4}-\d{2}-\d{2}\.zip$/);
  for (const store of STORES) assert.ok(counts[store] >= 1, `${store} exported`);

  const entries = await readZip(blob);
  assert.ok(entries.has('README.txt'));
  assert.deepEqual(entries.get(`photos/${photo.id}.jpg`), photoBytes);
  const json = JSON.parse(new TextDecoder().decode(entries.get('data.json')));
  assert.equal(json.format, 'growers-notebook');
  assert.equal(json.data.photos[0].blob, undefined, 'image bytes are not inlined in the JSON');
});

test('export then restore gives back identical data, photos included', async () => {
  const { note, photo, photoBytes } = await seed();
  const before = {};
  for (const store of STORES) before[store] = await db.getAll(store);
  const { blob } = await buildExport();

  await db.clearAll();
  assert.equal(await db.count('notes'), 0);

  await restore(await parseBackup(blob));
  for (const store of STORES.filter((s) => s !== 'photos' && s !== 'settings')) {
    assert.deepEqual(await db.getAll(store), before[store], `${store} restored`);
  }
  const restored = await db.get('photos', photo.id);
  assert.equal(restored.note_id, note.id);
  assert.equal(restored.type, 'image/jpeg');
  assert.deepEqual(new Uint8Array(await restored.blob.arrayBuffer()), photoBytes);
  assert.ok((await db.getSettings()).last_export, 'restoring counts as a recent export');
});

test('a bad backup is refused before anything is touched', async () => {
  await seed();
  await assert.rejects(parseBackup(new Blob(['nope'])), /not a zip/);
  assert.equal(await db.count('notes'), 1);
});
