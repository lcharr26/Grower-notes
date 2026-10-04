// Home: inbox nudge and the current garden's beds. (Becomes the full bed
// dashboard in step 4.)

import * as db from '../db.js';
import { LOCATION_LABELS, bedsForSite, currentSite, groupBeds } from '../garden.js';
import { inboxNotes } from '../notes.js';
import { go, h } from '../ui.js';

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const beds = await bedsForSite(site.id);
  const open = (await db.getByIndex('questions', 'site_id', site.id)).filter((q) => q.status === 'open');
  const inbox = await inboxNotes(site.id);
  const openFor = (bedId) => open.filter((q) => q.bed_ids.includes(bedId)).length;

  root.replaceChildren(...[
    h('h2', { class: 'site-title' }, site.name),

    inbox.length ? h('a', { class: 'card inbox-card', href: '#/inbox' },
      h('strong', {}, `${inbox.length} note${inbox.length > 1 ? 's' : ''} to tidy`),
      h('span', { class: 'muted small' }, 'Saved without a bed. Tap to tag them.'),
    ) : null,


    beds.length
      ? groupBeds(beds).map(([type, group]) => h('section', { class: 'bed-group' },
        h('h3', {}, LOCATION_LABELS[type]),
        h('div', { class: 'tiles' }, group.map((bed) => {
          const n = openFor(bed.id);
          return h('div', { class: 'tile' },
            h('span', { class: 'tile-name' }, bed.name),
            n ? h('span', { class: 'badge' }, `${n} open question${n > 1 ? 's' : ''}`) : null,
          );
        })),
      ))
      : h('section', { class: 'card' },
        h('p', {}, 'No beds yet.'),
        h('button', { class: 'primary', onclick: () => go('#/beds?setup') }, 'Add beds'),
      ),

    h('a', { class: 'button', href: '#/notes' }, 'All notes'),
  ].flat().filter(Boolean));
}
