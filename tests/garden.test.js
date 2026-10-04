import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import {
  addBed, addNumberedBeds, bedsForSite, createSite, currentSite, deleteBed, deleteSite,
  loadPreset, presetSite, updateBed, upgradeSampleSites,
} from '../js/garden.js';
import { makeNote } from '../js/model.js';
import { PRESETS } from '../js/presets.js';

const DERBY = PRESETS.derby;

beforeEach(async () => { await db.clearAll(); });

test('creating a site makes it the current one', async () => {
  assert.equal(await currentSite(), null);
  const site = await createSite({ name: 'Allotment', last_frost: '04-20' });
  assert.equal((await currentSite()).id, site.id);
  assert.equal(site.preset, null);
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

test('the Derby garden loads as a real garden, once', async () => {
  const site = await loadPreset('derby');
  assert.equal(site.name, 'Derby walled kitchen garden');
  assert.equal(site.preset, 'derby');
  assert.equal('sample' in site, false);
  assert.equal((await currentSite()).id, site.id);

  const beds = await bedsForSite(site.id);
  assert.equal(beds.length, DERBY.beds.reduce((n, [, names]) => n + names.length, 0));
  assert.deepEqual(beds.slice(0, 5).map((b) => b.location_type), Array(5).fill('greenhouse'));
  assert.equal((await db.getByIndex('varieties', 'site_id', site.id)).length, DERBY.varieties.length);

  const questions = await db.getByIndex('questions', 'site_id', site.id);
  assert.equal(questions.length, DERBY.questions.length);
  const bed7 = beds.find((b) => b.name === 'Bed 7');
  assert.ok(questions.some((q) => q.bed_ids[0] === bed7.id && q.status === 'open'));

  assert.equal((await loadPreset('derby')).id, site.id, 'loading again reuses it');
  assert.equal((await db.getAll('sites')).length, 1);
});

test('a garden loaded as the old "sample" becomes a real garden, keeping its notes', async () => {
  const site = await loadPreset('derby');
  const { preset, ...rest } = site;
  await db.put('sites', { ...rest, sample: true }); // how earlier builds stored it
  await db.put('notes', makeNote(site.id, { text: 'Comfrey tea on GH Bed 1' }));

  await upgradeSampleSites();
  const upgraded = await db.get('sites', site.id);
  assert.equal('sample' in upgraded, false);
  assert.equal(upgraded.preset, 'derby');
  assert.equal(await db.count('notes'), 1);
  assert.equal((await presetSite('derby')).id, site.id);
});

test('deleting a garden leaves other gardens alone', async () => {
  const mine = await createSite({ name: 'Mine' });
  await addBed(mine.id, { name: 'Bed 1' });
  await db.put('notes', makeNote(mine.id, { text: 'Sowed radish' }));
  const derby = await loadPreset('derby');
  await deleteSite(derby.id);

  assert.equal(await presetSite('derby'), null);
  assert.equal((await currentSite()).id, mine.id, 'switches back to the other garden');
  assert.equal(await db.count('beds'), 1);
  assert.equal(await db.count('notes'), 1);
  assert.equal(await db.count('varieties'), 0);
  assert.equal(await db.count('questions'), 0);
});
