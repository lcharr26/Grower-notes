// A note as a card: when, kind, words, photos, tags, and an Edit button that
// opens tagging/editing in place. Used on Tasks, All notes and bed pages.

import { isUntagged } from './model.js';
import { deleteNote, photoBlob, updateNote } from './notes.js';
import { photoUrl } from './photos.js';
import { TYPE_LABELS, TYPE_OPTIONS } from './tags.js';
import { busy, go, h, multiChips, optionalChip, showPhoto, toast, whenText } from './ui.js';

export async function photoStrip(photoIds) {
  const imgs = [];
  for (const id of photoIds) {
    const blob = await photoBlob(id);
    if (!blob) continue;
    const url = photoUrl(blob);
    imgs.push(h('button', { type: 'button', class: 'thumb-btn', 'aria-label': 'View photo', onclick: () => showPhoto(url) },
      h('img', { src: url, alt: '' })));
  }
  return imgs.length ? h('div', { class: 'photos' }, imgs) : null;
}

function editor(note, tags, { tidying, onClose }) {
  const text = h('textarea', { value: note.text, placeholder: 'A few words (optional)' });
  const beds = multiChips(tags.bedOptions, note.bed_ids);
  const plantingOptions = tags.plantingOptions(note.planting_ids);
  const crops = plantingOptions.length ? multiChips(plantingOptions, note.planting_ids) : null;
  const kind = optionalChip(TYPE_OPTIONS, note.type);
  const save = h('button', {
    class: 'primary',
    onclick: () => busy(save, 'Saving…', async () => {
      const next = await updateNote(note, {
        text: text.value, bed_ids: beds.values, planting_ids: crops ? crops.values : note.planting_ids, type: kind.value,
      });
      const where = next.bed_ids.map((id) => tags.bedById.get(id)?.name).filter(Boolean);
      toast(tidying && !isUntagged(next) ? `Tagged${where.length ? ` to ${where.join(', ')}` : ''}.` : 'Saved.');
      go(location.hash);
    }),
  }, 'Save');
  const del = h('button', {
    class: 'danger',
    onclick: () => busy(del, 'Deleting…', async () => {
      if (!confirm('Delete this note and its photos?')) return;
      await deleteNote(note);
      toast('Note deleted.');
      go(location.hash);
    }),
  }, 'Delete note');
  return h('div', { class: 'editor' },
    text,
    tags.bedOptions.length ? [h('h3', {}, 'Bed'), beds.el] : null,
    crops ? [h('h3', {}, 'Crop'), crops.el] : null,
    h('h3', {}, 'Kind of note'), kind.el,
    save,
    h('button', { onclick: onClose }, 'Cancel'),
    del);
}

// tidying: on the Tasks screen, so saving with a tag says "Tagged".
// hereBedId: on a bed page, leave that bed out of the tag line.
export async function noteCard(note, tags, { tidying = false, hereBedId = null } = {}) {
  const bedNames = note.bed_ids.filter((id) => id !== hereBedId).map((id) => tags.bedById.get(id)?.name).filter(Boolean);
  const cropNames = note.planting_ids.map(tags.plantingLabel).filter(Boolean);
  const label = isUntagged(note) ? 'Tag this note' : 'Edit';

  const editButton = h('button', { class: 'quiet', onclick: () => editButton.replaceWith(openEditor()) }, label);
  const openEditor = () => {
    const ed = editor(note, tags, { tidying, onClose: () => ed.replaceWith(editButton) });
    return ed;
  };

  return h('article', { class: 'card note' },
    h('div', { class: 'note-meta' },
      h('span', { class: 'muted small' }, whenText(note.timestamp)),
      note.type ? h('span', { class: `badge type-${note.type}` }, TYPE_LABELS[note.type]) : null,
    ),
    note.text ? h('p', { class: 'note-text' }, note.text) : null,
    await photoStrip(note.photos),
    bedNames.length || cropNames.length
      ? h('p', { class: 'small note-tags' }, [...bedNames, ...cropNames].join(' · '))
      : null,
    editButton,
  );
}
