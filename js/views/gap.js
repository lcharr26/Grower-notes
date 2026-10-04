// "What's going in the gap?" Gap-filling happens right after a harvest, so
// this comes straight after logging one (or marking a crop finished).

import * as db from '../db.js';
import { addGapQuestion } from '../crops.js';
import { currentSite } from '../garden.js';
import { busy, go, h, toast } from '../ui.js';

export async function render(root, { bed: bedId }) {
  const site = await currentSite();
  if (!site) return go('#/welcome');
  const bed = bedId ? await db.get('beds', bedId) : null;
  if (!bed) return go('#/');
  const bedPage = `#/bed?id=${encodeURIComponent(bed.id)}`;

  const later = h('button', {
    onclick: () => busy(later, 'Saving…', async () => {
      await addGapQuestion(site.id, bed.id);
      toast(`Added to ${bed.name}’s open questions.`);
      go(bedPage);
    }),
  }, 'Decide later');

  root.replaceChildren(
    h('section', { class: 'card gap-card' },
      h('h2', {}, 'What’s going in the gap?'),
      h('p', { class: 'muted' }, `Any room in ${bed.name} now? If so, what’s going in, while it’s fresh in your mind?`),
      h('a', { class: 'button primary', href: `#/planting?bed=${encodeURIComponent(bed.id)}` }, 'Plant something now'),
      later,
      h('p', { class: 'muted small' }, '“Decide later” adds it to the bed’s open questions, so it comes back up next time you open the bed.'),
      h('a', { class: 'button quiet', href: bedPage }, 'Nothing for now'),
    ),
  );
}
