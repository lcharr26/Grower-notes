// Tasks (for now: notes waiting to be tagged; upcoming tasks will join them
// here) and the full list of notes. Tap a note to tag, edit or delete it.

import { currentSite } from '../garden.js';
import { isUntagged } from '../model.js';
import { noteCard } from '../notecard.js';
import { notesForSite } from '../notes.js';
import { tagContext } from '../tags.js';
import { go, h } from '../ui.js';

export async function render(root, { tasks }) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const [notes, tags] = await Promise.all([notesForSite(site.id), tagContext(site.id)]);
  const untagged = notes.filter(isUntagged);
  const shown = tasks ? untagged : notes;

  const cards = shown.length
    ? await Promise.all(shown.map((n) => noteCard(n, tags, { tidying: tasks })))
    : [h('p', { class: 'muted empty' }, tasks
      ? 'All tidy. Nothing waiting to be tagged.'
      : 'No notes yet. Tap “+ Note” to jot something down.')];

  root.replaceChildren(...[
    h('h2', { class: 'site-title' }, tasks ? 'Tasks' : 'All notes'),
    tasks ? h('h3', {}, `Notes to tidy (${untagged.length})`) : null,
    tasks && untagged.length ? h('p', { class: 'muted small' }, 'Saved without a bed or crop. Tag them when you have a minute.') : null,
    h('div', { class: 'note-list' }, cards),
    tasks ? h('a', { class: 'button', href: '#/notes' }, `All notes (${notes.length})`) : null,
  ].filter(Boolean));
}
