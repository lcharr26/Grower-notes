// Small promise wrapper around IndexedDB. Everything stays on the device.

import { DEFAULT_SETTINGS, STORES } from './model.js';

export const DB_NAME = 'growers-notebook';
export const DB_VERSION = 1;

let dbPromise = null;

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

function upgrade(db) {
  const make = (name, indexes = []) => {
    if (db.objectStoreNames.contains(name)) return;
    const store = db.createObjectStore(name, { keyPath: name === 'settings' ? 'key' : 'id' });
    for (const [index, keyPath, opts] of indexes) store.createIndex(index, keyPath, opts || {});
  };
  const site = ['site_id', 'site_id'];
  make('sites');
  make('beds', [site]);
  make('varieties', [site]);
  make('plantings', [site, ['bed_id', 'bed_id'], ['variety_id', 'variety_id'], ['status', 'status']]);
  make('notes', [
    site,
    ['timestamp', 'timestamp'],
    ['bed_ids', 'bed_ids', { multiEntry: true }],
    ['planting_ids', 'planting_ids', { multiEntry: true }],
  ]);
  make('harvests', [site, ['bed_id', 'bed_id'], ['planting_id', 'planting_id'], ['date', 'date']]);
  make('questions', [
    site,
    ['status', 'status'],
    ['bed_ids', 'bed_ids', { multiEntry: true }],
    ['planting_ids', 'planting_ids', { multiEntry: true }],
  ]);
  make('photos', [site, ['note_id', 'note_id']]);
  make('settings');
}

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => upgrade(request.result);
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgraded the schema: let go so it can proceed.
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Growers Notebook tabs and try again.'));
    });
  }
  return dbPromise;
}

export async function closeDb() {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

export async function put(store, record) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(record);
  await done(tx);
  return record;
}

// Write several records across stores in one transaction (all or nothing).
export async function putMany(records) {
  const stores = [...new Set(records.map(([store]) => store))];
  if (stores.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(stores, 'readwrite');
  for (const [store, record] of records) tx.objectStore(store).put(record);
  await done(tx);
}

export async function get(store, id) {
  const db = await openDb();
  return req(db.transaction(store).objectStore(store).get(id));
}

export async function getAll(store) {
  const db = await openDb();
  return req(db.transaction(store).objectStore(store).getAll());
}

export async function getByIndex(store, index, value) {
  const db = await openDb();
  return req(db.transaction(store).objectStore(store).index(index).getAll(value));
}

export async function count(store) {
  const db = await openDb();
  return req(db.transaction(store).objectStore(store).count());
}

export async function remove(store, id) {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await done(tx);
}

// Replace the entire contents of the database in a single transaction, so a
// failed restore never leaves a half-written notebook behind.
export async function replaceAll(data) {
  const db = await openDb();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of STORES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const record of data[name] || []) store.put(record);
  }
  await done(tx);
}

export async function clearAll() {
  await replaceAll({});
}

export async function getSettings() {
  const rows = await getAll('settings');
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) settings[key] = value;
  return settings;
}

export async function setSetting(key, value) {
  await put('settings', { key, value });
}
