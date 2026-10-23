import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import { addVariety, savePlanting } from '../js/crops.js';
import { addBed, createSite } from '../js/garden.js';
import { saveNote } from '../js/notes.js';
import {
  addQuestion, deleteQuestion, openQuestionsForNote, questionsForSite, reopenQuestion, resolveQuestion, updateQuestion,
} from '../js/questions.js';

beforeEach(async () => { await db.clearAll(); });

async function setup() {
  const site = await createSite({ name: 'Plot' });
  const gh1 = await addBed(site.id, { name: 'GH Bed 1', location_type: 'greenhouse' });
  const gh2 = await addBed(site.id, { name: 'GH Bed 2', location_type: 'greenhouse' });
  const cucumber = await addVariety(site.id, { crop: 'Cucumber' });
  const cukes = await savePlanting(site.id, { bed_id: gh1.id, variety_id: cucumber.id });
  return { site, gh1, gh2, cukes };
}

test('add, edit, resolve with a one-line answer, reopen, delete', async () => {
  const { site, gh1 } = await setup();
  await assert.rejects(addQuestion(site.id, { text: '  ' }), /question/);
  const q = await addQuestion(site.id, { text: ' Spider mite? ', bed_ids: [gh1.id] });
  assert.equal(q.text, 'Spider mite?');
  assert.equal(q.status, 'open');

  await updateQuestion(q, { text: 'Watch for spider mite' });
  const note = await saveNote(site.id, { text: 'Leaves clean', bed_ids: [gh1.id] });
  const done = await resolveQuestion(await db.get('questions', q.id), { note: 'No sign of it\nsecond line dropped', byNoteId: note.id });
  assert.equal(done.status, 'resolved');
  assert.ok(done.resolved);
  assert.equal(done.resolution_note, 'No sign of it');
  assert.equal(done.resolved_by_note_id, note.id);
  assert.equal(done.text, 'Watch for spider mite');

  const again = await reopenQuestion(done);
  assert.equal(again.status, 'open');
  assert.equal(again.resolved, null);
  assert.equal(again.resolved_by_note_id, null);

  await deleteQuestion(q.id);
  assert.equal((await questionsForSite(site.id)).length, 0);
});

test('a photo note finds the open questions on its bed and crops', async () => {
  const { site, gh1, gh2, cukes } = await setup();
  const onBed = await addQuestion(site.id, { text: 'Spider mite?', bed_ids: [gh1.id] });
  const onCrop = await addQuestion(site.id, { text: 'Cucumbers bitter?', planting_ids: [cukes.id] });
  const elsewhere = await addQuestion(site.id, { text: 'Broken stem', bed_ids: [gh2.id] });
  const answered = await addQuestion(site.id, { text: 'Old one', bed_ids: [gh1.id] });
  await resolveQuestion(answered);

  const byBed = await saveNote(site.id, { bed_ids: [gh1.id] });
  assert.deepEqual((await openQuestionsForNote(byBed)).map((q) => q.id), [onBed.id, onCrop.id]);

  // Tagged only with the crop: its bed's questions count too.
  const byCrop = await saveNote(site.id, { planting_ids: [cukes.id] });
  assert.deepEqual((await openQuestionsForNote(byCrop)).map((q) => q.id), [onBed.id, onCrop.id]);

  const other = await saveNote(site.id, { bed_ids: [gh2.id] });
  assert.deepEqual((await openQuestionsForNote(other)).map((q) => q.id), [elsewhere.id]);

  assert.deepEqual(await openQuestionsForNote(await saveNote(site.id, { text: 'untagged' })), []);
});
