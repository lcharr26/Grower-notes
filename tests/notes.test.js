import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';
import { addBed, createSite } from '../js/garden.js';
import { deleteNote, hasContent, inboxNotes, notesForSite, photoBlob, saveNote, updateNote } from '../js/notes.js';

beforeEach(async () => { await db.clearAll(); });

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9])], { type: 'image/jpeg' });

test('nothing is required, but an empty note is not saved', () => {
  assert.equal(hasContent({}), false);
  assert.equal(hasContent({ text: '   ' }), false);
  assert.ok(hasContent({ text: 'Slugs on the lettuce' }));
  assert.ok(hasContent({ files: [jpeg()] }));
  assert.ok(hasContent({ type: 'feed' }));
  assert.ok(hasContent({ bed_ids: ['b'] }));
});

test('a note with just a photo saves straight to the inbox', async () => {
  const site = await createSite({ name: 'Plot' });
  const note = await saveNote(site.id, { files: [jpeg()] });
  assert.equal(note.photos.length, 1);
  assert.equal(note.site_id, site.id);
  assert.deepEqual((await inboxNotes(site.id)).map((n) => n.id), [note.id]);
  const blob = await photoBlob(note.photos[0]);
  assert.equal(blob.size, 6);
  assert.equal((await db.get('photos', note.photos[0])).note_id, note.id);
});

test('tagging a note with a bed takes it out of the inbox', async () => {
  const site = await createSite({ name: 'Plot' });
  const bed = await addBed(site.id, { name: 'GH Bed 1' });
  const note = await saveNote(site.id, { text: '  Spider mite?  ' });
  assert.equal(note.text, 'Spider mite?');
  await updateNote(note, { bed_ids: [bed.id], type: 'pest' });
  assert.equal((await inboxNotes(site.id)).length, 0);
  const [saved] = await db.getByIndex('notes', 'bed_ids', bed.id);
  assert.equal(saved.type, 'pest');
});

test('notes come back newest first, per garden', async () => {
  const a = await createSite({ name: 'A' });
  const b = await createSite({ name: 'B' });
  const first = await saveNote(a.id, { text: 'first' });
  await new Promise((r) => setTimeout(r, 5));
  const second = await saveNote(a.id, { text: 'second' });
  await saveNote(b.id, { text: 'elsewhere' });
  assert.deepEqual((await notesForSite(a.id)).map((n) => n.id), [second.id, first.id]);
});

test('deleting a note removes its photos too', async () => {
  const site = await createSite({ name: 'Plot' });
  const note = await saveNote(site.id, { text: 'x', files: [jpeg(), jpeg()] });
  assert.equal(await db.count('photos'), 2);
  await deleteNote(note);
  assert.equal(await db.count('photos'), 0);
  assert.equal(await db.count('notes'), 0);
});
