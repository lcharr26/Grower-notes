// Quick note: one button, always there. Photo and/or a few words, optional
// tags, save. Nothing is required, and untagged notes wait in Tasks to be tagged.

import { currentSite } from './garden.js';
import { hasContent, saveNote } from './notes.js';
import { shrinkPhoto } from './photos.js';
import { TYPE_OPTIONS, tagContext } from './tags.js';
import { h, multiChips, optionalChip, toast } from './ui.js';

let sheet = null;

// Called after a note is saved, so the screen underneath can refresh.
let afterSave = () => {};
export function onNoteSaved(fn) { afterSave = fn; }

export async function openCapture({ bed_ids = [] } = {}) {
  if (sheet) return;
  const site = await currentSite();
  if (!site) return;
  const tags = await tagContext(site.id);

  // Photos are shrunk as soon as they're picked, so saving is instant.
  const photos = []; // { promise, url }
  const previews = h('div', { class: 'capture-photos' });

  function addFiles(fileList) {
    for (const file of fileList) {
      const url = URL.createObjectURL(file);
      const entry = { url, promise: shrinkPhoto(file) };
      photos.push(entry);
      const remove = h('button', {
        type: 'button', class: 'thumb-remove', 'aria-label': 'Remove photo',
        onclick: () => {
          photos.splice(photos.indexOf(entry), 1);
          URL.revokeObjectURL(url);
          thumb.remove();
        },
      }, '×');
      const thumb = h('div', { class: 'thumb' }, h('img', { src: url, alt: '' }), remove);
      previews.append(thumb);
    }
  }

  const camera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', onchange: (e) => { addFiles(e.target.files); e.target.value = ''; } });
  const gallery = h('input', { type: 'file', accept: 'image/*', multiple: true, onchange: (e) => { addFiles(e.target.files); e.target.value = ''; } });

  const text = h('textarea', { class: 'capture-text', placeholder: 'What’s happening? (optional)', rows: 3 });
  const beds = multiChips(tags.bedOptions, bed_ids);
  const plantingOptions = tags.plantingOptions();
  const crops = plantingOptions.length ? multiChips(plantingOptions) : null;
  const kind = optionalChip(TYPE_OPTIONS);

  const draft = () => ({
    text: text.value, files: photos, bed_ids: beds.values, planting_ids: crops ? crops.values : [], type: kind.value,
  });

  function close() {
    for (const p of photos) URL.revokeObjectURL(p.url);
    sheet.remove();
    sheet = null;
    document.body.classList.remove('sheet-open');
  }

  function tryClose() {
    if (hasContent(draft()) && !confirm('Throw this note away?')) return;
    close();
  }

  const save = h('button', {
    class: 'primary save',
    onclick: async () => {
      const d = draft();
      if (!hasContent(d)) { toast('Add a photo or a few words first.'); return; }
      save.disabled = true;
      save.textContent = 'Saving…';
      try {
        const files = await Promise.all(photos.map((p) => p.promise));
        const note = await saveNote(site.id, { ...d, files });
        close();
        const where = note.bed_ids.map((id) => tags.bedById.get(id)?.name).filter(Boolean);
        toast(where.length ? `Saved to ${where.join(', ')}.`
          : note.planting_ids.length ? 'Saved.' : 'Saved. It’s in Tasks to tag later.');
        afterSave(note);
      } catch (err) {
        console.error(err);
        toast(err.message || 'Could not save. Please try again.');
        save.disabled = false;
        save.textContent = 'Save note';
      }
    },
  }, 'Save note');

  sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'New note' },
    h('div', { class: 'sheet-head' },
      h('h2', {}, 'New note'),
      h('button', { type: 'button', class: 'close', 'aria-label': 'Close', onclick: tryClose }, '×'),
    ),
    h('div', { class: 'sheet-body' },
      h('div', { class: 'two' },
        h('label', { class: 'button file-label photo-btn' }, 'Take photo', camera),
        h('label', { class: 'button file-label photo-btn' }, 'From photos', gallery),
      ),
      previews,
      text,
      tags.bedOptions.length ? [h('h3', {}, 'Bed'), beds.el] : null,
      crops ? [h('h3', {}, 'Crop'), crops.el] : null,
      h('h3', {}, 'Kind of note'),
      kind.el,
    ),
    h('div', { class: 'sheet-foot' }, save),
  );
  document.body.append(sheet);
  document.body.classList.add('sheet-open');
}

export function isCaptureOpen() {
  return sheet !== null;
}
