// Home: shortcuts and what matters right now, then the beds. Which cards show,
// and in what order, is up to the user (Settings > Customise home). Cards
// with nothing to report stay out of the way.

import * as db from '../db.js';
import { exportNow } from '../backup.js';
import { bedSummaries } from '../bedview.js';
import { openCapture } from '../capture.js';
import { LOCATION_LABELS, bedsForSite, currentSite, groupBeds } from '../garden.js';
import { loadLayout } from '../homelayout.js';
import { inboxNotes, notesForSite } from '../notes.js';
import { TYPE_LABELS } from '../tags.js';
import { busy, go, h, sinceText, whenText } from '../ui.js';

function noteSnippet(note, max = 60) {
  const words = note.text || (note.photos.length ? 'Photo' : TYPE_LABELS[note.type] || 'Note');
  return words.length > max ? `${words.slice(0, max - 3).trimEnd()}…` : words;
}

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const [layout, beds, summaries, tidy, notes, questions] = await Promise.all([
    loadLayout(), bedsForSite(site.id), bedSummaries(site.id), inboxNotes(site.id),
    notesForSite(site.id), db.getByIndex('questions', 'site_id', site.id),
  ]);
  const bedById = new Map(beds.map((b) => [b.id, b]));
  const openQuestions = questions.filter((q) => q.status === 'open');
  const bedLink = (id) => `#/bed?id=${encodeURIComponent(id)}`;

  const SHORTCUT_ACTIONS = {
    tasks: () => go('#/tasks'),
    beds: () => go('#/beds'),
    site: () => go('#/site'),
    settings: () => go('#/settings'),
  };

  const bedCard = (bed) => {
    const s = summaries.get(bed.id) || { crops: [], lastNote: null, openQuestions: [] };
    const n = s.openQuestions.length;
    return h('a', { class: 'bed-card', href: bedLink(bed.id) },
      h('span', { class: 'tile-name' }, bed.name),
      h('span', { class: s.crops.length ? 'crops' : 'crops muted' },
        s.crops.length ? s.crops.map((c) => c.name).join(', ') : 'No crops logged'),
      n ? h('span', { class: 'flag' }, `${n} open question${n > 1 ? 's' : ''}`) : null,
      s.lastNote ? h('span', { class: 'muted small last-note' }, `${noteSnippet(s.lastNote)} · ${sinceText(s.lastNote.timestamp)}`) : null,
    );
  };

  const builders = {
    shortcuts: () => {
      const on = layout.shortcuts.filter((s) => s.on);
      if (!on.length) return null;
      return h('section', { class: 'shortcuts' }, on.map((s) => {
        if (s.id === 'export') {
          const b = h('button', {
            class: 'shortcut',
            onclick: () => busy(b, 'Preparing…', async () => { await exportNow(); }),
          }, s.label);
          return b;
        }
        return h('button', { class: 'shortcut', onclick: SHORTCUT_ACTIONS[s.id] },
          s.id === 'tasks' && tidy.length ? `${s.label} (${tidy.length})` : s.label);
      }));
    },

    notes: () => h('section', { class: 'card notes-card' },
      h('h2', {}, 'Notes'),
      tidy.length ? h('a', { class: 'tidy-line', href: '#/tasks' },
        h('strong', {}, `${tidy.length} note${tidy.length > 1 ? 's' : ''} to tidy`),
        h('span', { class: 'muted small' }, 'Saved without a bed. Tap to tag them.'),
      ) : null,
      h('div', { class: 'two' },
        h('button', { class: 'primary', onclick: () => openCapture() }, 'New note'),
        h('a', { class: 'button', href: '#/notes' }, notes.length ? `All notes (${notes.length})` : 'All notes'),
      ),
    ),

    questions: () => (openQuestions.length ? h('section', { class: 'card questions-card' },
      h('h2', {}, `Open questions (${openQuestions.length})`),
      h('ul', { class: 'plain-list' }, openQuestions.map((q) => {
        const bedNames = q.bed_ids.map((id) => bedById.get(id)?.name).filter(Boolean);
        const body = [h('span', {}, q.text), bedNames.length ? h('span', { class: 'muted small' }, bedNames.join(', ')) : null];
        return h('li', {}, q.bed_ids[0] && bedById.has(q.bed_ids[0])
          ? h('a', { class: 'list-link', href: bedLink(q.bed_ids[0]) }, body)
          : body);
      })),
    ) : null),

    beds: () => (beds.length
      ? groupBeds(beds).map(([type, group]) => h('section', { class: 'bed-group' },
        h('h3', {}, LOCATION_LABELS[type]),
        h('div', { class: 'tiles' }, group.map(bedCard)),
      ))
      : h('section', { class: 'card' },
        h('p', {}, 'No beds yet.'),
        h('button', { class: 'primary', onclick: () => go('#/beds?setup') }, 'Add beds'),
      )),

    recent: () => (notes.length ? h('section', { class: 'card' },
      h('h2', {}, 'Recent notes'),
      h('ul', { class: 'plain-list' }, notes.slice(0, 3).map((n) => h('li', {},
        h('span', {}, noteSnippet(n, 80)),
        h('span', { class: 'muted small' }, [whenText(n.timestamp), ...n.bed_ids.map((id) => bedById.get(id)?.name).filter(Boolean)].join(' · '))))),
      h('a', { class: 'button', href: '#/notes' }, 'All notes'),
    ) : null),
  };

  const cards = layout.sections.filter((s) => s.on).map((s) => builders[s.id]());

  root.replaceChildren(...[
    h('h2', { class: 'site-title' }, site.name),
    ...cards,
    h('a', { class: 'customise-link', href: '#/customise' }, 'Customise home'),
  ].flat().filter(Boolean));
}
