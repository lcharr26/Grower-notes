// Full export and restore. The export is one .zip the user can save anywhere:
//   data.json        every record (photo records without their image bytes)
//   photos/<id>.jpg  every photo, as a normal image file
//   README.txt       what's inside, in plain words
// Nothing is ever trapped in the app.

import * as db from './db.js';
import { upgradeSampleSites } from './garden.js';
import { STORES } from './model.js';
import { createZip, readZip } from './zip.js';

export const FORMAT = 'growers-notebook';
export const FORMAT_VERSION = 1;

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif' };
const MIME = Object.fromEntries(Object.entries(EXT).map(([mime, ext]) => [ext, mime]));

function photoPath(photo) {
  return `photos/${photo.id}.${EXT[photo.type] || 'bin'}`;
}

const README = `Growers Notebook backup
=======================

data.json holds everything you've logged: sites, beds, seed varieties,
plantings, notes, harvests and questions. It is plain JSON, readable by
any text editor or spreadsheet tool.

The photos folder holds every photo as an ordinary image file. Each photo's
entry in data.json ("photos") says which note it belongs to.

To restore, open Growers Notebook > Settings > Restore from a backup and pick
this file.
`;

export async function buildExport() {
  const data = {};
  for (const store of STORES) data[store] = await db.getAll(store);

  const files = [];
  data.photos = data.photos.map((photo) => {
    const { blob, ...meta } = photo;
    const path = photoPath(photo);
    if (blob) files.push({ name: path, data: blob, date: new Date(photo.created) });
    return { ...meta, file: blob ? path : null };
  });

  const exportedAt = new Date().toISOString();
  const json = JSON.stringify({ format: FORMAT, format_version: FORMAT_VERSION, exported_at: exportedAt, data }, null, 2);
  files.unshift({ name: 'README.txt', data: README }, { name: 'data.json', data: json });

  const blob = await createZip(files);
  const filename = `growers-notebook-${exportedAt.slice(0, 10)}.zip`;
  return { blob, filename, exportedAt, counts: countsOf(data) };
}

export function countsOf(data) {
  return Object.fromEntries(STORES.map((s) => [s, (data[s] || []).length]));
}

// Reads and checks a backup file without touching the database.
export async function parseBackup(file) {
  const entries = await readZip(file);
  const jsonBytes = entries.get('data.json');
  if (!jsonBytes) throw new Error('That zip has no data.json, so it is not a Growers Notebook backup.');

  let parsed;
  try { parsed = JSON.parse(new TextDecoder().decode(jsonBytes)); }
  catch { throw new Error('The data in that backup could not be read.'); }
  if (parsed.format !== FORMAT) throw new Error('That file is not a Growers Notebook backup.');
  if (parsed.format_version > FORMAT_VERSION) {
    throw new Error('That backup was made by a newer version of the app. Update the app and try again.');
  }

  const data = {};
  for (const store of STORES) data[store] = Array.isArray(parsed.data[store]) ? parsed.data[store] : [];

  let missingPhotos = 0;
  data.photos = data.photos.map(({ file, ...photo }) => {
    const bytes = file ? entries.get(file) : null;
    if (!bytes) { missingPhotos++; return { ...photo, blob: null }; }
    const type = photo.type || MIME[file.split('.').pop()] || 'application/octet-stream';
    return { ...photo, type, blob: new Blob([bytes], { type }) };
  });

  return { data, exportedAt: parsed.exported_at, counts: countsOf(data), missingPhotos };
}

// Replaces everything on this device with the backup's contents.
export async function restore(parsed) {
  await db.replaceAll(parsed.data);
  await upgradeSampleSites();
  // The backup itself is a known-good export, so the nudge clock starts there.
  if (parsed.exportedAt) await db.setSetting('last_export', parsed.exportedAt);
}

// Hand the file to the user. On phones the share sheet is the friendliest way
// to save to Files / Drive / email; elsewhere fall back to a download.
export async function saveFile(blob, filename, { preferShare = true } = {}) {
  const file = new File([blob], filename, { type: blob.type });
  if (preferShare && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // Some browsers claim support but refuse large files: fall through.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
