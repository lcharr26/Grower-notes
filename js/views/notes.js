// Tasks (for now: notes waiting to be tagged; upcoming tasks will join them
// here) and the full list of notes. Tap a note to tag, edit or delete it.

import { currentSite } from '../garden.js';
import { isUntagged } from '../model.js';
import { deleteNote, notesForSite, photoBlob, updateNote } from '../notes.js';
import { photoUrl } from '../photos.js';
import { TYPE_LABELS, TYPE_OPTIONS, tagContext } from '../tags.js';
import { busy, go, h, multiChips, optionalChip, showPhoto, toast, whenText } from '../ui.js';

export async function render(root, { tasks: inbox }) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const [notes, tags] = await Promise.all([notesForSite(site.id), tagContext(site.id)]);
  const untagged = notes.filter(isUntagged);
  const shown = inbox ? untagged : notes;
  let open = null;
  const list = h('div', { class: 'note-list' });

  async function thumbs(note) {
    const imgs = [];
    for (const id of note.photos) {
      const blob = await photoBlob(id);
      if (!blob) continue;
      const url = photoUrl(blob);
      imgs.push(h('button', { type: 'button', class: 'thumb-btn', 'aria-label': 'View photo', onclick: () => showPhoto(url) },
        h('img', { src: url, alt: '' })));
    }
    return imgs.length ? h('div', { class: 'photos' }, imgs) : null;
  }

  function editor(note) {
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
        toast(inbox && !isUntagged(next) ? `Tagged${where.length ? ` to ${where.join(', ')}` : ''}.` : 'Saved.');
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
      save, del);
  }

  async function card(note) {
    const bedNames = note.bed_ids.map((id) => tags.bedById.get(id)?.name).filter(Boolean);
    const cropNames = note.planting_ids.map(tags.plantingLabel).filter(Boolean);
    const isOpen = open === note.id;
    return h('article', { class: 'card note' },
      h('div', { class: 'note-meta' },
        h('span', { class: 'muted small' }, whenText(note.timestamp)),
        note.type ? h('span', { class: `badge type-${note.type}` }, TYPE_LABELS[note.type]) : null,
      ),
      note.text ? h('p', { class: 'note-text' }, note.text) : null,
      await thumbs(note),
      bedNames.length || cropNames.length
        ? h('p', { class: 'small note-tags' }, [...bedNames, ...cropNames].join(' · '))
        : null,
      isOpen ? editor(note) : h('button', {
        onclick: () => { open = note.id; refresh(); },
      }, isUntagged(note) ? 'Tag this note' : 'Edit'),
    );
  }

  async function refresh() {
    if (!shown.length) {
      list.replaceChildren(h('p', { class: 'muted empty' }, inbox
        ? 'All tidy. Nothing waiting to be tagged.'
        : 'No notes yet. Tap “+ Note” to jot something down.'));
      return;
    }
    list.replaceChildren(...await Promise.all(shown.map(card)));
  }

  root.replaceChildren(...[
    h('h2', { class: 'site-title' }, inbox ? 'Tasks' : 'All notes'),
    inbox ? h('h3', {}, `Notes to tidy (${untagged.length})`) : null,
    inbox && untagged.length ? h('p', { class: 'muted small' }, 'Saved without a bed or crop. Tag them when you have a minute.') : null,
    list,
    inbox ? h('a', { class: 'button', href: '#/notes' }, `All notes (${notes.length})`) : null,
  ].filter(Boolean));
  await refresh();
}
