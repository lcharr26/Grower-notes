// Home: the bed dashboard. One card per bed showing what's in it now, the
// last note and any open questions. Tap a card for that bed's full history.

import { bedSummaries } from '../bedview.js';
import { LOCATION_LABELS, bedsForSite, currentSite, groupBeds } from '../garden.js';
import { inboxNotes } from '../notes.js';
import { TYPE_LABELS } from '../tags.js';
import { go, h, sinceText } from '../ui.js';

function lastNoteText(note) {
  const words = note.text || (note.photos.length ? 'Photo' : TYPE_LABELS[note.type] || 'Note');
  return `${words.length > 60 ? `${words.slice(0, 57).trimEnd()}…` : words} · ${sinceText(note.timestamp)}`;
}

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const [beds, summaries, inbox] = await Promise.all([
    bedsForSite(site.id), bedSummaries(site.id), inboxNotes(site.id),
  ]);
  const empty = { crops: [], lastNote: null, openQuestions: [] };

  const bedCard = (bed) => {
    const s = summaries.get(bed.id) || empty;
    const n = s.openQuestions.length;
    return h('a', { class: 'bed-card', href: `#/bed?id=${encodeURIComponent(bed.id)}` },
      h('span', { class: 'tile-name' }, bed.name),
      h('span', { class: s.crops.length ? 'crops' : 'crops muted' },
        s.crops.length ? s.crops.map((c) => c.name).join(', ') : 'No crops logged'),
      n ? h('span', { class: 'flag' }, `${n} open question${n > 1 ? 's' : ''}`) : null,
      s.lastNote ? h('span', { class: 'muted small last-note' }, lastNoteText(s.lastNote)) : null,
    );
  };

  root.replaceChildren(...[
    h('h2', { class: 'site-title' }, site.name),

    inbox.length ? h('a', { class: 'card inbox-card', href: '#/tasks' },
      h('strong', {}, `${inbox.length} note${inbox.length > 1 ? 's' : ''} to tidy`),
      h('span', { class: 'muted small' }, 'Saved without a bed. Tap to tag them.'),
    ) : null,

    beds.length
      ? groupBeds(beds).map(([type, group]) => h('section', { class: 'bed-group' },
        h('h3', {}, LOCATION_LABELS[type]),
        h('div', { class: 'tiles' }, group.map(bedCard)),
      ))
      : h('section', { class: 'card' },
        h('p', {}, 'No beds yet.'),
        h('button', { class: 'primary', onclick: () => go('#/beds?setup') }, 'Add beds'),
      ),

    h('a', { class: 'button', href: '#/notes' }, 'All notes'),
  ].flat().filter(Boolean));
}
