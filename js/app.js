// Step 1 shell: shows what's stored on this device and lets you export,
// restore, and add test notes. The real screens arrive in later steps.

import * as db from './db.js';
import { buildExport, parseBackup, restore, saveFile } from './backup.js';
import { makeNote, makePhoto, makeSite } from './model.js';

const LABELS = {
  sites: 'Sites', beds: 'Beds', varieties: 'Varieties', plantings: 'Plantings',
  notes: 'Notes', harvests: 'Harvests', questions: 'Questions', photos: 'Photos',
};

const app = document.getElementById('app');

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else if (value !== false && value != null) el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child != null && child !== false) el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

function sinceText(iso) {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

function megabytes(bytes) {
  return (bytes / 1_048_576).toFixed(1) + ' MB';
}

async function busy(button, label, fn) {
  const old = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try { await fn(); }
  catch (err) { console.error(err); toast(err.message || 'Something went wrong.'); }
  finally { button.disabled = false; button.textContent = old; }
}

// Ask the browser not to clear our data when the phone is short of space.
async function askForPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

async function ensureSite() {
  const settings = await db.getSettings();
  if (settings.current_site_id && await db.get('sites', settings.current_site_id)) {
    return settings.current_site_id;
  }
  const site = makeSite({ name: 'Test site' });
  await db.put('sites', site);
  await db.setSetting('current_site_id', site.id);
  return site.id;
}

async function render() {
  const settings = await db.getSettings();
  const counts = {};
  for (const store of Object.keys(LABELS)) counts[store] = await db.count(store);
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
  const estimate = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;

  const exportBtn = h('button', { class: 'primary', onclick: () => busy(exportBtn, 'Preparing…', doExport) }, 'Export everything');
  const restoreInput = h('input', { type: 'file', accept: '.zip,application/zip', onchange: doRestore });
  const noteText = h('textarea', { placeholder: 'A few words…' });
  const notePhoto = h('input', { type: 'file', accept: 'image/*', multiple: true });
  const addBtn = h('button', { onclick: () => busy(addBtn, 'Saving…', () => addTestNote(noteText, notePhoto)) }, 'Save test note');

  app.replaceChildren(
    h('section', { class: 'card' },
      h('h2', {}, 'On this phone'),
      h('p', { class: 'muted small' },
        'Everything is kept on this device only. No account, no server. ',
        persisted === true ? 'The browser has agreed to keep it safe from automatic clean-up.'
          : persisted === false ? 'The browser may clear it if the phone runs short of space, so export now and then.'
            : ''),
      h('ul', { class: 'counts' },
        Object.entries(LABELS).map(([store, label]) => h('li', {}, label, h('b', {}, counts[store])))),
      estimate ? h('p', { class: 'muted small' }, `Using about ${megabytes(estimate.usage || 0)}.`) : null,
    ),

    h('section', { class: 'card' },
      h('h2', {}, 'Backup'),
      h('p', { class: 'muted small' },
        `Last export: ${sinceText(settings.last_export)}. `,
        'One file with all your notes and photos, which you can save anywhere.'),
      exportBtn,
      h('label', { class: 'button file-label' }, 'Restore from a backup', restoreInput),
    ),

    h('section', { class: 'card' },
      h('details', {},
        h('summary', {}, 'Test tools'),
        h('p', { class: 'muted small' }, 'For checking storage and export before the real screens are built.'),
        noteText,
        h('label', { class: 'button file-label' }, 'Add photos', notePhoto),
        addBtn,
        h('button', { class: 'danger', onclick: deleteEverything }, 'Delete everything on this phone'),
      ),
    ),
  );
}

async function addTestNote(textEl, photoEl) {
  const siteId = await ensureSite();
  const note = makeNote(siteId, { text: textEl.value.trim() });
  const writes = [];
  for (const file of photoEl.files) {
    const photo = makePhoto(siteId, file, { note_id: note.id });
    note.photos.push(photo.id);
    writes.push(['photos', photo]);
  }
  writes.push(['notes', note]);
  await db.putMany(writes);
  toast(`Saved${note.photos.length ? ` with ${note.photos.length} photo${note.photos.length > 1 ? 's' : ''}` : ''}.`);
  await render();
}

async function doExport() {
  const { blob, filename, exportedAt } = await buildExport();
  const outcome = await saveFile(blob, filename);
  if (outcome === 'cancelled') return;
  await db.setSetting('last_export', exportedAt);
  toast(`Exported ${filename} (${megabytes(blob.size)}).`);
  await render();
}

async function doRestore(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const parsed = await parseBackup(file);
    const c = parsed.counts;
    const summary = `${c.notes} notes, ${c.photos} photos, ${c.beds} beds, ${c.plantings} plantings`;
    const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('en-GB') : 'an unknown date';
    if (!confirm(`This backup is from ${when} and holds ${summary}.\n\nRestoring replaces everything currently on this phone. Carry on?`)) return;
    await restore(parsed);
    toast(parsed.missingPhotos ? `Restored, but ${parsed.missingPhotos} photo(s) were missing from the file.` : 'Restored.');
    await render();
  } catch (err) {
    console.error(err);
    toast(err.message || 'That backup could not be restored.');
  }
}

async function deleteEverything() {
  if (!confirm('Delete every note, photo and bed on this phone? This cannot be undone. Export first if unsure.')) return;
  await db.clearAll();
  toast('Everything deleted.');
  await render();
}

askForPersistence().catch(() => {});
render().catch((err) => {
  console.error(err);
  app.replaceChildren(h('p', { class: 'warn' }, 'The notebook could not open its storage on this browser: ', err.message));
});
