// Seed library (varieties), crops in the ground (plantings) and harvests.

import * as db from './db.js';
import { makeHarvest, makePlanting, makeQuestion, makeVariety } from './model.js';

export const GAP_QUESTION = 'What’s going in the gap?';

// ---- Seed library -------------------------------------------------------

export async function varietiesForSite(siteId) {
  const list = await db.getByIndex('varieties', 'site_id', siteId);
  return list.sort((a, b) => a.crop.localeCompare(b.crop) || a.variety.localeCompare(b.variety));
}

function cleanVariety(fields) {
  const crop = (fields.crop || '').trim();
  if (!crop) throw new Error('Say what the crop is, e.g. Potato or Lettuce.');
  const stock = fields.stock == null ? null : String(fields.stock).trim() || null;
  return {
    crop,
    variety: (fields.variety || '').trim(),
    supplier: (fields.supplier || '').trim(),
    notes: (fields.notes || '').trim(),
    stock,
  };
}

export async function addVariety(siteId, fields) {
  const variety = makeVariety(siteId, cleanVariety(fields));
  await db.put('varieties', variety);
  return variety;
}

export async function updateVariety(variety, fields) {
  return db.put('varieties', { ...variety, ...cleanVariety({ ...variety, ...fields }) });
}

export async function varietyUsage(varietyId) {
  return (await db.getByIndex('plantings', 'variety_id', varietyId)).length;
}

export async function deleteVariety(varietyId) {
  if (await varietyUsage(varietyId)) throw new Error('This variety has been planted, so it stays as part of the history.');
  await db.remove('varieties', varietyId);
}

// Suppliers already used, for quick picking.
export async function suppliersForSite(siteId) {
  const names = (await varietiesForSite(siteId)).map((v) => v.supplier).filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

// ---- Plantings ----------------------------------------------------------

export async function savePlanting(siteId, fields, existing = null) {
  const planting = existing
    ? { ...existing, ...fields }
    : makePlanting(siteId, fields);
  planting.notes = (planting.notes || '').trim();
  await db.put('plantings', planting);
  return planting;
}

export async function setPlantingStatus(planting, status) {
  return db.put('plantings', { ...planting, status });
}

export async function deletePlanting(planting) {
  const harvests = await db.getByIndex('harvests', 'planting_id', planting.id);
  const notes = await db.getByIndex('notes', 'planting_ids', planting.id);
  if (harvests.length || notes.length) throw new Error('This crop has notes or harvests, so it stays. Mark it finished instead.');
  await db.remove('plantings', planting.id);
}

// ---- Harvests -----------------------------------------------------------

// Logs a harvest. A crop that was "growing" is now "harvesting"; if this was
// the last of it, it's "finished" (and its debris stays put as mulch).
export async function logHarvest(siteId, { date, bed_id, planting_id, amount, notes, lastOfIt = false }) {
  const harvest = makeHarvest(siteId, {
    date, bed_id, planting_id, amount: (amount || '').trim(), notes: (notes || '').trim(),
  });
  const writes = [['harvests', harvest]];
  if (planting_id) {
    const planting = await db.get('plantings', planting_id);
    if (planting) {
      const status = lastOfIt ? 'finished' : planting.status === 'growing' ? 'harvesting' : planting.status;
      if (status !== planting.status) writes.push(['plantings', { ...planting, status }]);
      if (!harvest.bed_id) harvest.bed_id = planting.bed_id;
    }
  }
  await db.putMany(writes);
  return harvest;
}

export async function harvestsForSite(siteId) {
  const list = await db.getByIndex('harvests', 'site_id', siteId);
  return list.sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created));
}

export async function deleteHarvest(harvestId) {
  await db.remove('harvests', harvestId);
}

// "Decide later" on the gap prompt: an open question on the bed, so it
// comes back up next time the bed is opened. Only one at a time per bed.
export async function addGapQuestion(siteId, bedId) {
  const open = (await db.getByIndex('questions', 'bed_ids', bedId))
    .find((q) => q.status === 'open' && q.text === GAP_QUESTION);
  if (open) return open;
  const question = makeQuestion(siteId, { bed_ids: [bedId], text: GAP_QUESTION });
  await db.put('questions', question);
  return question;
}
