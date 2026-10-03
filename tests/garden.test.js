import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import {
  addBed, addNumberedBeds, bedsForSite, createSite, currentSite, deleteBed, deleteSite,
  loadSample, sampleSite, updateBed,
} from '../js/garden.js';
import { makeNote } from '../js/model.js';
import { SAMPLE_BEDS, SAMPLE_QUESTIONS, SAMPLE_VARIETIES } from '../js/sample.js';

beforeEach(async () => { await db.clearAll(); });

test('creating a site makes it the current one', async () => {
  assert.equal(await currentSite(), null);
  const site = await createSite({ name: 'Allotment', last_frost: '04-20' });
  assert.equal((await currentSite()).id, site.id);
  assert.equal(site.sample, false);
});

test('beds keep their kind and order, greenhouse first', async () => {
  const site = await createSite({ name: 'Plot' });
  await addBed(site.id, { name: 'Fruit cage', location_type: 'informal' });
  await addBed(site.id, { name: 'Bed A', location_type: 'outdoor' });
  await addBed(site.id, { name: 'Border', location_type: 'greenhouse' });
  assert.deepEqual((await bedsForSite(site.id)).map((b) => b.name), ['Border', 'Bed A', 'Fruit cage']);
  await assert.rejects(addBed(site.id, { name: '   ' }), /name/);
});

test('numbered beds carry on from the highest number used', async () => {
  const site = await createSite({ name: 'Plot' });
  await addNumberedBeds(site.id, 'outdoor', 'Bed', 3);
  await addBed(site.id, { name: 'Bed 7', location_type: 'outdoor' });
  const more = await addNumberedBeds(site.id, 'outdoor', 'Bed', 2);
  assert.deepEqual(more.map((b) => b.name), ['Bed 8', 'Bed 9']);
  // A different prefix starts its own count.
  const gh = await addNumberedBeds(site.id, 'greenhouse', 'GH Bed', 2);
  assert.deepEqual(gh.map((b) => b.name), ['GH Bed 1', 'GH Bed 2']);
});

test('a bed with history cannot be deleted, an empty one can', async () => {
  const site = await createSite({ name: 'Plot' });
  const used = await addBed(site.id, { name: 'Bed 1' });
  const empty = await addBed(site.id, { name: 'Bed 2' });
  await db.put('notes', makeNote(site.id, { bed_ids: [used.id], text: 'Nettle feed' }));
  await assert.rejects(deleteBed(used.id), /stays/);
  await deleteBed(empty.id);
  await updateBed(used, { name: 'Bed One' });
  assert.deepEqual((await bedsForSite(site.id)).map((b) => b.name), ['Bed One']);
});

test('sample garden loads as its own site, once', async () => {
  const mine = await createSite({ name: 'Mine' });
  await addBed(mine.id, { name: 'Bed 1' });
  const sample = await loadSample();
  assert.equal(sample.sample, true);
  assert.equal((await currentSite()).id, sample.id);

  const beds = await bedsForSite(sample.id);
  assert.equal(beds.length, SAMPLE_BEDS.reduce((n, [, names]) => n + names.length, 0));
  assert.deepEqual(beds.slice(0, 5).map((b) => b.location_type), Array(5).fill('greenhouse'));
  assert.equal((await db.getByIndex('varieties', 'site_id', sample.id)).length, SAMPLE_VARIETIES.length);

  const questions = await db.getByIndex('questions', 'site_id', sample.id);
  assert.equal(questions.length, SAMPLE_QUESTIONS.length);
  const bed7 = beds.find((b) => b.name === 'Bed 7');
  assert.ok(questions.some((q) => q.bed_ids[0] === bed7.id && q.status === 'open'));

  assert.equal((await loadSample()).id, sample.id, 'loading again reuses it');
  assert.equal((await db.getAll('sites')).length, 2);
});

test('removing the sample garden leaves your own garden alone', async () => {
  const mine = await createSite({ name: 'Mine' });
  await addBed(mine.id, { name: 'Bed 1' });
  await db.put('notes', makeNote(mine.id, { text: 'Sowed radish' }));
  const sample = await loadSample();
  await deleteSite(sample.id);

  assert.equal(await sampleSite(), null);
  assert.equal((await currentSite()).id, mine.id, 'switches back to your garden');
  assert.equal(await db.count('beds'), 1);
  assert.equal(await db.count('notes'), 1);
  assert.equal(await db.count('varieties'), 0);
  assert.equal(await db.count('questions'), 0);
});
