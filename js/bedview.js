// What each bed looks like right now, and its full story, built from notes,
// plantings, harvests and questions.

import * as db from './db.js';
import { varietyName } from './tags.js';

// Date-only values ('YYYY-MM-DD') sort as midday that day, among the notes.
function sortKey(value) {
  return value.length === 10 ? `${value}T12:00:00.000Z` : value;
}

async function siteRecords(siteId) {
  const [notes, plantings, varieties, harvests, questions] = await Promise.all([
    db.getByIndex('notes', 'site_id', siteId),
    db.getByIndex('plantings', 'site_id', siteId),
    db.getByIndex('varieties', 'site_id', siteId),
    db.getByIndex('harvests', 'site_id', siteId),
    db.getByIndex('questions', 'site_id', siteId),
  ]);
  const varietyById = new Map(varieties.map((v) => [v.id, v]));
  const cropName = (planting) => varietyName(varietyById.get(planting?.variety_id));
  notes.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { notes, plantings, harvests, questions, cropName };
}

// Debris stays as mulch, so a bed with nothing growing isn't "cleared": it
// simply has no crops logged in it right now.
const inGround = (p) => p.status === 'growing' || p.status === 'harvesting';

// bedId -> { crops: [{ id, name, status }], lastNote, openQuestions }
export async function bedSummaries(siteId) {
  const { notes, plantings, questions, cropName } = await siteRecords(siteId);
  const summaries = new Map();
  const get = (bedId) => {
    if (!summaries.has(bedId)) summaries.set(bedId, { crops: [], lastNote: null, openQuestions: [] });
    return summaries.get(bedId);
  };
  for (const p of plantings.filter(inGround)) {
    if (p.bed_id) get(p.bed_id).crops.push({ id: p.id, name: cropName(p), status: p.status });
  }
  const bedOfPlanting = new Map(plantings.map((p) => [p.id, p.bed_id]));
  for (const note of notes) { // newest first, so the first one seen is the last note
    const beds = new Set([...note.bed_ids, ...note.planting_ids.map((id) => bedOfPlanting.get(id)).filter(Boolean)]);
    for (const bedId of beds) {
      const s = get(bedId);
      if (!s.lastNote) s.lastNote = note;
    }
  }
  for (const q of questions.filter((x) => x.status === 'open')) {
    for (const bedId of q.bed_ids) get(bedId).openQuestions.push(q);
  }
  return summaries;
}

// Everything that has happened in one bed, newest first.
export async function bedHistory(siteId, bedId) {
  const { notes, plantings, harvests, questions, cropName } = await siteRecords(siteId);
  const here = plantings.filter((p) => p.bed_id === bedId);
  const herePlantingIds = new Set(here.map((p) => p.id));
  const plantingById = new Map(plantings.map((p) => [p.id, p]));
  const events = [];

  for (const note of notes) {
    if (note.bed_ids.includes(bedId) || note.planting_ids.some((id) => herePlantingIds.has(id))) {
      events.push({ kind: 'note', at: note.timestamp, note });
    }
  }
  for (const p of here) {
    if (p.sown) events.push({ kind: 'sown', at: p.sown, planting: p, crop: cropName(p) });
    if (p.planted) events.push({ kind: 'planted', at: p.planted, planting: p, crop: cropName(p) });
  }
  for (const hv of harvests) {
    if (hv.bed_id === bedId || herePlantingIds.has(hv.planting_id)) {
      events.push({ kind: 'harvest', at: hv.date, harvest: hv, crop: hv.planting_id ? cropName(plantingById.get(hv.planting_id)) : null });
    }
  }
  const bedQuestions = questions.filter((q) => q.bed_ids.includes(bedId) || q.planting_ids.some((id) => herePlantingIds.has(id)));
  for (const q of bedQuestions) {
    events.push({ kind: 'asked', at: q.created, question: q });
    if (q.status === 'resolved' && q.resolved) events.push({ kind: 'resolved', at: q.resolved, question: q });
  }
  // Same day: sown, then planted, then harvested, then everything else.
  const RANK = { sown: 0, planted: 1, harvest: 2 };
  const rank = (e) => RANK[e.kind] ?? 3;
  events.sort((a, b) => sortKey(b.at).localeCompare(sortKey(a.at)) || rank(b) - rank(a));

  return {
    crops: here.filter(inGround).map((p) => ({ id: p.id, name: cropName(p), status: p.status, planting: p })),
    openQuestions: bedQuestions.filter((q) => q.status === 'open'),
    events,
  };
}
