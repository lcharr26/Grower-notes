// Data model for Growers Notebook.
//
// Every record carries a site_id so more sites (and later, more users) can be
// added without changing the shape of the data. Nothing here is specific to
// any one garden: beds, varieties and sites are all created by the user.
//
// Factories never require anything beyond the site: capture must never be
// blocked by missing details. Unknown fields are left as null / empty lists.

export const LOCATION_TYPES = ['greenhouse', 'outdoor', 'informal'];
export const PLANTING_METHODS = ['direct', 'transplant', 'drilled'];
// There is deliberately no "cleared" status: debris stays in place as mulch.
export const PLANTING_STATUSES = ['growing', 'harvesting', 'finished'];
export const NOTE_TYPES = ['observation', 'feed', 'task', 'pest', 'harvest', 'other'];
export const QUESTION_STATUSES = ['open', 'resolved'];

// Object stores and the record type each holds. Order matters for export.
export const STORES = [
  'sites', 'beds', 'varieties', 'plantings', 'notes',
  'harvests', 'questions', 'photos', 'settings',
];

export function newId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (e.g. testing over plain http on a LAN).
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function today() {
  return nowIso().slice(0, 10);
}

function pick(value, allowed, fallback = null) {
  return allowed.includes(value) ? value : fallback;
}

function list(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter((v) => v != null) : [value];
}

export function makeSite(fields = {}) {
  return {
    id: fields.id || newId(),
    name: fields.name || 'My garden',
    location: fields.location || '',
    last_frost: fields.last_frost || null, // 'YYYY-MM-DD' or 'MM-DD', user set
    first_frost: fields.first_frost || null,
    preset: fields.preset || null, // which ready-made garden it came from, if any
    created: fields.created || nowIso(),
  };
}

export function makeBed(siteId, fields = {}) {
  return {
    id: fields.id || newId(),
    site_id: siteId,
    name: fields.name || 'Unnamed bed',
    location_type: pick(fields.location_type, LOCATION_TYPES, 'outdoor'),
    notes: fields.notes || '',
    sort: fields.sort ?? 0,
    created: fields.created || nowIso(),
  };
}

export function makeVariety(siteId, fields = {}) {
  return {
    id: fields.id || newId(),
    site_id: siteId,
    crop: fields.crop || '',
    variety: fields.variety || '',
    supplier: fields.supplier || '',
    notes: fields.notes || '',
    stock: fields.stock ?? null, // optional, free text or number
    created: fields.created || nowIso(),
  };
}

export function makePlanting(siteId, fields = {}) {
  return {
    id: fields.id || newId(),
    site_id: siteId,
    bed_id: fields.bed_id || null,
    variety_id: fields.variety_id || null,
    sown: fields.sown || null,
    planted: fields.planted || null,
    method: pick(fields.method, PLANTING_METHODS),
    status: pick(fields.status, PLANTING_STATUSES, 'growing'),
    notes: fields.notes || '',
    created: fields.created || nowIso(),
  };
}

export function makeNote(siteId, fields = {}) {
  return {
    id: fields.id || newId(),
    site_id: siteId,
    timestamp: fields.timestamp || nowIso(),
    text: fields.text || '',
    photos: list(fields.photos), // photo ids, blobs live in the photos store
    bed_ids: list(fields.bed_ids),
    planting_ids: list(fields.planting_ids),
    type: pick(fields.type, NOTE_TYPES),
  };
}

// A note with no bed or planting tags waits in Tasks to be tidied.
export function isUntagged(note) {
  return note.bed_ids.length === 0 && note.planting_ids.length === 0;
}

export function makeHarvest(siteId, fields = {}) {
  return {
    id: fields.id || newId(),
    site_id: siteId,
    date: fields.date || today(),
    bed_id: fields.bed_id || null,
    planting_id: fields.planting_id || null,
    amount: fields.amount || '', // rough, free text
    notes: fields.notes || '',
    created: fields.created || nowIso(),
  };
}

export function makeQuestion(siteId, fields = {}) {
  return {
    id: fields.id || newId(),
    site_id: siteId,
    bed_ids: list(fields.bed_ids),
    planting_ids: list(fields.planting_ids),
    text: fields.text || '',
    status: pick(fields.status, QUESTION_STATUSES, 'open'),
    created: fields.created || nowIso(),
    resolved: fields.resolved || null,
    resolution_note: fields.resolution_note || '',
    resolved_by_note_id: fields.resolved_by_note_id || null,
  };
}

// Photo blobs are stored separately from notes so note lists stay fast.
export function makePhoto(siteId, blob, fields = {}) {
  return {
    id: fields.id || newId(),
    site_id: siteId,
    note_id: fields.note_id || null,
    type: blob && blob.type ? blob.type : 'image/jpeg',
    size: blob ? blob.size : 0,
    created: fields.created || nowIso(),
    blob,
  };
}

export const DEFAULT_SETTINGS = {
  current_site_id: null,
  last_export: null, // ISO timestamp
  reminder_interval_days: 14,
};
