// Question queue: open items on beds or crops that come back up until
// they're answered.

import * as db from './db.js';
import { makeQuestion, nowIso } from './model.js';

export async function questionsForSite(siteId) {
  const list = await db.getByIndex('questions', 'site_id', siteId);
  return list.sort((a, b) => b.created.localeCompare(a.created));
}

export async function addQuestion(siteId, { text, bed_ids = [], planting_ids = [] }) {
  const clean = (text || '').trim();
  if (!clean) throw new Error('Type the question first.');
  const question = makeQuestion(siteId, { text: clean, bed_ids, planting_ids });
  await db.put('questions', question);
  return question;
}

export async function updateQuestion(question, fields) {
  const next = { ...question, ...fields };
  next.text = (next.text || '').trim();
  if (!next.text) throw new Error('A question needs some words.');
  await db.put('questions', next);
  return next;
}

// note: optional one-line answer. byNoteId: the note (or photo) that settled it.
export async function resolveQuestion(question, { note = '', byNoteId = null } = {}) {
  const next = {
    ...question,
    status: 'resolved',
    resolved: nowIso(),
    resolution_note: (note || '').trim().split('\n')[0],
    resolved_by_note_id: byNoteId,
  };
  await db.put('questions', next);
  return next;
}

export async function reopenQuestion(question) {
  const next = { ...question, status: 'open', resolved: null, resolution_note: '', resolved_by_note_id: null };
  await db.put('questions', next);
  return next;
}

export async function deleteQuestion(questionId) {
  await db.remove('questions', questionId);
}

// Open questions that a note could speak to: on any of its beds, on any of
// its crops, or on a crop growing in one of its beds.
export async function openQuestionsForNote(note) {
  if (!note.bed_ids.length && !note.planting_ids.length) return [];
  const [questions, plantings] = await Promise.all([
    db.getByIndex('questions', 'site_id', note.site_id),
    db.getByIndex('plantings', 'site_id', note.site_id),
  ]);
  const beds = new Set(note.bed_ids);
  const crops = new Set(note.planting_ids);
  for (const p of plantings) if (crops.has(p.id) && p.bed_id) beds.add(p.bed_id);
  for (const p of plantings) if (beds.has(p.bed_id)) crops.add(p.id);
  return questions
    .filter((q) => q.status === 'open')
    .filter((q) => q.bed_ids.some((id) => beds.has(id)) || q.planting_ids.some((id) => crops.has(id)))
    .sort((a, b) => a.created.localeCompare(b.created));
}
