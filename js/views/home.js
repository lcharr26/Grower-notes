// Home: the current garden's beds. (Becomes the full bed dashboard in step 4.)

import * as db from '../db.js';
import { LOCATION_LABELS, bedsForSite, currentSite, deleteSite, groupBeds } from '../garden.js';
import { busy, go, h, toast } from '../ui.js';

export async function render(root) {
  const site = await currentSite();
  if (!site) return go('#/welcome');

  const beds = await bedsForSite(site.id);
  const open = (await db.getByIndex('questions', 'site_id', site.id)).filter((q) => q.status === 'open');
  const openFor = (bedId) => open.filter((q) => q.bed_ids.includes(bedId)).length;

  const removeBtn = h('button', {
    onclick: () => busy(removeBtn, 'Removing…', async () => {
      if (!confirm('Remove the sample garden and everything in it?')) return;
      await deleteSite(site.id);
      toast('Sample garden removed.');
      go('#/');
    }),
  }, 'Remove sample');

  root.replaceChildren(...[
    site.sample ? h('section', { class: 'card banner' },
      h('p', {}, 'You’re looking at a sample garden. Have a poke around; nothing here is yours.'),
      h('div', { class: 'two' },
        h('button', { class: 'primary', onclick: () => go('#/site/new') }, 'Set up my garden'),
        removeBtn,
      ),
    ) : null,

    h('h2', { class: 'site-title' }, site.name),

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
  ].flat().filter(Boolean));
}
