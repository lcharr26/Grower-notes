// Sites and beds: creating, editing, switching, and the sample garden.

import * as db from './db.js';
import { LOCATION_TYPES, makeBed, makeQuestion, makeSite, makeVariety } from './model.js';
import { SAMPLE_BEDS, SAMPLE_QUESTIONS, SAMPLE_SITE, SAMPLE_VARIETIES } from './sample.js';

export const LOCATION_LABELS = { greenhouse: 'Greenhouse', outdoor: 'Outdoor', informal: 'Informal' };
export const NUMBERED_PREFIX = { greenhouse: 'GH Bed', outdoor: 'Bed', informal: 'Area' };

export async function currentSite() {
  const { current_site_id: id } = await db.getSettings();
  const site = id ? await db.get('sites', id) : null;
  if (site) return site;
  // The saved site has gone (e.g. deleted): fall back to any other one.
  const [first] = await db.getAll('sites');
  if (first) await db.setSetting('current_site_id', first.id);
  return first || null;
}

export async function switchSite(siteId) {
  await db.setSetting('current_site_id', siteId);
}

export async function listSites() {
  const sites = await db.getAll('sites');
  return sites.sort((a, b) => a.created.localeCompare(b.created));
}

export async function createSite(fields) {
  const site = makeSite(fields);
  await db.put('sites', site);
  await switchSite(site.id);
  return site;
}

export async function updateSite(site, fields) {
  return db.put('sites', { ...site, ...fields });
}

export async function deleteSite(siteId) {
  await db.deleteSite(siteId);
  const { current_site_id: id } = await db.getSettings();
  if (id === siteId) {
    const [next] = await listSites();
    await db.setSetting('current_site_id', next ? next.id : null);
  }
}

// Beds in a stable order: greenhouse, outdoor, informal, then as added.
export async function bedsForSite(siteId) {
  const beds = await db.getByIndex('beds', 'site_id', siteId);
  const typeOrder = (b) => LOCATION_TYPES.indexOf(b.location_type);
  return beds.sort((a, b) => typeOrder(a) - typeOrder(b) || a.sort - b.sort || a.name.localeCompare(b.name));
}

export function groupBeds(beds) {
  return LOCATION_TYPES
    .map((type) => [type, beds.filter((b) => b.location_type === type)])
    .filter(([, list]) => list.length);
}

async function nextSort(siteId) {
  const beds = await db.getByIndex('beds', 'site_id', siteId);
  return beds.reduce((max, b) => Math.max(max, b.sort ?? 0), 0) + 1;
}

export async function addBed(siteId, fields) {
  const name = (fields.name || '').trim();
  if (!name) throw new Error('Give the bed a name first.');
  const bed = makeBed(siteId, { ...fields, name, sort: await nextSort(siteId) });
  await db.put('beds', bed);
  return bed;
}

// Adds "Bed 1".."Bed n", carrying on from the highest number already used.
export async function addNumberedBeds(siteId, locationType, prefix, count) {
  const beds = await db.getByIndex('beds', 'site_id', siteId);
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)$`, 'i');
  const highest = beds.reduce((max, b) => {
    const m = b.name.match(pattern);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  let sort = await nextSort(siteId);
  const created = [];
  for (let i = 1; i <= count; i++) {
    created.push(makeBed(siteId, { name: `${prefix} ${highest + i}`, location_type: locationType, sort: sort++ }));
  }
  await db.putMany(created.map((bed) => ['beds', bed]));
  return created;
}

export async function updateBed(bed, fields) {
  const name = fields.name != null ? fields.name.trim() : bed.name;
  if (!name) throw new Error('A bed needs a name.');
  return db.put('beds', { ...bed, ...fields, name });
}

// How many records point at this bed. Beds with history aren't deleted,
// so nothing logged is ever orphaned.
export async function bedUsage(bedId) {
  const counts = await Promise.all([
    db.getByIndex('notes', 'bed_ids', bedId),
    db.getByIndex('plantings', 'bed_id', bedId),
    db.getByIndex('harvests', 'bed_id', bedId),
    db.getByIndex('questions', 'bed_ids', bedId),
  ]);
  return counts.reduce((sum, list) => sum + list.length, 0);
}

export async function deleteBed(bedId) {
  if (await bedUsage(bedId)) throw new Error('This bed has notes or history, so it stays. You can rename it instead.');
  await db.remove('beds', bedId);
}

export async function sampleSite() {
  return (await db.getAll('sites')).find((s) => s.sample) || null;
}

// Loads the sample garden as its own site and switches to it. Loading twice
// just switches back to the existing copy.
export async function loadSample() {
  const existing = await sampleSite();
  if (existing) {
    await switchSite(existing.id);
    return existing;
  }
  const site = makeSite({ ...SAMPLE_SITE, sample: true });
  const records = [['sites', site]];
  const bedIds = {};
  let sort = 1;
  for (const [type, names] of SAMPLE_BEDS) {
    for (const name of names) {
      const bed = makeBed(site.id, { name, location_type: type, sort: sort++ });
      bedIds[name] = bed.id;
      records.push(['beds', bed]);
    }
  }
  for (const [crop, variety, supplier] of SAMPLE_VARIETIES) {
    records.push(['varieties', makeVariety(site.id, { crop, variety, supplier })]);
  }
  for (const [bedName, text] of SAMPLE_QUESTIONS) {
    records.push(['questions', makeQuestion(site.id, { bed_ids: [bedIds[bedName]], text })]);
  }
  await db.putMany(records);
  await switchSite(site.id);
  return site;
}
