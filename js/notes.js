// Notes: save first, tag later. A note with no bed or crop tags is in the inbox.

import * as db from './db.js';
import { isUntagged, makeNote, makePhoto } from './model.js';

// Capture never needs anything specific, but a note with nothing at all in it
// isn't worth keeping.
export function hasContent({ text, files, photos, bed_ids, planting_ids, type }) {
  return Boolean((text && text.trim()) || files?.length || photos?.length
    || bed_ids?.length || planting_ids?.length || type);
}

// Saves the note and its photos in one go. `files` are Blobs (already shrunk).
export async function saveNote(siteId, { text = '', files = [], bed_ids = [], planting_ids = [], type = null } = {}) {
  const note = makeNote(siteId, { text: text.trim(), bed_ids, planting_ids, type });
  const writes = [];
  for (const file of files) {
    const photo = makePhoto(siteId, file, { note_id: note.id });
    note.photos.push(photo.id);
    writes.push(['photos', photo]);
  }
  writes.push(['notes', note]);
  await db.putMany(writes);
  return note;
}

export async function updateNote(note, fields) {
  const next = { ...note, ...fields };
  if (fields.text != null) next.text = fields.text.trim();
  await db.put('notes', next);
  return next;
}

export async function deleteNote(note) {
  for (const id of note.photos) await db.remove('photos', id);
  await db.remove('notes', note.id);
}

export async function notesForSite(siteId) {
  const notes = await db.getByIndex('notes', 'site_id', siteId);
  return notes.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function inboxNotes(siteId) {
  return (await notesForSite(siteId)).filter(isUntagged);
}

export async function photoBlob(photoId) {
  const photo = await db.get('photos', photoId);
  return photo?.blob || null;
}
